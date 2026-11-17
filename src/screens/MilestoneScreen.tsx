import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { ChevronLeft, Sparkles, Award, Search, Filter, X } from 'lucide-react';
import { cn, dateKey, formatDateKeyFull, diffDays } from '@/utils/helpers';
import { GlassView, Button, GlassCard, MotionGlassCard } from '@/components/ui/GlassComponents';
import { ScrollShrink } from '@/components/ui/ScrollShrink';
import { DatePickerField } from '@/components/ui/CalendarPicker';
import { SwipeableMilestoneCard } from '@/components/ui/CustomModals';
import { AnniversaryCard, MilestoneModal, AnniversaryModal } from '@/components/milestone/MilestoneComponents';
import { useUserStore } from '@/stores';
import { useDeletionStore } from '@/stores';
import { useMilestoneStore, MilestoneFilters, MilestoneDateType, MilestoneTiming } from '@/stores/milestoneStore';
import { useAnniversaryStore } from '@/stores';
import { Milestone, Anniversary, UserRole } from '@/types';
import { useCustomModals } from '@/components/ui/CustomModals';

const DATE_TYPE_OPTIONS: Array<{ value: MilestoneDateType; label: string }> = [
  { value: 'milestone', label: 'Memory Date' },
  { value: 'created', label: 'Date Added' },
];

const TIMING_OPTIONS: Array<{ value: MilestoneTiming; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
];

interface FilterDraft {
  dateType: MilestoneDateType;
  from: string | null;
  to: string | null;
  timing: MilestoneTiming;
}

const isDefaultFilter = (f: MilestoneFilters) =>
  !f.search && !f.from && !f.to && f.timing === 'all';

