import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, AlertCircle, Info, AlertTriangle, Trash2, Edit2, CheckCircle, XCircle, Calendar } from 'lucide-react';
import { GlassView, Button, GlassCard } from './GlassComponents';
import { ParticleBurst } from './ParticleBurst';
import { cn } from '@/utils/helpers';
import { useUserStore, usePresenceStore } from '@/stores';
import { useMilestoneFlash, isJustCreated, milestoneSheetStyle } from '@/components/milestone/milestoneEffects';
import { createPortal } from 'react-dom';

/* ===== Custom Confirm Context ===== */
interface ConfirmOptions {
  title: string;
  message: string;
  type?: 'confirm' | 'alert' | 'danger';
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

interface CustomModalContextValue {
  showConfirm: (options: ConfirmOptions) => void;
  showAlert: (title: string, message: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
}

const CustomModalContext = createContext<CustomModalContextValue | null>(null);

export const useCustomModals = () => {
  const context = useContext(CustomModalContext);
  if (!context) {
    throw new Error('useCustomModals must be used within a CustomModalProvider');
  }
  return context;
};

/* ===== Custom Confirm/Alert Modal ===== */
interface CustomConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  options: ConfirmOptions | null;
}

const CustomConfirmModal: React.FC<CustomConfirmModalProps> = ({
  isOpen,
  onClose,
  options,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen || !options) return null;

  const typeStyles = {
    confirm: { icon: AlertTriangle, color: 'text-accent', bg: 'bg-accent-light', border: 'border-accent' },
    alert: { icon: Info, color: 'text-secondary', bg: 'bg-secondary-light', border: 'border-secondary' },
    danger: { icon: AlertTriangle, color: 'text-error', bg: 'bg-error-light', border: 'border-error' },
  };

  const style = typeStyles[options.type || 'confirm'];
  const Icon = style.icon;

  const modalContent = (
    <motion.div
      key="confirm-dialog"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.86, y: 32 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: -16 }}
        transition={{ type: 'spring', stiffness: 320, damping: 24, mass: 0.9 }}
        className="w-full max-w-md my-auto"
        onClick={e => e.stopPropagation()}
      >
        <GlassView className="modal-surface rounded-3xl sm:rounded-2xl overflow-hidden max-h-[90dvh] flex flex-col">
          <div className={cn('p-5 sm:p-6 text-center overflow-y-auto', style.bg)}>
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 20 }}
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-bg/70 backdrop-blur-sm shadow-sm"
            >
              <Icon className={cn('w-7 h-7', style.color)} />
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.3 }}
              className="text-h3 font-bold text-text"
            >
              {options.title}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.3 }}
              className="text-body text-text-secondary mt-2"
            >
              {options.message}
            </motion.p>
          </div>
          <div className="flex gap-3 p-4 sm:p-6 flex-shrink-0">
            {options.type !== 'alert' && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => { options.onCancel?.(); onClose(); }}
                className="flex-1 min-h-12 px-4 py-3 rounded-xl bg-input border border-border text-text-secondary font-medium hover:bg-surface-subtle transition-colors"
              >
                {options.cancelText || 'Cancel'}
              </motion.button>
            )}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => { options.onConfirm(); onClose(); }}
              className={cn(
                'flex-1 min-h-12 px-4 py-3 rounded-xl font-semibold transition-colors shadow-sm',
                options.type === 'danger'
                  ? 'bg-error text-error-inverse hover:bg-error-hover'
                  : 'bg-accent text-on-accent hover:bg-accent-hover'
              )}
            >
              {options.confirmText || (options.type === 'alert' ? 'OK' : 'Confirm')}
            </motion.button>
          </div>
        </GlassView>
      </motion.div>
    </motion.div>
  );

  return createPortal(<AnimatePresence>{isOpen && modalContent}</AnimatePresence>, document.body);
};

