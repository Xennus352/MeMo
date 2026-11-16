import { create } from 'zustand';
import { PeriodEntry, PredictionResult, DateKey } from '@/types';
import { periodEntries } from '@/lib/tauri';
import { calculatePredictions } from '@/utils/helpers';
import { useUserStore } from './userStore';

interface PeriodState {
  entries: PeriodEntry[];
  predictions: PredictionResult | null;
  loading: boolean;
  
  loadEntries: (startDate?: DateKey, endDate?: DateKey) => Promise<void>;
  addEntry: (entry: Omit<PeriodEntry, 'id' | 'synced' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  removeEntry: (date: DateKey) => Promise<void>;
  togglePeriodDay: (date: DateKey, isPeriodDay: boolean, flow?: 'light' | 'medium' | 'heavy', symptoms?: string[], notes?: string) => Promise<void>;
  getEntry: (date: DateKey) => PeriodEntry | undefined;
  refreshPredictions: () => void;
}

export const usePeriodStore = create<PeriodState>((set, get) => ({
  entries: [],
  predictions: null,
  loading: false,

  loadEntries: async (startDate, endDate) => {
    set({ loading: true });
    try {
      const entries = await periodEntries.getAll(startDate, endDate);
      set({ entries });
      get().refreshPredictions();
    } catch (error) {
      console.error('Failed to load period entries:', error);
    } finally {
      set({ loading: false });
    }
  },

  addEntry: async (entry) => {
    set({ loading: true });
    try {
      const id = await periodEntries.upsert(entry);
      const newEntry = await periodEntries.get(entry.date);
      if (newEntry) {
        set({ entries: [newEntry, ...get().entries.filter(e => e.date !== entry.date)] });
        get().refreshPredictions();
      }
      return id;
    } catch (error) {
      console.error('Failed to add period entry:', error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  removeEntry: async (date) => {
    set({ loading: true });
    try {
      await periodEntries.delete(date);
      set({ entries: get().entries.filter(e => e.date !== date) });
      get().refreshPredictions();
    } catch (error) {
      console.error('Failed to remove period entry:', error);
    } finally {
      set({ loading: false });
    }
  },

  togglePeriodDay: async (date, isPeriodDay, flow, symptoms, notes) => {
    const existing = get().entries.find(e => e.date === date) || await periodEntries.get(date);
    const { profile } = useUserStore.getState();
    const createdBy = profile?.role || 'girl';

    if (existing) {
      if (!isPeriodDay) {
        await get().removeEntry(date);
      } else {
        await get().addEntry({ ...existing, isPeriodDay, flow, symptoms, notes });
      }
    } else if (isPeriodDay) {
      await get().addEntry({ date, isPeriodDay: true, flow, symptoms, notes, createdBy });
    }
  },

  getEntry: (date) => {
    return get().entries.find(e => e.date === date);
  },

  refreshPredictions: () => {
    const { entries } = get();
    const userCycleSettings = useUserStore.getState().cycleSettings;
    const predictions = calculatePredictions(userCycleSettings, entries);
    set({ predictions });
  },
}));