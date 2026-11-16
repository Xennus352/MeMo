import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react';

interface ScrollShrinkProps {
  children: React.ReactNode;
  className?: string;
  /** Position in the list; the first three cards always render at full size
      so at least three memories are visible before the scroll effect starts */
  index?: number;
}

/**
 * Premium scroll-linked animation for milestone timeline cards:
 * as a card travels from the top to the bottom of the viewport it smoothly
 * shrinks (scale 1 → 0.75), drifts slightly downward, and fades out. The
 * values are driven straight from scroll progress - no React re-renders while
 * scrolling, and scrolling back up reverses the effect naturally.
 */
export const ScrollShrink: React.FC<ScrollShrinkProps> = ({ children, className, index }) => {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  // At least the first three cards are pinned to full size; the scroll effect
  // only applies to later cards as they travel toward the bottom edge.
  const pinned = index !== undefined && index < 3;

  const { scrollYProgress } = useScroll({
    target: ref,
    // 0 when the card's top touches the viewport's top edge,
    // 1 when the card's bottom touches the viewport's bottom edge
    offset: ['start 0', 'end 1'],
  });

  // Keep cards fully present for the upper part of their journey, then ease
  // into the shrink + fade toward the bottom edge.
  const scale = useTransform(scrollYProgress, [0, 0.55, 1], [1, 0.96, 0.75]);
  const opacity = useTransform(scrollYProgress, [0, 0.5, 0.85, 1], [1, 1, 0.25, 0]);
  const y = useTransform(scrollYProgress, [0, 0.55, 1], [0, 10, 48]);

  if (reduceMotion || pinned) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    );
  }

  return (
    <motion.div ref={ref} style={{ scale, opacity, y }} className={className}>
      {children}
    </motion.div>
  );
};
