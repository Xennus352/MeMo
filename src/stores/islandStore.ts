import { create } from 'zustand';

export type IslandIcon = 'bell' | 'droplet' | 'sparkles' | 'award' | 'heart';

export type IslandKind = 'notification' | 'speaking';

export interface IslandItem {
  id: number;
  kind: IslandKind;
  /** Notification title (Burmese when it is a reminder) */
  title?: string;
  /** Body — the reminder text, or the utterance Shoon is reading aloud */
  body?: string;
  icon?: IslandIcon;
}

interface IslandState {
  /** The island currently on screen, if any */
  current: IslandItem | null;
  /** Show a reminder-style notification island (auto-dismisses) */
  showNotification: (title: string, body: string, icon?: IslandIcon) => void;
  /** Show the Shoon speaking island — stays until stopSpeaking() */
  startSpeaking: (text: string) => void;
  /** Speaking ended (or failed) — drop back to whatever is queued */
  stopSpeaking: () => void;
  /** Tap on the island's close button — dismiss current, advance the queue */
  dismissIsland: () => void;
  /** Tear everything down — used when the user stops Shoon mid-sentence (speech + queue cleared) */
  clearIsland: () => void;
}

let seq = 0;
let dismissTimer: ReturnType<typeof setTimeout> | undefined;
let queue: IslandItem[] = [];

const NOTIFICATION_MS = 5000;

export const useIslandStore = create<IslandState>((set, get) => {
  const clearTimer = () => {
    if (dismissTimer) {
      clearTimeout(dismissTimer);
      dismissTimer = undefined;
    }
  };

  const present = (item: IslandItem) => {
    clearTimer();
    set({ current: item });
    if (item.kind === 'notification') {
      dismissTimer = setTimeout(() => advance(), NOTIFICATION_MS);
    }
  };

  const advance = () => {
    const next = queue.shift();
    if (next) {
      present(next);
    } else {
      clearTimer();
      set({ current: null });
    }
  };

  return {
    current: null,

    showNotification: (title, body, icon = 'bell') => {
      const item: IslandItem = { id: ++seq, kind: 'notification', title, body, icon };
      if (!get().current) {
        present(item);
        return;
      }
      queue.push(item);
      if (queue.length > 2) queue = queue.slice(-2);
    },

    startSpeaking: text => {
      const item: IslandItem = { id: ++seq, kind: 'speaking', body: text };
      // Shoon carries the message aloud — any notification that was up (or still
      // queued) belongs to the same reminder and must not be re-shown after.
      const cur = get().current;
      if (cur && cur.kind === 'notification') {
        clearTimer();
      }
      queue = queue.filter(q => q.kind !== 'notification');
      present(item);
    },

    stopSpeaking: () => {
      if (get().current?.kind === 'speaking') advance();
    },

    dismissIsland: () => {
      advance();
    },

    clearIsland: () => {
      clearTimer();
      queue = [];
      set({ current: null });
    },
  };
});
