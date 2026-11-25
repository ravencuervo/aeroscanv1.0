import React, { useEffect } from 'react';
import './ConfirmDialog.css';

// Diálogo de confirmación propio de AeroScan.
// Reemplaza a window.confirm(), que en la ventana de escritorio (WebView2)
// muestra un cuadro del navegador con el texto "127.0.0.1 dice" y sin la paleta de la app.
interface ConfirmDialogProps {
  abierto: boolean;
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  peligroso?: boolean; // true = acción que borra datos (botón en rojo)
  onConfirmar: () => void;
  onCancelar: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  abierto,
  titulo,
  mensaje,
  textoConfirmar = 'Confirmar',
  peligroso = false,
  onConfirmar,
  onCancelar,
}) => {
  // Escape cierra el diálogo, igual que en cualquier ventana de Windows
  useEffect(() => {
    if (!abierto) return;
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancelar();
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [abierto, onCancelar]);

  if (!abierto) return null;

  return (
    <div className="confirm-overlay" onClick={onCancelar}>
      <div
        className="confirm-caja"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-cabecera">
          <i className={`bi ${peligroso ? 'bi-exclamation-triangle-fill confirm-icono-peligro' : 'bi-question-circle-fill confirm-icono'}`}></i>
          <h3 id="confirm-titulo">{titulo}</h3>
        </div>
        <p className="confirm-mensaje">{mensaje}</p>
        <div className="confirm-botones">
          <button type="button" className="confirm-btn-cancelar" onClick={onCancelar} autoFocus>
            Cancelar
          </button>
          <button
            type="button"
            className={peligroso ? 'confirm-btn-peligro' : 'confirm-btn-ok'}
            onClick={onConfirmar}
          >
            {textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
};
