import os
import sys
import subprocess
import re
import logging
from typing import Dict, Any, List, Optional
from pathlib import Path

logger = logging.getLogger("aeroscan.wsl")

BASE_DIR = Path(__file__).resolve().parent.parent.parent

class WSLManager:
    """
    Manager for WSL2 and USB/IP Monitor Mode Extension on Windows.
    Provides automated detection, installation scripts (Docker Desktop style),
    and execution bridge for Linux Scapy 802.11 monitor mode.
    """

    @staticmethod
    def is_windows() -> bool:
        return sys.platform == "win32"

    @classmethod
    def check_wsl_installed(cls) -> Dict[str, Any]:
        """
        Check if WSL executable exists and if a WSL2 kernel/distro is active.
        """
        if not cls.is_windows():
            return {
                "available": True,
                "installed": True,
                "message": "Sistema Linux nativo detectado.",
                "distros": ["Linux Host"]
            }

        # Check if wsl.exe exists in System32
        wsl_path = Path(os.environ.get("SystemRoot", "C:\\Windows")) / "System32" / "wsl.exe"
        if not wsl_path.exists():
            return {
                "available": False,
                "installed": False,
                "message": "wsl.exe no encontrado en C:\\Windows\\System32.",
                "distros": []
            }

        # Query wsl --status or wsl -l -v
        try:
            res = subprocess.run(
                ["wsl.exe", "--status"],
                capture_output=True,
                timeout=6
            )
            # wsl.exe outputs in utf-16le or ascii depending on build
            raw = res.stdout + res.stderr
            text = ""
            for enc in ("utf-16le", "utf-8", "latin-1", "cp1252"):
                try:
                    text = raw.decode(enc)
                    if "wsl" in text.lower() or "distribu" in text.lower() or "linux" in text.lower() or "instal" in text.lower():
                        break
                except Exception:
                    continue

            is_installed = res.returncode == 0 and ("no est" not in text.lower() and "not installed" not in text.lower())

            # Query installed distributions
            distros: List[str] = []
            if is_installed:
                try:
                    res_l = subprocess.run(["wsl.exe", "-l", "-q"], capture_output=True, timeout=5)
                    raw_l = res_l.stdout
                    text_l = ""
                    for enc in ("utf-16le", "utf-8", "latin-1"):
                        try:
                            text_l = raw_l.decode(enc)
                            break
                        except Exception:
                            continue
                    distros = [d.strip() for d in text_l.splitlines() if d.strip()]
                except Exception:
                    pass

            return {
                "available": True,
                "installed": is_installed,
                "message": text.strip() if text else ("WSL2 activo y listo." if is_installed else "WSL no instalado."),
                "distros": distros
            }
        except Exception as e:
            return {
                "available": True,
                "installed": False,
                "message": f"Error verificando WSL: {e}",
                "distros": []
            }

    @classmethod
    def check_usbipd_installed(cls) -> bool:
        """Check if usbipd tool is installed in PATH."""
        if not cls.is_windows():
            return True
        try:
            res = subprocess.run(["where.exe", "usbipd"], capture_output=True, text=True, timeout=4)
            return res.returncode == 0
        except Exception:
            return False

    @classmethod
    def check_winget_installed(cls) -> bool:
        """Check if Windows Package Manager (winget) is installed."""
        if not cls.is_windows():
            return False
        try:
            res = subprocess.run(["where.exe", "winget"], capture_output=True, text=True, timeout=4)
            return res.returncode == 0
        except Exception:
            return False

    @classmethod
    def detect_usb_wifi_adapters(cls) -> List[Dict[str, str]]:
        """
        Detect any physical USB Wi-Fi adapters connected to the Windows host
        using lightning-fast Windows Registry (winreg) queries.
        """
        adapters = []
        if not cls.is_windows():
            return adapters

        try:
            import winreg
            net_class = r"SYSTEM\CurrentControlSet\Control\Class\{4d36e972-e325-11ce-bfc1-08002be10318}"
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, net_class) as key:
                for i in range(150):
                    try:
                        subkey_name = winreg.EnumKey(key, i)
                        with winreg.OpenKey(key, subkey_name) as skey:
                            desc = ""
                            match_id = ""
                            try:
                                desc, _ = winreg.QueryValueEx(skey, "DriverDesc")
                            except Exception:
                                pass
                            try:
                                match_id, _ = winreg.QueryValueEx(skey, "MatchingDeviceId")
                            except Exception:
                                pass

                            if not match_id:
                                try:
                                    match_id, _ = winreg.QueryValueEx(skey, "DeviceInstanceID")
                                except Exception:
                                    pass

                            # Check if device is a USB Wi-Fi adapter
                            is_usb = "USB" in match_id.upper() or "USB" in desc.upper()
                            is_wifi = any(w in desc.upper() for w in ("WIRELESS", "WI-FI", "802.11", "WLAN", "TP-LINK", "ALFA", "REALTEK"))

                            if is_usb and is_wifi:
                                adapters.append({
                                    "name": desc or "Adaptador Wi-Fi USB",
                                    "instance_id": match_id or "USB Device",
                                    "status": "Conectado",
                                    "compatible_monitor": True
                                })
                    except OSError:
                        break
        except Exception as e:
            logger.warning(f"Error querying USB Wi-Fi devices via winreg: {e}")

        return adapters

    @classmethod
    def get_full_status(cls) -> Dict[str, Any]:
        """
        Aggregate complete diagnostic state for WSL2 Monitor Mode Extension.
        """
        wsl_info = cls.check_wsl_installed()
        usbipd_ready = cls.check_usbipd_installed()
        winget_ready = cls.check_winget_installed()
        usb_adapters = cls.detect_usb_wifi_adapters()

        has_distro = len(wsl_info.get("distros", [])) > 0
        monitor_ready = bool(wsl_info.get("installed") and has_distro and usbipd_ready)

        return {
            "is_windows": cls.is_windows(),
            "wsl_available": wsl_info.get("available", False),
            "wsl_installed": wsl_info.get("installed", False),
            "wsl_message": wsl_info.get("message", ""),
            "distros": wsl_info.get("distros", []),
            "usbipd_installed": usbipd_ready,
            "winget_available": winget_ready,
            "usb_wifi_adapters": usb_adapters,
            "monitor_ready": monitor_ready,
            "commands": {
                "install_wsl": "wsl.exe --install -d Ubuntu",
                "install_usbipd": "winget install --exact dorssel.usbipd-win",
                "setup_packages": "sudo apt update && sudo apt install -y python3-scapy aircrack-ng wireless-tools tshark"
            }
        }

    @classmethod
    def generate_installer_batch_script(cls) -> str:
        """
        Generate standalone .bat script that users or AeroScan can run with 1-click
        to install WSL2, Ubuntu, and USB/IP for Wi-Fi monitor mode passthrough.
        """
        script_path = BASE_DIR / "scripts" / "setup_wsl_monitor_extension.bat"
        script_path.parent.mkdir(parents=True, exist_ok=True)

        content = """@echo off
chcp 65001 >nul
echo =====================================================================
echo    AEROSCAN — EXTENSIÓN DE MODO MONITOR PROMISCUO (WSL2 + SCAPY)
echo    Facultad de Ingeniería Estadística e Informática — UNA PUNO
echo =====================================================================
echo.
echo [*] Este instalador automatizado configurará el entorno necesario para
echo     capturar tramas 802.11 en Modo Monitor Promiscuo (Data, RTS/CTS, ACK)
echo     utilizando el subsistema Linux WSL2 y USB/IP en Windows.
echo.

:: 1. Comprobar permisos de Administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] Solicitando elevacion de privilegios de Administrador...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo [1/4] Verificando Subsistema de Windows para Linux (WSL2)...
wsl.exe --status >nul 2>&1
if %errorLevel% neq 0 (
    echo [*] Instalando WSL2 y distribucion Ubuntu oficial...
    wsl.exe --install -d Ubuntu --no-launch
    if %errorLevel% neq 0 (
        echo [!] Nota: Si es la primera vez que se activa WSL2, puede requerir reiniciar Windows.
    )
) else (
    echo [OK] WSL2 ya se encuentra instalado en este equipo.
)

echo.
echo [2/4] Verificando USBIPD-WIN (Passthrough USB de Antenas Wi-Fi)...
where.exe usbipd >nul 2>&1
if %errorLevel% neq 0 (
    echo [*] Instalando usbipd-win mediante Windows Package Manager (winget)...
    winget install --exact dorssel.usbipd-win --accept-source-agreements --accept-package-agreements
    if %errorLevel% neq 0 (
        echo [!] Intentando instalacion alternativa de usbipd...
        start https://github.com/dorssel/usbipd-win/releases/latest
    ) else (
        echo [OK] usbipd-win instalado satisfactoriamente.
    )
) else (
    echo [OK] usbipd-win ya se encuentra disponible en el sistema.
)

echo.
echo [3/4] Configurando paquetes de auditoria Scapy en Ubuntu WSL2...
wsl.exe -d Ubuntu -u root bash -c "apt update && apt install -y python3-scapy aircrack-ng wireless-tools tshark net-tools" 2>nul
if %errorLevel% equ 0 (
    echo [OK] Paquetes de captura de radiofrecuencia Scapy instalados en WSL2.
) else (
    echo [*] Si Ubuntu es nuevo, completa la configuracion de usuario inicial de WSL abriendo 'Ubuntu' en el menu inicio.
)

echo.
echo [4/4] Listando adaptadores USB detectados para Modo Monitor:
usbipd list 2>nul

echo.
echo =====================================================================
echo [*] ¡CONFIGURACIÓN COMPLETADA!
echo     Para vincular tu antena USB a WSL2 ejecuta:
echo     usbipd attach --wsl -b <BUSID_DE_TU_ANTENA>
echo.
echo     AeroScan detectará automáticamente el entorno Scapy activo.
echo =====================================================================
pause
"""
        with open(script_path, "w", encoding="utf-8") as f:
            f.write(content)

        return str(script_path)

    @classmethod
    def launch_installer(cls) -> Dict[str, Any]:
        """
        Generate and launch the automated setup script in an elevated window.
        """
        if not cls.is_windows():
            return {"status": "error", "message": "Solo disponible en entornos Windows."}

        script_file = cls.generate_installer_batch_script()
        try:
            # Launch via PowerShell Start-Process with -Verb RunAs for admin elevation
            ps_cmd = f"Start-Process -FilePath '{script_file}' -Verb RunAs"
            subprocess.Popen(["powershell", "-NoProfile", "-Command", ps_cmd])
            return {
                "status": "launched",
                "script_path": script_file,
                "message": "Instalador de Extensión WSL2 iniciado en ventana de terminal elevada."
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"No se pudo iniciar el script: {e}",
                "script_path": script_file
            }