export const MilestoneScreen: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useUserStore();
  const {
    items: milestones,
    filters,
    total,
    hasMore,
    loading,
    loadingMore,
    loadAll,
    loadMore,
    setFilters,
    clearFilters,
    add,
    update,
    remove,
  } = useMilestoneStore();
  const { items: anniversaries, primary, loadAll: loadAnniversaries, add: addAnniversary, update: updateAnniversary, remove: removeAnniversary } = useAnniversaryStore();
  const { showConfirm } = useCustomModals();
  const { ghostMilestones, dismissGhostMilestone } = useDeletionStore();
  const { ghostAnniversaries, dismissGhostAnniversary } = useDeletionStore();

  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [showAnniversaryModal, setShowAnniversaryModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [editingAnniversary, setEditingAnniversary] = useState<Anniversary | null>(null);
  const [searchInput, setSearchInput] = useState(filters.search);
  const [draft, setDraft] = useState<FilterDraft>({ dateType: filters.dateType, from: filters.from, to: filters.to, timing: filters.timing });
  const [deletingIds, setDeletingIds] = useState<Set<string>>(() => new Set());
  const [deletingAnnIds, setDeletingAnnIds] = useState<Set<string>>(() => new Set());
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset page state whenever milestones change
  useEffect(() => {
    loadAll();
    loadAnniversaries();
  }, [loadAll, loadAnniversaries]);

  // Rows the partner deletes are already gone from the DB; keep them on
  // screen as ghosts so they dissolve with the same exit animation a local
  // delete gets, then drop them.
  useEffect(() => {
    if (ghostMilestones.length === 0) return;
    const ids = ghostMilestones.map(m => m.id);
    setDeletingIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      return next;
    });
    const timer = window.setTimeout(() => {
      ids.forEach(dismissGhostMilestone);
      setDeletingIds(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
    }, 1250);
    return () => window.clearTimeout(timer);
  }, [ghostMilestones, dismissGhostMilestone]);

  useEffect(() => {
    if (ghostAnniversaries.length === 0) return;
    const ids = ghostAnniversaries.map(a => a.id);
    setDeletingAnnIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      return next;
    });
    const timer = window.setTimeout(() => {
      ids.forEach(dismissGhostAnniversary);
      setDeletingAnnIds(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
    }, 1250);
    return () => window.clearTimeout(timer);
  }, [ghostAnniversaries, dismissGhostAnniversary]);

  // Ghosts take over rendering for anything the partner just removed
  const visibleMilestones = useMemo(() => {
    if (ghostMilestones.length === 0) return milestones;
    const ghostIds = new Set(ghostMilestones.map(g => g.id));
    return [...milestones.filter(m => !ghostIds.has(m.id)), ...ghostMilestones];
  }, [milestones, ghostMilestones]);

  const visibleAnniversaries = useMemo(() => {
    if (ghostAnniversaries.length === 0) return anniversaries;
    const ghostIds = new Set(ghostAnniversaries.map(g => g.id));
    return [...anniversaries.filter(a => !ghostIds.has(a.id)), ...ghostAnniversaries];
  }, [anniversaries, ghostAnniversaries]);

  const visiblePrimary = primary ?? ghostAnniversaries.find(a => a.isPrimary) ?? null;

  // Share deep link: ?share=<id> opens the edit modal for that milestone
  useEffect(() => {
    const shareId = searchParams.get('share');
    if (shareId) {
      const milestone = milestones.find(m => m.id === shareId);
      if (milestone) {
        setEditingMilestone(milestone);
        setShowMilestoneModal(true);
      }
    }
  }, [searchParams, milestones]);

  // Debounce the search box so we don't fire a query per keystroke; the query
  // itself runs against both title and note.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchInput !== filters.search) setFilters({ search: searchInput });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, filters.search, setFilters]);

  // Infinite scroll: when the sentinel comes into view, fetch the next page.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: '280px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, hasMore, milestones.length]);

  const openFilterModal = () => {
    setDraft({ dateType: filters.dateType, from: filters.from, to: filters.to, timing: filters.timing });
    setShowFilterModal(true);
  };

  const applyDraft = (d: FilterDraft) => {
    setFilters({ dateType: d.dateType, from: d.from, to: d.to, timing: d.timing });
    setShowFilterModal(false);
  };

  const handleAddMilestone = (milestone: Omit<Milestone, 'id' | 'synced' | 'createdAt' | 'updatedAt'>) => {
    if (editingMilestone) {
      update(editingMilestone.id, milestone);
    } else {
      add(milestone);
    }
    setShowMilestoneModal(false);
    setEditingMilestone(null);
  };

  const handleAddAnniversary = (anniversary: Omit<Anniversary, 'id' | 'createdAt'>) => {
    if (editingAnniversary) {
      updateAnniversary(editingAnniversary.id, anniversary);
    } else {
      addAnniversary(anniversary);
    }
    setShowAnniversaryModal(false);
    setEditingAnniversary(null);
  };

  const handleDeleteMilestone = (id: string) => {
    const milestone = milestones.find(m => m.id === id);
    showConfirm({
      title: 'Delete Milestone?',
      message: `Delete "${milestone?.title || 'this milestone'}"? This cannot be undone.`,
      type: 'danger',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: () => {
        // Play the dissolve, then remove from the store (newest first list refreshes)
        setDeletingIds(prev => new Set(prev).add(id));
        window.setTimeout(() => {
          remove(id);
        }, 1150);
      },
    });
  };

  const handleDeleteAnniversary = (id: string) => {
    const anniversary = anniversaries.find(a => a.id === id);
    showConfirm({
      title: 'Delete Anniversary?',
      message: `Delete "${anniversary?.label || 'this anniversary'}"? This cannot be undone.`,
      type: 'danger',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: () => {
        setDeletingAnnIds(prev => new Set(prev).add(id));
        window.setTimeout(() => {
          removeAnniversary(id);
        }, 1150);
      },
    });
  };

  const anyFilterActive = !isDefaultFilter(filters);
  const activeFilterCount =
    (filters.search ? 1 : 0) + (filters.from || filters.to ? 1 : 0) + (filters.timing !== 'all' ? 1 : 0);

  const milestoneSkeletons = Array.from({ length: 4 }, (_, i) => (
    <GlassCard key={`skel-${i}`} className="p-4">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-2xl bg-input animate-pulse flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-2/3 bg-input rounded animate-pulse" />
          <div className="h-4 w-1/3 bg-input rounded animate-pulse" />
          <div className="h-3 w-1/2 bg-input rounded animate-pulse" />
        </div>
      </div>
    </GlassCard>
  ));

  const filterModal = (
    <AnimatePresence>
      {showFilterModal && (
        <motion.div
          key="filter-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4"
          onClick={() => setShowFilterModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 90, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 60, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24, mass: 0.9 }}
            className="w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <GlassView className="modal-surface rounded-3xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-border">
            <h2 className="text-h3 font-bold text-text flex items-center gap-2">
              <Filter className="w-5 h-5 text-accent" />
              Filter Memories
            </h2>
            <button
              onClick={() => setShowFilterModal(false)}
              className="p-1.5 rounded-lg text-text-muted hover:bg-surface-subtle transition-colors"
              aria-label="Close filters"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 sm:p-5 space-y-5 max-h-[72dvh] overflow-y-auto overscroll-contain">
            {/* Which date to filter by */}
            <div>
              <label className="block text-caption font-medium text-text-secondary mb-2">Filter by</label>
              <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-input border border-border">
                {DATE_TYPE_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setDraft(d => ({ ...d, dateType: option.value }))}
                    className={cn(
                      'relative px-4 py-2.5 rounded-xl text-body-sm font-semibold transition-colors',
                      draft.dateType === option.value ? 'text-on-accent' : 'text-text-secondary hover:text-text'
                    )}
                    style={
                      draft.dateType === option.value
                        ? { background: 'linear-gradient(135deg, var(--color-accent), var(--color-secondary))' }
                        : undefined
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-3">
              <DatePickerField
                label="From"
                value={draft.from}
                onChange={date => setDraft(d => ({ ...d, from: date }))}
                max={draft.to ?? undefined}
              />
              <DatePickerField
                label="To"
                value={draft.to}
                onChange={date => setDraft(d => ({ ...d, to: date }))}
                min={draft.from ?? undefined}
              />
            </div>

            {/* Quick presets */}
            <div>
              <label className="block text-caption font-medium text-text-secondary mb-2">Quick range</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'All time', from: null as string | null, to: null as string | null },
                  { label: 'Last 7 days', from: dateKey(new Date(Date.now() - 6 * 86400000)), to: dateKey() },
                  { label: 'Last 30 days', from: dateKey(new Date(Date.now() - 29 * 86400000)), to: dateKey() },
                  { label: 'Last year', from: dateKey(new Date(Date.now() - 364 * 86400000)), to: dateKey() },
                ].map(preset => {
                  const active = draft.from === preset.from && draft.to === preset.to;
                  return (
                    <button
                      key={preset.label}
                      onClick={() => setDraft(d => ({ ...d, from: preset.from, to: preset.to }))}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-caption font-medium border transition-all',
                        active
                          ? 'bg-accent-light text-accent border-accent'
                          : 'bg-transparent text-text-secondary border-border hover:border-accent hover:text-accent'
                      )}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-caption font-medium text-text-secondary mb-2">Show</label>
              <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl bg-input border border-border">
                {TIMING_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setDraft(d => ({ ...d, timing: option.value }))}
                    className={cn(
                      'px-3 py-2.5 rounded-xl text-body-sm font-semibold transition-colors',
                      draft.timing === option.value ? 'text-on-accent' : 'text-text-secondary hover:text-text'
                    )}
                    style={
                      draft.timing === option.value
                        ? { background: 'linear-gradient(135deg, var(--color-accent), var(--color-secondary))' }
                        : undefined
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-4 py-4 border-t border-border">
            <button
              onClick={() => {
                setDraft({ dateType: 'milestone', from: null, to: null, timing: 'all' });
                clearFilters();
                setShowFilterModal(false);
              }}
              className="px-4 py-2.5 rounded-xl text-body-sm font-medium text-text-muted hover:bg-surface-subtle transition-colors"
            >
              Clear all
            </button>
            <button
              onClick={() => applyDraft(draft)}
              className="px-6 py-2.5 rounded-xl text-body-sm font-semibold text-on-accent transition-transform active:scale-95"
              style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-secondary))' }}
            >
              Apply Filters
            </button>
          </div>
        </GlassView>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="min-h-screen bg-bg pb-32 safe-bottom">
      {/* Status Bar */}
      <div className="fixed top-0 left-0 right-0 z-40 h-[env(safe-area-inset-top)] bg-bg/80 backdrop-blur-sm" />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="fixed top-0 left-0 right-0 z-40 px-4 pt-[env(safe-area-inset-top)] pb-4 safe-top bg-bg/85 backdrop-blur-sm border-b border-border/60"
      >
        <div className="app-header-inner flex items-center justify-between">
          <Link to="/" className="p-2 rounded-xl hover:bg-surface-subtle transition-colors" aria-label="Back to home">
            <ChevronLeft className="w-5 h-5 text-text-secondary" />
          </Link>
          <h1 className="text-h3 font-bold text-text">Milestones</h1>
          <button
            onClick={openFilterModal}
            aria-label="Open filters"
            className="p-2 rounded-xl hover:bg-surface-subtle transition-colors text-text-secondary"
          >
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="app-content pt-24 pb-4 px-4 space-y-6">
        {/* Search & Filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-3"
        >
          <MotionGlassCard className="flex-1 min-w-0 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search title or note..."
              className="w-full pl-10 pr-9 py-3 rounded-xl bg-input border border-border text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            />
            {searchInput.length > 0 && (
              <button
                onClick={() => setSearchInput('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-subtle transition-colors"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </MotionGlassCard>
          <button
            onClick={openFilterModal}
            className="relative p-3 rounded-2xl bg-input border border-border text-text-secondary transition-all hover:bg-surface-subtle hover:text-text"
            aria-label="Open filters"
          >
            <Filter className="w-5 h-5" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-accent text-[10px] font-extrabold text-on-accent flex items-center justify-center shadow-[0_2px_6px_var(--color-accent-glow)]">
                {activeFilterCount}
              </span>
            )}
          </button>
        </motion.div>

        {/* Active filter chips */}
        {anyFilterActive && (
          <div className="flex flex-wrap items-center gap-2 -mt-2">
            {filters.search && (
              <button onClick={() => setFilters({ search: '' })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-caption font-medium bg-accent-light text-accent">
                “{filters.search}” <X className="w-3.5 h-3.5" />
              </button>
            )}
            {(filters.from || filters.to) && (
              <button onClick={() => setFilters({ from: null, to: null })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-caption font-medium bg-secondary-light text-secondary">
                {filters.from ?? '…'} → {filters.to ?? '…'} <X className="w-3.5 h-3.5" />
              </button>
            )}
            {filters.timing !== 'all' && (
              <button onClick={() => setFilters({ timing: 'all' })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-caption font-medium bg-input border border-border text-text-secondary">
                {filters.timing === 'upcoming' ? 'Upcoming' : 'Past'} <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={clearFilters} className="text-caption font-medium text-text-muted underline underline-offset-2 hover:text-text">
              Clear all
            </button>
          </div>
        )}

        {/* Add Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3"
        >
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => { setEditingMilestone(null); setShowMilestoneModal(true); }}
            className="p-4 rounded-xl bg-input border border-border hover:bg-surface-subtle transition-all text-left"
          >
            <div className="flex items-center gap-3">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ scale: { type: 'spring', stiffness: 300, damping: 20 }, delay: 0.05 }}
                className="w-10 h-10 rounded-xl bg-accent-light flex items-center justify-center"
              >
                <Sparkles className="w-5 h-5 text-accent" />
              </motion.div>
              <div>
                <p className="font-medium text-text">Add Milestone</p>
                <p className="text-caption text-text-muted normal-case">Memory or event</p>
              </div>
            </div>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => { setEditingAnniversary(null); setShowAnniversaryModal(true); }}
            className="p-4 rounded-xl bg-input border border-border hover:bg-surface-subtle transition-all text-left"
          >
            <div className="flex items-center gap-3">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ scale: { type: 'spring', stiffness: 300, damping: 20 }, delay: 0.1 }}
                className="w-10 h-10 rounded-xl bg-secondary-light flex items-center justify-center"
              >
                <Award className="w-5 h-5 text-secondary" />
              </motion.div>
              <div>
                <p className="font-medium text-text">Add Anniversary</p>
                <p className="text-caption text-text-muted normal-case">Relationship date</p>
              </div>
            </div>
          </motion.button>
        </motion.div>

        {/* Primary Anniversary */}
        {visiblePrimary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <AnniversaryCard
              anniversary={visiblePrimary}
              currentUserRole={profile?.role || 'girl'}
              onEdit={a => { setEditingAnniversary(a); setShowAnniversaryModal(true); }}
              onDelete={handleDeleteAnniversary}
              destroying={deletingAnnIds.has(visiblePrimary.id)}
            />
          </motion.div>
        )}

        {/* Other Anniversaries */}
        {visibleAnniversaries.filter(a => a.id !== visiblePrimary?.id).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <h3 className="font-semibold text-text mb-3">Anniversaries</h3>
            <div className="space-y-4">
              {visibleAnniversaries
                .filter(a => a.id !== visiblePrimary?.id)
                .map((anniversary, index) => (
                  <AnniversaryCard
                    key={anniversary.id}
                    anniversary={anniversary}
                    currentUserRole={profile?.role || 'girl'}
                    onEdit={a => { setEditingAnniversary(a); setShowAnniversaryModal(true); }}
                    onDelete={handleDeleteAnniversary}
                    destroying={deletingAnnIds.has(anniversary.id)}
                  />
                ))}
            </div>
          </motion.div>
        )}

        {/* Milestones (sorted: newest created first, infinite scroll) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-text">
              Milestones{total !== null ? ` (${total})` : ''}
            </h3>
            <span className="text-caption text-text-muted">Newest first</span>
          </div>

          {loading && visibleMilestones.length === 0 ? (
            <div className="space-y-3">{milestoneSkeletons}</div>
          ) : visibleMilestones.length === 0 ? (
            <MotionGlassCard className="p-8 text-center">
              <Sparkles className="w-12 h-12 text-text-muted mx-auto mb-4" />
              <p className="text-text-secondary font-medium">
                {anyFilterActive ? 'No memories match your filters' : 'No milestones yet'}
              </p>
              <p className="text-caption text-text-muted mt-1 normal-case">
                {anyFilterActive ? 'Try widening the date range or clearing the search' : 'Add your first memory together'}
              </p>
              {anyFilterActive && (
                <button
                  onClick={clearFilters}
                  className="mt-4 px-5 py-2.5 rounded-xl text-body-sm font-semibold bg-accent-light text-accent hover:brightness-105 transition-all"
                >
                  Clear filters
                </button>
              )}
            </MotionGlassCard>
          ) : (
            <>
              <div className="space-y-3">
                {visibleMilestones.map((milestone, index) => (
                  <ScrollShrink key={milestone.id} index={index}>
                    <SwipeableMilestoneCard
                      milestone={milestone}
                      currentUserRole={profile?.role || 'girl'}
                      onEdit={m => { setEditingMilestone(m); setShowMilestoneModal(true); }}
                      onDelete={handleDeleteMilestone}
                      onShare={m => navigate(`/milestones?share=${m.id}`)}
                      destroying={deletingIds.has(milestone.id)}
                      index={index}
                    />
                  </ScrollShrink>
                ))}
              </div>

              {/* Infinite scroll sentinel */}
              {hasMore && (
                <div ref={sentinelRef} className="pt-4 flex flex-col items-center gap-3">
                  {loadingMore ? (
                    <div className="w-full space-y-3">
                      {milestoneSkeletons.slice(0, 2)}
                    </div>
                  ) : (
                    <>
                      <motion.div
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.4, repeat: Infinity }}
                        className="h-2 w-40 rounded-full bg-gradient-to-r from-accent via-secondary to-accent"
                      />
                      <span className="text-caption text-text-muted normal-case">Loading more memories…</span>
                    </>
                  )}
                </div>
              )}
              {!hasMore && itemsEndCaption(visibleMilestones.length)}
            </>
          )}
        </motion.div>
      </div>

      {/* Filter Modal */}
      {createPortal(filterModal, document.body)}

      {/* Modals */}
      <MilestoneModal
        isOpen={showMilestoneModal}
        onClose={() => { setShowMilestoneModal(false); setEditingMilestone(null); }}
        milestone={editingMilestone || undefined}
        onSave={handleAddMilestone}
        onDelete={handleDeleteMilestone}
        currentUserRole={profile?.role || 'girl'}
      />

      <AnniversaryModal
        isOpen={showAnniversaryModal}
        onClose={() => { setShowAnniversaryModal(false); setEditingAnniversary(null); }}
        anniversary={editingAnniversary || undefined}
        onSave={handleAddAnniversary}
        onDelete={handleDeleteAnniversary}
      />

    </div>
  );
};

const itemsEndCaption = (count: number) =>
  count > 0 && (
    <div className="pt-6 flex items-center justify-center gap-1.5 text-caption text-text-muted normal-case tracking-wide">
      <span>Made with love 💕</span>
      <span className="uppercase font-semibold text-text-secondary">BY SMK</span>
    </div>
  );
