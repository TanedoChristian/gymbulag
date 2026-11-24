import { Component, type ErrorInfo, type ReactNode } from 'react';
import { buildBackup, downloadFile } from '../lib/backup';
import { exportAll } from '../lib/repo';
import { APP_FILE_SLUG } from '../brand';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', error, info.componentStack);
  }

  private rescue = async () => {
    try {
      const data = await exportAll();
      downloadFile(`${APP_FILE_SLUG}-rescue-${Date.now()}.json`, JSON.stringify(buildBackup(data), null, 2), 'application/json');
    } catch (e) {
      alert(`Could not export data: ${String(e)}`);
    }
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zinc-50 p-6 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold">Something went wrong</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Your workouts are stored safely on this device. You can reload the app, or download a backup of your data first.
          </p>
          <pre className="mt-4 max-h-32 overflow-auto rounded-xl bg-zinc-200/60 p-3 text-left text-xs dark:bg-zinc-900">{this.state.error.message}</pre>
          <div className="mt-6 flex justify-center gap-2">
            <button className="btn-secondary" onClick={this.rescue}>
              Download backup
            </button>
            <button className="btn-primary" onClick={() => location.reload()}>
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
