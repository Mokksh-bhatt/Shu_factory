/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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

const AppContext = createContext();
export const useAppContext = () => useContext(AppContext);

const USER_STORAGE_KEY = 'shu_user';
const MAX_TEXT_LENGTH = 500;
const OWNER_EMAIL = (import.meta.env.VITE_OWNER_EMAIL || '').trim().toLowerCase();
const REQUIRE_OWNER_CLAIM = import.meta.env.VITE_REQUIRE_OWNER_CLAIM === 'true';

const DEPARTMENTS = ['General', 'Tile Making', 'Packaging', 'Quality Check', 'Loading', 'Maintenance'];

const DEPARTMENT_TRANSLATION_KEYS = {
  General: 'departmentGeneral',
  'Tile Making': 'departmentTile',
  Packaging: 'departmentPackaging',
  'Quality Check': 'departmentQuality',
  Loading: 'departmentLoading',
  Maintenance: 'departmentMaintenance',
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
  const [lastReadTimestamp, setLastReadTimestamp] = useState(Date.now());
  const [activeChat, setActiveChat] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [messages, setMessages] = useState([]);

  const audioCtxRef = useRef(null);
  const activeChatRef = useRef(null);
  const prevTasksRef = useRef([]);

  const t = useCallback((key, vars = {}) => translate(language, key, vars), [language]);

  const ensureWorkerAuth = useCallback(async () => {
    if (!auth.currentUser) {
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
            console.error('Fallback worker auth failed:', createErr);
            throw new Error('Authentication configuration missing. Enable Anonymous Auth or Email/Password in Firebase.');
          }
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
      if (msg.target === 'GLOBAL' && msg.sender !== currentUser.name) return true;
      return false;
    }).length;
    setUnreadCount(count);
  }, [messages, currentUser, lastReadTimestamp]);

  const playLoudNotification = useCallback((mode = 'worker') => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
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
        playTone(660, 0, 0.08, 'sine', 0.22);
        playTone(740, 0.12, 0.08, 'sine', 0.2);
      } else {
        playTone(880, 0, 0.15, 'square', 0.9);
        playTone(1100, 0.18, 0.15, 'sawtooth', 0.85);
        playTone(880, 0.36, 0.15, 'square', 0.9);
      }
    } catch (err) {
      console.error('Audio failed', err);
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

  useEffect(() => {
    if (!authReady) return undefined;
    const unsub = onSnapshot(
      query(collection(db, 'tasks'), orderBy('createdAt', 'desc')),
      (snap) => {
        const newTasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // Task notification logic
        if (currentUser?.role === 'worker' && notificationsEnabled) {
          const prevIds = new Set(prevTasksRef.current.map(t => t.id));
          const incoming = newTasks.filter(t => !prevIds.has(t.id) && t.status === 'PENDING' && t.workerName?.toLowerCase() === currentUser.name?.toLowerCase());
          if (incoming.length > 0) playLoudNotification('worker');
        }
        if (currentUser?.role === 'owner' && notificationsEnabled) {
          const prevMap = new Map(prevTasksRef.current.map(t => [t.id, t]));
          const updates = newTasks.filter(t => {
            const old = prevMap.get(t.id);
            return old && old.status !== t.status && t.respondedAt;
          });
          if (updates.length > 0) playLoudNotification('owner');
        }
        prevTasksRef.current = newTasks;
        setTasks(newTasks);
      },
      (err) => console.error('Tasks listener error:', err),
    );
    return unsub;
  }, [authReady, currentUser, notificationsEnabled, playLoudNotification]);

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
        }
      }
      if (currentUser.role === 'owner' && lastMsg.sender !== 'owner') {
        if (activeChatRef.current !== lastMsg.sender) {
          playLoudNotification('owner');
        }
      }
    }
  }, [messages, currentUser, notificationsEnabled, playLoudNotification]);

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
      if (cleanPassword !== 'Varuu@1202') {
        throw new Error(t('ownerPasswordWrong'));
      }

      await ensureWorkerAuth(); // Ensure database access

      const resolvedLanguage = preferredLanguage || DEFAULT_LANGUAGE;
      const user = {
        role: 'owner',
        name: cleanName || 'Admin',
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

  const markMessagesRead = () => {
    setLastReadTimestamp(Date.now());
    setUnreadCount(0);
  };

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
      setCurrentUser(null);
      setActiveChat(null);
      return;
    }

    setCurrentUser(null);
    setActiveChat(null);
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

  const addTask = async (description, workerName) => {
    const cleanDescription = cleanText(description);
    if (!cleanDescription) return;
    assertMaxText(cleanDescription, MAX_TEXT_LENGTH, t('taskTooLong'));

    try {
      await addDoc(collection(db, 'tasks'), {
        description: cleanDescription,
        workerName,
        status: 'PENDING',
        inputMeta: null,
        response: null,
        createdAt: serverTimestamp(),
        createdBy: currentUser?.name || 'owner',
      });
    } catch (err) {
      console.error('Error adding task:', err);
      throw new Error(normalizeFirestoreError(err), { cause: err });
    }
  };

  const respondToTask = async (taskId, response, status = 'DONE') => {
    const cleanResponse = cleanText(response);
    if (cleanResponse) {
      assertMaxText(cleanResponse, MAX_TEXT_LENGTH, t('responseTooLong'));
    }

    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        response: cleanResponse || null,
        status,
        respondedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error responding to task:', err);
      throw new Error(normalizeFirestoreError(err), { cause: err });
    }
  };

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

  const sendMessage = async (sender, target, text) => {
    const cleanMessage = cleanText(text);
    if (!cleanMessage) return;
    assertMaxText(cleanMessage, MAX_TEXT_LENGTH, t('messageTooLong'));

    try {
      await addDoc(collection(db, 'messages'), {
        sender,
        target,
        text: cleanMessage,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error sending message:', err);
      throw new Error(normalizeFirestoreError(err), { cause: err });
    }
  };

  const getConversation = (workerName) =>
    messages.filter(
      (message) =>
        (message.sender === workerName && message.target === 'owner') ||
        (message.sender === 'owner' && message.target === workerName) ||
        message.target === 'GLOBAL',
    );

  return (
    <AppContext.Provider
      value={{
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
        deleteTask,

        messages,
        sendMessage,
        getConversation,
        deleteMessage,
        unreadCount,
        markMessagesRead,

        workers,
        updateWorker,
        deleteWorker,

        playLoudNotification,
        setNotificationsEnabled,
        notificationsEnabled,

        activeChat,
        setActiveChat,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
