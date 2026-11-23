import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2, MapPin } from 'lucide-react';
import { PageHeader } from '../components/ui';
import { joinCommunity } from '../lib/community';

type State = { kind: 'joining' } | { kind: 'joined'; name: string; location: string; already: boolean } | { kind: 'error'; message: string };

/** Opened by scanning a gym's QR code: joins the community straight away. */
export default function JoinPage() {
  const { code = '' } = useParams();
  const [state, setState] = useState<State>({ kind: 'joining' });
  const started = useRef('');

  useEffect(() => {
    if (started.current === code) return;
    started.current = code;
    setState({ kind: 'joining' });
    joinCommunity(code)
      .then((r) => setState({ kind: 'joined', name: r.community.name, location: r.community.location, already: r.alreadyMember }))
      .catch((e) => setState({ kind: 'error', message: (e as Error).message }));
  }, [code]);

  return (
    <>
      <PageHeader title="Join gym" />
      <div className="mx-auto max-w-app px-4 pt-10 lg:max-w-app-wide lg:px-8">
        <div className="card mx-auto max-w-md space-y-4 p-6 text-center">
          {state.kind === 'joining' && (
            <>
              <Loader2 size={36} className="mx-auto animate-spin text-zinc-400" />
              <p className="text-sm text-zinc-500">Joining…</p>
            </>
          )}
          {state.kind === 'joined' && (
            <>
              <CheckCircle2 size={44} className="mx-auto text-emerald-500" />
              <div>
                <h2 className="font-display text-2xl font-bold tracking-wide">{state.already ? "You're already in" : 'Welcome!'}</h2>
                <p className="mt-1 text-sm">
                  {state.already ? 'You are a member of' : 'You joined'} <b>{state.name}</b>
                </p>
                {state.location && (
                  <p className="mt-1 flex items-center justify-center gap-1 text-xs text-zinc-500">
                    <MapPin size={12} /> {state.location}
                  </p>
                )}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">The gym can see your name, email, when you joined and how often you log workouts. You can leave any time in Settings.</p>
              <Link to="/" className="btn-primary w-full">
                Start training
              </Link>
            </>
          )}
          {state.kind === 'error' && (
            <>
              <AlertCircle size={44} className="mx-auto text-red-500" />
              <p className="text-sm">{state.message}</p>
              <Link to="/" className="btn-secondary w-full">
                Back to the app
              </Link>
            </>
          )}
        </div>
      </div>
    </>
  );
}
