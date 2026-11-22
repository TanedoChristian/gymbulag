import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { CalendarDays, Dumbbell, LineChart, Settings } from 'lucide-react';
import { RestTimerBar } from './RestTimerBar';
import { UpdatePrompt } from './UpdatePrompt';
import { useRestTimer } from '../context/RestTimer';

const NAV = [
  { to: '/', label: 'Calendar', icon: CalendarDays, match: (p: string) => p === '/' || p.startsWith('/day') },
  { to: '/progress', label: 'Progress', icon: LineChart, match: (p: string) => p.startsWith('/progress') },
  { to: '/library', label: 'Library', icon: Dumbbell, match: (p: string) => p.startsWith('/library') },
  { to: '/settings', label: 'Settings', icon: Settings, match: (p: string) => p.startsWith('/settings') },
];

export function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const timer = useRestTimer();
  return (
    <div className="min-h-dvh">
      {/* Extra room at the bottom so the floating nav / rest timer never hide content. */}
      <main className={timer.state ? 'pb-56' : 'pb-36'}>{children}</main>
      <RestTimerBar />
      <UpdatePrompt />
      <nav className="fixed inset-x-0 z-40 flex justify-center px-4" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 12px)' }} aria-label="Main">
        <div className="flex w-full max-w-md items-center gap-1 rounded-[22px] border border-zinc-900/[0.06] bg-white/85 p-1.5 shadow-[0_12px_40px_-12px_rgba(16,24,40,0.25)] backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/80 dark:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.8)]">
          {NAV.map(({ to, label, icon: Icon, match }) => {
            const active = match(pathname);
            return (
              <NavLink
                key={to}
                to={to}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-2 text-[11px] font-semibold transition ${
                  active
                    ? 'bg-gradient-to-b from-indigo-500 to-indigo-600 text-white shadow-[0_6px_16px_-6px_rgba(79,70,229,0.7)]'
                    : 'text-zinc-500 hover:bg-zinc-900/[0.04] hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.05] dark:hover:text-white'
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.4 : 2} />
                {label}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
