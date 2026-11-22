import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import { useSettings } from './hooks/data';
import { startAutoSync } from './lib/sync';
import { useAuth } from './lib/auth';
import CalendarPage from './pages/CalendarPage';
import DayPage from './pages/DayPage';

// Chart-heavy and less-used pages are split out of the main bundle.
const ProgressPage = lazy(() => import('./pages/ProgressPage'));
const LibraryPage = lazy(() => import('./pages/LibraryPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const NotFound = lazy(() => import('./pages/NotFound'));
const AuthPage = lazy(() => import('./pages/AuthPage'));

function useThemeSync() {
  const { theme } = useSettings();
  useEffect(() => {
    try {
      localStorage.setItem('gymbulag:theme', theme);
    } catch {
      /* ignore */
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#09090b' : '#fafafa');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

export default function App() {
  useThemeSync();
  useEffect(() => startAutoSync(), []);
  const auth = useAuth();
  if (!auth || auth.expired) {
    return (
      <Suspense fallback={<Spinner />}>
        <AuthPage />
      </Suspense>
    );
  }
  return (
    <Layout>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/" element={<CalendarPage />} />
          <Route path="/day/:date" element={<DayPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
