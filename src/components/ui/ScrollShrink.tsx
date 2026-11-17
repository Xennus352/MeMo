import React, { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react';
import { cn } from '@/utils/helpers';

interface ScrollShrinkProps {
  children: React.ReactNode;
  className?: string;
  /** Position in the list; the first three cards always render at full size
      so at least three memories are visible before the scroll effect starts */
  index?: number;
}

/** Phone-sized viewports use a compositor-driven CSS scroll animation instead
 *  of Motion's per-frame JS updates; older WebViews simply render statically. */
const PHONE_QUERY = '(max-width: 820px)';

const useIsPhone = (): boolean => {
  const [phone, setPhone] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(PHONE_QUERY).matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY);
    const onChange = () => setPhone(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return phone;
};

const supportsScrollTimeline = (): boolean =>
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  CSS.supports('animation-timeline: view()');

const ScrollShrinkAnimated: React.FC<ScrollShrinkProps> = ({ children, className }) => {
  const ref = useRef<HTMLDivElement>(null);

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

  return (
    <motion.div ref={ref} style={{ scale, opacity, y }} className={className}>
      {children}
    </motion.div>
  );
};

/**
 * Premium scroll-linked animation for milestone timeline cards:
 * as a card travels up the viewport it settles in smoothly, with a soft
 * shrink/fade where it enters from the bottom edge. React re-renders never
 * happen while scrolling.
 *
 * Phones run the same look as a CSS scroll-timeline animation, which the
 * browser drives on the compositor: no JS work and no per-card scroll
 * listeners. WebViews without scroll-timeline support render cards statically
 * (still perfectly smooth).
 */
export const ScrollShrink: React.FC<ScrollShrinkProps> = ({ children, className, index }) => {
  const reduceMotion = useReducedMotion();
  const phone = useIsPhone();
  const [cssTimeline] = useState(supportsScrollTimeline);
  // At least the first three cards are pinned to full size; the scroll effect
  // only applies to later cards as they travel toward the bottom edge.
  const pinned = index !== undefined && index < 3;

  if (reduceMotion || pinned) {
    return <div className={className}>{children}</div>;
  }

  if (phone) {
    return cssTimeline ? (
      <div className={cn('scroll-shrink', className)}>{children}</div>
    ) : (
      <div className={className}>{children}</div>
    );
  }

  return <ScrollShrinkAnimated className={className}>{children}</ScrollShrinkAnimated>;
};
