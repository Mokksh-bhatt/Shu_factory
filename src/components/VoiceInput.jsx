import { useState, useRef } from 'react';
import { Mic, MicOff, Send } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAppContext } from '../context/AppContext';

export default function VoiceInput({ onSubmit, placeholder, value, onChange }) {
  const [text, setText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const { t } = useAppContext();

  const controlled = typeof value === 'string' && typeof onChange === 'function';
  const inputValue = controlled ? value : text;

  const updateText = (next) => {
    if (controlled) {
      onChange(next);
    } else {
      setText(next);
    }
  };

  const toggleListen = () => {
    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      alert(t('voiceUnsupported'));
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      const current = controlled ? value || '' : text;
      updateText((current ? `${current} ` : '') + transcript);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const handleSubmit = () => {
    if (inputValue.trim()) {
      onSubmit(inputValue.trim());
      updateText('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex', flexDirection: 'column', gap: '8px',
        background: 'var(--surface)', borderRadius: '16px', padding: '12px',
      }}
    >
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={toggleListen}
          animate={isListening ? { scale: [1, 1.1, 1] } : {}}
          transition={isListening ? { repeat: Infinity, duration: 1 } : {}}
          style={{
            width: '48px', height: '48px', minWidth: '48px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isListening ? 'var(--error)' : 'var(--surface-high)',
            color: 'white', border: 'none',
          }}
        >
          {isListening ? <Mic size={22} /> : <MicOff size={22} />}
        </motion.button>

        <input
          type="text"
          value={inputValue}
          onChange={(e) => updateText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || t('typeOrSpeak')}
          style={{ flex: 1, borderRadius: '24px', padding: '12px 16px', fontSize: '1rem' }}
        />

        <motion.button
          whileTap={{ scale: 0.9, opacity: inputValue.trim() ? 1 : 0.5 }}
          onClick={handleSubmit}
          disabled={!inputValue.trim()}
          style={{
            width: '48px', height: '48px', minWidth: '48px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: inputValue.trim() ? 'var(--primary)' : 'var(--surface-high)',
            color: 'white', border: 'none',
            opacity: inputValue.trim() ? 1 : 0.5,
          }}
        >
          <Send size={20} />
        </motion.button>
      </div>
    </motion.div>
  );
}
