import React from 'react';
import { motion } from 'motion/react';

interface PageTransitionProps {
  children: React.ReactNode;
  /** 1 = navigated forward, -1 = navigated back */
  direction: number;
}

/**
 * Wraps the active route. Registered directly with AnimatePresence so the
 * exiting page stays mounted (in absolute position) while the next page slides
 * in - the document never disappears mid-transition. AnimatePresence's
 * popLayout measures exiting children through a ref, so this must forward it.
 */
const variants = {
  initial: (direction: number) => ({
    opacity: 0,
    x: 44 * direction,
    zIndex: 2,
  }),
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.26, ease: [0.16, 1, 0.3, 1] as const },
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: -28 * direction,
    zIndex: 1,
    transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

export const PageTransition = React.forwardRef<HTMLDivElement, PageTransitionProps>(
  ({ children, direction }, ref) => (
    <motion.div
      ref={ref}
      custom={direction}
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="min-h-screen"
    >
      {children}
    </motion.div>
  )
);

PageTransition.displayName = 'PageTransition';
