import React, { useState, useEffect, useRef } from 'react';
import type { User, ScannedAP, SpectrumMetrics, SpectrumRecommendations, TelemetryPayload, WirelessAdapter } from './types/spectrum';
import './App.css';
import { LoginOverlay } from './components/LoginOverlay';
import { Sidebar } from './components/Sidebar';
import { HeaderBar } from './components/HeaderBar';
import { DaemonNoticeBanner } from './components/DaemonNoticeBanner';
import { CaptureControlBar } from './components/CaptureControlBar';
import { OscillogramChart } from './components/OscillogramChart';
import { SdrTelemetryPanel } from './components/SdrTelemetryPanel';
import { ChannelSweepStrip } from './components/ChannelSweepStrip';
import { DashboardView } from './components/DashboardView';
import { ChannelAnalysisView } from './components/ChannelAnalysisView';
import { HistoryView } from './components/HistoryView';
import { ReportsView } from './components/ReportsView';
import { NewSessionModal } from './components/NewSessionModal';
import { ConfigView } from './components/ConfigView';
import { SdrDiagnosticView } from './components/SdrDiagnosticView';
import { DocsView } from './components/DocsView';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('aeroscan_token'));
  const [activeNav, setActiveNav] = useState('dashboard');
  const [isCapturing, setIsCapturing] = useState(true);
  const [totalPackets, setTotalPackets] = useState<number>(0);
  const [sessionDuration, setSessionDuration] = useState<number>(0);
  const [bandFilter, setBandFilter] = useState({ band24: true, band5: true });
  const [isBufferPaused, setIsBufferPaused] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [engineType, setEngineType] = useState('windows');
  const [adapters, setAdapters] = useState<WirelessAdapter[]>([]);
  const [selectedAdapter, setSelectedAdapter] = useState<string>('ALL');
  const [accessPoints, setAccessPoints] = useState<ScannedAP[]>([]);
  const [metrics, setMetrics] = useState<SpectrumMetrics | null>(null);
  const [recommendations, setRecommendations] = useState<SpectrumRecommendations | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const isBufferPausedRef = useRef(isBufferPaused);
  isBufferPausedRef.current = isBufferPaused;

  // Validate authentication and query initial hardware & capture state on startup
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('aeroscan_token');
      if (!storedToken) {
        setUser(null);
        return;
      }

      if (storedToken.startsWith('dev_offline_token_')) {
        localStorage.removeItem('aeroscan_token');
        setUser(null);
        setToken(null);
        return;
      }

      try {
        const res = await fetch(`/api/auth/me?token=${encodeURIComponent(storedToken)}`);
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          setToken(storedToken);
        } else {
          localStorage.removeItem('aeroscan_token');
          setUser(null);
          setToken(null);
        }
      } catch (err) {
        console.warn('Error checking auth:', err);
      }
    };

    checkAuth();

    // Fetch initial capture status from backend
    const fetchCaptureStatus = async () => {
      try {
        const res = await fetch('/api/capture/status');
        if (res.ok) {
          const data = await res.json();
          if (data.is_capturing !== undefined) setIsCapturing(Boolean(data.is_capturing));
          if (data.total_packets !== undefined) setTotalPackets(data.total_packets);
          if (data.elapsed_seconds !== undefined) setSessionDuration(data.elapsed_seconds);
          if (data.engine_type) setEngineType(data.engine_type);
          if (data.selected_adapter) setSelectedAdapter(data.selected_adapter);
        }
      } catch (err) {
        console.warn('Error fetching capture status:', err);
      }
    };
    fetchCaptureStatus();

    // Fetch detected Wi-Fi hardware adapters (1, 2, or multi-adapter)
    const fetchAdapters = async () => {
      try {
        const res = await fetch('/api/hardware/adapters');
        if (res.ok) {
          const data = await res.json();
          if (data.adapters) setAdapters(data.adapters);
          if (data.selected_adapter) setSelectedAdapter(data.selected_adapter);
        }
      } catch (err) {
        console.warn('Error fetching hardware adapters:', err);
      }
    };
    fetchAdapters();
  }, []);

  // Connect WebSocket when authenticated
  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      setIsLive(false);
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/spectrum`;

    const connect = () => {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsLive(true);
      };

      ws.onmessage = (event) => {
        try {
          const data: TelemetryPayload = JSON.parse(event.data);
          if (data.type === 'telemetry_update') {
            if (!isBufferPausedRef.current) {
              setAccessPoints(data.access_points || []);
              setMetrics(data.metrics || null);
              setRecommendations(data.recommendations || null);
            }
            if (data.is_capturing !== undefined) setIsCapturing(Boolean(data.is_capturing));
            if (data.total_packets !== undefined) setTotalPackets(data.total_packets);
            if (data.session_duration !== undefined) setSessionDuration(data.session_duration);
            if (data.engine_type) setEngineType(data.engine_type);
            if (data.adapters) setAdapters(data.adapters);
            if (data.selected_adapter) setSelectedAdapter(data.selected_adapter);
          }
        } catch (err) {
          console.error('Error parsing telemetry:', err);
        }
      };

      ws.onclose = () => {
        setIsLive(false);
        setTimeout(() => {
          if (user) connect();
        }, 3000);
      };
    };

    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [user]);

  const handleLoginSuccess = (authenticatedUser: User, sessionToken: string) => {
    setUser(authenticatedUser);
    setToken(sessionToken);
  };

  const handleLogout = async () => {
    if (token) {
      fetch(`/api/auth/logout?token=${encodeURIComponent(token)}`, { method: 'POST' }).catch(() => {});
    }
    localStorage.removeItem('aeroscan_token');
    setUser(null);
    setToken(null);
  };

  const handleSelectAdapter = async (adapterId: string) => {
    setSelectedAdapter(adapterId);
    try {
      const res = await fetch('/api/hardware/adapters/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adapter_id: adapterId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.selected_adapter) setSelectedAdapter(data.selected_adapter);
      }
    } catch (err) {
      console.error('Error switching hardware adapter:', err);
    }
  };

  const handleExportPdf = async () => {
    try {
      const res = await fetch('/api/reports/pdf', { method: 'POST' });
      const data = await res.json();
      if (data.download_url) {
        window.location.href = data.download_url;
      }
    } catch (err: any) {
      alert('Error generando PDF: ' + err.message);
    }
  };

  const handleExportExcel = async () => {
    try {
      const res = await fetch('/api/reports/excel', { method: 'POST' });
      const data = await res.json();
      if (data.download_url) {
        window.location.href = data.download_url;
      }
    } catch (err: any) {
      alert('Error generando Excel: ' + err.message);
    }
  };

  const handleToggleCapture = async () => {
    try {
      const endpoint = isCapturing ? '/api/capture/stop' : '/api/capture/start';
      const res = await fetch(endpoint, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setIsCapturing(Boolean(data.is_capturing));
        if (data.total_packets !== undefined) setTotalPackets(data.total_packets);
      }
    } catch (err) {
      console.error('Error toggling capture:', err);
    }
  };

  const handleToggleBand = (band: '2.4' | '5') => {
    setBandFilter((prev) => {
      if (band === '2.4') {
        return { ...prev, band24: !prev.band24 };
      } else {
        return { ...prev, band5: !prev.band5 };
      }
    });
  };

  const handleStartSession = async (name: string, location: string, engine: string, adapterId: string = 'ALL') => {
    const res = await fetch('/api/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        location,
        engine_type: engine,
        adapter_id: adapterId,
        user_id: user ? user.id : null,
      }),
    });
    if (!res.ok) {
      throw new Error('No se pudo iniciar la sesión');
    }
    setIsCapturing(true);
    setTotalPackets(0);
    setSessionDuration(0);
  };

  const filteredAccessPoints = accessPoints.filter((ap) => {
    const is24 = ap.band === '2.4GHz' || ap.channel <= 14;
    const is5 = ap.band === '5GHz' || ap.channel > 14;
    if (is24 && !bandFilter.band24) return false;
    if (is5 && !bandFilter.band5) return false;
    return true;
  });

  return (
    <>
      {!user && <LoginOverlay onLoginSuccess={handleLoginSuccess} />}

      <div className="dashboard-layout">
        {/* Left Fixed Sidebar matching reference layout */}
        <Sidebar
          activeTab={activeNav}
          isCapturing={isCapturing}
          onTabChange={setActiveNav}
          onLogout={handleLogout}
        />

        {/* Main Dashboard Area */}
        <main className="dashboard-main-area">
          <HeaderBar
            user={user}
            engineType={engineType}
            isLive={isLive}
            isCapturing={isCapturing}
            activeTab={activeNav}
            onLogout={handleLogout}
            onNavigate={setActiveNav}
          />

          <div className="dashboard-content-body">
            {/* 1. Dashboard Principal (Image 1) */}
            {activeNav === 'dashboard' && (
              <DashboardView
                accessPoints={accessPoints}
                metrics={metrics}
                recommendations={recommendations}
              />
            )}

            {/* 2. Captura en Vivo */}
            {activeNav === 'live' && (
              <>
                <DaemonNoticeBanner
                  isLive={isLive}
                  engineType={engineType}
                  isCapturing={isCapturing}
                  onToggleCapture={handleToggleCapture}
                />

                <CaptureControlBar
                  engineType={engineType}
                  isCapturing={isCapturing}
                  totalAps={filteredAccessPoints.length}
                  totalPackets={totalPackets}
                  sessionDuration={sessionDuration}
                  adapters={adapters}
                  selectedAdapter={selectedAdapter}
                  onSelectAdapter={handleSelectAdapter}
                  onToggleCapture={handleToggleCapture}
                  onExportReports={handleExportPdf}
                  isPaused={isBufferPaused}
                  onTogglePause={() => setIsBufferPaused(!isBufferPaused)}
                  band24={bandFilter.band24}
                  band5={bandFilter.band5}
                  onToggleBand={handleToggleBand}
                />

                <div className="main-viz-split-grid">
                  <OscillogramChart accessPoints={filteredAccessPoints} />
                  <SdrTelemetryPanel
                    adapters={adapters}
                    selectedAdapter={selectedAdapter}
                    onSelectAdapter={handleSelectAdapter}
                    isCapturing={isCapturing}
                    totalPackets={totalPackets}
                    onSaveFrame={handleExportPdf}
                  />
                </div>

                <ChannelSweepStrip accessPoints={filteredAccessPoints} isCapturing={isCapturing} />
              </>
            )}

            {/* 3. Análisis de canales (Image 3) */}
            {activeNav === 'channels' && (
              <ChannelAnalysisView accessPoints={accessPoints} />
            )}

            {/* 4. Historial y comparación (Image 2) */}
            {activeNav === 'history' && (
              <HistoryView onGeneratePdf={handleExportPdf} />
            )}

            {/* 5. Reportes técnicos (Image 4) */}
            {activeNav === 'reports' && (
              <ReportsView
                accessPoints={accessPoints}
                metrics={metrics}
                recommendations={recommendations}
                adapters={adapters}
                user={user}
                onExportPdf={handleExportPdf}
                onExportExcel={handleExportExcel}
              />
            )}

            {/* 6. Configuración General del Sistema */}
            {activeNav === 'config' && (
              <ConfigView
                adapters={adapters}
                selectedAdapter={selectedAdapter}
                onSelectAdapter={handleSelectAdapter}
              />
            )}

            {/* 7. Diagnóstico de Hardware SDR / PCIe / USB */}
            {activeNav === 'sdr' && (
              <SdrDiagnosticView
                adapters={adapters}
                selectedAdapter={selectedAdapter}
                accessPoints={accessPoints}
                onTriggerScan={() => handleSelectAdapter(selectedAdapter)}
              />
            )}

            {/* 8. Guía de Ingeniería RF y Documentación */}
            {activeNav === 'docs' && <DocsView />}
          </div>
        </main>
      </div>

      <NewSessionModal
        isOpen={isModalOpen}
        adapters={adapters}
        selectedAdapter={selectedAdapter}
        onClose={() => setIsModalOpen(false)}
        onStartSession={handleStartSession}
      />
    </>
  );
};

export default App;
