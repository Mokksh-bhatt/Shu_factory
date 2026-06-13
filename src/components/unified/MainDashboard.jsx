import { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, MessageSquare, Factory, Shield, LogOut } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import ErrorBoundary from '../ErrorBoundary';
import SettingsMenu from '../SettingsMenu';

import UnifiedProductionView from './UnifiedProductionView';
import UnifiedTasksView from './UnifiedTasksView';
import UnifiedAdminView from './UnifiedAdminView';

export default function MainDashboard() {
  const context = useAppContext();

  return (
    <ErrorBoundary>
      <MainDashboardContentWrapper context={context} />
    </ErrorBoundary>
  );
}

function MainDashboardContentWrapper({ context }) {
  if (!context || !context.currentUser) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center', 
        minHeight: '100vh', 
        background: 'var(--background)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--on-surface-variant)'
      }}>
        Initializing...
      </div>
    );
  }

  return <MainDashboardContent {...context} />;
}

function MainDashboardContent(context) {
  const {
    currentUser,
    language,
    setLanguage,
    languageOptions,
    t,
    notificationsEnabled,
    setNotificationsEnabled,
    logout,
    ownerNotifPrefs,
    setOwnerNotifPrefs,
  } = context;

  // 'home', 'admin', 'tasks', 'production'
  const [view, setView] = useState('home');

  if (view === 'admin') {
    return <UnifiedAdminView onBack={() => setView('home')} t={t} context={context} />;
  }

  if (view === 'tasks') {
    return <UnifiedTasksView onBack={() => setView('home')} t={t} context={context} />;
  }

  if (view === 'production') {
    return <UnifiedProductionView onBack={() => setView('home')} t={t} context={context} />;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} style={{ display: 'flex', flexDirection: 'column', padding: '24px', minHeight: '100vh', background: 'var(--background)' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div>
          <h2 style={{ color: 'var(--primary)', margin: 0, fontSize: '1.6rem' }}>{t('appName')}</h2>
          <span style={{ color: 'var(--on-surface-variant)', fontSize: '1rem' }}>Welcome, {currentUser?.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SettingsMenu
            t={t}
            language={language}
            languageOptions={languageOptions}
            setLanguage={setLanguage}
            notificationsEnabled={notificationsEnabled}
            setNotificationsEnabled={setNotificationsEnabled}
            logout={logout}
            isOwner={currentUser?.role === 'owner'}
            ownerNotifPrefs={ownerNotifPrefs}
            setOwnerNotifPrefs={setOwnerNotifPrefs}
            currentUser={currentUser}
          />
        </div>
      </header>

      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '24px', 
        flex: 1, 
        justifyContent: 'center', 
        maxWidth: '500px', 
        margin: '0 auto', 
        width: '100%' 
      }}>
        
        <button 
          onClick={() => setView('admin')}
          className="card"
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '16px', 
            padding: '40px 20px', 
            border: 'none', 
            background: 'linear-gradient(135deg, #1e293b, #0f172a)', 
            color: 'white', 
            borderRadius: '24px', 
            cursor: 'pointer',
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <Shield size={48} color="#60a5fa" />
          <h2 style={{ margin: 0, fontSize: '1.8rem', letterSpacing: '2px' }}>ADMIN</h2>
        </button>

        <button 
          onClick={() => setView('tasks')}
          className="card"
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '16px', 
            padding: '40px 20px', 
            border: 'none', 
            background: 'linear-gradient(135deg, #4f46e5, #3730a3)', 
            color: 'white', 
            borderRadius: '24px', 
            cursor: 'pointer',
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <MessageSquare size={48} color="#c7d2fe" />
          <h2 style={{ margin: 0, fontSize: '1.8rem', letterSpacing: '2px' }}>TASKS</h2>
        </button>

        <button 
          onClick={() => setView('production')}
          className="card"
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '16px', 
            padding: '40px 20px', 
            border: 'none', 
            background: 'linear-gradient(135deg, #10b981, #047857)', 
            color: 'white', 
            borderRadius: '24px', 
            cursor: 'pointer',
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <Factory size={48} color="#a7f3d0" />
          <h2 style={{ margin: 0, fontSize: '1.8rem', letterSpacing: '2px' }}>PRODUCTION</h2>
        </button>

      </div>
    </motion.div>
  );
}
