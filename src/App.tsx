import React, { useEffect, useRef, useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { syncCoupleData, sendHeartbeat, getPartnerStatus, partnerDeviceIdOf } from '@/lib/sync';
import { checkDueReminders, checkDueNotices, requestNotificationPermission, syncScheduledReminders } from '@/lib/reminders';
import { onLocalMutation, ensureReminderChannel } from '@/lib/tauri';
import { useUserStore } from '@/stores';
import { usePresenceStore } from '@/stores';
import { useUpdaterStore } from '@/stores';
import { useDeletionStore } from '@/stores';
import { usePeriodStore } from '@/stores';
import { useMilestoneStore } from '@/stores';
import { useNoticeStore } from '@/stores';
import { useAnniversaryStore } from '@/stores';
import { usePairingStore } from '@/stores';
import { HomeScreen } from '@/screens/HomeScreen';
import { MilestoneScreen } from '@/screens/MilestoneScreen';
import { NoticeboardScreen } from '@/screens/NoticeboardScreen';
import { PairingScreen } from '@/screens/PairingScreen';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { CustomModalProvider, useToast } from '@/components/ui/CustomModals';
import { PageTransition } from '@/components/ui/PageTransition';
import { AppTabBar } from '@/components/ui/AppTabBar';
import { UpdateModal } from '@/components/ui/UpdateModal';
import { DynamicIsland } from '@/components/ui/DynamicIsland';

/* Tab order decides whether the next page slides in from the right or the left. */
const ROUTE_ORDER = ['/', '/milestones', '/notices', '/pairing'];

function AppContent() {
  const { profile, initialized, initialize } = useUserStore();
  const loadPeriod = usePeriodStore(state => state.loadEntries);
  const loadMilestones = useMilestoneStore(state => state.loadAll);
  const loadNotices = useNoticeStore(state => state.loadAll);
  const loadUpcoming = useMilestoneStore(state => state.loadUpcoming);
  const loadAnniversaries = useAnniversaryStore(state => state.loadAll);
  const notificationSettings = useUserStore(state => state.notificationSettings);
  const milestoneItems = useMilestoneStore(state => state.items);
  const noticeItems = useNoticeStore(state => state.items);
  const anniversaryItems = useAnniversaryStore(state => state.items);
  const predictions = usePeriodStore(state => state.predictions);
  const loadPair = usePairingStore(state => state.loadPair);
  const pair = usePairingStore(state => state.pair);
  const { showToast } = useToast();
  const pairTransitionShown = useRef(false);
  const wasPaired = useRef<boolean | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const location = useLocation();
  const previousPath = useRef(location.pathname);
  const direction = useRef(1);

  if (previousPath.current !== location.pathname) {
    const from = ROUTE_ORDER.indexOf(previousPath.current);
    const to = ROUTE_ORDER.indexOf(location.pathname);
    direction.current = to === -1 || from === -1 ? 1 : to >= from ? 1 : -1;
    previousPath.current = location.pathname;
  }

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (initialized && profile) {
      loadPeriod();
      loadMilestones();
      loadNotices();
      loadUpcoming();
      loadAnniversaries();
      loadPair();
    }
  }, [initialized, profile, loadPeriod, loadMilestones, loadNotices, loadUpcoming, loadAnniversaries, loadPair]);

  // Auto-check for an app update once the app is ready (native builds only)
  const autoCheckForUpdates = useUpdaterStore(state => state.autoCheck);
  const autoCheckedForUpdates = useRef(false);
  useEffect(() => {
    if (!initialized || autoCheckedForUpdates.current) return;
    autoCheckedForUpdates.current = true;
    const timer = window.setTimeout(() => {
      void autoCheckForUpdates();
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [initialized, autoCheckForUpdates]);

  // Pair watcher: poll while unpaired so both devices flip together.
  // An instant SSE push from the dev-server registry does the same thing
  // in ~250ms; the poll is the fallback for native / static builds.
  useEffect(() => {
    if (pair) return;
    const t = window.setInterval(() => {
      loadPair();
    }, 2500);
    return () => window.clearInterval(t);
  }, [pair, loadPair]);

  // Instant pair push: the dev server broadcasts on every registry change
  useEffect(() => {
    if (pair) return;
    // The SSE registry only exists on the dev server — skip it on native
    if (isTauri()) return;
    let source: EventSource | null = null;
    let consecutiveErrors = 0;
    try {
      source = new EventSource('/api/pairing/events');
      source.addEventListener('pair-update', () => loadPair());
      source.onerror = () => {
        consecutiveErrors += 1;
        if (consecutiveErrors >= 5) {
          source?.close();
          source = null;
        }
      };
    } catch {
      source = null;
    }
    return () => {
      source?.close();
      source = null;
    };
  }, [pair, loadPair]);

  // While paired: heartbeat the registry so the partner sees us online,
  // pull/push shared rows, and mirror the partner's presence.
  useEffect(() => {
    if (!pair || !profile) return;

    const partnerId = partnerDeviceIdOf(pair, profile.deviceId);
    const setPartnerOnline = usePresenceStore.getState().setPartnerOnline;
    const setSelfOnline = usePresenceStore.getState().setSelfOnline;
    const myDeviceId = profile.deviceId;

    let stopped = false;
    let syncing = false;

    const reloadAll = () => {
      loadMilestones();
      loadNotices();
      loadUpcoming();
      loadAnniversaries();
      loadPeriod();
    };

    const runSync = async () => {
      if (syncing) return;
      syncing = true;
      try {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          setSelfOnline(false);
          return;
        }
        setSelfOnline(true);
        await sendHeartbeat(myDeviceId, profile?.name);
        const outcome = await syncCoupleData();
        if (stopped) return;
        if (outcome.status === 'ok') {
          if (outcome.removed.milestones.length) {
            useDeletionStore.getState().addGhostMilestones(outcome.removed.milestones);
          }
          if (outcome.removed.anniversaries.length) {
            useDeletionStore.getState().addGhostAnniversaries(outcome.removed.anniversaries);
          }
          if (outcome.changed) {
            reloadAll();
          }
        }
        const status = await getPartnerStatus(partnerId);
        if (!stopped) setPartnerOnline(status.online, status.name);
      } finally {
        syncing = false;
      }
    };

    runSync();
    const interval = window.setInterval(runSync, 5000);

    // Instant refresh when the other device pushes a change (dev server only)
    const source = isTauri() ? null : new EventSource('/api/pairing/events');
    source?.addEventListener('sync-update', () => {
      if (!stopped) void runSync();
    });

    // Instant push when this device writes something (create / update / delete)
    let debounce: number | undefined;
    const unsubscribe = onLocalMutation(() => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(() => {
        if (!stopped) void runSync();
      }, 250);
    });

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void runSync();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stopped = true;
      window.clearInterval(interval);
      window.clearTimeout(debounce);
      unsubscribe();
      source?.close();
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair, profile]);

  // Reminder engine: fire any due reminders on load / after data changes and every 15 min;
  // on native also rebuild the OS schedule.
  const reminderPass = useRef(0);
  useEffect(() => {
    if (!initialized) return;
    const id = ++reminderPass.current;
    const timer = window.setTimeout(() => {
      if (id !== reminderPass.current) return;
      void syncScheduledReminders();
      void checkDueReminders();
      void checkDueNotices();
    }, 1200);
    const interval = window.setInterval(() => {
      void checkDueReminders();
    }, 15 * 60 * 1000);
    // Partner notices need a tighter cadence than the 15-minute reminder pass
    const noticeInterval = window.setInterval(() => {
      void checkDueNotices();
    }, 30 * 1000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
      window.clearInterval(noticeInterval);
    };
  }, [initialized, notificationSettings, milestoneItems, noticeItems, anniversaryItems, predictions]);

  // Android 13+ silently drops every notification until POST_NOTIFICATIONS is
  // granted, and reminders are ON by default. Ask once the app is usable rather
  // than waiting for the user to find the toggle in Settings.
  const notificationAsked = useRef(false);
  useEffect(() => {
    if (!initialized || !profile || !isTauri()) return;
    if (notificationAsked.current) return;
    const timer = window.setTimeout(async () => {
      // Mark inside the timer: if this effect is torn down before it fires
      // (profile settling), the next run still gets to ask.
      if (notificationAsked.current) return;
      notificationAsked.current = true;
      try {
        await ensureReminderChannel();
        const granted = await requestNotificationPermission();
        if (!granted) {
          showToast('Allow notifications in Settings so reminders can reach you', 'error');
        }
      } catch (error) {
        console.warn('Notification permission request failed:', error);
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [initialized, profile, showToast]);

  // Fire the success toast on the transition from unpaired → paired
  useEffect(() => {
    if (!initialized || !profile) return;
    const nowPaired = Boolean(pair);

    if (wasPaired.current === null) {
      // First observation of this session — record the baseline silently
      wasPaired.current = nowPaired;
      return;
    }

    if (!wasPaired.current && nowPaired && !pairTransitionShown.current) {
      pairTransitionShown.current = true;
      showToast('Devices paired 💕', 'success');
    }
    wasPaired.current = nowPaired;
  }, [pair, initialized, profile, showToast]);

  useEffect(() => {
    if (initialized && !profile) {
      setShowOnboarding(true);
    }
  }, [initialized, profile]);

  const handleOnboardingComplete = (role: 'boy' | 'girl', name: string) => {
    useUserStore.getState().setRole(role, name);
    setShowOnboarding(false);
  };

  if (!initialized) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-bg">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-secondary flex items-center justify-center mx-auto mb-4 animate-pulse-soft">
            <svg className="w-8 h-8 text-on-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <p className="text-text-muted">Loading MeMo 💕...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Both the exiting and the entering page stay mounted during the transition:
          AnimatePresence tracks PageTransition (a motion element), not Routes. */}
      <AnimatePresence mode="popLayout" initial={false}>
        <PageTransition key={location.pathname} direction={direction.current}>
          <Routes location={location}>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/milestones" element={<MilestoneScreen />} />
            <Route path="/notices" element={<NoticeboardScreen />} />
            <Route path="/pairing" element={<PairingScreen />} />
            <Route path="/onboarding" element={<OnboardingScreen onComplete={handleOnboardingComplete} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </PageTransition>
      </AnimatePresence>

      {/* The dock lives outside the transitioning pages, so it never jumps */}
      {profile && <AppTabBar />}

      {/* Global Modals */}
      {showOnboarding && (
        <OnboardingScreen onComplete={handleOnboardingComplete} />
      )}

      {/* In-app update modal (native builds only) */}
      <UpdateModal />

      {/* Dynamic Island — reminders & Shoon speaking */}
      <DynamicIsland />
    </>
  );
}

export default function App() {
  return (
    <CustomModalProvider>
      <div className="min-h-screen bg-bg">
        <AppContent />
      </div>
    </CustomModalProvider>
  );
}