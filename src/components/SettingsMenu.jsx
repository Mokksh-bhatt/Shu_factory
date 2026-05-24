import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Globe, Bell, LogOut } from 'lucide-react';

export default function SettingsMenu({
  t,
  language,
  languageOptions,
  setLanguage,
  notificationsEnabled,
  setNotificationsEnabled,
  logout,
  isOwner,
  ownerNotifPrefs,
  setOwnerNotifPrefs,
  currentUser,
}) {
  const [open, setOpen] = useState(false);
  const [showLang, setShowLang] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState({ id: 'Checking...', status: 'Unknown', name: '...' });
  const menuRef = useRef(null);

  useEffect(() => {
    if (open) {
      const checkOS = async () => {
        try {
          const os = window.plugins?.OneSignal || window.OneSignal;
          if (!os) {
            setDebugInfo(prev => ({ ...prev, status: 'Not Found' }));
            return;
          }
          
          let subId = 'No ID';
          if (os.User?.pushSubscription?.id) {
            subId = os.User.pushSubscription.id;
          } else if (os.getUserId) {
            subId = await new Promise(r => os.getUserId(r)) || 'Pending';
          }
          
          setDebugInfo({
            id: subId,
            status: 'Initialized',
            name: currentUser?.name?.toLowerCase().trim() || '...',
            role: isOwner ? 'owner' : 'worker'
          });
        } catch (e) {
          setDebugInfo(prev => ({ ...prev, status: 'Error' }));
        }
      };
      checkOS();
      const int = setInterval(checkOS, 5000);
      return () => clearInterval(int);
    }
  }, [open, currentUser, isOwner]);

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
        setShowLang(false);
        setShowPrefs(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLangSelect = (lang) => {
    setLanguage(lang);
    setShowLang(false);
    setOpen(false);
  };

  const handleLogout = () => {
    setOpen(false);
    logout();
  };

  return (
    <div style={{ position: 'relative' }} ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: open ? 'var(--surface-high)' : 'transparent',
          border: 'none',
          borderRadius: '50%',
          padding: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--on-surface-variant)',
          cursor: 'pointer',
          transition: 'background 0.2s ease',
        }}
        aria-label="Settings"
      >
        <Settings size={24} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              background: 'var(--surface)',
              borderRadius: '16px',
              padding: '8px',
              minWidth: '240px',
              zIndex: 500,
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              border: '1px solid var(--surface-high)',
            }}
          >
            <button
              onClick={() => setShowLang(!showLang)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: '10px',
                border: 'none',
                background: 'transparent',
                color: 'var(--on-background)',
                fontSize: '0.95rem',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <Globe size={20} color="var(--primary)" />
              <span style={{ flex: 1 }}>{t('language') || 'Language'}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)' }}>
                {languageOptions.find((l) => l.value === language)?.label}
              </span>
            </button>

            <AnimatePresence>
              {showLang && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  style={{ overflow: 'hidden', marginBottom: '4px' }}
                >
                  {languageOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleLangSelect(opt.value)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 14px 10px 46px',
                        borderRadius: '8px',
                        border: 'none',
                        background: language === opt.value ? 'var(--primary-container)' : 'transparent',
                        color: language === opt.value ? 'var(--primary)' : 'var(--on-background)',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontWeight: language === opt.value ? 'bold' : 'normal',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <div style={{ height: '1px', background: 'var(--surface-high)', margin: '4px 0' }} />

            <button
              onClick={async () => {
                if (!notificationsEnabled) {
                  try {
                    if (window.OneSignal) {
                      await window.OneSignal.Notifications.requestPermission();
                    } else if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
                      await Notification.requestPermission();
                    }
                  } catch (e) { /* ignore */ }
                  setNotificationsEnabled(true);
                } else {
                  setNotificationsEnabled(false);
                }
                setOpen(false);
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: '10px',
                border: 'none',
                background: 'transparent',
                color: 'var(--on-background)',
                fontSize: '0.95rem',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <Bell size={20} color="var(--primary)" />
              <span style={{ flex: 1 }}>{t('notifications') || 'Notifications'}</span>
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  background: notificationsEnabled ? 'var(--success)' : 'var(--surface-high)',
                  color: notificationsEnabled ? '#000' : 'var(--on-surface-variant)',
                  fontWeight: 'bold',
                }}
              >
                {notificationsEnabled ? (t('on') || 'ON') : (t('off') || 'OFF')}
              </span>
            </button>

            {isOwner && ownerNotifPrefs && (
              <>
                <div style={{ height: '1px', background: 'var(--surface-high)', margin: '4px 0' }} />
                <button
                  onClick={() => setShowPrefs(!showPrefs)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 14px', borderRadius: '10px', border: 'none',
                    background: 'transparent', color: 'var(--on-background)',
                    fontSize: '0.95rem', cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <Bell size={20} color="var(--primary)" />
                  <span style={{ flex: 1 }}>Owner Preferences</span>
                </button>
                <AnimatePresence>
                  {showPrefs && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      style={{ overflow: 'hidden', marginBottom: '4px', paddingLeft: '12px' }}
                    >
                      {[
                        { key: 'chatMessages', label: '💬 Chat Messages' },
                        { key: 'taskReminders', label: '⏰ Task Reminders' },
                        { key: 'taskCompletions', label: '✅ Task Completions' },
                      ].map(item => (
                        <div key={item.key} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '8px 14px', borderRadius: '8px', background: 'transparent',
                        }}>
                          <span style={{ fontSize: '0.85rem', color: 'var(--on-background)' }}>{item.label}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const updated = { ...ownerNotifPrefs, [item.key]: !ownerNotifPrefs[item.key] };
                              setOwnerNotifPrefs(updated);
                            }}
                            style={{
                              width: '36px', height: '20px', borderRadius: '10px', border: 'none',
                              background: ownerNotifPrefs[item.key] ? 'var(--primary)' : 'var(--surface-high)',
                              position: 'relative', transition: 'background 0.2s', cursor: 'pointer',
                            }}
                          >
                            <div style={{
                              width: '16px', height: '16px', borderRadius: '50%', background: 'white',
                              position: 'absolute', top: '2px',
                              left: ownerNotifPrefs[item.key] ? '18px' : '2px',
                              transition: 'left 0.2s ease',
                              boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                            }} />
                          </button>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}



            <div style={{ height: '1px', background: 'var(--surface-high)', margin: '4px 0' }} />

            <button
              onClick={handleLogout}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: '10px',
                border: 'none',
                background: 'transparent',
                color: 'var(--error)',
                fontSize: '0.95rem',
                cursor: 'pointer',
                textAlign: 'left',
                fontWeight: '600',
              }}
            >
              <LogOut size={20} />
              {t('logout') || 'Logout'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}