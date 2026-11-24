import type { ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Building2, CalendarDays, Dumbbell, Loader2, LineChart, LogOut, Settings, ShieldCheck, Users } from 'lucide-react';
import { UserAvatar } from './UserAvatar';
import { useLogout } from '../hooks/useLogout';
import { RestTimerBar } from './RestTimerBar';
import { UpdatePrompt } from './UpdatePrompt';
import { useRestTimer } from '../context/RestTimer';
import { useAuth } from '../lib/auth';
import { APP_NAME } from '../brand';

const NAV = [
  { to: '/', label: 'Calendar', icon: CalendarDays, match: (p: string) => p === '/' || p.startsWith('/day') },
  { to: '/progress', label: 'Progress', icon: LineChart, match: (p: string) => p.startsWith('/progress') },
  { to: '/library', label: 'Library', icon: Dumbbell, match: (p: string) => p.startsWith('/library') },
  { to: '/community', label: 'Community', icon: Users, match: (p: string) => p.startsWith('/community') || p.startsWith('/join') },
  { to: '/settings', label: 'Settings', icon: Settings, match: (p: string) => p.startsWith('/settings') },
];

/** Gym owners only. Shown in the desktop sidebar; on phones it's reached from the Community tab. */
/** "Manage" links: admins and gym owners only. In the desktop sidebar; on phones they're in the Community tab. */
const ADMIN_NAV = { to: '/admin', label: 'Admin panel', icon: ShieldCheck, match: () => false };
const OWNER_NAV = { to: '/gym', label: 'My gym', icon: Building2, match: (p: string) => p.startsWith('/gym') };

export function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const timer = useRestTimer();
  const user = useAuth()?.user;
  const { leave, leaving } = useLogout();
  const manage = [...(user?.role === 'admin' ? [ADMIN_NAV] : []), ...(user?.isOwner ? [OWNER_NAV] : [])];
  return (
    <div className="min-h-dvh lg:flex">
      <aside className="sticky top-0 z-40 hidden h-dvh w-56 shrink-0 flex-col border-r border-white/10 bg-rack px-3 py-5 text-steel-bright lg:flex" aria-label="Main">
        <div className="mb-8 flex items-center gap-2.5 px-2">
          <img src="/icon.svg" alt="" className="h-8 w-8" />
          <span className="font-display text-xl font-bold tracking-wide">{APP_NAME}</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, match }) => {
            const active = match(pathname);
            return (
              <NavLink
                key={to}
                to={to}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 font-display text-sm font-semibold tracking-wide transition ${
                  active ? 'bg-volt-500 text-volt-ink' : 'text-floor-mute hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2.4 : 2} />
                {label}
              </NavLink>
            );
          })}
          {manage.length > 0 && (
            <>
              <div className="mb-1 mt-6 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-floor-mute/70">Manage</div>
              {manage.map(({ to, label, icon: Icon, match }) => {
                const active = match(pathname);
                return (
                  <NavLink
                    key={to}
                    to={to}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-3 rounded-md px-3 py-2.5 font-display text-sm font-semibold tracking-wide transition ${
                      active ? 'bg-volt-500 text-volt-ink' : 'text-floor-mute hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Icon size={18} strokeWidth={active ? 2.4 : 2} />
                    {label}
                  </NavLink>
                );
              })}
            </>
          )}
        </nav>
        {user && (
          <div className="mt-4 flex items-center gap-2.5 rounded-lg bg-white/[0.04] p-2.5">
            <Link to="/settings" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md" title="Your account">
              <UserAvatar name={user.name || user.email} avatarKey={user.avatarKey} size="xs" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-white">{user.name || 'You'}</span>
                <span className="block truncate text-[11px] text-floor-mute">{user.email}</span>
              </span>
            </Link>
            <button className="rounded-md p-1.5 text-floor-mute transition hover:bg-white/10 hover:text-white disabled:opacity-50" onClick={() => void leave()} disabled={leaving} aria-label="Log out" title="Log out">
              {leaving ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
            </button>
          </div>
        )}
      </aside>

      <div className="min-w-0 flex-1">
        <main className={`${timer.state ? 'pb-56' : 'pb-36'} lg:pb-10`}>{children}</main>
        <RestTimerBar />
        <UpdatePrompt />

        <nav
          className="fixed inset-x-0 z-40 flex justify-center px-3 lg:hidden"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 10px)' }}
          aria-label="Main"
        >
          <div className="flex w-full max-w-lg items-stretch gap-0.5 rounded-lg border border-steel/20 bg-rack p-1 text-steel-bright shadow-rack">
            {NAV.map(({ to, label, icon: Icon, match }) => {
              const active = match(pathname);
              return (
                <NavLink
                  key={to}
                  to={to}
                  aria-current={active ? 'page' : undefined}
                  className={`flex flex-1 flex-col items-center gap-0.5 rounded-md py-2 font-display text-[10px] font-bold tracking-wider transition ${
                    active ? 'bg-volt-500 text-volt-ink' : 'text-floor-mute hover:text-white'
                  }`}
                >
                  <Icon size={18} strokeWidth={active ? 2.4 : 2} />
                  {label}
                </NavLink>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
