import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const GLYPHS = ['💕', '💗', '💖', '✨', '💓', '💞', '💘', '⭐', '💝', '🌸'];

interface ParticleBurstProps {
  /** Set true to release the particles */
  fire: boolean;
}

/**
 * A heart-and-sparkle dissolve: glyphs burst out from the center of the host
 * element and fade away, leaving the element itself to slide/fade after them.
 */
export const ParticleBurst: React.FC<ParticleBurstProps> = ({ fire }) => {
  const particles = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        angle: (i / 18) * Math.PI * 2 + (Math.random() - 0.5) * 0.9,
        distance: 55 + Math.random() * 95,
        delay: Math.random() * 0.15,
        size: 11 + Math.random() * 15,
        glyph: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
        rotate: (Math.random() - 0.5) * 220,
      })),
    []
  );

  return (
    <AnimatePresence>
      {fire && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center overflow-visible">
          {particles.map(p => (
            <motion.span
              key={p.id}
              className="absolute select-none"
              style={{ fontSize: p.size }}
              initial={{ opacity: 0, x: 0, y: 0, scale: 0.2, rotate: 0 }}
              animate={{
                opacity: [0, 1, 1, 0],
                x: Math.cos(p.angle) * p.distance,
                y: Math.sin(p.angle) * p.distance - 55,
                scale: [0.2, 1.25, 1, 0.15],
                rotate: p.rotate,
              }}
              transition={{ duration: 1.15 + Math.random() * 0.35, delay: p.delay, ease: 'easeOut' }}
            >
              {p.glyph}
            </motion.span>
          ))}
        </div>
      )}
    </AnimatePresence>
  );
};

export default ParticleBurst;
