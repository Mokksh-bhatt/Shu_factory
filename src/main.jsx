import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Capture beforeinstallprompt EARLY — before React mounts
window.__pwaInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__pwaInstallPrompt = e;
});

// DO NOT manually register OneSignalSDKWorker.js here!
// OneSignal SDK handles its own service worker registration via the init() in index.html.
// Manually registering the same file causes origin conflicts and kills push tokens.

if ('serviceWorker' in navigator) {
  // ── Alarm SW: handles background notifications + PLAY_ALARM messages ──────
  navigator.serviceWorker
    .register('/alarm-sw.js', { scope: '/' })
    .then((reg) => {
      console.log('[AlarmSW] Registered, scope:', reg.scope);
      // Expose helper so AppContext can post messages to this SW
      window.__alarmSwReg = reg;
    })
    .catch((err) => console.warn('[AlarmSW] Registration failed:', err));

  // ── Listen for PLAY_ALARM messages from the alarm SW ─────────────────────
  // This fires when a push or SHOW_ALARM message arrives and a tab is open.
  // We use a shared AudioContext (created once on first user interaction).
  let alarmCtx = null;

  function ensureAudioCtx() {
    if (!alarmCtx) {
      alarmCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return alarmCtx;
  }

  // Unlock AudioContext on first touch/click so it works in background later
  function unlockAudio() {
    try {
      const ctx = ensureAudioCtx();
      if (ctx.state === 'suspended') ctx.resume();
    } catch {}
    document.removeEventListener('click', unlockAudio);
    document.removeEventListener('touchstart', unlockAudio);
  }
  document.addEventListener('click', unlockAudio, { once: true });
  document.addEventListener('touchstart', unlockAudio, { once: true });

  function playAlarmTones(mode) {
    try {
      const ctx = ensureAudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume().then(() => playAlarmTones(mode));
        return;
      }
      const playTone = (freq, startOffset, duration, type, peak = 1) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startOffset);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.5, ctx.currentTime + startOffset + duration);
        gain.gain.setValueAtTime(0, ctx.currentTime + startOffset);
        gain.gain.linearRampToValueAtTime(peak, ctx.currentTime + startOffset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startOffset + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + startOffset);
        osc.stop(ctx.currentTime + startOffset + duration);
      };
      if (mode === 'chat') {
        // High, pleasant dual chime for chat messages
        playTone(1320, 0, 0.08, 'sine', 0.5);
        playTone(1760, 0.08, 0.15, 'sine', 0.5);
      } else if (mode === 'owner') {
        playTone(880,  0,    0.15, 'square',   1.0);
        playTone(1100, 0.18, 0.15, 'sawtooth', 1.0);
        playTone(880,  0.36, 0.15, 'square',   1.0);
        playTone(1320, 0.54, 0.2,  'sawtooth', 1.0);
        playTone(880,  0.78, 0.15, 'square',   0.9);
      } else {
        playTone(880,  0,    0.25, 'square',   1.0);
        playTone(1100, 0.28, 0.25, 'sawtooth', 1.0);
        playTone(880,  0.56, 0.25, 'square',   1.0);
        playTone(1100, 0.84, 0.2,  'sawtooth', 0.95);
        playTone(880,  1.08, 0.25, 'square',   1.0);
      }
    } catch (err) {
      console.warn('[AlarmSW] Audio playback failed:', err);
    }
  }

  // Expose so AppContext can call directly too
  window.__playAlarmSW = playAlarmTones;

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'PLAY_ALARM') {
      playAlarmTones(event.data.mode || 'worker');
    }
  });

  // Unregister the legacy kill-switch sw.js if still present
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (const reg of registrations) {
      if (reg.active?.scriptURL.endsWith('/sw.js')) {
        reg.unregister().then(() => console.log('[AlarmSW] Removed stale sw.js'));
      }
    }
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
