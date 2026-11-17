import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Heart, Users, Share2, CheckCircle, ShieldCheck, Smartphone, Link as LinkIcon, Unlink, Sparkles, Lock, CloudOff, EyeOff, ListOrdered, Plus, CalendarDays, Droplet } from 'lucide-react';
import { cn, formatDateKeyFull, formatDateKey, diffDays, dateKey } from '@/utils/helpers';
import { Button, MotionGlassCard } from '@/components/ui/GlassComponents';
import { PairingModal } from '@/components/onboarding/PairingModal';
import { useCustomModals, useToast } from '@/components/ui/CustomModals';
import { useUserStore } from '@/stores';
import { usePairingStore } from '@/stores';
import { useMilestoneStore } from '@/stores';
import { useAnniversaryStore } from '@/stores';
import { usePeriodStore } from '@/stores';
import { usePresenceStore } from '@/stores';
import { anniversaryOccurrence } from '@/lib/reminders';
import { unpairRemoteDevice, db } from '@/lib/tauri';
import { PresenceChip } from '@/components/ui/PresenceChip';

const STEPS = [
  { icon: Heart, title: 'Generate Code', desc: 'Create a 6-digit code that expires in 24 hours' },
  { icon: Share2, title: 'Share Securely', desc: 'Send it via message, or show it in person' },
  { icon: Smartphone, title: 'Enter Code', desc: 'Your partner enters it on their device' },
  { icon: CheckCircle, title: 'Connected', desc: 'Share periods, milestones & anniversaries' },
] as const;

const TABS = [
  { id: 'connect', label: 'Connect', icon: Users },
  { id: 'steps', label: 'Steps', icon: ListOrdered },
  { id: 'privacy', label: 'Privacy', icon: ShieldCheck },
  { id: 'device', label: 'Device', icon: Smartphone },
] as const;

type TabId = (typeof TABS)[number]['id'];

const paneVariants = {
  initial: (direction: number) => ({
    opacity: 0,
    x: 64 * direction,
    scale: 0.96,
  }),
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 320, damping: 32 } as const,
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: -48 * direction,
    scale: 0.96,
    transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

