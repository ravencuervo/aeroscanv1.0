import React, { useState, useEffect } from 'react';
import './WslMonitorModal.css';

interface WslStatus {
  is_windows: boolean;
  wsl_available: boolean;
  wsl_installed: boolean;
  wsl_message: string;
  distros: string[];
  usbipd_installed: boolean;
  winget_available: boolean;
  usb_wifi_adapters: Array<{
    name: string;
    instance_id: string;
    status: string;
    compatible_monitor: boolean;
  }>;
  monitor_ready: boolean;
  commands?: {
    install_wsl: string;
    install_usbipd: string;
    setup_packages: string;
  };
}

interface WslMonitorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WslMonitorModal: React.FC<WslMonitorModalProps> = ({ isOpen, onClose }) => {
  const [status, setStatus] = useState<WslStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/wsl/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      console.warn('Error fetching WSL status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      setFeedback(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLaunchInstall = async () => {
    setLaunching(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/wsl/install', { method: 'POST' });
      const data = await res.json();
      if (data.status === 'launched') {
        setFeedback('Instalador iniciado en ventana de terminal elevada. Sigue las instrucciones en pantalla.');
      } else {
        setFeedback(data.message || 'Error al lanzar el instalador.');
      }
    } catch (err: any) {
      setFeedback('Error al comunicarse con el backend: ' + err.message);
    } finally {
      setLaunching(false);
    }
  };

  const handleDownloadScript = () => {
    window.location.href = '/api/wsl/installer-script';
  };

  const primaryAdapter = status?.usb_wifi_adapters && status.usb_wifi_adapters.length > 0
    ? status.usb_wifi_adapters[0]
    : null;

  return (
    <div className="wsl-modal-overlay" onClick={onClose}>
      <div className="wsl-modal-box" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="wsl-modal-header">
          <div className="wsl-modal-title">
            <i className="bi bi-ubuntu"></i>
            <div>
              <h3>Extensión WSL2: Modo Monitor Promiscuo</h3>
              <p>Virtualización ligera Linux + Scapy para captura de tramas 802.11 Data, RTS/CTS y Control</p>
            </div>
          </div>
          <button className="wsl-btn-close" onClick={onClose} title="Cerrar ventana">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="wsl-modal-body">
          {/* Explanation Banner */}
          <div className="wsl-intro-banner">
            <i className="bi bi-info-circle-fill"></i>
            <div className="wsl-intro-text">
              <strong>¿Por qué se requiere WSL2 para Modo Monitor en Windows?</strong><br />
              Los controladores de red estándar de Windows bloquean el modo monitor promiscuo crudo.
              Igual que <strong>Docker Desktop</strong>, AeroScan utiliza el subsistema <strong>WSL2</strong> y la utilidad <strong>USB/IP</strong> para canalizar tu antena Wi-Fi física USB hacia el motor de captura Scapy sin abandonar Windows.
            </div>
          </div>

          {/* Diagnostic 3-Card Grid */}
          <div className="wsl-diag-grid">
            {/* Card 1: WSL2 */}
            <div className="wsl-status-card">
              <span className="wsl-card-label">1. Subsistema WSL2</span>
              <div className="wsl-card-val">
                {status?.wsl_installed ? (
                  <span className="badge-wsl-ok">
                    <i className="bi bi-check-circle-fill"></i> INSTALADO
                  </span>
                ) : (
                  <span className="badge-wsl-warn">
                    <i className="bi bi-exclamation-triangle-fill"></i> PENDIENTE
                  </span>
                )}
              </div>
              <div className="wsl-card-desc">
                {status?.distros && status.distros.length > 0
                  ? `Distribución: ${status.distros.join(', ')}`
                  : 'Requiere kernel WSL2 y Ubuntu'}
              </div>
            </div>

            {/* Card 2: USB/IP */}
            <div className="wsl-status-card">
              <span className="wsl-card-label">2. Utilidad USB/IP</span>
              <div className="wsl-card-val">
                {status?.usbipd_installed ? (
                  <span className="badge-wsl-ok">
                    <i className="bi bi-check-circle-fill"></i> INSTALADO
                  </span>
                ) : (
                  <span className="badge-wsl-warn">
                    <i className="bi bi-exclamation-triangle-fill"></i> NO DETECTADO
                  </span>
                )}
              </div>
              <div className="wsl-card-desc">
                usbipd-win para passthrough de antenas USB
              </div>
            </div>

            {/* Card 3: USB Wi-Fi Adapter */}
            <div className="wsl-status-card">
              <span className="wsl-card-label">3. Antena USB Wi-Fi</span>
              <div className="wsl-card-val">
                {primaryAdapter ? (
                  <span className="badge-wsl-ok">
                    <i className="bi bi-usb-symbol"></i> DETECTADA
                  </span>
                ) : (
                  <span className="badge-wsl-warn">
                    <i className="bi bi-search"></i> DESCONECTADA
                  </span>
                )}
              </div>
              <div className="wsl-card-desc" title={primaryAdapter?.name}>
                {primaryAdapter ? primaryAdapter.name : 'Conecta una antena USB (TP-Link, Alfa, etc.)'}
              </div>
            </div>
          </div>

          {feedback && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '6px',
                backgroundColor: 'rgba(171, 133, 217, 0.15)',
                border: '1px solid #ab85d9',
                color: '#d5c4ec',
                fontSize: '0.74rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <i className="bi bi-terminal"></i>
              <span>{feedback}</span>
            </div>
          )}

