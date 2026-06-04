import { createPortal } from 'react-dom';

export function ConfirmModal({
  isOpen,
  title,
  message,
  buttonText = 'Confirmar',
  onConfirm,
  onCancel,
  isDangerous = false
}: {
  isOpen: boolean;
  title: string;
  message: string;
  buttonText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDangerous?: boolean;
}) {
  if (!isOpen) return null;

  return createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 12, padding: 24, maxWidth: 400,
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
      }}>
        <h3 style={{ margin: '0 0 12px', color: 'var(--text)', fontSize: 18, fontWeight: 700 }}>{title}</h3>
        <p style={{ margin: '0 0 24px', color: 'var(--text2)', fontSize: 14, lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} className="btn btn-secondary">Cancelar</button>
          <button 
            onClick={onConfirm} 
            className={isDangerous ? 'btn btn-danger' : 'btn btn-primary'}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
