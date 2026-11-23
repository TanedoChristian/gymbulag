import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { Eye, MoreVertical, RefreshCw } from 'lucide-react';
import { Menu } from '../../components/Menu';
import { useAdminSession } from '../../lib/adminAuth';
import { listUsers, type AdminUser } from '../../lib/admin';
import type { AccountStatus } from '../../lib/community';
import { Avatar, Badge, EmptyRow, ErrorBlock, LoadingBlock, PageTitle, Pagination, Panel, SearchBox, SelectFilter, Table, Td, Th, THead, Toolbar, Tr, usePaged, useSort } from './kit';
import { RoleBadge, StatusBadge, useUserActions } from './userActions';
import { UserDrawer } from './UserDrawer';

type RoleFilter = 'all' | 'admin' | 'owner' | 'user';
type StatusFilter = 'all' | AccountStatus;
type SortKey = 'name' | 'status' | 'communities' | 'lastSeen' | 'createdAt';

export default function Users() {
  const me = useAdminSession()?.user;
  const [params, setParams] = useSearchParams();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [role, setRole] = useState<RoleFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [reloadKey, setReloadKey] = useState(0);
  const openId = Number(params.get('user')) || null;

  const load = useCallback(() => {
    setError(null);
    listUsers()
      .then(setUsers)
      .catch((e) => setError((e as Error).message));
  }, []);
  useEffect(load, [load]);

  const put = (u: AdminUser) => setUsers((list) => list?.map((x) => (x.id === u.id ? u : x)) ?? null);
  // After an action: update the row we got back, or reload when the server only said "ok".
  const actions = useUserActions(me?.id, (u) => {
    if (u) put(u);
    else load();
    setReloadKey((k) => k + 1);
  });

  const open = (id: number | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('user', String(id));
    else next.delete('user');
    setParams(next, { replace: !id });
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (users ?? []).filter(
      (u) =>
        (!term || u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)) &&
        (status === 'all' || u.status === status) &&
        (role === 'all' || (role === 'admin' ? u.role === 'admin' : role === 'owner' ? u.owned > 0 : u.role !== 'admin' && u.owned === 0)),
    );
  }, [users, q, role, status]);

  const { sorted, sort, toggle } = useSort<AdminUser, SortKey>(filtered, { key: 'createdAt', dir: 'desc' }, (u, k) =>
    k === 'name' ? (u.name || u.email).toLowerCase() : k === 'status' ? u.status : k === 'communities' ? u.communities : k === 'lastSeen' ? u.lastSeen : u.createdAt,
  );
  const page = usePaged(sorted, 20, `${q}|${role}|${status}`);

  const counts = useMemo(() => {
    const list = users ?? [];
    return { all: list.length, active: list.filter((u) => u.status === 'active').length, inactive: list.filter((u) => u.status === 'inactive').length, blocked: list.filter((u) => u.status === 'blocked').length };
  }, [users]);

  return (
    <>
      <PageTitle
        title="Users"
        desc="Every account. Click a row for details, login history and devices."
        actions={
          <button className="btn-secondary" onClick={load}>
            <RefreshCw size={15} /> Refresh
          </button>
        }
      />
      {error ? (
        <ErrorBlock message={error} onRetry={load} />
      ) : !users ? (
        <LoadingBlock />
      ) : (
        <Panel flush>
          <Toolbar>
            <SearchBox value={q} onChange={setQ} placeholder="Search name or email" />
            <SelectFilter<RoleFilter>
              label="Role"
              value={role}
              onChange={setRole}
              options={[
                { value: 'all', label: 'All roles' },
                { value: 'admin', label: 'Admins' },
                { value: 'owner', label: 'Gym owners' },
                { value: 'user', label: 'Users' },
              ]}
            />
            <SelectFilter<StatusFilter>
              label="Status"
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all', label: `All statuses (${counts.all})` },
                { value: 'active', label: `Active (${counts.active})` },
                { value: 'inactive', label: `Deactivated (${counts.inactive})` },
                { value: 'blocked', label: `Blocked (${counts.blocked})` },
              ]}
            />
          </Toolbar>
          <Table minWidth={860}>
            <THead>
              <Th sortKey="name" sort={sort} onSort={toggle}>
                User
              </Th>
              <Th>Role</Th>
              <Th sortKey="status" sort={sort} onSort={toggle}>
                Status
              </Th>
              <Th sortKey="communities" sort={sort} onSort={toggle} className="text-right">
                Gyms
              </Th>
              <Th sortKey="lastSeen" sort={sort} onSort={toggle}>
                Last active
              </Th>
              <Th sortKey="createdAt" sort={sort} onSort={toggle}>
                Joined
              </Th>
              <Th className="w-12">
                <span className="sr-only">Actions</span>
              </Th>
            </THead>
            <tbody>
              {page.rows.length === 0 && <EmptyRow cols={7}>{users.length ? 'No users match these filters.' : 'No users yet.'}</EmptyRow>}
              {page.rows.map((u) => (
                <Tr key={u.id} onClick={() => open(u.id)} dim={u.status !== 'active'}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name || u.email} avatarKey={u.avatarKey} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 truncate font-semibold">
                          {u.name || '—'} {u.id === me?.id && <Badge>You</Badge>}
                        </div>
                        <div className="truncate text-xs text-steel-mute dark:text-floor-mute">{u.email}</div>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <RoleBadge user={u} />
                  </Td>
                  <Td>
                    <StatusBadge status={u.status} />
                  </Td>
                  <Td className="text-right font-mono tabular">{u.communities || <span className="text-steel-mute">—</span>}</Td>
                  <Td className="whitespace-nowrap text-steel-mute dark:text-floor-mute">
                    {u.lastSeen ? <span title={format(u.lastSeen, 'd MMM yyyy HH:mm')}>{formatDistanceToNow(u.lastSeen, { addSuffix: true })}</span> : 'Never'}
                  </Td>
                  <Td className="whitespace-nowrap text-steel-mute dark:text-floor-mute">{format(u.createdAt, 'd MMM yyyy')}</Td>
                  <Td>
                    <div onClick={(e) => e.stopPropagation()}>
                      <Menu label={`Actions for ${u.name || u.email}`} trigger={<MoreVertical size={17} />} items={actions.menu(u, [{ label: 'View details', icon: <Eye size={16} />, onSelect: () => open(u.id) }])} />
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={page.page} pages={page.pages} total={page.total} pageSize={page.pageSize} onPage={page.setPage} noun="users" />
        </Panel>
      )}
      <UserDrawer userId={openId} meId={me?.id} actions={actions} onClose={() => open(null)} onChanged={put} reloadKey={reloadKey} />
      {!openId && actions.modal}
    </>
  );
}
