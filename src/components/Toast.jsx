import { useState, useCallback, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ToastContext = createContext();
export const useToast = () => useContext(ToastContext);

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const colors = {
    success: { bg: 'rgba(16,185,129,0.95)', color: '#fff', icon: '✓' },
    error: { bg: 'rgba(239,68,68,0.95)', color: '#fff', icon: '✕' },
    info: { bg: 'rgba(59,130,246,0.95)', color: '#fff', icon: 'ℹ' },
    warning: { bg: 'rgba(245,158,11,0.95)', color: '#000', icon: '⚠' },
  };

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div style={{
        position: 'fixed',
        top: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        width: 'calc(100% - 32px)',
        maxWidth: '400px',
        pointerEvents: 'none',
      }}>
        <AnimatePresence>
          {toasts.map(toast => {
            const style = colors[toast.type] || colors.info;
            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: -30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.9 }}
                transition={{ duration: 0.25 }}
                style={{
                  background: style.bg,
                  color: style.color,
                  padding: '14px 18px',
                  borderRadius: '14px',
                  fontSize: '0.95rem',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  backdropFilter: 'blur(8px)',
                  pointerEvents: 'auto',
                }}
              >
                <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{style.icon}</span>
                <span style={{ flex: 1 }}>{toast.message}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
