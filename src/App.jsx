import { useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useAppContext } from './context/AppContext';
import Login from './components/Login';
import OwnerDashboard from './components/OwnerDashboard';
import WorkerDashboard from './components/WorkerDashboard';
import SplashScreen from './components/SplashScreen';
import InstallPage from './components/InstallPage';
import { ToastProvider } from './components/Toast';
import './App.css';

const RootLayout = () => {
  const { currentUser, notificationsEnabled, setNotificationsEnabled, t, authReady } = useAppContext();
  const [splashDone, setSplashDone] = useState(false);
  const handleSplashFinish = useCallback(() => setSplashDone(true), []);

  // Show splash screen only until its animation finishes
  if (!splashDone) {
    return <SplashScreen onFinish={handleSplashFinish} isReady={authReady} />;
  }

  return (
    <div className="app-container">
      {/* One-time audio unlock for Android browsers */}
      {!notificationsEnabled && currentUser && (
        <div className="audio-banner" onClick={() => setNotificationsEnabled(true)}>
          🔊 {t('tapEnableSound')}
        </div>
      )}

      <Routes>
        <Route path="/install" element={<InstallPage />} />
        <Route path="/" element={
          currentUser
            ? <Navigate to={currentUser.role === 'owner' ? '/owner' : '/worker'} />
            : <Login />
        } />
        <Route
          path="/owner"
          element={currentUser?.role === 'owner' ? <OwnerDashboard /> : <Navigate to="/" />}
        />
        <Route
          path="/worker"
          element={currentUser?.role === 'worker' ? <WorkerDashboard /> : <Navigate to="/" />}
        />
      </Routes>
    </div>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <BrowserRouter>
          <RootLayout />
        </BrowserRouter>
      </AppProvider>
    </ToastProvider>
  );
}
