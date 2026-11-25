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
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div className="sidebar-title-h1">AeroScan</div>
                <span className="sidebar-version">v1.0.0</span>
              </div>
              <div className="sidebar-title-sub">Análisis del espectro WiFi</div>
            </div>
          </div>

          <div className="sidebar-status-pill">
            <span>
              <span className={`sidebar-dot-active ${isCapturing ? 'ok' : 'warn'}`}></span>{' '}
              Captura: {isCapturing ? 'activa' : 'detenida'}
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="sidebar-menu-nav">
          {onOpenNewSession && (
            <button
              className="sidebar-new-audit-action"
              onClick={onOpenNewSession}
              title="Iniciar una nueva auditoría (sesión de captura)"
            >
              <i className="bi bi-plus-circle-fill"></i>
              <span>Nueva auditoría</span>
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
            <span>Configuración</span>
          </button>

          <div className="sidebar-divider"></div>

          <button
            className={`sidebar-menu-btn ${activeTab === 'sdr' ? 'active' : ''}`}
            onClick={() => onTabChange('sdr')}
          >
            <i className="bi bi-cpu"></i>
            <span>Diagnóstico de hardware</span>
          </button>

          <button
            className={`sidebar-menu-btn ${activeTab === 'docs' ? 'active' : ''}`}
            onClick={() => onTabChange('docs')}
          >
            <i className="bi bi-question-circle"></i>
            <span>Documentación</span>
          </button>

          <div className="sidebar-divider"></div>

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

      {/* Datos reales del sistema: sin valores inventados */}
      <div className="sidebar-footer-box">
        <div className="buffer-header">
          <span>Lecturas procesadas</span>
          <span className="buffer-val">{totalPackets.toLocaleString('es-PE')}</span>
        </div>
        <div className="buffer-header">
          <span>Base de datos</span>
          <span className="buffer-val">{systemInfo?.db_size_formatted || '—'}</span>
        </div>
      </div>
    </aside>
  );
};