/* ===== Toast Notifications ===== */
interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (message: string, type: Toast['type'], duration?: number) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const ToastItem: React.FC<{ toast: Toast; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  const typeStyles = {
    success: { icon: CheckCircle, color: 'text-success', bg: 'bg-success-light', border: 'border-success' },
    error: { icon: XCircle, color: 'text-error', bg: 'bg-error-light', border: 'border-error' },
    warning: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning-light', border: 'border-warning' },
    info: { icon: Info, color: 'text-secondary', bg: 'bg-secondary-light', border: 'border-secondary' },
  };

  const style = typeStyles[toast.type];
  const Icon = style.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: 100, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'fixed bottom-28 left-4 right-4 mx-auto max-w-md z-[600]',
        'glass-strong p-4 rounded-xl border',
        'flex items-start gap-3',
        style.bg, style.border
      )}
      onClick={() => onDismiss(toast.id)}
    >
      <motion.div
        initial={{ scale: 0, rotate: -90 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 20 }}
        className="flex-shrink-0 w-8 h-8 flex-center rounded-lg"
        style={{ background: 'currentColor' }}
      >
        <Icon className="w-5 h-5" style={{ color: 'currentColor' }} />
      </motion.div>
      <p className="flex-1 text-body-sm font-medium leading-snug" style={{ color: 'currentColor' }}>
        {toast.message}
      </p>
      <motion.button
        whileTap={{ scale: 0.85 }}
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 p-1.5 rounded-lg hover:bg-text/10 transition-colors text-current opacity-70"
      >
        <X className="w-5 h-5" />
      </motion.button>
    </motion.div>
  );
};

const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useToast();
  return (
    <div className="fixed bottom-28 left-4 right-4 z-[600] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence initial={false}>
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </AnimatePresence>
    </div>
  );
};

/* ===== Providers ===== */
export const CustomModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [confirmOptions, setConfirmOptions] = useState<ConfirmOptions | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showConfirm = useCallback((options: ConfirmOptions) => {
    setConfirmOptions(options);
    setIsConfirmOpen(true);
  }, []);

  const showAlert = useCallback((title: string, message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setConfirmOptions({
      title,
      message,
      type: type === 'error' ? 'danger' : 'alert',
      confirmText: 'OK',
      onConfirm: () => {},
    });
    setIsConfirmOpen(true);
  }, []);

  const showToast = useCallback((message: string, type: Toast['type'], duration = 4000) => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, type, duration }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const closeConfirm = useCallback(() => {
    setIsConfirmOpen(false);
    setConfirmOptions(null);
  }, []);

  return (
    <>
      <CustomModalContext.Provider value={{ showConfirm, showAlert }}>
        <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
          {children}
          <CustomConfirmModal isOpen={isConfirmOpen} onClose={closeConfirm} options={confirmOptions} />
          <ToastContainer />
        </ToastContext.Provider>
      </CustomModalContext.Provider>
    </>
  );
};

/* ===== Swipeable Card ===== */
interface SwipeableCardProps {
  children: React.ReactNode;
  actions: React.ReactNode;
  actionWidth?: number;
  className?: string;
  /** When true, the card dissolves into particles and stops clipping them */
  destroying?: boolean;
}

