import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * AI Voice (Shoon) — spoken reminders, spoken and notified in Burmese.
 * Deliberately no voice options: it is the Nara Mini v1 Shoon voice, run
 * locally by scripts/nara_tts_server.py, or it is off.
 */
interface VoiceState {
  /** Master switch — AI Voice is OFF until the user opts in */
  enabled: boolean;
  /** Base URL of the local Nara TTS service (scripts/nara_tts_server.py) */
  naraUrl: string;
  setEnabled: (enabled: boolean) => void;
  setNaraUrl: (naraUrl: string) => void;
}

export const useVoiceStore = create<VoiceState>()(
  persist(
    (set) => ({
      enabled: false,
      naraUrl: 'http://127.0.0.1:8899',
      setEnabled: (enabled) => set({ enabled }),
      setNaraUrl: (naraUrl) => set({ naraUrl: naraUrl.trim() }),
    }),
    { name: 'memo-voice-store' }
  )
);
