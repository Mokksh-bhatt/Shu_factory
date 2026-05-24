import { useState, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useAppContext } from './context/AppContext';
import Login from './components/Login';
import SplashScreen from './components/SplashScreen';
import InstallPage from './components/InstallPage';
import { ToastProvider } from './components/Toast';
import { Capacitor } from '@capacitor/core';
import './App.css';

import ErrorBoundary from './components/ErrorBoundary';

// Eagerly kick off the imports so they load during the splash screen,
// but still split them out of the initial bundle for faster first parse.
const ownerPromise = import('./components/OwnerDashboard');
const workerPromise = import('./components/WorkerDashboard');
const OwnerDashboard = lazy(() => ownerPromise);
const WorkerDashboard = lazy(() => workerPromise);

const RootLayout = () => {
  const { currentUser, notificationsEnabled, setNotificationsEnabled, t, authReady, updateAvailable } = useAppContext();
  const [splashDone, setSplashDone] = useState(false);
  const handleSplashFinish = useCallback(() => setSplashDone(true), []);
  const isReturningUser = !!currentUser;

  if (updateAvailable && Capacitor.isNativePlatform()) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 99999, backgroundColor: '#0a0a0a', color: '#fff',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '2rem', textAlign: 'center', gap: '1.5rem',
      }}>
        <div style={{ fontSize: '3.5rem' }}>🚀</div>
        <h1 style={{ fontSize: '1.6rem', margin: 0, color: '#22c55e' }}>Update Required</h1>
        <p style={{ margin: 0, maxWidth: 320, lineHeight: 1.6, color: '#ccc' }}>
          A new version of Shon Ceramics ({updateAvailable.version}) is available. You must update to continue using the app.
        </p>
        <button
          onClick={() => {
            let url = updateAvailable.apkUrl;
            if (!url.startsWith('http')) url = 'https://' + url;
            window.open(url, window.Capacitor?.isNativePlatform() ? '_system' : '_blank');
          }}
          style={{
            padding: '1rem 2.5rem', fontSize: '1.1rem', fontWeight: 'bold',
            borderRadius: '12px', border: 'none', backgroundColor: '#3b82f6', color: '#fff',
            cursor: 'pointer', marginTop: '1rem'
          }}
        >
          Download Update
        </button>
      </div>
    );
  }

  if (!splashDone) {
    return (
      <SplashScreen
        onFinish={handleSplashFinish}
        isReady={authReady}
        isReturningUser={isReturningUser}
      />
    );
  }

  return (
    <ErrorBoundary>
      <div className="app-container">
        {!notificationsEnabled && currentUser && (
          <div className="audio-banner" onClick={() => setNotificationsEnabled(true)}>
            🔊 {t('tapEnableSound')}
          </div>
        )}
        <Suspense fallback={null}>
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
        </Suspense>
      </div>
    </ErrorBoundary>
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
