import { create } from 'zustand';
import { Notice } from '@/types';
import { notices } from '@/lib/tauri';
import { useUserStore } from './userStore';

interface NoticeState {
  items: Notice[];
  loading: boolean;

  loadAll: () => Promise<void>;
  /** Pin a notice for the partner. repeatMinutes 0 = one-time at remindAt. */
  add: (input: { message: string; remindAt: string; repeatMinutes: number }) => Promise<string>;
  /** Stop a repeat notice (either partner can), or acknowledge a one-time one */
  stop: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useNoticeStore = create<NoticeState>((set, get) => ({
  items: [],
  loading: false,

  loadAll: async () => {
    set({ loading: true });
    try {
      const items = await notices.getAll();
      set({ items, loading: false });
    } catch (error) {
      console.error('Failed to load notices:', error);
      set({ items: [], loading: false });
    }
  },

  add: async ({ message, remindAt, repeatMinutes }) => {
    const trimmed = message.trim();
    if (!trimmed) throw new Error('The notice is empty');
    const parsed = Date.parse(remindAt);
    const safeRemindAt = Number.isFinite(parsed)
      ? new Date(parsed).toISOString()
      : new Date(Date.now() + 30 * 60 * 1000).toISOString();

    set({ loading: true });
    try {
      const { profile } = useUserStore.getState();
      const createdBy = profile?.role || 'girl';
      const id = await notices.create({ message: trimmed, remindAt: safeRemindAt, repeatMinutes, createdBy });
      try {
        await get().loadAll();
      } catch (reloadError) {
        // The row is saved — don't report a false failure just because the reload stumbled
        console.warn('Notice saved, but the board reload failed:', reloadError);
      }
      return id;
    } catch (error) {
      console.error('Failed to add notice:', error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  stop: async (id) => {
    try {
      await notices.setActive(id, false);
      await get().loadAll();
    } catch (error) {
      console.error('Failed to stop notice:', error);
    }
  },

  remove: async (id) => {
    set({ loading: true });
    try {
      await notices.delete(id);
      await get().loadAll();
    } catch (error) {
      console.error('Failed to remove notice:', error);
    } finally {
      set({ loading: false });
    }
  },
}));
