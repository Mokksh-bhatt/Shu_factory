/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { signInAnonymously, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../firebase';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  where,
  getDocs,
  deleteDoc,
  getDoc,
  Timestamp,
} from 'firebase/firestore';
import { DEFAULT_LANGUAGE, LANGUAGE_OPTIONS, translate } from '../i18n';
import { isStrongEnoughPassword, isValidWorkerName } from '../utils/security';
import { Capacitor, registerPlugin } from '@capacitor/core';
const ShuHelper = registerPlugin('ShuHelper');

export const APP_VERSION_CODE = 3;

const AppContext = createContext();
export const useAppContext = () => useContext(AppContext);

const USER_STORAGE_KEY = 'shu_user';
const MAX_TEXT_LENGTH = 500;
const OWNER_EMAIL = (import.meta.env.VITE_OWNER_EMAIL || '').trim().toLowerCase();
const REQUIRE_OWNER_CLAIM = import.meta.env.VITE_REQUIRE_OWNER_CLAIM === 'true';
// The display name of the primary/hardcoded owner — always visible in the worker chat list
const MAIN_OWNER_NAME = (import.meta.env.VITE_OWNER_NAME || 'Himanshu').trim();

const DEPARTMENTS = ['General', 'Accounts', 'Plant Supervisor', 'Packing Supervisor', 'Maintenance', 'HR', 'Key Person'];

const DEPARTMENT_TRANSLATION_KEYS = {
  General: 'departmentGeneral',
  Accounts: 'departmentAccounts',
  'Plant Supervisor': 'departmentPlantSupervisor',
  'Packing Supervisor': 'departmentPackingSupervisor',
  Maintenance: 'departmentMaintenance',
  HR: 'departmentHR',
  'Key Person': 'departmentKeyPerson',
};

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function cleanText(input) {
  return typeof input === 'string' ? input.trim() : '';
}

function assertMaxText(value, max, message) {
  if (value.length > max) {
    throw new Error(message);
  }
}

function normalizeFirestoreError(err) {
  const code = err?.code || '';
  if (code.includes('permission-denied')) return 'Missing or insufficient permissions. Please login again.';
  if (code.includes('unavailable')) return 'Network issue. Try again.';
  if (code.includes('invalid-argument')) return 'Invalid input. Please check fields.';
  if (code.includes('unauthenticated')) return 'Session expired. Please login again.';
  return err?.message || 'Operation failed.';
}

