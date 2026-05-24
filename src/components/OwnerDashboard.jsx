import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardList, MessageSquare, Megaphone, Shield, Users, BarChart2, Factory } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import SettingsMenu from './SettingsMenu';

import OwnerTasksView from './owner/OwnerTasksView';
import OwnerChatView from './owner/OwnerChatView';
import OwnerSettingsView from './owner/OwnerSettingsView';
import OwnerAnalyticsView from './owner/OwnerAnalyticsView';

import ErrorBoundary from './ErrorBoundary';
import OwnerProductionView from './owner/OwnerProductionView';

export default function OwnerDashboard() {
  const context = useAppContext();

  return (
    <ErrorBoundary>
      <OwnerDashboardContentWrapper context={context} />
    </ErrorBoundary>
  );
}

function OwnerDashboardContentWrapper({ context }) {
  if (!context || !context.currentUser) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center', 
        minHeight: '100vh', 
        background: 'var(--background)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--on-surface-variant)'
      }}>
        Initializing Owner Profile...
      </div>
    );
  }

  return <OwnerDashboardContent {...context} />;
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
    lastReadTimestamp,
    currentUser,
    tasks,
    departments,
    addTask,
    deleteTask,
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
    if (!messages || !context.currentUser?.name) return {};
    const cleanMe = context.currentUser.name.toLowerCase().trim();
    const mainOwnerClean = (import.meta.env.VITE_OWNER_NAME || 'Himanshu').toLowerCase().trim();
    const isMainOwner = cleanMe === mainOwnerClean;
    const info = {};
    
    messages.forEach(msg => {
      const cleanSender = msg.sender?.toLowerCase().trim();
      const cleanTarget = msg.target?.toLowerCase().trim();
      
      // Skip messages sent by me, or global messages, or legacy owner senders (which is me)
      if (cleanSender === cleanMe || cleanSender === 'owner' || msg.target === 'GLOBAL') return;
      
      // Accept messages targeting this admin; legacy 'owner' targets only count for main owner
      const isTargetedToMe = cleanTarget === cleanMe ||
                             (isMainOwner && (cleanTarget === 'owner' || cleanTarget === 'admin@shonceramics.com'));
      if (!isTargetedToMe) return;

      const ts = msg.createdAt?.toMillis ? msg.createdAt.toMillis() : (msg.createdAt instanceof Date ? msg.createdAt.getTime() : 0);
      if (ts <= lastReadTimestamp) return;

      // Group by sender's original case-insensitive display name
      const name = msg.sender || 'Worker';
      const key = name.toLowerCase().trim();
      if (!info[key]) {
        // Find existing worker with this key to preserve the exact display name
        const matchWorker = workers.find(w => w.name?.toLowerCase().trim() === key);
        info[key] = { name: matchWorker?.name || name, count: 0, lastMsg: '' };
      }
      info[key].count++;
      info[key].lastMsg = msg.text || '🎤 Voice Note';
    });

    // Remap from keys back to the specific names used by workers list
    const result = {};
    Object.keys(info).forEach(key => {
      result[info[key].name] = { count: info[key].count, lastMsg: info[key].lastMsg };
    });
    return result;
  }, [messages, context.currentUser?.name, lastReadTimestamp, workers]);

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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '90px', minHeight: '100vh' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', position: 'relative' }}>
        <div>
          <h2 style={{ color: 'var(--primary)', margin: 0, fontSize: '1.4rem' }}>{t('appName')}</h2>
          <span style={{ color: 'var(--on-surface-variant)', fontSize: '0.9rem' }}>{currentUser?.name} — {t('adminDashboard')}</span>
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
            currentUser={currentUser}
          />
        </div>
      </header>

      {/* Navigation moved to bottom bar */}

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

      {view === 'production' && (
        <OwnerProductionView t={t} />
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

      {/* Bottom Navigation Bar */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'rgba(var(--surface-rgb, 20, 20, 20), 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        justifyContent: 'space-around',
        padding: '12px 10px calc(12px + env(safe-area-inset-bottom))',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.15)',
        zIndex: 1000,
        borderTop: '1px solid rgba(255,255,255,0.05)',
        borderTopLeftRadius: '24px',
        borderTopRightRadius: '24px'
      }}>
        <button
          onClick={() => setView('tasks')}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
            border: 'none', background: 'none', cursor: 'pointer', position: 'relative',
            color: view === 'tasks' ? 'var(--primary)' : 'var(--on-surface-variant)',
            transition: 'color 0.2s'
          }}
        >
          <div style={{
            padding: '8px 16px', borderRadius: '16px',
            background: view === 'tasks' ? 'rgba(110,155,255,0.15)' : 'transparent',
            transition: 'background 0.2s'
          }}>
            <ClipboardList size={22} strokeWidth={view === 'tasks' ? 2.5 : 2} />
          </div>
          <span style={{ fontSize: '0.7rem', fontWeight: view === 'tasks' ? 'bold' : 'normal' }}>{t('tasks')}</span>
          {pendingTasksCount > 0 && (
            <span style={{
              position: 'absolute', top: '-2px', right: 'calc(50% - 20px)', width: '18px', height: '18px',
              background: 'var(--error)', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '0.65rem', fontWeight: 'bold', border: '2px solid var(--surface)'
            }}>
              {pendingTasksCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setView('admin')}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
            border: 'none', background: 'none', cursor: 'pointer',
            color: (view === 'admin' || view === 'settings') ? 'var(--primary)' : 'var(--on-surface-variant)',
            transition: 'color 0.2s'
          }}
        >
          <div style={{
            padding: '8px 16px', borderRadius: '16px',
            background: (view === 'admin' || view === 'settings') ? 'rgba(110,155,255,0.15)' : 'transparent',
            transition: 'background 0.2s'
          }}>
            <Shield size={22} strokeWidth={(view === 'admin' || view === 'settings') ? 2.5 : 2} />
          </div>
          <span style={{ fontSize: '0.7rem', fontWeight: (view === 'admin' || view === 'settings') ? 'bold' : 'normal' }}>{t('admin')}</span>
        </button>

        <button
          onClick={() => setView('production')}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
            border: 'none', background: 'none', cursor: 'pointer',
            color: view === 'production' ? '#6366f1' : 'var(--on-surface-variant)',
            transition: 'color 0.2s'
          }}
        >
          <div style={{
            padding: '8px 16px', borderRadius: '16px',
            background: view === 'production' ? 'rgba(99,102,241,0.15)' : 'transparent',
            transition: 'background 0.2s'
          }}>
            <Factory size={22} strokeWidth={view === 'production' ? 2.5 : 2} />
          </div>
          <span style={{ fontSize: '0.7rem', fontWeight: view === 'production' ? 'bold' : 'normal' }}>Production</span>
        </button>

        <button
          onClick={() => { setView('chat'); setChatPartner(null); }}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
            border: 'none', background: 'none', cursor: 'pointer', position: 'relative',
            color: view === 'chat' ? 'var(--primary)' : 'var(--on-surface-variant)',
            transition: 'color 0.2s'
          }}
        >
          <div style={{
            padding: '8px 16px', borderRadius: '16px',
            background: view === 'chat' ? 'rgba(110,155,255,0.15)' : 'transparent',
            transition: 'background 0.2s'
          }}>
            <MessageSquare size={22} strokeWidth={view === 'chat' ? 2.5 : 2} />
          </div>
          <span style={{ fontSize: '0.7rem', fontWeight: view === 'chat' ? 'bold' : 'normal' }}>{t('chat')}</span>
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: '-2px', right: 'calc(50% - 20px)', width: '18px', height: '18px',
              background: 'var(--error)', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '0.65rem', fontWeight: 'bold', border: '2px solid var(--surface)'
            }}>
              {unreadCount}
            </span>
          )}
        </button>
      </div>
    </motion.div>
  );
}
