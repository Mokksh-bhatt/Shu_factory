import { useMemo, useState, useEffect, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardList, MessageSquare, ChevronLeft, Megaphone, Settings, HardHat, Shield, Users, Send } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import VoiceInput from './VoiceInput';
import { formatTime } from '../utils/formatTime';
import { isInDateRange, groupByDate, formatDateMarker } from '../utils/dateUtils';

function ChatView({ partner, onBack, dateFilter, setDateFilter, t, language }) {
  const { getConversation, sendMessage, setActiveChat } = useAppContext();

  const convo = useMemo(() => getConversation(partner), [getConversation, partner]);

  useEffect(() => {
    setActiveChat(partner);
    return () => setActiveChat(null);
  }, [partner, setActiveChat]);

  const filtered = useMemo(() => convo.filter((msg) => isInDateRange(msg.createdAt, dateFilter)), [convo, dateFilter]);
  const groups = useMemo(() => groupByDate(filtered, (msg) => msg.createdAt), [filtered]);

  const handleSendMessage = async (text) => {
    try {
      await sendMessage('owner', partner, text);
    } catch (err) {
      alert(err.message || t('somethingWentWrong'));
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 40px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid var(--surface-high)', marginBottom: '10px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--on-surface-variant)', padding: '4px' }}>
          <ChevronLeft size={28} />
        </button>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{partner === 'GLOBAL' ? t('globalBroadcast') : t('chatWith', { name: partner })}</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)' }}>{partner === 'GLOBAL' ? t('everyoneSeesThis') : t('personalChat')}</span>
        </div>
      </div>

      <div className="filter-row" style={{ marginBottom: '10px' }}>
        <label>{t('filterDate')}</label>
        <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
          <option value="all">{t('dateAll')}</option>
          <option value="today">{t('dateToday')}</option>
          <option value="7d">{t('date7d')}</option>
          <option value="30d">{t('date30d')}</option>
        </select>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingBottom: '10px' }}>
        {filtered.length === 0 && <p style={{ color: 'var(--on-surface-variant)', textAlign: 'center', marginTop: '40px' }}>{t('noMessagesYet')}</p>}
        {groups.map((group) => (
          <div key={group.key}>
            <div style={{ margin: '8px 0', fontSize: '0.75rem', color: 'var(--on-surface-variant)', textAlign: 'center' }}>
              {formatDateMarker(group.value, language, t)}
            </div>
            {group.items.map((msg) => (
              <div
                key={msg.id}
                style={{
                  alignSelf: msg.sender === 'owner' ? 'flex-end' : 'flex-start',
                  marginLeft: msg.sender === 'owner' ? 'auto' : 0,
                  background: msg.sender === 'owner' ? 'var(--primary)' : 'var(--surface-high)',
                  color: msg.sender === 'owner' ? 'var(--on-primary)' : 'var(--on-background)',
                  padding: '8px 14px',
                  borderRadius: '16px',
                  maxWidth: '85%',
                  fontSize: '0.95rem',
                  marginBottom: '6px',
                }}
              >
                <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                  {msg.sender} - {formatTime(msg.createdAt, language)}
                </div>
                {msg.text}
              </div>
            ))}
          </div>
        ))}
      </div>

      <VoiceInput onSubmit={handleSendMessage} placeholder={t('messageWithName', { name: partner })} />
    </motion.div>
  );
}

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

