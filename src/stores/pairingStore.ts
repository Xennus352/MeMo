import { create } from 'zustand';
import { CouplePair } from '@/types';
import { couplePair, enterPairingCode, generatePairingCode, sharePairingCode, copyToClipboard } from '@/lib/tauri';
import { useUserStore } from './userStore';

interface PairingState {
  pair: CouplePair | null;
  loading: boolean;
  error: string | null;
  generatedCode: string | null;
  
  loadPair: () => Promise<void>;
  generateCode: (role: 'boy' | 'girl', name: string) => Promise<string>;
  enterCode: (code: string) => Promise<{ success: boolean; anniversaryDate?: string; pairedRole?: 'boy' | 'girl' }>;
  shareCode: (code: string) => Promise<void>;
  copyCode: (code: string) => Promise<void>;
  clearError: () => void;
}

export const usePairingStore = create<PairingState>((set, get) => ({
  pair: null,
  loading: false,
  error: null,
  generatedCode: null,

  loadPair: async () => {
    try {
      const pair = await couplePair.get();
      set({ pair });
    } catch (error) {
      console.error('Failed to load couple pair:', error);
    }
  },

  generateCode: async (role, name) => {
    set({ loading: true, error: null });
    try {
      const { deviceId } = useUserStore.getState();
      const code = await generatePairingCode(role, name, deviceId);
      set({ generatedCode: code, loading: false });
      return code;
    } catch (error) {
      set({ error: 'Failed to generate code', loading: false });
      throw error;
    }
  },

  enterCode: async (code) => {
    set({ loading: true, error: null });
    try {
      const { deviceId, profile } = useUserStore.getState();
      const currentRole = profile?.role || 'girl';
      const result = await enterPairingCode(code, deviceId, currentRole);
      
      if (result.success) {
        await useUserStore.getState().setPairedDevice(result.anniversaryDate || '');
        await get().loadPair();
      } else {
        set({ error: 'Invalid or expired code' });
      }
      
      set({ loading: false });
      return result;
    } catch (error) {
      set({ error: 'Failed to enter code', loading: false });
      return { success: false };
    }
  },

  shareCode: async (code) => {
    try {
      await sharePairingCode(code);
    } catch (error) {
      console.error('Failed to share code:', error);
    }
  },

  copyCode: async (code) => {
    try {
      await copyToClipboard(code);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  },

  clearError: () => set({ error: null }),
}));