import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardList, MessageSquare, Megaphone, Shield, Users, BarChart2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import SettingsMenu from './SettingsMenu';

import OwnerTasksView from './owner/OwnerTasksView';
import OwnerChatView from './owner/OwnerChatView';
import OwnerSettingsView from './owner/OwnerSettingsView';
import OwnerAnalyticsView from './owner/OwnerAnalyticsView';

export default function OwnerDashboard() {
  const [error, setError] = useState(null);
  const context = useAppContext();

  if (error) {
    return (
      <div style={{ padding: '20px', color: 'var(--error)', background: 'var(--background)', height: '100vh', overflow: 'auto' }}>
        <h2>⚠️ Dashboard Error</h2>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', background: '#222', padding: '10px', borderRadius: '8px' }}>
          {error.stack}
        </pre>
        <button className="btn-primary" onClick={() => setError(null)}>Retry</button>
      </div>
    );
  }

  try {
    return <OwnerDashboardContent {...context} />;
  } catch (err) {
    setError(err);
    return null;
  }
}

function OwnerDashboardContent(context) {
  const {
    workers,
    language,
    setLanguage,
    languageOptions,
    t,
    getDepartmentLabel,
    notificationsEnabled,
    setNotificationsEnabled,
    logout,
    unreadCount,
    markMessagesRead,
    ownerNotifPrefs,
    setOwnerNotifPrefs,
    messages,
    lastReadTimestamp
  } = context;

  const [view, setView] = useState('tasks');
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [chatPartner, setChatPartner] = useState(null);
  const [chatDateFilter, setChatDateFilter] = useState('all');

  const groupedWorkers = useMemo(() => {
    return workers.reduce((acc, worker) => {
      const cat = worker.category || 'General';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(worker);
      return acc;
    }, {});
  }, [workers]);

  const pendingTasksCount = context.tasks?.filter(t => t.status === 'PENDING').length || 0;

  // Per-worker unread count and last message
  const workerUnreadInfo = useMemo(() => {
    if (!messages) return {};
    const info = {};
    messages.forEach(msg => {
      if (msg.sender === 'owner' || msg.target === 'GLOBAL') return;
      if (msg.target !== 'owner') return;
      const ts = msg.createdAt?.toMillis ? msg.createdAt.toMillis() : (msg.createdAt instanceof Date ? msg.createdAt.getTime() : 0);
      if (ts <= lastReadTimestamp) return;
      const name = msg.sender;
      if (!info[name]) info[name] = { count: 0, lastMsg: '' };
      info[name].count++;
      info[name].lastMsg = msg.text || '🎤 Voice Note';
    });
    return info;
  }, [messages, lastReadTimestamp]);

  useEffect(() => {
    if (!notificationsEnabled) {
      const timer = setTimeout(() => setShowNotificationModal(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [notificationsEnabled]);

  if (view === 'chat' && chatPartner) {
    return (
      <OwnerChatView 
        partner={chatPartner} 
        onBack={() => setChatPartner(null)} 
        dateFilter={chatDateFilter} 
        setDateFilter={setChatDateFilter} 
        t={t} 
        language={language} 
      />
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '20px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', position: 'relative' }}>
        <div>
          <h2 style={{ color: 'var(--primary)', margin: 0, fontSize: '1.4rem' }}>{t('appName')}</h2>
          <span style={{ color: 'var(--on-surface-variant)', fontSize: '0.9rem' }}>{t('adminDashboard')}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setView('analytics')}
            style={{
              background: view === 'analytics' ? 'var(--surface-high)' : 'transparent',
              color: view === 'analytics' ? 'var(--primary)' : 'var(--on-surface-variant)',
              border: 'none',
              borderRadius: '50%',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.2s ease',
            }}
            aria-label="Analytics"
          >
            <BarChart2 size={24} />
          </button>
          <SettingsMenu
            t={t}
            language={language}
            languageOptions={languageOptions}
            setLanguage={setLanguage}
            notificationsEnabled={notificationsEnabled}
            setNotificationsEnabled={setNotificationsEnabled}
            logout={logout}
            isOwner={true}
            ownerNotifPrefs={ownerNotifPrefs}
            setOwnerNotifPrefs={setOwnerNotifPrefs}
          />
        </div>
      </header>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setView('tasks')}
          style={{
            flex: '1 1 calc(33.33% - 6px)',
            minWidth: '100px',
            padding: '14px 12px',
            borderRadius: '12px',
            border: 'none',
            fontWeight: 'bold',
            background: view === 'tasks' ? 'var(--primary)' : 'var(--surface-high)',
            color: view === 'tasks' ? 'var(--on-primary)' : 'var(--on-surface-variant)',
            display: 'flex',
            gap: '6px',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative'
          }}
        >
          <ClipboardList size={18} /> {t('tasks')}
          {pendingTasksCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '4px',
              right: '8px',
              width: '16px',
              height: '16px',
              background: 'var(--error)',
              color: 'white',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.6rem',
              fontWeight: 'bold',
            }}>
              {pendingTasksCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setView('admin')}
          style={{
            flex: '1 1 calc(33.33% - 6px)',
            minWidth: '100px',
            padding: '14px 12px',
            borderRadius: '12px',
            border: 'none',
            fontWeight: 'bold',
            background: view === 'admin' || view === 'settings' ? 'var(--primary)' : 'var(--surface-high)',
            color: view === 'admin' || view === 'settings' ? 'var(--on-primary)' : 'var(--on-surface-variant)',
            display: 'flex',
            gap: '6px',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Shield size={18} /> {t('admin')}
        </button>
        <button
          onClick={() => { setView('chat'); setChatPartner(null); }}
          style={{
            flex: '1 1 calc(33.33% - 6px)',
            minWidth: '100px',
            padding: '14px 12px',
            borderRadius: '12px',
            border: 'none',
            fontWeight: 'bold',
            background: view === 'chat' ? 'var(--primary)' : 'var(--surface-high)',
            color: view === 'chat' ? 'var(--on-primary)' : 'var(--on-surface-variant)',
            display: 'flex',
            gap: '6px',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative'
          }}
        >
          <MessageSquare size={18} />
          {t('chat')}
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '4px',
              right: '8px',
              width: '16px',
              height: '16px',
              background: 'var(--error)',
              color: 'white',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.6rem',
              fontWeight: 'bold',
            }}>
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Admin button moved to primary flex row */}

      {view === 'tasks' && (
        <OwnerTasksView 
          workers={workers} 
          tasks={context.tasks} 
          addTask={context.addTask} 
          deleteTask={context.deleteTask} 
          language={language} 
          t={t} 
        />
      )}

      {view === 'analytics' && (
        <OwnerAnalyticsView 
          tasks={context.tasks}
          workers={workers}
          departments={context.departments}
          getDepartmentLabel={getDepartmentLabel}
          t={t}
        />
      )}

      {view === 'chat' && !chatPartner && (
        <>
          <button onClick={() => setChatPartner('GLOBAL')} className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px', width: '100%' }}>
            <Megaphone size={20} /> {t('globalBroadcast')}
          </button>

          {Object.entries(groupedWorkers).map(([cat, list]) => {
            // Sort workers with unread messages to top
            const sorted = [...list].sort((a, b) => {
              const aUnread = workerUnreadInfo[a.name]?.count || 0;
              const bUnread = workerUnreadInfo[b.name]?.count || 0;
              return bUnread - aUnread;
            });
            return (
            <section key={cat}>
              <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--on-surface-variant)', margin: '12px 0 8px' }}>
                {getDepartmentLabel(cat)}
              </h4>
              {sorted.map((worker) => {
                const unread = workerUnreadInfo[worker.name];
                return (
                <button
                  key={worker.id}
                  onClick={() => { setChatPartner(worker.name); markMessagesRead(); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    width: '100%',
                    padding: '14px 16px',
                    borderRadius: '12px',
                    border: unread ? '1px solid var(--primary)' : 'none',
                    background: unread ? 'rgba(110,155,255,0.06)' : 'var(--surface)',
                    marginBottom: '8px',
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--primary), var(--primary-container))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 'bold',
                      fontSize: '1.1rem',
                    }}
                  >
                    {worker.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'var(--on-background)', fontWeight: '600', fontSize: '1rem' }}>{worker.name}</div>
                    {unread ? (
                      <div style={{ color: 'var(--primary)', fontSize: '0.8rem', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {unread.lastMsg.slice(0, 40)}{unread.lastMsg.length > 40 ? '...' : ''}
                      </div>
                    ) : (
                      <div style={{ color: 'var(--on-surface-variant)', fontSize: '0.8rem' }}>{getDepartmentLabel(worker.category)}</div>
                    )}
                  </div>
                  {unread && (
                    <div style={{
                      minWidth: '24px', height: '24px', background: 'var(--error)',
                      borderRadius: '12px', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', color: 'white', fontSize: '0.75rem',
                      fontWeight: 'bold', padding: '0 6px',
                    }}>
                      {unread.count}
                    </div>
                  )}
                </button>
                );
              })}
            </section>
            );
          })}

          {workers.length === 0 && <p style={{ color: 'var(--on-surface-variant)', textAlign: 'center', marginTop: '20px' }}>{t('noWorkersYet')}</p>}
        </>
      )}

      {(view === 'admin' || view === 'settings') && (
        <OwnerSettingsView
          initialTab={view === 'settings' ? 'config' : 'workers'}
          {...context}
        />
      )}

      {/* Notification Modal */}
      <AnimatePresence>
        {showNotificationModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{ background: 'var(--surface)', borderRadius: '24px', padding: '24px', maxWidth: '400px', width: '100%', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}
            >
              <div style={{ width: '64px', height: '64px', background: 'var(--primary-container)', color: 'var(--primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Megaphone size={32} />
              </div>
              <h3 style={{ margin: '0 0 12px' }}>{t('enableNotifications')}</h3>
              <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '24px' }}>
                {t('notificationPromptText')}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button className="btn-primary" style={{ padding: '14px' }} onClick={() => { setNotificationsEnabled(true); setShowNotificationModal(false); }}>
                  {t('allow')}
                </button>
                <button style={{ background: 'none', border: 'none', color: 'var(--on-surface-variant)', padding: '10px' }} onClick={() => setShowNotificationModal(false)}>
                  {t('maybeLater')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
