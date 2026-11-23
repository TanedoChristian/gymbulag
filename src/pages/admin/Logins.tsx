import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { describeDevice, listLogins, REASON_LABEL, type LoginEvent } from '../../lib/admin';
import { Badge, EmptyRow, ErrorBlock, LoadingBlock, PageTitle, Pagination, Panel, SearchBox, SelectFilter, Table, Td, Th, THead, Toolbar, Tr } from './kit';

type Result = '' | 'success' | 'failed';
type Portal = '' | 'app' | 'admin';
const PAGE = 50;

export default function Logins() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const result = (params.get('result') ?? '') as Result;
  const portal = (params.get('portal') ?? '') as Portal;
  const [q, setQ] = useState(params.get('q') ?? '');
  const [debounced, setDebounced] = useState(q);
  const [page, setPage] = useState(0);
  const [data, setData] = useState<{ total: number; events: LoginEvent[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setPage(0), [debounced, result, portal]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listLogins({ q: debounced, result, portal, offset: page * PAGE, limit: PAGE })
      .then(setData)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [debounced, result, portal, page]);
  useEffect(load, [load]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <>
      <PageTitle
        title="Login activity"
        desc="Every sign-in to the app and the admin panel, successful or not. Passwords are never stored."
        actions={
          <button className="btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        }
      />
      {error ? (
        <ErrorBlock message={error} onRetry={load} />
      ) : (
        <Panel flush>
          <Toolbar>
            <SearchBox value={q} onChange={setQ} placeholder="Search email or IP address" />
            <SelectFilter<Result>
              label="Result"
              value={result}
              onChange={(v) => setParam('result', v)}
              options={[
                { value: '', label: 'All results' },
                { value: 'success', label: 'Successful' },
                { value: 'failed', label: 'Failed' },
              ]}
            />
            <SelectFilter<Portal>
              label="Where"
              value={portal}
              onChange={(v) => setParam('portal', v)}
              options={[
                { value: '', label: 'App and admin' },
                { value: 'app', label: 'App' },
                { value: 'admin', label: 'Admin panel' },
              ]}
            />
          </Toolbar>
          {!data ? (
            <LoadingBlock />
          ) : (
            <>
              <Table minWidth={900}>
                <THead>
                  <Th>Time</Th>
                  <Th>Account</Th>
                  <Th>Result</Th>
                  <Th>Where</Th>
                  <Th>Device</Th>
                  <Th>IP address</Th>
                </THead>
                <tbody className={loading ? 'opacity-60' : ''}>
                  {data.events.length === 0 && <EmptyRow cols={6}>No sign-ins match these filters.</EmptyRow>}
                  {data.events.map((e) => (
                    <Tr key={e.id} onClick={e.userId ? () => navigate(`/admin/users?user=${e.userId}`) : undefined}>
                      <Td className="whitespace-nowrap">
                        <div className="font-medium tabular">{format(e.at, 'd MMM, HH:mm:ss')}</div>
                        <div className="text-xs text-steel-mute dark:text-floor-mute">{formatDistanceToNow(e.at, { addSuffix: true })}</div>
                      </Td>
                      <Td>
                        <div className="max-w-[16rem] truncate font-semibold">{e.name || (e.userId ? '—' : <span className="font-normal italic text-steel-mute">No account</span>)}</div>
                        <div className="max-w-[16rem] truncate text-xs text-steel-mute dark:text-floor-mute">{e.email || '—'}</div>
                      </Td>
                      <Td>
                        <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${e.success ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {e.success ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                          {REASON_LABEL[e.reason] ?? e.reason}
                        </span>
                      </Td>
                      <Td>
                        <Badge tone={e.portal === 'admin' ? 'volt' : 'gray'}>{e.portal === 'admin' ? 'Admin panel' : 'App'}</Badge>
                      </Td>
                      <Td className="whitespace-nowrap">
                        <span title={e.userAgent}>{describeDevice(e.userAgent)}</span>
                      </Td>
                      <Td className="whitespace-nowrap font-mono text-xs">{e.ip || '—'}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
              <Pagination page={page} pages={Math.max(1, Math.ceil(data.total / PAGE))} total={data.total} pageSize={PAGE} onPage={setPage} noun="sign-ins" />
            </>
          )}
        </Panel>
      )}
    </>
  );
}
