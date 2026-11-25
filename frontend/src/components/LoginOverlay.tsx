import React, { useState } from 'react';
import type { User } from '../types/spectrum';
import { Login3DVisual } from './Login3DVisual';
import './LoginOverlay.css';

interface LoginOverlayProps {
  onLoginSuccess: (user: User, token: string) => void;
}

export const LoginOverlay: React.FC<LoginOverlayProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('aeroscan_token', data.token);
        onLoginSuccess(data.user, data.token);
      } else if (res.status === 401) {
        setError('Usuario o contraseña incorrectos.');
      } else if (res.status >= 500) {
        setError('No se pudo conectar con el núcleo de AeroScan. Cierra el programa y vuelve a abrirlo.');
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.detail || 'No se pudo iniciar sesión. Inténtalo de nuevo.');
      }
    } catch {
      // Sin respuesta del servidor local: nunca se deja entrar sin validar la contraseña
      setError('No se pudo conectar con el núcleo de AeroScan. Cierra el programa y vuelve a abrirlo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-overlay">
      {/* Full-Height Left Column: Clean Form */}
      <div className="login-left-pane">
        <div className="login-content-box">
          <div className="login-brand-header">
            <div className="login-logo-wrap">
              <img
                src="/images/logos/logo.svg"
                alt="AeroScan Logo"
                className="login-logo-img"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.src.endsWith('/images/logos/logo.png')) {
                    target.src = '/images/logos/logo.png';
                  }
                }}
              />
            </div>
            <div className="login-titles">
              <h2>AeroScan</h2>
              <p>Auditoría espectral WiFi</p>
            </div>
          </div>

          <div className="login-welcome-text">
            <h3>Iniciar sesión</h3>
          </div>

          {error && (
            <div className="login-error">
              <i className="bi bi-exclamation-triangle-fill"></i>
              <span>{error}</span>
            </div>
          )}

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-field">
              <label htmlFor="login-username">
                <i className="bi bi-person-fill" style={{ color: 'inherit' }}></i> Usuario
              </label>
              <input
                id="login-username"
                type="text"
                placeholder="Nombre de usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="login-field">
              <label htmlFor="login-password">
                <i className="bi bi-shield-lock-fill" style={{ color: 'inherit' }}></i> Contraseña
              </label>
              <input
                id="login-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? (
                <>
                  <i className="bi bi-arrow-repeat spin"></i> Verificando...
                </>
              ) : (
                <>
                  <i className="bi bi-box-arrow-in-right"></i> Ingresar
                </>
              )}
            </button>
          </form>

          <div className="login-divider">
            <span>o</span>
          </div>

          <div className="login-register-section">
            <span className="login-register-label">¿Aún no tienes una cuenta de operador?</span>
            <button
              type="button"
              className="login-register-btn"
              onClick={async () => {
                // La dirección de registro la define el backend (página web del proyecto)
                let registerUrl = '';
                try {
                  const r = await fetch('/api/auth/register-url');
                  registerUrl = (await r.json()).url;
                  // Dentro de la ventana de escritorio, el backend abre el navegador del sistema
                  const res = await fetch('/api/system/open-browser', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: registerUrl }),
                  });
                  if (res.ok) return;
                } catch {
                  // Si el núcleo no responde, se intenta abrir desde la propia interfaz
                }
                if (registerUrl) window.open(registerUrl, '_blank', 'noopener,noreferrer');
              }}
              title="Abrir formulario de registro en el navegador"
            >
              <i className="bi bi-person-plus-fill"></i>
              <span>Registrarse o solicitar licencia</span>
              <i className="bi bi-box-arrow-up-right login-external-icon"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Full-Height Right Column: Pure 3D Model Only */}
      <div className="login-right-pane">
        <Login3DVisual />
      </div>
    </div>
  );
};
