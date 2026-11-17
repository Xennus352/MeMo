import { create } from 'zustand';
import { CouplePair } from '@/types';
import { couplePair, enterPairingCode, generatePairingCode, sharePairingCode, copyToClipboard } from '@/lib/tauri';
import { useUserStore } from './userStore';
import { usePresenceStore } from './presenceStore';

interface PairingState {
  pair: CouplePair | null;
  loading: boolean;
  error: string | null;
  generatedCode: string | null;
  
  loadPair: () => Promise<void>;
  generateCode: (role: 'boy' | 'girl', name: string) => Promise<string>;
  enterCode: (code: string) => Promise<{ success: boolean; reason?: string; anniversaryDate?: string; pairedRole?: 'boy' | 'girl' }>;
  shareCode: (code: string) => Promise<void>;
  copyCode: (code: string) => Promise<void>;
  clearError: () => void;
}

export const PAIRING_ERROR_MESSAGES: Record<string, string> = {
  not_found: "That code doesn't exist — double-check it.",
  expired: 'That code expired. Ask your partner to generate a fresh one.',
  used: 'That code was already used.',
  same_role: 'Codes only work across roles — one girl and one boy.',
};

export const usePairingStore = create<PairingState>((set, get) => ({
  pair: null,
  loading: false,
  error: null,
  generatedCode: null,

  loadPair: async () => {
    try {
      const pair = await couplePair.get();
      set({ pair });
      if (pair) {
        // Learn the partner's name from the registry pair record when it knows it,
        // so row labels are correct even before the first heartbeat / while offline
        try {
          const deviceId = useUserStore.getState().deviceId;
          const res = await fetch(`/api/pairing/pair?deviceId=${encodeURIComponent(deviceId)}`);
          if (res.ok) {
            const data = (await res.json()) as { success?: boolean; pair?: { names?: Record<string, string | null> } };
            const names = data?.pair?.names;
            if (names && typeof names === 'object') {
              const other = pair.boyDeviceId === deviceId ? pair.girlDeviceId : pair.boyDeviceId;
              const otherName = names[other];
              if (otherName) usePresenceStore.getState().setPartnerOnline(null, otherName);
            }
          }
        } catch {
          // Registry unreachable (native / closed) — names arrive via presence polling
        }
      }
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
        await useUserStore.getState().setPairedDevice(result.pairedDeviceId || '');
        await get().loadPair();
        set({ loading: false });
      } else {
        set({
          error: PAIRING_ERROR_MESSAGES[result.reason ?? ''] ?? 'Invalid or expired code. Please check and try again.',
          loading: false,
        });
      }

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