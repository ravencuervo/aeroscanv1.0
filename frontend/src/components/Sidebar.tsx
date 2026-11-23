import React from 'react';
import './Sidebar.css';

interface SidebarProps {
  activeTab: string;
  isCapturing?: boolean;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  onOpenNewSession?: () => void;
  systemInfo?: any;
  totalPackets?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  isCapturing = true,
  onTabChange,
  onLogout,
  onOpenNewSession,
  systemInfo,
  totalPackets = 0,
}) => {
  return (
    <aside className="app-sidebar">
      <div>
        {/* Brand Header */}
        <div className="sidebar-brand-box">
          <div className="sidebar-brand">
            <div className="sidebar-logo-wrap">
              <img
                src="/images/logos/logo.svg"
                alt="AeroScan Logo"
                className="sidebar-logo-img"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.src.endsWith('/images/logos/logo.png')) {
                    target.src = '/images/logos/logo.png';
                  }
                }}
              />
            </div>
            <div>
              <div className="sidebar-title-h1">AeroScan</div>
              <div className="sidebar-title-sub">WiFi Spectrum Analytics</div>
            </div>
          </div>

          <div className="sidebar-status-pill">
            <span>
              <span
                className="sidebar-dot-active"
                style={{
                  backgroundColor: isCapturing ? '#10b981' : '#f59e0b',
                  boxShadow: isCapturing ? '0 0 8px #10b981' : '0 0 8px #f59e0b',
                }}
              ></span>{' '}
              MOTOR RF: {isCapturing ? 'ACTIVO' : 'DETENIDO'}
            </span>
            <span>40MHz FFT</span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="sidebar-menu-nav">
          {onOpenNewSession && (
            <button
              className="sidebar-new-audit-action"
              onClick={onOpenNewSession}
              title="Iniciar nueva auditoría formal en SQLite"
            >
              <i className="bi bi-plus-circle-fill"></i>
              <span>NUEVA AUDITORÍA</span>
            </button>
          )}

          <button
            className={`sidebar-menu-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => onTabChange('dashboard')}
          >
            <i className="bi bi-grid-1x2"></i>
            <span>Dashboard</span>
          </button>

          <button
            className={`sidebar-menu-btn ${activeTab === 'live' ? 'active' : ''}`}
            onClick={() => onTabChange('live')}
          >
            <i className="bi bi-broadcast"></i>
            <span>Captura en vivo</span>
          </button>

          <button
            className={`sidebar-menu-btn ${activeTab === 'channels' ? 'active' : ''}`}
            onClick={() => onTabChange('channels')}
          >
            <i className="bi bi-bar-chart"></i>
            <span>Análisis de canales</span>
          </button>

          <button
            className={`sidebar-menu-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => onTabChange('history')}
          >
            <i className="bi bi-clock-history"></i>
            <span>Historial y comparación</span>
          </button>

          <button
            className={`sidebar-menu-btn ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => onTabChange('reports')}
          >
            <i className="bi bi-file-earmark-text"></i>
            <span>Reportes técnicos</span>
          </button>

          <button
            className={`sidebar-menu-btn ${activeTab === 'config' ? 'active' : ''}`}
            onClick={() => onTabChange('config')}
          >
            <i className="bi bi-sliders"></i>
            <span>Configuración / Hardware</span>
          </button>

          <div className="sidebar-divider"></div>

          <button
            className={`sidebar-menu-btn ${activeTab === 'sdr' ? 'active' : ''}`}
            onClick={() => onTabChange('sdr')}
          >
            <i className="bi bi-cpu"></i>
            <span>Diagnóstico SDR</span>
          </button>

          <button
            className={`sidebar-menu-btn ${activeTab === 'docs' ? 'active' : ''}`}
            onClick={() => onTabChange('docs')}
          >
            <i className="bi bi-question-circle"></i>
            <span>Documentación</span>
          </button>

          <div className="sidebar-divider"></div>

          {/* User Requested: Boton de Cerrar Sesión */}
          <button
            className="sidebar-menu-btn sidebar-logout-btn"
            onClick={onLogout}
            title="Cerrar sesión del sistema"
          >
            <i className="bi bi-box-arrow-left"></i>
            <span>Cerrar Sesión</span>
          </button>
        </nav>
      </div>

      {/* Bottom Buffer FIFO Meter or SDR Storage */}
      <div className="sidebar-footer-box">
        {activeTab === 'history' ? (
          <>
            <div className="buffer-header">
              <span>ALMACENAMIENTO BD</span>
              <span className="buffer-val" style={{ color: '#38bdf8' }}>
                {systemInfo?.db_size_formatted || '0.24 MB'}
              </span>
            </div>
            <div className="buffer-progress-bar">
              <div
                className="buffer-progress-fill"
                style={{
                  width: `${Math.min(100, Math.max(5, systemInfo?.disk_usage_percent || 12))}%`,
                  background: 'linear-gradient(90deg, #06b6d4, #10b981)',
                }}
              ></div>
            </div>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
              Libre: {systemInfo?.disk_free_formatted || '84.2 GB'} / {systemInfo?.disk_total_formatted || '512 GB'}
            </div>
          </>
        ) : (
          <>
            <div className="buffer-header">
              <span>BUFFER FIFO</span>
              <span className="buffer-val" style={{ color: '#38bdf8' }}>
                {totalPackets > 0 ? `${totalPackets} tramas` : '4.2 KB / RAM'}
              </span>
            </div>
            <div className="buffer-progress-bar">
              <div
                className="buffer-progress-fill"
                style={{
                  width: `${Math.min(100, Math.max(8, ((totalPackets || 15) % 1000) / 10))}%`,
                }}
              ></div>
            </div>
            <div style={{ fontSize: '0.58rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: '3px' }}>
              Base SQLite WAL: {systemInfo?.db_size_formatted || '0.24 MB'}
            </div>
          </>
        )}
      </div>
    </aside>
  );
};
