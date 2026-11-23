import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, Globe, Loader2, Lock, MapPin, MessageSquare, PauseCircle, Search, Users } from 'lucide-react';
import { EmptyState, PageHeader, TabBar } from '../components/ui';
import { UserAvatar } from '../components/UserAvatar';
import { PostCard } from '../components/community/PostCard';
import { useToast } from '../context/Toast';
import { useAuth } from '../lib/auth';
import { createPost, getFeed, getPeople, POST_MAX, type CommunityInfo, type FeedAccess, type Person, type Post } from '../lib/feed';

type Tab = 'feed' | 'members';

function Composer({ communityName, onPosted, communityId }: { communityName: string; communityId: number; onPosted: (p: Post) => void }) {
  const toast = useToast();
  const me = useAuth()?.user;
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);

  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      onPosted(await createPost(communityId, text));
      setText('');
      setFocused(false);
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const open = focused || !!text;
  return (
    <div className="card p-4">
      <div className="flex gap-3">
        <UserAvatar name={me?.name || me?.email || '?'} avatarKey={me?.avatarKey} size="sm" />
        <textarea
          className={`input flex-1 resize-none text-[15px] transition-all ${open ? 'min-h-[6rem]' : 'min-h-[2.75rem]'}`}
          placeholder={`Share something with ${communityName}…`}
          value={text}
          maxLength={POST_MAX}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit();
          }}
          aria-label="Write a post"
        />
      </div>
      {open && (
        <div className="mt-3 flex items-center justify-end gap-3">
          {text.length > POST_MAX - 200 && (
            <span className={`text-xs tabular ${text.length >= POST_MAX ? 'text-red-600' : 'text-steel-mute'}`}>
              {text.length}/{POST_MAX}
            </span>
          )}
          <button className="btn-ghost" onClick={() => (setText(''), setFocused(false))} disabled={busy}>
            Cancel
          </button>
          <button className="btn-primary" onClick={() => void submit()} disabled={busy || !text.trim()}>
            {busy && <Loader2 size={16} className="animate-spin" />} Post
          </button>
        </div>
      )}
    </div>
  );
}

function Feed({ communityId, onLoaded }: { communityId: number; onLoaded: (c: CommunityInfo) => void }) {
  const toast = useToast();
  const [community, setCommunity] = useState<CommunityInfo | null>(null);
  const [me, setMe] = useState<FeedAccess | null>(null);
  const [pinned, setPinned] = useState<Post[]>([]);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(() => {
    setError(null);
    getFeed(communityId)
      .then((f) => {
        setCommunity(f.community);
        onLoaded(f.community);
        setMe(f.me);
        setPinned(f.pinned);
        setPosts(f.posts);
        setNext(f.nextBefore);
      })
      .catch((e) => setError((e as Error).message));
  }, [communityId, onLoaded]);
  useEffect(load, [load]);

  const more = async () => {
    if (!next) return;
    setLoadingMore(true);
    try {
      const f = await getFeed(communityId, next);
      setPosts((p) => [...(p ?? []), ...f.posts.filter((x) => !p?.some((y) => y.id === x.id))]);
      setNext(f.nextBefore);
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    } finally {
      setLoadingMore(false);
    }
  };

  // A post can move between "pinned" and the feed when it's pinned or unpinned.
  const change = (p: Post) => {
    setPinned((list) => (p.pinned ? (list.some((x) => x.id === p.id) ? list.map((x) => (x.id === p.id ? p : x)) : [p, ...list]) : list.filter((x) => x.id !== p.id)));
    setPosts((list) => {
      const l = list ?? [];
      if (p.pinned) return l.filter((x) => x.id !== p.id);
      if (l.some((x) => x.id === p.id)) return l.map((x) => (x.id === p.id ? p : x));
      return [...l, p].sort((a, b) => b.id - a.id);
    });
  };
  const remove = (id: number) => {
    setPinned((l) => l.filter((x) => x.id !== id));
    setPosts((l) => l?.filter((x) => x.id !== id) ?? null);
  };

  if (error)
    return (
      <EmptyState icon={<Lock size={24} />} title="Can't open this community">
        <p>{error}</p>
        <Link to="/community" className="btn-secondary mt-4">
          Back to my gyms
        </Link>
      </EmptyState>
    );
  if (!posts || !me || !community)
    return (
      <div className="flex justify-center py-16 text-steel-mute">
        <Loader2 className="animate-spin" />
      </div>
    );

  const empty = posts.length === 0 && pinned.length === 0;
  return (
    <div className="space-y-3">
      {me.canPost ? (
        <Composer communityId={communityId} communityName={community.name} onPosted={(p) => setPosts((l) => [p, ...(l ?? [])])} />
      ) : (
        <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
          <PauseCircle size={18} /> This community is paused. You can read posts, but new posts and comments are turned off.
        </div>
      )}
      {(me.canModerate || me.isAdmin) && (
        <p className="px-1 text-xs text-steel-mute dark:text-floor-mute">
          {me.isOwner ? "You're a gym owner here" : "You're viewing as an admin"}: you can pin posts and remove posts or comments.
        </p>
      )}
      {pinned.map((p) => (
        <PostCard key={p.id} post={p} canModerate={me.canModerate} canPost={me.canPost} onChange={change} onDelete={remove} />
      ))}
      {empty ? (
        <EmptyState icon={<MessageSquare size={24} />} title="No posts yet">
          {me.canPost ? 'Say hi to your gym! Share a PR, ask for a spotter, or post a training tip.' : 'Nothing has been posted here.'}
        </EmptyState>
      ) : (
        posts.map((p) => <PostCard key={p.id} post={p} canModerate={me.canModerate} canPost={me.canPost} onChange={change} onDelete={remove} />)
      )}
      {next && (
        <button className="btn-secondary w-full" onClick={() => void more()} disabled={loadingMore}>
          {loadingMore && <Loader2 size={16} className="animate-spin" />} Load older posts
        </button>
      )}
    </div>
  );
}

