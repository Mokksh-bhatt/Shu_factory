import { motion, AnimatePresence } from 'framer-motion';

export default function ConfirmModal({ open, title, message, confirmText, cancelText, onConfirm, onCancel, danger = false }) {
  if (!open) return null;

  return (
    <AnimatePresence>
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, padding: '20px',
      }}>
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.85, opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            background: 'var(--surface)', borderRadius: '20px', padding: '24px',
            maxWidth: '360px', width: '100%', textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: danger ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: '1.5rem',
          }}>
            {danger ? '🗑️' : 'ℹ️'}
          </div>
          <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem', color: 'var(--on-background)' }}>{title}</h3>
          <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.9rem', lineHeight: '1.5', margin: '0 0 20px' }}>{message}</p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onCancel}
              style={{
                flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
                background: 'var(--surface-high)', color: 'var(--on-surface-variant)',
                fontWeight: 'bold', fontSize: '0.9rem',
              }}
            >
              {cancelText || 'Cancel'}
            </button>
            <button
              onClick={onConfirm}
              style={{
                flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
                background: danger ? 'var(--error)' : 'var(--primary)',
                color: 'white', fontWeight: 'bold', fontSize: '0.9rem',
              }}
            >
              {confirmText || 'Confirm'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
