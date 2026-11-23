import { useEffect, useRef, useState, type FormEvent } from 'react';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { Heart, Loader2, MessageCircle, MoreHorizontal, Pencil, Pin, PinOff, Send, Trash2 } from 'lucide-react';
import { Menu, type MenuItem } from '../Menu';
import { UserAvatar } from '../UserAvatar';
import { useToast } from '../../context/Toast';
import { useConfirm } from '../../context/Confirm';
import { useAuth } from '../../lib/auth';
import { addComment, COMMENT_MAX, deleteComment, deletePost, editPost, getComments, likePost, mediaSrc, pinPost, POST_MAX, type Author, type Comment, type Post } from '../../lib/feed';

const ago = (t: number) => (Date.now() - t < 60_000 ? 'just now' : formatDistanceToNowStrict(t, { addSuffix: true }));

function Byline({ author, at, edited }: { author: Author; at: number; edited?: boolean }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span className="truncate text-sm font-semibold">{author.name || 'Member'}</span>
        {author.isOwner && <span className="rounded bg-volt-500/20 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-steel dark:text-volt-400">Gym owner</span>}
      </div>
      <div className="text-xs text-steel-mute dark:text-floor-mute" title={format(at, 'd MMM yyyy, HH:mm')}>
        {ago(at)}
        {edited && ' · edited'}
      </div>
    </div>
  );
}

/** Pictures on a post: one large, or a 2-column grid. */
function MediaGrid({ media }: { media: Post['media'] }) {
  if (!media.length) return null;
  const one = media.length === 1;
  return (
    <div className={`mt-3 grid gap-1 overflow-hidden rounded-lg ${one ? '' : 'grid-cols-2'}`}>
      {media.map((m, i) => (
        <a key={m.key} href={mediaSrc(m.key)} target="_blank" rel="noreferrer" className={`block bg-steel/10 ${!one && media.length === 3 && i === 0 ? 'col-span-2' : ''}`}>
          <img
            src={mediaSrc(m.key)}
            alt=""
            loading="lazy"
            decoding="async"
            className={`h-full w-full object-cover ${one ? 'max-h-[28rem]' : 'aspect-square'}`}
            style={one && m.width && m.height ? { aspectRatio: `${m.width} / ${m.height}` } : undefined}
          />
        </a>
      ))}
    </div>
  );
}

