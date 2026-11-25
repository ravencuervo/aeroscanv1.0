import React from 'react';
import type { User } from '../types/spectrum';
import './HeaderBar.css';

interface HeaderBarProps {
  user: User | null;
  engineType: string;
  isLive: boolean;
  isCapturing?: boolean;
  activeTab?: string;
  onLogout: () => void;
  onNavigate?: (tab: string) => void;
  onOpenNewSession?: () => void;
}

// Título de cada vista: una sola fuente para el encabezado
const TITULOS: Record<string, string> = {
  dashboard: 'Dashboard',
  live: 'Captura en vivo',
  channels: 'Análisis de canales',
  history: 'Historial y comparación',
  reports: 'Reportes técnicos',
  config: 'Configuración y hardware',
  sdr: 'Diagnóstico de hardware',
  docs: 'Documentación',
};

// Nombre real del motor activo: el encabezado no debe decir "hardware real" si es el simulador
const MOTORES: Record<string, string> = {
  windows: 'Hardware real (Windows)',
  scapy: 'Modo monitor (WSL2)',
  scapy_wsl: 'Modo monitor (WSL2)',
  simulation: 'Simulación',
};

export const HeaderBar: React.FC<HeaderBarProps> = ({
  user,
  engineType,
  isLive,
  isCapturing = true,
  activeTab = 'live',
}) => {
  const motor = MOTORES[engineType] || engineType;
  const esSimulacion = engineType === 'simulation';

  // Un solo indicador de estado: conexión con el núcleo y captura
  let estado = 'Capturando';
  let claseEstado = 'ok';
  if (!isLive) {
    estado = 'Sin conexión';
    claseEstado = 'danger';
  } else if (!isCapturing) {
    estado = 'Detenido';
    claseEstado = 'warn';
  }

  return (
    <header className="app-header-bar">
      <div className="header-left-breadcrumbs">
        <div className="header-breadcrumb-title">
          <span>AeroScan</span>
          <span className="bc-sub">/</span>
          <span className="bc-sub">{TITULOS[activeTab] || TITULOS.live}</span>
        </div>

        <div className={`header-hardware-live-tag ${esSimulacion ? 'is-sim' : ''}`} title="Motor de captura activo">
          <i className={`bi ${esSimulacion ? 'bi-cpu' : 'bi-wifi'}`}></i>
          <span>{motor}</span>
        </div>
      </div>

      <div className="header-right-actions">
        <div className="header-status-badge" title="Estado de la conexión y de la captura">
          <span className={`header-status-dot ${claseEstado}`}></span>
          <span>{estado}</span>
        </div>

        {user && (
          <div className="header-user-profile" title={`Usuario: ${user.full_name || user.username}`}>
            <div className="header-user-avatar">
              <i className="bi bi-person-fill"></i>
            </div>
            <span className="header-user-name">{user.full_name || user.username}</span>
          </div>
        )}
      </div>
    </header>
  );
};
