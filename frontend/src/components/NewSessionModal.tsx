import React, { useState } from 'react';
import type { WirelessAdapter } from '../types/spectrum';
import './NewSessionModal.css';

interface NewSessionModalProps {
  isOpen: boolean;
  adapters?: WirelessAdapter[];
  selectedAdapter?: string;
  onClose: () => void;
  onStartSession: (name: string, location: string, engineType: string, adapterId?: string) => Promise<void>;
}

export const NewSessionModal: React.FC<NewSessionModalProps> = ({
  isOpen,
  adapters = [],
  selectedAdapter = 'ALL',
  onClose,
  onStartSession,
}) => {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [aceptaAviso, setAceptaAviso] = useState(false);
  const [engineType, setEngineType] = useState('auto');
  const [adapterId, setAdapterId] = useState(selectedAdapter);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aceptaAviso) return;
    setLoading(true);
    setError(null);
    try {
      await onStartSession(name.trim(), location.trim(), engineType, adapterId);
      setAceptaAviso(false);
      onClose();
    } catch (err: any) {
      // El error se muestra dentro del formulario para que el usuario no pierda lo escrito
      setError(`No se pudo iniciar la auditoría: ${err?.message || 'sin respuesta del núcleo'}.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="modal-header">
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color6)' }}>
            Nueva auditoría
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '1.2rem',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label htmlFor="session-name">Nombre de la auditoría</label>
              <input
                id="session-name"
                type="text"
                placeholder="Ej.: Oficina de soporte, turno mañana"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="session-location">Ubicación</label>
              <input
                id="session-location"
                type="text"
                placeholder="Ej.: Pabellón B, aula 207"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="session-engine">Motor de captura</label>
              <select
                id="session-engine"
                value={engineType}
                onChange={(e) => setEngineType(e.target.value)}
              >
                <option value="auto">Automático (recomendado)</option>
                <option value="windows">Windows nativo (adaptador del equipo)</option>
                <option value="scapy_wsl">Modo monitor (WSL2 / Linux)</option>
              </select>
            </div>

            {adapters.length > 0 && (
              <div className="form-group">
                <label htmlFor="session-adapter">Adaptador WiFi</label>
                <select
                  id="session-adapter"
                  value={adapterId}
                  onChange={(e) => setAdapterId(e.target.value)}
                >
                  {adapters.length > 1 && (
                    <option value="ALL">
                      Todos los adaptadores ({adapters.length})
                    </option>
                  )}
                  {adapters.map((ad) => (
                    <option key={ad.id} value={ad.id}>
                      {ad.name} — {ad.description}{' '}
                      {ad.connected_ssid ? `(conectado a ${ad.connected_ssid})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Aviso de uso legal (RN-09, Ley N.º 30096) */}
            <label className="modal-legal-check">
              <input
                type="checkbox"
                checked={aceptaAviso}
                onChange={(e) => setAceptaAviso(e.target.checked)}
              />
              <span>
                Analizaré solo redes propias o con autorización de su administrador. AeroScan
                únicamente escucha los anuncios públicos de las redes (Ley N.º 30096).
              </span>
            </label>
          </div>

          {error && (
            <div className="aviso aviso-error" role="alert" style={{ margin: '0 24px 12px' }}>
              <i className="bi bi-x-circle-fill"></i>
              <span>{error}</span>
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading || !aceptaAviso}>
              {loading ? 'Iniciando...' : 'Iniciar captura'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
