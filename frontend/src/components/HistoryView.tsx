import React, { useState, useEffect, useRef } from 'react';
import './HistoryView.css';
import { ConfirmDialog } from './ConfirmDialog';

interface HistoryViewProps {
  onGeneratePdf: () => void;
}

// Etiquetas legibles para cada motor de captura
const ETIQUETA_MOTOR: Record<string, string> = {
  windows: 'Hardware real (Windows)',
  scapy: 'Modo monitor (WSL2)',
  simulation: 'Simulación',
};

const formatearFecha = (iso?: string) => (iso ? new Date(iso).toLocaleString('es-PE') : 'En curso');

// Convierte una fila de /api/sessions al formato que usa la tabla.
// Antes este bloque estaba copiado dos veces (al cargar y al purgar).
const mapearSesion = (s: any) => ({
  rawId: s.id,
  id: `#SES-${s.id}`,
  name: s.name,
  location: s.location || '—',
  date: formatearFecha(s.start_time || s.created_at),
  engineType: s.engine_type || 'windows',
  engineLabel: ETIQUETA_MOTOR[s.engine_type] || 'Simulación',
  samplesCount: s.sample_count || s.samples_count || 0,
  uniqueAps: s.unique_aps || 0,
  status: s.status === 'completed' ? 'FINALIZADA' : 'ACTIVA',
  color: s.status === 'completed' ? '#34d399' : '#ab85d9',
});

type TipoAviso = 'info' | 'ok' | 'error';

