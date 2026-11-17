/**
 * Shoon alarms — Shoon speaks scheduled reminders even on the lock screen or
 * with the app closed. At schedule time (while the app is open and the Nara
 * server is reachable) we pull the Burmese WAV for each reminder from the
 * server and stash it in the app cache. An exact AlarmManager wakes a small
 * foreground service at the scheduled instant; it plays that WAV (or falls
 * back to the device's own TTS when the file isn't there) — no network, no
 * app process required at alarm time.
 */

import { isTauri } from '@tauri-apps/api/core';
import { invoke } from '@tauri-apps/api/core';
import { appCacheDir, join } from '@tauri-apps/api/path';
import { open, mkdir, exists, BaseDirectory } from '@tauri-apps/plugin-fs';
import { fetch as nativeFetch } from '@tauri-apps/plugin-http';
import { useVoiceStore } from '@/stores';

/** Stable short hash for a reminder text (cache key) */
const hashText = (text: string): string => {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) {
    h = (h * 31 + text.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16);
};

/** Path to the cached Shoon WAV for `text`, generating it first when possible. Null when unavailable. */
export const ensureShoonWav = async (text: string): Promise<string | null> => {
  const { enabled, naraUrl } = useVoiceStore.getState();
  if (!enabled) return null;
  if (!(await isTauri())) return null; // native-only: WAV caching is for the locked-phone flow

  const id = `shoon-${hashText(text)}`;
  const fileName = `shoon/${id}.wav`;

  try {
    if (await exists(fileName, { baseDir: BaseDirectory.AppCache })) {
      return await join(await appCacheDir(), fileName);
    }
  } catch {
    // Cache read failed — regenerate below
  }

  try {
    const res = await nativeFetch(`${naraUrl.replace(/\/+$/, '')}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    await mkdir('shoon', { baseDir: BaseDirectory.AppCache, recursive: true });
    const file = await open(fileName, {
      write: true,
      create: true,
      truncate: true,
      baseDir: BaseDirectory.AppCache,
    });
    try {
      await file.write(bytes);
    } finally {
      await file.close();
    }
    return await join(await appCacheDir(), fileName);
  } catch (error) {
    console.warn('Could not pre-generate the Shoon WAV — the alarm will fall back to device TTS:', error);
    return null;
  }
};

export const scheduleShoonAlarm = async (
  title: string,
  body: string,
  text: string,
  unixMs: number,
  wavPath?: string | null,
): Promise<void> => {
  await invoke('plugin:shoon-alarm|schedule_shoon_alarm', {
    title,
    body,
    text,
    unixMs,
    wavPath: wavPath ?? undefined,
  });
};

export const cancelAllShoonAlarms = async (): Promise<void> => {
  try {
    await invoke('plugin:shoon-alarm|cancel_all_shoon_alarms');
  } catch {
    // Plugin absent (older install) — alarms simply don't exist
  }
};
