import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { ArrowLeft, Building2, KeyRound, LayoutDashboard, Loader2, LogOut, Menu as MenuIcon, ShieldCheck, Users as UsersIcon, X } from 'lucide-react';
import { useConfirm } from '../context/Confirm';
import { useAuth } from '../lib/auth';
import { adminFromApp, adminLogIn, adminLogOut, useAdminSession } from '../lib/adminAuth';
import { Avatar, LoadingBlock } from './admin/kit';

const Overview = lazy(() => import('./admin/Overview'));
const Users = lazy(() => import('./admin/Users'));
const Communities = lazy(() => import('./admin/Communities'));
const Logins = lazy(() => import('./admin/Logins'));

const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Users', icon: UsersIcon },
  { to: '/admin/communities', label: 'Gym communities', icon: Building2 },
  { to: '/admin/logins', label: 'Login activity', icon: KeyRound },
];

function AdminLogin() {
  const app = useAuth();
  const appAdmin = app && !app.expired && app.user.role === 'admin' ? app.user : null;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'form' | 'app' | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy('form');
    setError(null);
    try {
      await adminLogIn(email.trim(), password);
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  };

  const continueAsApp = async () => {
    setBusy('app');
    setError(null);
    try {
      await adminFromApp();
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-rack px-4 py-10">
      <div className="card w-full max-w-sm space-y-4 p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-md bg-rack text-volt-500">
            <ShieldCheck size={22} />
          </span>
          <div>
            <div className="eyebrow">Gymbulag</div>
            <h1 className="font-display text-2xl font-bold leading-tight tracking-wide">Admin sign in</h1>
          </div>
        </div>

        {appAdmin && (
          <>
            <button className="btn-primary w-full" onClick={continueAsApp} disabled={!!busy}>
              {busy === 'app' ? <Loader2 size={16} className="animate-spin" /> : <Avatar name={appAdmin.name || appAdmin.email} avatarKey={appAdmin.avatarKey} size="sm" />}
              Continue as {appAdmin.name || appAdmin.email}
            </button>
            <div className="flex items-center gap-3 text-xs text-steel-mute dark:text-floor-mute">
              <span className="h-px flex-1 bg-steel/15 dark:bg-white/10" /> or use another account <span className="h-px flex-1 bg-steel/15 dark:bg-white/10" />
            </div>
          </>
        )}

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="label">Email</span>
            <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus={!appAdmin} />
          </label>
          <label className="block">
            <span className="label">Password</span>
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && (
            <p className="rounded-lg bg-red-500/10 p-2.5 text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
          <button className={appAdmin ? 'btn-secondary w-full' : 'btn-primary w-full'} disabled={!!busy}>
            {busy === 'form' && <Loader2 size={16} className="animate-spin" />} Sign in
          </button>
        </form>
        <div className="flex items-center justify-between text-xs text-steel-mute dark:text-floor-mute">
          <span>Admin accounts only.</span>
          <Link to="/" className="link-accent font-semibold">
            Back to the app
          </Link>
        </div>
      </div>
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const session = useAdminSession()!;
  const confirm = useConfirm();
  const signOut = async () => {
    if (await confirm({ title: 'Sign out of the admin panel?', message: 'Your app login on this device stays as it is.', confirmLabel: 'Sign out' })) await adminLogOut();
  };
  return (
    <div className="flex h-full flex-col px-3 py-5">
      <div className="mb-7 flex items-center gap-2.5 px-2">
        <img src="/icon.svg" alt="" className="h-8 w-8" />
        <div className="leading-tight">
          <div className="font-display text-lg font-bold tracking-wide">Gymbulag</div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-volt-500">Admin</div>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1" aria-label="Admin">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2.5 font-display text-sm font-semibold tracking-wide transition ${
                isActive ? 'bg-volt-500 text-volt-ink' : 'text-floor-mute hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
        <div className="my-3 h-px bg-white/10" />
        <Link to="/" onClick={onNavigate} className="flex items-center gap-3 rounded-md px-3 py-2.5 font-display text-sm font-semibold tracking-wide text-floor-mute transition hover:bg-white/5 hover:text-white">
          <ArrowLeft size={18} /> Back to app
        </Link>
      </nav>
      <div className="mt-4 flex items-center gap-2.5 rounded-lg bg-white/[0.04] p-2.5">
        <Avatar name={session.user.name || session.user.email} avatarKey={session.user.avatarKey} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white">{session.user.name || 'Admin'}</div>
          <div className="truncate text-[11px] text-floor-mute">{session.user.email}</div>
        </div>
        <button className="rounded-md p-1.5 text-floor-mute transition hover:bg-white/10 hover:text-white" onClick={signOut} aria-label="Sign out" title="Sign out">
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );
}

/** The admin portal: its own sign-in and its own console layout, separate from the workout app. */
export default function AdminPage() {
  const session = useAdminSession();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    document.title = 'Gymbulag Admin';
    return () => {
      document.title = 'Gymbulag';
    };
  }, []);

  if (!session) return <AdminLogin />;
  const current = NAV.find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)));

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 bg-rack text-steel-bright lg:block">
        <SidebarContent />
      </aside>

      {/* Phones and tablets: top bar + slide-out menu */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-rack px-4 text-steel-bright lg:hidden" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <button className="rounded-md p-1.5 hover:bg-white/10" onClick={() => setMenuOpen(true)} aria-label="Open menu">
          <MenuIcon size={20} />
        </button>
        <span className="font-display text-lg font-bold tracking-wide">{current?.label ?? 'Admin'}</span>
        <span className="ml-auto rounded bg-volt-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-volt-ink">Admin</span>
      </header>
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenuOpen(false)} />
          <aside className="relative h-full w-72 max-w-[85%] animate-fade-in bg-rack text-steel-bright">
            <button className="absolute right-3 top-4 rounded-md p-1.5 text-floor-mute hover:bg-white/10" onClick={() => setMenuOpen(false)} aria-label="Close menu">
              <X size={18} />
            </button>
            <SidebarContent onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}

      <main className="min-w-0 flex-1 px-4 pb-16 pt-5 lg:px-8 lg:pt-8">
        <div className="mx-auto max-w-7xl">
          <Suspense fallback={<LoadingBlock />}>
            <Routes>
              <Route path="/admin" element={<Overview />} />
              <Route path="/admin/users" element={<Users />} />
              <Route path="/admin/communities" element={<Communities />} />
              <Route path="/admin/logins" element={<Logins />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          </Suspense>
        </div>
      </main>
    </div>
  );
}
