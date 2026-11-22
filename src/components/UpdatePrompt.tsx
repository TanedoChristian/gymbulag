import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw } from 'lucide-react';

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(err) {
      console.warn('Service worker registration failed', err);
    },
  });

  if (!needRefresh) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-[55] flex justify-center p-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}>
      <div className="flex w-full max-w-md animate-slide-up items-center gap-3 rounded-2xl bg-indigo-600 px-4 py-3 text-sm text-white shadow-xl">
        <RefreshCw size={18} />
        <span className="flex-1">A new version is available.</span>
        <button className="font-semibold opacity-80 hover:opacity-100" onClick={() => setNeedRefresh(false)}>
          Later
        </button>
        <button className="rounded-lg bg-white px-3 py-1.5 font-semibold text-indigo-700" onClick={() => updateServiceWorker(true)}>
          Update
        </button>
      </div>
    </div>
  );
}
