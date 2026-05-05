import { useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useToast } from '../Toast';
import VoiceInput from '../VoiceInput';
import TranslatedText from '../TranslatedText';
import { formatTime } from '../../utils/formatTime';
import { isInDateRange, groupByDate, formatDateMarker } from '../../utils/dateUtils';

export default function OwnerChatView({ partner, onBack, dateFilter, setDateFilter, t, language }) {
  const { getConversation, sendMessage, sendVoiceMessage, setActiveChat } = useAppContext();
  const showToast = useToast();

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
      showToast(err.message || t('somethingWentWrong'), 'error');
    }
  };

  const handleSendVoice = async (audioUrl, duration) => {
    try {
      await sendVoiceMessage('owner', partner, audioUrl, duration);
    } catch (err) {
      showToast(err.message || t('somethingWentWrong'), 'error');
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', flexDirection: 'column', position: 'fixed', inset: 0, padding: '10px 20px', background: 'var(--background)', zIndex: 100 }}>
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
                {msg.text && <TranslatedText text={msg.text} targetLang={language} />}
                {msg.imageUrl && (
                  <img src={msg.imageUrl} alt="Message Attachment" style={{ width: '100%', maxWidth: '300px', height: 'auto', marginTop: '6px', borderRadius: '8px' }} />
                )}
                {msg.audioUrl && (
                  <audio controls src={msg.audioUrl} style={{ width: '100%', height: '32px', marginTop: '6px', borderRadius: '8px' }} />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      <VoiceInput 
        onSubmit={handleSendMessage} 
        onAudioSubmit={handleSendVoice} 
        onImageSubmit={async (imageUrl) => {
          try {
            await sendMessage('owner', partner, '', imageUrl);
          } catch (err) {
            showToast(err.message || t('somethingWentWrong'), 'error');
          }
        }}
        placeholder={t('messageWithName', { name: partner })} 
      />
    </motion.div>
  );
}