export const AppProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => safeParse(localStorage.getItem(USER_STORAGE_KEY), null));
  const [language, setLanguageState] = useState(() => {
    const fromUser = safeParse(localStorage.getItem(USER_STORAGE_KEY), null)?.language;
    return fromUser || DEFAULT_LANGUAGE;
  });
  const [authReady, setAuthReady] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem('shu_notifications') !== 'false';
  });
  const [notifPermissionDenied, setNotifPermissionDenied] = useState(false);
  // Show once on native until worker confirms they enabled battery + autostart + overlay
  const [showGodModeModal, setShowGodModeModal] = useState(() =>
    Capacitor.isNativePlatform() && !!currentUser && localStorage.getItem('shu_god_mode_v2') !== 'true'
  );
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastReadTimestamp, setLastReadTimestamp] = useState(() => {
    const stored = localStorage.getItem('shu_last_read_ts');
    return stored ? parseInt(stored, 10) : 0;
  });
  const [unseenAlert, setUnseenAlert] = useState(null); // { count, tasks } for in-app banner
  const [activeChat, setActiveChat] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [messages, setMessages] = useState([]);
  const [overdueReminders, setOverdueReminders] = useState([]);
  const [updateAvailable, setUpdateAvailable] = useState(null);

  // God Mode setup tracking
  const [cordovaReady, setCordovaReady] = useState(false);
  const [manufacturer, setManufacturer] = useState('');
  const [batteryOk, setBatteryOk] = useState(false);
  const [overlayOk, setOverlayOk] = useState(false);
  const [autoStartTapped, setAutoStartTapped] = useState(() => localStorage.getItem('shu_autostart_tapped') === 'true');
  const [pauseAppTapped, setPauseAppTapped] = useState(() => localStorage.getItem('shu_pause_app_tapped') === 'true');

  // Owner notification preferences
  const [ownerNotifPrefs, setOwnerNotifPrefsState] = useState(() => {
    return safeParse(localStorage.getItem('shu_owner_notif_prefs'), {
      chatMessages: true,
      taskReminders: true,
      taskCompletions: true,
    });
  });

  const setOwnerNotifPrefs = useCallback((prefs) => {
    setOwnerNotifPrefsState(prefs);
    localStorage.setItem('shu_owner_notif_prefs', JSON.stringify(prefs));
  }, []);

  const audioCtxRef = useRef(null);
  const activeChatRef = useRef(null);
  const prevTasksRef = useRef([]);

  const t = useCallback((key, vars = {}) => translate(language, key, vars), [language]);



  const ensureWorkerAuth = useCallback(async () => {
    if (auth.currentUser) return; // already authenticated
    try {
      await signInAnonymously(auth);
    } catch (err) {
      console.warn('Anonymous login disabled in Firebase, falling back to dedicated service account...');
      try {
        await signInWithEmailAndPassword(auth, 'worker@shonceramics.com', 'worker123456');
      } catch (fallbackErr) {
        try {
          await createUserWithEmailAndPassword(auth, 'worker@shonceramics.com', 'worker123456');
        } catch (createErr) {
          // All auth methods failed — log but do NOT throw.
          // The login page will still render; actual login calls will retry auth.
          console.error('All auth methods failed. Enable Anonymous or Email auth in Firebase.', createErr);
        }
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        // Always call ensureWorkerAuth — idempotent if already signed in.
        // Without this, Firestore listeners start before Firebase restores the
        // anonymous auth session from cache (owner cold-start race condition).
        await ensureWorkerAuth();
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        if (active) setAuthReady(true);
      }
    };
    run();
    return () => { active = false; };
  }, [ensureWorkerAuth]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('shu_notifications', String(notificationsEnabled));
  }, [notificationsEnabled]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'appSettings'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (Number(data.minVersionCode) > APP_VERSION_CODE && data.apkUrl) {
          setUpdateAvailable({ version: data.latestVersionName || 'New Update', apkUrl: data.apkUrl });
        } else {
          setUpdateAvailable(null);
        }
      } else {
        setUpdateAvailable(null);
      }
    }, (err) => console.error('Update config error:', err));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (Capacitor.isNativePlatform() && currentUser && localStorage.getItem('shu_god_mode_v2') !== 'true') {
      setShowGodModeModal(true);
    }
  }, [currentUser]);

  // Background mode: keep app alive forever, override back button
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const enable = () => {
      if (window.cordova && cordova.plugins && cordova.plugins.backgroundMode) {
        cordova.plugins.backgroundMode.enable();
        cordova.plugins.backgroundMode.overrideBackButton();
        cordova.plugins.backgroundMode.setDefaults({
          title: 'Factory System Active',
          text: 'Waiting for tasks...',
          resume: true,
          hidden: false,
        });
      }
    };
    document.addEventListener('deviceready', enable, { once: true });
    // Also try immediately in case deviceready already fired
    enable();
  }, []);

  // Deviceready + battery + overlay check: populates manufacturer, checks battery exemption on start and on resume
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const checkBatteryAndOverlay = async () => {
      try {
        const result = await ShuHelper.checkPermissions();
        setBatteryOk(!!result.batteryOk);
        setOverlayOk(!!result.overlayOk);
      } catch (err) {
        console.warn('ShuHelper check failed, falling back to legacy cordova check');
        if (window.cordova) {
          window.cordova.exec((r) => setBatteryOk(!!r), () => {}, 'BackgroundModeExt', 'checkBattery', []);
          window.cordova.exec((r) => setOverlayOk(!!r), () => {}, 'BackgroundModeExt', 'checkOverlay', []);
        }
      }
    };
    const onReady = () => {
      setCordovaReady(true);
      setManufacturer((window.device?.manufacturer || '').toLowerCase());
      checkBatteryAndOverlay();
    };
    document.addEventListener('deviceready', onReady, { once: true });
    // deviceready fires before React mounts in Capacitor — catch it if already fired
    if (window.cordova && window.device) onReady();
    document.addEventListener('resume', checkBatteryAndOverlay);
    return () => document.removeEventListener('resume', checkBatteryAndOverlay);
  }, []);

  // Native OneSignal boot: initialize + request permission + detect denial
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const init = async () => {
      try {
        const getNativeOneSignal = () => {
          return new Promise((resolve) => {
            let attempts = 0;
            const check = () => {
              const os = window.plugins?.OneSignal;
              if (os) {
                resolve(os);
              } else if (attempts < 15) {
                attempts++;
                setTimeout(check, 1000);
              } else {
                resolve(null);
              }
            };
            check();
          });
        };

        const OneSignal = await getNativeOneSignal();
        if (!OneSignal) {
          throw new Error('window.plugins.OneSignal is undefined after 15s');
        }
        
        OneSignal.initialize('3ca07406-7594-42ef-ade4-39b98a4ef565');
        const granted = await OneSignal.Notifications.requestPermission(true);
        if (!granted) setNotifPermissionDenied(true);
      } catch (err) {
        console.warn('[OneSignal][native] init failed:', err);
      }
    };
    init();
  }, []);

  // Native OneSignal login — sets external_id so pushes reach this device by workerName (standardized lowercase/trimmed)
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !currentUser?.name) return;
    const login = async () => {
      try {
        const getNativeOneSignal = () => {
          return new Promise((resolve) => {
            let attempts = 0;
            const check = () => {
              const os = window.plugins?.OneSignal;
              if (os) {
                resolve(os);
              } else if (attempts < 15) {
                attempts++;
                setTimeout(check, 1000);
              } else {
                resolve(null);
              }
            };
            check();
          });
        };

        const OneSignal = await getNativeOneSignal();
        if (OneSignal) {
          const externalId = currentUser.name.toLowerCase().trim();
          // Logout first to clear any stale/duplicate subscriptions from previous sessions
          try { await OneSignal.logout(); } catch {}
          await OneSignal.login(externalId);

          const subId = OneSignal.User?.pushSubscription?.id;
          const optedIn = OneSignal.User?.pushSubscription?.optedIn;
          console.log(`[OneSignal] login OK | id=${externalId} | subscriptionId=${subId} | optedIn=${optedIn}`);

          try {
            if (OneSignal.User?.addTags) {
              await OneSignal.User.addTags({ role: currentUser.role || 'worker', name: externalId });
            }
          } catch (tagErr) {
            console.warn('[OneSignal] tag sync failed:', tagErr);
          }
        } else {
          console.warn('[OneSignal] SDK not found after 15s — push will not work');
        }
      } catch (err) {
        console.warn('[OneSignal][native] login failed:', err);
      }
    };
    login();
  }, [currentUser?.name, currentUser?.role]);

  // OneSignal: web SDK opt-in (skipped on native — handled by the boot sequence above)
  useEffect(() => {
    if (!notificationsEnabled || !currentUser) return;
    if (Capacitor.isNativePlatform()) return;

    let cancelled = false;

    const setupOneSignal = async (attempt = 1) => {
      if (cancelled) return;
      try {
        // Request browser Notification permission first
        if ('Notification' in window) {
          const perm = Notification.permission;
          if (perm === 'default') {
            const result = await Notification.requestPermission();
            console.log('[Notifications] Browser permission:', result);
          } else if (perm === 'denied') {
            console.warn('[Notifications] Browser permission DENIED. User must enable in browser settings.');
          }
        }

        // Wait for OneSignal SDK to be available
        if (!window.OneSignal) {
          if (attempt < 5) {
            console.log(`[OneSignal] SDK not ready, retry ${attempt}/5...`);
            setTimeout(() => setupOneSignal(attempt + 1), 2000);
          } else {
            console.warn('[OneSignal] SDK never loaded after 5 attempts');
          }
          return;
        }

        const OneSignal = window.OneSignal;
        
        // Request OneSignal push permission
        const optedIn = await OneSignal.Notifications.permission;
        console.log('[OneSignal] Current permission:', optedIn);
        
        if (!optedIn) {
          await OneSignal.Notifications.requestPermission();
          console.log('[OneSignal] Permission requested');
        }

        // Tag the user so we can target pushes by name (standardized lowercase/trimmed)
        const nameKey = (currentUser.name || currentUser.id || 'anonymous').toLowerCase().trim();
        await OneSignal.login(nameKey);
        await OneSignal.User.addTags({
          role: currentUser.role || 'worker',
          name: nameKey,
        });

        // Check subscription status
        const subId = await OneSignal.User.PushSubscription.id;
        const subToken = await OneSignal.User.PushSubscription.token;
        console.log('[OneSignal] Subscribed! ID:', subId, 'Token exists:', !!subToken);
        console.log('[OneSignal] Tags set — name:', currentUser.name, 'role:', currentUser.role);
      } catch (err) {
        console.warn('[OneSignal] Setup error:', err);
        if (attempt < 3) {
          setTimeout(() => setupOneSignal(attempt + 1), 3000);
        }
      }
    };

    // Start after a short delay
    const timer = setTimeout(() => setupOneSignal(1), 1500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [notificationsEnabled, currentUser]);

  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  useEffect(() => {
    if (!currentUser) {
      setUnreadCount(0);
      return;
    }
    const cleanMe = currentUser.name?.toLowerCase().trim();
    if (!cleanMe) {
      setUnreadCount(0);
      return;
    }
    const count = messages.filter(msg => {
      const ts = msg.createdAt?.toMillis ? msg.createdAt.toMillis() : (msg.createdAt instanceof Date ? msg.createdAt.getTime() : 0);
      if (ts <= lastReadTimestamp) return false;

      const cleanSender = msg.sender?.toLowerCase().trim();
      const cleanTarget = msg.target?.toLowerCase().trim();

      // Don't count our own messages
      if (cleanSender === cleanMe) return false;

      // Direct DM
      if (cleanTarget === cleanMe) return true;

      // Legacy role-based targets — only main owner sees legacy 'owner'-addressed messages
      const isMainOwner = cleanMe === MAIN_OWNER_NAME.toLowerCase().trim();
      if (currentUser.role === 'owner' && isMainOwner && (cleanTarget === 'owner' || cleanTarget === 'admin@shonceramics.com')) return true;
      if (currentUser.role === 'worker' && cleanTarget === 'worker') return true;

      // Global messages not sent by us
      if (msg.target === 'GLOBAL') return true;

      return false;
    }).length;
    setUnreadCount(count);
  }, [messages, currentUser, lastReadTimestamp]);

  const postAlarmToSW = useCallback((title, body, mode) => {
    try {
      const reg = window.__alarmSwReg;
      if (reg?.active) {
        reg.active.postMessage({ type: 'SHOW_ALARM', title, body, mode });
      }
    } catch {}
  }, []);

  // Request notification permission + ensure alarm channel exists on startup
  useEffect(() => {
    import('@capacitor/local-notifications').then(({ LocalNotifications: LN }) => {
      LN.requestPermissions().catch(() => {});
      // Delete old channel so Android picks up the new visibility=0 setting
      LN.deleteChannel({ id: 'shu_alarm_channel_v4' }).catch(() => {});
      LN.createChannel({
        id: 'shu_alarm_channel_v4', name: 'Factory Alerts',
        importance: 4, visibility: 0, vibration: true, lights: true, lightColor: '#FF0000',
      }).catch(() => {});
      LN.createChannel({
        id: 'shu_chat_channel', name: 'Factory Chat',
        importance: 4, visibility: 0, vibration: true, lights: true, lightColor: '#00FF00',
      }).catch(() => {});
    }).catch(() => {});
  }, []);

  // Fire a loud native notification via the alarm channel
  const fireNativeAlarm = useCallback(async (title, body, channelId = 'shu_alarm_channel_v4') => {
    try {
      const { LocalNotifications: LN } = await import('@capacitor/local-notifications');
      const id = Math.floor(Math.random() * 2_000_000_000) + 1;
      await LN.schedule({
        notifications: [{ id, title, body, channelId, smallIcon: 'ic_launcher', iconColor: '#028a3f' }],
      });
      if (channelId === 'shu_alarm_channel_v4') {
        if ('vibrate' in navigator) navigator.vibrate([600, 200, 600, 200, 600, 200, 1000, 400, 600]);
      } else {
        if ('vibrate' in navigator) navigator.vibrate([300, 100, 300]);
      }
    } catch (err) {
      console.warn('[LocalNotif] failed:', err);
    }
  }, []);

  const playLoudNotification = useCallback((mode = 'worker') => {
    // Let SW-registered main.jsx audio engine handle it if available (works in background)
    if (window.__playAlarmSW) {
      window.__playAlarmSW(mode);
      return;
    }
    if (mode === 'MUTE') return; // Just in case
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      // Resume if suspended (e.g. after backgrounding on Android)
      if (ctx.state === 'suspended') {
        ctx.resume().then(() => playLoudNotification(mode));
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
        // Loud multi-burst alert for owner
        playTone(880, 0, 0.15, 'square', 1.0);
        playTone(1100, 0.18, 0.15, 'sawtooth', 1.0);
        playTone(880, 0.36, 0.15, 'square', 1.0);
        playTone(1320, 0.54, 0.2, 'sawtooth', 1.0);
        playTone(880, 0.78, 0.15, 'square', 0.9);
      } else {
        playTone(880, 0, 0.25, 'square', 1.0);
        playTone(1100, 0.28, 0.25, 'sawtooth', 1.0);
        playTone(880, 0.56, 0.25, 'square', 1.0);
        playTone(1100, 0.84, 0.2, 'sawtooth', 0.95);
        playTone(880, 1.08, 0.25, 'square', 1.0);
      }
    } catch (err) {
      console.error('Audio failed', err);
    }
  }, []);

  const sendSystemNotification = useCallback((title, options) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const loudOptions = {
      icon: '/logo.jpg',
      badge: '/logo.jpg',
      requireInteraction: true,
      renotify: true,
      vibrate: [600, 200, 600, 200, 600, 200, 1000, 400, 600],
      ...options,
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification(title, loudOptions);
      }).catch(() => {
        new Notification(title, loudOptions);
      });
    } else {
      new Notification(title, options);
    }
  }, []);

  // OneSignal: send a push notification to a specific user by external_id (set by OneSignal.login())
  const sendOneSignalPush = useCallback(async (targetName, title, body, data = {}) => {
    try {
      const notificationType = data.type || 'task';
      const payload = {
        app_id: '3ca07406-7594-42ef-ade4-39b98a4ef565',
        headings: { en: title },
        contents: { en: body },
        priority: 10,
        ttl: 86400,
        android_visibility: 0,
        android_led_color: notificationType === 'chat' ? 'FF00FF00' : 'FFFF0000',
        data: {
          type: notificationType,
          ...data,
        },
      };

      const cleanTarget = targetName ? targetName.toLowerCase().trim() : null;

      if (data.targetRole) {
        // Role broadcast — reach all devices with this role tag
        payload.filters = [{ field: 'tag', key: 'role', relation: '=', value: data.targetRole }];
        if (cleanTarget) {
          payload.filters.push({ operator: 'OR' });
          payload.filters.push({ field: 'tag', key: 'name', relation: '=', value: cleanTarget });
        }
      } else if (cleanTarget) {
        // Specific user — target by external_id (set by OneSignal.login(name))
        // This is more reliable than tag filters which can fail to sync
        payload.include_external_user_ids = [cleanTarget];
        payload.channel_for_external_user_ids = 'push';
      } else {
        return;
      }

      // Use Cloudflare Worker proxy to avoid browser CORS block on OneSignal API.
      // Falls back to direct OneSignal call on native (Android WebView has no CORS restriction).
      const notifyUrl = import.meta.env.VITE_NOTIFY_URL || 'https://onesignal.com/api/v1/notifications';
      const isProxy = notifyUrl !== 'https://onesignal.com/api/v1/notifications';
      const headers = isProxy
        ? { 'Content-Type': 'application/json' }
        : { 'Content-Type': 'application/json', 'Authorization': 'Key os_v2_app_hsqhibtvsrbo7lpehg4yutxvmudaalv5ns6urpufuqqj66cvrlism7hq7fbb6fci5vglro6foamj2t3mna33ojufqdgodrtsyhcax5i' };
      if (!isProxy) payload.app_id = '3ca07406-7594-42ef-ade4-39b98a4ef565';
      const resp = await fetch(notifyUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const result = await resp.json().catch(() => null);
      if (!resp.ok || result?.errors) {
        console.warn('[OneSignal] push failed:', resp.status, JSON.stringify(result));
      } else {
        console.log('[OneSignal] push sent:', result?.id, '→ recipients:', result?.recipients);
      }
    } catch (err) {
      console.warn('[OneSignal] push error:', err);
    }
  }, []);

  useEffect(() => {
    if (!authReady) return undefined;
    const unsub = onSnapshot(
      query(collection(db, 'workers'), orderBy('createdAt', 'desc')),
      (snap) => setWorkers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.error('Workers listener error:', err),
    );
    return unsub;
  }, [authReady]);

  // Admin accounts listener
  useEffect(() => {
    if (!authReady) return undefined;
    const unsub = onSnapshot(
      collection(db, 'admins'),
      (snap) => setAdmins(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.error('Admins listener error:', err),
    );
    return unsub;
  }, [authReady]);

  useEffect(() => {
    if (!authReady) return undefined;
    const unsub = onSnapshot(
      query(collection(db, 'tasks'), orderBy('createdAt', 'desc')),
      (snap) => {
        const newTasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // Task notification logic — play sound + show SW notification (works in background)
        if (currentUser?.role === 'worker' && notificationsEnabled) {
          const prevIds = new Set(prevTasksRef.current.map(t => t.id));
          const incoming = newTasks.filter(t => {
            if (prevIds.has(t.id)) return false;
            if (t.status !== 'PENDING') return false;
            if (t.workerName?.toLowerCase() !== currentUser.name?.toLowerCase()) return false;
            
            // Avoid old tasks triggering alarm sounds on app startup
            const ts = t.createdAt?.toMillis ? t.createdAt.toMillis() : (t.createdAt?.seconds ? t.createdAt.seconds * 1000 : 0);
            if (!ts) return false;
            return (Date.now() - ts) < 60000; // 60 seconds limit
          });

          // Sound handled entirely by OneSignal push — no in-app duplicate
        }

        // Owner notification: when a worker adds a reply to a task
        if (currentUser?.role === 'owner' && notificationsEnabled) {
          const prevMap = {};
          prevTasksRef.current.forEach(t => { prevMap[t.id] = t.replies?.length || 0; });
          for (const task of newTasks) {
            const prevCount = prevMap[task.id] || 0;
            const newCount = task.replies?.length || 0;
            if (newCount > prevCount && prevCount >= 0 && prevTasksRef.current.length > 0) {
              const lastReply = task.replies?.[task.replies.length - 1];
              const replyTs = lastReply?.createdAt?.toMillis ? lastReply.createdAt.toMillis() : (lastReply?.createdAt?.seconds ? lastReply.createdAt.seconds * 1000 : 0);
              
              // Only alert for brand new replies within 60 seconds
              if (replyTs && (Date.now() - replyTs) < 60000) {
                if (document.visibilityState === 'visible') {
                  playLoudNotification('chat');
                }
                break;
              }
            }
          }
        }

        // Owner task notifications removed entirely based on user request
        prevTasksRef.current = newTasks;
        setTasks(newTasks);
      },
      (err) => console.error('Tasks listener error:', err),
    );
    return unsub;
  }, [authReady, currentUser, notificationsEnabled]);

  useEffect(() => {
    if (!authReady) return undefined;
    const unsub = onSnapshot(
      query(collection(db, 'messages'), orderBy('createdAt', 'asc')),
      (snap) => {
        setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => console.error('Messages listener error:', err),
    );
    return unsub;
  }, [authReady]);

  useEffect(() => {
    if (!currentUser || !notificationsEnabled || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    const msgTs = lastMsg.createdAt?.toMillis ? lastMsg.createdAt.toMillis() : (lastMsg.createdAt instanceof Date ? lastMsg.createdAt.getTime() : 0);
    if (msgTs && Date.now() - msgTs < 2000) {
      const cleanSender = lastMsg.sender?.toLowerCase().trim();
      const cleanMe = currentUser.name?.toLowerCase().trim();
      const cleanTarget = lastMsg.target?.toLowerCase().trim();
      const cleanActiveChat = activeChatRef.current?.toLowerCase().trim();

      // Don't chime for our own messages
      if (cleanSender === cleanMe) return;

      const isMainOwner = cleanMe === MAIN_OWNER_NAME.toLowerCase().trim();
      const isTargetedToMe = cleanTarget === cleanMe ||
                             (currentUser.role === 'worker' && (cleanTarget === 'worker' || lastMsg.target === 'GLOBAL')) ||
                             (currentUser.role === 'owner' && isMainOwner && (cleanTarget === 'owner' || cleanTarget === 'admin@shonceramics.com'));

      if (isTargetedToMe) {
        // Only chime if we are not currently looking at this active chat
        const isCurrentlyViewingChat = cleanActiveChat === cleanSender || 
                                       (cleanActiveChat === 'global' && lastMsg.target === 'GLOBAL') ||
                                       (cleanActiveChat === 'owner' && cleanTarget === 'owner');

        if (!isCurrentlyViewingChat) {
          if (document.visibilityState === 'visible') {
            playLoudNotification('chat');
          }
        }
      }
    }
  }, [messages, currentUser, notificationsEnabled, playLoudNotification, postAlarmToSW]);

  // 24-hour overdue task reminder system
  useEffect(() => {
    if (!currentUser || !notificationsEnabled) return;

    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const sentRemindersKey = `shu_reminders_sent_${currentUser.name || 'owner'}`;

    const checkOverdue = () => {
      const now = Date.now();
      const pendingTasks = tasks.filter(t => t.status === 'PENDING');
      const sentReminders = safeParse(localStorage.getItem(sentRemindersKey), {});
      const newOverdue = [];

      pendingTasks.forEach(task => {
        const ts = task.createdAt?.toMillis ? task.createdAt.toMillis() : (task.createdAt?.seconds ? task.createdAt.seconds * 1000 : 0);
        if (!ts) return;
        const age = now - ts;

        if (age >= TWENTY_FOUR_HOURS) {
          newOverdue.push(task.id);

          // Check if we already sent a reminder in this 24h window
          const lastSent = sentReminders[task.id] || 0;
          if (now - lastSent >= TWENTY_FOUR_HOURS) {
            sentReminders[task.id] = now;

            // For workers: remind about their own overdue tasks
            if (currentUser.role === 'worker' && task.workerName?.toLowerCase() === currentUser.name?.toLowerCase()) {
              if (document.visibilityState === 'visible') playLoudNotification('worker');
              const hoursAgo = Math.floor(age / (60 * 60 * 1000));
              // Show in-app alert for overdue task
              setUnseenAlert({ count: 1, tasks: [{ id: task.id, description: `⏰ OVERDUE (${hoursAgo}h): ${task.description}` }] });
              sendOneSignalPush(
                currentUser.name,
                `⏰ Task Overdue — ${hoursAgo}h ago`,
                `"${task.description.slice(0, 60)}${task.description.length > 60 ? '...' : ''}"\n⏳ Assigned ${hoursAgo} hours ago. Please complete this task.${task.important ? '\n🔴 This is marked IMPORTANT!' : ''}`,
                { type: 'task' }
              );
            }
            // For owner: show overdue alert too
            if (currentUser.role === 'owner') {
              if (document.visibilityState === 'visible') playLoudNotification('owner');
              const hoursAgo = Math.floor(age / (60 * 60 * 1000));
              sendSystemNotification(`⏰ Task Overdue — ${hoursAgo}h`, {
                body: `${task.workerName}: "${task.description.slice(0, 60)}"`,
              });
            }
          }
        }
      });

      // Clean up old entries
      Object.keys(sentReminders).forEach(id => {
        if (now - sentReminders[id] > 7 * 24 * 60 * 60 * 1000) {
          delete sentReminders[id];
        }
      });
      localStorage.setItem(sentRemindersKey, JSON.stringify(sentReminders));
      setOverdueReminders(newOverdue);
    };

    checkOverdue();
    const interval = setInterval(checkOverdue, 5 * 60 * 1000); // Check every 5 minutes
    return () => clearInterval(interval);
  }, [currentUser, tasks, notificationsEnabled, playLoudNotification, sendOneSignalPush]);

  // 2-minute aggressive reminder for UNSEEN tasks (worker only)
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'worker' || !notificationsEnabled) return;

    const TWO_MINUTES = 2 * 60 * 1000;
    const unseenReminderKey = `shu_unseen_reminders_${currentUser.name}`;

    const checkUnseen = () => {
      const now = Date.now();
      // Only remind about tasks at least 2 minutes old \u2014 brand-new tasks are
      // handled by the tasks listener sound + the addTask OneSignal push.
      // This prevents the double-alarm that fired the moment a task arrived.
      const myUnseenTasks = tasks.filter(t => {
        if (t.status !== 'PENDING') return false;
        if (t.workerName?.toLowerCase() !== currentUser.name?.toLowerCase()) return false;
        if (t.seenByWorker) return false;
        if (t.replies && t.replies.length > 0) return false;
        const ts = t.createdAt?.toMillis?.() || (t.createdAt?.seconds ? t.createdAt.seconds * 1000 : 0);
        return ts > 0 && (now - ts) >= TWO_MINUTES;
      });

      if (myUnseenTasks.length === 0) {
        setUnseenAlert(null);
        return;
      }

      const lastBuzz = parseInt(localStorage.getItem(unseenReminderKey) || '0', 10);
      if (now - lastBuzz < TWO_MINUTES) return;

      localStorage.setItem(unseenReminderKey, String(now));

      setUnseenAlert({
        count: myUnseenTasks.length,
        tasks: myUnseenTasks.slice(0, 3).map(t => t.description.slice(0, 50)),
      });

      // Only send push when app is not visible (foregroundWillDisplay suppresses it if it is)
      if (document.visibilityState !== 'visible') {
        const taskList = myUnseenTasks.slice(0, 3).map(t =>
          `\u2022 ${t.important ? '\ud83d\udd34 ' : ''}${t.description.slice(0, 40)}${t.description.length > 40 ? '...' : ''}`
        ).join('\n');
        const extra = myUnseenTasks.length > 3 ? `\n...and ${myUnseenTasks.length - 3} more` : '';
        sendOneSignalPush(
          currentUser.name,
          `\ud83d\udd14 ${myUnseenTasks.length} Unseen Task${myUnseenTasks.length > 1 ? 's' : ''} \u2014 Open Now!`,
          `${taskList}${extra}\n\n\ud83d\udc46 Open the app to view and respond.`,
          { type: 'task' }
        );
      }
    };

    checkUnseen();
    const interval = setInterval(checkUnseen, TWO_MINUTES);
    return () => clearInterval(interval);
  }, [currentUser, tasks, notificationsEnabled, playLoudNotification, sendOneSignalPush]);

  const getDepartmentLabel = useCallback(
    (dept) => {
      const key = DEPARTMENT_TRANSLATION_KEYS[dept] || DEPARTMENT_TRANSLATION_KEYS.General;
      return t(key);
    },
    [t],
  );

  const createWorkerAccount = async ({ name, password, category }) => {
    const cleanName = cleanText(name);
    const cleanPassword = cleanText(password);

    if (!cleanName || !cleanPassword) {
      throw new Error(t('nameAndPasswordRequired'));
    }
    if (!isValidWorkerName(cleanName)) {
      throw new Error(t('workerNameInvalid'));
    }
    if (!isStrongEnoughPassword(cleanPassword)) {
      throw new Error(t('passwordTooWeak'));
    }

    const duplicate = workers.some((worker) => worker.name?.toLowerCase() === cleanName.toLowerCase());
    if (duplicate) {
      throw new Error(t('workerExists'));
    }

    try {
      await addDoc(collection(db, 'workers'), {
        name: cleanName,
        nameKey: cleanName.toLowerCase(),
        category: DEPARTMENTS.includes(category) ? category : 'General',
        password: cleanPassword,
        language: null,
        online: false,
        createdAt: serverTimestamp(),
        lastLoginAt: null,
      });
    } catch (err) {
      throw new Error(normalizeFirestoreError(err), { cause: err });
    }

    return { name: cleanName, password: cleanPassword, category: DEPARTMENTS.includes(category) ? category : 'General' };
  };

  // Create admin account
  const createAdminAccount = async ({ name, password }) => {
    const cleanName = cleanText(name);
    const cleanPassword = cleanText(password);

    if (!cleanName || !cleanPassword) {
      throw new Error(t('nameAndPasswordRequired'));
    }
    if (!isValidWorkerName(cleanName)) {
      throw new Error(t('workerNameInvalid'));
    }
    if (!isStrongEnoughPassword(cleanPassword)) {
      throw new Error(t('passwordTooWeak'));
    }

    // Check duplicates in both workers and admins
    const dupWorker = workers.some((w) => w.name?.toLowerCase() === cleanName.toLowerCase());
    const dupAdmin = admins.some((a) => a.name?.toLowerCase() === cleanName.toLowerCase());
    if (dupWorker || dupAdmin) {
      throw new Error(t('workerExists'));
    }

    try {
      await addDoc(collection(db, 'admins'), {
        name: cleanName,
        nameKey: cleanName.toLowerCase(),
        password: cleanPassword,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      throw new Error(normalizeFirestoreError(err), { cause: err });
    }

    return { name: cleanName, password: cleanPassword };
  };

  const deleteAdmin = async (adminId) => {
    try {
      await deleteDoc(doc(db, 'admins', adminId));
    } catch (err) {
      throw new Error(normalizeFirestoreError(err), { cause: err });
    }
  };

  const updateWorkerPassword = async (workerId, nextPassword) => {
    const cleanPassword = cleanText(nextPassword);
    if (!isStrongEnoughPassword(cleanPassword)) {
      throw new Error(t('passwordTooWeak'));
    }
    try {
      await updateDoc(doc(db, 'workers', workerId), { password: cleanPassword });
    } catch (err) {
      throw new Error(normalizeFirestoreError(err), { cause: err });
    }
  };

  const login = async (role, name, category, password, preferredLanguage = DEFAULT_LANGUAGE) => {
    const cleanName = cleanText(name);
    const cleanPassword = cleanText(password);

    if (!cleanName || !cleanPassword) {
      throw new Error(t('nameAndPasswordRequired'));
    }

    if (role === 'worker') {
      await ensureWorkerAuth();

      const cleanNameKey = cleanName.toLowerCase();
      let workerDoc = null;

      try {
        const byKey = await getDocs(query(collection(db, 'workers'), where('nameKey', '==', cleanNameKey)));
        if (!byKey.empty) {
          workerDoc = byKey.docs.find(d => (d.data().password || '').trim() === cleanPassword) || byKey.docs[0];
        }

        if (!workerDoc) {
          const byName = await getDocs(query(collection(db, 'workers'), where('name', '==', cleanName)));
          if (!byName.empty) {
            workerDoc = byName.docs.find(d => (d.data().password || '').trim() === cleanPassword) || byName.docs[0];
          }
        }

        if (!workerDoc) {
          const fromState = workers.filter((worker) => (worker.name || '').trim().toLowerCase() === cleanNameKey);
          if (fromState.length > 0) {
            const match = fromState.find(w => (w.password || '').trim() === cleanPassword) || fromState[0];
            const fetched = await getDoc(doc(db, 'workers', match.id));
            if (fetched.exists()) workerDoc = fetched;
          }
        }
      } catch (err) {
        throw new Error(normalizeFirestoreError(err), { cause: err });
      }

      if (!workerDoc) {
        throw new Error(t('workerNotFound'));
      }

      const worker = workerDoc.data();
      const storedPassword = (worker.password || '').trim();
      
      if (!storedPassword || storedPassword !== cleanPassword) {
        throw new Error(t('workerPasswordWrong'));
      }

      if (!worker.nameKey) {
        try {
          await updateDoc(doc(db, 'workers', workerDoc.id), { nameKey: worker.name?.toLowerCase() || cleanName.toLowerCase() });
        } catch {
          // no-op
        }
      }

      // Device Binding Logic
      let currentDeviceId = localStorage.getItem('shu_device_id');
      if (!currentDeviceId) {
        currentDeviceId = Date.now().toString(36) + Math.random().toString(36).substring(2);
        localStorage.setItem('shu_device_id', currentDeviceId);
      }

      if (!worker.deviceId) {
        // First login: Bind device
        try {
          await updateDoc(doc(db, 'workers', workerDoc.id), { deviceId: currentDeviceId });
        } catch (err) {
          console.warn('Failed to bind device ID:', err);
        }
      } else if (worker.deviceId !== currentDeviceId) {
        // Bound to another device
        throw new Error(t('accountLockedToAnotherDevice') || 'Account is registered on another device. Please contact the owner to unlock.');
      }

      const hasPreferredLanguage = Boolean(preferredLanguage);
      const needsLanguageSelection = !worker.language && !hasPreferredLanguage;
      const resolvedLanguage = worker.language || preferredLanguage || DEFAULT_LANGUAGE;
      const updateData = {
        online: true,
        lastLoginAt: serverTimestamp(),
        language: resolvedLanguage,
      };

      try {
        await updateDoc(doc(db, 'workers', workerDoc.id), updateData);
      } catch (err) {
        throw new Error(normalizeFirestoreError(err), { cause: err });
      }

      const user = {
        role: 'worker',
        workerId: workerDoc.id,
        name: worker.name,
        category: worker.category || category || 'General',
        language: resolvedLanguage,
        needsLanguageSelection,
      };

      setLanguageState(resolvedLanguage);
      setCurrentUser(user);
      // OneSignal login handled by the login useEffect when currentUser.name is set
      return user;
    }

    if (role === 'owner') {
      // Check admin accounts in Firestore first
      const cleanNameKey = cleanName.toLowerCase();
      const adminMatch = admins.find(
        (a) => (a.nameKey || a.name?.toLowerCase()) === cleanNameKey && (a.password || '').trim() === cleanPassword
      );

      // Also check hardcoded owner password
      const isHardcodedOwner = cleanPassword === 'Varuu@1202';

      if (!adminMatch && !isHardcodedOwner) {
        throw new Error(t('ownerPasswordWrong'));
      }

      await ensureWorkerAuth(); // Ensure database access

      const resolvedLanguage = preferredLanguage || DEFAULT_LANGUAGE;
      const user = {
        role: 'owner',
        name: adminMatch ? adminMatch.name : MAIN_OWNER_NAME,
        category: 'Admin',
        language: resolvedLanguage,
      };
      setLanguageState(resolvedLanguage);
      setCurrentUser(user);
      // OneSignal login handled by the login useEffect when currentUser.name is set
      return user;
    }
  };

  const setLanguage = async (nextLanguage) => {
    if (!LANGUAGE_OPTIONS.some((opt) => opt.value === nextLanguage)) {
      return;
    }

    setLanguageState(nextLanguage);
    setCurrentUser((prev) => (prev ? { ...prev, language: nextLanguage } : prev));

    if (currentUser?.role === 'worker' && currentUser?.workerId) {
      try {
        await updateDoc(doc(db, 'workers', currentUser.workerId), { language: nextLanguage });
      } catch (err) {
        console.error('Error updating language:', err);
      }
    }
  };

  const markMessagesRead = useCallback(() => {
    const now = Date.now();
    setLastReadTimestamp(now);
    localStorage.setItem('shu_last_read_ts', String(now));
    setUnreadCount(0);
  }, []);

  const toggleOnline = async (isOnline) => {
    if (currentUser?.role === 'worker' && currentUser?.workerId) {
      try {
        await updateDoc(doc(db, 'workers', currentUser.workerId), { online: isOnline });
      } catch (err) {
        console.error('Error toggling online status:', err);
      }
    }
  };

  const logout = async () => {
    if (currentUser?.role === 'worker') {
      try {
        if (currentUser.workerId) {
          await updateDoc(doc(db, 'workers', currentUser.workerId), { online: false });
        }
      } catch (err) {
        console.error('Error updating worker status:', err);
      }
    }

    if (currentUser?.role === 'owner') {
      try {
        await signOut(auth);
      } catch (err) {
        console.error('Owner signout error:', err);
      }
      await ensureWorkerAuth();
    }

    // Aggressively clear ALL cached login/app data
    setCurrentUser(null);
    setActiveChat(null);
    setShowGodModeModal(false);
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem('shu_notifications');
    localStorage.removeItem('shu_last_read_ts');
    localStorage.removeItem('shu_owner_notif_prefs');
    // Clear all shu_ prefixed keys
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('shu_')) localStorage.removeItem(key);
    });
    // Clear service worker caches
    if ('caches' in window) {
      caches.keys().then(keys => keys.forEach(key => caches.delete(key)));
    }
  };

  const deleteWorker = async (workerId) => {
    try {
      await deleteDoc(doc(db, 'workers', workerId));
    } catch (err) {
      console.error(err);
      throw new Error(normalizeFirestoreError(err), { cause: err });
    }
  };

  const updateWorker = async (workerId, data) => {
    try {
      const payload = { ...data };
      if (payload.category && !DEPARTMENTS.includes(payload.category)) {
        payload.category = 'General';
      }
      await updateDoc(doc(db, 'workers', workerId), payload);
    } catch (err) {
      console.error(err);
      throw new Error(normalizeFirestoreError(err), { cause: err });
    }
  };

  const addTask = async (description, workerName, important = false, audioUrl = null, imageUrl = null, documentUrl = null, documentName = null) => {
    const cleanDescription = cleanText(description);
    if (!cleanDescription && !audioUrl && !imageUrl && !documentUrl) return;
    if (cleanDescription) assertMaxText(cleanDescription, MAX_TEXT_LENGTH, t('taskTooLong'));

    try {
      await addDoc(collection(db, 'tasks'), {
        description: cleanDescription || (audioUrl ? '🎤 Voice Task' : documentUrl ? '' : imageUrl ? '' : '📋 Task'),
        workerName,
        status: 'PENDING',
        important: important,
        inputMeta: null,
        response: null,
        replies: [],
        seenByWorker: null,
        audioUrl: audioUrl || null,
        imageUrl: imageUrl || null,
        documentUrl: documentUrl || null,
        documentName: documentName || null,
        createdAt: serverTimestamp(),
        createdBy: currentUser?.name || 'owner',
      });
      const worker = workers.find(w => w.name?.toLowerCase().trim() === workerName?.toLowerCase().trim());
      const dept = worker?.category || 'General';
      const pushBody = audioUrl
        ? `🎤 Voice task assigned\n👤 From: ${currentUser?.name || 'Owner'}\n🏭 Dept: ${dept}`
        : documentUrl
        ? `📄 Document task assigned\n👤 From: ${currentUser?.name || 'Owner'}\n🏭 Dept: ${dept}`
        : imageUrl
        ? `🖼️ Image task assigned\n👤 From: ${currentUser?.name || 'Owner'}\n🏭 Dept: ${dept}`
        : `${important ? '⚠️ IMPORTANT: ' : ''}${cleanDescription}\n👤 From: ${currentUser?.name || 'Owner'}\n🏭 Dept: ${dept}`;
      sendOneSignalPush(
        workerName,
        important ? '🔴 Urgent Task from Owner' : (audioUrl ? '🎤 Voice Task Assigned' : documentUrl ? '📄 Document Task Assigned' : imageUrl ? '🖼️ Image Task Assigned' : '📋 New Task Assigned'),
        pushBody,
        { type: 'task' }
      );
    } catch (err) {
      console.error('Error adding task:', err);
      throw new Error(normalizeFirestoreError(err), { cause: err });
    }
  };

  const toggleTaskImportant = async (taskId, currentImportant) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), { important: !currentImportant });
    } catch (err) {
      console.error('Error toggling importance:', err);
    }
  };

  const respondToTask = async (taskId, response, status = 'DONE') => {
    const cleanResponse = cleanText(response);
    if (cleanResponse) {
      assertMaxText(cleanResponse, MAX_TEXT_LENGTH, t('responseTooLong'));
    }

    try {
      const updates = {
        status,
        respondedAt: serverTimestamp(),
      };
      if (cleanResponse) updates.response = cleanResponse;
      await updateDoc(doc(db, 'tasks', taskId), updates);

      // Notify owner when worker completes a task
      if (status === 'DONE' && currentUser?.role === 'worker') {
        const currentTask = tasks.find((t) => t.id === taskId);
        const creator = currentTask?.createdBy !== 'owner' ? currentTask?.createdBy : null;
        
        if (creator) {
          sendOneSignalPush(
            creator,
            '✅ Task Completed',
            `${currentUser.name} completed: "${cleanResponse || 'No response'}"`,
            { type: 'chat' }
          );
        } else {
          sendOneSignalPush(
            null,
            '✅ Task Completed',
            `${currentUser.name} completed: "${cleanResponse || 'No response'}"`,
            { targetRole: 'owner', type: 'chat' }
          );
        }
      }
    } catch (err) {
      console.error('Error responding to task:', err);
      throw new Error(normalizeFirestoreError(err), { cause: err });
    }
  };

  // Acknowledge a task (reply without completing)
  const acknowledgeTask = async (taskId, replyText, audioUrl = null, imageUrl = null, documentUrl = null, documentName = null) => {
    const cleanReply = cleanText(replyText);
    if (!cleanReply && !audioUrl && !imageUrl && !documentUrl) return;
    if (cleanReply) assertMaxText(cleanReply, MAX_TEXT_LENGTH, t('responseTooLong'));

    try {
      const taskRef = doc(db, 'tasks', taskId);
      const taskSnap = await getDoc(taskRef);
      const taskData = taskSnap.data();
      const existingReplies = taskData?.replies || [];
      const newReply = {
        text: cleanReply || '',
        from: currentUser?.name || 'worker',
        at: Date.now(),
      };
      if (audioUrl) newReply.audioUrl = audioUrl;
      if (imageUrl) newReply.imageUrl = imageUrl;
      if (documentUrl) {
        newReply.documentUrl = documentUrl;
        newReply.documentName = documentName;
      }

      await updateDoc(taskRef, {
        replies: [...existingReplies, newReply],
        seenByWorker: taskData?.seenByWorker || Timestamp.now(),
      });

      // Notify owner about the acknowledgment
      const creator = taskData?.createdBy !== 'owner' ? taskData?.createdBy : null;
      const pushPrefix = documentUrl ? `📄 Document` : audioUrl ? '🎙️ Voice Note' : `"${cleanReply}"`;
      if (creator) {
        sendOneSignalPush(
          creator,
          `💬 ${currentUser?.name || 'Worker'} replied`,
          `${pushPrefix}\n📋 Task: ${(taskData?.description || '').slice(0, 50)}`,
          { type: 'chat' }
        );
      } else {
        sendOneSignalPush(
          null,
          `💬 ${currentUser?.name || 'Worker'} replied`,
          `${pushPrefix}\n📋 Task: ${(taskData?.description || '').slice(0, 50)}`,
          { targetRole: 'owner', type: 'chat' }
        );
      }
    } catch (err) {
      console.error('Error acknowledging task:', err);
      throw new Error(normalizeFirestoreError(err), { cause: err });
    }
  };

  // Mark all pending tasks as seen by the current worker
  const markTasksSeen = useCallback(async () => {
    if (!currentUser || currentUser.role !== 'worker') return;
    const myUnseenTasks = tasks.filter(
      t => t.status === 'PENDING' &&
        t.workerName?.toLowerCase() === currentUser.name?.toLowerCase() &&
        !t.seenByWorker
    );
    for (const task of myUnseenTasks) {
      try {
        await updateDoc(doc(db, 'tasks', task.id), { seenByWorker: Timestamp.now() });
      } catch (err) {
        console.error('Error marking task seen:', err);
      }
    }
    // Clear all pending notifications from the notification bar
    if (Capacitor.isNativePlatform()) {
      try {
        const os = window.plugins?.OneSignal;
        if (os?.Notifications?.clearAll) os.Notifications.clearAll();
      } catch {}
      try {
        const { LocalNotifications: LN } = await import('@capacitor/local-notifications');
        const pending = await LN.getPending();
        if (pending.notifications.length > 0) {
          await LN.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
        }
      } catch {}
    }
    // Reset unseen reminder so it doesn't fire again immediately
    localStorage.removeItem(`shu_unseen_reminders_${currentUser.name}`);
    setUnseenAlert(null);
  }, [currentUser, tasks]);

  const deleteTask = async (taskId) => {
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
    } catch (err) {
      console.error(err);
      throw new Error(normalizeFirestoreError(err), { cause: err });
    }
  };

  const deleteMessage = async (msgId) => {
    try {
      await deleteDoc(doc(db, 'messages', msgId));
    } catch (err) {
      console.error(err);
    }
  };

  const sendMessage = async (sender, target, text, imageUrl = null, documentUrl = null, documentName = null) => {
    const cleanTextStr = cleanText(text);
    if (!cleanTextStr && !imageUrl && !documentUrl) return;
    if (cleanTextStr) assertMaxText(cleanTextStr, MAX_TEXT_LENGTH, t('messageTooLong'));

    try {
      await addDoc(collection(db, 'messages'), {
        sender,
        target,
        text: cleanTextStr || (audioUrl ? '🎙️ Voice Note' : documentUrl ? '' : imageUrl ? '' : ''),
        imageUrl: imageUrl || null,
        documentUrl: documentUrl || null,
        documentName: documentName || null,
        createdAt: serverTimestamp(),
      });
      // Push notification to the target via OneSignal
      if (target !== 'GLOBAL') {
        const senderDisplayName = currentUser?.name || sender;
        const cleanTarget = target.toLowerCase().trim();
        const mainOwnerClean = MAIN_OWNER_NAME.toLowerCase().trim();
        
        // Is this message going to the "Owner" (either by specific name, generic 'owner' string, or admin email)
        const isGenericOwnerTarget = cleanTarget === 'owner' || 
                                     cleanTarget === 'admin@shonceramics.com' || 
                                     cleanTarget === 'himanshu' ||
                                     cleanTarget === mainOwnerClean;

        if (currentUser?.role === 'owner') {
          // Owner/Admin to worker
          sendOneSignalPush(
            target,
            `💬 Message from ${senderDisplayName}`,
            `"${cleanTextStr.length > 80 ? cleanTextStr.slice(0, 80) + '...' : cleanTextStr}"\n👤 ${senderDisplayName} sent you a message`,
            { type: 'chat' }
          );
        } else if (isGenericOwnerTarget) {
          // Worker to Owner — target by external_id only to avoid double notifications
          sendOneSignalPush(
            mainOwnerClean,
            `💬 ${senderDisplayName} sent a message`,
            `"${cleanTextStr.length > 80 ? cleanTextStr.slice(0, 80) + '...' : cleanTextStr}"`,
            { type: 'chat' }
          );
        } else {
          // Worker to specific sub-admin
          sendOneSignalPush(
            target,
            `💬 ${senderDisplayName} sent a message`,
            `"${cleanTextStr.length > 80 ? cleanTextStr.slice(0, 80) + '...' : cleanTextStr}"`,
            { type: 'chat' }
          );
        }
      }
    } catch (err) {
      console.error('Error sending message:', err);
      throw new Error(normalizeFirestoreError(err), { cause: err });
    }
  };

  const sendVoiceMessage = async (sender, target, audioUrl, duration) => {
    try {
      await addDoc(collection(db, 'messages'), {
        sender,
        target,
        text: `🎤 Voice Note (${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')})`,
        audioUrl,
        createdAt: serverTimestamp(),
      });
      if (target !== 'GLOBAL') {
        const senderDisplayName = currentUser?.name || sender;
        const cleanTarget = target.toLowerCase().trim();
        const mainOwnerClean = MAIN_OWNER_NAME.toLowerCase().trim();
        const isGenericOwnerTarget = cleanTarget === 'owner' || 
                                     cleanTarget === 'admin@shonceramics.com' || 
                                     cleanTarget === mainOwnerClean;

        if (currentUser?.role === 'owner') {
          sendOneSignalPush(target, `🎤 Voice Message from ${senderDisplayName}`, `${senderDisplayName} sent you a voice note`, { type: 'chat' });
        } else if (isGenericOwnerTarget) {
          sendOneSignalPush(mainOwnerClean, `🎤 ${senderDisplayName} sent a voice note`, 'Tap to listen', { type: 'chat' });
        } else {
          sendOneSignalPush(target, `🎤 ${senderDisplayName} sent a voice note`, 'Tap to listen', { type: 'chat' });
        }
      }
    } catch (err) {
      console.error('Error sending voice message:', err);
      throw new Error(normalizeFirestoreError(err), { cause: err });
    }
  };

  const getConversation = useCallback((partnerName) => {
    if (!partnerName || !currentUser?.name) return [];
    const cleanPartner = partnerName.toLowerCase().trim();
    const cleanMe = currentUser.name.toLowerCase().trim();
    const mainOwnerClean = MAIN_OWNER_NAME.toLowerCase().trim();
    const isMainOwner = cleanMe === mainOwnerClean;
    const isPartnerMainOwner = cleanPartner === mainOwnerClean;

    return messages.filter((message) => {
      const cleanSender = message.sender?.toLowerCase().trim();
      const cleanTarget = message.target?.toLowerCase().trim();

      // Direct DM — always match
      if (cleanSender === cleanPartner && cleanTarget === cleanMe) return true;
      if (cleanSender === cleanMe && cleanTarget === cleanPartner) return true;

      // Global broadcasts always show
      if (message.target === 'GLOBAL') return true;

      if (currentUser?.role === 'worker' && isPartnerMainOwner) {
        // Worker chatting with main owner slot: show legacy 'owner'-targeted messages they sent,
        // and replies from the main owner (not from other admins)
        const isLegacyOwnerTarget = cleanTarget === 'owner' || cleanTarget === 'admin@shonceramics.com' || cleanTarget === mainOwnerClean;
        if (cleanSender === cleanMe && isLegacyOwnerTarget) return true;
        if ((cleanSender === 'owner' || cleanSender === mainOwnerClean) && cleanTarget === cleanMe) return true;
      } else if (currentUser?.role === 'owner' && isMainOwner) {
        // Main owner sees legacy 'owner' messages too
        const isLegacyOwnerTarget = cleanTarget === 'owner' || cleanTarget === 'admin@shonceramics.com';
        if (cleanSender === cleanPartner && isLegacyOwnerTarget) return true;
        if (cleanSender === 'owner' && cleanTarget === cleanPartner) return true;
      }
      // Non-main-owner admins: only direct messages (handled above) — no cross-admin visibility

      return false;
    });
  }, [messages, currentUser?.name, currentUser?.role]);

  // allAdmins: the hardcoded main owner + all Firestore sub-admins, deduped.
  // Workers use this list to pick who to chat with.
  const allAdmins = useMemo(() => {
    const mainOwner = { id: 'main-owner', name: MAIN_OWNER_NAME, isMainOwner: true };
    const subAdmins = admins.filter((a) => a.name?.toLowerCase() !== MAIN_OWNER_NAME.toLowerCase());
    return [mainOwner, ...subAdmins];
  }, [admins]);

  const contextValue = useMemo(() => ({
    currentUser,
    admins,
    allAdmins,
    language,
    setLanguage,
    languageOptions: LANGUAGE_OPTIONS,
    t,
    departments: DEPARTMENTS,
    getDepartmentLabel,

    login,
    logout,
    createWorkerAccount,
    updateWorkerPassword,
    toggleOnline,

    tasks,
    addTask,
    respondToTask,
    acknowledgeTask,
    markTasksSeen,
    deleteTask,
    toggleTaskImportant,
    overdueReminders,

    messages,
    sendMessage,
    sendVoiceMessage,
    getConversation,
    deleteMessage,
    unreadCount,
    markMessagesRead,

    workers,
    updateWorker,
    deleteWorker,

    admins,
    createAdminAccount,
    deleteAdmin,

    playLoudNotification,
    setNotificationsEnabled,
    notificationsEnabled,
    ownerNotifPrefs,
    setOwnerNotifPrefs,

    activeChat,
    setActiveChat,
    authReady,
    lastReadTimestamp,
    unseenAlert,
    setUnseenAlert,
    updateAvailable,
  }), [
    currentUser, language, t, getDepartmentLabel, login, logout, createWorkerAccount,
    updateWorkerPassword, toggleOnline, tasks, addTask, respondToTask, acknowledgeTask,
    markTasksSeen, deleteTask,
    toggleTaskImportant, overdueReminders,
    messages, sendMessage, sendVoiceMessage, getConversation, deleteMessage, unreadCount, markMessagesRead,
    workers, updateWorker, deleteWorker, playLoudNotification, setNotificationsEnabled,
    notificationsEnabled, ownerNotifPrefs, setOwnerNotifPrefs, activeChat, setActiveChat, authReady,
    lastReadTimestamp, unseenAlert, setUnseenAlert, updateAvailable
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {showGodModeModal && (() => {
        const autoStartPath = (() => {
          const m = manufacturer;
          if (m.includes('xiaomi') || m.includes('redmi') || m.includes('poco'))
            return 'Settings → Apps → Manage Apps → Shon Ceramics → Autostart → ON';
          if (m.includes('samsung'))
            return 'Settings → Apps → Shon Ceramics → Battery → Allow Background Activity → ON';
          if (m.includes('huawei') || m.includes('honor'))
            return 'Settings → Apps → Shon Ceramics → Battery → App Launch → Manage Manually → enable all 3 toggles';
          if (m.includes('oppo') || m.includes('realme'))
            return "Settings → Battery → Battery Optimization → Shon Ceramics → Don't Optimize";
          if (m.includes('oneplus'))
            return "Settings → Battery → Battery Optimization → Shon Ceramics → Don't Optimize";
          if (m.includes('vivo'))
            return 'Settings → More Settings → Applications → Autostart Management → enable Shon Ceramics';
          return '';
        })();
        const box = { background: '#1a1a1a', borderRadius: 10, padding: '1rem 1.2rem', maxWidth: 360, width: '100%', textAlign: 'left' };
        const mkBtn = (bg, color, disabled = false) => ({
          padding: '0.75rem 1.5rem', fontSize: '0.95rem', fontWeight: 'bold',
          borderRadius: '8px', border: 'none', backgroundColor: disabled ? '#333' : bg,
          color: disabled ? '#777' : color, cursor: disabled ? 'not-allowed' : 'pointer', width: '100%',
        });
        return (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 100000, backgroundColor: '#0a0a0a', color: '#fff',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '1.5rem', textAlign: 'center', gap: '1rem', overflowY: 'auto',
          }}>
            {/* <img src="/logo.jpg" alt="Shon Ceramics" style={{ width: 200, borderRadius: 8, marginBottom: 4 }} /> */}
            <h1 style={{ fontSize: '1.2rem', margin: 0, color: '#ff4444' }}>CRITICAL SETUP REQUIRED</h1>
            <p style={{ margin: 0, color: '#ccc', fontSize: '0.85rem', maxWidth: 340 }}>
              Without these settings you will miss task alerts. This is mandatory.
            </p>



            {/* Step 1 — Battery */}
            <div style={box}>
              <p style={{ margin: '0 0 0.5rem', fontWeight: 700, color: batteryOk ? '#22c55e' : '#fbbf24' }}>
                {batteryOk ? '✅ STEP 1 DONE — Battery Unrestricted' : 'STEP 1 — Remove Battery Restriction'}
              </p>
              {batteryOk ? (
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#86efac' }}>Battery optimization is disabled. App will stay alive.</p>
              ) : (
                <>
                  <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: '#ccc', lineHeight: 1.5 }}>
                    Tap below. When asked, select <strong style={{ color: '#fff' }}>"Allow"</strong>. Then come back here — this page will auto-verify.
                  </p>
                  <button style={mkBtn('#3b82f6', '#fff')} onClick={() => {
                    ShuHelper.openBatterySettings().catch(() => {
                      if (window.cordova) window.cordova.exec(null, null, 'BackgroundModeExt', 'battery', []);
                    });
                  }}>
                    → Open Battery Settings Now
                  </button>
                </>
              )}
            </div>

            {/* Step 2 — AutoStart */}
            <div style={box}>
              <p style={{ margin: '0 0 0.5rem', fontWeight: 700, color: autoStartTapped ? '#22c55e' : '#fbbf24' }}>
                {autoStartTapped ? '✅ STEP 2 DONE — AutoStart Enabled' : 'STEP 2 — Enable AutoStart'}
              </p>
              {autoStartTapped ? (
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#86efac' }}>AutoStart has been enabled for this device.</p>
              ) : (
                <>
                  <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: '#ccc', lineHeight: 1.5 }}>
                    Tap below to open AutoStart settings. Find <strong style={{ color: '#fff' }}>Shon Ceramics</strong> and toggle it ON. Then come back.
                  </p>
                  <button style={{ ...mkBtn('#8b5cf6', '#fff'), marginBottom: '0.5rem' }} onClick={() => {
                    if (window.cordova) {
                      window.cordova.exec(null, null, 'BackgroundModeExt', 'appstart', [false]);
                    }
                    setAutoStartTapped(true);
                    localStorage.setItem('shu_autostart_tapped', 'true');
                  }}>
                    → Open AutoStart Settings
                  </button>
                  {autoStartPath ? (
                    <p style={{ margin: '0.4rem 0 0', fontSize: '0.78rem', color: '#999', lineHeight: 1.5 }}>
                      If nothing opens: {autoStartPath}
                    </p>
                  ) : (
                    <p style={{ margin: '0.4rem 0 0', fontSize: '0.78rem', color: '#999', lineHeight: 1.5 }}>
                      If nothing opens: Settings → Apps → Shon Ceramics → Battery → Unrestricted
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Step 3 — Pause App Activity */}
            <div style={box}>
              <p style={{ margin: '0 0 0.5rem', fontWeight: 700, color: pauseAppTapped ? '#22c55e' : '#fbbf24' }}>
                {pauseAppTapped ? '✅ STEP 3 DONE — Activity Paused Off' : 'STEP 3 — Disable Activity Pausing'}
              </p>
              {pauseAppTapped ? (
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#86efac' }}>"Pause app activity if unused" is turned off.</p>
              ) : (
                <>
                  <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: '#ccc', lineHeight: 1.5 }}>
                    Tap below — it will open the App Settings page. Find <strong style={{ color: '#fff' }}>"Pause app activity if unused"</strong> (or "Remove permissions if unused") and <strong style={{ color: '#fff' }}>TURN IT OFF</strong>.
                  </p>
                  <button style={mkBtn('#ec4899', '#fff')} onClick={() => {
                    if (window.cordova) {
                      window.cordova.exec(null, null, 'BackgroundModeExt', 'appstart', [true]);
                    }
                    setPauseAppTapped(true);
                    localStorage.setItem('shu_pause_app_tapped', 'true');
                  }}>
                    → Open App Info (Step 3)
                  </button>
                </>
              )}
            </div>

            {/* Step 4 — Display Over Other Apps */}
            <div style={box}>
              <p style={{ margin: '0 0 0.5rem', fontWeight: 700, color: overlayOk ? '#22c55e' : '#fbbf24' }}>
                {overlayOk ? '✅ STEP 4 DONE — Pop-ups Allowed' : 'STEP 4 — Allow Pop-up Windows'}
              </p>
              {overlayOk ? (
                <>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#86efac' }}>App is allowed to display over other apps / show pop-up alerts from background.</p>
                </>
              ) : (
                <>
                  <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: '#ccc', lineHeight: 1.5 }}>
                    Tap below to open settings. Turn on <strong style={{ color: '#fff' }}>"Allow display over other apps"</strong> (or <strong style={{ color: '#fff' }}>"Display pop-up windows while running in background"</strong>).
                  </p>
                  <button style={mkBtn('#10b981', '#fff')} onClick={() => {
                    ShuHelper.openOverlaySettings().catch((err) => {
                      console.error('ShuHelper.openOverlaySettings failed', err);
                      alert('Error opening overlay settings: ' + (err.message || err));
                      if (window.cordova) {
                        window.cordova.exec(null, null, 'BackgroundModeExt', 'openOverlay', []);
                      } else {
                        ShuHelper.openAppSettings().catch(() => {});
                      }
                    });
                  }}>
                    → Grant Pop-up Permission
                  </button>
                </>
              )}
            </div>

            {/* Continue button — always visible so user is never stuck */}
            {(() => {
              const allDone = batteryOk && autoStartTapped && pauseAppTapped && overlayOk;
              return (
                <button
                  style={{
                    padding: '1rem 2rem', fontSize: '1.1rem', fontWeight: 'bold',
                    borderRadius: '10px', border: 'none', width: '100%', maxWidth: 360,
                    backgroundColor: allDone ? '#22c55e' : '#444',
                    color: '#fff', cursor: 'pointer',
                  }}
                  onClick={() => {
                    localStorage.setItem('shu_god_mode_v2', 'true');
                    setShowGodModeModal(false);
                  }}
                >
                  {allDone ? '✅ All Done — Enter App' : 'Skip & Enter App →'}
                </button>
              );
            })()}

            <p style={{ margin: 0, fontSize: '0.7rem', color: '#666' }}>
              Note: Skipping may cause notifications to fail when the app is closed.
            </p>
          </div>
        );
      })()}
      {notifPermissionDenied && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          backgroundColor: '#111', color: '#fff',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '2rem', textAlign: 'center', gap: '1.5rem',
        }}>
          <div style={{ fontSize: '3rem' }}>🔔</div>
          <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Notifications Required</h1>
          <p style={{ margin: 0, maxWidth: 320, lineHeight: 1.6 }}>
            This app <strong>must</strong> have notifications enabled to alert you about new tasks.
          </p>
          <p style={{ margin: 0, maxWidth: 320, lineHeight: 1.6, color: '#ccc' }}>
            Go to: <strong style={{ color: '#fff' }}>Settings → Apps → Shon Ceramics → Notifications → Allow</strong>
          </p>
          <p style={{ margin: 0, color: '#999', fontSize: '0.85rem' }}>Then close and reopen the app.</p>
          <button
            onClick={() => { try { window.open('app-settings:', '_system'); } catch {} }}
            style={{
              marginTop: '0.5rem', padding: '0.9rem 2rem',
              fontSize: '1rem', fontWeight: 'bold',
              borderRadius: '8px', border: 'none',
              backgroundColor: '#e53e3e', color: '#fff', cursor: 'pointer',
            }}
          >
            Open App Settings
          </button>
        </div>
      )}
      {children}
    </AppContext.Provider>
  );
};
