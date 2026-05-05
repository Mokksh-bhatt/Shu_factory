import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Send, X, Play, Square } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAppContext } from '../context/AppContext';
import { useToast } from './Toast';

// Cloudinary config — set these in your .env file
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '';
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '';

export default function VoiceInput({ onSubmit, placeholder, value, onChange, onAudioSubmit }) {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const { t } = useAppContext();
  const showToast = useToast();

  const controlled = typeof value === 'string' && typeof onChange === 'function';
  const inputValue = controlled ? value : text;

  const updateText = (next) => {
    if (controlled) {
      onChange(next);
    } else {
      setText(next);
    }
  };

  // Clean up audio URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm'
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(250); // collect data every 250ms
      setIsRecording(true);
      setRecordingDuration(0);
      setAudioBlob(null);
      setAudioUrl(null);

      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access error:', err);
      showToast(t('voiceUnsupported') || 'Microphone access denied', 'warning');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const cancelRecording = () => {
    if (isRecording) stopRecording();
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setRecordingDuration(0);
  };

  const sendAudio = async () => {
    if (!audioBlob) return;

    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      showToast('Voice notes not configured. Set Cloudinary env vars.', 'error');
      return;
    }

    setUploading(true);
    try {
      // Upload to Cloudinary (free, no SDK needed)
      const formData = new FormData();
      formData.append('file', audioBlob, `voice_${Date.now()}.webm`);
      formData.append('upload_preset', UPLOAD_PRESET);
      formData.append('resource_type', 'video'); // Cloudinary treats audio as video

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`,
        { method: 'POST', body: formData }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Upload failed (${res.status})`);
      }

      const data = await res.json();
      const downloadUrl = data.secure_url;

      // If parent supports audio, send as audio; otherwise fallback to text
      if (onAudioSubmit) {
        onAudioSubmit(downloadUrl, recordingDuration);
      } else {
        onSubmit(`🎙️ Voice Note (${formatDuration(recordingDuration)})`);
      }

      // Clean up
      setAudioBlob(null);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
      setRecordingDuration(0);
    } catch (err) {
      console.error('Audio upload error:', err);
      showToast('Failed to send voice note. Try again.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSubmit = () => {
    if (inputValue.trim()) {
      onSubmit(inputValue.trim());
      // Only clear text in uncontrolled mode — in controlled mode the parent manages it
      if (!controlled) {
        updateText('');
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  // Recording mode UI
  if (isRecording || audioBlob) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          display: 'flex', flexDirection: 'column', gap: '10px',
          background: 'var(--surface)', borderRadius: '16px', padding: '12px',
        }}
      >
        {isRecording ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <motion.div
              animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
              style={{
                width: '14px', height: '14px', borderRadius: '50%',
                background: 'var(--error)', flexShrink: 0,
              }}
            />
            <span style={{ flex: 1, fontWeight: '600', fontSize: '1rem', color: 'var(--error)' }}>
              Recording... {formatDuration(recordingDuration)}
            </span>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={stopRecording}
              style={{
                width: '48px', height: '48px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--error)', color: 'white', border: 'none',
              }}
            >
              <Square size={20} fill="white" />
            </motion.button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--on-surface-variant)' }}>
                🎙️ Voice Note — {formatDuration(recordingDuration)}
              </span>
            </div>
            {audioUrl && (
              <audio controls src={audioUrl} style={{ width: '100%', height: '36px', borderRadius: '8px' }} />
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={cancelRecording}
                style={{
                  flex: 1, padding: '10px', borderRadius: '12px', border: 'none',
                  background: 'var(--surface-high)', color: 'var(--on-surface-variant)',
                  fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}
              >
                <X size={18} /> Cancel
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={sendAudio}
                disabled={uploading}
                style={{
                  flex: 1, padding: '10px', borderRadius: '12px', border: 'none',
                  background: 'var(--primary)', color: 'white',
                  fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  opacity: uploading ? 0.6 : 1,
                }}
              >
                <Send size={18} /> {uploading ? 'Sending...' : 'Send'}
              </motion.button>
            </div>
          </div>
        )}
      </motion.div>
    );
  }

  // Default text + mic UI
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
          onClick={startRecording}
          style={{
            width: '48px', height: '48px', minWidth: '48px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--surface-high)',
            color: 'white', border: 'none',
          }}
        >
          <Mic size={22} />
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
