import { useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardList, MessageSquare, Clock, X, Megaphone, Factory } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useToast } from './Toast';
import VoiceInput from './VoiceInput';
import TranslatedText from './TranslatedText';
import SettingsMenu from './SettingsMenu';
import { formatTime } from '../utils/formatTime';
import { formatDateMarker, groupByDate } from '../utils/dateUtils';
import ImageLightbox from './ImageLightbox';
import DailyProductionForm from './owner/production/DailyProductionForm';

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

  const handleProcessed = async () => {
    setSaving(true);
    try {
      await onRespond(task.id, value.trim() || '', 'PROCESSED');
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
              {reply.imageUrl && (
                <img src={reply.imageUrl} alt="Reply Attachment" onClick={() => setLightboxSrc(reply.imageUrl)} style={{ width: '100%', maxWidth: '200px', height: 'auto', marginTop: '4px', borderRadius: '8px', cursor: 'pointer' }} />
              )}
              {reply.audioUrl && (
                <audio controls src={reply.audioUrl} style={{ width: '100%', height: '32px', marginTop: '4px', borderRadius: '8px' }} />
              )}
              {reply.documentUrl && (
                <a href={reply.documentUrl} onClick={(e) => { e.preventDefault(); window.open(reply.documentUrl, window.Capacitor?.isNativePlatform() ? '_system' : '_blank'); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '6px', padding: '6px 12px', background: 'rgba(0,0,0,0.1)', borderRadius: '8px', color: 'inherit', textDecoration: 'none', fontSize: '0.85rem' }}>
                  📄 {reply.documentName || 'Attached Document'}
                </a>
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
            onImageSubmit={async (imageUrl, imageText) => {
              setSaving(true);
              try {
                await onAcknowledge(task.id, imageText || '', null, imageUrl);
              } catch (err) {
                showToast(err.message || t('somethingWentWrong'), 'error');
              } finally {
                setSaving(false);
              }
            }}
            onDocumentSubmit={async (documentUrl, documentName, documentText) => {
              setSaving(true);
              try {
                await onAcknowledge(task.id, documentText || '', null, null, documentUrl, documentName);
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
              onClick={handleProcessed}
              disabled={saving}
              style={{
                flex: 1, padding: '12px', borderRadius: '12px',
                fontWeight: 'bold', border: 'none', fontSize: '0.9rem',
                background: 'var(--success)', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}
            >
              ✓ {t('processed') || 'Mark Processed'}
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
  const { currentUser, admins, allAdmins, tasks, sendMessage, sendVoiceMessage, respondToTask, acknowledgeTask, markTasksSeen, getConversation, setActiveChat, logout, t, language, languageOptions, setLanguage, getDepartmentLabel, notificationsEnabled, setNotificationsEnabled, unreadCount, markMessagesRead, overdueReminders, unseenAlert, setUnseenAlert, workers } =
    useAppContext();
  const showToast = useToast();
  
  const currentWorkerDoc = workers?.find(w => w.id === currentUser?.workerId);
  const hasProductionAccess = currentWorkerDoc?.hasProductionAccess || currentUser?.hasProductionAccess;
  const [view, setView] = useState('tasks');
  const [audioContextAllowed, setAudioContextAllowed] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [showNotificationModal, setShowNotificationModal] = useState(notificationsEnabled === null);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  
  // Default to the main owner (allAdmins[0] is always the hardcoded owner), fallback to 'Himanshu'
  const [targetAdmin, setTargetAdmin] = useState(() => allAdmins?.[0]?.name || 'Himanshu');

  // Ensure targetAdmin is set correctly once admins are loaded
  useEffect(() => {
    if (targetAdmin === 'Himanshu' && allAdmins?.[0]?.name && allAdmins[0].name !== 'Himanshu') {
       setTargetAdmin(allAdmins[0].name);
    }
  }, [allAdmins, targetAdmin]);

  const unlockAudio = () => {
    if (!audioContextAllowed) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        ctx.resume().then(() => setAudioContextAllowed(true));
      }
    }
  };

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
  const doneTasks = useMemo(() => myTasks.filter((task) => task.status !== 'PENDING').slice(0, 10), [myTasks]);
  const activeConversation = useMemo(() => getConversation(targetAdmin), [getConversation, targetAdmin]);

  useEffect(() => {
    if (view === 'chat') {
      setActiveChat(targetAdmin);
      markMessagesRead();
    } else if (view === 'tasks') {
      setActiveChat(null);
      // Mark all pending tasks as seen when the worker opens the tasks tab
      markTasksSeen();
    } else {
      setActiveChat(null);
    }
    return () => setActiveChat(null);
  }, [view, targetAdmin, setActiveChat, markMessagesRead, markTasksSeen]);

  const taskGroups = useMemo(() => groupByDate(pendingTasks, (task) => task.createdAt), [pendingTasks]);
  const chatGroups = useMemo(() => groupByDate(activeConversation, (msg) => msg.createdAt), [activeConversation]);

  useEffect(() => {
    setTimeout(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }, 100);
  }, [activeConversation, view]);

  const handleSendMessage = async (text) => {
    try {
      await sendMessage(currentUser.name, targetAdmin, text);
    } catch (err) {
      showToast(err.message || t('somethingWentWrong'), 'error');
    }
  };

  const handleSendVoice = async (audioUrl, duration) => {
    try {
      await sendVoiceMessage(currentUser.name, targetAdmin, audioUrl, duration);
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
      onClick={unlockAudio}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: view === 'chat' ? '85px' : '90px', height: view === 'chat' ? '100dvh' : 'auto', minHeight: '100vh', overflow: view === 'chat' ? 'hidden' : 'visible', boxSizing: 'border-box' }}
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
          currentUser={currentUser}
        />
      </header>

      {/* Navigation moved to bottom bar */}

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

          {pendingTasks.length === 0 && doneTasks.length === 0 && (
            <p style={{ color: 'var(--on-surface-variant)', textAlign: 'center', marginTop: '40px' }}>{t('noTasksAssigned')}</p>
          )}

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
                          {task.imageUrl && (
                            <img src={task.imageUrl} alt="Task Attachment" onClick={() => setLightboxSrc(task.imageUrl)} style={{ width: '100%', maxWidth: '300px', height: 'auto', marginTop: '8px', borderRadius: '8px', cursor: 'pointer' }} />
                          )}
                          {task.audioUrl && (
                            <audio controls src={task.audioUrl} style={{ width: '100%', height: '36px', marginTop: '8px', borderRadius: '8px' }} />
                          )}
                          {task.documentUrl && (
                            <a href={task.documentUrl} onClick={(e) => { e.preventDefault(); window.open(task.documentUrl, window.Capacitor?.isNativePlatform() ? '_system' : '_blank'); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '8px', padding: '8px 12px', background: 'rgba(0,0,0,0.05)', borderRadius: '8px', color: 'inherit', textDecoration: 'none', fontSize: '0.85rem' }}>
                              📄 {task.documentName || 'Attached Document'}
                            </a>
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

          {doneTasks.length > 0 && (
            <section style={{ marginTop: '16px' }}>
              <h3 style={{ color: 'var(--on-surface-variant)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                Submitted ({doneTasks.length})
              </h3>
              {doneTasks.map((task) => (
                <div key={task.id} className="card" style={{
                  borderLeft: '3px solid var(--success)',
                  opacity: 0.8,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.65rem', background: task.status === 'DONE' ? 'var(--success)' : 'var(--primary)', color: 'white', padding: '2px 6px', borderRadius: '6px', fontWeight: 'bold' }}>
                          {task.status === 'DONE' ? '✓ Done' : '✓ Processed'}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.95rem', fontWeight: '500', margin: 0, color: 'var(--on-surface-variant)', lineHeight: '1.4' }}>
                        {task.description}
                      </p>
                      {task.response && (
                        <p style={{ fontSize: '0.8rem', color: 'var(--success)', margin: '4px 0 0' }}>
                          Your response: {task.response}
                        </p>
                      )}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', whiteSpace: 'nowrap' }}>
                      {formatTime(task.createdAt, language)}
                    </span>
                  </div>
                </div>
              ))}
            </section>
          )}
        </>
      )}

      {view === 'chat' && (
        <section className="card" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
            <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--on-surface-variant)', margin: 0 }}>
              {t('chatWithOwner')}
            </h3>
            <div style={{ display: 'flex', overflowX: 'auto', gap: '8px', paddingBottom: '4px', scrollbarWidth: 'none' }}>
              {(allAdmins || []).map((admin) => (
                <button
                  key={admin.id || admin.name}
                  onClick={() => setTargetAdmin(admin.name)}
                  style={{
                    flexShrink: 0,
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: targetAdmin === admin.name ? 'none' : '1px solid var(--primary)',
                    background: targetAdmin === admin.name ? 'var(--primary)' : 'transparent',
                    color: targetAdmin === admin.name ? 'var(--on-primary)' : 'var(--primary)',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {admin.name}
                </button>
              ))}
            </div>
          </div>
          <div ref={chatContainerRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingBottom: '10px' }}>
            {activeConversation.length === 0 && <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.9rem', textAlign: 'center', marginTop: '20px' }}>{t('noMessagesYet')}</p>}
            {chatGroups.map((group) => (
              <div key={group.key}>
                <div style={{ margin: '8px 0', fontSize: '0.75rem', color: 'var(--on-surface-variant)', textAlign: 'center' }}>
                  {formatDateMarker(group.value, language, t)}
                </div>
                {group.items.map((msg) => {
                  const isMe = msg.sender?.toLowerCase().trim() === currentUser.name?.toLowerCase().trim();
                  return (
                    <div
                      key={msg.id}
                      style={{
                        alignSelf: isMe ? 'flex-end' : 'flex-start',
                        background: isMe ? 'var(--primary)' : 'var(--surface-high)',
                        color: isMe ? 'var(--on-primary)' : 'var(--on-background)',
                        padding: '8px 14px',
                        borderRadius: '16px',
                        maxWidth: '85%',
                        fontSize: '0.95rem',
                        marginBottom: '6px',
                        marginLeft: isMe ? 'auto' : 0,
                      }}
                    >
                      <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                        {msg.target === 'GLOBAL' ? t('globalBroadcast') : msg.sender} - {formatTime(msg.createdAt, language)}
                      </div>
                      {msg.text && <TranslatedText text={msg.text} targetLang={language} />}
                      {msg.imageUrl && (
                        <img src={msg.imageUrl} alt="Chat Attachment" onClick={() => setLightboxSrc(msg.imageUrl)} style={{ width: '100%', maxWidth: '250px', height: 'auto', marginTop: '6px', borderRadius: '8px', cursor: 'pointer' }} />
                      )}
                      {msg.audioUrl && (
                        <audio controls src={msg.audioUrl} style={{ width: '100%', height: '32px', marginTop: '6px', borderRadius: '8px' }} />
                      )}
                      {msg.documentUrl && (
                        <a href={msg.documentUrl} onClick={(e) => { e.preventDefault(); window.open(msg.documentUrl, window.Capacitor?.isNativePlatform() ? '_system' : '_blank'); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', padding: '8px 12px', background: 'rgba(0,0,0,0.1)', borderRadius: '8px', color: 'inherit', textDecoration: 'none', fontSize: '0.85rem' }}>
                          📄 {msg.documentName || 'Attached Document'}
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div style={{ padding: '8px 0', borderTop: '1px solid var(--surface-high)', flexShrink: 0 }}>
            <VoiceInput onSubmit={handleSendMessage} onAudioSubmit={handleSendVoice} onImageSubmit={async (imageUrl, imageText) => {
            setSaving(true);
            try {
              await sendMessage(currentUser.name, targetAdmin, imageText || '', imageUrl);
            } catch (err) {
                showToast(err.message || t('somethingWentWrong'), 'error');
              }
            }} onDocumentSubmit={async (documentUrl, documentName, documentText) => {
              setSaving(true);
              try {
                await sendMessage(currentUser.name, targetAdmin, documentText || '', null, documentUrl, documentName);
              } catch (err) {
                showToast(err.message || t('somethingWentWrong'), 'error');
              }
            }} placeholder={t('messageOwner')} />
          </div>
        </section>
      )}

      {view === 'production' && hasProductionAccess && (
        <div style={{ flex: 1 }}>
          <DailyProductionForm t={t} />
        </div>
      )}
 
      <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />

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
          {pendingTasks.length > 0 && (
            <span style={{
              position: 'absolute', top: '-2px', right: 'calc(50% - 20px)', width: '18px', height: '18px',
              background: 'var(--error)', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '0.65rem', fontWeight: 'bold', border: '2px solid var(--surface)'
            }}>
              {pendingTasks.length}
            </span>
          )}
        </button>

        {hasProductionAccess && (
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
        )}

        <button
          onClick={() => setView('chat')}
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
