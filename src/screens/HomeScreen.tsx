import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, Droplet, Sparkles, Settings, Users, ChevronRight, Heart } from 'lucide-react';
import { cn, dateKey, formatDateKey, getRelativeTime, diffDays, calculatePredictions, getCyclePhase, getPhaseColor, getPhaseLabel } from '@/utils/helpers';
import { GlassView, Button, GlassCard, MotionGlassCard } from '@/components/ui/GlassComponents';
import { PeriodCalendar } from '@/components/period/PeriodCalendar';
import { PeriodLogModal } from '@/components/period/PeriodLogModal';
import { AnniversaryHero, AnniversaryCard, MilestoneModal, AnniversaryModal } from '@/components/milestone/MilestoneComponents';
import { PresenceChip } from '@/components/ui/PresenceChip';
import { SettingsModal } from '@/components/settings/SettingsModal';
import { useUserStore } from '@/stores';
import { usePeriodStore } from '@/stores';
import { useMilestoneStore } from '@/stores';
import { useAnniversaryStore } from '@/stores';
import { usePairingStore } from '@/stores';
import { useCustomModals } from '@/components/ui/CustomModals';
import { PeriodEntry, PredictionResult, Milestone, Anniversary, UserRole } from '@/types';

export const HomeScreen: React.FC = () => {
  const navigate = useNavigate();
  const { profile, cycleSettings, appSettings } = useUserStore();
  const { entries, predictions, loading: periodLoading, getEntry, togglePeriodDay } = usePeriodStore();
  const { upcoming, items: allMilestones, loading: milestoneLoading, add: addMilestone, update: updateMilestone, remove: removeMilestone } = useMilestoneStore();
  const { primary, items: anniversaries, loading: anniversaryLoading, add: addAnniversary, update: updateAnniversary, remove: removeAnniversary } = useAnniversaryStore();
  const { pair, loading: pairLoading } = usePairingStore();
  const { showConfirm } = useCustomModals();

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [showAnniversaryModal, setShowAnniversaryModal] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [editingAnniversary, setEditingAnniversary] = useState<Anniversary | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const today = dateKey();
  const todayEntry = getEntry(today);
  const isPeriodToday = todayEntry?.isPeriodDay || false;

  const handleDateSelect = (date: string) => {
    // Every day is tappable: log or edit the period for that day, past or future.
    setSelectedDate(date);
    setShowPeriodModal(true);
  };

  const handleTogglePeriod = (entry: Omit<PeriodEntry, 'id' | 'synced' | 'createdAt' | 'updatedAt'>) => {
    togglePeriodDay(entry.date, entry.isPeriodDay, entry.flow, entry.symptoms, entry.notes);
    setShowPeriodModal(false);
  };

  const handleAddMilestone = (milestone: Omit<Milestone, 'id' | 'synced' | 'createdAt' | 'updatedAt'>) => {
    if (editingMilestone) {
      updateMilestone(editingMilestone.id, milestone);
    } else {
      addMilestone(milestone);
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
    const milestone = upcoming.find(m => m.id === id) ?? allMilestones.find(m => m.id === id);
    showConfirm({
      title: 'Delete Milestone?',
      message: `Delete "${milestone?.title || 'this milestone'}"? This cannot be undone.`,
      type: 'danger',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: () => removeMilestone(id),
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
      onConfirm: () => removeAnniversary(id),
    });
  };

  const cyclePhase = predictions ? getCyclePhase(predictions.cycleDay, cycleSettings.cycleLength) : 'period';
  const phaseColor = predictions ? getPhaseColor(cyclePhase, false) : '#D6336C';

  return (
    <div className="min-h-screen bg-bg">
      {/* Status Bar */}
      <div className="fixed top-0 left-0 right-0 z-40 h-[env(safe-area-inset-top)] bg-bg/80 backdrop-blur-sm" />
      <div aria-hidden className="header-fade header-fade-tall" />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed top-0 left-0 right-0 z-40 px-4 pt-[env(safe-area-inset-top)] pb-4 bg-bg/85 backdrop-blur-sm border-b border-border/60"
      >
        <div className="app-header-inner flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link to="/milestones" className="p-2 rounded-xl hover:bg-surface-subtle transition-colors flex-shrink-0">
              <Calendar className="w-5 h-5 text-text-secondary" />
            </Link>
            <img
              src="/memo-logo.png"
              alt="MeMo"
              draggable={false}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl object-cover ring-1 ring-white/10 flex-shrink-0 select-none pointer-events-none drop-shadow-[0_2px_14px_rgba(235,154,192,0.45)]"
            />
            <div className="min-w-0">
              <h1 className="text-h3 sm:text-h2 font-bold text-text truncate">MeMo</h1>
              <div className="flex items-center gap-2">
                <p className="text-responsive-xs text-text-muted whitespace-nowrap">
                  {profile?.name ? `Hello, ${profile.name}` : 'Welcome'}
                </p>
                {pair && <PresenceChip compact />}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {!pair && profile && (
              <Button variant="ghost" size="sm" onClick={() => navigate('/pairing')} aria-label="Set up partner pairing">
                <Users className="w-5 h-5" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}>
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="app-content pt-header-tall pb-dock px-4 space-y-5">
        {/* Phase Indicator */}
        {predictions && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <MotionGlassCard className="p-4" elevated>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.05, type: 'spring', stiffness: 320, damping: 24 }}
                    whileHover={{ scale: 1.05 }}
                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: `${phaseColor}1A` }}
                  >
                    {cyclePhase === 'period' && <Droplet className="w-7 h-7" style={{ color: phaseColor }} />}
                    {cyclePhase === 'follicular' && <Sparkles className="w-7 h-7" style={{ color: phaseColor }} />}
                    {cyclePhase === 'ovulation' && <Heart className="w-7 h-7" style={{ color: phaseColor }} />}
                    {cyclePhase === 'luteal' && <Calendar className="w-7 h-7" style={{ color: phaseColor }} />}
                  </motion.div>
                  <div>
                    <p className="text-caption text-text-muted">Current Phase</p>
                    <p className="font-semibold text-text" style={{ color: phaseColor }}>
                      {getPhaseLabel(cyclePhase)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-h2 font-bold text-text">{predictions.cycleDay}</p>
                  <p className="text-caption text-text-muted">Cycle Day</p>
                </div>
              </div>
            </MotionGlassCard>
          </motion.div>
        )}

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: 0.05 }}
        >
          <div className="stats-grid">
            <MotionGlassCard delay={0} className="p-4 text-center card-responsive" onClick={() => setShowPeriodModal(true)}>
              <div className="text-h3 sm:text-h2 font-bold text-accent">{predictions?.daysUntilPeriod ?? '--'}</div>
              <p className="text-responsive-xs text-text-muted mt-1">Days Until Period</p>
            </MotionGlassCard>
            <MotionGlassCard delay={60} className="p-4 text-center card-responsive">
              <div className="text-h3 sm:text-h2 font-bold text-secondary">{predictions?.cycleDay ?? '--'}</div>
              <p className="text-responsive-xs text-text-muted mt-1">Cycle Day</p>
            </MotionGlassCard>
            <MotionGlassCard delay={120} className="p-4 text-center card-responsive" onClick={() => navigate('/milestones')}>
              <div className="text-h3 sm:text-h2 font-bold text-secondary">{upcoming.length}</div>
              <p className="text-responsive-xs text-text-muted mt-1">Upcoming Events</p>
            </MotionGlassCard>
          </div>
        </motion.div>

        {/* Anniversary Hero */}
        {primary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: 0.08 }}
          >
            <AnniversaryHero anniversary={primary} />
          </motion.div>
        )}

        {/* Period Calendar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: 0.1 }}
        >
          <PeriodCalendar
            entries={entries}
            predictions={predictions}
            cycleSettings={cycleSettings}
            onDateSelect={handleDateSelect}
          />
        </motion.div>

        {/* Today's Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: 0.12 }}
        >
          <MotionGlassCard className="p-4">
            <h3 className="font-semibold text-text mb-3">Quick Actions</h3>
            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowPeriodModal(true)}
                className={cn(
                  'p-4 rounded-xl text-left transition-all',
                  isPeriodToday ? 'bg-accent-light border border-accent/30' : 'bg-input border border-border hover:bg-surface-subtle'
                )}
              >
                <div className="flex items-center gap-3">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center',
                      isPeriodToday ? 'bg-accent/20' : 'bg-accent-light'
                    )}
                  >
                    <Droplet className="w-5 h-5 text-accent" />
                  </motion.div>
                  <div>
                    <p className="font-medium text-text">{isPeriodToday ? 'Period Logged' : 'Log Period'}</p>
                    <p className="text-caption text-text-muted">{isPeriodToday ? 'Tap to edit' : 'Tap to log today'}</p>
                  </div>
                </div>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => { setEditingMilestone(null); setShowMilestoneModal(true); }}
                className="p-4 rounded-xl bg-input border border-border hover:bg-surface-subtle transition-all text-left"
              >
                <div className="flex items-center gap-3">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 20 }}
                    className="w-10 h-10 rounded-xl bg-secondary-light flex items-center justify-center"
                  >
                    <Sparkles className="w-5 h-5 text-secondary" />
                  </motion.div>
                  <div>
                    <p className="font-medium text-text">Add Milestone</p>
                    <p className="text-caption text-text-muted">Memory or anniversary</p>
                  </div>
                </div>
              </motion.button>
            </div>
          </MotionGlassCard>
        </motion.div>

        {/* Other Anniversaries */}
        {anniversaries.filter(a => a.id !== primary?.id).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: 0.15 }}
          >
            <h3 className="font-semibold text-text mb-3">Anniversaries</h3>
            <div className="space-y-3">
              {anniversaries.filter(a => a.id !== primary?.id).slice(0, 2).map((anniversary, index) => (
                <AnniversaryCard
                  key={anniversary.id}
                  anniversary={anniversary}
                  currentUserRole={profile?.role || 'girl'}
                  onEdit={a => { setEditingAnniversary(a); setShowAnniversaryModal(true); }}
                  onDelete={handleDeleteAnniversary}
                />
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Modals */}
      <PeriodLogModal
        isOpen={showPeriodModal}
        onClose={() => setShowPeriodModal(false)}
        selectedDate={selectedDate || today}
        existingEntry={selectedDate ? getEntry(selectedDate) : todayEntry}
        onSave={handleTogglePeriod}
        onDelete={date => togglePeriodDay(date, false)}
        userRole={profile?.role || 'girl'}
      />

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

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
};