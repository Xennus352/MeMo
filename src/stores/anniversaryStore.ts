import { create } from 'zustand';
import { Anniversary } from '@/types';
import { anniversaries } from '@/lib/tauri';

interface AnniversaryState {
  items: Anniversary[];
  primary: Anniversary | null;
  loading: boolean;
  
  loadAll: () => Promise<void>;
  add: (anniversary: Omit<Anniversary, 'id' | 'createdAt'>) => Promise<string>;
  update: (id: string, updates: Partial<Omit<Anniversary, 'id' | 'createdAt'>>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useAnniversaryStore = create<AnniversaryState>((set, get) => ({
  items: [],
  primary: null,
  loading: false,

  loadAll: async () => {
    set({ loading: true });
    try {
      const [items, primary] = await Promise.all([
        anniversaries.getAll(),
        anniversaries.getPrimary(),
      ]);
      set({ items, primary });
    } catch (error) {
      console.error('Failed to load anniversaries:', error);
    } finally {
      set({ loading: false });
    }
  },

  add: async (anniversary) => {
    set({ loading: true });
    try {
      const id = await anniversaries.create(anniversary);
      await get().loadAll();
      return id;
    } catch (error) {
      console.error('Failed to add anniversary:', error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  update: async (id, updates) => {
    set({ loading: true });
    try {
      await anniversaries.update(id, updates);
      await get().loadAll();
    } catch (error) {
      console.error('Failed to update anniversary:', error);
    } finally {
      set({ loading: false });
    }
  },

  remove: async (id) => {
    set({ loading: true });
    try {
      await anniversaries.delete(id);
      await get().loadAll();
    } catch (error) {
      console.error('Failed to remove anniversary:', error);
    } finally {
      set({ loading: false });
    }
  },
}));