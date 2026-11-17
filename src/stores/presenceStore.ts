import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PresenceState {
  /** null = not yet checked (first render / no backend / unpaired) */
  partnerOnline: boolean | null;
  /** Partner's display name as learned from heartbeats / pairing — persisted so labels survive reloads */
  partnerName: string | null;
  selfOnline: boolean;
  setPartnerOnline: (partnerOnline: boolean | null, partnerName?: string | null) => void;
  setSelfOnline: (selfOnline: boolean) => void;
  /** Forget the learned partner name (e.g., after an unpair) */
  clearPartnerName: () => void;
}

/**
 * Partner presence, driven by heartbeats POSTed to the dev-server registry.
 * Heartbeats carry the sender's name so this device can label rows the
 * partner created. The name itself is persisted — once known, labels stay
 * correct even when the partner is offline.
 */
export const usePresenceStore = create<PresenceState>()(
  persist(
    (set) => ({
      partnerOnline: null,
      partnerName: null,
      selfOnline: true,
      setPartnerOnline: (partnerOnline, partnerName) =>
        set(state => ({
          partnerOnline,
          partnerName: partnerName !== undefined ? partnerName : state.partnerName,
        })),
      setSelfOnline: (selfOnline) => set({ selfOnline }),
      clearPartnerName: () => set({ partnerName: null }),
    }),
    {
      name: 'memo_presence',
      // Never persist online/offline — only the learned name
      partialize: state => ({ partnerName: state.partnerName }),
    }
  )
);
