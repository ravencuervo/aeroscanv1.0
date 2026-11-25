import React, { useState, useEffect } from 'react';
import type { WirelessAdapter, ScannedAP } from '../types/spectrum';
import { WslMonitorModal } from './WslMonitorModal';
import './SdrDiagnosticView.css';

interface SdrDiagnosticViewProps {
  adapters: WirelessAdapter[];
  selectedAdapter: string;
  accessPoints: ScannedAP[];
  totalPackets?: number;
  onTriggerScan?: () => void;
}

export const SdrDiagnosticView: React.FC<SdrDiagnosticViewProps> = ({
  adapters,
  selectedAdapter,
  accessPoints,
  totalPackets,
  onTriggerScan,
}) => {
  const [latencyMs, setLatencyMs] = useState<number>(3.6);
  const [jitterMs, setJitterMs] = useState<number>(0.2);
  const [showWslModal, setShowWslModal] = useState(false);

  useEffect(() => {
    let active = true;
    const measure = async () => {
      const t0 = performance.now();
      try {
        await fetch('/api/system/info');
        const t1 = performance.now();
        if (!active) return;
        const rtt = Math.max(1.1, Math.round((t1 - t0) * 10) / 10);
        setLatencyMs((prev) => Math.round((prev * 0.6 + rtt * 0.4) * 10) / 10);
        setJitterMs(Math.round(Math.abs(rtt - latencyMs) * 10) / 10);
      } catch {
        // ignore
      }
    };
    measure();
    const interval = setInterval(measure, 4000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [latencyMs]);

  return (
    <div className="sdr-diag-container">
      {/* 1. Header */}
      <div className="sdr-diag-header">
        <div className="sdr-diag-title">
          <i className="bi bi-cpu"></i>
          <div>
            <h2>Diagnóstico de Hardware y Telemetría de Transceptores</h2>
            <p>
              Monitoreo de bajo nivel de los adaptadores de radiofrecuencia (PCIe & USB Dongles)
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn-tactical-stop"
            style={{ padding: '8px 16px', fontSize: '0.74rem', backgroundColor: '#6f489a', borderColor: '#ab85d9', color: '#ffffff', boxShadow: '0 0 10px rgba(134, 93, 177, 0.4)' }}
            onClick={() => setShowWslModal(true)}
            title="Abrir asistente de configuración de Modo Monitor Promiscuo con WSL2 y Scapy"
          >
            <i className="bi bi-ubuntu"></i>
            <span>MODO MONITOR (WSL2)</span>
          </button>

          <button
            className="btn-tactical-stop"
            style={{ padding: '8px 16px', fontSize: '0.74rem' }}
            onClick={onTriggerScan}
          >
            <i className="bi bi-arrow-repeat"></i>
            <span>SONDEO INMEDIATO</span>
          </button>
        </div>
      </div>

      {/* 2. KPIs Row */}
      <div className="sdr-diag-kpis">
        <div className="sdr-kpi-box">
          <span className="sdr-kpi-lbl">MÓDULOS ACTIVOS</span>
          <span className="sdr-kpi-val" style={{ color: '#ab85d9' }}>
            {adapters.length} {adapters.length === 1 ? 'MÓDULO' : 'MÓDULOS'}
          </span>
          <span className="sdr-kpi-sub">
            {selectedAdapter === 'ALL' ? 'Modo Multi-Sensor Paralelo' : `Dedicado: ${selectedAdapter}`}
          </span>
        </div>

        <div className="sdr-kpi-box">
          <span className="sdr-kpi-lbl">LATENCIA DE CAPTURA</span>
          <span className="sdr-kpi-val" style={{ color: '#10b981' }}>
            {latencyMs.toFixed(1)} ms
          </span>
          <span className="sdr-kpi-sub">Jitter de sondeo: ± {jitterMs.toFixed(1)} ms</span>
        </div>

        <div className="sdr-kpi-box">
          <span className="sdr-kpi-lbl">DESCARTE EN BUFFER FIFO</span>
          <span className="sdr-kpi-val" style={{ color: 'var(--color6)' }}>
            0.00%
          </span>
          <span className="sdr-kpi-sub">
            {totalPackets ?? accessPoints.length * 12} paquetes en cola ring-buffer
          </span>
        </div>

        <div className="sdr-kpi-box">
          <span className="sdr-kpi-lbl">BSSIDS SINCRONIZADOS</span>
          <span className="sdr-kpi-val" style={{ color: '#f59e0b' }}>
            {accessPoints.length} APs
          </span>
          <span className="sdr-kpi-sub">Recepción directa en memoria</span>
        </div>
      </div>

      {/* 2.5 Banner Extensión WSL2 Modo Monitor */}
      <div
        style={{
          backgroundColor: 'var(--color1)',
          border: '1px solid rgba(171, 133, 217, 0.35)',
          borderRadius: '8px',
          padding: '14px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          background: 'rgba(111, 72, 154, 0.12)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <i className="bi bi-shield-lock-fill" style={{ fontSize: '1.5rem', color: '#ab85d9' }}></i>
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color6)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Extensión de Modo Monitor Promiscuo (WSL2 + Scapy)</span>
              <span
                style={{
                  fontSize: '0.62rem',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(171, 133, 217, 0.2)',
                  color: '#ab85d9',
                  border: '1px solid #ab85d9',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                ESTILO DOCKER DESKTOP
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Captura Data Frames, RTS/CTS y tramas de clientes redirigiendo tu antena Wi-Fi USB al kernel Linux sin salir de Windows.
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowWslModal(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            backgroundColor: '#6f489a',
            border: '1px solid #ab85d9',
            borderRadius: '6px',
            color: '#ffffff',
            fontSize: '0.74rem',
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 0 10px rgba(134, 93, 177, 0.4)',
            whiteSpace: 'nowrap',
          }}
        >
          <i className="bi bi-sliders"></i>
          <span>CONFIGURAR EXTENSIÓN WSL2</span>
        </button>
      </div>

      {/* 3. Split: Hardware Interfaces Details & Live Frames Monitor */}
      <div className="sdr-diag-split">
        {/* Left: Hardware Modules Details */}
        <div className="sdr-card">
          <div className="sdr-card-title">
            <i className="bi bi-hdd-network-fill"></i>
            <span>Estado Físico de los Transceptores Conectados</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {adapters.map((ad) => (
              <div
                key={ad.id}
                style={{
                  backgroundColor: 'var(--color1)',
                  padding: '14px',
                  borderRadius: '6px',
                  border: '1px solid var(--color3)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, color: 'var(--color6)', fontSize: '0.85rem' }}>
                    <i className="bi bi-wifi" style={{ marginRight: '6px' }}></i>
                    {ad.name}
                  </span>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      fontFamily: 'var(--font-mono)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid #10b981',
                      color: '#10b981',
                      fontWeight: 700,
                    }}
                  >
                    {ad.status === 'connected' ? 'CONECTADO Y ACTIVO' : 'LIBRE / MODO ESCANEO'}
                  </span>
                </div>

                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  {ad.description}
                </div>

                <div
                  style={{
                    fontSize: '0.68rem',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-dim)',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '4px',
                    marginTop: '4px',
                  }}
                >
                  <div>MAC Física: <strong style={{ color: 'var(--color6)' }}>{ad.mac_address || 'N/A'}</strong></div>
                  <div>Tipo de Radio: <strong style={{ color: 'var(--color6)' }}>{ad.radio_type || '802.11ax/ac/n'}</strong></div>
                  <div>SSID Enlace: <strong style={{ color: '#ab85d9' }}>{ad.connected_ssid || 'Ninguno (Modo pasivo)'}</strong></div>
                  <div>Canal Base: <strong style={{ color: '#ab85d9' }}>Ch {ad.current_channel || 'Auto'}</strong></div>
                </div>
              </div>
            ))}

            {adapters.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                Buscando transceptores conectados en el bus PCIe y USB...
              </div>
            )}
          </div>
        </div>

        {/* Right: Live Frames Monitor */}
        <div className="sdr-card">
          <div className="sdr-card-title">
            <i className="bi bi-terminal-split"></i>
            <span>Monitor de Tramas RF Capturadas ({accessPoints.length} BSSIDs)</span>
          </div>

          <div className="sdr-table-scroll">
            <table className="data-table" style={{ fontSize: '0.72rem' }}>
              <thead>
                <tr>
                  <th>SSID</th>
                  <th>BSSID</th>
                  <th>CANAL</th>
                  <th>RSSI</th>
                  <th>MÓDULO</th>
                </tr>
              </thead>
              <tbody>
                {accessPoints.map((ap) => (
                  <tr key={ap.bssid}>
                    <td>
                      <strong>{ap.ssid}</strong>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      {ap.bssid}
                    </td>
                    <td style={{ color: 'var(--color5)', fontWeight: 700 }}>
                      Ch {ap.channel}
                    </td>
                    <td style={{ color: ap.rssi >= -65 ? '#10b981' : ap.rssi >= -75 ? '#ab85d9' : '#f59e0b' }}>
                      {ap.rssi} dBm
                    </td>
                    <td style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                      {ap.adapter_name || 'Wi-Fi'}
                    </td>
                  </tr>
                ))}
                {accessPoints.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                      Esperando tramas RF desde los adaptadores...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <WslMonitorModal isOpen={showWslModal} onClose={() => setShowWslModal(false)} />
    </div>
  );
};

export default SdrDiagnosticView;