export const HistoryView: React.FC<HistoryViewProps> = ({ onGeneratePdf }) => {
  const [bandFilter, setBandFilter] = useState<'all' | '2.4ghz' | '5ghz' | '6ghz'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [realSessions, setRealSessions] = useState<any[]>([]);
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [congestionOnly, setCongestionOnly] = useState(false);

  const comparisonDataRef = useRef<any>(null);
  comparisonDataRef.current = comparisonData;
  const bandFilterRef = useRef(bandFilter);
  bandFilterRef.current = bandFilter;
  const congestionOnlyRef = useRef(congestionOnly);
  congestionOnlyRef.current = congestionOnly;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [detailSession, setDetailSession] = useState<any | null>(null);
  const [detailSamples, setDetailSamples] = useState<any[]>([]);
  const [isLoadingSamples, setIsLoadingSamples] = useState(false);
  const [compareMessage, setCompareMessage] = useState<string | null>(null);
  const [tipoAviso, setTipoAviso] = useState<TipoAviso>('info');
  // Acción pendiente de confirmar en el diálogo propio (purgar o eliminar)
  const [confirmacion, setConfirmacion] = useState<
    { tipo: 'purgar' } | { tipo: 'eliminar'; rawId: number } | null
  >(null);

  // Muestra un aviso con el color de su resultado y lo oculta después de unos segundos
  const avisoTimer = useRef<number | undefined>(undefined);
  const mostrarAviso = (texto: string, tipo: TipoAviso = 'info', ms = 4000) => {
    setTipoAviso(tipo);
    setCompareMessage(texto);
    window.clearTimeout(avisoTimer.current);
    avisoTimer.current = window.setTimeout(() => setCompareMessage(null), ms);
  };

  // Carga las sesiones y, si hay al menos dos, compara las dos más recientes
  const cargarSesiones = async () => {
    const res = await fetch('/api/sessions');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const lista = Array.isArray(data) ? data.map(mapearSesion) : [];
    setRealSessions(lista);

    if (lista.length >= 2) {
      setSelectedSessions([lista[0].id, lista[1].id]);
      try {
        const r = await fetch(`/api/sessions/compare?id1=${lista[0].rawId}&id2=${lista[1].rawId}`);
        const comp = r.ok ? await r.json() : null;
        setComparisonData(comp && comp.session_1 && comp.session_2 ? comp : null);
      } catch {
        setComparisonData(null);
      }
    } else {
      setSelectedSessions(lista.length > 0 ? [lista[0].id] : []);
      setComparisonData(null);
    }
  };

  useEffect(() => {
    cargarSesiones().catch(() =>
      mostrarAviso('No se pudo cargar el historial. Verifica que el núcleo de AeroScan esté en ejecución.', 'error', 6000)
    );
    return () => window.clearTimeout(avisoTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePurgeSimulated = async () => {
    setConfirmacion(null);
    try {
      const res = await fetch('/api/sessions/purge-simulated', { method: 'POST' });
      if (!res.ok) {
        mostrarAviso('No se pudieron eliminar las sesiones de prueba.', 'error');
        return;
      }
      const data = await res.json();
      await cargarSesiones();
      mostrarAviso(`Limpieza completada: ${data.deleted_sessions} sesiones de prueba eliminadas.`, 'ok');
    } catch {
      mostrarAviso('Sin conexión con el núcleo: no se eliminaron las sesiones de prueba.', 'error');
    }
  };

  const handleOpenDetail = async (ses: any) => {
    setDetailSession(ses);
    setIsLoadingSamples(true);
    try {
      const res = await fetch(`/api/session/${ses.rawId}/samples`);
      if (res.ok) {
        setDetailSamples(await res.json());
      } else {
        setDetailSamples([]);
        mostrarAviso('No se pudieron cargar las lecturas de esta sesión.', 'error');
      }
    } catch {
      setDetailSamples([]);
      mostrarAviso('Sin conexión con el núcleo: no se cargaron las lecturas.', 'error');
    } finally {
      setIsLoadingSamples(false);
    }
  };

  const handleExportCsv = (rawId?: number) => {
    const targetId = rawId ?? realSessions[0]?.rawId;
    if (targetId === undefined) {
      mostrarAviso('Todavía no hay sesiones guardadas para exportar.', 'info');
      return;
    }
    window.location.href = `/api/session/${targetId}/export/csv`;
  };

  const handleExportDiffCsv = () => {
    if (selectedSessions.length < 2) {
      mostrarAviso('Marca dos sesiones en la tabla para descargar la comparación en CSV.');
      return;
    }
    const id1 = String(selectedSessions[0]).replace(/[^0-9]/g, '');
    const id2 = String(selectedSessions[1]).replace(/[^0-9]/g, '');
    window.location.href = `/api/sessions/compare/csv?id1=${id1}&id2=${id2}`;
  };

  const handleExportSessionPdf = async (rawId: number) => {
    try {
      mostrarAviso(`Generando el informe PDF de la sesión #${rawId}...`, 'info', 30000);
      const res = await fetch(`/api/reports/pdf?session_id=${rawId}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.download_url) {
          window.open(data.download_url, '_blank');
        }
        mostrarAviso(`Informe PDF de la sesión #${rawId} generado.`, 'ok');
      } else {
        mostrarAviso('No se pudo generar el PDF de esta sesión.', 'error');
      }
    } catch {
      mostrarAviso('Sin conexión con el núcleo: no se generó el PDF.', 'error');
    }
  };

  // El botón de la tabla solo abre el diálogo; el borrado real ocurre al confirmar
  const handleDeleteSession = (rawId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmacion({ tipo: 'eliminar', rawId });
  };

  const eliminarSesion = async (rawId: number) => {
    setConfirmacion(null);
    try {
      const res = await fetch(`/api/session/${rawId}`, { method: 'DELETE' });
      if (!res.ok) {
        mostrarAviso(`No se pudo eliminar la sesión #${rawId}.`, 'error');
        return;
      }
      setRealSessions((prev) => prev.filter((s) => s.rawId !== rawId));
      setSelectedSessions((prev) => prev.filter((id) => id !== `#SES-${rawId}`));
      if (detailSession?.rawId === rawId) setDetailSession(null);
      mostrarAviso(`Sesión #${rawId} eliminada.`, 'ok', 3000);
    } catch {
      mostrarAviso('Sin conexión con el núcleo: la sesión no se eliminó.', 'error');
    }
  };

  const handleCompareSessions = async () => {
    if (selectedSessions.length < 2) {
      mostrarAviso('Marca dos sesiones en la tabla para compararlas.');
      return;
    }
    const id1 = String(selectedSessions[0]).replace(/[^0-9]/g, '');
    const id2 = String(selectedSessions[1]).replace(/[^0-9]/g, '');
    try {
      setIsComparing(true);
      const res = await fetch(`/api/sessions/compare?id1=${id1}&id2=${id2}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.session_1 && data.session_2) {
          setComparisonData(data);
          mostrarAviso(data.summary || `Comparación calculada entre #${id1} y #${id2}.`, 'ok', 6000);
        } else {
          setComparisonData(null);
          mostrarAviso(data?.detail || data?.error || 'No se pudieron comparar estas sesiones.', 'error', 6000);
        }
      } else {
        const err = await res.json().catch(() => null);
        setComparisonData(null);
        mostrarAviso(err?.detail || err?.error || 'No se pudieron comparar las sesiones seleccionadas.', 'error', 6000);
      }
    } catch {
      setComparisonData(null);
      mostrarAviso('Sin conexión con el núcleo: no se pudo comparar.', 'error', 6000);
    } finally {
      setIsComparing(false);
    }
  };

  const sessionsList = realSessions;
  const sessionsData = sessionsList.filter((s) =>
    searchQuery
      ? s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.date && s.date.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.name && s.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : true
  );

  const toggleSelect = (id: string) => {
    setSelectedSessions((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let phase = 0;

    const render = () => {
      phase += 0.02;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);

      const w = canvas.width;
      const h = canvas.height;
      const padLeft = 45 * dpr;
      const padRight = 35 * dpr;
      const padTop = 30 * dpr;
      const padBottom = 40 * dpr;
      const plotW = w - padLeft - padRight;
      const plotH = h - padTop - padBottom;

      // Dark background
      ctx.fillStyle = '#290854';
      ctx.fillRect(0, 0, w, h);

      // Horizontal lines
      [-30, -50, -70, -90].forEach((lvl) => {
        const norm = (lvl - -95) / (-30 - -95);
        const y = padTop + plotH * (1 - norm);
        ctx.strokeStyle = 'rgba(88, 51, 131, 0.3)';
        ctx.beginPath();
        ctx.moveTo(padLeft, y);
        ctx.lineTo(w - padRight, y);
        ctx.stroke();

        ctx.fillStyle = '#b8a2d4';
        ctx.font = `${7.5 * dpr}px 'JetBrains Mono', monospace`;
        ctx.textAlign = 'right';
        ctx.fillText(`${lvl} dBm`, padLeft - 6 * dpr, y + 3 * dpr);
      });

      // Noise floor
      ctx.fillStyle = '#b8a2d4';
      ctx.textAlign = 'left';
      ctx.fillText('-90 (Noise Floor)', padLeft + 6 * dpr, padTop + plotH - 6 * dpr);

      const drawComparativeCurve = (
        cxRatio: number,
        bwRatio: number,
        peakDbm: number,
        color: string,
        fillColor: string,
        isDashed = false
      ) => {
        const cx = padLeft + plotW * cxRatio;
        const bw = plotW * bwRatio;
        const norm = (peakDbm - -95) / (-30 - -95);
        const peakY = padTop + plotH * (1 - norm);
        const baseY = padTop + plotH;

        ctx.beginPath();
        if (isDashed) ctx.setLineDash([4 * dpr, 4 * dpr]);
        else ctx.setLineDash([]);

        const steps = 30;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const x = cx - bw / 2 + bw * t;
          const bell = Math.sin(t * Math.PI);
          const y = baseY - (baseY - peakY) * Math.pow(bell, 1.4);
          if (i === 0) ctx.moveTo(x, baseY);
          else ctx.lineTo(x, y);
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = 2 * dpr;
        ctx.stroke();

        ctx.lineTo(cx + bw / 2, baseY);
        ctx.lineTo(cx - bw / 2, baseY);
        ctx.closePath();
        ctx.fillStyle = fillColor;
        ctx.fill();
        ctx.setLineDash([]);
      };

      const currentBand = bandFilterRef.current;
      const onlyCongested = congestionOnlyRef.current;

      const twoFourTicks = [
        { ch: 'Ch 1', f: '2412M', num: 1, r: 0.16 },
        { ch: 'Ch 2', num: 2, r: 0.22 },
        { ch: 'Ch 3', num: 3, r: 0.28 },
        { ch: 'Ch 4', num: 4, r: 0.34 },
        { ch: 'Ch 5', num: 5, r: 0.40 },
        { ch: 'Ch 6', f: '2437M', num: 6, r: 0.48 },
        { ch: 'Ch 7', num: 7, r: 0.54 },
        { ch: 'Ch 8', num: 8, r: 0.60 },
        { ch: 'Ch 9', num: 9, r: 0.66 },
        { ch: 'Ch 10', num: 10, r: 0.72 },
        { ch: 'Ch 11', f: '2462M', num: 11, r: 0.80 },
        { ch: 'Ch 12', num: 12, r: 0.86 },
        { ch: 'Ch 13', num: 13, r: 0.92 },
      ];

      const fiveGTicks = [
        { ch: 'Ch 36', f: '5180M', num: 36, r: 0.10 },
        { ch: 'Ch 40', num: 40, r: 0.18 },
        { ch: 'Ch 44', num: 44, r: 0.26 },
        { ch: 'Ch 48', f: '5240M', num: 48, r: 0.34 },
        { ch: 'Ch 52', num: 52, r: 0.42 },
        { ch: 'Ch 100', f: '5500M', num: 100, r: 0.54 },
        { ch: 'Ch 116', num: 116, r: 0.62 },
        { ch: 'Ch 132', num: 132, r: 0.70 },
        { ch: 'Ch 149', f: '5745M', num: 149, r: 0.78 },
        { ch: 'Ch 157', num: 157, r: 0.86 },
        { ch: 'Ch 165', f: '5825M', num: 165, r: 0.94 },
      ];

      const activeTicks = currentBand === '5ghz' ? fiveGTicks : twoFourTicks;

      // Dynamic real comparative curves from SQLite telemetry
      const comp = comparisonDataRef.current;
      let deltas = comp?.deltas || [];

      if (currentBand === '2.4ghz') {
        deltas = deltas.filter((d: any) => d.channel <= 14);
      } else if (currentBand === '5ghz') {
        deltas = deltas.filter((d: any) => d.channel > 14);
      }
      if (onlyCongested) {
        deltas = deltas.filter((d: any) => (d.ap_count_1 > 1 || d.ap_count_2 > 1 || Math.abs(d.delta_rssi) >= 1.0));
      }

      if (currentBand === '6ghz') {
        ctx.fillStyle = '#b8a2d4';
        ctx.font = `${9 * dpr}px 'JetBrains Mono', monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(
          'BANDA 6 GHz (Wi-Fi 6E / Wi-Fi 7): Requiere transceptor compatible en rango 5.925 - 7.125 GHz',
          padLeft + plotW / 2,
          padTop + plotH / 2
        );
      } else if (comp && comp.session_1 && deltas.length > 0) {
        deltas.forEach((d: any) => {
          let cxRatio = 0.5;
          if (currentBand === '5ghz') {
            const match = fiveGTicks.find((t) => t.num === d.channel);
            cxRatio = match ? match.r : 0.5;
          } else {
            const match = twoFourTicks.find((t) => t.num === d.channel);
            cxRatio = match ? match.r : (d.channel <= 14 ? 0.16 + ((d.channel - 1) / 12) * 0.76 : 0.5);
          }

          // Sesión A: curva morada continua
          if (d.ap_count_1 > 0) {
            drawComparativeCurve(cxRatio, 0.16, d.max_rssi_1, '#865db1', 'rgba(134, 93, 177, 0.25)');
          }
          // Sesión B: línea discontinua clara para distinguirla de la sesión A sin agregar otro color
          if (d.ap_count_2 > 0) {
            drawComparativeCurve(cxRatio, 0.16, d.max_rssi_2, '#e4d7f5', 'rgba(228, 215, 245, 0.10)', true);
          }
        });

        // Real Delta Marker
        const maxCh = comp.max_delta_channel;
        const maxDelta = comp.max_delta_rssi;
        const channelMatchesBand = currentBand === 'all' || (currentBand === '2.4ghz' ? maxCh <= 14 : maxCh > 14);
        if (maxCh && Math.abs(maxDelta) > 0.1 && channelMatchesBand) {
          let cxRatio = 0.5;
          if (currentBand === '5ghz') {
            const match = fiveGTicks.find((t) => t.num === maxCh);
            cxRatio = match ? match.r : 0.5;
          } else {
            const match = twoFourTicks.find((t) => t.num === maxCh);
            cxRatio = match ? match.r : (maxCh <= 14 ? 0.16 + ((maxCh - 1) / 12) * 0.76 : 0.5);
          }
          const mx = padLeft + plotW * cxRatio;
          const targetDbm = Math.max(-85, Math.min(-35, -55 + maxDelta));
          const my = padTop + plotH * (1 - (targetDbm - -95) / 65);

          ctx.fillStyle = '#1f0640';
          ctx.strokeStyle = maxDelta <= 0 ? '#34d399' : '#f87171';
          ctx.lineWidth = 1.2 * dpr;
          ctx.beginPath();
          ctx.roundRect(mx - 85 * dpr, my - 34 * dpr, 170 * dpr, 28 * dpr, 4 * dpr);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = maxDelta <= 0 ? '#34d399' : '#f87171';
          ctx.font = `bold ${7.5 * dpr}px 'JetBrains Mono', monospace`;
          ctx.textAlign = 'center';
          ctx.fillText(`DELTA: ${maxDelta > 0 ? '+' : ''}${maxDelta} dBm (Ch ${maxCh})`, mx, my - 20 * dpr);
          ctx.fillStyle = '#b8a2d4';
          ctx.font = `${6.8 * dpr}px 'JetBrains Mono', monospace`;
          ctx.fillText(`Variación espectral entre sesiones`, mx, my - 10 * dpr);
        }
      } else {
        // Clean prompt without fake curves
        ctx.fillStyle = '#b8a2d4';
        ctx.font = `${8.5 * dpr}px 'JetBrains Mono', monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(
          'SELECCIONA 2 AUDITORÍAS EN LA TABLA Y PULSA "COMPARAR" PARA CONTRASTAR EL ESPECTRO REAL',
          padLeft + plotW / 2,
          padTop + plotH / 2
        );
      }

      // Channel Frequency ticks
      if (currentBand !== '6ghz') {
        activeTicks.forEach((c) => {
          const x = padLeft + plotW * c.r;
          ctx.fillStyle = c.f ? '#ab85d9' : '#b8a2d4';
          ctx.font = `${7 * dpr}px 'JetBrains Mono', monospace`;
          ctx.textAlign = 'center';
          ctx.fillText(c.ch, x, h - padBottom + 14 * dpr);
          if (c.f) {
            ctx.fillStyle = '#b8a2d4';
            ctx.font = `${6 * dpr}px 'JetBrains Mono', monospace`;
            ctx.fillText(c.f, x, h - padBottom + 24 * dpr);
          }
        });
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="history-view-container">
      {/* 1. TOP FILTER STRIP */}
      <div className="hist-filter-strip">
        <div className="hist-filter-left">
          <div className="hist-input-box">
            <i className="bi bi-calendar3"></i>
            <span>{new Date().toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })} (Hoy)</span>
          </div>

          <div className="hist-band-group">
            <span className="hist-lbl">BANDA:</span>
            <button
              className={`hist-btn ${bandFilter === '2.4ghz' ? 'active' : ''}`}
              onClick={() => setBandFilter('2.4ghz')}
            >
              2.4 GHz
            </button>
            <button
              className={`hist-btn ${bandFilter === '5ghz' ? 'active' : ''}`}
              onClick={() => setBandFilter('5ghz')}
            >
              5.0 GHz
            </button>
            <button
              className={`hist-btn ${bandFilter === 'all' ? 'active' : ''}`}
              onClick={() => setBandFilter('all')}
            >
              Dual Band (Todas)
            </button>
          </div>

          <div
            className={`hist-congestion-box ${congestionOnly ? 'active' : ''}`}
            onClick={() => setCongestionOnly(!congestionOnly)}
            style={{
              cursor: 'pointer',
              border: congestionOnly ? '1px solid #fbbf24' : undefined,
              backgroundColor: congestionOnly ? 'rgba(251, 191, 36, 0.15)' : undefined,
              color: congestionOnly ? '#fbbf24' : undefined,
            }}
            title="Alternar entre todos los canales o solo los que presentan congestión o variación"
          >
            <i className={`bi ${congestionOnly ? 'bi-funnel-fill' : 'bi-funnel'}`}></i>
            <span>{congestionOnly ? 'CONGESTIÓN: Solo Canales Afectados' : 'CONGESTIÓN: Todos los Canales'}</span>
          </div>

          <button
            className="hist-clear-btn"
            onClick={() => {
              setBandFilter('all');
              setCongestionOnly(false);
            }}
          >
            <i className="bi bi-arrow-counterclockwise"></i> Limpiar filtros
          </button>
        </div>

        <div className="hist-filter-right">
          <span className="hist-marked-tag">
            {selectedSessions.length} SESIONES MARCADAS
          </span>
          <button className="btn-hist-compare" onClick={handleCompareSessions} disabled={isComparing}>
            <i className={`bi ${isComparing ? 'bi-arrow-repeat' : 'bi-plus-lg'}`}></i>
            <span>{isComparing ? 'Calculando diferencial...' : 'Comparar 2 Sesiones Seleccionadas'}</span>
          </button>
        </div>
      </div>

      {compareMessage && (
        <div className={`aviso aviso-${tipoAviso}`} role="status">
          <i className={`bi ${tipoAviso === 'ok' ? 'bi-check-circle-fill' : tipoAviso === 'error' ? 'bi-x-circle-fill' : 'bi-info-circle-fill'}`}></i>
          <span>{compareMessage}</span>
        </div>
      )}

      {/* 2. MAIN SPECTRAL COMPARISON SPLIT (70% / 30%) */}
      <div className="hist-main-split">
        {/* Left: Overlaid Spectrum Chart */}
        <div className="hist-chart-card">
          <div className="hist-chart-header">
            <div className="hist-chart-title">
              <span className="hist-dot"></span>
              <span>
                Espectro Superpuesto: Ocupación por Canal Diferencial
              </span>
              <span className="hist-delta-tag">DELTA A vs B</span>
            </div>

            <div className="hist-chart-legends">
              <span className="hist-session-pill pill-purple">
                ■ Sesión A ({selectedSessions[0] || 'Base'})
              </span>
              <span className="hist-session-pill pill-cyan">
                ■ Sesión B ({selectedSessions[1] || 'Comparativa'})
              </span>
            </div>
          </div>

          <div className="hist-canvas-wrap">
            <canvas ref={canvasRef} />
          </div>

          <div className="hist-verdict-banner">
            <div className="verdict-txt">
              <i className="bi bi-check-circle-fill" style={{ color: 'inherit' }}></i>
              <span>
                <strong>DICTAMEN TÉCNICO COMPARATIVO:</strong> Análisis diferencial de espectro calculado entre las sesiones seleccionadas.
              </span>
            </div>
            <div className="verdict-actions">
              <button className="btn-verdict-csv" onClick={handleExportDiffCsv}>
                Exportar CSV Diff
              </button>
              <button className="btn-verdict-pdf" onClick={onGeneratePdf}>
                Generar PDF
              </button>
            </div>
          </div>
        </div>

        {/* Right: Resumen Delta (A vs B) */}
        <div className="hist-delta-summary-card">
          <div className="delta-card-header">
            <span className="delta-title">RESUMEN DELTA (A vs B)</span>
            <span className="delta-status-badge">
              {comparisonData?.session_1 ? 'TELEMETRÍA REAL' : 'MODO COMPARATIVO'}
            </span>
          </div>

          <div className="delta-metrics-list">
            {/* Metric 1 */}
            <div className="delta-metric-box">
              <div className="d-metric-top">
                <span className="d-lbl">AUDITORÍAS COMPARADAS</span>
                <span className="d-gain" style={{ color: '#ab85d9' }}>
                  {comparisonData?.session_1?.id && comparisonData?.session_2?.id
                    ? `#SES-${comparisonData.session_1.id} ➔ #SES-${comparisonData.session_2.id}`
                    : selectedSessions.length >= 2
                    ? `${selectedSessions[0]} ➔ ${selectedSessions[1]}`
                    : 'Seleccionar 2 Sesiones'}
                </span>
              </div>
              <div className="d-val-row">
                <span className="d-prev">{comparisonData?.session_1?.name || (selectedSessions[0] ? `Sesión ${selectedSessions[0]}` : 'Sesión A')}</span>
                <i className="bi bi-arrow-right"></i>
                <span className="d-cur">{comparisonData?.session_2?.name || (selectedSessions[1] ? `Sesión ${selectedSessions[1]}` : 'Sesión B')}</span>
              </div>
              <div className="d-bar-track">
                <div className="d-bar-fill" style={{ width: comparisonData?.session_1 ? '100%' : '50%' }}></div>
              </div>
            </div>

            {/* Metric 2 */}
            <div className="delta-metric-box">
              <div className="d-metric-top">
                <span className="d-lbl">MAYOR VARIACIÓN (CANAL {comparisonData?.max_delta_channel || 6})</span>
                <span className="d-gain" style={{ color: (comparisonData?.max_delta_rssi || 0) <= 0 ? '#34d399' : '#f87171' }}>
                  {comparisonData ? `${(comparisonData.max_delta_rssi || 0) > 0 ? '+' : ''}${comparisonData.max_delta_rssi || 0} dBm` : '-14 dBm'}
                </span>
              </div>
              <p className="d-desc">
                {comparisonData
                  ? `Canal ${comparisonData.max_delta_channel || 6}: variación de potencia registrada entre las dos capturas de espectro.`
                  : 'Diferencial de potencia co-canal calculado automáticamente desde SQLite.'}
              </p>
              <span className="d-sub-info">
                • {comparisonData?.summary || 'Marca 2 casillas en la tabla y pulsa "Comparar"'}
              </span>
            </div>

            {/* Metric 3 */}
            <div className="delta-metric-box">
              <div className="d-metric-top">
                <span className="d-lbl">CANALES ANALIZADOS</span>
                <span className="d-gain" style={{ color: '#ab85d9' }}>
                  {comparisonData?.deltas ? `${comparisonData.deltas.length} Canales` : '2.4G & 5G'}
                </span>
              </div>
              <div className="d-val-row">
                <span className="d-prev">{comparisonData?.session_1?.engine_type?.toUpperCase() || '—'}</span>
                <i className="bi bi-arrow-right"></i>
                <span className="d-cur">{comparisonData?.session_2?.engine_type?.toUpperCase() || '—'}</span>
              </div>
              <span className="d-sub-info">Transceptores de hardware sincronizados</span>
            </div>

            {/* Metric 4 */}
            <div className="delta-metric-box">
              <div className="d-metric-top">
                <span className="d-lbl">ESTADO DE MITIGACIÓN</span>
                <span className="d-gain" style={{ color: '#34d399' }}>
                  {comparisonData?.session_1 ? 'Cálculo Matemático OK' : 'Listo'}
                </span>
              </div>
              <p className="d-desc" style={{ fontSize: '0.72rem', color: 'var(--color6)' }}>
                {comparisonData?.summary || 'Selecciona al menos dos sesiones para contrastar la densidad espectral.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. BOTTOM SESSIONS TABLE */}
      <div className="hist-table-card">
        <div className="hist-table-header">
          <div className="hist-table-title">
            <i className="bi bi-clock-history" style={{ color: 'inherit' }}></i>
            <span>Registro de Sesiones Almacenadas en Disco</span>
          </div>
          <div className="hist-table-actions">
            <button
              onClick={() => setConfirmacion({ tipo: 'purgar' })}
              className="btn-ses-view"
              style={{
                backgroundColor: 'rgba(251, 191, 36, 0.15)',
                borderColor: '#fbbf24',
                color: '#fbbf24',
                padding: '4px 10px',
                fontSize: '0.68rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer',
              }}
              title="Purgar sesiones antiguas de simulación o pruebas automatizadas y conservar únicamente auditorías reales"
            >
              <i className="bi bi-shield-x"></i>
              <span>Purgar Auditorías de Simulación</span>
            </button>

            <div className="hist-search-box">
              <i className="bi bi-search"></i>
              <input
                type="text"
                placeholder="Filtrar por ID de Sesión..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <span className="hist-showing-txt">Mostrando {sessionsData.length} auditorías en base de datos</span>
          </div>
        </div>

        <div className="hist-table-scroll">
          <table className="hist-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>SEL</th>
                <th>ID SESIÓN</th>
                <th>NOMBRE AUDITORÍA</th>
                <th>UBICACIÓN</th>
                <th>MOTOR / HARDWARE</th>
                <th>MUESTRAS</th>
                <th>BSSIDs</th>
                <th>FECHA Y HORA</th>
                <th>ESTADO</th>
                <th>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {sessionsData.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    No se encontraron auditorías registradas en SQLite. Utiliza el botón "+ Nueva Auditoría" para iniciar una.
                  </td>
                </tr>
              ) : (
                sessionsData.map((ses) => {
                  const isSelected = selectedSessions.includes(ses.id);
                  return (
                    <tr key={ses.id} className={isSelected ? 'selected-row' : ''}>
                      <td>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(ses.id)}
                        />
                      </td>
                      <td className="cell-ses-id">{ses.id}</td>
                      <td className="cell-ses-id" style={{ color: 'var(--color6)', fontWeight: 700 }}>{ses.name}</td>
                      <td className="cell-ses-chan">{ses.location || 'Sitio'}</td>
                      <td>
                        <span
                          style={{
                            fontSize: '0.63rem',
                            fontFamily: 'var(--font-mono)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: ses.engineType === 'windows' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(171, 133, 217, 0.15)',
                            border: `1px solid ${ses.engineType === 'windows' ? '#34d399' : '#ab85d9'}`,
                            color: ses.engineType === 'windows' ? '#34d399' : '#d5c4ec',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {ses.engineLabel}
                        </span>
                      </td>
                      <td className="cell-ses-col cell-mono" style={{ color: '#ab85d9', fontWeight: 600 }}>
                        {ses.samplesCount.toLocaleString()} tramas
                      </td>
                      <td className="cell-ses-col cell-mono" style={{ color: 'var(--color6)' }}>
                        {ses.uniqueAps} APs
                      </td>
                      <td className="cell-ses-date">{ses.date}</td>
                      <td>
                        <span
                          className="badge-ses-status"
                          style={{
                            borderColor: ses.color,
                            color: ses.color,
                            backgroundColor: ses.color + '15',
                          }}
                        >
                          {ses.status}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <button className="btn-ses-view" onClick={() => handleOpenDetail(ses)}>
                            Ver Muestras
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExportCsv(ses.rawId);
                            }}
                            className="btn-ses-view"
                            style={{ backgroundColor: 'rgba(171, 133, 217, 0.15)', borderColor: '#ab85d9', color: '#ab85d9', padding: '4px 7px' }}
                            title="Descargar muestras CSV de esta sesión"
                          >
                            <i className="bi bi-file-earmark-spreadsheet"></i>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExportSessionPdf(ses.rawId);
                            }}
                            className="btn-ses-view"
                            style={{ backgroundColor: 'rgba(52, 211, 153, 0.15)', borderColor: '#34d399', color: '#34d399', padding: '4px 7px' }}
                            title="Generar dictamen técnico PDF de esta sesión"
                          >
                            <i className="bi bi-file-earmark-pdf"></i>
                          </button>
                          <button
                            onClick={(e) => handleDeleteSession(ses.rawId, e)}
                            className="btn-ses-view"
                            style={{ backgroundColor: 'rgba(248, 113, 113, 0.15)', borderColor: '#f87171', color: '#f87171', padding: '4px 7px' }}
                            title="Eliminar permanentemente esta sesión de SQLite"
                          >
                            <i className="bi bi-trash3"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL MODAL */}
      {detailSession && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          onClick={() => setDetailSession(null)}
        >
          <div
            style={{
              backgroundColor: '#1f0640',
              border: '1px solid #583383',
              borderRadius: '10px',
              width: '100%',
              maxWidth: '850px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderBottom: '1px solid #401d6b',
                backgroundColor: '#1f0640',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="bi bi-hdd-network" style={{ color: '#ab85d9', fontSize: '1.2rem' }}></i>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#fff' }}>
                    Detalle de Sesión: {detailSession.id}
                  </h3>
                  <span style={{ fontSize: '0.72rem', color: '#b8a2d4' }}>
                    {detailSession.date} • {detailSession.engineLabel} • {detailSession.samplesCount.toLocaleString('es-PE')} lecturas
                  </span>
                </div>
              </div>
              <button
                onClick={() => setDetailSession(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#b8a2d4',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  padding: '4px 8px',
                }}
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                }}
              >
                <span style={{ fontSize: '0.76rem', color: '#ab85d9', fontWeight: 600 }}>
                  Muestras Capturadas en Hardware ({detailSamples.length} registros)
                </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleExportCsv(detailSession.rawId)}
                  style={{
                    backgroundColor: 'rgba(171, 133, 217, 0.2)',
                    border: '1px solid #ab85d9',
                    color: '#ab85d9',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <i className="bi bi-file-earmark-spreadsheet"></i> Descargar CSV
                </button>
                <button
                  onClick={() => handleExportSessionPdf(detailSession.rawId)}
                  style={{
                    backgroundColor: 'rgba(52, 211, 153, 0.2)',
                    border: '1px solid #34d399',
                    color: '#34d399',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <i className="bi bi-file-earmark-pdf"></i> Informe PDF
                </button>
              </div>
            </div>

              {isLoadingSamples ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#b8a2d4', fontSize: '0.85rem' }}>
                  <i className="bi bi-arrow-repeat" style={{ display: 'inline-block', marginRight: '8px' }}></i>
                  Cargando muestras de la base de datos...
                </div>
              ) : detailSamples.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#b8a2d4', fontSize: '0.8rem', backgroundColor: '#1f0640', borderRadius: '6px' }}>
                  No se registran muestras individuales para esta captura o fue una sesión temporal.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #401d6b', textAlign: 'left', color: '#b8a2d4' }}>
                      <th style={{ padding: '6px 8px' }}>SSID</th>
                      <th style={{ padding: '6px 8px' }}>BSSID (MAC)</th>
                      <th style={{ padding: '6px 8px' }}>CANAL</th>
                      <th style={{ padding: '6px 8px' }}>POTENCIA (RSSI)</th>
                      <th style={{ padding: '6px 8px' }}>CALIDAD</th>
                      <th style={{ padding: '6px 8px' }}>SEGURIDAD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailSamples.slice(0, 50).map((sample: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(88, 51, 131, 0.2)' }}>
                        <td style={{ padding: '6px 8px', color: '#fff', fontWeight: 600 }}>{sample.ssid || '<Oculto>'}</td>
                        <td style={{ padding: '6px 8px', color: '#b8a2d4', fontFamily: 'monospace' }}>{sample.bssid}</td>
                        <td style={{ padding: '6px 8px', color: '#ab85d9' }}>Ch {sample.channel} ({sample.band || '—'})</td>
                        <td style={{ padding: '6px 8px', color: sample.rssi >= -65 ? '#34d399' : sample.rssi >= -80 ? '#fbbf24' : '#f87171', fontWeight: 700 }}>
                          {sample.rssi} dBm
                        </td>
                        <td style={{ padding: '6px 8px', color: '#ffffff' }}>{sample.quality || sample.link_quality || Math.min(100, Math.max(0, 2 * (sample.rssi + 100)))}%</td>
                        <td style={{ padding: '6px 8px', color: '#b8a2d4' }}>{sample.security || sample.auth || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid #401d6b',
                display: 'flex',
                justifyContent: 'flex-end',
                backgroundColor: '#1f0640',
              }}
            >
              <button
                onClick={() => setDetailSession(null)}
                style={{
                  backgroundColor: '#401d6b',
                  border: '1px solid #583383',
                  color: '#ffffff',
                  padding: '6px 14px',
                  borderRadius: '4px',
                  fontSize: '0.74rem',
                  cursor: 'pointer',
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        abierto={confirmacion !== null}
        titulo={confirmacion?.tipo === 'purgar' ? 'Eliminar sesiones de prueba' : 'Eliminar sesión'}
        mensaje={
          confirmacion?.tipo === 'eliminar'
            ? `Se borrará la sesión #${confirmacion.rawId} y todas sus lecturas. Esta acción no se puede deshacer.`
            : 'Se borrarán todas las sesiones de simulación y de prueba. Las auditorías reales capturadas con hardware se conservan.'
        }
        textoConfirmar="Eliminar"
        peligroso
        onConfirmar={() => {
          if (confirmacion?.tipo === 'eliminar') eliminarSesion(confirmacion.rawId);
          else handlePurgeSimulated();
        }}
        onCancelar={() => setConfirmacion(null)}
      />
    </div>
  );
};