function Members({ communityId, onLoaded }: { communityId: number; onLoaded: (c: CommunityInfo) => void }) {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    getPeople(communityId)
      .then((r) => {
        setPeople(r.people);
        onLoaded(r.community);
      })
      .catch((e) => setError((e as Error).message));
  }, [communityId, onLoaded]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (people ?? []).filter((p) => !t || p.name.toLowerCase().includes(t));
  }, [people, q]);

  if (error) return <p className="card p-4 text-sm text-red-600 dark:text-red-400">{error}</p>;
  if (!people)
    return (
      <div className="flex justify-center py-16 text-steel-mute">
        <Loader2 className="animate-spin" />
      </div>
    );
  return (
    <div className="space-y-3">
      <label className="relative block">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-steel-mute" />
        <input className="input !pl-9" placeholder={`Search ${people.length} member${people.length === 1 ? '' : 's'}`} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search members" />
      </label>
      <ul className="grid gap-2 sm:grid-cols-2">
        {shown.map((p) => (
          <li key={p.id} className="card flex items-center gap-3 p-3">
            <UserAvatar name={p.name} avatarKey={p.avatarKey} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-semibold">{p.name || 'Member'}</span>
                {p.isOwner && <span className="rounded bg-volt-500/20 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-steel dark:text-volt-400">Gym owner</span>}
              </div>
              <div className="text-xs text-steel-mute dark:text-floor-mute">{p.isOwner ? 'Runs this gym' : `Member since ${format(p.joinedAt, 'MMM yyyy')}`}</div>
            </div>
          </li>
        ))}
      </ul>
      {shown.length === 0 && <p className="py-8 text-center text-sm text-steel-mute">No one matches “{q}”.</p>}
    </div>
  );
}

/** One gym's community: a feed members post to, and who's in it. */
export default function CommunityDetailPage() {
  const { id } = useParams();
  const communityId = Number(id);
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'members' ? 'members' : 'feed';
  const [info, setInfo] = useState<CommunityInfo | null>(null);
  const onLoaded = useCallback((c: CommunityInfo) => setInfo(c), []);

  return (
    <>
      <PageHeader
        title={info?.name ?? 'Community'}
        subtitle={
          info ? (
            <span className="inline-flex items-center gap-2">
              {info.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={11} /> {info.location}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                {info.visibility === 'public' ? <Globe size={11} /> : <Lock size={11} />}
                {info.members} member{info.members === 1 ? '' : 's'}
              </span>
            </span>
          ) : undefined
        }
        left={
          <Link to="/community" className="icon-btn -ml-2" aria-label="Back to my gyms">
            <ArrowLeft size={20} />
          </Link>
        }
      />
      <div className="mx-auto max-w-app space-y-4 px-4 pt-4 lg:max-w-2xl lg:px-8">
        <TabBar<Tab>
          ariaLabel="Community sections"
          value={tab}
          onChange={(t) => setParams(t === 'feed' ? {} : { tab: t }, { replace: true })}
          tabs={[
            { value: 'feed', label: 'Feed', icon: <MessageSquare size={16} /> },
            { value: 'members', label: info ? `Members (${info.members})` : 'Members', icon: <Users size={16} /> },
          ]}
        />
        {Number.isSafeInteger(communityId) && communityId > 0 ? (
          tab === 'feed' ? (
            <Feed communityId={communityId} onLoaded={onLoaded} />
          ) : (
            <Members communityId={communityId} onLoaded={onLoaded} />
          )
        ) : (
          <EmptyState icon={<Lock size={24} />} title="Community not found" />
        )}
      </div>
    </>
  );
}
