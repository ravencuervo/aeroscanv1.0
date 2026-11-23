import React, { useState } from 'react';
import type { ScannedAP } from '../types/spectrum';
import './ChannelSweepStrip.css';

interface ChannelSweepStripProps {
  accessPoints: ScannedAP[];
  isCapturing?: boolean;
}

interface ChannelDef {
  ch: number;
  freq: string;
  isDfs?: boolean;
  defaultStatus: 'clear' | 'moderate' | 'high';
}

const CHANNELS_CONFIG: ChannelDef[] = [
  { ch: 1, freq: '2.412G', defaultStatus: 'moderate' },
  { ch: 6, freq: '2.437G', defaultStatus: 'high' },
  { ch: 11, freq: '2.462G', defaultStatus: 'moderate' },
  { ch: 36, freq: '5.180G', defaultStatus: 'clear' },
  { ch: 40, freq: '5.200G', defaultStatus: 'clear' },
  { ch: 44, freq: '5.220G', defaultStatus: 'clear' },
  { ch: 48, freq: '5.240G', defaultStatus: 'clear' },
  { ch: 52, freq: 'DFS', isDfs: true, defaultStatus: 'moderate' },
  { ch: 100, freq: 'DFS', isDfs: true, defaultStatus: 'clear' },
  { ch: 149, freq: '5.745G', defaultStatus: 'moderate' },
  { ch: 157, freq: '5.785G', defaultStatus: 'clear' },
  { ch: 165, freq: '5.825G', defaultStatus: 'clear' },
];

