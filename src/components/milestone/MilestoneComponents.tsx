import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Heart, Cake, Camera, Share2, Edit2, Trash2, Clock, Sparkles, Award, Calendar, Users } from 'lucide-react';
import { cn, formatDateKeyFull, getRelativeTime, dateKey, diffDays } from '@/utils/helpers';
import { GlassView, Button, GlassCard, MotionGlassCard, ModalBackdrop } from '@/components/ui/GlassComponents';
import { ParticleBurst } from '@/components/ui/ParticleBurst';
import { DatePickerField } from '@/components/ui/CalendarPicker';
import { Milestone, Anniversary, UserRole } from '@/types';
import { useUserStore, usePresenceStore } from '@/stores';
import { useMilestoneFlash, isJustCreated, milestoneSheetStyle } from './milestoneEffects';
import { createPortal } from 'react-dom';

interface MilestoneCardProps {
  milestone: Milestone;
  currentUserRole: UserRole;
  onEdit: (milestone: Milestone) => void;
  onDelete: (id: string) => void;
  onShare: (milestone: Milestone) => void;
  className?: string;
  /** Hide the trash button (e.g., read-mostly contexts) */
  showDelete?: boolean;
}

export const MilestoneCard: React.FC<MilestoneCardProps> = ({
  milestone,
  currentUserRole,
  onEdit,
  onDelete,
  onShare,
  className,
  showDelete = true,
}) => {
  const isOwner = milestone.createdBy === currentUserRole;
  const myName = useUserStore(state => state.profile?.name);
  const partnerName = usePresenceStore(state => state.partnerName);
  const creatorName = milestone.createdBy === currentUserRole
    ? (myName ?? 'You')
    : (partnerName ?? 'Partner');
  const daysUntil = diffDays(dateKey(), milestone.date);
  const isPast = daysUntil < 0;
  const isToday = daysUntil === 0;
  const isUpcoming = daysUntil > 0 && daysUntil <= 30;
  const editFlash = useMilestoneFlash(milestone.updatedAt);
  const [born] = useState(() => isJustCreated(milestone.createdAt));

  return (
    <motion.div
      initial={{ opacity: 0, y: 46, scale: 0.78 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 240, damping: 17, mass: 1 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onEdit(milestone)}
      className={cn(
        'relative overflow-hidden cursor-pointer card card-interactive p-4',
        isUpcoming && 'ring-2 ring-secondary/30',
        className
      )}
    >
      {/* Born flourish: pink glow that blooms once for a freshly created card,
          wherever the card appears (local create or arriving through sync) */}
      {born && (
        <motion.div
          key="born"
          aria-hidden
          className="pointer-events-none absolute inset-0"
          initial={{ opacity: 0.9 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          style={{ background: 'radial-gradient(120% 130% at 50% 0%, rgba(235,154,192,0.55) 0%, rgba(186,128,240,0.3) 45%, transparent 75%)' }}
        />
      )}
      {/* Edit flash: light sweep + accent ring, re-keyed per edit so it replays */}
      {editFlash > 0 && (
        <motion.div key={`sheen-${editFlash}`} aria-hidden className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[inherit]">
          <motion.div
            className="absolute inset-y-0 w-1/2 -skew-x-12"
            style={milestoneSheetStyle}
            initial={{ x: '-130%' }}
            animate={{ x: '340%' }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          />
        </motion.div>
      )}
      {editFlash > 0 && (
        <motion.div
          key={`ring-${editFlash}`}
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] border-2 border-accent"
          style={{ boxShadow: '0 0 26px rgba(235,154,192,0.5)' }}
          initial={{ opacity: 0, scale: 1 }}
          animate={{ opacity: [0, 0.9, 0], scale: [1, 1.025, 1] }}
          transition={{ duration: 1.1, times: [0, 0.25, 1], ease: 'easeOut' }}
        />
      )}
      <div className="flex items-start gap-4">
        <motion.div
          initial={false}
          whileHover={{ scale: 1.1, rotate: 5 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className={cn(
            'w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0',
            isPast ? 'bg-text-muted/10' : 'bg-accent-light'
          )}
        >
          <span>{milestone.emoji}</span>
        </motion.div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h3 className="font-semibold text-text truncate">{milestone.title}</h3>
              <p className="text-body-sm text-text-muted mt-0.5">{formatDateKeyFull(milestone.date)}</p>
            </div>
            {isOwner && (
              <div className="flex items-center gap-1">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={e => { e.stopPropagation(); onShare(milestone); }}
                  className="p-2 rounded-lg hover:bg-surface-subtle transition-colors"
                  aria-label="Share"
                >
                  <Share2 className="w-4 h-4 text-text-muted" />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={e => { e.stopPropagation(); onEdit(milestone); }}
                  className="p-2 rounded-lg hover:bg-surface-subtle transition-colors"
                  aria-label="Edit"
                >
                  <Edit2 className="w-4 h-4 text-text-muted" />
                </motion.button>
                {showDelete && (
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={e => { e.stopPropagation(); onDelete(milestone.id); }}
                    className="p-2 rounded-lg hover:bg-error-light hover:text-error transition-colors"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-text-muted" />
                  </motion.button>
                )}
              </div>
            )}
          </div>

          {milestone.note && (
            <p className="text-body-sm text-text-secondary mt-2 line-clamp-2">{milestone.note}</p>
          )}

          <div className="flex items-center gap-4 mt-3 text-caption text-text-muted">
            <span className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded-full',
              isToday ? 'bg-accent-light text-accent' : 
              isPast ? 'bg-text-muted/10' : 'bg-secondary-light text-secondary'
            )}>
              <Calendar className="w-3 h-3" />
              {isToday ? 'Today' : isPast ? `${Math.abs(daysUntil)} days ago` : `${daysUntil} days left`}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-input text-text-secondary normal-case font-medium">
              {creatorName}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

interface AnniversaryCardProps {
  anniversary: Anniversary;
  currentUserRole: UserRole;
  onEdit: (anniversary: Anniversary) => void;
  onDelete: (id: string) => void;
  className?: string;
  destroying?: boolean;
}

export const AnniversaryCard: React.FC<AnniversaryCardProps> = ({
  anniversary,
  currentUserRole,
  onEdit,
  onDelete,
  className,
  destroying = false,
}) => {
  const daysUntil = diffDays(dateKey(), anniversary.date);
  const isPast = daysUntil < 0;
  const isToday = daysUntil === 0;
  const isPrimary = anniversary.isPrimary;

  const emblem = isPrimary ? (
    <Award className="w-6 h-6 text-secondary" />
  ) : (
    <Cake className="w-6 h-6 text-accent" />
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 26, scale: 0.96 }}
      animate={destroying ? { opacity: 0, scale: 0.7, y: -10 } : { opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className={cn('relative', destroying && 'overflow-visible', className)}
    >
      {destroying && <ParticleBurst fire />}

      {/* Primary ribbon */}
      {isPrimary && (
        <div className="absolute -top-2.5 right-4 z-10">
          <motion.div
            initial={{ scale: 0, rotate: -14 }}
            animate={{ scale: 1, rotate: -6 }}
            transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.15 }}
            className="flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-on-secondary"
            style={{
              background: 'linear-gradient(135deg, var(--color-secondary) 0%, var(--color-accent) 100%)',
              boxShadow: '0 6px 18px -4px var(--color-accent-glow)',
            }}
          >
            <Sparkles className="w-3 h-3" />
            Our Day
          </motion.div>
        </div>
      )}

      <motion.div
        role="button"
        tabIndex={0}
        whileTap={{ scale: 0.97 }}
        whileHover={{ y: -3 }}
        onClick={() => onEdit(anniversary)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit(anniversary); } }}
        className={cn(
          'relative block w-full text-left rounded-3xl p-[1.5px] transition-shadow duration-300 cursor-pointer',
          'shadow-[0_10px_36px_-14px_rgba(159,122,234,0.4)] hover:shadow-[0_18px_44px_-14px_rgba(235,154,192,0.55)]',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-glow',
          isPrimary
            ? 'bg-gradient-to-br from-secondary/80 via-accent/60 to-secondary/40'
            : 'bg-gradient-to-br from-accent/70 via-secondary/40 to-accent/25'
        )}
        aria-label={`Edit anniversary: ${anniversary.label}`}
      >
        {/* Inner surface */}
        <div
          className="relative rounded-3xl px-4 py-4 sm:px-5 sm:py-5 overflow-hidden"
          style={{
            background:
              'radial-gradient(140% 120% at 85% 0%, var(--color-accent-light) 0%, transparent 55%), radial-gradient(120% 120% at 0% 100%, var(--color-secondary-light) 0%, transparent 55%), var(--color-surface)',
          }}
        >
          <div className="flex items-center gap-4">
            {/* Emblem with static conic ring */}
            <div
              className="relative w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                background: `conic-gradient(from 210deg, var(--color-accent), var(--color-secondary), var(--color-accent))`,
                boxShadow: '0 6px 22px -6px var(--color-accent-glow)',
              }}
            >
              <div className="w-[calc(100%-6px)] h-[calc(100%-6px)] rounded-full bg-surface flex items-center justify-center">
                {emblem}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-h3 font-bold text-text leading-tight truncate">{anniversary.label}</h3>
              <p className="flex items-center gap-1.5 text-body-sm text-text-secondary mt-0.5">
                <Calendar className="w-4 h-4 text-secondary flex-shrink-0" />
                <span className="truncate">{new Date(anniversary.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
              </p>
            </div>
          </div>

          {/* Bottom row: countdown + actions */}
          <div className="flex items-center justify-between gap-3 mt-3.5">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-caption font-semibold',
                isToday
                  ? 'text-on-accent'
                  : isPast
                    ? 'text-text-secondary bg-text-muted/10'
                    : 'text-on-secondary'
              )}
              style={
                isToday
                  ? { background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-hover))' }
                  : !isPast
                    ? { background: 'linear-gradient(135deg, var(--color-secondary), var(--color-secondary-hover))' }
                    : undefined
              }
            >
              {isToday ? <Sparkles className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
              {isToday ? 'Today!' : isPast ? `${Math.abs(daysUntil)} days ago` : `${daysUntil} days left`}
            </span>

            <div className="flex items-center gap-1.5">
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={e => { e.stopPropagation(); onEdit(anniversary); }}
                className="w-10 h-10 rounded-xl flex items-center justify-center bg-input border border-border text-text-secondary transition-colors hover:bg-surface-subtle hover:text-text"
                aria-label="Edit anniversary"
              >
                <Edit2 className="w-[18px] h-[18px]" />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={e => { e.stopPropagation(); onDelete(anniversary.id); }}
                className="w-10 h-10 rounded-xl flex items-center justify-center bg-error-light border border-error/30 text-error transition-colors hover:bg-error hover:text-error-inverse"
                aria-label="Delete anniversary"
              >
                <Trash2 className="w-[18px] h-[18px]" />
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const EMOJIS = ['❤️', '💕', '💖', '💗', '💓', '💞', '💘', '💝', '💟', '♥️', '❣️', '💑', '👫', '💏', '💌', '🎁', '🎂', '🍰', '🥂', '🍾', '✈️', '🏠', '🚗', '📸', '🎵', '🎬', '🌅', '🌙', '⭐', '🌟', '✨'];

const MILESTONE_TEMPLATES = [
  { title: 'First Date', emoji: '💕' },
  { title: 'First Kiss', emoji: '💋' },
  { title: 'Moved In Together', emoji: '🏠' },
  { title: 'Engagement', emoji: '💍' },
  { title: 'Wedding', emoji: '👰' },
  { title: 'First Trip', emoji: '✈️' },
  { title: 'Adopted Pet', emoji: '🐾' },
  { title: 'Bought Home', emoji: '🏡' },
  { title: 'Pregnancy Announcement', emoji: '🤰' },
  { title: 'Baby Born', emoji: '👶' },
  { title: 'Anniversary', emoji: '💖' },
  { title: 'Custom', emoji: '✨' },
];

interface MilestoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  milestone?: Milestone;
  onSave: (milestone: Omit<Milestone, 'id' | 'synced' | 'createdAt' | 'updatedAt'>) => void;
  onDelete?: (id: string) => void;
  currentUserRole: UserRole;
}

