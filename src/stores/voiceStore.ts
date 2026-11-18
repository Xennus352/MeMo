import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * AI Voice (Shoon) — spoken reminders, spoken and notified in Burmese.
 * Deliberately no voice options: it is the Nara Mini v1 Shoon voice, run
 * locally by scripts/nara_tts_server.py, or it is off.
 */
interface VoiceState {
  /** Master switch — on by default now that the Burmese voice ships inside the app */
  enabled: boolean;
  /** Base URL of the local Nara TTS service (scripts/nara_tts_server.py) */
  naraUrl: string;
  setEnabled: (enabled: boolean) => void;
  setNaraUrl: (naraUrl: string) => void;
}

export const useVoiceStore = create<VoiceState>()(
  persist(
    (set) => ({
      enabled: true,
      naraUrl: 'http://127.0.0.1:8899',
      setEnabled: (enabled) => set({ enabled }),
      setNaraUrl: (naraUrl) => set({ naraUrl: naraUrl.trim() }),
    }),
    {
      name: 'memo-voice-store',
      // v2: the voice pack is bundled, so existing installs that never found
      // the toggle should start hearing reminders too. Settings can turn it off.
      version: 2,
      migrate: (persisted) => ({ ...(persisted as object), enabled: true }) as unknown as VoiceState,
    }
  )
);