function OwnerDashboardContent({
  currentUser,
  tasks,
  workers,
  addTask,
  logout,
  updateWorker,
  deleteWorker,
  deleteTask,
  createWorkerAccount,
  updateWorkerPassword,
  language,
  setLanguage,
  languageOptions,
  t,
  departments,
  getDepartmentLabel,
  notificationsEnabled,
  setNotificationsEnabled,
  unreadCount,
  markMessagesRead,
  getConversation,
  sendMessage,
  setActiveChat
}) {

  const [view, setView] = useState('tasks');
  const [activeSettingsTab, setActiveSettingsTab] = useState('config');
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [chatPartner, setChatPartner] = useState(null);
  const [targetWorker, setTargetWorker] = useState('');

  const [taskDateFilter, setTaskDateFilter] = useState('all');
  const [taskStatusFilter, setTaskStatusFilter] = useState('all');
  const [taskWorkerFilter, setTaskWorkerFilter] = useState('all');
  const [chatDateFilter, setChatDateFilter] = useState('all');

  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerPassword, setNewWorkerPassword] = useState('');
  const [newWorkerDept, setNewWorkerDept] = useState('General');
  const [createdCreds, setCreatedCreds] = useState(null);
  const [passwordDrafts, setPasswordDrafts] = useState({});

  const groupedWorkers = useMemo(() => {
    return workers.reduce((acc, worker) => {
      const cat = worker.category || 'General';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(worker);
      return acc;
    }, {});
  }, [workers]);

  const visibleTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (taskWorkerFilter !== 'all' && task.workerName !== taskWorkerFilter) return false;
      if (taskStatusFilter !== 'all' && task.status !== taskStatusFilter) return false;
      if (!isInDateRange(task.createdAt, taskDateFilter)) return false;
      return true;
    });
  }, [tasks, taskWorkerFilter, taskStatusFilter, taskDateFilter]);

  const taskGroups = useMemo(() => groupByDate(visibleTasks, (task) => task.createdAt), [visibleTasks]);

  const handleAssignTask = async (text) => {
    if (!targetWorker) {
      alert(t('selectWorkerFirst'));
      return;
    }
    try {
      await addTask(text, targetWorker);
    } catch (err) {
      alert(err.message || t('somethingWentWrong'));
    }
  };

  const handleCreateWorker = async () => {
    try {
      const created = await createWorkerAccount({
        name: newWorkerName,
        password: newWorkerPassword,
        category: newWorkerDept,
      });
      setCreatedCreds(created);
      setNewWorkerName('');
      setNewWorkerPassword('');
      setNewWorkerDept('General');
      alert(t('workerCreated'));
    } catch (err) {
      alert(err.message || t('somethingWentWrong'));
    }
  };

  const copyCredentials = async () => {
    if (!createdCreds) return;
    const text = `${t('labelName')}: ${createdCreds.name}\n${t('labelPassword')}: ${createdCreds.password}\n${t('department')}: ${createdCreds.category}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      alert(text);
    }
  };

  const handlePasswordUpdate = async (workerId) => {
    const next = (passwordDrafts[workerId] || '').trim();
    try {
      await updateWorkerPassword(workerId, next);
      setPasswordDrafts((prev) => ({ ...prev, [workerId]: '' }));
      alert(t('workerPasswordUpdated'));
    } catch (err) {
      alert(err.message || t('somethingWentWrong'));
    }
  };

  const handleDeleteWorker = async (workerId, name) => {
    if (!window.confirm(t('deleteWorkerConfirm', { name }))) return;
    try {
      await deleteWorker(workerId);
    } catch (err) {
      alert(err.message || t('somethingWentWrong'));
    }
  };

  useEffect(() => {
    // Show notification modal if not enabled and owner
    if (!notificationsEnabled) {
      const timer = setTimeout(() => setShowNotificationModal(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [notificationsEnabled]);

  if (view === 'chat' && chatPartner) {
    return <ChatView partner={chatPartner} onBack={() => setView('contacts')} dateFilter={chatDateFilter} setDateFilter={setChatDateFilter} t={t} language={language} />;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '20px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ color: 'var(--primary)', margin: 0, fontSize: '1.4rem' }}>{t('appName')}</h2>
          <span style={{ color: 'var(--on-surface-variant)', fontSize: '0.9rem' }}>{t('adminDashboard')}</span>
        </div>
        <button
          onClick={() => setView(view === 'settings' ? 'tasks' : 'settings')}
          style={{
            background: 'var(--primary)',
            border: 'none',
            borderRadius: '50%',
            width: '48px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white'
          }}
        >
          <Settings size={24} />
        </button>
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
          }}
        >
          <ClipboardList size={18} /> {t('tasks')}
        </button>
        <button
          onClick={() => setView('contacts')}
          style={{
            flex: '1 1 calc(33.33% - 6px)',
            minWidth: '100px',
            padding: '14px 12px',
            borderRadius: '12px',
            border: 'none',
            fontWeight: 'bold',
            background: view === 'contacts' ? 'var(--primary)' : 'var(--surface-high)',
            color: view === 'contacts' ? 'var(--on-primary)' : 'var(--on-surface-variant)',
            display: 'flex',
            gap: '6px',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Users size={18} /> {t('workers')}
        </button>
        <button
          onClick={() => { setView('chat'); setChatPartner(null); markMessagesRead(); }}
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

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => setView('admin')}
          style={{
            flex: 1,
            padding: '14px 12px',
            borderRadius: '12px',
            border: 'none',
            fontWeight: 'bold',
            background: view === 'admin' ? 'var(--primary)' : 'var(--surface-high)',
            color: view === 'admin' ? 'var(--on-primary)' : 'var(--on-surface-variant)',
            display: 'flex',
            gap: '6px',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Shield size={18} /> {t('admin')}
        </button>
      </div>

      {view === 'tasks' && (
        <>
          <section style={{ background: 'var(--surface)', borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: 'var(--primary)' }}>{t('allotTask')}</h3>
            <div style={{ display: 'flex', overflowX: 'auto', gap: '8px', paddingBottom: '8px', scrollbarWidth: 'none' }}>
              {workers.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setTargetWorker(w.name === targetWorker ? '' : w.name)}
                  style={{
                    flexShrink: 0,
                    padding: '10px 18px',
                    borderRadius: '24px',
                    border: targetWorker === w.name ? 'none' : '1px solid var(--primary)',
                    background: targetWorker === w.name ? 'var(--primary)' : 'transparent',
                    color: targetWorker === w.name ? 'var(--on-primary)' : 'var(--primary)',
                    fontSize: '0.9rem',
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {w.name}
                </button>
              ))}
            </div>
            <VoiceInput
              onSubmit={handleAssignTask}
              placeholder={targetWorker ? `${t('taskFor')} ${targetWorker}...` : t('selectWorkerFirst')}
            />
          </section>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <select value={taskWorkerFilter} onChange={(e) => setTaskWorkerFilter(e.target.value)} style={{ flex: 1, minWidth: '100px', padding: '8px 12px' }}>
              <option value="all">{t('allWorkers')}</option>
              {workers.map((worker) => (
                <option key={worker.id} value={worker.name}>{worker.name}</option>
              ))}
            </select>
            <select value={taskStatusFilter} onChange={(e) => setTaskStatusFilter(e.target.value)} style={{ flex: 1, minWidth: '100px', padding: '8px 12px' }}>
              <option value="all">{t('statusAll')}</option>
              <option value="PENDING">{t('pending')}</option>
              <option value="DONE">{t('done')}</option>
            </select>
            <select value={taskDateFilter} onChange={(e) => setTaskDateFilter(e.target.value)} style={{ flex: 1, minWidth: '100px', padding: '8px 12px' }}>
              <option value="all">{t('dateAll')}</option>
              <option value="today">{t('dateToday')}</option>
              <option value="7d">{t('date7d')}</option>
              <option value="30d">{t('date30d')}</option>
            </select>
          </div>

          <h3 style={{ fontSize: '0.85rem', color: 'var(--on-surface-variant)', marginBottom: '12px' }}>
            {taskWorkerFilter === 'all' ? t('allTasks') : taskWorkerFilter} ({visibleTasks.length})
          </h3>

          {visibleTasks.length === 0 && <p style={{ color: 'var(--on-surface-variant)', textAlign: 'center', padding: '20px' }}>{t('noTasksFound')}</p>}

          {taskGroups.map((group) => (
            <div key={group.key}>
              <div style={{ margin: '12px 0 8px', fontSize: '0.7rem', color: 'var(--on-surface-variant)', textTransform: 'uppercase' }}>
                {formatDateMarker(group.value, language, t)}
              </div>
              {group.items.map((task) => (
                <div key={task.id} style={{ 
                  background: 'var(--surface)', 
                  borderRadius: '12px', 
                  padding: '14px', 
                  marginBottom: '10px',
                  borderLeft: `4px solid ${task.status === 'DONE' ? 'var(--success)' : 'var(--warning)'}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 'bold', textTransform: 'uppercase' }}>{task.workerName}</span>
                      <p style={{ fontSize: '1rem', margin: '6px 0 0', lineHeight: '1.4' }}>{task.description}</p>
                    </div>
                    <span style={{ 
                      padding: '4px 10px', 
                      borderRadius: '12px', 
                      fontSize: '0.7rem', 
                      fontWeight: 'bold',
                      background: task.status === 'DONE' ? 'var(--success)' : 'var(--warning)',
                      color: '#000',
                    }}>
                      {task.status === 'DONE' ? t('done') : t('pending')}
                    </span>
                  </div>
                  {task.response && (
                    <div style={{ marginTop: '8px', padding: '8px 10px', borderRadius: '8px', background: 'var(--surface-high)', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--on-surface-variant)' }}>{t('response')}: </span>{task.response}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)' }}>{formatTime(task.createdAt, language)}</span>
                    <button
                      onClick={async () => {
                        if (!window.confirm(t('deleteTaskConfirm'))) return;
                        try { await deleteTask(task.id); } catch (err) { alert(err.message || t('somethingWentWrong')); }
                      }}
                      style={{ background: 'none', border: 'none', color: 'var(--error)', fontSize: '0.75rem', padding: '4px 8px' }}
                    >
                      {t('delete')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </>
      )}

      {view === 'contacts' && (
        <>
          <button onClick={() => { setChatPartner('GLOBAL'); setView('chat'); }} className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px' }}>
            <Megaphone size={20} /> {t('globalBroadcast')}
          </button>

          {Object.entries(groupedWorkers).map(([cat, list]) => (
            <section key={cat}>
              <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--on-surface-variant)', margin: '12px 0 8px' }}>
                {getDepartmentLabel(cat)}
              </h4>
              {list.map((worker) => (
                <button
                  key={worker.id}
                  onClick={() => {
                    setChatPartner(worker.name);
                    setView('chat');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    width: '100%',
                    padding: '14px 16px',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'var(--surface)',
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
                  <div>
                    <div style={{ color: 'var(--on-background)', fontWeight: '600', fontSize: '1rem' }}>{worker.name}</div>
                    <div style={{ color: 'var(--on-surface-variant)', fontSize: '0.8rem' }}>{getDepartmentLabel(worker.category)}</div>
                  </div>
                </button>
              ))}
            </section>
          ))}

          {workers.length === 0 && <p style={{ color: 'var(--on-surface-variant)', textAlign: 'center', marginTop: '20px' }}>{t('noWorkersYet')}</p>}
        </>
      )}

      {view === 'admin' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Shield size={20} /> {t('adminSetupTitle')}
            </h3>
            <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.85rem', margin: '4px 0 0' }}>{t('adminSetupHelp')}</p>
          </div>

          <div className="card" style={{ display: 'grid', gap: '10px' }}>
            <strong>{t('createWorkerAccount')}</strong>
            <input value={newWorkerName} onChange={(e) => setNewWorkerName(e.target.value)} placeholder={t('workerName')} />
            <input type="text" value={newWorkerPassword} onChange={(e) => setNewWorkerPassword(e.target.value)} placeholder={t('passwordPin')} />
            <select value={newWorkerDept} onChange={(e) => setNewWorkerDept(e.target.value)}>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {getDepartmentLabel(dept)}
                </option>
              ))}
            </select>
            <button className="btn-primary" onClick={handleCreateWorker}>
              {t('createAccount')}
            </button>

            {createdCreds && (
              <div style={{ background: 'var(--surface-high)', borderRadius: '10px', padding: '10px', fontSize: '0.9rem' }}>
                <strong>{t('credentialsToShare')}</strong>
                  <div style={{ marginTop: '6px' }}>
                  <div>{t('labelName')}: {createdCreds.name}</div>
                  <div>{t('labelPassword')}: {createdCreds.password}</div>
                  <div>
                    {t('department')}: {getDepartmentLabel(createdCreds.category)}
                  </div>
                </div>
                <button className="btn-secondary" style={{ marginTop: '8px' }} onClick={copyCredentials}>
                  {t('copy')}
                </button>
              </div>
            )}
          </div>

          {workers.map((worker) => (
            <div key={worker.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h4 style={{ margin: 0, fontSize: '1.05rem' }}>{worker.name}</h4>
                  <span
                    style={{
                      display: 'inline-block',
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: worker.online ? 'var(--success)' : 'var(--on-surface-variant)',
                    }}
                  />
                </div>
                <button
                  onClick={() => handleDeleteWorker(worker.id, worker.name)}
                  style={{ background: 'none', border: 'none', color: 'var(--error)' }}
                >
                  <Trash2 size={20} />
                </button>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginBottom: '4px' }}>{t('newPassword')}</label>
                  <input
                    type="text"
                    value={passwordDrafts[worker.id] || ''}
                    onChange={(e) => setPasswordDrafts((prev) => ({ ...prev, [worker.id]: e.target.value }))}
                    placeholder={t('newPassword')}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', fontSize: '0.9rem', background: 'var(--background)', color: 'var(--on-background)', border: '1px solid var(--surface-high)' }}
                  />
                  <button className="btn-secondary" style={{ marginTop: '8px', width: '100%' }} onClick={() => handlePasswordUpdate(worker.id)}>
                    {t('updatePassword')}
                  </button>
                </div>
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginBottom: '4px' }}>{t('department')}</label>
                  <select
                    defaultValue={worker.category || 'General'}
                    onChange={(e) => updateWorker(worker.id, { category: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', fontSize: '0.9rem', background: 'var(--background)', color: 'var(--on-background)', border: '1px solid var(--surface-high)' }}
                  >
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>
                        {getDepartmentLabel(dept)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}

          {workers.length === 0 && <p style={{ color: 'var(--on-surface-variant)' }}>{t('noWorkersYet')}</p>}
        </div>
      )}

      {view === 'settings' && (
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--surface-high)', paddingBottom: '10px' }}>
            <button
              onClick={() => setActiveSettingsTab('config')}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '8px',
                border: 'none',
                background: activeSettingsTab === 'config' ? 'var(--primary-container)' : 'transparent',
                color: activeSettingsTab === 'config' ? 'var(--primary)' : 'var(--on-surface-variant)',
                fontWeight: 'bold',
                fontSize: '0.85rem'
              }}
            >
              {t('appSettings')}
            </button>
            <button
              onClick={() => setActiveSettingsTab('workers')}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '8px',
                border: 'none',
                background: activeSettingsTab === 'workers' ? 'var(--primary-container)' : 'transparent',
                color: activeSettingsTab === 'workers' ? 'var(--primary)' : 'var(--on-surface-variant)',
                fontWeight: 'bold',
                fontSize: '0.85rem'
              }}
            >
              {t('manageWorkers')}
            </button>
          </div>

          {activeSettingsTab === 'config' && (
            <div style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: 'var(--on-surface-variant)', fontSize: '0.9rem' }}>{t('language')}</label>
                <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                  {languageOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <button className="btn-secondary" onClick={() => setNotificationsEnabled(!notificationsEnabled)}>
                {t('alertSound')}: {notificationsEnabled ? t('on') : t('off')}
              </button>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: 'var(--on-surface-variant)', fontSize: '0.9rem' }}>{t('permissions')}</label>
                <p style={{ margin: 0, color: 'var(--on-surface-variant)', fontSize: '0.85rem' }}>{t('micPermissionHint')}</p>
              </div>
              <button className="btn-primary" onClick={logout}>{t('logout')}</button>
            </div>
          )}

          {activeSettingsTab === 'workers' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Shield size={20} /> {t('adminSetupTitle')}
                </h3>
                <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.85rem', margin: '4px 0 0' }}>{t('adminSetupHelp')}</p>
              </div>

              <div className="card" style={{ display: 'grid', gap: '10px', background: 'var(--background)' }}>
                <strong>{t('createWorkerAccount')}</strong>
                <input value={newWorkerName} onChange={(e) => setNewWorkerName(e.target.value)} placeholder={t('workerName')} />
                <input type="text" value={newWorkerPassword} onChange={(e) => setNewWorkerPassword(e.target.value)} placeholder={t('passwordPin')} />
                <select value={newWorkerDept} onChange={(e) => setNewWorkerDept(e.target.value)}>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {getDepartmentLabel(dept)}
                    </option>
                  ))}
                </select>
                <button className="btn-primary" onClick={handleCreateWorker}>
                  {t('createAccount')}
                </button>

                {createdCreds && (
                  <div style={{ background: 'var(--surface-high)', borderRadius: '10px', padding: '10px', fontSize: '0.9rem' }}>
                    <strong>{t('credentialsToShare')}</strong>
                    <div style={{ marginTop: '6px' }}>
                      <div>{t('labelName')}: {createdCreds.name}</div>
                      <div>{t('labelPassword')}: {createdCreds.password}</div>
                      <div>{t('department')}: {getDepartmentLabel(createdCreds.category)}</div>
                    </div>
                    <button className="btn-secondary" style={{ marginTop: '8px' }} onClick={copyCredentials}>
                      {t('copy')}
                    </button>
                  </div>
                )}
              </div>

              {workers.map((worker) => (
                <div key={worker.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--background)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h4 style={{ margin: 0, fontSize: '1.05rem' }}>{worker.name}</h4>
                      <span
                        style={{
                          display: 'inline-block',
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: worker.online ? 'var(--success)' : 'var(--on-surface-variant)',
                        }}
                      />
                    </div>
                    <button
                      onClick={() => handleDeleteWorker(worker.id, worker.name)}
                      style={{ background: 'none', border: 'none', color: 'var(--error)' }}
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginBottom: '4px' }}>{t('newPassword')}</label>
                      <input
                        type="text"
                        value={passwordDrafts[worker.id] || ''}
                        onChange={(e) => setPasswordDrafts((prev) => ({ ...prev, [worker.id]: e.target.value }))}
                        placeholder={t('newPassword')}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', fontSize: '0.9rem', background: 'var(--surface)', color: 'var(--on-background)', border: '1px solid var(--surface-high)' }}
                      />
                      <button className="btn-secondary" style={{ marginTop: '8px', width: '100%' }} onClick={() => handlePasswordUpdate(worker.id)}>
                        {t('updatePassword')}
                      </button>
                    </div>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginBottom: '4px' }}>{t('department')}</label>
                      <select
                        value={worker.category || 'General'}
                        onChange={(e) => updateWorker(worker.id, { category: e.target.value })}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', fontSize: '0.9rem', background: 'var(--surface)', color: 'var(--on-background)', border: '1px solid var(--surface-high)' }}
                      >
                        {departments.map((dept) => (
                          <option key={dept} value={dept}>
                            {getDepartmentLabel(dept)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
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
