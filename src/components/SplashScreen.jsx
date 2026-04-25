import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import logo from '../1654269855758.jpg';
import { useAppContext } from '../context/AppContext';

export default function SplashScreen({ onFinish }) {
  const [fadeOut, setFadeOut] = useState(false);
  const { t } = useAppContext();

  useEffect(() => {
    const timer = setTimeout(() => setFadeOut(true), 800);
    const end = setTimeout(() => onFinish(), 1200);
    return () => { clearTimeout(timer); clearTimeout(end); };
  }, [onFinish]);

  return (
    <AnimatePresence>
      {!fadeOut && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'linear-gradient(160deg, #0a2e14 0%, #0f0f11 40%, #0f0f11 60%, #1a0a02 100%)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <motion.img 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            src={logo} 
            alt={t('appName')} 
            style={{
              width: '200px', height: 'auto',
              borderRadius: '16px',
              marginBottom: '24px',
            }}
          />

          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 0.7, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            style={{
              color: '#028a3f', fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '1rem', letterSpacing: '4px', textTransform: 'uppercase',
            }}
          >
            {t('appName')}
          </motion.p>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            style={{
              marginTop: '40px', width: '48px', height: '48px',
              border: '3px solid rgba(2,138,63,0.15)',
              borderTopColor: '#028a3f',
              borderRadius: '50%',
              animation: 'splashSpin 0.8s linear infinite',
            }}
          />

          <style>{`
            @keyframes splashSpin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
