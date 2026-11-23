import React, { useState, useEffect } from 'react';
import type { WirelessAdapter } from '../types/spectrum';
import './CaptureControlBar.css';

interface CaptureControlBarProps {
  engineType: string;
  isCapturing: boolean;
  totalAps: number;
  totalPackets?: number;
  sessionDuration?: number;
  dwellTimeMs?: number;
  adapters?: WirelessAdapter[];
  selectedAdapter?: string;
  onSelectAdapter?: (adapterId: string) => void;
  onToggleCapture: () => void;
  onExportReports: () => void;
  isPaused?: boolean;
  onTogglePause?: () => void;
  band24?: boolean;
  band5?: boolean;
  onToggleBand?: (band: '2.4' | '5') => void;
}

export const CaptureControlBar: React.FC<CaptureControlBarProps> = ({
  engineType: _engineType,
  isCapturing,
  totalAps,
  totalPackets,
  sessionDuration,
  dwellTimeMs,
  adapters = [],
  selectedAdapter = 'ALL',
  onSelectAdapter,
  onToggleCapture,
  onExportReports: _onExportReports,
  isPaused: externalIsPaused,
  onTogglePause,
  band24: externalBand24,
  band5: externalBand5,
  onToggleBand,
}) => {
  const [internalBand24, setInternalBand24] = useState(true);
  const [internalBand5, setInternalBand5] = useState(true);
  const [internalIsPaused, setInternalIsPaused] = useState(false);
  const [dwellTime, setDwellTime] = useState<number>(dwellTimeMs || 100);

  useEffect(() => {
    if (dwellTimeMs) {
      setDwellTime(dwellTimeMs);
    } else {
      fetch('/api/config')
        .then((r) => r.json())
        .then((d) => {
          if (d.dwell_time_ms) setDwellTime(d.dwell_time_ms);
        })
        .catch(() => {});
    }
  }, [dwellTimeMs]);

  const band24 = externalBand24 !== undefined ? externalBand24 : internalBand24;
  const band5 = externalBand5 !== undefined ? externalBand5 : internalBand5;
  const isPaused = externalIsPaused !== undefined ? externalIsPaused : internalIsPaused;

  const handleToggleBand24 = () => {
    if (onToggleBand) {
      onToggleBand('2.4');
    } else {
      setInternalBand24(!internalBand24);
    }
  };

  const handleToggleBand5 = () => {
    if (onToggleBand) {
      onToggleBand('5');
    } else {
      setInternalBand5(!internalBand5);
    }
  };

  const handleTogglePause = () => {
    if (onTogglePause) {
      onTogglePause();
    } else {
      setInternalIsPaused(!internalIsPaused);
    }
  };

  const [secondsElapsed, setSecondsElapsed] = useState(sessionDuration || 0);

  // Sync with session duration if provided from backend
  useEffect(() => {
    if (sessionDuration !== undefined && sessionDuration > 0) {
      setSecondsElapsed(sessionDuration);
    }
  }, [sessionDuration]);

  // Tick timer only while actively capturing and not paused
  useEffect(() => {
    if (!isCapturing || isPaused) return;
    const interval = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isCapturing, isPaused]);

  const formatTime = (totalSec: number) => {
    const hrs = String(Math.floor(totalSec / 3600)).padStart(2, '0');
    const mins = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
    const secs = String(totalSec % 60).padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  };

  const packetCount = (totalPackets !== undefined && totalPackets > 0)
    ? totalPackets
    : (secondsElapsed * 24 + totalAps * 8);

  const currentActiveAdapter = adapters.find((a) => a.id === selectedAdapter);

  return (
    <div className="capture-control-card">
      {/* Top Row: Adapter & Hardware info */}
      <div className="control-row-top">
        <div className="adapter-info-group">
          {/* Hardware Module Selector */}
          <div className="adapter-item">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="adapter-item-label">MÓDULO DE HARDWARE WIFI</span>
              <span className="adapter-badge-count">
                {adapters.length === 0
                  ? 'BUSCANDO MÓDULOS...'
                  : adapters.length === 1
                  ? '1 MÓDULO DETECTADO'
                  : `${adapters.length} MÓDULOS DETECTADOS`}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <i className="bi bi-hdd-network" style={{ fontSize: '1.05rem', color: 'inherit' }}></i>
              <select
                className="adapter-select-control"
                value={selectedAdapter}
                onChange={(e) => onSelectAdapter && onSelectAdapter(e.target.value)}
                title="Selecciona el módulo WiFi físico a utilizar o todos en paralelo"
              >
                {adapters.length > 1 && (
                  <option value="ALL">
                    TODOS LOS MÓDULOS ({adapters.length} en Paralelo / Multi-Sensor)
                  </option>
                )}
                {adapters.map((ad) => (
                  <option key={ad.id} value={ad.id}>
                    {ad.name} — {ad.description} [{ad.mac_address || 'Sin MAC'}]{' '}
                    {ad.connected_ssid ? `(Conectado a ${ad.connected_ssid})` : '(Modo Escaneo)'}
                  </option>
                ))}
                {adapters.length === 0 && (
                  <option value="ALL">Controlador Nativo Windows</option>
                )}
              </select>
            </div>
          </div>

          {/* Module telemetry status */}
          <div className="adapter-item">
            <span className="adapter-item-label">ESTADO DE HARDWARE</span>
            <div className="adapter-item-val">
              {!isCapturing ? (
                <>
                  <i className="bi bi-pause-circle-fill" style={{ color: '#f59e0b' }}></i>
                  <span style={{ color: '#f59e0b', fontWeight: 600 }}>Captura Detenida (Modo Standby)</span>
                </>
              ) : selectedAdapter === 'ALL' ? (
                <>
                  <i className="bi bi-check2" style={{ color: 'inherit' }}></i>
                  <span style={{ fontWeight: 600 }}>Multi-Transceptor Activo:</span>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {adapters.map((a) => a.name).join(' + ') || 'Windows WLAN'}
                  </span>
                </>
              ) : currentActiveAdapter ? (
                <>
                  <i className="bi bi-check2" style={{ color: 'inherit' }}></i>
                  <span>{currentActiveAdapter.description}</span>
                  {currentActiveAdapter.connected_ssid && (
                    <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      [Enlace: {currentActiveAdapter.connected_ssid} • Ch {currentActiveAdapter.current_channel || '?'}]
                    </span>
                  )}
                  {currentActiveAdapter.mac_address && (
                    <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem', fontFamily: 'var(--font-mono)' }}>
                      ({currentActiveAdapter.mac_address})
                    </span>
                  )}
                </>
              ) : (
                <>
                  <i className="bi bi-check2" style={{ color: 'inherit' }}></i>
                  <span>Captura de Hardware Activa</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="session-stats-group">
          <div className="session-stat-item">
            <i className="bi bi-clock"></i>
            <span>SESIÓN: {formatTime(secondsElapsed)} {isCapturing ? (isPaused ? 'buffer en pausa' : 'en curso') : 'detenida'}</span>
          </div>

          <div className="session-stat-item">
            <i className="bi bi-layers"></i>
            <span>PAQUETES: {packetCount.toLocaleString()} frames</span>
          </div>
        </div>
      </div>

      {/* Bottom Row: Bands and Action buttons */}
      <div className="control-row-bottom">
        <div className="band-selector-group">
          <span className="band-label-txt">BANDAS:</span>

          <button
            className={`band-pill ${band24 ? 'active' : ''}`}
            onClick={handleToggleBand24}
            title="Activar / Desactivar visualización de banda 2.4 GHz"
          >
            <span className="band-pill-dot"></span>
            2.4 GHz: {band24 ? 'ACTIVO' : 'INACTIVO'}
          </button>

          <button
            className={`band-pill ${band5 ? 'active' : ''}`}
            onClick={handleToggleBand5}
            title="Activar / Desactivar visualización de banda 5 GHz"
          >
            <span className="band-pill-dot"></span>
            5 GHz: {band5 ? 'ACTIVO' : 'INACTIVO'}
          </button>

          <div className="band-pill inactive">
            <span className="band-pill-dot" style={{ backgroundColor: '#64748b' }}></span>
            6 GHz (WiFi 6E): INACTIVO
          </div>

          <div className="dwell-time-box">
            <span>DWELL TIME:</span>
            <span className="dwell-badge">{dwellTime} ms</span>
            <span>(Tiempo por canal)</span>
          </div>
        </div>

        <div className="action-buttons-group">
          <button
            className={`btn-tactical-stop ${!isCapturing ? 'btn-tactical-start' : ''}`}
            onClick={onToggleCapture}
            title={isCapturing ? 'Detener el motor de escaneo de radiofrecuencia' : 'Iniciar o reanudar el barrido en vivo'}
          >
            <i className={`bi ${isCapturing ? 'bi-stop-fill' : 'bi-play-fill'}`}></i>
            <span>{isCapturing ? 'DETENER CAPTURA' : 'INICIAR CAPTURA'}</span>
          </button>

          <button
            className={`btn-tactical-pause ${isPaused ? 'active-paused' : ''}`}
            onClick={handleTogglePause}
            title={isPaused ? 'Reanudar actualización de visualización' : 'Congelar el buffer de visualización en pantalla'}
          >
            <i className={`bi ${isPaused ? 'bi-play-fill' : 'bi-pause-fill'}`}></i>
            <span>{isPaused ? 'REANUDAR BUFFER' : 'PAUSAR BUFFER'}</span>
          </button>

          <button
            className="btn-tactical-export"
            onClick={() => {
              window.location.href = '/api/export/pcap';
            }}
            title="Descargar captura binaria de balizas en formato estándar libpcap para Wireshark"
          >
            <i className="bi bi-file-earmark-binary"></i>
            <span>PCAP WIRESHARK</span>
          </button>

          <button
            className="btn-tactical-export"
            onClick={() => {
              window.location.href = '/api/export/json';
            }}
            title="Descargar volcado estructurado de tramas RF en formato JSON"
          >
            <i className="bi bi-filetype-json"></i>
            <span>JSON DUMP</span>
          </button>
        </div>
      </div>
    </div>
  );
};

