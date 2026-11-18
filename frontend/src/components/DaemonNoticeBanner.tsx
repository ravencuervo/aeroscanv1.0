import React from 'react';
import './DaemonNoticeBanner.css';

interface DaemonNoticeBannerProps {
  isLive: boolean;
  engineType: string;
  isCapturing?: boolean;
  onToggleCapture?: () => void;
}

export const DaemonNoticeBanner: React.FC<DaemonNoticeBannerProps> = ({
  isLive,
  engineType,
  isCapturing = true,
  onToggleCapture,
}) => {
  return (
    <div className="daemon-notice-strip">
      <div className="daemon-notice-left">
        <i className={`bi ${isCapturing ? 'bi-broadcast-pin' : 'bi-pause-circle-fill'}`} style={{ color: isCapturing ? '#10b981' : '#f59e0b' }}></i>
        <span>
          {!isLive
            ? 'Inicializando enlace con los adaptadores físicos de radio. Sincronizando con el servicio en puerto 8765...'
            : isCapturing
            ? `Captura de hardware en tiempo real activa (${engineType.toUpperCase()}). Transmitiendo telemetría continua por WebSockets.`
            : `Captura de radiofrecuencia en espera (modo standby). Presiona "INICIAR CAPTURA" para activar el transceptor ${engineType.toUpperCase()}.`}
        </span>
      </div>

      <div className="daemon-notice-right">
        <span
          className="daemon-badge"
          style={{
            borderColor: isCapturing ? '#10b981' : '#f59e0b',
            color: isCapturing ? '#6ee7b7' : '#fde68a',
          }}
        >
          DAEMON: {isLive ? (isCapturing ? 'ACTIVO' : 'EN ESPERA') : 'OFFLINE'}
        </span>
        {onToggleCapture && (
          <button
            className="daemon-action-btn"
            onClick={onToggleCapture}
            style={{
              backgroundColor: isCapturing ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
              borderColor: isCapturing ? '#ef4444' : '#10b981',
              color: isCapturing ? '#fca5a5' : '#6ee7b7',
              cursor: 'pointer',
            }}
          >
            {isCapturing ? 'DETENER CAPTURA' : 'INICIAR CAPTURA'}
          </button>
        )}
      </div>
    </div>
  );
};
