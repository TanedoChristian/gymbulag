import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import { useSettings } from './hooks/data';
import { fetchMe, startAutoSync } from './lib/sync';
import { useAuth } from './lib/auth';
import CalendarPage from './pages/CalendarPage';
import DayPage from './pages/DayPage';

// Chart-heavy and less-used pages are split out of the main bundle.
const ProgressPage = lazy(() => import('./pages/ProgressPage'));
const LibraryPage = lazy(() => import('./pages/LibraryPage'));
const CommunityPage = lazy(() => import('./pages/CommunityPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const NotFound = lazy(() => import('./pages/NotFound'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const GymPage = lazy(() => import('./pages/GymPage'));
const JoinPage = lazy(() => import('./pages/JoinPage'));

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
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0a0c0e' : '#d9dde3');
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
  const token = auth && !auth.expired ? auth.token : null;
  // Picks up role / gym-owner access granted since this device last logged in.
  useEffect(() => {
    if (token) fetchMe().catch(() => {});
  }, [token]);
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
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/nearby" element={<Navigate to="/community?tab=nearby" replace />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/gym" element={<GymPage />} />
          <Route path="/join/:code" element={<JoinPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