function Comments({ post, canPost, onCount }: { post: Post; canPost: boolean; onCount: (n: number) => void }) {
  const toast = useToast();
  const me = useAuth()?.user;
  const [list, setList] = useState<Comment[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    getComments(post.id)
      .then(setList)
      .catch((e) => toast((e as Error).message, { tone: 'error' }));
    input.current?.focus();
  }, [post.id, toast]);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const c = await addComment(post.id, text);
      setList((l) => [...(l ?? []), c]);
      onCount((list?.length ?? 0) + 1);
      setText('');
    } catch (err) {
      toast((err as Error).message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: Comment) => {
    try {
      await deleteComment(c.id);
      setList((l) => l?.filter((x) => x.id !== c.id) ?? null);
      onCount((list?.length ?? 1) - 1);
    } catch (err) {
      toast((err as Error).message, { tone: 'error' });
    }
  };

  return (
    <div className="mt-3 space-y-3 border-t border-steel/10 pt-3 dark:border-white/[0.06]">
      {!list ? (
        <div className="flex justify-center py-2 text-steel-mute">
          <Loader2 size={16} className="animate-spin" />
        </div>
      ) : (
        list.map((c) => (
          <div key={c.id} className="group flex gap-2.5">
            <UserAvatar name={c.author.name} avatarKey={c.author.avatarKey} size="xs" />
            <div className="min-w-0 flex-1">
              <div className="rounded-2xl rounded-tl-sm bg-steel/[0.06] px-3 py-2 dark:bg-white/[0.05]">
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  {c.author.name}
                  {c.author.isOwner && <span className="rounded bg-volt-500/20 px-1 text-[9px] font-bold uppercase text-steel dark:text-volt-400">Owner</span>}
                </div>
                <p className="whitespace-pre-wrap break-words text-sm">{c.body}</p>
              </div>
              <div className="mt-0.5 flex items-center gap-3 px-2 text-[11px] text-steel-mute dark:text-floor-mute">
                <span title={format(c.createdAt, 'd MMM yyyy, HH:mm')}>{ago(c.createdAt)}</span>
                {c.canDelete && (
                  <button className="font-semibold hover:text-red-600" onClick={() => void remove(c)}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        ))
      )}
      {canPost && (
        <form onSubmit={send} className="flex items-end gap-2">
          <UserAvatar name={me?.name || me?.email || '?'} avatarKey={me?.avatarKey} size="xs" />
          <textarea
            ref={input}
            className="input min-h-[2.5rem] flex-1 resize-none !py-2 text-sm"
            rows={1}
            placeholder="Write a comment…"
            value={text}
            maxLength={COMMENT_MAX}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            aria-label="Write a comment"
          />
          <button className="btn-primary !h-10 !w-10 !p-0" disabled={busy || !text.trim()} aria-label="Send comment">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </form>
      )}
    </div>
  );
}

export function PostCard({ post, canModerate, canPost, onChange, onDelete }: { post: Post; canModerate: boolean; canPost: boolean; onChange: (p: Post) => void; onDelete: (id: number) => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.body);
  const [busy, setBusy] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const long = post.body.length > 600 || post.body.split('\n').length > 10;

  const toggleLike = async () => {
    const liked = !post.liked;
    onChange({ ...post, liked, likes: post.likes + (liked ? 1 : -1) });
    try {
      const r = await likePost(post.id, liked);
      onChange({ ...post, liked: r.liked, likes: r.likes });
    } catch (e) {
      onChange(post);
      toast((e as Error).message, { tone: 'error' });
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      onChange(await editPost(post.id, draft));
      setEditing(false);
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const mine = post.canEdit;
    const ok = await confirm({ title: 'Delete this post?', message: mine ? 'Its likes and comments are deleted too.' : `You're removing ${post.author.name}'s post as a moderator. Its likes and comments are deleted too.`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      await deletePost(post.id);
      onDelete(post.id);
      toast('Post deleted', { tone: 'success' });
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    }
  };

  const pin = async () => {
    try {
      onChange(await pinPost(post.id, !post.pinned));
      toast(post.pinned ? 'Unpinned' : 'Pinned to the top', { tone: 'success' });
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    }
  };

  const items: MenuItem[] = [];
  if (post.canEdit && canPost) items.push({ label: 'Edit', icon: <Pencil size={16} />, onSelect: () => (setDraft(post.body), setEditing(true)) });
  if (canModerate) items.push({ label: post.pinned ? 'Unpin' : 'Pin to top', icon: post.pinned ? <PinOff size={16} /> : <Pin size={16} />, onSelect: () => void pin() });
  if (post.canDelete) items.push({ label: 'Delete', icon: <Trash2 size={16} />, danger: true, onSelect: () => void remove() });

  return (
    <article className={`card p-4 ${post.pinned ? 'ring-1 ring-volt-600/40 dark:ring-volt-500/30' : ''}`}>
      {post.pinned && (
        <div className="mb-2 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-volt-700 dark:text-volt-400">
          <Pin size={12} /> Pinned
        </div>
      )}
      <header className="flex items-start gap-3">
        <UserAvatar name={post.author.name} avatarKey={post.author.avatarKey} size="sm" />
        <Byline author={post.author} at={post.createdAt} edited={!!post.editedAt} />
        {items.length > 0 && <Menu label="Post options" trigger={<MoreHorizontal size={18} />} items={items} />}
      </header>

      {editing ? (
        <div className="mt-3 space-y-2">
          <textarea className="input min-h-[6rem] resize-y" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={POST_MAX} autoFocus aria-label="Edit post" />
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={() => void save()} disabled={busy || !draft.trim() || draft === post.body}>
              {busy && <Loader2 size={16} className="animate-spin" />} Save
            </button>
          </div>
        </div>
      ) : (
        post.body && (
          <div className="mt-3">
            <p className={`whitespace-pre-wrap break-words text-[15px] leading-relaxed ${long && !expanded ? 'line-clamp-[10]' : ''}`}>{post.body}</p>
            {long && (
              <button className="mt-1 text-sm font-semibold link-accent" onClick={() => setExpanded((x) => !x)}>
                {expanded ? 'Show less' : 'Read more'}
              </button>
            )}
          </div>
        )
      )}

      <MediaGrid media={post.media} />

      <footer className="mt-3 flex items-center gap-1 border-t border-steel/10 pt-2 dark:border-white/[0.06]">
        <button
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-semibold transition hover:bg-steel/[0.06] dark:hover:bg-white/[0.06] ${post.liked ? 'text-plate-600 dark:text-plate-400' : 'text-steel-mute dark:text-floor-mute'}`}
          onClick={() => void toggleLike()}
          aria-pressed={post.liked}
          aria-label={post.liked ? 'Unlike' : 'Like'}
        >
          <Heart size={17} fill={post.liked ? 'currentColor' : 'none'} />
          <span className="tabular">{post.likes || ''}</span>
          <span className="sr-only">likes</span>
        </button>
        <button
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-semibold text-steel-mute transition hover:bg-steel/[0.06] dark:text-floor-mute dark:hover:bg-white/[0.06]"
          onClick={() => setShowComments((x) => !x)}
          aria-expanded={showComments}
        >
          <MessageCircle size={17} />
          {post.comments ? `${post.comments} comment${post.comments === 1 ? '' : 's'}` : 'Comment'}
        </button>
      </footer>

      {showComments && <Comments post={post} canPost={canPost} onCount={(n) => onChange({ ...post, comments: n })} />}
    </article>
  );
}