export const SwipeableCard: React.FC<SwipeableCardProps> = ({
  children,
  actions,
  actionWidth = 116,
  className,
  destroying = false,
}) => {
  const [translateX, setTranslateX] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const slideRef = useRef<HTMLDivElement>(null);
  const translateXRef = useRef(0);
  translateXRef.current = translateX;
  const destroyingRef = useRef(destroying);
  destroyingRef.current = destroying;

  // Native pointer events (mouse + touch in one path) on the card itself,
  // with move/up listeners on window so the drag survives anywhere on screen.
  useEffect(() => {
    const slide = slideRef.current;
    if (!slide) return;

    let startX = 0;
    let base = 0;
    let current = 0;

    const clamp = (v: number) => Math.min(0, Math.max(-actionWidth, v));

    const move = (e: PointerEvent) => {
      const next = clamp(base + (e.clientX - startX));
      current = next;
      translateXRef.current = next;
      setTranslateX(next);
    };

    const up = () => {
      setIsDragging(false);
      const shouldOpen = current < -actionWidth * 0.4;
      const target = shouldOpen ? -actionWidth : 0;
      current = target;
      translateXRef.current = target;
      setTranslateX(target);
      setIsOpen(shouldOpen);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };

    const down = (e: PointerEvent) => {
      if (destroyingRef.current) return;
      startX = e.clientX;
      base = translateXRef.current;
      current = base;
      setIsDragging(true);
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    };

    slide.addEventListener('pointerdown', down);
    return () => {
      slide.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [actionWidth]);

  const progress = Math.min(1, Math.max(0, -translateX / actionWidth));
  // Buttons stay hidden until the card has mostly slid out, then fade/scale in
  const reveal = Math.min(1, Math.max(0, (progress - 0.3) / 0.55));

  return (
    <div className={cn('relative', destroying ? 'overflow-visible' : 'overflow-hidden', className)}>
      <div
        ref={slideRef}
        style={{
          transform: `translateX(${translateX}px) scale(${destroying ? 0.72 : 1}) translateY(${destroying ? -8 : 0}px)`,
          opacity: destroying ? 0 : 1,
          touchAction: 'pan-y',
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.16,1,0.3,1), opacity 0.4s ease',
        }}
        onDragStart={e => e.preventDefault()}
      >
        {children}
      </div>

      {destroying && <ParticleBurst fire />}

      {/* Vertical action rail: Edit sits above Delete, both full width. */}
      <div
        className={cn(
          'absolute right-0 top-0 bottom-0 flex flex-col gap-1.5 p-1.5',
          destroying && 'opacity-0 pointer-events-none'
        )}
        style={{
          width: actionWidth,
          transform: `translateX(${actionWidth + translateX}px) scale(${0.85 + reveal * 0.15})`,
          transformOrigin: 'right center',
          opacity: destroying ? 0 : reveal,
          pointerEvents: isOpen && !destroying ? 'auto' : 'none',
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.16,1,0.3,1), opacity 0.3s ease',
        }}
        aria-hidden={destroying || !isOpen}
      >
        {actions}
      </div>
    </div>
  );
};

interface SwipeActionProps {
  onClick: () => void;
  icon: React.ReactNode;
  /** Accessible name for the action (read by screen readers) */
  label: string;
  /** Show the visible text under the icon. Defaults to false (icon-only). */
  showLabel?: boolean;
  variant?: 'danger' | 'primary' | 'secondary';
  className?: string;
}

