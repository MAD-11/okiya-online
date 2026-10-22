import React from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ open, title, message, onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <div style={styles.overlay}>
      <div style={styles.dialog}>
        <h3 style={styles.title}>{title}</h3>
        <p style={styles.message}>{message}</p>
        <div style={styles.buttons}>
          <button onClick={onCancel} style={styles.cancelBtn}>Отмена</button>
          <button onClick={onConfirm} style={styles.confirmBtn}>Выйти</button>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'var(--overlay)',
    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 3000,
  },
  dialog: {
    background: 'var(--modal-bg)',
    padding: '28px',
    borderRadius: '20px',
    maxWidth: '340px', width: '90%',
    textAlign: 'center',
    border: '1px solid var(--border)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
  },
  title: { margin: '0 0 12px', fontSize: '20px', color: 'var(--text)', fontWeight: 600 },
  message: { margin: '0 0 24px', fontSize: '14px', color: 'var(--secondary-text)', lineHeight: 1.5 },
  buttons: { display: 'flex', gap: '12px', justifyContent: 'center' },
  cancelBtn: {
    padding: '10px 24px',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text)',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s',
  },
  confirmBtn: {
    padding: '10px 24px',
    borderRadius: '12px',
    border: 'none',
    background: 'var(--btn-bg)',
    color: 'var(--btn-text)',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '14px',
    boxShadow: '0 4px 20px rgba(232,165,192,0.3)',
    transition: 'all 0.2s',
  },
};

export default ConfirmDialog;