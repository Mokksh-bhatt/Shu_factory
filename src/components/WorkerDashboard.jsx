import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ClipboardList, MessageSquare, CheckCircle, Clock, Settings } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import VoiceInput from './VoiceInput';
import { formatTime } from '../utils/formatTime';
import { formatDateMarker, groupByDate } from '../utils/dateUtils';

function TaskResponseInput({ task, onRespond, t }) {
  const [showRespond, setShowRespond] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const openRespond = () => {
    if (!showRespond) {
      setValue(task.response || '');
    }
    setShowRespond((prev) => !prev);
  };

  const submit = async (status) => {
    if (value.trim().length > 500) {
      alert(t('responseTooLong'));
      return;
    }
    if (status !== 'DONE' && !value.trim()) {
      alert(t('responseOrPhotoRequired'));
      return;
    }

    setSaving(true);
    try {
      await onRespond(task.id, value.trim(), status);
      setShowRespond(false);
    } catch (err) {
      alert(err.message || t('somethingWentWrong'));
    } finally {
      setSaving(false);
    }
  };

  const markPending = async () => {
    if (value.trim().length > 500) {
      alert(t('responseTooLong'));
      return;
    }
    setSaving(true);
    try {
      await onRespond(task.id, value.trim() || t('pendingText'), 'PENDING');
      setShowRespond(false);
    } catch (err) {
      alert(err.message || t('somethingWentWrong'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ marginTop: '12px' }}>
      {task.response && (
        <div
          style={{
            marginBottom: '10px',
            padding: '10px',
            borderRadius: '8px',
            fontSize: '0.9rem',
            background: task.status === 'DONE' ? 'rgba(110,155,255,0.1)' : 'rgba(255,170,0,0.1)',
          }}
        >
          <span style={{ color: 'var(--on-surface-variant)' }}>{t('lastResponse')}: </span>
          <strong style={{ color: task.status === 'DONE' ? 'var(--secondary)' : 'var(--primary)' }}>{task.response}</strong>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={openRespond}
          disabled={saving}
          style={{
            flex: 2,
            padding: '12px',
            borderRadius: '12px',
            fontWeight: 'bold',
            border: 'none',
            background: showRespond ? 'var(--surface-high)' : 'var(--secondary)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <MessageSquare size={18} /> {t('respond')}
        </button>
        <button
          onClick={markPending}
          disabled={saving}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '12px',
            fontWeight: 'bold',
            border: 'none',
            background: 'var(--surface-high)',
            color: 'var(--on-surface-variant)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <Clock size={18} /> {t('pending')}
        </button>
      </div>

      {showRespond && (
        <div style={{ marginTop: '10px', display: 'grid' }}>
          <VoiceInput
            onSubmit={(text) => submit('DONE')}
            placeholder={t('typeOrSpeakResponse')}
            value={value}
            onChange={setValue}
          />
        </div>
      )}
    </div>
  );
}

export default function WorkerDashboard() {
  const { currentUser, tasks, sendMessage, respondToTask, getConversation, setActiveChat, logout, t, language, languageOptions, setLanguage, getDepartmentLabel, notificationsEnabled, setNotificationsEnabled, unreadCount, markMessagesRead } =
    useAppContext();
  const [view, setView] = useState('tasks');

  const myTasks = useMemo(
    () => tasks.filter((task) => task.workerName?.toLowerCase() === currentUser.name?.toLowerCase()),
    [tasks, currentUser.name],
  );

  const pendingTasks = useMemo(() => myTasks.filter((task) => task.status === 'PENDING'), [myTasks]);
  const ownerChat = useMemo(() => getConversation(currentUser.name), [getConversation, currentUser.name]);

  useEffect(() => {
    if (view === 'chat') {
      setActiveChat('owner');
      markMessagesRead();
    } else {
      setActiveChat(null);
    }
    return () => setActiveChat(null);
  }, [view, setActiveChat, markMessagesRead]);

  const taskGroups = useMemo(() => groupByDate(pendingTasks, (task) => task.createdAt), [pendingTasks]);
  const chatGroups = useMemo(() => groupByDate(ownerChat, (msg) => msg.createdAt), [ownerChat]);

  const handleSendMessage = async (text) => {
    try {
      await sendMessage(currentUser.name, 'owner', text);
    } catch (err) {
      alert(err.message || t('somethingWentWrong'));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: view === 'chat' ? '80px' : '20px' }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ color: 'var(--primary)', margin: 0, fontSize: '1.4rem' }}>{currentUser.name}</h2>
          <span style={{ color: 'var(--on-surface-variant)', fontSize: '0.9rem' }}>
            {getDepartmentLabel(currentUser.category)} - {t('worker')}
          </span>
        </div>
        <button
          onClick={() => setView(view === 'settings' ? 'tasks' : 'settings')}
          style={{
            background: 'var(--surface-high)',
            border: 'none',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: view === 'settings' ? 'var(--primary)' : 'var(--on-surface-variant)'
          }}
        >
          <Settings size={20} />
        </button>
      </header>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => setView('tasks')}
          style={{
            flex: 1,
            padding: '12px',
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
          onClick={() => setView('chat')}
          style={{
            flex: 1,
            padding: '12px',
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
          <MessageSquare size={18} /> {t('chat')}
          {unreadCount > 0 && (
            <div style={{
              position: 'absolute',
              top: '8px',
              right: '12px',
              width: '18px',
              height: '18px',
              background: 'var(--error)',
              color: 'white',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.65rem',
              fontWeight: 'bold',
              border: '2px solid var(--surface)'
            }}>
              {unreadCount}
            </div>
          )}
        </button>
      </div>

      {view === 'tasks' && (
        <>
          {myTasks.length === 0 && <p style={{ color: 'var(--on-surface-variant)', textAlign: 'center', marginTop: '40px' }}>{t('noTasksAssigned')}</p>}

          {taskGroups.length > 0 && (
            <section>
              <h3 style={{ color: 'var(--error)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                {t('actionRequired')} ({pendingTasks.length})
              </h3>

              {taskGroups.map((group) => (
                <div key={group.key}>
                  <div style={{ margin: '8px 0', fontSize: '0.75rem', color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    {formatDateMarker(group.value, language, t)}
                  </div>

                  {group.items.map((task) => (
                    <div key={task.id} className="card" style={{ borderLeft: '3px solid var(--error)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <p style={{ fontSize: '1.05rem', fontWeight: '600', margin: 0, lineHeight: '1.4' }}>{task.description}</p>
                        <span style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)', whiteSpace: 'nowrap', marginLeft: '10px' }}>
                          {formatTime(task.createdAt, language)}
                        </span>
                      </div>

                      <TaskResponseInput task={task} onRespond={respondToTask} t={t} />
                    </div>
                  ))}
                </div>
              ))}
            </section>
          )}
        </>
      )}

      {view === 'chat' && (
        <section className="card" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 170px)' }}>
          <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', color: 'var(--on-surface-variant)' }}>
            {t('chatWithOwner')}
          </h3>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingBottom: '10px' }}>
            {ownerChat.length === 0 && <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.9rem', textAlign: 'center', marginTop: '20px' }}>{t('noMessagesYet')}</p>}
            {chatGroups.map((group) => (
              <div key={group.key}>
                <div style={{ margin: '8px 0', fontSize: '0.75rem', color: 'var(--on-surface-variant)', textAlign: 'center' }}>
                  {formatDateMarker(group.value, language, t)}
                </div>
                {group.items.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      alignSelf: msg.sender === currentUser.name ? 'flex-end' : 'flex-start',
                      background: msg.sender === currentUser.name ? 'var(--primary)' : 'var(--surface-high)',
                      color: msg.sender === currentUser.name ? 'var(--on-primary)' : 'var(--on-background)',
                      padding: '8px 14px',
                      borderRadius: '16px',
                      maxWidth: '85%',
                      fontSize: '0.95rem',
                      marginBottom: '6px',
                      marginLeft: msg.sender === currentUser.name ? 'auto' : 0,
                    }}
                  >
                    <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                      {msg.target === 'GLOBAL' ? t('globalBroadcast') : msg.sender} - {formatTime(msg.createdAt, language)}
                    </div>
                    {msg.text}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '8px 12px', background: 'var(--background)', borderTop: '1px solid var(--surface-high)', zIndex: 100 }}>
            <VoiceInput onSubmit={handleSendMessage} placeholder={t('messageOwner')} />
          </div>
        </section>
      )}

      {view === 'settings' && (
        <section className="card" style={{ display: 'grid', gap: '12px' }}>
          <h3 style={{ margin: 0 }}>{t('appSettings')}</h3>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', color: 'var(--on-surface-variant)' }}>{t('language')}</label>
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
            <label style={{ display: 'block', marginBottom: '6px', color: 'var(--on-surface-variant)' }}>{t('permissions')}</label>
            <p style={{ margin: 0, color: 'var(--on-surface-variant)', fontSize: '0.9rem' }}>{t('micPermissionHint')}</p>
          </div>
          <button className="btn-primary" onClick={logout}>{t('logout')}</button>
        </section>
      )}
    </motion.div>
  );
}
