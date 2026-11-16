import { create } from 'zustand';
import { Milestone } from '@/types';
import { milestones } from '@/lib/tauri';
import { useUserStore } from './userStore';

const PAGE_SIZE = 20;

export type MilestoneDateType = 'milestone' | 'created';
export type MilestoneTiming = 'all' | 'upcoming' | 'past';

export interface MilestoneFilters {
  /** Matches against both title and note, server-side / in the fallback */
  search: string;
  /** Which date column the from/to range applies to */
  dateType: MilestoneDateType;
  from: string | null;
  to: string | null;
  timing: MilestoneTiming;
}

const EMPTY_FILTERS: MilestoneFilters = {
  search: '',
  dateType: 'milestone',
  from: null,
  to: null,
  timing: 'all',
};

interface MilestoneState {
  items: Milestone[];
  upcoming: Milestone[];
  filters: MilestoneFilters;
  total: number | null;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;

  loadAll: () => Promise<void>;
  loadUpcoming: (limit?: number) => Promise<void>;
  /** Replace the filter set and reload page one */
  setFilters: (filters: Partial<MilestoneFilters>) => void;
  clearFilters: () => void;
  loadMore: () => Promise<void>;

  add: (milestone: Omit<Milestone, 'id' | 'synced' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  update: (id: string, updates: Partial<Omit<Milestone, 'id' | 'createdAt'>>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useMilestoneStore = create<MilestoneState>((set, get) => ({
  items: [],
  upcoming: [],
  filters: { ...EMPTY_FILTERS },
  total: null,
  hasMore: false,
  loading: false,
  loadingMore: false,

  loadAll: async () => {
    const { filters } = get();
    set({ loading: true });
    try {
      const query = {
        offset: 0,
        limit: PAGE_SIZE,
        search: filters.search || undefined,
        dateType: filters.dateType,
        from: filters.from || undefined,
        to: filters.to || undefined,
        timing: filters.timing,
      };
      const [items, total] = await Promise.all([
        milestones.getPage(query),
        milestones.count(query),
      ]);
      set({ items, total, hasMore: items.length === PAGE_SIZE, loading: false });
    } catch (error) {
      console.error('Failed to load milestones:', error);
      set({ items: [], total: 0, hasMore: false, loading: false });
    }
  },

  loadUpcoming: async (limit = 5) => {
    try {
      const upcoming = await milestones.getUpcoming(limit);
      set({ upcoming });
    } catch (error) {
      console.error('Failed to load upcoming milestones:', error);
    }
  },

  setFilters: (changes: Partial<MilestoneFilters>) => {
    set(state => ({ filters: { ...state.filters, ...changes } }));
    get().loadAll();
  },

  clearFilters: () => {
    set({ filters: { ...EMPTY_FILTERS } });
    get().loadAll();
  },

  loadMore: async () => {
    const { items, hasMore, loadingMore, filters } = get();
    if (!hasMore || loadingMore) return;

    set({ loadingMore: true });
    try {
      const page = await milestones.getPage({
        offset: items.length,
        limit: PAGE_SIZE,
        search: filters.search || undefined,
        dateType: filters.dateType,
        from: filters.from || undefined,
        to: filters.to || undefined,
        timing: filters.timing,
      });
      set({
        items: [...get().items, ...page],
        hasMore: page.length === PAGE_SIZE,
        loadingMore: false,
      });
    } catch (error) {
      console.error('Failed to load more milestones:', error);
      set({ loadingMore: false });
    }
  },

  add: async (milestone) => {
    set({ loading: true });
    try {
      const { profile } = useUserStore.getState();
      const createdBy = profile?.role || 'girl';
      const id = await milestones.create({ ...milestone, createdBy });
      await get().loadAll();
      await get().loadUpcoming();
      return id;
    } catch (error) {
      console.error('Failed to add milestone:', error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  update: async (id, updates) => {
    set({ loading: true });
    try {
      await milestones.update(id, updates);
      await get().loadAll();
      await get().loadUpcoming();
    } catch (error) {
      console.error('Failed to update milestone:', error);
    } finally {
      set({ loading: false });
    }
  },

  remove: async (id) => {
    set({ loading: true });
    try {
      await milestones.delete(id);
      await get().loadAll();
      await get().loadUpcoming();
    } catch (error) {
      console.error('Failed to remove milestone:', error);
    } finally {
      set({ loading: false });
    }
  },
}));
