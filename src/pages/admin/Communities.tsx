import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { CirclePause, CirclePlay, Globe, MessageSquare, Loader2, Lock, MapPin, MoreVertical, Pencil, Plus, QrCode, RefreshCw, Trash2, UserCog, Users, X } from 'lucide-react';
import { Modal } from '../../components/ui';
import { Menu } from '../../components/Menu';
import { QrModal } from '../../components/community/QrModal';
import { MembersPanel } from '../../components/community/MembersPanel';
import { useToast } from '../../context/Toast';
import { useConfirm } from '../../context/Confirm';
import { addOwner, adminCommunities, createCommunity, deleteCommunity, removeOwner, updateCommunity, type Community, type Visibility } from '../../lib/community';
import { Badge, EmptyRow, ErrorBlock, LoadingBlock, PageTitle, Pagination, Panel, SearchBox, SelectFilter, Table, Td, Th, THead, Toolbar, Tr, usePaged, useSort } from './kit';

type StatusFilter = 'all' | 'active' | 'inactive';
type VisibilityFilter = 'all' | Visibility;
type SortKey = 'name' | 'members' | 'joinedThisWeek' | 'blocked' | 'createdAt';

function CommunityForm({ open, onClose, initial, onSaved }: { open: boolean; onClose: () => void; initial?: Community | null; onSaved: (c: Community, created: boolean) => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setLocation(initial?.location ?? '');
      setVisibility(initial?.visibility ?? 'private');
    }
  }, [open, initial]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const c = initial ? await updateCommunity(initial.id, { name, location, visibility }) : await createCommunity(name, location, visibility);
      onSaved(c, !initial);
      onClose();
      toast(initial ? 'Community updated' : 'Community created', { tone: 'success' });
    } catch (err) {
      toast((err as Error).message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit community' : 'New gym community'} size="sm">
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="label">Gym name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required autoFocus placeholder="e.g. Iron Temple Makati" />
        </label>
        <label className="block">
          <span className="label">Location (optional)</span>
          <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={255} placeholder="Address or branch" />
        </label>
        <fieldset>
          <legend className="label">Visibility</legend>
          <div className="grid gap-2">
            {(
              [
                { value: 'private', icon: <Lock size={16} />, title: 'Private', desc: 'Only people who scan the QR code can join.' },
                { value: 'public', icon: <Globe size={16} />, title: 'Public', desc: 'Listed in the app under Community → Discover. Anyone can find and join it.' },
              ] as const
            ).map((o) => (
              <label
                key={o.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                  visibility === o.value ? 'border-volt-600 bg-volt-500/10 dark:border-volt-500' : 'border-steel/15 hover:border-steel/30 dark:border-white/10'
                }`}
              >
                <input type="radio" name="visibility" className="mt-1 accent-[#a8cc00]" checked={visibility === o.value} onChange={() => setVisibility(o.value)} />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    {o.icon} {o.title}
                  </span>
                  <span className="block text-xs text-steel-mute dark:text-floor-mute">{o.desc}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <button className="btn-primary w-full" disabled={busy || !name.trim()}>
          {busy && <Loader2 size={16} className="animate-spin" />}
          {initial ? 'Save' : 'Create and get QR code'}
        </button>
      </form>
    </Modal>
  );
}

function OwnersModal({ community, onClose, onSaved }: { community: Community | null; onClose: () => void; onSaved: (c: Community) => void }) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => setEmail(''), [community?.id]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!community) return;
    setBusy(true);
    try {
      onSaved(await addOwner(community.id, email));
      setEmail('');
      toast('Gym owner added', { tone: 'success' });
    } catch (err) {
      toast((err as Error).message, { tone: 'error', duration: 6000 });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (userId: number) => {
    if (!community) return;
    try {
      onSaved(await removeOwner(community.id, userId));
    } catch (err) {
      toast((err as Error).message, { tone: 'error' });
    }
  };

  return (
    <Modal open={!!community} onClose={onClose} title={community ? `${community.name} · Gym owners` : ''} size="sm">
      {community && (
        <div className="space-y-4">
          <p className="text-sm text-steel-mute dark:text-floor-mute">Gym owners see this community's members and how often they train, and can block or unblock them. They can't create communities or change the QR code.</p>
          {community.owners.length === 0 ? (
            <p className="rounded-lg bg-steel/[0.05] p-3 text-sm text-steel-mute dark:bg-white/[0.04]">No gym owners yet.</p>
          ) : (
            <ul className="divide-y divide-steel/10 rounded-lg ring-1 ring-steel/10 dark:divide-white/[0.06] dark:ring-white/10">
              {community.owners.map((o) => (
                <li key={o.id} className="flex items-center gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{o.name || '—'}</div>
                    <div className="truncate text-xs text-steel-mute">{o.email}</div>
                  </div>
                  <button className="icon-btn" aria-label={`Remove ${o.email}`} onClick={() => remove(o.id)}>
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={add} className="flex gap-2">
            <input className="input flex-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@email.com" required aria-label="Gym owner's email" />
            <button className="btn-primary" disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Add
            </button>
          </form>
          <p className="text-xs text-steel-mute">They need a Gymbulag account first. Access shows up the next time their app refreshes.</p>
        </div>
      )}
    </Modal>
  );
}

export default function Communities() {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [list, setList] = useState<Community[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [vis, setVis] = useState<VisibilityFilter>('all');
  const [form, setForm] = useState<{ open: boolean; edit: Community | null }>({ open: false, edit: null });
  const [qrId, setQrId] = useState<number | null>(null);
  const [ownersId, setOwnersId] = useState<number | null>(null);
  const [membersId, setMembersId] = useState<number | null>(null);

  const load = useCallback(() => {
    setError(null);
    adminCommunities()
      .then(setList)
      .catch((e) => setError((e as Error).message));
  }, []);
  useEffect(load, [load]);

  const put = (c: Community) => setList((l) => (l?.some((x) => x.id === c.id) ? l.map((x) => (x.id === c.id ? c : x)) : [c, ...(l ?? [])]));
  const byId = useMemo(() => new Map((list ?? []).map((c) => [c.id, c])), [list]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (list ?? []).filter(
      (c) =>
        (status === 'all' || (status === 'active') === c.active) &&
        (vis === 'all' || c.visibility === vis) &&
        (!term || c.name.toLowerCase().includes(term) || c.location.toLowerCase().includes(term) || c.owners.some((o) => o.email.toLowerCase().includes(term) || o.name.toLowerCase().includes(term))),
    );
  }, [list, q, status, vis]);
  const { sorted, sort, toggle } = useSort<Community, SortKey>(filtered, { key: 'createdAt', dir: 'desc' }, (c, k) => (k === 'name' ? c.name.toLowerCase() : c[k]));
  const page = usePaged(sorted, 15, `${q}|${status}|${vis}`);

  const setActive = async (c: Community, active: boolean) => {
    if (!active) {
      const ok = await confirm({
        title: `Deactivate ${c.name}?`,
        message: "Its QR code stops working and nobody new can join. Current members stay, and gym owners can still see them. You can reactivate it any time.",
        confirmLabel: 'Deactivate',
        danger: true,
      });
      if (!ok) return;
    }
    try {
      put(await updateCommunity(c.id, { active }));
      toast(active ? 'Community activated' : 'Community deactivated', { tone: 'success' });
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    }
  };

  const setVisibility = async (c: Community, visibility: Visibility) => {
    if (visibility === 'public') {
      const ok = await confirm({ title: `Make ${c.name} public?`, message: 'It will be listed in the app under Community → Discover, and anyone can join it without the QR code.', confirmLabel: 'Make public' });
      if (!ok) return;
    }
    try {
      put(await updateCommunity(c.id, { visibility }));
      toast(visibility === 'public' ? 'Community is now public' : 'Community is now private', { tone: 'success' });
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    }
  };

  const remove = async (c: Community) => {
    const ok = await confirm({ title: `Delete ${c.name}?`, message: `This can't be undone. All ${c.members} members are removed from it and its QR code stops working. Accounts and workout data are kept. To pause it instead, deactivate it.`, confirmLabel: 'Delete for good', danger: true });
    if (!ok) return;
    try {
      await deleteCommunity(c.id);
      setList((l) => l?.filter((x) => x.id !== c.id) ?? null);
      toast('Community deleted', { tone: 'success' });
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    }
  };

  const membersOf = membersId ? byId.get(membersId) : null;
  const totals = useMemo(() => ({ all: list?.length ?? 0, active: list?.filter((c) => c.active).length ?? 0 }), [list]);

  return (
    <>
      <PageTitle
        title="Gym communities"
        desc="Each gym gets a QR code. People who scan it join straight away."
        actions={
          <>
            <button className="btn-secondary" onClick={load}>
              <RefreshCw size={15} /> Refresh
            </button>
            <button className="btn-primary" onClick={() => setForm({ open: true, edit: null })}>
              <Plus size={16} /> New community
            </button>
          </>
        }
      />
      {error ? (
        <ErrorBlock message={error} onRetry={load} />
      ) : !list ? (
        <LoadingBlock />
      ) : (
        <Panel flush>
          <Toolbar>
            <SearchBox value={q} onChange={setQ} placeholder="Search gym, location or owner" />
            <SelectFilter<VisibilityFilter>
              label="Visibility"
              value={vis}
              onChange={setVis}
              options={[
                { value: 'all', label: 'Public and private' },
                { value: 'public', label: 'Public' },
                { value: 'private', label: 'Private' },
              ]}
            />
            <SelectFilter<StatusFilter>
              label="Status"
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all', label: `All (${totals.all})` },
                { value: 'active', label: `Active (${totals.active})` },
                { value: 'inactive', label: `Deactivated (${totals.all - totals.active})` },
              ]}
            />
          </Toolbar>
          <Table minWidth={980}>
            <THead>
              <Th sortKey="name" sort={sort} onSort={toggle}>
                Community
              </Th>
              <Th>Status</Th>
              <Th>Visibility</Th>
              <Th sortKey="members" sort={sort} onSort={toggle} className="text-right">
                Members
              </Th>
              <Th sortKey="joinedThisWeek" sort={sort} onSort={toggle} className="text-right">
                New (7d)
              </Th>
              <Th sortKey="blocked" sort={sort} onSort={toggle} className="text-right">
                Blocked
              </Th>
              <Th>Gym owners</Th>
              <Th sortKey="createdAt" sort={sort} onSort={toggle}>
                Created
              </Th>
              <Th className="w-28">
                <span className="sr-only">Actions</span>
              </Th>
            </THead>
            <tbody>
              {page.rows.length === 0 && (
                <EmptyRow cols={9}>
                  {list.length ? (
                    'No communities match these filters.'
                  ) : (
                    <>
                      No communities yet.{' '}
                      <button className="link-accent font-semibold" onClick={() => setForm({ open: true, edit: null })}>
                        Create the first one
                      </button>
                    </>
                  )}
                </EmptyRow>
              )}
              {page.rows.map((c) => (
                <Tr key={c.id} onClick={() => setMembersId(c.id)} dim={!c.active}>
                  <Td>
                    <div className="font-semibold">{c.name}</div>
                    {c.location && (
                      <div className="flex items-center gap-1 text-xs text-steel-mute dark:text-floor-mute">
                        <MapPin size={11} /> {c.location}
                      </div>
                    )}
                  </Td>
                  <Td>
                    <Badge dot tone={c.active ? 'green' : 'amber'}>
                      {c.active ? 'Active' : 'Deactivated'}
                    </Badge>
                  </Td>
                  <Td>
                    <span className="inline-flex items-center gap-1.5 text-sm" title={c.visibility === 'public' ? 'Listed in Community → Discover' : 'Join by QR code only'}>
                      {c.visibility === 'public' ? <Globe size={14} className="text-sky-600 dark:text-sky-400" /> : <Lock size={14} className="text-steel-mute" />}
                      {c.visibility === 'public' ? 'Public' : 'Private'}
                    </span>
                  </Td>
                  <Td className="text-right font-mono tabular">{c.members}</Td>
                  <Td className="text-right font-mono tabular">{c.joinedThisWeek || <span className="text-steel-mute">—</span>}</Td>
                  <Td className="text-right font-mono tabular">{c.blocked ? <span className="text-red-600 dark:text-red-400">{c.blocked}</span> : <span className="text-steel-mute">—</span>}</Td>
                  <Td>
                    {c.owners.length ? (
                      <span className="text-sm" title={c.owners.map((o) => o.email).join(', ')}>
                        {c.owners[0].name || c.owners[0].email}
                        {c.owners.length > 1 && <span className="text-steel-mute"> +{c.owners.length - 1}</span>}
                      </span>
                    ) : (
                      <button
                        className="link-accent text-xs font-semibold"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOwnersId(c.id);
                        }}
                      >
                        + Add owner
                      </button>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-steel-mute dark:text-floor-mute">{format(c.createdAt, 'd MMM yyyy')}</Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <button className="icon-btn" onClick={() => setQrId(c.id)} aria-label={`QR code for ${c.name}`} title="QR code">
                        <QrCode size={17} />
                      </button>
                      <Menu
                        label={`Actions for ${c.name}`}
                        trigger={<MoreVertical size={17} />}
                        items={[
                          { label: 'Open community feed', icon: <MessageSquare size={16} />, onSelect: () => navigate(`/community/${c.id}`) },
                          { label: 'Members', icon: <Users size={16} />, onSelect: () => setMembersId(c.id) },
                          { label: 'Gym owners', icon: <UserCog size={16} />, onSelect: () => setOwnersId(c.id) },
                          { label: 'Edit details', icon: <Pencil size={16} />, onSelect: () => setForm({ open: true, edit: c }) },
                          c.visibility === 'public'
                            ? { label: 'Make private', icon: <Lock size={16} />, onSelect: () => setVisibility(c, 'private') }
                            : { label: 'Make public', icon: <Globe size={16} />, onSelect: () => setVisibility(c, 'public') },
                          c.active
                            ? { label: 'Deactivate', icon: <CirclePause size={16} />, onSelect: () => setActive(c, false) }
                            : { label: 'Activate', icon: <CirclePlay size={16} />, onSelect: () => setActive(c, true) },
                          { label: 'Delete', icon: <Trash2 size={16} />, danger: true, onSelect: () => remove(c) },
                        ]}
                      />
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={page.page} pages={page.pages} total={page.total} pageSize={page.pageSize} onPage={page.setPage} noun="communities" />
        </Panel>
      )}

      <CommunityForm
        open={form.open}
        initial={form.edit}
        onClose={() => setForm({ open: false, edit: null })}
        onSaved={(c, created) => {
          put(c);
          if (created) setQrId(c.id);
        }}
      />
      <QrModal
        community={qrId ? byId.get(qrId) ?? null : null}
        onClose={() => setQrId(null)}
        onRegenerate={async () => {
          if (qrId) put(await updateCommunity(qrId, { regenerateCode: true }));
        }}
      />
      <OwnersModal community={ownersId ? byId.get(ownersId) ?? null : null} onClose={() => setOwnersId(null)} onSaved={put} />
      <Modal
        open={!!membersOf}
        onClose={() => setMembersId(null)}
        title={
          membersOf ? (
            <span className="flex items-center gap-2">
              {membersOf.name} · Members {!membersOf.active && <Badge tone="amber">Deactivated</Badge>}
            </span>
          ) : (
            ''
          )
        }
        size="lg"
      >
        {membersOf && <MembersPanel asAdmin communityId={membersOf.id} onChanged={load} />}
      </Modal>
    </>
  );
}
