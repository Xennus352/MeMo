import { create } from 'zustand';
import { Anniversary, Milestone } from '@/types';

/**
 * When the partner deletes a shared row, the sync merge physically removes it
 * from this device's DB — but the user should still see it dissolve the same
 * way a local delete does. These "ghost" rows are kept in memory only; the
 * list is deduped by id, rows are rendered alongside live ones while the
 * exit animation plays, then dropped.
 */
interface DeletionState {
  ghostMilestones: Milestone[];
  ghostAnniversaries: Anniversary[];
  addGhostMilestones: (rows: Milestone[]) => void;
  addGhostAnniversaries: (rows: Anniversary[]) => void;
  dismissGhostMilestone: (id: string) => void;
  dismissGhostAnniversary: (id: string) => void;
}

const mergeById = <T extends { id: string }>(base: T[], rows: T[]): T[] => {
  const ids = new Set(base.map(r => r.id));
  return [...base, ...rows.filter(r => !ids.has(r.id))];
};

export const useDeletionStore = create<DeletionState>((set) => ({
  ghostMilestones: [],
  ghostAnniversaries: [],
  addGhostMilestones: rows =>
    set(state => ({ ghostMilestones: mergeById(state.ghostMilestones, rows) })),
  addGhostAnniversaries: rows =>
    set(state => ({ ghostAnniversaries: mergeById(state.ghostAnniversaries, rows) })),
  dismissGhostMilestone: id =>
    set(state => ({ ghostMilestones: state.ghostMilestones.filter(r => r.id !== id) })),
  dismissGhostAnniversary: id =>
    set(state => ({ ghostAnniversaries: state.ghostAnniversaries.filter(r => r.id !== id) })),
}));
