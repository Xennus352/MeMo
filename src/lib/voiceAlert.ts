/**
 * Spoken reminders — MeMo tells you about the notification instead of only
 * buzzing it. One voice only: the local Nara Mini v1 Shoon voice (Burmese &
 * English) via scripts/nara_tts_server.py. No pickers, no alternates.
 *
 * Reminder texts are Burmese throughout. If the local service is unreachable
 * we fall back to whatever the browser's speech synthesis has for Myanmar
 * (or stay silent — the notification itself always lands normally).
 */

import { useVoiceStore, useUserStore, useIslandStore } from '@/stores';
import { isTauri } from '@tauri-apps/api/core';
import { invoke } from '@tauri-apps/api/core';

export const speakMyanmarSystem = (text: string): Promise<boolean> =>
  new Promise(resolve => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve(false);
      return;
    }
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'my-MM';
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;

      const voices = speechSynthesis.getVoices();
      const myanmar = voices.find(v => v.lang.replace('_', '-').toLowerCase().startsWith('my'));
      if (myanmar) utterance.voice = myanmar;

      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };
      utterance.onend = () => finish(true);
      utterance.onerror = () => finish(false);
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    } catch {
      resolve(false);
    }
  });

const wavCache = new Map<string, Blob>();

/** Wall-clock watchdog so the island (and the audio pipeline) can never hang on an empty voice list */
const withTimeout = <T>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
  Promise.race([p, new Promise<T>(resolve => { window.setTimeout(() => resolve(fallback), ms); })]);

const fetchNaraWav = async (text: string): Promise<Blob> => {
  const cached = wavCache.get(text);
  if (cached) return cached;

  const { naraUrl } = useVoiceStore.getState();
  const res = await fetch(`${naraUrl.replace(/\/+$/, '')}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Nara TTS returned ${res.status}`);
  const blob = await res.blob();
  wavCache.set(text, blob);
  if (wavCache.size > 32) {
    const oldest = wavCache.keys().next().value as string | undefined;
    if (oldest !== undefined) wavCache.delete(oldest);
  }
  return blob;
};

let audio: HTMLAudioElement | null = null;

const playBlob = (blob: Blob): Promise<boolean> =>
  new Promise(resolve => {
    let url = '';
    try {
      url = URL.createObjectURL(blob);
      audio?.pause();
      audio = new Audio(url);
      const finish = (ok: boolean) => {
        URL.revokeObjectURL(url);
        resolve(ok);
      };
      audio.onended = () => finish(true);
      audio.onerror = () => finish(false);
      void audio.play().catch(() => finish(false));
    } catch {
      if (url) URL.revokeObjectURL(url);
      resolve(false);
    }
  });

export type SpokenResult = 'nara' | 'system' | 'none';

/**
 * Speak a reminder aloud in Burmese (Nara Mini v1 · Shoon).
 * Returns which backend answered (or 'none') for UI feedback.
 */
export const speakReminder = async (text: string): Promise<SpokenResult> => {
  const { enabled } = useVoiceStore.getState();
  if (!enabled) return 'none';

  // The island lights up for as long as Shoon speaks
  useIslandStore.getState().startSpeaking(text);
  const speak = async (): Promise<SpokenResult> => {
    try {
      const ok = await playBlob(await fetchNaraWav(text));
      if (ok) return 'nara';
    } catch (error) {
      console.warn('Nara TTS unreachable — trying the device voice:', error);
    }
    // On Android the webview has no Myanmar voice — hand it to the device's own TTS instead
    if (await isTauri()) {
      try {
        await invoke('plugin:shoon-alarm|speak_text', { text });
        return 'system';
      } catch (nativeError) {
        console.warn('Native TTS could not speak:', nativeError);
      }
      return 'none';
    }
    // Web / desktop — degrade to the system voice if it can speak Myanmar
    return (await speakMyanmarSystem(text)) ? 'system' : 'none';
  };
  try {
    // Watchdog — an empty voice list must never pin the island open
    return await withTimeout(speak(), 30_000, 'none');
  } finally {
    useIslandStore.getState().stopSpeaking();
  }
};

/** Stop any reminder playback we can reach (Shoon WAV and speechSynthesis) and tear down the speaking island.
 *  Note: on native, the Android device speaks through its own TTS and we can't cut it off remotely —
 *  the device's utterance finishes on its own (it's a few seconds). */
export const stopReminderPlayback = (): void => {
  try {
    audio?.pause();
  } catch {
    // nothing playing
  }
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  } catch {
    // nothing to cancel
  }
  useIslandStore.getState().clearIsland();
};

/** Test phrase used by the Settings test button — greets the user by their profile name when set */
export const speakTest = async (): Promise<SpokenResult> => {

  const { profile } = useUserStore.getState();
  const name = profile?.name?.trim();
  const greeting = name ? `မင်္ဂလာပါ ${name}။` : 'မင်္ဂလာပါ။';
  return speakReminder(`${greeting} သင်၏ အသိပေးချက်များကို ဤအသံဖြင့် ကြားရမှာဖြစ်ပါတယ်။`);
};
