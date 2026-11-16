import React, { useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { useUserStore } from '@/stores';
import { usePeriodStore } from '@/stores';
import { useMilestoneStore } from '@/stores';
import { useAnniversaryStore } from '@/stores';
import { usePairingStore } from '@/stores';
import { HomeScreen } from '@/screens/HomeScreen';
import { MilestoneScreen } from '@/screens/MilestoneScreen';
import { PairingScreen } from '@/screens/PairingScreen';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { CustomModalProvider } from '@/components/ui/CustomModals';
import { PageTransition } from '@/components/ui/PageTransition';
import { AppTabBar } from '@/components/ui/AppTabBar';

/* Tab order decides whether the next page slides in from the right or the left. */
const ROUTE_ORDER = ['/', '/milestones', '/pairing'];

function AppContent() {
  const { profile, initialized, initialize } = useUserStore();
  const loadPeriod = usePeriodStore(state => state.loadEntries);
  const loadMilestones = useMilestoneStore(state => state.loadAll);
  const loadUpcoming = useMilestoneStore(state => state.loadUpcoming);
  const loadAnniversaries = useAnniversaryStore(state => state.loadAll);
  const loadPair = usePairingStore(state => state.loadPair);
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
      loadUpcoming();
      loadAnniversaries();
      loadPair();
    }
  }, [initialized, profile, loadPeriod, loadMilestones, loadUpcoming, loadAnniversaries, loadPair]);

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