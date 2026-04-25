import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Factory, HardHat } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAppContext } from '../context/AppContext';
import logo from '../1654269855758.jpg';

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.35, ease: 'easeOut' },
  }),
};

export default function Login() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [workerLanguage, setWorkerLanguage] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, currentUser, t, languageOptions } = useAppContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) {
      navigate(currentUser.role === 'owner' ? '/owner' : '/worker');
    }
  }, [currentUser, navigate]);

  const handleLogin = async (role) => {
    if (!name.trim() || !password.trim()) {
      alert(t('nameAndPasswordRequired'));
      return;
    }

    // if (role === 'worker' && !workerLanguage) {
    //   alert(t('pickLanguageRequired'));
    //   return;
    // }

    setLoading(true);
    try {
      const preferred = role === 'worker' ? workerLanguage : 'en';
      await login(role, name, 'General', password, preferred);
      navigate(role === 'owner' ? '/owner' : '/worker');
    } catch (err) {
      alert(err.message || t('somethingWentWrong'));
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    <motion.div key="logo" custom={0} variants={itemVariants} initial="hidden" animate="visible" style={{ textAlign: 'center', marginBottom: 8 }}>
      <img
        src={logo}
        alt={t('appName')}
        style={{ width: '180px', height: 'auto', margin: '0 auto', display: 'block', borderRadius: '12px' }}
      />
    </motion.div>,
    <motion.div key="name" custom={1} variants={itemVariants} initial="hidden" animate="visible">
      <label style={{ display: 'block', marginBottom: '8px', color: 'var(--on-surface-variant)', fontSize: '1rem' }}>
        {t('nameOrEmail')}
      </label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('nameOrEmailExample')}
        style={{ fontSize: '1.05rem', padding: '14px' }}
      />
    </motion.div>,
    <motion.div key="password" custom={2} variants={itemVariants} initial="hidden" animate="visible">
      <label style={{ display: 'block', marginBottom: '8px', color: 'var(--on-surface-variant)', fontSize: '1rem' }}>
        {t('passwordPin')}
      </label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={t('passwordPlaceholder')}
        style={{ fontSize: '1.05rem', padding: '14px', letterSpacing: '1px' }}
      />
    </motion.div>,
    <motion.button
      key="ownerBtn"
      custom={3}
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      className="btn-primary"
      onClick={() => handleLogin('owner')}
      disabled={loading}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '15px', opacity: loading ? 0.7 : 1 }}
    >
      <Factory size={20} /> {loading ? t('connecting') : t('loginAdmin')}
    </motion.button>,
    <motion.button
      key="workerBtn"
      custom={4}
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      className="btn-secondary"
      onClick={() => handleLogin('worker')}
      disabled={loading}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '15px',
        border: '1px solid rgba(2,138,63,0.3)',
        opacity: loading ? 0.7 : 1,
      }}
    >
      <HardHat size={20} /> {loading ? t('connecting') : t('loginWorker')}
    </motion.button>,
    <motion.div key="workerLang" custom={5} variants={itemVariants} initial="hidden" animate="visible">
      <label style={{ display: 'block', marginBottom: '8px', color: 'var(--on-surface-variant)', fontSize: '1rem' }}>{t('chooseLanguage')}</label>
      <select value={workerLanguage} onChange={(e) => setWorkerLanguage(e.target.value)} style={{ fontSize: '1rem', padding: '12px' }}>
        <option value="">-- {t('chooseLanguage')} --</option>
        {languageOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </motion.div>,
    <motion.p key="hint" custom={6} variants={itemVariants} initial="hidden" animate="visible" style={{ color: 'var(--on-surface-variant)', fontSize: '0.85rem', textAlign: 'center' }}>
      {t('workersUseAdminCreds')}
    </motion.p>,
  ];

  return (
    <motion.div
      style={{ display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'center', minHeight: '85vh', padding: '0 4px' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {fields}
    </motion.div>
  );
}
