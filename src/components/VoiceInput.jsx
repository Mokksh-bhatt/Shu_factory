import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Send, X, Play, Square, Image as ImageIcon, Paperclip, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAppContext } from '../context/AppContext';
import { useToast } from './Toast';

// Cloudinary config — set these in your .env file
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '';
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '';

export default function VoiceInput({ onSubmit, placeholder, value, onChange, onAudioSubmit, onImageSubmit, onDocumentSubmit }) {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  // Staged files for combined text+media submission
  const [stagedFile, setStagedFile] = useState(null);
  const [stagedFileType, setStagedFileType] = useState(null); // 'image' or 'document'
  const [stagedFileName, setStagedFileName] = useState('');
  
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const { t } = useAppContext();
  const showToast = useToast();
  const fileInputRef = useRef(null);
  const docInputRef = useRef(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowAttachMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const controlled = typeof value === 'string' && typeof onChange === 'function';
  const inputValue = controlled ? value : text;

  const updateText = (next) => {
    if (controlled) {
      onChange(next);
    } else {
      setText(next);
    }
  };

  const handleFileSelect = (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === 'image' && !file.type.startsWith('image/')) {
      showToast('Please select an image file', 'warning');
      return;
    }

    setStagedFile(file);
    setStagedFileType(type);
    setStagedFileName(file.name);
    setShowAttachMenu(false);
    
    // reset inputs
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (docInputRef.current) docInputRef.current.value = '';
  };

  const cancelStagedFile = () => {
    setStagedFile(null);
    setStagedFileType(null);
    setStagedFileName('');
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
      
      // cancel any staged file if we start recording
      cancelStagedFile();

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
      const formData = new FormData();
      formData.append('file', audioBlob, `voice_${Date.now()}.webm`);
      formData.append('upload_preset', UPLOAD_PRESET);
      formData.append('resource_type', 'video');

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

      if (onAudioSubmit) {
        onAudioSubmit(downloadUrl, recordingDuration);
      } else {
        onSubmit(`🎙️ Voice Note (${formatDuration(recordingDuration)})`);
      }

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

  const handleSubmit = async () => {
    const hasText = !!inputValue.trim();
    if (!hasText && !stagedFile) return;

    if (stagedFile) {
      setUploading(true);
      try {
        if (!CLOUD_NAME || !UPLOAD_PRESET) {
          throw new Error('Cloudinary not configured in environment variables');
        }

        const formData = new FormData();
        formData.append('file', stagedFile);
        formData.append('upload_preset', UPLOAD_PRESET);
        const resourceType = stagedFileType === 'document' ? 'raw' : 'auto';
        formData.append('resource_type', resourceType);

        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
          { method: 'POST', body: formData }
        );

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.error?.message || `Upload failed (${res.status})`);
        }

        const data = await res.json();
        const fileUrl = data.secure_url;

        // Pass everything required: text + the file url. We use the existing callbacks but pass text!
        // Wait, the parent components only have onSubmit, onImageSubmit, onDocumentSubmit.
        // If we want them to accept text, we should update the parent. But wait! The easiest way is to let onSubmit accept multiple parameters!
        // OR we can just check if onImageSubmit exists. If it does, we call it. If there is text, how do we send it?
        // Actually, let's call `onSubmit(text, null, imageUrl, documentUrl, documentName)` if the parent supports it.
        // We will call the standard callbacks with the text appended, but since we are modifying parents, let's pass it cleanly.
        
        // Let's pass the text via the callback directly so parent can decide.
        // Actually, we've updated the parents to expect: onImageSubmit(url, text), onDocumentSubmit(url, name, text).
        // Let's modify the calls here.
        if (stagedFileType === 'image' && onImageSubmit) {
          await onImageSubmit(fileUrl, inputValue.trim());
        } else if (stagedFileType === 'document' && onDocumentSubmit) {
          await onDocumentSubmit(fileUrl, stagedFileName, inputValue.trim());
        } else {
          // fallback if parent doesn't support file
          onSubmit(inputValue.trim() + `\n\n[Attached: ${stagedFileName}]`);
        }
        
      } catch (err) {
        console.error('File upload error:', err);
        showToast('Failed to upload file. Please try again.', 'error');
        setUploading(false);
        return; // Don't clear text if upload failed
      }
      setUploading(false);
      cancelStagedFile();
    } else {
      onSubmit(inputValue.trim());
    }

    if (!controlled) {
      updateText('');
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
      {/* Staged File Preview */}
      {stagedFile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--surface-high)', borderRadius: '8px' }}>
          {stagedFileType === 'image' ? <ImageIcon size={18} /> : <FileText size={18} />}
          <span style={{ flex: 1, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {stagedFileName}
          </span>
          <button onClick={cancelStagedFile} style={{ background: 'transparent', border: 'none', color: 'var(--on-surface-variant)', cursor: 'pointer', padding: '4px' }}>
            <X size={16} />
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          ref={fileInputRef}
          onChange={(e) => handleFileSelect(e, 'image')}
        />
        <input
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
          style={{ display: 'none' }}
          ref={docInputRef}
          onChange={(e) => handleFileSelect(e, 'document')}
        />

        <div style={{ position: 'relative' }} ref={menuRef}>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            disabled={uploading}
            style={{
              width: '48px', height: '48px', minWidth: '48px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--surface-high)',
              color: 'white', border: 'none',
              opacity: uploading ? 0.5 : 1,
            }}
          >
            <Paperclip size={22} />
          </motion.button>
          
          {showAttachMenu && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              style={{
                position: 'absolute',
                bottom: '110%',
                left: '0',
                background: 'var(--surface-high)',
                borderRadius: '12px',
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 100
              }}
            >
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: 'transparent', border: 'none', color: 'var(--on-surface)',
                  padding: '8px 12px', borderRadius: '8px', cursor: 'pointer',
                  width: '100%', textAlign: 'left', whiteSpace: 'nowrap'
                }}
              >
                <ImageIcon size={18} /> Image
              </button>
              <button
                onClick={() => docInputRef.current?.click()}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: 'transparent', border: 'none', color: 'var(--on-surface)',
                  padding: '8px 12px', borderRadius: '8px', cursor: 'pointer',
                  width: '100%', textAlign: 'left', whiteSpace: 'nowrap'
                }}
              >
                <FileText size={18} /> Document
              </button>
            </motion.div>
          )}
        </div>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={startRecording}
          disabled={uploading || stagedFile}
          style={{
            width: '48px', height: '48px', minWidth: '48px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--surface-high)',
            color: 'white', border: 'none',
            opacity: uploading || stagedFile ? 0.5 : 1,
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
          whileTap={{ scale: 0.9, opacity: (inputValue.trim() || stagedFile) ? 1 : 0.5 }}
          onClick={handleSubmit}
          disabled={(!inputValue.trim() && !stagedFile) || uploading}
          style={{
            width: '48px', height: '48px', minWidth: '48px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: (inputValue.trim() || stagedFile) ? 'var(--primary)' : 'var(--surface-high)',
            color: 'white', border: 'none',
            opacity: (inputValue.trim() || stagedFile) ? 1 : 0.5,
          }}
        >
          <Send size={20} />
        </motion.button>
      </div>
    </motion.div>
  );
}