export const MilestoneModal: React.FC<MilestoneModalProps> = ({
  isOpen,
  onClose,
  milestone,
  onSave,
  onDelete,
  currentUserRole,
}) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(dateKey());
  const [emoji, setEmoji] = useState('❤️');
  const [note, setNote] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  useEffect(() => {
    if (milestone) {
      setTitle(milestone.title);
      setDate(milestone.date);
      setEmoji(milestone.emoji);
      setNote(milestone.note || '');
    } else {
      setTitle('');
      setDate(dateKey());
      setEmoji('❤️');
      setNote('');
    }
  }, [milestone]);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      date,
      emoji,
      note: note.trim() || undefined,
      createdBy: currentUserRole,
    });
    onClose();
  };

  const handleDelete = () => {
    if (!milestone || !onDelete) return;
    onDelete(milestone.id);
    onClose();
  };

  const modalContent = (
    <ModalBackdrop isOpen={isOpen} onClose={onClose}>
      <GlassView className="modal-surface rounded-3xl sm:rounded-2xl p-4 md:p-6 max-h-[90dvh] overflow-y-auto overscroll-contain w-full max-w-md">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-h3 font-bold text-text">{milestone ? 'Edit Milestone' : 'Add Milestone'}</h2>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-subtle transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-text-muted" />
          </motion.button>
        </div>

        {/* Title */}
        <div className="mb-4">
          <label className="block text-caption font-medium text-text-secondary mb-2">Title</label>
          <div className="relative">
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Enter milestone title"
              className="w-full px-4 py-3 rounded-xl bg-input border border-border text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            />
          </div>
        </div>

        {/* Date */}
        <div className="mb-4">
          <DatePickerField
            label="Date"
            value={date}
            onChange={setDate}
          />
        </div>

        {/* Emoji */}
        <div className="mb-4">
          <label className="block text-caption font-medium text-text-secondary mb-2">Emoji</label>
          <div className="relative">
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="w-full px-4 py-3 rounded-xl bg-input border border-border text-2xl text-left focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            >
              {emoji}
            </motion.button>
            {showEmojiPicker && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
                className="absolute bottom-full left-0 right-0 mb-2 p-3 rounded-xl bg-surface-elevated/95 backdrop-blur-sm border border-border-strong shadow-xl z-10 max-h-60 overflow-y-auto"
              >
                <div className="grid grid-cols-8 gap-1">
                  {EMOJIS.map(e => (
                    <motion.button
                      key={e}
                      whileTap={{ scale: 1.2 }}
                      onClick={() => { setEmoji(e); setShowEmojiPicker(false); }}
                      className={cn(
                        'p-2 rounded-lg text-2xl transition-transform',
                        emoji === e ? 'bg-accent-light scale-110' : 'hover:scale-125'
                      )}
                    >
                      {e}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Quick Templates */}
        <div className="mb-4">
          <label className="block text-caption font-medium text-text-secondary mb-2">Quick Add</label>
          <div className="flex flex-wrap gap-2">
            {MILESTONE_TEMPLATES.map(template => (
              <motion.button
                key={template.title}
                whileTap={{ scale: 0.97 }}
                onClick={() => { setTitle(template.title); setEmoji(template.emoji); }}
                className="px-3 py-1.5 rounded-full text-caption border border-border transition-colors hover:bg-surface-subtle"
              >
                {template.emoji} {template.title}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Note */}
        <div className="mb-6">
          <label className="block text-caption font-medium text-text-secondary mb-2">Note (optional)</label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Add a note..."
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-input border border-border text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {milestone && onDelete && (
            <Button
              variant="ghost"
              onClick={handleDelete}
              className="flex-1"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          )}
          <Button
            variant="primary"
            onClick={handleSave}
            className="flex-1"
            disabled={!title.trim()}
          >
            {milestone ? 'Update' : 'Add'}
          </Button>
        </div>
      </GlassView>
    </ModalBackdrop>
  );

  if (!isOpen) return null;

  return createPortal(modalContent, document.body);
};

interface AnniversaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  anniversary?: Anniversary;
  onSave: (anniversary: Omit<Anniversary, 'id' | 'createdAt'>) => void;
  onDelete?: (id: string) => void;
}

export const AnniversaryModal: React.FC<AnniversaryModalProps> = ({
  isOpen,
  onClose,
  anniversary,
  onSave,
  onDelete,
}) => {
  const [label, setLabel] = useState('');
  const [date, setDate] = useState(dateKey());
  const [isPrimary, setIsPrimary] = useState(false);

  useEffect(() => {
    if (anniversary) {
      setLabel(anniversary.label);
      setDate(anniversary.date);
      setIsPrimary(anniversary.isPrimary);
    } else {
      setLabel('');
      setDate(dateKey());
      setIsPrimary(false);
    }
  }, [anniversary]);

  const handleSave = () => {
    if (!label.trim()) return;
    onSave({
      label: label.trim(),
      date,
      isPrimary,
    });
    onClose();
  };

  const handleDelete = () => {
    if (!anniversary || !onDelete) return;
    onDelete(anniversary.id);
    onClose();
  };

  const modalContent = (
    <ModalBackdrop isOpen={isOpen} onClose={onClose}>
      <GlassView className="modal-surface rounded-3xl sm:rounded-2xl p-4 md:p-6 max-h-[90dvh] overflow-y-auto overscroll-contain w-full max-w-md">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-h3 font-bold text-text">{anniversary ? 'Edit Anniversary' : 'Add Anniversary'}</h2>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-subtle transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-text-muted" />
          </motion.button>
        </div>

        <div className="mb-4">
          <label className="block text-caption font-medium text-text-secondary mb-2">Label</label>
          <input
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="e.g., Our Wedding, First Date"
            className="w-full px-4 py-3 rounded-xl bg-input border border-border text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          />
        </div>

        <div className="mb-4">
          <DatePickerField
            label="Date"
            value={date}
            onChange={setDate}
          />
        </div>

        <div className="mb-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsPrimary(!isPrimary)}
              className={cn(
                'w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all',
                isPrimary 
                  ? 'border-secondary bg-secondary-light' 
                  : 'border-border-strong hover:border-secondary'
              )}
            >
              {isPrimary && <Award className="w-4 h-4 text-secondary" />}
            </motion.button>
            <div>
              <p className="font-medium text-text">Primary Anniversary</p>
              <p className="text-caption text-text-muted">Show prominently on home screen</p>
            </div>
          </label>
        </div>

        <div className="flex gap-3">
          {anniversary && onDelete && (
            <Button
              variant="ghost"
              onClick={handleDelete}
              className="flex-1"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          )}
          <Button
            variant="primary"
            onClick={handleSave}
            className="flex-1"
            disabled={!label.trim()}
          >
            {anniversary ? 'Update' : 'Add'}
          </Button>
        </div>
      </GlassView>
    </ModalBackdrop>
  );

  if (!isOpen) return null;

  return createPortal(modalContent, document.body);
};

interface AnniversaryHeroProps {
  anniversary: Anniversary | null;
  className?: string;
}

export const AnniversaryHero: React.FC<AnniversaryHeroProps> = ({ anniversary, className }) => {
  if (!anniversary) return null;

  const daysUntil = diffDays(dateKey(), anniversary.date);
  const isToday = daysUntil === 0;
  const isPast = daysUntil < 0;

  return (
    <MotionGlassCard 
      className={cn('p-6 relative overflow-hidden', anniversary.isPrimary && 'ring-2 ring-secondary/30', className)}
      elevated
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-secondary/5"
      />
      <div className="relative flex items-center gap-4">
        <motion.div
          initial={false}
          whileHover={{ scale: 1.05, rotate: 3 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className={cn(
            'w-20 h-20 rounded-2xl flex items-center justify-center text-4xl flex-shrink-0',
            anniversary.isPrimary ? 'bg-secondary-light' : 'bg-accent-light'
          )}
        >
          {anniversary.isPrimary ? <Award className="w-10 h-10 text-secondary" /> : <Cake className="w-10 h-10 text-accent" />}
        </motion.div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-h3 font-bold text-text">{anniversary.label}</h3>
          <p className="text-body-sm text-text-muted">{formatDateKeyFull(anniversary.date)}</p>
          
          <div className="flex items-center gap-4 mt-3">
            <motion.span
              initial={false}
              whileHover={{ scale: 1.02 }}
              className={cn(
                'flex items-center gap-1 px-3 py-1 rounded-full text-body-sm font-medium',
                isToday ? 'bg-accent-light text-accent' : 
                isPast ? 'bg-text-muted/10 text-text-secondary' : 'bg-secondary-light text-secondary'
              )}
            >
              <Clock className="w-4 h-4" />
              {isToday ? 'Today!' : isPast ? `${Math.abs(daysUntil)} days ago` : `${daysUntil} days left`}
            </motion.span>
            
            {anniversary.isPrimary && (
              <span className="flex items-center gap-1 px-3 py-1 rounded-full text-body-sm font-medium bg-secondary-light text-secondary">
                <Sparkles className="w-4 h-4" />
                Primary
              </span>
            )}
          </div>
        </div>
      </div>
    </MotionGlassCard>
  );
};