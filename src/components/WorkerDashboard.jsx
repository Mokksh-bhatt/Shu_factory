import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardList, MessageSquare, Clock, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useToast } from './Toast';
import VoiceInput from './VoiceInput';
import TranslatedText from './TranslatedText';
import SettingsMenu from './SettingsMenu';
import { formatTime } from '../utils/formatTime';
import { formatDateMarker, groupByDate } from '../utils/dateUtils';

function TaskResponseInput({ task, onRespond, onAcknowledge, t, showToast }) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const handleReply = async () => {
    if (!value.trim()) {
      showToast(t('typeAReply') || 'Type a reply first', 'warning');
      return;
    }
    if (value.trim().length > 500) {
      showToast(t('responseTooLong'), 'warning');
      return;
    }
    setSaving(true);
    try {
      await onAcknowledge(task.id, value.trim());
      setValue('');
    } catch (err) {
      showToast(err.message || t('somethingWentWrong'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      await onRespond(task.id, value.trim() || '', 'DONE');
    } catch (err) {
      showToast(err.message || t('somethingWentWrong'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ marginTop: '16px' }}>
      {/* Reply history */}
      {task.replies && task.replies.length > 0 && (
        <div style={{ marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {task.replies.map((reply, i) => (
            <div key={i} style={{
              padding: '6px 10px', borderRadius: '8px', fontSize: '0.85rem',
              background: 'rgba(110,155,255,0.08)',
              borderLeft: '3px solid var(--secondary)',
            }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)' }}>
                {reply.from} • {new Date(reply.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              {reply.text && <div style={{ color: 'var(--on-background)' }}>{reply.text}</div>}
              {reply.audioUrl && (
                <audio controls src={reply.audioUrl} style={{ width: '100%', height: '32px', marginTop: '4px', borderRadius: '8px' }} />
              )}
            </div>
          ))}
        </div>
      )}

      {task.status === 'PENDING' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <VoiceInput
            onSubmit={async (text) => {
              // Send button directly submits the reply
              if (!text.trim()) return;
              setSaving(true);
              try {
                await onAcknowledge(task.id, text.trim());
                setValue('');
              } catch (err) {
                showToast(err.message || t('somethingWentWrong'), 'error');
              } finally {
                setSaving(false);
              }
            }}
            onAudioSubmit={async (audioUrl) => {
              // Voice note directly submits as reply with audio
              setSaving(true);
              try {
                await onAcknowledge(task.id, '', audioUrl);
                showToast('🎙️ Voice reply sent', 'success');
              } catch (err) {
                showToast(err.message || t('somethingWentWrong'), 'error');
              } finally {
                setSaving(false);
              }
            }}
            placeholder={t('typeOrSpeakResponse')}
            value={value}
            onChange={setValue}
          />

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleComplete}
              disabled={saving}
              style={{
                flex: 1, padding: '12px', borderRadius: '12px',
                fontWeight: 'bold', border: 'none', fontSize: '0.9rem',
                background: 'var(--success)', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}
            >
              ✓ {t('complete') || 'Mark Complete'}
            </button>
          </div>
        </div>
      )}

      {task.status === 'DONE' && task.response && (
        <div style={{
          padding: '10px', borderRadius: '8px', fontSize: '0.9rem',
          background: 'rgba(34,197,94,0.1)', borderLeft: '3px solid var(--success)',
        }}>
          <span style={{ color: 'var(--on-surface-variant)' }}>✅ {t('completedResponse') || 'Completed'}: </span>
          <strong style={{ color: 'var(--success)' }}>{task.response}</strong>
        </div>
      )}
    </div>
  );
}

export default function WorkerDashboard() {
  const { currentUser, tasks, sendMessage, sendVoiceMessage, respondToTask, acknowledgeTask, markTasksSeen, getConversation, setActiveChat, logout, t, language, languageOptions, setLanguage, getDepartmentLabel, notificationsEnabled, setNotificationsEnabled, unreadCount, markMessagesRead, overdueReminders, unseenAlert, setUnseenAlert } =
    useAppContext();
  const showToast = useToast();
  const [view, setView] = useState('tasks');

  const [hasOnboarded, setHasOnboarded] = useState(
    () => localStorage.getItem(`onboarded_${currentUser?.id}`) === 'true'
  );

  const completeOnboarding = (langValue) => {
    setLanguage(langValue);
    localStorage.setItem(`onboarded_${currentUser?.id}`, 'true');
    setHasOnboarded(true);
  };

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
    } else if (view === 'tasks') {
      setActiveChat(null);
      // Mark all pending tasks as seen when the worker opens the tasks tab
      markTasksSeen();
    } else {
      setActiveChat(null);
    }
    return () => setActiveChat(null);
  }, [view, setActiveChat, markMessagesRead, markTasksSeen]);

  const taskGroups = useMemo(() => groupByDate(pendingTasks, (task) => task.createdAt), [pendingTasks]);
  const chatGroups = useMemo(() => groupByDate(ownerChat, (msg) => msg.createdAt), [ownerChat]);

  const handleSendMessage = async (text) => {
    try {
      await sendMessage(currentUser.name, 'owner', text);
    } catch (err) {
      showToast(err.message || t('somethingWentWrong'), 'error');
    }
  };

  const handleSendVoice = async (audioUrl, duration) => {
    try {
      await sendVoiceMessage(currentUser.name, 'owner', audioUrl, duration);
    } catch (err) {
      showToast(err.message || t('somethingWentWrong'), 'error');
    }
  };

  if (!hasOnboarded) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--primary)', margin: 0, fontSize: '1.8rem' }}>Welcome, {currentUser.name}!</h2>
        <p style={{ color: 'var(--on-surface-variant)', fontSize: '1.1rem', maxWidth: '300px' }}>
          Please select your preferred language.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '300px', marginTop: '20px' }}>
          {languageOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => completeOnboarding(opt.value)}
              style={{
                padding: '16px',
                borderRadius: '12px',
                border: 'none',
                background: 'var(--surface)',
                color: 'var(--on-background)',
                fontSize: '1.2rem',
                fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div style={{ marginTop: '30px', padding: '16px', background: 'var(--primary-container)', borderRadius: '12px', color: 'var(--primary)' }}>
          <strong>💡 Tip:</strong> Make sure to also switch your phone's typing keyboard to your chosen language!
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: view === 'chat' ? '0' : '20px', height: view === 'chat' ? '100dvh' : 'auto', overflow: view === 'chat' ? 'hidden' : 'visible' }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ color: 'var(--primary)', margin: 0, fontSize: '1.4rem' }}>{currentUser.name}</h2>
          <span style={{ color: 'var(--on-surface-variant)', fontSize: '0.9rem' }}>
            {getDepartmentLabel(currentUser.category)} - {t('worker')}
          </span>
        </div>
        <SettingsMenu
          t={t}
          language={language}
          languageOptions={languageOptions}
          setLanguage={setLanguage}
          notificationsEnabled={notificationsEnabled}
          setNotificationsEnabled={setNotificationsEnabled}
          logout={logout}
          isOwner={false}
        />
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
            position: 'relative'
          }}
        >
          <ClipboardList size={18} /> {t('tasks')}
          {pendingTasks.length > 0 && (
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
              {pendingTasks.length}
            </div>
          )}
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
          {/* Unseen alert banner */}
          <AnimatePresence>
            {unseenAlert && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                style={{
                  background: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.08))',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: '14px', padding: '14px 16px', marginBottom: '12px',
                  display: 'flex', alignItems: 'flex-start', gap: '10px',
                }}
              >
                <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>🔔</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--error)', marginBottom: '4px' }}>
                    {unseenAlert.count} unseen task{unseenAlert.count > 1 ? 's' : ''} — action required!
                  </div>
                  {unseenAlert.tasks.map((desc, i) => (
                    <div key={i} style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)', marginTop: '2px' }}>• {desc}</div>
                  ))}
                </div>
                <button onClick={() => setUnseenAlert(null)} style={{ background: 'none', border: 'none', color: 'var(--on-surface-variant)', padding: '2px' }}>
                  <X size={16} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

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

                  {group.items.map((task) => {
                    const isOverdue = overdueReminders.includes(task.id);
                    const ts = task.createdAt?.toMillis ? task.createdAt.toMillis() : (task.createdAt?.seconds ? task.createdAt.seconds * 1000 : 0);
                    const ageHours = ts ? Math.floor((Date.now() - ts) / (60 * 60 * 1000)) : 0;

                    return (
                    <div key={task.id} className="card" style={{ 
                      borderLeft: task.important ? '3px solid var(--error)' : '3px solid var(--warning)',
                      background: task.important ? 'rgba(239,68,68,0.06)' : undefined,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                            {task.important && (
                              <span style={{ fontSize: '0.65rem', background: 'var(--error)', color: 'white', padding: '2px 6px', borderRadius: '6px', fontWeight: 'bold' }}>★ URGENT</span>
                            )}
                            {isOverdue && (
                              <span style={{ fontSize: '0.65rem', background: 'var(--warning)', color: '#000', padding: '2px 6px', borderRadius: '6px', fontWeight: 'bold' }}>⏰ {ageHours}h OVERDUE</span>
                            )}
                          </div>
                          <p style={{ fontSize: '1.05rem', fontWeight: '600', margin: 0, lineHeight: '1.4' }}>
                            {task.description && <TranslatedText text={task.description} targetLang={language} />}
                          </p>
                          {task.audioUrl && (
                            <audio controls src={task.audioUrl} style={{ width: '100%', height: '36px', marginTop: '8px', borderRadius: '8px' }} />
                          )}
                        </div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)', whiteSpace: 'nowrap', marginLeft: '10px' }}>
                          {formatTime(task.createdAt, language)}
                        </span>
                      </div>

                      <TaskResponseInput task={task} onRespond={respondToTask} onAcknowledge={acknowledgeTask} t={t} showToast={showToast} />
                    </div>
                    );
                  })}
                </div>
              ))}
            </section>
          )}
        </>
      )}

      {view === 'chat' && (
        <section className="card" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
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
                    {msg.text && <TranslatedText text={msg.text} targetLang={language} />}
                    {msg.audioUrl && (
                      <audio controls src={msg.audioUrl} style={{ width: '100%', height: '32px', marginTop: '6px', borderRadius: '8px' }} />
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div style={{ padding: '8px 0', borderTop: '1px solid var(--surface-high)', flexShrink: 0 }}>
            <VoiceInput onSubmit={handleSendMessage} onAudioSubmit={handleSendVoice} placeholder={t('messageOwner')} />
          </div>
        </section>
      )}

      
    </motion.div>
  );
}
