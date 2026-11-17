import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Bell, Droplet, Sparkles, Award, Heart } from 'lucide-react';
import { useIslandStore, IslandIcon } from '@/stores/islandStore';
import { stopReminderPlayback } from '@/lib/voiceAlert';
import { cn } from '@/utils/helpers';

const ICONS: Record<IslandIcon, React.ComponentType<{ className?: string }>> = {
  bell: Bell,
  droplet: Droplet,
  sparkles: Sparkles,
  award: Award,
  heart: Heart,
};

const COMPACT_W = 158;
const NOTIFICATION_MS_LABEL = 'now';

/**
 * The fully animated in-app Dynamic Island. Tapping it morphs between a
 * compact pill (icon + short label) and the expanded card with spring
 * physics; swiping up flicks it away; the notification mode drains a
 * progress hairline while it auto-dismisses. Works on Android and iOS —
 * it is drawn inside the app, not by the OS.
 */
export const DynamicIsland: React.FC = () => {
  const { current, dismissIsland } = useIslandStore();
  const [expanded, setExpanded] = useState(true);
  const [vw, setVw] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 400
  );

  // Every new event arrives expanded, like the real island alerting you
  useEffect(() => {
    setExpanded(true);
  }, [current?.id]);

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const speaking = current?.kind === 'speaking';
  const Icon = current?.icon ? ICONS[current.icon] : Bell;

  const expandedW = Math.min(vw - 20, 432);
  const width = expanded ? expandedW : COMPACT_W;

  const handleClose = () => {
    if (speaking) {
      // Actually silence the voice — not just the island
      stopReminderPlayback();
      return;
    }
    dismissIsland();
  };

  return (
    <div
      className="fixed left-0 right-0 z-[540] flex justify-center pointer-events-none"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 10px)' }}
      aria-live="polite"
    >
      <AnimatePresence mode="wait">
        {current && (
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: -64, scale: 0.5, width: COMPACT_W }}
            animate={{ opacity: 1, y: 0, scale: 1, width }}
            exit={{ opacity: 0, y: -44, scale: 0.6, width: COMPACT_W }}
            transition={{ type: 'spring', stiffness: 460, damping: 34 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.75, bottom: 0 }}
            onDragEnd={(_, info) => {
              if (info.offset.y < -34 || info.velocity.y < -380) handleClose();
            }}
            whileTap={{ scale: 0.96 }}
            onClick={() => setExpanded(v => !v)}
            aria-expanded={expanded}
            role="button"
            aria-label={expanded ? 'Collapse island' : 'Expand island'}
            className={cn(
              'island pointer-events-auto relative overflow-hidden rounded-[26px] border border-white/10 select-none cursor-pointer',
              speaking && 'island-glow'
            )}
          >
            {speaking && <span aria-hidden className="island-shine" />}

            <AnimatePresence initial={false} mode="wait">
              {expanded ? (
                speaking ? (
                  /* ========= SHOON SPEAKING · expanded ========= */
                  <motion.div
                    key="speaker-full"
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: 0.16 }}
                    className="relative flex items-center gap-3 px-4 py-3"
                  >
                    <div
                      className="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center ring-1 ring-fuchsia-300/35"
                      style={{ background: 'linear-gradient(145deg, #eb9ac0 0%, #ba80f0 100%)' }}
                    >
                      <div className="island-eq" style={{ height: 24 }} aria-hidden>
                        <span className="island-bar" />
                        <span className="island-bar" />
                        <span className="island-bar" />
                        <span className="island-bar" />
                        <span className="island-bar" />
                        <span className="island-bar" />
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="island-live w-1.5 h-1.5 rounded-full bg-fuchsia-400" aria-hidden />
                        <p className="text-[9px] font-extrabold uppercase tracking-[0.3em] text-fuchsia-300/95">Shoon is speaking</p>
                      </div>
                      <p className="mt-1 text-[12.5px] leading-snug text-white/90 line-clamp-2">{current.body}</p>
                    </div>

                    <button
                      onClick={e => { e.stopPropagation(); handleClose(); }}
                      className="flex-shrink-0 p-1.5 rounded-xl text-white/55 hover:text-white hover:bg-white/10 transition-colors"
                      aria-label="Stop and close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                ) : (
                  /* ========= NOTIFICATION · expanded ========= */
                  <motion.div
                    key="note-full"
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: 0.16 }}
                    className="relative"
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div
                        className="flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center ring-1 ring-white/20"
                        style={{ background: 'linear-gradient(145deg, rgba(235,154,192,.98) 0%, rgba(186,128,240,.98) 100%)' }}
                      >
                        <Icon className="w-5 h-5 text-white" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/60 truncate">{current.title ?? 'MeMo 💕'}</p>
                          <span className="flex-shrink-0 text-[8px] font-bold uppercase tracking-widest text-accent bg-accent/15 rounded-full px-1.5 py-0.5">{NOTIFICATION_MS_LABEL}</span>
                        </div>
                        <p className="mt-0.5 text-[12px] leading-snug text-white/92 line-clamp-2">{current.body}</p>
                      </div>

                      <button
                        onClick={e => { e.stopPropagation(); handleClose(); }}
                        className="flex-shrink-0 p-1.5 rounded-xl text-white/55 hover:text-white hover:bg-white/10 transition-colors"
                        aria-label="Dismiss notification"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="h-[2px] w-full bg-white/8 overflow-hidden">
                      <div key={current.id} className="island-progress" style={{ animationDuration: '5000ms' }} />
                    </div>
                  </motion.div>
                )
              ) : (
                speaking ? (
                  /* ========= SHOON SPEAKING · compact ========= */
                  <motion.div
                    key="speaker-mini"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.14 }}
                    className="relative flex items-center gap-2 pl-2 pr-3 h-11"
                  >
                    <div
                      className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: 'linear-gradient(145deg, #eb9ac0 0%, #ba80f0 100%)' }}
                    >
                      <div className="island-eq" style={{ height: 13, gap: 1.5 }} aria-hidden>
                        <span className="island-bar" style={{ width: 1.8 }} />
                        <span className="island-bar" style={{ width: 1.8 }} />
                        <span className="island-bar" style={{ width: 1.8 }} />
                        <span className="island-bar" style={{ width: 1.8 }} />
                      </div>
                    </div>
                    <p className="text-[9px] font-extrabold uppercase tracking-[0.22em] text-fuchsia-300/95 whitespace-nowrap">Shoon</p>
                    <span className="island-live w-1.5 h-1.5 rounded-full bg-fuchsia-400 ml-auto flex-shrink-0" aria-hidden />
                  </motion.div>
                ) : (
                  /* ========= NOTIFICATION · compact ========= */
                  <motion.div
                    key="note-mini"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.14 }}
                    className="relative flex items-center gap-2 pl-2 pr-3 h-11"
                  >
                    <div
                      className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: 'linear-gradient(145deg, rgba(235,154,192,.95) 0%, rgba(186,128,240,.95) 100%)' }}
                    >
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <p className="text-[9px] font-bold text-white/85 truncate">{current.title ?? 'MeMo 💕'}</p>
                  </motion.div>
                )
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
