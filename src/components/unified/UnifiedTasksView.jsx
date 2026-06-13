import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, MessageSquare, ClipboardList, Megaphone } from 'lucide-react';
import OwnerTasksView from '../owner/OwnerTasksView';
import OwnerChatView from '../owner/OwnerChatView';

export default function UnifiedTasksView({ onBack, t, context }) {
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' or 'tasks'
  const [chatPartner, setChatPartner] = useState(null);
  const [chatDateFilter, setChatDateFilter] = useState('all');

  const {
    workers,
    language,
    getDepartmentLabel,
    markMessagesRead,
    messages,
    lastReadTimestamp,
    currentUser,
    tasks,
    addTask,
    deleteTask,
  } = context;

  const groupedWorkers = useMemo(() => {
    return workers.reduce((acc, worker) => {
      const cat = worker.category || 'General';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(worker);
      return acc;
    }, {});
  }, [workers]);

  // Per-worker unread count and last message
  const workerUnreadInfo = useMemo(() => {
    if (!messages || !currentUser?.name) return {};
    const cleanMe = currentUser.name.toLowerCase().trim();
    const mainOwnerClean = (import.meta.env.VITE_OWNER_NAME || 'Himanshu').toLowerCase().trim();
    const isMainOwner = cleanMe === mainOwnerClean;
    const info = {};
    
    messages.forEach(msg => {
      const cleanSender = msg.sender?.toLowerCase().trim();
      const cleanTarget = msg.target?.toLowerCase().trim();
      
      if (cleanSender === cleanMe || cleanSender === 'owner' || msg.target === 'GLOBAL') return;
      
      const isTargetedToMe = cleanTarget === cleanMe ||
                             (isMainOwner && (cleanTarget === 'owner' || cleanTarget === 'admin@shonceramics.com'));
      if (!isTargetedToMe) return;

      const ts = msg.createdAt?.toMillis ? msg.createdAt.toMillis() : (msg.createdAt instanceof Date ? msg.createdAt.getTime() : 0);
      if (ts <= lastReadTimestamp) return;

      const name = msg.sender || 'Worker';
      const key = name.toLowerCase().trim();
      if (!info[key]) {
        const matchWorker = workers.find(w => w.name?.toLowerCase().trim() === key);
        info[key] = { name: matchWorker?.name || name, count: 0, lastMsg: '' };
      }
      info[key].count++;
      info[key].lastMsg = msg.text || '🎤 Voice Note';
    });

    const result = {};
    Object.keys(info).forEach(key => {
      result[info[key].name] = { count: info[key].count, lastMsg: info[key].lastMsg };
    });
    return result;
  }, [messages, currentUser?.name, lastReadTimestamp, workers]);

  if (activeTab === 'chat' && chatPartner) {
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
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px', minHeight: '100vh', background: 'var(--background)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
        <button 
          onClick={onBack}
          style={{ background: 'var(--surface-high)', color: 'var(--on-surface)', border: 'none', borderRadius: '50%', padding: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <ArrowLeft size={20} />
        </button>
        <h2 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--primary)' }}>Tasks & Communication</h2>
      </header>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
        <button 
          onClick={() => setActiveTab('chat')}
          style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: activeTab === 'chat' ? 'var(--primary)' : 'var(--surface)', color: activeTab === 'chat' ? 'white' : 'var(--on-surface)', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          <MessageSquare size={18} /> Chat
        </button>
        <button 
          onClick={() => setActiveTab('tasks')}
          style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: activeTab === 'tasks' ? 'var(--primary)' : 'var(--surface)', color: activeTab === 'tasks' ? 'white' : 'var(--on-surface)', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          <ClipboardList size={18} /> Tasks
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'tasks' && (
          <OwnerTasksView 
            workers={workers} 
            tasks={tasks} 
            addTask={addTask} 
            deleteTask={deleteTask} 
            language={language} 
            t={t} 
          />
        )}

        {activeTab === 'chat' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button onClick={() => setChatPartner('GLOBAL')} style={{ background: 'linear-gradient(135deg, #4f46e5, #6366f1)', color: 'white', border: 'none', borderRadius: '12px', padding: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', marginBottom: '16px' }}>
              <Megaphone size={20} /> {t('globalBroadcast')}
            </button>

            {Object.entries(groupedWorkers).map(([cat, list]) => {
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
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--primary-container))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '1.1rem' }}>
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
                          <div style={{ minWidth: '24px', height: '24px', background: 'var(--error)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.75rem', fontWeight: 'bold', padding: '0 6px' }}>
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
          </div>
        )}
      </div>
    </motion.div>
  );
}