export const ChannelSweepStrip: React.FC<ChannelSweepStripProps> = ({ accessPoints, isCapturing = true }) => {
  const [selectedCh, setSelectedCh] = useState<number | null>(null);

  const getChannelColor = (status: 'clear' | 'moderate' | 'high') => {
    switch (status) {
      case 'clear':
        return '#10b981'; // Green
      case 'moderate':
        return '#f59e0b'; // Amber
      case 'high':
        return '#ef4444'; // Red
    }
  };

  const selectedAps = selectedCh !== null ? accessPoints.filter((a) => a.channel === selectedCh) : [];

  return (
    <div className="channel-sweep-panel">
      {/* Header */}
      <div className="channel-sweep-header">
        <div className="channel-sweep-title">
          <i className="bi bi-disc"></i>
          <span>
            Monitor de Canales en Barrido Rotativo (Banda 2.4 GHz & 5 GHz UNII-1/2/3)
          </span>
        </div>

        <div
          className="sweep-active-badge"
          style={{
            borderColor: isCapturing ? 'var(--color5)' : '#f59e0b',
            color: isCapturing ? 'var(--color6)' : '#fde68a',
            backgroundColor: isCapturing ? 'var(--color1)' : 'rgba(245, 158, 11, 0.15)',
          }}
        >
          <span>
            {isCapturing ? 'BARRIDO ACTIVO: 2.4 GHz (CH 1-13) & 5 GHz (CH 36-165)' : 'BARRIDO EN ESPERA (DETENIDO)'}
          </span>
        </div>

        <div className="sweep-legend-group">
          <div className="sweep-legend-item">
            <span
              className="sweep-legend-dot"
              style={{ backgroundColor: '#10b981' }}
            ></span>
            <span>CANAL DESPEJADO</span>
          </div>

          <div className="sweep-legend-item">
            <span
              className="sweep-legend-dot"
              style={{ backgroundColor: '#f59e0b' }}
            ></span>
            <span>CONGESTIÓN MODERADA</span>
          </div>

          <div className="sweep-legend-item">
            <span
              className="sweep-legend-dot"
              style={{ backgroundColor: '#ef4444' }}
            ></span>
            <span>ALTA INTERFERENCIA</span>
          </div>
        </div>
      </div>

      {/* Grid of channels */}
      <div className="channel-cells-container">
        {CHANNELS_CONFIG.map((item) => {
          const matchingAps = accessPoints.filter((ap) => ap.channel === item.ch);
          const apCount = matchingAps.length;
          const bestRssi = matchingAps.length > 0 ? Math.max(...matchingAps.map((a) => a.rssi)) : null;

          const strongestAp = accessPoints.length > 0
            ? accessPoints.reduce((prev, curr) => (curr.rssi > prev.rssi ? curr : prev), accessPoints[0])
            : null;
          const isStrongest = strongestAp ? strongestAp.channel === item.ch : false;
          const isSelected = selectedCh === item.ch;

          let status: 'clear' | 'moderate' | 'high' = 'clear';
          if (apCount >= 4) status = 'high';
          else if (apCount >= 2) status = 'moderate';
          else status = 'clear';

          return (
            <div
              key={item.ch}
              className={`channel-cell ${isStrongest ? 'active-channel' : ''}`}
              style={{
                cursor: 'pointer',
                outline: isSelected ? '2px solid #38bdf8' : 'none',
                backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.12)' : undefined,
              }}
              onClick={() => setSelectedCh(isSelected ? null : item.ch)}
              title={`Haz clic para ver los ${apCount} APs detectados en Canal ${item.ch}`}
            >
              {isStrongest && <span className="actual-pill-tag">MÁS POTENTE</span>}

              <div className="channel-cell-top">
                <span className="cell-ch-num">CH {item.ch}</span>
                <span className="cell-ch-freq">{item.freq}</span>
              </div>

              {apCount > 0 ? (
                <div className="cell-stats-center">
                  <span className="cell-dbm-txt">{bestRssi} dBm</span>
                  <span className="cell-ap-count">{apCount} {apCount === 1 ? 'AP' : 'APs'}</span>
                </div>
              ) : (
                <div className="cell-stats-center">
                  <span className="cell-ap-count" style={{ color: 'var(--text-dim)', fontSize: '0.65rem' }}>
                    0 APs (Libre)
                  </span>
                </div>
              )}

              <div
                className="channel-congestion-bar"
                style={{ backgroundColor: getChannelColor(status) }}
              ></div>
            </div>
          );
        })}
      </div>

      {/* Selected Channel AP Details Popover */}
      {selectedCh !== null && (
        <div
          style={{
            marginTop: '10px',
            backgroundColor: 'var(--color1)',
            border: '1px solid #38bdf8',
            borderRadius: '6px',
            padding: '10px 14px',
            fontSize: '0.74rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontWeight: 700, color: '#38bdf8' }}>
              <i className="bi bi-broadcast" style={{ marginRight: '6px' }}></i>
              Canal Ch {selectedCh} — {selectedAps.length} {selectedAps.length === 1 ? 'Red Detectada' : 'Redes Detectadas en este canal'}
            </span>
            <button
              onClick={() => setSelectedCh(null)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              ✕ Cerrar
            </button>
          </div>
          {selectedAps.length === 0 ? (
            <span style={{ color: 'var(--text-muted)' }}>Canal libre. No hay puntos de acceso transmitiendo en esta frecuencia.</span>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {selectedAps.map((ap) => (
                <div
                  key={ap.bssid}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    border: '1px solid rgba(88, 51, 131, 0.4)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  <strong style={{ color: '#fff' }}>{ap.ssid || '<Oculta>'}</strong>
                  <span style={{ color: '#9c80bd', fontFamily: 'monospace', fontSize: '0.68rem' }}>{ap.bssid}</span>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                    <span style={{ color: ap.rssi >= -65 ? '#10b981' : ap.rssi >= -80 ? '#f59e0b' : '#ef4444', fontWeight: 700 }}>
                      {ap.rssi} dBm
                    </span>
                    <span style={{ color: 'var(--text-dim)' }}>{ap.security}</span>
                    <span style={{ color: '#38bdf8' }}>{ap.vendor}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
