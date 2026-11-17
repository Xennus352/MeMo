import React from 'react';
import { cn } from '@/utils/helpers';
import { usePresenceStore } from '@/stores';

/**
 * Live partner-presence pill. Heartbeats go to the shared registry every 5s
 * while paired, so this flips to "offline" ~30s after the partner's app stops.
 * Shows the user's own offline state when their device drops the connection.
 */
export const PresenceChip: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const partnerOnline = usePresenceStore(state => state.partnerOnline);
  const selfOnline = usePresenceStore(state => state.selfOnline);

  let dot: React.ReactNode;
  let label: string;
  let tone: 'online' | 'offline' | 'self-offline' | 'unknown';

  if (!selfOnline) {
    tone = 'self-offline';
    label = 'You\'re offline — changes stay on this device';
    dot = <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />;
  } else if (partnerOnline === true) {
    tone = 'online';
    label = 'Partner online';
    dot = (
      <span className="relative flex w-2 h-2 flex-shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60" />
        <span className="relative inline-flex rounded-full w-2 h-2 bg-success" />
      </span>
    );
  } else if (partnerOnline === false) {
    tone = 'offline';
    label = 'Partner offline — they\'ll catch up when they\'re back';
    dot = <span className="w-2 h-2 rounded-full bg-text-muted flex-shrink-0" />;
  } else {
    tone = 'unknown';
    label = 'Partner…';
    dot = <span className="w-2 h-2 rounded-full bg-text-muted/60 flex-shrink-0 animate-pulse" />;
  }

  return (
    <span
      role="status"
      data-tone={tone}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-border bg-input align-middle',
        'text-text-muted font-medium',
        compact
          ? 'px-2.5 py-1 text-[11px] max-w-full'
          : 'px-3.5 py-1.5 text-caption max-w-full whitespace-normal text-left leading-snug'
      )}
    >
      {dot}
      <span className={cn('min-w-0', compact ? 'truncate' : '')}>{label}</span>
    </span>
  );
};
