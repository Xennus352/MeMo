import React, { forwardRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/utils/helpers';

/* ===== GlassView ===== */
interface GlassViewProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  strong?: boolean;
  interactive?: boolean;
  children: React.ReactNode;
}

export const GlassView = forwardRef<HTMLDivElement, GlassViewProps>(
  ({ children, className, elevated = false, strong = false, interactive = false, style, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'relative overflow-hidden',
          elevated ? 'glass-elevated' : strong ? 'glass-strong' : 'glass',
          interactive && 'cursor-pointer transition-transform duration-150 active:scale-[0.98]',
          className
        )}
        style={style}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassView.displayName = 'GlassView';

/* ===== GlassCard ===== */
interface GlassCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'ref'> {
  elevated?: boolean;
  interactive?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ children, className, elevated = false, interactive = false, onClick, style, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'relative overflow-hidden',
          elevated ? 'card-elevated' : 'card',
          interactive && 'card-interactive',
          className
        )}
        style={style}
        onClick={onClick}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassCard.displayName = 'GlassCard';

/* ===== MotionGlassCard - with entrance animation ===== */
interface MotionGlassCardProps extends Omit<GlassCardProps, 'ref'> {
  delay?: number;
  animateIn?: boolean;
}

export const MotionGlassCard = ({
  children,
  className,
  elevated = false,
  interactive = false,
  onClick,
  delay = 0,
  animateIn = true,
  ...props
}: MotionGlassCardProps) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // Callers pass delay in milliseconds (`60`, `index * 60`); Motion expects
  // seconds. Without this conversion those cards stay invisible for a minute.
  const motionProps: any = {
    initial: animateIn ? { opacity: 0, y: 14, scale: 0.99 } : false,
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { duration: 0.28, delay: Math.min(delay, 180) / 1000, ease: [0.16, 1, 0.3, 1] },
    className: cn(
      'relative overflow-hidden',
      elevated ? 'card-elevated' : 'card',
      interactive && 'card-interactive',
      className
    ),
    onClick,
    whileTap: { scale: 0.98 },
    ...props,
  };

  return <motion.div {...motionProps}>{children}</motion.div>;
};

/* ===== Button System ===== */
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  children: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, className, variant = 'primary', size = 'md', fullWidth = false, loading = false, disabled, style, ...props }, ref) => {
    const sizeClasses = {
      sm: 'px-4 py-2.5 text-caption gap-1.5',
      md: 'px-5 py-3 text-body-sm gap-2',
      lg: 'px-6 py-4 text-body gap-2.5',
    };

    const variantClasses = {
      primary: 'btn-primary',
      secondary: 'btn-secondary',
      ghost: 'btn-ghost',
      outline: 'btn-outline',
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buttonProps: any = {
      ref,
      className: cn(
        'btn inline-flex items-center justify-center font-medium',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className
      ),
      disabled: disabled || loading,
      style,
      whileTap: { scale: loading || disabled ? 1 : 0.97 },
      ...props,
    };

    return (
      <motion.button {...buttonProps}>
        {loading && (
          <motion.span
            initial={false}
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="flex items-center justify-center"
            style={{ width: '1em', height: '1em' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="w-5 h-5">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="1">
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 12 12"
                  to="360 12 12"
                  dur="1s"
                  repeatCount="indefinite"
                />
              </path>
            </svg>
          </motion.span>
        )}
        {!loading && children}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';

/* ===== FAB ===== */
interface FABProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  position?: 'bottom-right' | 'bottom-center';
}

export const FAB = forwardRef<HTMLButtonElement, FABProps>(
  ({ children, className, position = 'bottom-right', style, ...props }, ref) => {
    const positionClasses = {
      'bottom-right': 'fixed bottom-24 right-4 z-[100]',
      'bottom-center': 'fixed bottom-24 left-1/2 -translate-x-1/2 z-[100]',
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fabProps: any = {
      ref,
      className: cn(
        'btn-fab flex-center',
        positionClasses[position],
        className
      ),
      style,
      whileHover: { scale: 1.05, boxShadow: '0 16px 48px rgba(214, 51, 108, 0.3)' },
      whileTap: { scale: 0.95 },
      ...props,
    };

    return <motion.button {...fabProps}>{children}</motion.button>;
  }
);

FAB.displayName = 'FAB';

/* ===== Tab Bar ===== */
interface TabBarProps {
  tabs: { id: string; label: string; icon: React.ReactNode; href?: string; onClick?: () => void }[];
  activeTab: string;
  onTabChange: (id: string) => void;
  className?: string;
}

export const TabBar = ({ tabs, activeTab, onTabChange, className }: TabBarProps) => {
  return (
    <motion.nav
      className={cn('tab-bar', className)}
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      style={{ transformOrigin: 'center bottom' }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const spring = { type: 'spring', stiffness: 240, damping: 26, mass: 0.9 } as const;
        const pillSpring = { type: 'spring', stiffness: 210, damping: 24, mass: 1.1 } as const;
        return (
          <motion.button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn('tab-item', isActive && 'active')}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            aria-current={isActive ? 'page' : undefined}
          >
            {isActive && (
              <motion.span
                layoutId="tab-bar-active-pill"
                className="tab-active-pill"
                transition={pillSpring}
                style={{ transformOrigin: 'center' }}
              />
            )}
            <motion.div
              animate={isActive ? { scale: [1, 1.35, 1.15], y: -2 } : { scale: 1, y: 0 }}
              transition={spring}
              className="tab-icon relative z-10"
            >
              {tab.icon}
            </motion.div>
            <span className="tab-label relative z-10">
              {tab.label}
            </span>
          </motion.button>
        );
      })}
    </motion.nav>
  );
};

/* ===== Modal Backdrop ===== */
interface ModalBackdropProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export const ModalBackdrop = ({ isOpen, onClose, children, className }: ModalBackdropProps) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[200] bg-black/45 backdrop-blur-sm overflow-y-auto overscroll-contain"
          onClick={onClose}
        >
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 72, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 48, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26, mass: 0.9 }}
            className={cn(
              'flex items-end sm:items-center justify-center min-h-[100dvh]',
              'p-3 sm:p-4 pb-[max(1rem,env(safe-area-inset-bottom))]',
              className
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* ===== Toast ===== */
interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
}

export const Toast = ({ message, type = 'info', onClose }: ToastProps) => {
  const typeStyles = {
    success: 'bg-success-light border-success text-success',
    error: 'bg-error-light border-error text-error',
    info: 'bg-secondary-light border-secondary text-secondary',
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 100, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'fixed bottom-28 left-4 right-4 max-w-md z-[300]',
        'glass-strong p-4 rounded-xl border',
        'flex items-start gap-3',
        typeStyles[type]
      )}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0, rotate: -90 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 20 }}
        className="flex-shrink-0 w-8 h-8 flex-center rounded-lg"
        style={{ background: 'currentColor' }}
      >
        {type === 'success' && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        )}
        {type === 'error' && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        )}
        {type === 'info' && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        )}
      </motion.div>
      <p className="flex-1 text-body-sm font-medium leading-snug">{message}</p>
      <motion.button
        whileTap={{ scale: 0.85 }}
        onClick={onClose}
        className="flex-shrink-0 p-1.5 rounded-lg hover:bg-text/10 transition-colors text-current opacity-70"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </motion.button>
    </motion.div>
  );
};

export const GlassTabBar = TabBar;