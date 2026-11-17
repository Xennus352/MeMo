import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft, Plus, Megaphone, BellRing, Mic, Repeat, Check, Trash2,
  Send, X, Clock3, AlarmClockCheck,
} from 'lucide-react';
import { cn } from '@/utils/helpers';
import { MotionGlassCard } from '@/components/ui/GlassComponents';
import { ParticleBurst } from '@/components/ui/ParticleBurst';
import { useToast, useCustomModals } from '@/components/ui/CustomModals';
import { PresenceChip } from '@/components/ui/PresenceChip';
import { useNoticeStore, useUserStore, usePresenceStore, useVoiceStore } from '@/stores';
import type { Notice } from '@/types';

/* ------------------------------------------------------------------ */
/* Small time helpers — everything user-facing stays in local time     */
/* ------------------------------------------------------------------ */

const pad2 = (n: number) => String(n).padStart(2, '0');

/** "2026-11-17T19:30" local, for <input type="datetime-local"> */
const localInputValue = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

/** Parse the datetime-local value back into an ISO string. */
const fromLocalInput = (value: string): string | null => {
  const t = Date.parse(value);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};

const fmtDayLong = (d: Date): string =>
  d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

const fmtTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

const fmtDayBlock = (iso: string): { day: string; month: string; time: string } => {
  const d = new Date(iso);
  return {
    day: String(d.getDate()),
    month: d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase(),
    time: fmtTime(iso),
  };
};

/** "in 3h 12m" / "in 25 min" / "due now" */
const countdownLabel = (iso: string, nowMs: number): string => {
  const diff = Date.parse(iso) - nowMs;
  if (diff <= 0) return 'due now';
  const mins = Math.round(diff / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `in ${m} min`;
  if (h >= 24) {
    const days = Math.floor(h / 24);
    return `in ${days}d ${h % 24}h`;
  }
  return `in ${h}h ${pad2(m)}m`;
};

const repeatLabel = (mins: number): string =>
  mins % 60 === 0 ? `every ${mins / 60}h` : `every ${mins} min`;

/* ------------------------------------------------------------------ */
/* Notice ticket — one note, one card                                  */
/* ------------------------------------------------------------------ */

/* Ticking clock, isolated: only the countdown pill re-renders each second, never the board */
const useNow = (intervalMs: number): number => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
};

const LiveCountdown: React.FC<{ iso: string }> = React.memo(({ iso }) => {
  const nowMs = useNow(1000);
  const diff = Date.parse(iso) - nowMs;
  const label = diff <= 0 ? 'due now' : countdownLabel(iso, nowMs);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-light px-2.5 py-1 text-[11px] font-semibold tabular-nums text-accent">
      <Clock3 className="h-3 w-3" /> {label}
    </span>
  );
});
LiveCountdown.displayName = 'LiveCountdown';

