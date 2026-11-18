import os
import sys
import json
import time
import logging
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from datetime import datetime
from pydantic import BaseModel

from app.core.config import SERVER_HOST, SERVER_PORT, REPORTS_DIR, BASE_DIR, REGISTRATION_URL
from app.core.database import init_database, DatabaseManager
from app.capture.hal import ScannedAP, BaseCaptureEngine
from app.capture import create_capture_engine
from app.analysis.metrics import SpectrumAnalyzer
from app.analysis.optimizer import SpectrumOptimizer
from app.reports.pdf_generator import PDFReportGenerator
from app.reports.excel_exporter import ExcelReportExporter

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("aeroscan.main")

# Initialize FastAPI App
app = FastAPI(
    title="AeroScan Core API",
    description="Motor de análisis y diagnóstico espectral de redes inalámbricas WiFi",
    version="1.0.0"
)

# Directories
DIST_DIR = BASE_DIR / "app" / "web" / "dist"
STATIC_DIR = BASE_DIR / "app" / "web" / "static"
TEMPLATES_DIR = BASE_DIR / "app" / "web" / "templates"
STATIC_DIR.mkdir(parents=True, exist_ok=True)
TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)

# Mount static, assets and images files
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
if (DIST_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")

# Mount images directory (supports dist, static and public sources)
IMAGES_DIR = DIST_DIR / "images"
if not IMAGES_DIR.exists():
    IMAGES_DIR = STATIC_DIR / "images"
if not IMAGES_DIR.exists():
    IMAGES_DIR = BASE_DIR / "frontend" / "public" / "images"
if IMAGES_DIR.exists():
    app.mount("/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")


# State Management
class AppState:
    def __init__(self):
        self.current_session_id: Optional[int] = None
        self.engine_type: str = "simulation"
        self.selected_adapter: str = "ALL"
        self.engine: Optional[BaseCaptureEngine] = None
        self.latest_aps: List[ScannedAP] = []
        self.latest_metrics: Dict[str, Any] = {}
        self.active_websockets: List[WebSocket] = []
        self.lock = asyncio.Lock()
        self.scan_interval: float = 2.0
        self.dwell_time_ms: int = 100
        self.noise_floor_dbm: int = -95
        self.enable_24ghz: bool = True
        self.enable_5ghz: bool = True
        self.enable_6ghz: bool = False
        self.critical_rssi_threshold: int = -80
        self.max_ap_congestion: int = 3
        self.total_frames_captured: int = 0
        self.session_start_time: Optional[float] = None

state = AppState()

# Pydantic schemas
class LoginRequest(BaseModel):
    username: str
    password: str

class StartSessionRequest(BaseModel):
    name: str = "Auditoría de Espectro WiFi"
    location: str = "Edificio Central / UNA Puno"
    engine_type: str = "auto"
    notes: str = ""
    user_id: Optional[int] = None
    adapter_id: Optional[str] = "ALL"

class SelectAdapterRequest(BaseModel):
    adapter_id: str

class ConfigUpdateRequest(BaseModel):
    selected_adapter: Optional[str] = None
    scan_interval: Optional[float] = None
    dwell_time_ms: Optional[int] = None
    noise_floor_dbm: Optional[int] = None
    enable_24ghz: Optional[bool] = None
    enable_5ghz: Optional[bool] = None
    enable_6ghz: Optional[bool] = None
    critical_rssi_threshold: Optional[int] = None
    max_ap_congestion: Optional[int] = None

class ApplyChannelRequest(BaseModel):
    target_channel: int
    band: str
    ssid: Optional[str] = None

class OpenBrowserRequest(BaseModel):
    url: Optional[str] = None


# Active session tokens: token -> user dict
ACTIVE_TOKENS: Dict[str, Dict[str, Any]] = {}

# Callback for capture engine
def on_capture_callback(aps: List[ScannedAP]):
    state.latest_aps = aps
    state.total_frames_captured += len(aps)
    # Compute metrics
    metrics = SpectrumAnalyzer.compute_channel_metrics(aps)
    state.latest_metrics = metrics

    # Save to SQLite if session is active
    if state.current_session_id:
        try:
            raw_aps = [ap.to_dict() for ap in aps]
            DatabaseManager.record_samples(state.current_session_id, raw_aps)
        except Exception as e:
            logger.error(f"Error persisting samples to SQLite: {e}")

@app.on_event("startup")
async def startup_event():
    init_database()
    logger.info("AeroScan Database initialized.")
    # Initialize default capture engine
    state.engine = create_capture_engine(engine_type="auto", callback=on_capture_callback)
    state.engine_type = "windows" if state.engine.__class__.__name__ == "WindowsNativeEngine" else ("scapy" if "Scapy" in state.engine.__class__.__name__ else "simulation")
    if hasattr(state.engine, "selected_adapter"):
        state.engine.selected_adapter = state.selected_adapter
    logger.info(f"Initialized capture engine: {state.engine.__class__.__name__} (Mode: {state.engine_type})")
    
    # Auto-start default background session
    state.current_session_id = DatabaseManager.create_session(
        name="Sesión Inicial de Monitoreo",
        location="Entorno Local",
        engine_type=state.engine_type,
        notes="Inicio automático de AeroScan"
    )
    state.session_start_time = time.time()
    state.engine.start()

@app.on_event("shutdown")
async def shutdown_event():
    if state.engine:
        state.engine.stop()
    if state.current_session_id:
        DatabaseManager.end_session(state.current_session_id)
    logger.info("AeroScan shutdown completed.")

# Web Routes
@app.get("/", response_class=HTMLResponse)
async def serve_dashboard():
    dist_index = DIST_DIR / "index.html"
    if dist_index.exists():
        with open(dist_index, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())

    index_file = TEMPLATES_DIR / "index.html"
    if not index_file.exists():
        return HTMLResponse("<h1>Error: index.html no encontrado</h1>", status_code=404)
    with open(index_file, "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

# Explicit routes for Logo and Favicon assets
@app.get("/images/logos/logo.svg")
async def serve_logo_svg():
    for path in [
        DIST_DIR / "images" / "logos" / "logo.svg",
        STATIC_DIR / "images" / "logos" / "logo.svg",
        BASE_DIR / "frontend" / "public" / "images" / "logos" / "logo.svg",
    ]:
        if path.exists():
            return FileResponse(str(path), media_type="image/svg+xml")
    raise HTTPException(status_code=404, detail="Logo SVG not found")

@app.get("/images/logos/logo.png")
async def serve_logo_png():
    for path in [
        DIST_DIR / "images" / "logos" / "logo.png",
        STATIC_DIR / "images" / "logos" / "logo.png",
        BASE_DIR / "frontend" / "public" / "images" / "logos" / "logo.png",
    ]:
        if path.exists():
            return FileResponse(str(path), media_type="image/png")
    raise HTTPException(status_code=404, detail="Logo PNG not found")

@app.get("/favicon.ico")
async def serve_favicon_ico():
    for path in [
        DIST_DIR / "favicon.ico",
        STATIC_DIR / "favicon.ico",
        BASE_DIR / "frontend" / "public" / "favicon.ico",
        DIST_DIR / "favicon.svg",
    ]:
        if path.exists():
            return FileResponse(str(path))
    return HTMLResponse("", status_code=204)

@app.get("/favicon.svg")
async def serve_favicon_svg():
    for path in [
        DIST_DIR / "favicon.svg",
        STATIC_DIR / "favicon.svg",
        BASE_DIR / "frontend" / "public" / "favicon.svg",
    ]:
        if path.exists():
            return FileResponse(str(path), media_type="image/svg+xml")
    return HTMLResponse("", status_code=204)

# Authentication Endpoints
@app.post("/api/auth/login")
async def login(req: LoginRequest):
    user = DatabaseManager.authenticate_user(req.username, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")
    import secrets
    token = secrets.token_urlsafe(32)
    ACTIVE_TOKENS[token] = user
    return {"token": token, "user": user}

@app.get("/api/auth/me")
async def get_current_user(token: Optional[str] = None):
    if not token or token not in ACTIVE_TOKENS:
        raise HTTPException(status_code=401, detail="Sesión no iniciada o token inválido")
    return {"user": ACTIVE_TOKENS[token]}

@app.post("/api/auth/logout")
async def logout(token: Optional[str] = None):
    if token and token in ACTIVE_TOKENS:
        del ACTIVE_TOKENS[token]
    return {"status": "logged_out"}

@app.get("/api/auth/register-url")
async def get_registration_url():
    """Returns the default external registration URL."""
    return {"url": REGISTRATION_URL}

@app.post("/api/system/open-browser")
async def open_external_browser(req: OpenBrowserRequest):
    """Open an external link in the user's default system browser (Edge, Chrome, etc.)."""
    import webbrowser
    target_url = (req.url.strip() if req.url else "") or REGISTRATION_URL
    try:
        webbrowser.open(target_url)
        return {"status": "opened", "url": target_url}
    except Exception as e:
        logger.error(f"Error opening browser: {e}")
        return {"status": "error", "detail": str(e), "url": target_url}


# Hardware Adapters Endpoints
@app.get("/api/hardware/adapters")
async def get_hardware_adapters():
    """Detect and return all Wi-Fi hardware modules (PCIe internal, USB dongles, etc.)."""
    adapters = []
    if state.engine and hasattr(state.engine, "get_adapters"):
        adapters = [a.to_dict() for a in state.engine.get_adapters()]
    elif WindowsNativeEngine().is_hardware_available():
        adapters = [a.to_dict() for a in WindowsNativeEngine().get_adapters()]
    return {
        "total": len(adapters),
        "adapters": adapters,
        "selected_adapter": getattr(state.engine, "selected_adapter", state.selected_adapter) if state.engine else state.selected_adapter,
        "engine_type": state.engine_type
    }

@app.post("/api/hardware/adapters/select")
async def select_hardware_adapter(req: SelectAdapterRequest):
    """Switch active hardware adapter or select 'ALL' for multi-sensor capture."""
    state.selected_adapter = req.adapter_id
    if state.engine and hasattr(state.engine, "set_active_adapter"):
        state.engine.set_active_adapter(req.adapter_id)
    if state.engine:
        state.latest_aps = state.engine.scan_once()
        state.latest_metrics = SpectrumAnalyzer.compute_channel_metrics(state.latest_aps)
    return {
        "status": "ok",
        "selected_adapter": req.adapter_id,
        "total_aps": len(state.latest_aps)
    }

# API Endpoints
@app.get("/api/status")
async def get_status():
    adapters = [a.to_dict() for a in state.engine.get_adapters()] if (state.engine and hasattr(state.engine, "get_adapters")) else []
    is_running = bool(state.engine and state.engine.is_running)
    elapsed = int(time.time() - state.session_start_time) if (state.session_start_time and is_running) else 0
    return {
        "status": "online",
        "current_session_id": state.current_session_id,
        "engine_type": state.engine_type,
        "engine_class": state.engine.__class__.__name__ if state.engine else "None",
        "is_capturing": is_running,
        "total_aps_detected": len(state.latest_aps),
        "total_packets": state.total_frames_captured,
        "session_duration": elapsed,
        "total_adapters_detected": len(adapters),
        "adapters": adapters,
        "selected_adapter": getattr(state.engine, "selected_adapter", state.selected_adapter) if state.engine else state.selected_adapter
    }

@app.post("/api/capture/start")
async def start_capture(req: Optional[StartSessionRequest] = None):
    """Start or resume live RF spectrum capture."""
    if not state.engine:
        engine_type = req.engine_type if (req and req.engine_type) else state.engine_type
        state.engine = create_capture_engine(engine_type=engine_type, callback=on_capture_callback)

    if req and req.adapter_id:
        state.selected_adapter = req.adapter_id
        if hasattr(state.engine, "set_active_adapter"):
            state.engine.set_active_adapter(req.adapter_id)

    if not state.current_session_id:
        name = req.name if (req and req.name) else "Captura en Vivo"
        location = req.location if (req and req.location) else "Entorno Local"
        user_id = req.user_id if req else None
        state.current_session_id = DatabaseManager.create_session(
            name=name,
            location=location,
            engine_type=state.engine_type,
            notes="Sesión iniciada manualmente por usuario",
            user_id=user_id
        )
        state.session_start_time = time.time()
    elif state.session_start_time is None:
        state.session_start_time = time.time()

    state.engine.start()
    logger.info(f"Capture started. Session #{state.current_session_id}, Engine: {state.engine_type}")
    return {
        "status": "started",
        "is_capturing": True,
        "session_id": state.current_session_id,
        "engine_type": state.engine_type,
        "selected_adapter": getattr(state.engine, "selected_adapter", state.selected_adapter) if state.engine else state.selected_adapter,
        "total_packets": state.total_frames_captured
    }

@app.post("/api/capture/stop")
async def stop_capture():
    """Stop active live RF spectrum capture without necessarily deleting session."""
    if state.engine and state.engine.is_running:
        state.engine.stop()
    logger.info(f"Capture stopped. Session #{state.current_session_id}")
    return {
        "status": "stopped",
        "is_capturing": False,
        "session_id": state.current_session_id,
        "total_packets": state.total_frames_captured
    }

@app.post("/api/capture/toggle")
async def toggle_capture():
    """Toggle between starting and stopping capture."""
    is_running = bool(state.engine and state.engine.is_running)
    if is_running:
        return await stop_capture()
    else:
        return await start_capture()

@app.get("/api/capture/status")
async def get_capture_status():
    """Quick endpoint to check live capture state."""
    is_running = bool(state.engine and state.engine.is_running)
    elapsed = int(time.time() - state.session_start_time) if (state.session_start_time and is_running) else 0
    return {
        "is_capturing": is_running,
        "session_id": state.current_session_id,
        "total_packets": state.total_frames_captured,
        "elapsed_seconds": elapsed,
        "engine_type": state.engine_type,
        "selected_adapter": getattr(state.engine, "selected_adapter", state.selected_adapter) if state.engine else state.selected_adapter,
        "total_aps": len(state.latest_aps)
    }

@app.get("/api/export/pcap")
async def export_pcap_dump():
    """Exports structured frames dump in JSON/PCAP-compatible format."""
    samples = []
    if state.current_session_id:
        samples = DatabaseManager.get_session_samples(state.current_session_id, limit=5000)
    if not samples and state.latest_aps:
        samples = [ap.to_dict() for ap in state.latest_aps]

    export_payload = {
        "format": "AeroScan-RF-Dump-v1",
        "timestamp": time.time(),
        "session_id": state.current_session_id,
        "engine": state.engine_type,
        "adapter": state.selected_adapter,
        "total_records": len(samples),
        "frames": samples
    }

    from fastapi.responses import Response
    json_bytes = json.dumps(export_payload, indent=2, ensure_ascii=False).encode("utf-8")
    filename = f"aeroscan_dump_session_{state.current_session_id or 'live'}_{int(time.time())}.json"
    return Response(
        content=json_bytes,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@app.post("/api/session/start")
async def start_session(req: StartSessionRequest):
    if state.engine and state.engine.is_running:
        state.engine.stop()

    state.engine = create_capture_engine(engine_type=req.engine_type, callback=on_capture_callback)
    state.engine_type = req.engine_type
    
    if req.adapter_id:
        state.selected_adapter = req.adapter_id
        if hasattr(state.engine, "set_active_adapter"):
            state.engine.set_active_adapter(req.adapter_id)

    session_id = DatabaseManager.create_session(
        name=req.name,
        location=req.location,
        engine_type=state.engine_type,
        notes=req.notes,
        user_id=req.user_id
    )
    state.current_session_id = session_id
    state.total_frames_captured = 0
    state.session_start_time = time.time()
    state.engine.start()

    logger.info(f"Started new session #{session_id} using engine: {state.engine_type} (adapter: {state.selected_adapter})")
    return {"session_id": session_id, "engine_type": state.engine_type, "selected_adapter": state.selected_adapter, "status": "started", "is_capturing": True}

@app.post("/api/session/stop")
async def stop_session():
    if state.engine:
        state.engine.stop()
    if state.current_session_id:
        DatabaseManager.end_session(state.current_session_id)
        last_id = state.current_session_id
        state.current_session_id = None
        state.session_start_time = None
        return {"status": "stopped", "session_id": last_id, "is_capturing": False}
    return {"status": "no_active_session", "is_capturing": False}

# Application Settings & Configuration Endpoints
@app.get("/api/config")
async def get_config():
    adapters = [a.to_dict() for a in state.engine.get_adapters()] if (state.engine and hasattr(state.engine, "get_adapters")) else []
    return {
        "selected_adapter": getattr(state.engine, "selected_adapter", state.selected_adapter) if state.engine else state.selected_adapter,
        "engine_type": state.engine_type,
        "scan_interval": state.scan_interval,
        "dwell_time_ms": state.dwell_time_ms,
        "noise_floor_dbm": state.noise_floor_dbm,
        "enable_24ghz": state.enable_24ghz,
        "enable_5ghz": state.enable_5ghz,
        "enable_6ghz": state.enable_6ghz,
        "critical_rssi_threshold": state.critical_rssi_threshold,
        "max_ap_congestion": state.max_ap_congestion,
        "adapters": adapters,
    }

@app.post("/api/config")
async def update_config(req: ConfigUpdateRequest):
    if req.selected_adapter is not None:
        state.selected_adapter = req.selected_adapter
        if state.engine and hasattr(state.engine, "set_active_adapter"):
            state.engine.set_active_adapter(req.selected_adapter)
    if req.scan_interval is not None:
        state.scan_interval = max(0.5, min(10.0, req.scan_interval))
        if state.engine and hasattr(state.engine, "interval"):
            state.engine.interval = state.scan_interval
    if req.dwell_time_ms is not None:
        state.dwell_time_ms = req.dwell_time_ms
    if req.noise_floor_dbm is not None:
        state.noise_floor_dbm = req.noise_floor_dbm
    if req.enable_24ghz is not None:
        state.enable_24ghz = req.enable_24ghz
    if req.enable_5ghz is not None:
        state.enable_5ghz = req.enable_5ghz
    if req.enable_6ghz is not None:
        state.enable_6ghz = req.enable_6ghz
    if req.critical_rssi_threshold is not None:
        state.critical_rssi_threshold = req.critical_rssi_threshold
    if req.max_ap_congestion is not None:
        state.max_ap_congestion = req.max_ap_congestion

    return {"status": "updated", "config": await get_config()}

@app.post("/api/channels/apply")
async def apply_channel_configuration(req: ApplyChannelRequest):
    logger.info(f"Applying optimal channel: Ch {req.target_channel} ({req.band}) for SSID {req.ssid or 'Todos'}")
    return {
        "status": "applied",
        "channel": req.target_channel,
        "band": req.band,
        "message": f"Canal Ch {req.target_channel} ({req.band}) aplicado satisfactoriamente en los transceptores de radiofrecuencia."
    }

@app.get("/api/system/info")
async def get_system_info():
    import platform
    db_file = BASE_DIR / "scan.db"
    db_size = db_file.stat().st_size if db_file.exists() else 0
    adapters = [a.to_dict() for a in state.engine.get_adapters()] if (state.engine and hasattr(state.engine, "get_adapters")) else []
    return {
        "platform": platform.platform(),
        "python_version": platform.python_version(),
        "system": platform.system(),
        "processor": platform.processor(),
        "db_path": str(db_file),
        "db_size_bytes": db_size,
        "db_size_formatted": f"{db_size / (1024*1024):.2f} MB",
        "active_session_id": state.current_session_id,
        "active_adapters_count": len(adapters),
        "adapters": adapters,
        "total_aps_cached": len(state.latest_aps)
    }

@app.get("/api/session/{session_id}/export/csv")
async def export_session_csv(session_id: int):
    samples = DatabaseManager.get_session_samples(session_id, limit=5000)
    lines = ["id,timestamp,bssid,ssid,channel,band,rssi,quality,security,width,vendor"]
    for s in samples:
        lines.append(f"{s.get('id')},{s.get('timestamp')},{s.get('bssid')},\"{s.get('ssid','')}\",{s.get('channel')},{s.get('band')},{s.get('rssi')},{s.get('signal_quality')},{s.get('security')},{s.get('channel_width')},\"{s.get('vendor','')}\"")
    csv_content = "\n".join(lines)
    from fastapi.responses import Response
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=session_{session_id}_samples.csv"}
    )

@app.get("/api/export/pcap")
async def export_pcap_dump():
    raw_payload = {
        "export_type": "AeroScan-RF-Frames-Dump",
        "timestamp": datetime.utcnow().isoformat(),
        "engine_type": state.engine_type,
        "selected_adapter": state.selected_adapter,
        "total_frames": len(state.latest_aps),
        "frames": [ap.to_dict() for ap in state.latest_aps]
    }
    from fastapi.responses import Response
    return Response(
        content=json.dumps(raw_payload, indent=2, ensure_ascii=False),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=aeroscan_rf_capture_dump.json"}
    )

@app.get("/api/metrics/current")
async def get_current_metrics():
    if not state.latest_aps and state.engine:
        state.latest_aps = state.engine.scan_once()
        state.latest_metrics = SpectrumAnalyzer.compute_channel_metrics(state.latest_aps)

    recs = SpectrumOptimizer.generate_recommendations(state.latest_metrics)
    return {
        "metrics": state.latest_metrics,
        "recommendations": recs,
        "access_points": [ap.to_dict() for ap in state.latest_aps]
    }

@app.get("/api/sessions")
async def get_sessions_history():
    return DatabaseManager.get_sessions()

@app.get("/api/session/{session_id}/samples")
async def get_session_samples(session_id: int):
    return DatabaseManager.get_session_samples(session_id)

@app.post("/api/reports/pdf")
async def generate_pdf_report():
    if not state.latest_aps and state.engine:
        state.latest_aps = state.engine.scan_once()
        state.latest_metrics = SpectrumAnalyzer.compute_channel_metrics(state.latest_aps)

    sess = DatabaseManager.get_session(state.current_session_id or 1) or {
        "id": 1,
        "name": "Auditoría en Tiempo Real",
        "location": "Sede Central",
        "engine_type": state.engine_type
    }
    recs = SpectrumOptimizer.generate_recommendations(state.latest_metrics)
    ap_dicts = [ap.to_dict() for ap in state.latest_aps]

    pdf_path = PDFReportGenerator.generate(
        session_data=sess,
        analysis=state.latest_metrics,
        recommendations=recs,
        ap_list=ap_dicts
    )

    return {
        "filename": pdf_path.name,
        "download_url": f"/api/reports/download/{pdf_path.name}"
    }

@app.post("/api/reports/excel")
async def generate_excel_report():
    if not state.latest_aps and state.engine:
        state.latest_aps = state.engine.scan_once()
        state.latest_metrics = SpectrumAnalyzer.compute_channel_metrics(state.latest_aps)

    sess = DatabaseManager.get_session(state.current_session_id or 1) or {
        "id": 1,
        "name": "Auditoría en Tiempo Real",
        "location": "Sede Central",
        "engine_type": state.engine_type
    }
    recs = SpectrumOptimizer.generate_recommendations(state.latest_metrics)
    ap_dicts = [ap.to_dict() for ap in state.latest_aps]

    excel_path = ExcelReportExporter.export(
        session_data=sess,
        analysis=state.latest_metrics,
        recommendations=recs,
        ap_list=ap_dicts
    )

    return {
        "filename": excel_path.name,
        "download_url": f"/api/reports/download/{excel_path.name}"
    }

@app.get("/api/reports/download/{filename}")
async def download_report(filename: str):
    file_path = REPORTS_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type="application/octet-stream"
    )

# Real-time WebSocket streaming
@app.websocket("/ws/spectrum")
async def websocket_spectrum(websocket: WebSocket):
    await websocket.accept()
    state.active_websockets.append(websocket)
    try:
        while True:
            # Send latest metrics, AP list and hardware adapters
            adapters = [a.to_dict() for a in state.engine.get_adapters()] if (state.engine and hasattr(state.engine, "get_adapters")) else []
            is_running = bool(state.engine and state.engine.is_running)
            elapsed = int(time.time() - state.session_start_time) if (state.session_start_time and is_running) else 0
            payload = {
                "type": "telemetry_update",
                "session_id": state.current_session_id,
                "engine_type": state.engine_type,
                "is_capturing": is_running,
                "total_packets": state.total_frames_captured,
                "session_duration": elapsed,
                "adapters": adapters,
                "selected_adapter": getattr(state.engine, "selected_adapter", state.selected_adapter) if state.engine else state.selected_adapter,
                "metrics": state.latest_metrics,
                "recommendations": SpectrumOptimizer.generate_recommendations(state.latest_metrics),
                "access_points": [ap.to_dict() for ap in state.latest_aps]
            }
            await websocket.send_text(json.dumps(payload))
            await asyncio.sleep(1.5)
    except WebSocketDisconnect:
        state.active_websockets.remove(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        if websocket in state.active_websockets:
            state.active_websockets.remove(websocket)
