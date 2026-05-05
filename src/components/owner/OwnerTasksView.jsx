import { useState, useMemo } from 'react';
import { Star, AlertTriangle } from 'lucide-react';
import VoiceInput from '../VoiceInput';
import ConfirmModal from '../ConfirmModal';
import TranslatedText from '../TranslatedText';
import { useToast } from '../Toast';
import { useAppContext } from '../../context/AppContext';
import { formatTime } from '../../utils/formatTime';
import { isInDateRange, groupByDate, formatDateMarker } from '../../utils/dateUtils';

export default function OwnerTasksView({ workers, tasks, addTask, deleteTask, language, t }) {
  const showToast = useToast();
  const { toggleTaskImportant, overdueReminders } = useAppContext();
  const [targetWorker, setTargetWorker] = useState('');
  const [taskWorkerFilter, setTaskWorkerFilter] = useState('all');
  const [taskStatusFilter, setTaskStatusFilter] = useState('all');
  const [taskDateFilter, setTaskDateFilter] = useState('all');
  const [markImportant, setMarkImportant] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // task id to delete

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
      showToast(t('selectWorkerFirst'), 'warning');
      return;
    }
    try {
      await addTask(text, targetWorker, markImportant);
      if (markImportant) setMarkImportant(false);
      showToast(`✓ Task assigned to ${targetWorker}`, 'success');
    } catch (err) {
      showToast(err.message || t('somethingWentWrong'), 'error');
    }
  };

  const handleAssignVoice = async (audioUrl, duration) => {
    if (!targetWorker) {
      showToast(t('selectWorkerFirst'), 'warning');
      return;
    }
    try {
      await addTask('', targetWorker, markImportant, audioUrl);
      if (markImportant) setMarkImportant(false);
      showToast(`🎤 Voice task sent to ${targetWorker}`, 'success');
    } catch (err) {
      showToast(err.message || t('somethingWentWrong'), 'error');
    }
  };

  const handleAssignImage = async (imageUrl) => {
    if (!targetWorker) {
      showToast(t('selectWorkerFirst'), 'warning');
      return;
    }
    try {
      await addTask('', targetWorker, markImportant, null, imageUrl);
      if (markImportant) setMarkImportant(false);
      showToast(`🖼️ Image task sent to ${targetWorker}`, 'success');
    } catch (err) {
      showToast(err.message || t('somethingWentWrong'), 'error');
    }
  };

  const getTaskAge = (task) => {
    const ts = task.createdAt?.toMillis ? task.createdAt.toMillis() : (task.createdAt?.seconds ? task.createdAt.seconds * 1000 : 0);
    if (!ts) return 0;
    return Date.now() - ts;
  };

  const isOverdue = (task) => overdueReminders.includes(task.id);

  return (
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

        {/* Importance toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '8px 0' }}>
          <button
            onClick={() => setMarkImportant(!markImportant)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 18px', borderRadius: '24px', border: 'none',
              background: markImportant ? 'rgba(239,68,68,0.15)' : 'var(--surface-high)',
              color: markImportant ? 'var(--error)' : 'var(--on-surface-variant)',
              fontWeight: '800', fontSize: '0.9rem',
              transition: 'all 0.2s ease', cursor: 'pointer',
            }}
          >
            <Star size={18} strokeWidth={2.5} fill={markImportant ? 'var(--error)' : 'none'} />
            {markImportant ? '🔴 URGENT' : 'Mark Important'}
          </button>
        </div>

        <VoiceInput
          onSubmit={handleAssignTask}
          onAudioSubmit={handleAssignVoice}
          onImageSubmit={handleAssignImage}
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
          <option value="PROCESSED">{t('processed') || 'Processed'}</option>
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
          {group.items.map((task) => {
            const overdue = isOverdue(task);
            const ageHours = Math.floor(getTaskAge(task) / (60 * 60 * 1000));

            return (
              <div key={task.id} style={{ 
                background: task.important ? 'rgba(239,68,68,0.06)' : 'var(--surface)', 
                borderRadius: '12px', 
                padding: '14px', 
                marginBottom: '10px',
                borderLeft: `4px solid ${task.status === 'DONE' ? 'var(--success)' : task.status === 'PROCESSED' ? 'var(--secondary)' : task.important ? 'var(--error)' : 'var(--warning)'}`,
                ...(overdue && task.status === 'PENDING' ? { boxShadow: '0 0 0 1px rgba(239,68,68,0.3)' } : {})
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 'bold', textTransform: 'uppercase' }}>{task.workerName}</span>
                      {task.important && (
                        <span style={{ fontSize: '0.65rem', background: 'var(--error)', color: 'white', padding: '2px 6px', borderRadius: '6px', fontWeight: 'bold' }}>
                          ★ IMPORTANT
                        </span>
                      )}
                      {overdue && task.status === 'PENDING' && (
                        <span style={{ fontSize: '0.65rem', background: 'var(--warning)', color: '#000', padding: '2px 6px', borderRadius: '6px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <AlertTriangle size={10} /> {ageHours}h OVERDUE
                        </span>
                      )}
                      {task.status === 'PENDING' && (
                        <span style={{
                          fontSize: '0.6rem',
                          padding: '2px 6px',
                          borderRadius: '6px',
                          fontWeight: 'bold',
                          background: task.seenByWorker ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                          color: task.seenByWorker ? 'var(--success)' : 'var(--error)',
                        }}>
                          {task.seenByWorker ? '👁 Seen' : '⬤ Unseen'}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '1rem', margin: '4px 0 0', lineHeight: '1.4' }}>
                      {task.description && <TranslatedText text={task.description} targetLang={language} />}
                    </p>
                    {task.imageUrl && (
                      <img src={task.imageUrl} alt="Attachment" style={{ width: '100%', maxWidth: '300px', height: 'auto', marginTop: '8px', borderRadius: '8px' }} />
                    )}
                    {task.audioUrl && (
                      <audio controls src={task.audioUrl} style={{ width: '100%', height: '36px', marginTop: '8px', borderRadius: '8px' }} />
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                    <span style={{ 
                      padding: '4px 10px', 
                      borderRadius: '12px', 
                      fontSize: '0.7rem', 
                      fontWeight: 'bold',
                      background: task.status === 'DONE' ? 'var(--success)' : task.status === 'PROCESSED' ? 'var(--secondary)' : 'var(--warning)',
                      color: task.status === 'PROCESSED' ? 'white' : '#000',
                    }}>
                      {task.status === 'DONE' ? t('done') : task.status === 'PROCESSED' ? (t('processed') || 'Processed') : t('pending')}
                    </span>
                    {task.status === 'PROCESSED' && (
                      <button
                        onClick={async () => {
                          try {
                            const { doc, updateDoc } = await import('firebase/firestore');
                            const { db } = await import('../../firebase');
                            await updateDoc(doc(db, 'tasks', task.id), { status: 'DONE' });
                            showToast('Task approved and completed', 'success');
                          } catch (err) {
                            showToast(err.message, 'error');
                          }
                        }}
                        style={{
                          background: 'var(--success)', color: 'white', border: 'none',
                          padding: '6px 12px', borderRadius: '16px', fontSize: '0.75rem',
                          fontWeight: 'bold', cursor: 'pointer', marginTop: '6px'
                        }}
                      >
                        Approve
                      </button>
                    )}
                    {task.status === 'PENDING' && (
                      <button
                        onClick={() => toggleTaskImportant(task.id, task.important)}
                        style={{
                          background: task.important ? 'rgba(239,68,68,0.1)' : 'var(--surface-high)', 
                          border: 'none', padding: '6px 10px', borderRadius: '16px',
                          color: task.important ? 'var(--error)' : 'var(--on-surface-variant)',
                          cursor: 'pointer', transition: 'all 0.2s ease', marginTop: '4px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                        title={task.important ? 'Remove importance' : 'Mark as important'}
                      >
                        <Star size={18} strokeWidth={2.5} fill={task.important ? 'var(--error)' : 'none'} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Worker replies / acknowledgments */}
                {task.replies && task.replies.length > 0 && (
                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {task.replies.map((reply, i) => (
                      <div key={i} style={{
                        padding: '6px 10px', borderRadius: '8px', fontSize: '0.82rem',
                        background: 'rgba(110,155,255,0.08)',
                        borderLeft: '3px solid var(--secondary)',
                      }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--on-surface-variant)' }}>
                          💬 {reply.from} • {new Date(reply.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <div><TranslatedText text={reply.text} targetLang={language} /></div>
                        {reply.imageUrl && (
                          <img src={reply.imageUrl} alt="Reply Attachment" style={{ width: '100%', maxWidth: '200px', height: 'auto', marginTop: '4px', borderRadius: '6px' }} />
                        )}
                        {reply.audioUrl && (
                          <audio controls src={reply.audioUrl} style={{ width: '100%', height: '28px', marginTop: '4px', borderRadius: '6px' }} />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {(task.response || task.status === 'PROCESSED') && (
                  <div style={{ marginTop: '8px', padding: '8px 10px', borderRadius: '8px', background: task.status === 'DONE' ? 'rgba(34,197,94,0.1)' : 'var(--surface-high)', fontSize: '0.85rem', borderLeft: task.status === 'DONE' ? '3px solid var(--success)' : task.status === 'PROCESSED' ? '3px solid var(--secondary)' : 'none' }}>
                    <span style={{ color: 'var(--on-surface-variant)' }}>{task.status === 'DONE' ? '✅ ' : task.status === 'PROCESSED' ? '⏳ ' : ''}{t('response')}: </span>{task.response || 'No response text'}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)' }}>{formatTime(task.createdAt, language)}</span>
                  <button
                    onClick={() => setConfirmDelete(task.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--error)', fontSize: '0.75rem', padding: '4px 8px' }}
                  >
                    {t('delete')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      <ConfirmModal
        open={!!confirmDelete}
        title={t('delete')}
        message={t('deleteTaskConfirm')}
        confirmText={t('delete')}
        cancelText={t('cancel') || 'Cancel'}
        danger={true}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          const id = confirmDelete;
          setConfirmDelete(null);
          try { await deleteTask(id); } catch (err) { showToast(err.message || t('somethingWentWrong'), 'error'); }
        }}
      />
    </>
  );
}
