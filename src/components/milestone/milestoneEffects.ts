import { useEffect, useRef, useState } from 'react';

/**
 * Bump a counter whenever the row's updatedAt changes — the same signal the
 * couple sync bumps when the partner edits the row. Used to retrigger the
 * edit flash on both devices.
 */
export function useMilestoneFlash(updatedAt?: string): number {
  const [flash, setFlash] = useState(0);
  const last = useRef<string | undefined>(updatedAt);
  useEffect(() => {
    if (updatedAt && updatedAt !== last.current) {
      last.current = updatedAt;
      setFlash(f => f + 1);
    }
  }, [updatedAt]);
  return flash;
}

/** True when the row was created within the last 8 seconds — the mount of
    such a card plays the full "born" flourish. */
export function isJustCreated(createdAt?: string): boolean {
  if (!createdAt) return false;
  const t = Date.parse(createdAt);
  return Number.isFinite(t) && Date.now() - t < 8000;
}

/** Sheen sweep shared by both card styles. */
export const milestoneSheetStyle = {
  background: 'linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.78) 45%, rgba(255,255,255,0.78) 55%, transparent 100%)',
};