export const PairingScreen: React.FC = () => {
  const { profile, deviceId, setPairedDevice, clearPairingCode } = useUserStore();
  const { pair, loadPair } = usePairingStore();
  const milestoneTotal = useMilestoneStore(state => state.total);
  const milestoneItems = useMilestoneStore(state => state.items);
  const anniversaryItems = useAnniversaryStore(state => state.items);
  const primaryAnniversary = useAnniversaryStore(state => state.primary);
  const predictions = usePeriodStore(state => state.predictions);
  const partnerName = usePresenceStore(state => state.partnerName);
  const navigate = useNavigate();
  const { showConfirm } = useCustomModals();
  const { showToast } = useToast();
  const [showModal, setShowModal] = useState<'generate' | 'enter' | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('connect');
  const [direction, setDirection] = useState(1);

  const handleTabChange = (id: TabId) => {
    if (id === activeTab) return;
    const from = TABS.findIndex(t => t.id === activeTab);
    const to = TABS.findIndex(t => t.id === id);
    setDirection(to >= from ? 1 : -1);
    setActiveTab(id);
  };

  useEffect(() => {
    loadPair();
  }, [loadPair]);

  const handleGenerate = () => {
    if (!profile) return;
    setShowModal('generate');
  };

  const handleEnter = () => {
    setShowModal('enter');
  };

  const handleUnpair = () => {
    showConfirm({
      title: 'Unpair Devices?',
      message: 'You will stop sharing periods, milestones, and anniversaries. Your local data stays on this device.',
      type: 'danger',
      confirmText: 'Unpair',
      cancelText: 'Cancel',
      onConfirm: async () => {
        // Best-effort removal from the shared registry so the other browser agrees
        await unpairRemoteDevice(profile?.deviceId || '');
        usePresenceStore.getState().clearPartnerName();
        await setPairedDevice('');
        await clearPairingCode();
        // Clear the cached couple_pair row so polling doesn't re-insert it
        await db.transaction([{ sql: 'DELETE FROM couple_pair' }]);
        await loadPair();
        showToast('Devices unpaired', 'success');
      },
    });
  };

  const initialOf = (name?: string | null) => (name?.trim().charAt(0) || '?').toUpperCase();
  const myName = profile?.name?.trim() || 'Me';
  const milestoneCount = milestoneTotal ?? milestoneItems.length;
  const anniversaryCount = anniversaryItems.length;
  const cycleDay = predictions?.cycleDay ?? null;
  const anniversaryKey = primaryAnniversary?.date ?? pair?.anniversaryDate ?? dateKey();
  const todayKey = dateKey();
  const togetherDays = Math.max(1, diffDays(anniversaryKey, todayKey) + 1);
  const anniversaryCountdown = diffDays(todayKey, anniversaryOccurrence(anniversaryKey, todayKey));

  const roleEmoji = profile?.role === 'boy' ? '👦' : '👧';
  const roleLabel = profile?.role === 'boy' ? 'Boy' : 'Girl';

  return (
    <div className="min-h-dvh bg-bg pb-40 safe-bottom">
      {/* Status Bar */}
      <div className="fixed top-0 left-0 right-0 z-40 h-[env(safe-area-inset-top)] bg-bg/80 backdrop-blur-sm" />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed top-0 left-0 right-0 z-40 px-4 pt-[env(safe-area-inset-top)] pb-4 safe-top bg-bg/85 backdrop-blur-sm border-b border-border/60"
      >
        <div className="app-header-inner flex items-center justify-between">
          <Link to="/" className="p-2 rounded-xl hover:bg-surface-subtle transition-colors" aria-label="Back to home">
            <ChevronLeft className="w-5 h-5 text-text-secondary" />
          </Link>
          <h1 className="text-h3 font-bold text-text">Partner</h1>
          <div className="w-12" />
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="app-content pb-4 px-4 space-y-4" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 96px)' }}>
        {/* In-page tabs */}
        <div
          role="tablist"
          aria-label="Partner sections"
          className="grid grid-cols-4 gap-1 p-1.5 rounded-2xl bg-input border border-border"
        >
          {TABS.map(tab => {
            const isActive = tab.id === activeTab;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                id={`tab-${tab.id}`}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-1 min-h-14 rounded-xl outline-none transition-colors',
                  'focus-visible:ring-2 focus-visible:ring-accent-glow',
                  isActive ? 'text-on-accent' : 'text-text-secondary hover:text-text'
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="partner-tab-pill"
                    className="absolute inset-0 rounded-xl"
                    style={{
                      background: 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-hover) 100%)',
                      boxShadow: '0 6px 16px -6px var(--color-accent-glow), inset 0 1px 0 rgba(255,255,255,0.35)',
                    }}
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
                <Icon className="relative z-10 w-4 h-4 sm:w-5 sm:h-5" />
                <span className="relative z-10 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.12em]">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Animated pane container — heights differ per pane, so keep natural flow */}
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={activeTab}
            custom={direction}
            variants={paneVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            role="tabpanel"
            id={`panel-${activeTab}`}
            aria-labelledby={`tab-${activeTab}`}
            className="focus:outline-none"
          >
        {/* ─── Section 1 · Partner Connection ─── */}
        {activeTab === 'connect' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          {pair ? (
            <div className="space-y-4">
              {/* Hero — who you are, together */}
              <div className="relative overflow-hidden rounded-3xl border border-accent/25 bg-gradient-to-br from-accent/20 via-secondary/15 to-transparent p-5 sm:p-6">
                <div aria-hidden className="absolute -top-20 -right-20 w-64 h-64 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(235,154,192,0.4), transparent 70%)' }} />
                <div aria-hidden className="absolute -bottom-24 -left-20 w-64 h-64 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(186,128,240,0.32), transparent 70%)' }} />

                <div className="relative flex items-center gap-4">
                  <div className="flex -space-x-4 flex-shrink-0">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-lg sm:text-xl font-extrabold text-white/95 ring-2 ring-surface" style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-secondary))' }}>{initialOf(myName)}</div>
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-lg sm:text-xl font-extrabold text-white/95 ring-2 ring-surface" style={{ background: 'linear-gradient(135deg, var(--color-secondary), var(--color-accent))' }}>{initialOf(partnerName ?? 'Partner')}</div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] tracking-[0.22em] uppercase text-accent/80 font-semibold">MeMo Couple</p>
                    <h2 className="text-h3 sm:text-h2 font-extrabold tracking-tight text-text leading-tight truncate">
                      {myName} <span className="text-accent">&amp;</span> {partnerName ?? 'Partner'}
                    </h2>
                    <div className="mt-2"><PresenceChip compact /></div>
                  </div>
                </div>

                <div className="relative mt-5 pt-5 border-t border-white/5 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[10px] tracking-[0.22em] uppercase text-text-muted">Together for</p>
                    <p className="text-5xl sm:text-6xl font-black tracking-tighter leading-none text-text mt-1">{togetherDays}<span className="text-2xl align-top text-accent ml-1">d</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] tracking-[0.22em] uppercase text-text-muted">Anniversary</p>
                    <p className="font-bold text-text leading-tight mt-1">{formatDateKey(anniversaryKey, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    <p className="text-caption font-semibold text-accent mt-0.5">{anniversaryCountdown === 0 ? 'Today! 🎉' : `${anniversaryCountdown}d to go 🎉`}</p>
                  </div>
                </div>
              </div>

              {/* Stats — real counts, nothing decorative */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="rounded-2xl border border-border bg-input p-3 text-center">
                  <Heart className="w-5 h-5 text-accent mx-auto" />
                  <p className="text-xl sm:text-2xl font-extrabold text-text mt-1 leading-none">{milestoneCount}</p>
                  <p className="text-[10px] tracking-[0.18em] uppercase text-text-muted mt-1">Memories</p>
                </div>
                <div className="rounded-2xl border border-border bg-input p-3 text-center">
                  <Sparkles className="w-5 h-5 text-secondary mx-auto" />
                  <p className="text-xl sm:text-2xl font-extrabold text-text mt-1 leading-none">{anniversaryCount}</p>
                  <p className="text-[10px] tracking-[0.18em] uppercase text-text-muted mt-1">Anniversaries</p>
                </div>
                <div className="rounded-2xl border border-border bg-input p-3 text-center">
                  <Droplet className="w-5 h-5 text-accent mx-auto" />
                  <p className="text-xl sm:text-2xl font-extrabold text-text mt-1 leading-none">{cycleDay ?? '—'}</p>
                  <p className="text-[10px] tracking-[0.18em] uppercase text-text-muted mt-1">Cycle Day</p>
                </div>
              </div>

              {/* Quick actions */}
              <div className="grid grid-cols-2 gap-2.5">
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate('/milestones')} className="flex items-center gap-3 p-4 rounded-2xl border border-accent/25 bg-accent-light text-left hover:brightness-105 transition">
                  <Plus className="w-5 h-5 text-accent flex-shrink-0" />
                  <span className="text-body-sm font-semibold text-text leading-tight">Add a<br />memory</span>
                </motion.button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate('/')} className="flex items-center gap-3 p-4 rounded-2xl border border-border bg-input text-left hover:bg-surface-subtle transition">
                  <CalendarDays className="w-5 h-5 text-secondary flex-shrink-0" />
                  <span className="text-body-sm font-semibold text-text leading-tight">Open shared<br />calendar</span>
                </motion.button>
              </div>

              {/* Unpair — de-emphasized, at the bottom */}
              <button onClick={handleUnpair} className="w-full flex items-center justify-center gap-2 py-3 text-caption text-text-muted hover:text-error transition-colors">
                <Unlink className="w-4 h-4" />
                Unpair Devices
              </button>
            </div>
          ) : (
            <MotionGlassCard className="p-6 sm:p-8" elevated>
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 22 }}
                  className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center mx-auto"
                  style={{ background: 'conic-gradient(from 210deg, var(--color-accent), var(--color-secondary), var(--color-accent))', boxShadow: '0 10px 32px -10px var(--color-accent-glow)' }}
                >
                  <div className="w-[calc(100%-6px)] h-[calc(100%-6px)] rounded-full bg-surface flex items-center justify-center">
                    <Users className="w-9 h-9 sm:w-10 sm:h-10 text-accent" />
                  </div>
                </motion.div>

                <h2 className="mt-5 text-h2 font-bold text-text">Not Paired Yet</h2>
                <p className="mt-2 text-body-sm text-text-secondary leading-snug max-w-[280px] mx-auto">
                  Connect with your partner to share periods, milestones, and anniversaries — privately, on your phones.
                </p>
              </div>

              <div className="mt-7 grid grid-cols-1 gap-3">
                <Button variant="primary" onClick={handleGenerate} className="w-full min-h-14" size="lg">
                  <Heart className="w-5 h-5 mr-2" fill="currentColor" />
                  Generate My Code
                </Button>
                <Button variant="secondary" onClick={handleEnter} className="w-full min-h-14" size="lg">
                  <LinkIcon className="w-5 h-5 mr-2" />
                  Enter Partner's Code
                </Button>
              </div>
              <p className="mt-4 text-center text-caption text-text-muted normal-case">
                6-digit code · expires in 24 hours
              </p>
            </MotionGlassCard>
          )}
        </motion.div>
        )}

        {/* ─── Section 2 · How Pairing Works ─── */}
        {activeTab === 'steps' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <MotionGlassCard className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-11 h-11 rounded-xl bg-accent-light flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-accent" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold text-text leading-tight">How Pairing Works</h3>
                  <p className="text-caption text-text-muted normal-case">Up and running in a minute</p>
                </div>
              </div>
            </div>

            <ol className="relative">
              {/* Connector line through the icon column */}
              <span aria-hidden className="absolute left-[21px] top-4 bottom-4 w-px bg-border" />

              {STEPS.map((step, index) => (
                <li key={step.title} className={cn('relative flex items-start gap-4', index < STEPS.length - 1 && 'pb-5')}>
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: index * 0.08, type: 'spring', stiffness: 300, damping: 22 }}
                    className="relative z-10 w-11 h-11 rounded-2xl bg-accent-light ring-4 ring-surface flex items-center justify-center flex-shrink-0"
                  >
                    <step.icon className="w-5 h-5 text-accent" />
                  </motion.span>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-accent-strong">
                      Step {index + 1}
                    </p>
                    <p className="font-semibold text-text leading-snug mt-0.5">{step.title}</p>
                    <p className="text-body-sm text-text-secondary leading-snug mt-0.5">{step.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </MotionGlassCard>
        </motion.div>
        )}

        {/* ─── Section 3 · Privacy First ─── */}
        {activeTab === 'privacy' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
        >
          <MotionGlassCard className="p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <span className="w-11 h-11 rounded-xl bg-secondary-light flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-5 h-5 text-secondary" />
              </span>
              <div className="min-w-0">
                <h3 className="font-semibold text-text">Privacy First</h3>
                <p className="mt-1 text-body-sm text-text-secondary leading-relaxed">
                  Everything stays on your devices. Pairing creates a direct, encrypted link between the two phones — the moment it's gone, the data stops flowing.{' '}
                  <span className="text-text font-medium">No cloud, no middlemen.</span>
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    { icon: Lock, label: 'End-to-end private' },
                    { icon: CloudOff, label: 'No cloud storage' },
                    { icon: EyeOff, label: 'No trackers' },
                  ].map(chip => (
                    <span
                      key={chip.label}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-input px-3 py-1.5 text-caption text-text-secondary"
                    >
                      <chip.icon className="w-3.5 h-3.5 text-secondary" />
                      {chip.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </MotionGlassCard>
        </motion.div>
        )}

        {/* ─── Section 4 · Your Device ─── */}
        {activeTab === 'device' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
        >
          <MotionGlassCard className="p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="w-11 h-11 rounded-xl bg-accent-light flex items-center justify-center flex-shrink-0">
                <Smartphone className="w-5 h-5 text-accent" />
              </span>
              <div className="min-w-0">
                <h3 className="font-semibold text-text leading-tight">Your Device</h3>
                <p className="text-caption text-text-muted normal-case">This phone, on this connection</p>
              </div>
            </div>

            <dl className="mt-4 divide-y divide-border border-t border-b border-border">
              <div className="grid grid-cols-[6.5rem_1fr] sm:grid-cols-[8.5rem_1fr] items-baseline gap-x-4 gap-y-1 py-4">
                <dt className="text-caption text-text-muted uppercase tracking-[0.14em] font-semibold">Role</dt>
                <dd className="text-right font-semibold text-text">
                  <span className="mr-1">{roleEmoji}</span>{roleLabel}
                </dd>
              </div>
              <div className="grid grid-cols-[6.5rem_1fr] sm:grid-cols-[8.5rem_1fr] items-baseline gap-x-4 gap-y-1 py-4">
                <dt className="text-caption text-text-muted uppercase tracking-[0.14em] font-semibold">Device ID</dt>
                <dd className="text-right font-mono text-[11px] sm:text-[13px] leading-snug text-text-secondary break-all">
                  {deviceId || 'Not available'}
                </dd>
              </div>
              <div className="grid grid-cols-[6.5rem_1fr] sm:grid-cols-[8.5rem_1fr] items-baseline gap-x-4 gap-y-1 py-4">
                <dt className="text-caption text-text-muted uppercase tracking-[0.14em] font-semibold">Device Name</dt>
                <dd className="text-right font-semibold text-text break-words">
                  {profile?.name || 'Not set'}
                </dd>
              </div>
            </dl>
          </MotionGlassCard>
        </motion.div>
        )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Pairing Modal */}
      <PairingModal
        isOpen={showModal !== null}
        onClose={() => setShowModal(null)}
        initialStep={showModal === 'enter' ? 'enter' : 'generate'}
      />
    </div>
  );
};
