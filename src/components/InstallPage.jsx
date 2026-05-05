import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function InstallPage() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Detect if already installed
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    setIsStandalone(standalone);

    // Detect iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(ios);

    // Check if the prompt was already captured globally (from main.jsx)
    if (window.__pwaInstallPrompt) {
      setDeferredPrompt(window.__pwaInstallPrompt);
    }

    // Also listen for future events (in case it hasn't fired yet)
    const handler = (e) => {
      e.preventDefault();
      window.__pwaInstallPrompt = e;
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Listen for successful install
    const installHandler = () => setInstalled(true);
    window.addEventListener('appinstalled', installHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installHandler);
    };
  }, []);

  const handleInstall = async () => {
    const prompt = deferredPrompt || window.__pwaInstallPrompt;
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setDeferredPrompt(null);
    window.__pwaInstallPrompt = null;
  };

  const hasPrompt = deferredPrompt || window.__pwaInstallPrompt;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '24px',
        background: 'var(--background)', textAlign: 'center',
      }}
    >
      <img src="/images.jpg" alt="Shon Ceramics" style={{ width: '96px', height: '96px', borderRadius: '24px', marginBottom: '24px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }} />

      <h1 style={{ color: 'var(--primary)', fontSize: '1.6rem', margin: '0 0 8px' }}>Shon Ceramics</h1>
      <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.95rem', marginBottom: '32px', maxWidth: '320px', lineHeight: '1.5' }}>
        Install this app on your phone for instant access to tasks, chat, and notifications.
      </p>

      {isStandalone || installed ? (
        <div style={{
          background: 'rgba(34,197,94,0.15)', padding: '20px 32px', borderRadius: '16px',
          display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.05rem', fontWeight: '600',
          color: 'var(--success)',
        }}>
          ✅ App is already installed!
        </div>
      ) : isIOS ? (
        <div style={{
          background: 'var(--surface)', padding: '20px', borderRadius: '16px',
          maxWidth: '340px', width: '100%',
        }}>
          <p style={{ fontWeight: '600', fontSize: '1rem', marginBottom: '16px', color: 'var(--on-background)' }}>
            📱 Install on iPhone / iPad
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left', fontSize: '0.9rem', color: 'var(--on-surface-variant)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ background: 'var(--primary)', color: 'white', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold', flexShrink: 0 }}>1</span>
              Tap the <strong style={{ margin: '0 4px' }}>Share</strong> button (⬆) at the bottom of Safari
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ background: 'var(--primary)', color: 'white', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold', flexShrink: 0 }}>2</span>
              Scroll down and tap <strong style={{ margin: '0 4px' }}>Add to Home Screen</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ background: 'var(--primary)', color: 'white', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold', flexShrink: 0 }}>3</span>
              Tap <strong style={{ margin: '0 4px' }}>Add</strong> — done! 🎉
            </div>
          </div>
        </div>
      ) : hasPrompt ? (
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleInstall}
          style={{
            padding: '16px 48px', borderRadius: '16px', border: 'none',
            background: 'var(--primary)', color: 'white',
            fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          }}
        >
          📲 Install App
        </motion.button>
      ) : (
        <div style={{
          background: 'var(--surface)', padding: '20px', borderRadius: '16px',
          maxWidth: '340px', width: '100%', color: 'var(--on-surface-variant)', fontSize: '0.9rem', lineHeight: '1.5',
        }}>
          <p style={{ fontWeight: '600', marginBottom: '12px', color: 'var(--on-background)' }}>📱 Install on Android</p>
          <p>Open this page in <strong>Chrome</strong> and tap the <strong>"Install"</strong> banner, or tap the ⋮ menu → <strong>"Add to Home screen"</strong>.</p>
        </div>
      )}

      <a href="/" style={{ marginTop: '24px', color: 'var(--primary)', fontSize: '0.9rem', textDecoration: 'none' }}>
        ← Open Web App
      </a>
    </motion.div>
  );
}