export const SwipeAction: React.FC<SwipeActionProps> = ({
  onClick,
  icon,
  label,
  showLabel = false,
  variant = 'primary',
  className,
}) => {
  const variantStyles = {
    danger: {
      button:
        'from-[#E0628F] via-[#C23664] to-[#96214A] text-white shadow-[0_10px_26px_-8px_rgba(194,54,100,0.75),inset_0_1px_0_rgba(255,255,255,0.3)] ring-1 ring-white/25',
      bubble: 'bg-white/25 text-white',
    },
    primary: {
      button:
        'from-[#F4A9CB] via-[#EB9AC0] to-[#D97BA6] text-[#3A1B2B] shadow-[0_10px_26px_-8px_rgba(235,154,192,0.8),inset_0_1px_0_rgba(255,255,255,0.45)] ring-1 ring-white/40',
      bubble: 'bg-[#3A1B2B]/15 text-[#3A1B2B]',
    },
    secondary: {
      button:
        'from-[#B394F2] via-[#9F7AEA] to-[#7B53D6] text-[#241033] shadow-[0_10px_26px_-8px_rgba(159,122,234,0.75),inset_0_1px_0_rgba(255,255,255,0.4)] ring-1 ring-white/30',
      bubble: 'bg-[#241033]/15 text-[#241033]',
    },
  } as const;

  const style = variantStyles[variant];

  return (
    <motion.button
      whileTap={{ scale: 0.9, transition: { type: 'spring', stiffness: 500, damping: 22 } }}
      onClick={() => {
        // Light haptic on devices that support it - feels like a native action sheet
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          navigator.vibrate(12);
        }
        onClick();
      }}
      className={cn(
        'group relative flex flex-1 w-full min-h-0 flex-col items-center justify-center gap-0.5',
        'rounded-2xl px-2 bg-gradient-to-br overflow-hidden select-none',
        'outline-none transition-shadow duration-200 focus-visible:ring-2 focus-visible:ring-accent-glow',
        'hover:shadow-[0_14px_34px_-8px_rgba(235,154,192,0.65)]',
        style.button,
        className
      )}
      aria-label={label}
    >
      {/* Light sweep across the surface on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-y-4 -left-2/3 w-1/2 rotate-[18deg] bg-white/35 blur-lg opacity-0 transition-all duration-700 ease-out group-hover:opacity-100 group-hover:left-[130%]"
      />
      <span
        className={cn(
          'relative flex h-9 w-9 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-110',
          style.bubble
        )}
      >
        {icon}
      </span>
      {showLabel && (
        <span className="relative text-[10px] font-extrabold uppercase tracking-[0.18em]">
          {label}
        </span>
      )}
    </motion.button>
  );
};

/* ===== Swipeable Milestone Card ===== */
interface SwipeableMilestoneCardProps {
  milestone: any;
  onEdit: (milestone: any) => void;
  /** Parent owns the single confirm dialog + particle dissolve */
  onDelete: (id: string) => void;
  onShare: (milestone: any) => void;
  currentUserRole: 'boy' | 'girl';
  className?: string;
  destroying?: boolean;
  /** Position in the list — staggers the entrance */
  index?: number;
}

export const SwipeableMilestoneCard: React.FC<SwipeableMilestoneCardProps> = ({
  milestone,
  onEdit,
  onDelete,
  onShare,
  currentUserRole,
  className,
  destroying = false,
  index = 0,
}) => {
  const isOwner = milestone.createdBy === currentUserRole;
  const myName = useUserStore(state => state.profile?.name);
  const partnerName = usePresenceStore(state => state.partnerName);
  const creatorName = milestone.createdBy === currentUserRole
    ? (myName ?? 'You')
    : (partnerName ?? 'Partner');

  // Entrance (created here or synced from the partner's device) plus an edit
  // flash whenever this row's updatedAt changes — the same signal the sync
  // merge bumps on the partner's device.
  const editFlash = useMilestoneFlash(milestone.updatedAt);
  const [born] = useState(() => isJustCreated(milestone.createdAt));

  return (
    <motion.div
      initial={{ opacity: 0, y: 46, scale: 0.78 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: 'spring',
        stiffness: 240,
        damping: 17,
        mass: 1,
        delay: Math.min(index * 0.06, 0.3),
      }}
      className="relative"
    >
      {/* Born flourish: pink glow that blooms once for a freshly created card */}
      {born && (
        <motion.div
          key="born"
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10"
          initial={{ opacity: 0.9 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          style={{ background: 'radial-gradient(120% 130% at 50% 0%, rgba(235,154,192,0.55) 0%, rgba(186,128,240,0.3) 45%, transparent 75%)' }}
        />
      )}
      {/* Edit flash: a light sweep plus an accent ring pulse, re-keyed per edit so it replays */}
      {editFlash > 0 && (
        <motion.div
          key={`sheen-${editFlash}`}
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[inherit]"
        >
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
          initial={{ opacity: 0, scale: 1 }}
          animate={{ opacity: [0, 0.9, 0], scale: [1, 1.02, 1] }}
          transition={{ duration: 1.1, times: [0, 0.25, 1], ease: 'easeOut' }}
          style={{ boxShadow: '0 0 24px rgba(235,154,192,0.45)' }}
        />
      )}

      <SwipeableCard
        destroying={destroying}
        actions={
          <>
            <SwipeAction variant="primary" onClick={() => { onEdit(milestone); }} icon={<Edit2 className="w-5 h-5" />} label="Edit" />
            {isOwner && (
              <SwipeAction variant="danger" onClick={() => onDelete(milestone.id)} icon={<Trash2 className="w-5 h-5" />} label="Delete" />
            )}
          </>
        }
        className={className}
        actionWidth={116}
      >
        <GlassCard className="p-4" style={{ background: 'var(--color-surface)' }}>
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 bg-accent-light">
              <span>{milestone.emoji}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-text truncate">{milestone.title}</h3>
              <p className="text-body-sm text-text-muted mt-0.5">{new Date(milestone.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
              {typeof milestone.note === 'string' && milestone.note.trim() && (
                <p className="text-body-sm text-text-secondary mt-2 line-clamp-2">{milestone.note}</p>
              )}
              <div className="mt-3">
                <span className="inline-flex px-2 py-0.5 rounded-full bg-input text-caption text-text-secondary font-medium">
                  {creatorName}
                </span>
              </div>
            </div>
          </div>
        </GlassCard>
      </SwipeableCard>
    </motion.div>
  );
};