const NoticeTicket: React.FC<{
  notice: Notice;
  mine: boolean;
  ownerName: string;
  voiceOn: boolean;
  onGotIt: (n: Notice) => void;
  onDelete: (n: Notice) => void;
  /** Play the heart-and-sparkle dissolve before the row leaves the store */
  destroying?: boolean;
}> = React.memo(({ notice, mine, ownerName, voiceOn, onGotIt, onDelete, destroying = false }) => {
  const block = fmtDayBlock(notice.remindAt);
  const isRepeat = notice.repeatMinutes > 0;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 28, scale: 0.96 }}
      animate={destroying ? { opacity: 0, scale: 0.72, y: -8 } : { opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: mine ? 90 : -90, transition: { duration: 0.28 } }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border',
        'shadow-[0_10px_30px_rgba(0,0,0,0.18)]',
        !notice.active && 'opacity-60 saturate-50'
      )}
      style={{
        background:
          'linear-gradient(165deg, color-mix(in srgb, var(--color-surface) 90%, white 10%) 0%, var(--color-surface-subtle) 100%)',
        boxShadow: mine
          ? 'inset 4px 0 0 0 var(--color-accent), 0 10px 30px rgba(0,0,0,0.18)'
          : 'inset 4px 0 0 0 var(--color-secondary), 0 10px 30px rgba(0,0,0,0.18)',
      }}
    >
      {destroying && <ParticleBurst fire />}
      <div className="flex items-stretch">
        {/* Date stub */}
        <div className="flex w-[4.75rem] flex-shrink-0 flex-col items-center justify-center gap-0.5 py-5 pl-2 pr-1">
          <span className="text-[34px] leading-none font-black tracking-tighter text-text">{block.day}</span>
          <span className="text-[10px] font-bold tracking-[0.18em] text-text-secondary">{block.month}</span>
          <span className="mt-1.5 text-[10px] font-semibold tabular-nums text-accent">{block.time}</span>
        </div>

        {/* Perforation */}
        <div aria-hidden className="relative my-4 border-l-2 border-dashed border-border/80">
          <span className="absolute -left-[9px] -top-4 h-4 w-4 rounded-full bg-bg" />
          <span className="absolute -left-[9px] -bottom-4 h-4 w-4 rounded-full bg-bg" />
        </div>

        {/* Body */}
        <div className="min-w-0 flex-1 px-4 py-5">
          {/* Burmese conjuncts stack above the Latin cap height — leading-snug clips them */}
          <p className="text-[17px] font-semibold leading-relaxed text-text break-words">{notice.message}</p>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {isRepeat ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-secondary/40 bg-secondary-light px-2.5 py-1 text-[11px] font-semibold text-secondary">
                <Repeat className="h-3 w-3" /> {repeatLabel(notice.repeatMinutes)}
              </span>
            ) : (
              <LiveCountdown iso={notice.remindAt} />
            )}
            {!isRepeat && voiceOn && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-input px-2.5 py-1 text-[11px] font-medium text-text-muted">
                <Mic className="h-3 w-3" /> Shoon
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              {mine ? 'You pinned' : `${ownerName} pinned`}
            </span>
          </div>

          <div className={cn('mt-3 flex items-center justify-end gap-2', destroying && 'opacity-0 pointer-events-none')}>
            {notice.active && (
              <button
                onClick={() => onGotIt(notice)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-success/40 bg-success/10 px-3 py-2 text-caption font-semibold text-success transition-transform active:scale-95"
              >
                <Check className="h-4 w-4" /> Got it
              </button>
            )}
            <button
              onClick={() => onDelete(notice)}
              aria-label="Delete notice"
              className="rounded-xl border border-border bg-input p-2 text-text-muted transition-colors hover:text-danger"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  );
});
NoticeTicket.displayName = 'NoticeTicket';

/* ------------------------------------------------------------------ */
/* Composer sheet                                                       */
/* ------------------------------------------------------------------ */

const REPEAT_CHIPS = [5, 10, 15, 30, 60, 120];

