/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { signInAnonymously, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../firebase';
import { LocalNotifications } from '@capacitor/local-notifications';
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

const AppContext = createContext();
export const useAppContext = () => useContext(AppContext);

const USER_STORAGE_KEY = 'shu_user';
const MAX_TEXT_LENGTH = 500;
const OWNER_EMAIL = (import.meta.env.VITE_OWNER_EMAIL || '').trim().toLowerCase();
const REQUIRE_OWNER_CLAIM = import.meta.env.VITE_REQUIRE_OWNER_CLAIM === 'true';

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
    return localStorage.getItem('shu_notifications') === 'true';
  });
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
      console.error('Anonymous login failed, attempting fallback:', err);
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
        if (currentUser?.role !== 'owner') {
          await ensureWorkerAuth();
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        if (active) setAuthReady(true);
      }
    };
    run();
    return () => { active = false; };
  }, [currentUser?.role, ensureWorkerAuth]);

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

  // OneSignal: opt-in and tag user when notifications enabled
  useEffect(() => {
    if (!notificationsEnabled || !currentUser) return;

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

        // Tag the user so we can target pushes by name
        await OneSignal.login(currentUser.name || currentUser.id || 'anonymous');
        await OneSignal.User.addTags({
          role: currentUser.role || 'worker',
          name: currentUser.name || '',
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
    const count = messages.filter(msg => {
      const ts = msg.createdAt?.toMillis ? msg.createdAt.toMillis() : (msg.createdAt instanceof Date ? msg.createdAt.getTime() : 0);
      if (ts <= lastReadTimestamp) return false;
      if (msg.target === currentUser.name) return true;
      if (currentUser.role === 'owner' && msg.target === 'owner') return true;
      if (msg.target === 'GLOBAL' && msg.sender !== currentUser.name) return true;
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

  // Fire a loud native notification via the alarm channel (works on Android APK even in background)
  const fireNativeAlarm = useCallback(async (title, body) => {
    try {
      await LocalNotifications.requestPermissions();
      await LocalNotifications.createChannel({
        id: 'shu_alarm_channel',
        name: 'Factory Alerts',
        importance: 5,
        visibility: 1,
        sound: 'default',
        vibration: true,
        lights: true,
        lightColor: '#FF0000',
        description: 'Urgent factory alerts — bypasses silent mode',
      });
      await LocalNotifications.schedule({
        notifications: [{
          id: Math.floor(Math.random() * 100000),
          title,
          body,
          channelId: 'shu_alarm_channel',
          sound: 'default',
          smallIcon: 'ic_launcher',
          iconColor: '#028a3f',
        }],
      });
    } catch {
      // Not running in native APK — fall back silently
    }
  }, []);

  const playLoudNotification = useCallback((mode = 'worker') => {
    // Let SW-registered main.jsx audio engine handle it if available (works in background)
    if (window.__playAlarmSW) {
      window.__playAlarmSW(mode);
      return;
    }
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
      if (mode === 'owner') {
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

  // OneSignal: send a push notification to a specific user by their name tag
  const sendOneSignalPush = useCallback(async (targetName, title, body, data = {}) => {
    try {
      const payload = {
        app_id: '3ca07406-7594-42ef-ade4-39b98a4ef565',
        headings: { en: title },
        contents: { en: body },
        priority: 10,             // FCM high priority — wakes screen
        ttl: 86400,
        require_interaction: true, // Web push: stays until tapped (Chrome desktop/Android)
        android_visibility: 1,     // Show on lock screen
        android_led_color: 'FFFF0000', // Red LED flash
        // Tell Android to use the high-importance alarm channel
        // (create this channel once in OneSignal dashboard: Importance = Urgent/High)
        android_channel_id: 'shu_alarm_channel',
        web_push_topic: 'shu-alarm',
        ...(data.url ? { url: data.url } : {}),
      };
      // Target by name or role
      if (data.targetRole) {
        payload.filters = [{ field: 'tag', key: 'role', relation: '=', value: data.targetRole }];
      } else if (targetName) {
        payload.filters = [{ field: 'tag', key: 'name', relation: '=', value: targetName }];
      } else {
        return; // no target
      }
      const resp = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Key os_v2_app_hsqhibtvsrbo7lpehg4yutxvmvvc7nj66enu4wufjemxpegyfr2rncliwfuqiv5mi66uehjenaej564zqj5b4han7t5537ddi27ug4q' },
        body: JSON.stringify(payload),
      });
      const result = await resp.json().catch(() => null);
      if (!resp.ok || (result && result.errors)) {
        console.warn('OneSignal push response:', resp.status, result);
      } else {
        console.log('OneSignal push sent OK:', result?.id, 'recipients:', result?.recipients);
      }
    } catch (err) {
      console.warn('OneSignal push error:', err);
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
          const incoming = newTasks.filter(t => !prevIds.has(t.id) && t.status === 'PENDING' && t.workerName?.toLowerCase() === currentUser.name?.toLowerCase());
          if (incoming.length > 0) {
            playLoudNotification('worker');
            const first = incoming[0];
            const taskTitle = `📋 New Task Assigned`;
            const taskBody = `${first.important ? '🔴 IMPORTANT: ' : ''}${first.description?.slice(0, 80) || '🎤 Voice task'}`;
            postAlarmToSW(taskTitle, taskBody, 'worker');
            fireNativeAlarm(taskTitle, taskBody);
          }
        }

        // Owner notification: when a worker adds a reply to a task
        if (currentUser?.role === 'owner' && notificationsEnabled) {
          const prevMap = {};
          prevTasksRef.current.forEach(t => { prevMap[t.id] = t.replies?.length || 0; });
          for (const task of newTasks) {
            const prevCount = prevMap[task.id] || 0;
            const newCount = task.replies?.length || 0;
            if (newCount > prevCount && prevCount >= 0 && prevTasksRef.current.length > 0) {
              playLoudNotification('owner');
              const lastReply = task.replies?.[task.replies.length - 1];
              const replyTitle = `💬 ${task.workerName} replied`;
              const replyBody = lastReply?.text?.slice(0, 80) || '🎤 Voice reply';
              postAlarmToSW(replyTitle, replyBody, 'owner');
              fireNativeAlarm(replyTitle, replyBody);
              break;
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
  }, [authReady, currentUser, notificationsEnabled, playLoudNotification, postAlarmToSW, fireNativeAlarm, t]);

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
      if (currentUser.role === 'worker' && lastMsg.sender === 'owner') {
        if (activeChatRef.current !== 'GLOBAL' && activeChatRef.current !== 'owner') {
          playLoudNotification('worker');
          const mt = `💬 Message from Owner`;
          const mb = lastMsg.text?.slice(0, 80) || '🎤 Voice message';
          postAlarmToSW(mt, mb, 'worker');
          fireNativeAlarm(mt, mb);
        }
      }
      if (currentUser.role === 'owner' && lastMsg.sender !== 'owner') {
        if (activeChatRef.current !== lastMsg.sender) {
          playLoudNotification('owner');
          const mt = `💬 ${lastMsg.sender}`;
          const mb = lastMsg.text?.slice(0, 80) || '🎤 Voice message';
          postAlarmToSW(mt, mb, 'owner');
          fireNativeAlarm(mt, mb);
        }
      }
    }
  }, [messages, currentUser, notificationsEnabled, playLoudNotification, postAlarmToSW, fireNativeAlarm, t]);

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
              playLoudNotification('worker');
              const hoursAgo = Math.floor(age / (60 * 60 * 1000));
              // Show in-app alert for overdue task
              setUnseenAlert({ count: 1, tasks: [{ id: task.id, description: `⏰ OVERDUE (${hoursAgo}h): ${task.description}` }] });
              sendOneSignalPush(
                currentUser.name,
                `⏰ Task Overdue — ${hoursAgo}h ago`,
                `"${task.description.slice(0, 60)}${task.description.length > 60 ? '...' : ''}"\n⏳ Assigned ${hoursAgo} hours ago. Please complete this task.${task.important ? '\n🔴 This is marked IMPORTANT!' : ''}`
              );
            }
            // For owner: show overdue alert too
            if (currentUser.role === 'owner') {
              playLoudNotification('owner');
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
      const myUnseenTasks = tasks.filter(
        t => t.status === 'PENDING' &&
          t.workerName?.toLowerCase() === currentUser.name?.toLowerCase() &&
          !t.seenByWorker &&
          !(t.replies && t.replies.length > 0)
      );

      if (myUnseenTasks.length === 0) {
        setUnseenAlert(null);
        return;
      }

      const lastBuzz = parseInt(localStorage.getItem(unseenReminderKey) || '0', 10);
      if (now - lastBuzz < TWO_MINUTES) return;

      localStorage.setItem(unseenReminderKey, String(now));
      playLoudNotification('worker');

      // In-app alert
      setUnseenAlert({
        count: myUnseenTasks.length,
        tasks: myUnseenTasks.slice(0, 3).map(t => t.description.slice(0, 50)),
      });

      // Send one combined push for all unseen tasks
      const taskList = myUnseenTasks.slice(0, 3).map(t =>
        `\u2022 ${t.important ? '\ud83d\udd34 ' : ''}${t.description.slice(0, 40)}${t.description.length > 40 ? '...' : ''}`
      ).join('\n');
      const extra = myUnseenTasks.length > 3 ? `\n...and ${myUnseenTasks.length - 3} more` : '';

      sendOneSignalPush(
        currentUser.name,
        `\ud83d\udd14 ${myUnseenTasks.length} Unseen Task${myUnseenTasks.length > 1 ? 's' : ''} \u2014 Open Now!`,
        `${taskList}${extra}\n\n\ud83d\udc46 Open the app to view and respond.`
      );
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
        name: adminMatch ? adminMatch.name : (cleanName || 'Admin'),
        category: 'Admin',
        language: resolvedLanguage,
      };
      setLanguageState(resolvedLanguage);
      setCurrentUser(user);
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

  const addTask = async (description, workerName, important = false, audioUrl = null, imageUrl = null) => {
    const cleanDescription = cleanText(description);
    if (!cleanDescription && !audioUrl && !imageUrl) return;
    if (cleanDescription) assertMaxText(cleanDescription, MAX_TEXT_LENGTH, t('taskTooLong'));

    try {
      await addDoc(collection(db, 'tasks'), {
        description: cleanDescription || '🎤 Voice Task',
        workerName,
        status: 'PENDING',
        important: important,
        inputMeta: null,
        response: null,
        replies: [],
        seenByWorker: null,
        audioUrl: audioUrl || null,
        imageUrl: imageUrl || null,
        createdAt: serverTimestamp(),
        createdBy: currentUser?.name || 'owner',
      });
      const worker = workers.find(w => w.name === workerName);
      const dept = worker?.category || 'General';
      const pushBody = audioUrl
        ? `🎤 Voice task assigned\n👤 From: ${currentUser?.name || 'Owner'}\n🏭 Dept: ${dept}`
        : imageUrl
        ? `🖼️ Image task assigned\n👤 From: ${currentUser?.name || 'Owner'}\n🏭 Dept: ${dept}`
        : `${important ? '⚠️ IMPORTANT: ' : ''}${cleanDescription}\n👤 From: ${currentUser?.name || 'Owner'}\n🏭 Dept: ${dept}`;
      sendOneSignalPush(
        workerName,
        important ? '🔴 Urgent Task from Owner' : (audioUrl ? '🎤 Voice Task Assigned' : imageUrl ? '🖼️ Image Task Assigned' : '📋 New Task Assigned'),
        pushBody
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
        response: cleanResponse || null,
        status,
        respondedAt: serverTimestamp(),
      };
      await updateDoc(doc(db, 'tasks', taskId), updates);

      // Notify owner when worker completes a task
      if (status === 'DONE' && currentUser?.role === 'worker') {
        sendOneSignalPush(
          null,
          '✅ Task Completed',
          `${currentUser.name} completed: "${cleanResponse || 'No response'}"`,
          { targetRole: 'owner' }
        );
      }
    } catch (err) {
      console.error('Error responding to task:', err);
      throw new Error(normalizeFirestoreError(err), { cause: err });
    }
  };

  // Acknowledge a task (reply without completing)
  const acknowledgeTask = async (taskId, replyText, audioUrl = null, imageUrl = null) => {
    const cleanReply = cleanText(replyText);
    if (!cleanReply && !audioUrl && !imageUrl) return;
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

      await updateDoc(taskRef, {
        replies: [...existingReplies, newReply],
        seenByWorker: taskData?.seenByWorker || Timestamp.now(),
      });

      // Notify owner about the acknowledgment
      sendOneSignalPush(
        null,
        `💬 ${currentUser?.name || 'Worker'} replied`,
        `${audioUrl ? '🎙️ Voice Note' : `"${cleanReply}"`}\n📋 Task: ${(taskData?.description || '').slice(0, 50)}`,
        { targetRole: 'owner' }
      );
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

  const sendMessage = async (sender, target, text, imageUrl = null) => {
    const cleanTextStr = cleanText(text);
    if (!cleanTextStr && !imageUrl) return;
    if (cleanTextStr) assertMaxText(cleanTextStr, MAX_TEXT_LENGTH, t('messageTooLong'));

    try {
      await addDoc(collection(db, 'messages'), {
        sender,
        target,
        text: cleanTextStr || '🖼️ Image attached',
        imageUrl: imageUrl || null,
        createdAt: serverTimestamp(),
      });
      // Push notification to the target via OneSignal
      if (target !== 'GLOBAL') {
        if (sender === 'owner') {
          sendOneSignalPush(
            target,
            '💬 Message from Owner',
            `"${cleanMessage.length > 80 ? cleanMessage.slice(0, 80) + '...' : cleanMessage}"\n👤 ${currentUser?.name || 'Owner'} sent you a message`
          );
        } else if (target === 'owner') {
          sendOneSignalPush(
            null,
            `💬 ${sender} sent a message`,
            `"${cleanMessage.length > 80 ? cleanMessage.slice(0, 80) + '...' : cleanMessage}"`,
            { targetRole: 'owner' }
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
        if (sender === 'owner') {
          sendOneSignalPush(target, '🎤 Voice Message from Owner', `${currentUser?.name || 'Owner'} sent you a voice note`);
        } else if (target === 'owner') {
          sendOneSignalPush(null, `🎤 ${sender} sent a voice note`, 'Tap to listen', { targetRole: 'owner' });
        }
      }
    } catch (err) {
      console.error('Error sending voice message:', err);
      throw new Error(normalizeFirestoreError(err), { cause: err });
    }
  };

  const getConversation = useCallback((workerName) =>
    messages.filter(
      (message) =>
        (message.sender === workerName && message.target === 'owner') ||
        (message.sender === 'owner' && message.target === workerName) ||
        message.target === 'GLOBAL',
    ), [messages]);

  const contextValue = useMemo(() => ({
    currentUser,
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
  }), [
    currentUser, language, t, getDepartmentLabel, login, logout, createWorkerAccount,
    updateWorkerPassword, toggleOnline, tasks, addTask, respondToTask, acknowledgeTask,
    markTasksSeen, deleteTask,
    toggleTaskImportant, overdueReminders,
    messages, sendMessage, sendVoiceMessage, getConversation, deleteMessage, unreadCount, markMessagesRead,
    workers, updateWorker, deleteWorker, playLoudNotification, setNotificationsEnabled,
    notificationsEnabled, ownerNotifPrefs, setOwnerNotifPrefs, activeChat, setActiveChat, authReady,
    lastReadTimestamp, unseenAlert, setUnseenAlert
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};