          {/* Guided 4-Step Setup Accordion */}
          <div className="wsl-steps-container">
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--color6)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
              Guía de Activación de Modo Monitor Promiscuo
            </span>

            <div className="wsl-step-row">
              <div className="wsl-step-num">1</div>
              <div className="wsl-step-content">
                <div className="wsl-step-title">Instalación automatizada de WSL2 y Ubuntu</div>
                <div className="wsl-step-desc">
                  Ejecuta el asistente con el botón inferior o escribe en un PowerShell como Administrador:
                </div>
                <div className="wsl-code-block">
                  <span>wsl --install -d Ubuntu</span>
                </div>
              </div>
            </div>

            <div className="wsl-step-row">
              <div className="wsl-step-num">2</div>
              <div className="wsl-step-content">
                <div className="wsl-step-title">Instalación de usbipd-win (Passthrough USB)</div>
                <div className="wsl-step-desc">
                  Permite redirigir transceptores USB Wi-Fi desde Windows hacia el subsistema Linux:
                </div>
                <div className="wsl-code-block">
                  <span>winget install --exact dorssel.usbipd-win</span>
                </div>
              </div>
            </div>

            <div className="wsl-step-row">
              <div className="wsl-step-num">3</div>
              <div className="wsl-step-content">
                <div className="wsl-step-title">Vincular y adjuntar tu antena Wi-Fi a WSL2</div>
                <div className="wsl-step-desc">
                  Identifica el BUSID de tu dispositivo (ej. 2-1) y adjúntalo a la máquina virtual:
                </div>
                <div className="wsl-code-block">
                  <span>usbipd list &amp;&amp; usbipd attach --wsl -b &lt;BUSID&gt;</span>
                </div>
              </div>
            </div>

            <div className="wsl-step-row">
              <div className="wsl-step-num">4</div>
              <div className="wsl-step-content">
                <div className="wsl-step-title">Activar captura Scapy Promiscua en AeroScan</div>
                <div className="wsl-step-desc">
                  AeroScan iniciará el agente Scapy y comenzará a recibir Data Frames y control RTS/CTS en tiempo real.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="wsl-modal-footer">
          <button className="wsl-btn-secondary" onClick={handleDownloadScript} title="Descargar script .bat instalador">
            <i className="bi bi-download"></i>
            <span>Descargar Script .bat</span>
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="wsl-btn-secondary" onClick={fetchStatus} disabled={loading} title="Re-verificar estado de WSL2">
              <i className={`bi bi-arrow-clockwise ${loading ? 'spin' : ''}`}></i>
              <span>{loading ? 'Verificando...' : 'Re-verificar'}</span>
            </button>

            <button
              className="wsl-btn-primary"
              onClick={handleLaunchInstall}
              disabled={launching}
              title="Abrir instalador automatizado elevado estilo Docker Desktop"
            >
              <i className="bi bi-play-circle-fill"></i>
              <span>{launching ? 'Iniciando...' : 'Instalar Extensión (1 Clic)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