const Composer: React.FC<{
  open: boolean;
  onClose: () => void;
  partnerName: string;
}> = ({ open, onClose, partnerName }) => {
  const { add } = useNoticeStore();
  const { showToast } = useToast();
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<'once' | 'repeat'>('once');
  const [at, setAt] = useState(() => {
    const d = new Date(Date.now() + 30 * 60 * 1000);
    return localInputValue(d);
  });
  const [repeat, setRepeat] = useState(15);
  const [customRepeat, setCustomRepeat] = useState('');
  const [sending, setSending] = useState(false);

  const effectiveRepeat = customRepeat.trim() ? Math.max(5, Math.floor(Number(customRepeat) || 0)) : repeat;
  const atIso = fromLocalInput(at);
  const onceValid = mode !== 'once' || (atIso !== null && Date.parse(atIso) > Date.now());
  const canSend = message.trim().length > 0 && !sending && onceValid;

  const quickSet = (kind: 'plus30' | 'tonight' | 'tomorrow') => {
    const d = new Date();
    if (kind === 'plus30') {
      d.setMinutes(d.getMinutes() + 30, 0, 0);
    } else if (kind === 'tonight') {
      d.setHours(20, 0, 0, 0);
      if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
    } else {
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
    }
    setAt(localInputValue(d));
  };

  const reset = () => {
    setMessage('');
    setMode('once');
    setAt(localInputValue(new Date(Date.now() + 30 * 60 * 1000)));
    setRepeat(15);
    setCustomRepeat('');
    setSending(false);
  };

  const submit = async () => {
    if (!canSend) return;
    const iso = mode === 'once' ? atIso : new Date().toISOString();
    if (!iso) return;
    setSending(true);
    try {
      await add({ message, remindAt: iso, repeatMinutes: mode === 'repeat' ? effectiveRepeat : 0 });
      showToast(mode === 'once' ? 'Pinned — they’ll hear it on time' : `Pinned — every ${effectiveRepeat} min until you stop it`, 'success');
      reset();
      onClose();
    } catch (error) {
      const reason = error instanceof Error ? ` (${error.message.slice(0, 120)})` : '';
      showToast(`Could not pin the notice${reason}. Try again.`, 'error');
      setSending(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div key="composer" className="fixed inset-0 z-[var(--z-modal)] flex items-end justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/60" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-label="Pin a notice"
            initial={{ y: '104%' }}
            animate={{ y: 0 }}
            exit={{ y: '104%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            className="relative w-full max-w-lg rounded-t-3xl border-t border-border bg-surface px-5 pt-4 pb-6"
            style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border" />
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-light text-accent">
                  <Megaphone className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-h3 font-extrabold tracking-tight text-text leading-none">Pin a notice</h2>
                  <p className="mt-1 text-caption text-text-muted">{partnerName} gets the ping, not you</p>
                </div>
              </div>
              <button onClick={onClose} aria-label="Close" className="rounded-xl p-2 text-text-muted hover:bg-surface-subtle">
                <X className="h-5 w-5" />
              </button>
            </div>

            <label className="mt-4 block">
              <span className="sr-only">Notice for {partnerName}</span>
              <textarea
                autoFocus
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={2}
                maxLength={280}
                placeholder={`“Dinner at 7? Don’t forget the rice…”`}
                className="w-full resize-none rounded-2xl border border-border bg-input px-4 py-3.5 text-body text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit();
                }}
              />
            </label>
            <div className="mt-1 flex items-center justify-end">
              <span className="text-caption tabular-nums text-text-muted">{message.trim().length}/280</span>
            </div>

            {/* Once / Repeat segmented control */}
            <div className="mt-2 grid grid-cols-2 gap-1 rounded-2xl border border-border bg-input p-1">
              {(['once', 'repeat'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    'rounded-xl py-2.5 text-body-sm font-semibold transition-all',
                    mode === m ? 'bg-surface text-text shadow-sm' : 'text-text-muted'
                  )}
                >
                  {m === 'once' ? 'One time' : 'Repeat'}
                </button>
              ))}
            </div>

            {mode === 'once' ? (
              <div className="mt-3">
                <input
                  type="datetime-local"
                  value={at}
                  min={localInputValue(new Date())}
                  onChange={e => setAt(e.target.value)}
                  className="w-full rounded-2xl border border-border bg-input px-4 py-3 text-body text-text focus:outline-none focus:ring-2 focus:ring-accent [color-scheme:dark]"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button onClick={() => quickSet('plus30')} className="rounded-full border border-border bg-surface-subtle px-3 py-1.5 text-caption font-medium text-text-secondary active:scale-95 transition-transform">In 30 min</button>
                  <button onClick={() => quickSet('tonight')} className="rounded-full border border-border bg-surface-subtle px-3 py-1.5 text-caption font-medium text-text-secondary active:scale-95 transition-transform">Tonight 8 PM</button>
                  <button onClick={() => quickSet('tomorrow')} className="rounded-full border border-border bg-surface-subtle px-3 py-1.5 text-caption font-medium text-text-secondary active:scale-95 transition-transform">Tomorrow 9 AM</button>
                </div>
                {!onceValid && <p className="mt-2 text-caption text-danger">Pick a time in the future.</p>}
              </div>
            ) : (
              <div className="mt-3">
                <div className="flex flex-wrap items-center gap-2">
                  {REPEAT_CHIPS.map(mins => (
                    <button
                      key={mins}
                      onClick={() => { setRepeat(mins); setCustomRepeat(''); }}
                      className={cn(
                        'rounded-full border px-3.5 py-2 text-caption font-semibold tabular-nums transition-all active:scale-95',
                        !customRepeat && repeat === mins
                          ? 'border-accent bg-accent text-on-accent'
                          : 'border-border bg-surface-subtle text-text-secondary'
                      )}
                    >
                      {mins % 60 === 0 ? `${mins / 60}h` : `${mins}m`}
                    </button>
                  ))}
                  <input
                    type="number"
                    inputMode="numeric"
                    min={5}
                    value={customRepeat}
                    onChange={e => setCustomRepeat(e.target.value)}
                    placeholder="custom min"
                    aria-label="Custom minutes"
                    className="w-28 rounded-full border border-border bg-input px-3.5 py-2 text-caption tabular-nums text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <p className="mt-2 text-caption text-text-muted">
                  First ping {mode === 'repeat' ? 'right away' : ''}, then {repeatLabel(effectiveRepeat)} — until either of you taps “Got it”.
                </p>
              </div>
            )}

            <button
              onClick={submit}
              disabled={!canSend}
              className={cn(
                'mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-body font-bold transition-all',
                canSend ? 'text-on-accent active:scale-[0.98]' : 'cursor-not-allowed bg-input text-text-muted'
              )}
              style={canSend ? { background: 'linear-gradient(135deg, var(--color-accent), var(--color-secondary))' } : undefined}
            >
              <Send className="h-5 w-5" />
              {mode === 'once' ? 'Pin it' : `Pin it — ${repeatLabel(effectiveRepeat)}`}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* ------------------------------------------------------------------ */
/* The screen                                                           */
/* ------------------------------------------------------------------ */

export const NoticeboardScreen: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { showConfirm } = useCustomModals();
  const profile = useUserStore(state => state.profile);
  const partnerName = usePresenceStore(state => state.partnerName) ?? 'Partner';
  const voiceOn = useVoiceStore(state => state.enabled);
  const { items, loading, loadAll, stop, remove } = useNoticeStore();
  const [composerOpen, setComposerOpen] = useState(false);

  // Countdowns tick themselves; the board re-buckets only every 15s so due notices leave Awaiting on time
  const bucketNowMs = useNow(15000);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const myRole = profile?.role;
  const today = new Date();

  const { forYou, fromYou, quiet } = useMemo(() => {
    const isDue = (n: Notice) => !(n.repeatMinutes > 0) && Date.parse(n.remindAt) <= bucketNowMs;
    const forYou: Notice[] = [];
    const fromYou: Notice[] = [];
    const quiet: Notice[] = [];
    for (const n of items) {
      // Due notices land in Quiet on every device at the same wall-clock second — no sync needed
      if (!n.active || isDue(n)) {
        quiet.push(n);
        continue;
      }
      if (myRole && n.createdBy !== myRole) forYou.push(n);
      else fromYou.push(n);
    }
    quiet.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    return { forYou, fromYou, quiet: quiet.slice(0, 8) };
  }, [items, myRole, bucketNowMs]);

  const handleGotIt = useCallback((n: Notice) => {
    void stop(n.id).then(() => showToast('Got it — cleared from the board', 'success'));
  }, [stop, showToast]);

  const handleDelete = useCallback((n: Notice) => {
    showConfirm({
      title: 'Delete notice?',
      message: `“${n.message.slice(0, 80)}${n.message.length > 80 ? '…' : ''}” will be removed for both of you.`,
      type: 'danger',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: () => {
        // Same heart-and-sparkle dissolve the milestone cards use
        setDeletingIds(prev => new Set(prev).add(n.id));
        window.setTimeout(() => {
          remove(n.id);
          setDeletingIds(prev => {
            const next = new Set(prev);
            next.delete(n.id);
            return next;
          });
        }, 1150);
      },
    });
  }, [showConfirm, remove]);

  const ticketProps = { ownerName: partnerName, voiceOn };

  return (
    <div className="min-h-screen bg-bg pb-32 safe-bottom">
      {/* Status Bar */}
      <div className="fixed top-0 left-0 right-0 z-40 h-[env(safe-area-inset-top)] bg-bg/80 backdrop-blur-sm" />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="fixed top-0 left-0 right-0 z-40 border-b border-border/60 bg-bg/85 px-4 pb-4 pt-[env(safe-area-inset-top)] backdrop-blur-sm safe-top"
      >
        <div className="app-header-inner flex items-center justify-between">
          <button onClick={() => navigate('/')} className="p-2 rounded-xl hover:bg-surface-subtle transition-colors" aria-label="Back to home">
            <ChevronLeft className="w-5 h-5 text-text-secondary" />
          </button>
          <h1 className="text-h3 font-bold text-text">Notices</h1>
          <button
            onClick={() => setComposerOpen(true)}
            aria-label="Pin a notice"
            className="flex h-9 w-9 items-center justify-center rounded-full text-on-accent shadow-[0_2px_10px_var(--color-accent-glow)] transition-transform active:scale-95"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-secondary))' }}
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </motion.div>

      {/* Main content */}
      <div className="app-content space-y-6 px-4 pb-4" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 96px)' }}>

        {/* Chapter — the day, huge, and the board's one-line promise */}
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-end justify-between gap-4 pt-2"
        >
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-accent/90">
              {fmtDayLong(today)}
            </p>
            <h2
              className="mt-2 font-black leading-[0.95] tracking-tighter text-text"
              style={{ fontSize: 'clamp(2.6rem, 11vw, 4rem)' }}
            >
              The board,<br />kept<br />for you.
            </h2>
          </div>
          <div className="flex flex-col items-end gap-2 pb-1">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/30 text-accent"
              style={{ background: 'radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--color-accent) 24%, transparent), transparent 75%)' }}
            >
              <AlarmClockCheck className="h-8 w-8" strokeWidth={1.6} />
            </div>
          </div>
        </motion.section>

        <div className="flex items-center justify-between gap-3">
          <PresenceChip compact />
          <span className="text-caption font-medium text-text-muted">
            {forYou.length} for you{fromYou.length > 0 ? ` · ${fromYou.length} from you` : ''}
          </span>
        </div>

        {/* Compose strip — the board writes itself here */}
        <MotionGlassCard
          className="cursor-pointer p-4"
          onClick={() => setComposerOpen(true)}
          role="button"
          aria-label="Pin a notice"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-dashed border-accent/50 text-accent">
              <Plus className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-body-sm font-semibold text-text">Pin a notice for {partnerName}</p>
              <p className="text-caption text-text-muted">One ping at a time, or every few minutes</p>
            </div>
            <BellRing className="h-5 w-5 flex-shrink-0 text-text-muted" />
          </div>
        </MotionGlassCard>

        {/* For you */}
        {forYou.length > 0 && (
          <section aria-label="Notices for you">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-caption font-bold uppercase tracking-[0.22em] text-secondary">For you</h3>
              <span className="text-caption tabular-nums text-text-muted">{forYou.length}</span>
            </div>
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {forYou.map(n => (
                  <NoticeTicket key={n.id} notice={n} mine={false} {...ticketProps} onGotIt={handleGotIt} onDelete={handleDelete} destroying={deletingIds.has(n.id)} />
                ))}
              </AnimatePresence>
            </div>
          </section>
        )}

        {/* From you */}
        {fromYou.length > 0 && (
          <section aria-label="Notices you pinned">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-caption font-bold uppercase tracking-[0.22em] text-accent">From you</h3>
              <span className="text-caption tabular-nums text-text-muted">{fromYou.length}</span>
            </div>
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {fromYou.map(n => (
                  <NoticeTicket key={n.id} notice={n} mine {...ticketProps} onGotIt={handleGotIt} onDelete={handleDelete} destroying={deletingIds.has(n.id)} />
                ))}
              </AnimatePresence>
            </div>
          </section>
        )}

        {/* Empty state — the whole board is quiet */}
        {!loading && forYou.length === 0 && fromYou.length === 0 && quiet.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden>
              <rect x="14" y="34" width="92" height="60" rx="10" stroke="var(--color-border)" strokeWidth="2.5" strokeDasharray="6 5" />
              <path d="M20 44 L60 74 L100 44" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
              <circle cx="60" cy="74" r="4.5" fill="var(--color-secondary)" opacity="0.9" />
            </svg>
            <div>
              <p className="text-h3 font-extrabold tracking-tight text-text">The board is quiet</p>
              <p className="mx-auto mt-1.5 max-w-[26ch] text-body-sm text-text-muted">
                Pin the first note. {partnerName} gets the ping exactly when you say — even with the phone locked.
              </p>
            </div>
            <button
              onClick={() => setComposerOpen(true)}
              className="mt-1 inline-flex items-center gap-2 rounded-2xl px-6 py-3.5 text-body-sm font-bold text-on-accent transition-transform active:scale-95"
              style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-secondary))' }}
            >
              <Plus className="h-5 w-5" /> Pin the first notice
            </button>
          </div>
        )}

        {/* Quiet archive */}
        {quiet.length > 0 && (
          <section aria-label="Quiet notices">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-caption font-bold uppercase tracking-[0.22em] text-text-muted">Quiet</h3>
              <span className="text-caption tabular-nums text-text-muted">{quiet.length}</span>
            </div>
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {quiet.map(n => (
                  <NoticeTicket key={n.id} notice={n} mine={!myRole || n.createdBy === myRole} {...ticketProps} onGotIt={handleGotIt} onDelete={handleDelete} destroying={deletingIds.has(n.id)} />
                ))}
              </AnimatePresence>
            </div>
          </section>
        )}
      </div>

      {/* Composer sheet — portalled above the dock, like every modal in the app */}
      {createPortal(<Composer open={composerOpen} onClose={() => setComposerOpen(false)} partnerName={partnerName} />, document.body)}
    </div>
  );
};
