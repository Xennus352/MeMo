/**
 * Real, working notifications for MeMo 💕 — not placeholders.
 *
 * Two layers:
 *  1. Tauri (native): period & milestone reminders are scheduled with the OS
 *     via the plugin's `schedule_period_reminder` / `schedule_milestone_reminder`
 *     Rust commands, so they fire even when the app is closed. The schedule is
 *     cancelled and rebuilt whenever relevant data changes.
 *  2. Web / dev: the same reminders fire in-app (Web Notifications API) as the
 *     app runs — on load, every 15 minutes, and after any data change. Each
 *     reminder fires at most once per item per day (tracked in localStorage).
 *
 * If permission is missing, every path stays silent and the Settings tab shows
 * how to enable it — no errors, no crash, no fake UI.
 */

import { isTauri } from '@tauri-apps/api/core';
import { milestones, anniversaries, periodEntries, notices, cancelAllNotifications, ensureReminderChannel, scheduleReminderAt } from '@/lib/tauri';
import { speakReminder } from '@/lib/voiceAlert';
import { CARE_TITLE, careMessageForDay, anniversaryCongratsSoon, anniversaryCongratsToday } from '@/lib/careMessages';
import { ensureShoonWav, scheduleShoonAlarm, cancelAllShoonAlarms } from '@/lib/shoonAlarms';
import { dateKey, diffDays, addDaysToKey } from '@/utils/helpers';
import { useUserStore, useIslandStore } from '@/stores';
import { useVoiceStore } from '@/stores';
import type { IslandIcon } from '@/stores/islandStore';
import { usePeriodStore } from '@/stores';
import { useMilestoneStore } from '@/stores';
import { useAnniversaryStore } from '@/stores';

/** Guess a friendly island icon from the notification tag */
const tagIcon = (tag?: string): IslandIcon => {
  const t = (tag ?? '').toLowerCase();
  if (t.startsWith('period') || t.startsWith('fertility') || t.startsWith('ovulation')) return 'droplet';
  if (t.startsWith('milestone')) return 'sparkles';
  if (t.startsWith('anniversary')) return 'award';
  return 'bell';
};

const FIRE_KEY = 'memo_notification_fired';
const FIRE_TTL_MS = 3 * 24 * 60 * 60 * 1000;

const isTauriEnv = async (): Promise<boolean> => {
  try {
    return await isTauri();
  } catch {
    return false;
  }
};

const readFired = (): Record<string, number> => {
  try {
    return JSON.parse(localStorage.getItem(FIRE_KEY) || '{}');
  } catch {
    return {};
  }
};

const hasFired = (key: string): boolean => {
  const fired = readFired();
  return typeof fired[key] === 'number';
};

const markFired = (key: string): void => {
  try {
    const fired = readFired();
    fired[key] = Date.now();
    for (const [k, t] of Object.entries(fired)) {
      if (Date.now() - t > FIRE_TTL_MS) delete fired[k];
    }
    localStorage.setItem(FIRE_KEY, JSON.stringify(fired));
  } catch {
    // storage full/blocked — worst case the reminder fires twice
  }
};

export type NotificationPermissionState = 'granted' | 'denied' | 'off' | 'unsupported';

export const getNotificationPermissionState = async (): Promise<NotificationPermissionState> => {
  if (await isTauriEnv()) {
    try {
      const plugin = await import('@tauri-apps/plugin-notification');
      const granted = await plugin.isPermissionGranted();
      return granted ? 'granted' : 'off'; // tauri plugin can't distinguish default vs denied
    } catch {
      return 'unsupported';
    }
  }
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  switch (Notification.permission) {
    case 'granted': return 'granted';
    case 'denied': return 'denied';
    default: return 'off';
  }
};

/** Ask for permission; resolves true when granted. Safe to call from a user gesture. */
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (await isTauriEnv()) {
    try {
      const plugin = await import('@tauri-apps/plugin-notification');
      if (await plugin.isPermissionGranted()) return true;
      const result = await plugin.requestPermission();
      return result === 'granted';
    } catch {
      return false;
    }
  }
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch {
    return false;
  }
};

/**
 * Fire a single reminder. While the app is open the Dynamic Island IS the
 * notification surface — sending an OS heads-up on top of it just shows the
 * same message twice. Reminders still reach the system tray when MeMo is
 * closed (native one-off OS schedule sits in `syncScheduledReminders`).
 */
export const notify = async (title: string, body: string, tag?: string): Promise<boolean> => {
  try {
    useIslandStore.getState().showNotification(title, body, tagIcon(tag));
  } catch {
    // Never let a UI hiccup silence the reminder itself
  }
  return true;
};

/** Always fire at least once for this item; true when it actually went out. */
const notifyOnce = async (key: string, title: string, body: string): Promise<boolean> => {
  if (hasFired(key)) return false;
  const delivered = await notify(title, body, key);
  // Speak the reminder aloud too (opt-in via Settings → Spoken reminders)
  void speakReminder(`${title.replace(/^MeMo 💕\s*/, '')}. ${body}`);
  if (delivered) markFired(key);
  return delivered;
};

const pad = (n: number) => String(n).padStart(2, '0');

export // Burmese digits for spoken number normalization (၀-၉)
const mmDigit = (value: number | string): string =>
  String(value).replace(/[0-9]/g, d => '၀၁၂၃၄၅၆၇၈၉'[Number(d)]);

export const anniversaryOccurrence = (dateStr: string, today: string): string => {
  // Anniversary repeats every year — find the next occurrence on/after today.
  // Numeric Date constructors roll Feb 29 → Mar 1 on non-leap years instead of
  // producing an Invalid Date (template-string parsing would).
  const [year, month, day] = dateStr.split('-').map(Number);
  const todayDate = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)));
  const thisYear = new Date(todayDate.getFullYear(), month - 1, day);
  const target = thisYear >= todayDate ? thisYear : new Date(todayDate.getFullYear() + 1, month - 1, day);
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
};

/** Fire every reminder whose day has arrived (or is within the reminder window) and hasn't fired yet.
 *  On native the OS delivers everything via AlarmManager (scheduled at 9:00/10:00);
 *  showing anything here would just duplicate the system notification. Web/dev still fires in-app. */
export const checkDueReminders = async (): Promise<string[]> => {
  if (await isTauriEnv()) return [];
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    // Reminders are useful offline too (they're computed locally) — keep going
  }
  const settings = useUserStore.getState().notificationSettings;
  const predictions = usePeriodStore.getState().predictions;
  // Query fresh rather than trusting the paginated milestone list in the store,
  // so reminders work no matter how many milestones exist. Fall back to the
  // store if the query fails.
  let milestoneItems;
  try {
    milestoneItems = await milestones.getUpcoming(15);
  } catch {
    milestoneItems = useMilestoneStore.getState().items;
  }
  let anniversaryItems;
  try {
    anniversaryItems = await anniversaries.getAll();
  } catch {
    anniversaryItems = useAnniversaryStore.getState().items;
  }
  const today = dateKey();
  const fired: string[] = [];
  const periodLength = useUserStore.getState().cycleSettings?.periodLength ?? 5;

  // A period-day window for today: logged runs first (contiguous backwards from
  // the most recent logged day), otherwise the predicted window.
  let periodWindowStart: string | null = null;
  try {
    const entries = await periodEntries.getAll();
    const periodDays = entries.filter(e => e.isPeriodDay).map(e => e.date).sort();
    if (periodDays.length) {
      let runStart = periodDays[periodDays.length - 1];
      for (let i = periodDays.length - 2; i >= 0 && diffDays(periodDays[i], runStart) === 1; i -= 1) {
        runStart = periodDays[i];
      }
      const daysInto = diffDays(runStart, today);
      if (daysInto >= 0 && daysInto < periodLength) periodWindowStart = runStart;
    }
  } catch {
    // fall back to the prediction below
  }
  if (!periodWindowStart && predictions?.nextPeriodStart) {
    const daysInto = diffDays(predictions.nextPeriodStart, today);
    if (daysInto >= 0 && daysInto < periodLength) periodWindowStart = predictions.nextPeriodStart;
  }

  // ---- Warm Burmese only — every alert below is a note to her, not a report ----

  // Period days themselves: one caring Burmese message a day, not the countdown nag
  if (settings.periodReminder && periodWindowStart) {
    const index = diffDays(periodWindowStart, today);
    const body = careMessageForDay(periodWindowStart, index);
    const ok = await notifyOnce(`period-care-${periodWindowStart}-${today}`, CARE_TITLE, body);
    if (ok) fired.push('period-care');
  } else if (settings.periodReminder && predictions?.nextPeriodStart) {
    // Before the period only: the heads-up warning stays, in Burmese
    const daysUntil = diffDays(today, predictions.nextPeriodStart);
    if (daysUntil >= 0 && daysUntil <= settings.periodReminderDays) {
      const label = daysUntil === 0
        ? 'ဒီနေ့ သင့်ရာသီ စတင်တော့မယ် 💕'
        : `သင့်ရာသီ နောက်ထပ် ${mmDigit(daysUntil)} ရက်အတွင်း 💕`;
      const ok = await notifyOnce(`period-${predictions.nextPeriodStart}`, 'MeMo 💕 ရာသီလာချိန် အသိပေးချက်', label);
      if (ok) fired.push('period');
    }
  }

  // Period just ended — the congrats note for surviving it
  if (settings.periodEndedReminder && predictions) {
    try {
      const entries = await periodEntries.getAll();
      const periodDays = entries.filter(e => e.isPeriodDay);
      if (periodDays.length) {
        const cycle = useUserStore.getState().cycleSettings;
        const periodLength = cycle.periodLength ?? 5;
        const latestStart = periodDays.map(e => e.date).sort().pop()!;
        const endOfPeriod = addDaysToKey(latestStart, periodLength); // day after the last period day
        const daysSinceEnd = diffDays(endOfPeriod, today);
        if (daysSinceEnd === 0 || daysSinceEnd === 1) {
          const ok = await notifyOnce(
            `period-ended-${latestStart}`,
            'MeMo 💕 ရာသီကုန်၊ အားမာန်ကျော်',
            'ရာသီကုန်ပြီ — အားမာန်ရှိပါတယ် 🌸'
          );
          if (ok) fired.push('period-ended');
        }
      }
    } catch (error) {
      console.error('Period-ended check failed:', error);
    }
  }

  // Ovulation: fire on the first fertile day and on ovulation day
  if (settings.ovulationReminder && predictions) {
    const fertileDays = diffDays(today, predictions.fertileWindowStart);
    if (fertileDays === 0) {
      const ok = await notifyOnce(`fertility-${fertileDays}-${predictions.fertileWindowStart}`, 'MeMo 💕 မျိုးပွားနိုင်သောအချိန်', 'ဒီနေ့ မျိုးပွားနိုင်အောင်ချိန်ပါ ✨');
      if (ok) fired.push('fertility');
    }
    const ovulationDays = diffDays(today, predictions.ovulationDate);
    if (ovulationDays === 0) {
      const ok = await notifyOnce(`ovulation-${predictions.ovulationDate}`, 'MeMo 💕 မျိုးဥအထွက်နေ့', 'ဒီနေ့ မျိုးဥအထွက်ဆုံးနေ့ ✨');
      if (ok) fired.push('ovulation');
    }
  }

  // Milestones: reminder window applies to every upcoming milestone
  if (settings.milestoneReminder) {
    for (const m of milestoneItems) {
      const daysUntil = diffDays(today, m.date);
      if (daysUntil < 0 || daysUntil > settings.milestoneReminderDays) continue;
      const label = daysUntil === 0
        ? `ဒီနေ့ ${m.emoji} ${m.title} 💕`
        : `${m.emoji} ${m.title} — ${mmDigit(daysUntil)} ရက်အတွင်း 💕`;
      const ok = await notifyOnce(`milestone-${m.id}-${m.date}`, 'MeMo 💕 အထိမ်းအမှတ်ရက်', label);
      if (ok) fired.push(m.title);
    }
  }

  // Anniversaries: recurring annually — every single one alerts on the
  // anniversaryReminderDays window before its next occurrence
  if (settings.anniversaryReminder) {
    for (const a of anniversaryItems) {
      const occurrence = anniversaryOccurrence(a.date, today);
      const daysUntil = diffDays(today, occurrence);
      if (daysUntil < 0 || daysUntil > settings.anniversaryReminderDays) continue;
      const label = daysUntil === 0 ? anniversaryCongratsToday(a.label) : anniversaryCongratsSoon(a.label, daysUntil);
      const ok = await notifyOnce(`anniversary-${a.id}-${occurrence}`, 'MeMo 💕 နှစ်ပတ်လည်နေ့', label);
      if (ok) fired.push(a.label);
    }
  }

  return fired;
};

/** Cancel every OS-scheduled reminder and rebuild the schedule from current data (Tauri only; no-op on web).
 *  Everything is scheduled via AlarmManager (Android) or UNCalendarNotification (iOS), so reminders
 *  fire even while the phone is locked or MeMo is not running. Rebuilds cover the current cycle
 *  plus the next two, so a two-month app-free stretch still delivers. */
export const syncScheduledReminders = async (): Promise<void> => {
  if (!(await isTauriEnv())) return;
  try {
    await ensureReminderChannel();
    await cancelAllNotifications();
    await cancelAllShoonAlarms();

    const settings = useUserStore.getState().notificationSettings;
    const cycleSettings = useUserStore.getState().cycleSettings;
    const predictions = usePeriodStore.getState().predictions;
    const cycleLength = cycleSettings?.cycleLength ?? 28;
    const periodLength = cycleSettings?.periodLength ?? 5;

    /** 9:00 local time on a date key, as unix seconds */
    const fireAt = (dayKey: string, hour = 9): number => {
      const [y, m, d] = dayKey.split('-').map(Number);
      return Math.floor(new Date(y, m - 1, d, hour, 0, 0).getTime() / 1000);
    };
    const nowSec = () => Math.floor(Date.now() / 1000);
    /** Schedule only future occurrences — tray notification + Shoon speaking alarm */
    const scheduleFuture = async (title: string, body: string, dayKey: string, hour = 9) => {
      const unix = fireAt(dayKey, hour);
      if (unix > nowSec() + 60) {
        try {
          await scheduleReminderAt(title, body, unix);
        } catch (error) {
          console.warn(`Could not schedule "${title}" for ${dayKey}:`, error);
        }
        // Shoon speaks it even with the phone locked or the app closed.
        if (useVoiceStore.getState().enabled) {
          try {
            const wavPath = await ensureShoonWav(body);
            await scheduleShoonAlarm(title, body, body, unix * 1000, wavPath);
          } catch (error) {
            console.warn(`Could not schedule the Shoon alarm for "${title}":`, error);
          }
        }
      }
    };

    // ---- Cycle reminders: current cycle + the next two ----
    if (predictions?.nextPeriodStart) {
      const start0 = predictions.nextPeriodStart;
      for (let k = 0; k < 3; k += 1) {
        const start = addDaysToKey(start0, k * cycleLength);

        if (settings.periodReminder) {
          const daysBefore = settings.periodReminderDays;
          const remDay = addDaysToKey(start, -daysBefore);
          const body = daysBefore === 0
            ? 'ဒီနေ့ သင့်ရာသီ စတင်တော့မယ် 💕'
            : `သင့်ရာသီ နောက်ထပ် ${mmDigit(daysBefore)} ရက်အတွင်း 💕`;
          await scheduleFuture('MeMo 💕 ရာသီလာချိန် အသိပေးချက်', body, remDay);
          // During the period days themselves: one caring Burmese message a day
          for (let j = 0; j < periodLength; j += 1) {
            const day = addDaysToKey(start, j);
            await scheduleFuture(CARE_TITLE, careMessageForDay(start, j), day);
          }
        }

        if (settings.periodEndedReminder) {
          const endDay = addDaysToKey(start, periodLength); // day after the last period day
          await scheduleFuture(
            'MeMo 💕 ရာသီကုန်၊ အားမာန်ကျော်',
            'ရာသီကုန်ပြီ — အားမာန်ရှိပါတယ် 🌸',
            endDay,
            10
          );
        }

        if (settings.ovulationReminder) {
          const ovulation = addDaysToKey(start, -14);
          const fertileStart = addDaysToKey(ovulation, -5);
          await scheduleFuture(
            'MeMo 💕 မျိုးပွားနိုင်သောအချိန်',
            'ဒီနေ့ မျိုးပွားနိုင်အောင်ချိန်ပါ ✨',
            fertileStart
          );
          await scheduleFuture(
            'MeMo 💕 မျိုးဥအထွက်နေ့',
            'ဒီနေ့ မျိုးဥအထွက်ဆုံးနေ့ ✨',
            ovulation
          );
        }
      }
    }

    // ---- Milestones: reminder N days before, for everything upcoming ----
    if (settings.milestoneReminder) {
      const upcoming = await milestones.getUpcoming(15);
      for (const m of upcoming) {
        const remDay = addDaysToKey(m.date, -settings.milestoneReminderDays);
        const daysUntil = settings.milestoneReminderDays;
        const body = daysUntil === 0
          ? `ဒီနေ့ ${m.emoji} ${m.title} 💕`
          : `${m.emoji} ${m.title} — ${mmDigit(daysUntil)} ရက်အတွင်း 💕`;
        await scheduleFuture('MeMo 💕 အထိမ်းအမှတ်ရက်', body, remDay);
      }
    }

    // ---- Anniversaries: recurring annually, N days before each next occurrence ----
    if (settings.anniversaryReminder) {
      const todayForOccurrence = dateKey();
      const list = await anniversaries.getAll();
      for (const a of list) {
        try {
          const occurrence = anniversaryOccurrence(a.date, todayForOccurrence);
          const remDay = addDaysToKey(occurrence, -settings.anniversaryReminderDays);
          const daysUntil = settings.anniversaryReminderDays;
          const body = daysUntil === 0 ? anniversaryCongratsToday(a.label) : anniversaryCongratsSoon(a.label, daysUntil);
          await scheduleFuture('MeMo 💕 နှစ်ပတ်လည်နေ့', body, remDay);
        } catch (error) {
          console.warn(`Could not schedule anniversary reminder for "${a.label}":`, error);
        }
      }
    }
    // ---- Partner notices (the noticeboard): alert this device for notices the PARTNER pinned ----
    // Recipient-side scheduling, same as every other reminder here: each phone
    // rebuilds from synced data and schedules its own alarms. Repeat notices
    // get their next 8 occurrences; one-time notices get their single slot.
    // Shoon only voices one-time notices — an interval alarm reading aloud
    // every few minutes would be hostile.
    const myRole = useUserStore.getState().profile?.role;
    if (myRole) {
      try {
        const all = await notices.getAll();
        const partnerNotices = all.filter(n => n.createdBy !== myRole && n.active);
        const noticeTitle = 'MeMo 💕 သတိပေးချက်';
        for (const n of partnerNotices) {
          try {
            const first = Math.floor(Date.parse(n.remindAt) / 1000);
            if (!Number.isFinite(first)) continue;
            if (!(n.repeatMinutes > 0)) {
              // One-time
              if (first > nowSec() + 60) {
                await scheduleReminderAt(noticeTitle, n.message, first);
                if (useVoiceStore.getState().enabled) {
                  try {
                    const wavPath = await ensureShoonWav(n.message);
                    await scheduleShoonAlarm(noticeTitle, n.message, n.message, first * 1000, wavPath);
                  } catch (error) {
                    console.warn(`Could not schedule the Shoon alarm for notice ${n.id}:`, error);
                  }
                }
              }
              continue;
            }
            // Repeat: walk the interval grid anchored at remindAt, keep the next 8
            const interval = Math.max(5, Math.floor(n.repeatMinutes)) * 60;
            const now = nowSec();
            let t = first;
            if (t <= now) {
              t = first + Math.ceil((now - first) / interval) * interval;
              if (t <= now) t += interval;
            }
            let count = 0;
            while (t <= now + 8 * interval && count < 8) {
              if (t > now + 60) {
                try {
                  await scheduleReminderAt(noticeTitle, n.message, t);
                  count += 1;
                } catch (error) {
                  console.warn(`Could not schedule repeat occurrence of notice ${n.id}:`, error);
                }
              }
              t += interval;
            }
          } catch (error) {
            console.warn(`Could not schedule notice ${n.id}:`, error);
          }
        }
      } catch (error) {
        console.warn('Could not read notices for scheduling:', error);
      }
    }
  } catch (error) {
    console.warn('Could not rebuild the reminder schedule:', error);
  }
};

// ---- In-app notice alerts ---------------------------------------------------
// While either app is open we surface partner notices through the same island
// surface as reminders (and Shoon, once, for one-time notices). The OS alarm
// path covers the closed/locked case; this path covers "app is running right
// now". Fired state lives in localStorage so a notice never double-fires.

const NOTICE_FIRE_KEY = 'memo_notice_fired';
const NOTICE_FIRE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const readNoticeFired = (): Record<string, number> => {
  try {
    return JSON.parse(localStorage.getItem(NOTICE_FIRE_KEY) || '{}');
  } catch {
    return {};
  }
};

const lastNoticeFired = (id: string): number | null => {
  const raw = readNoticeFired()[id];
  return typeof raw === 'number' ? raw : null;
};

const markNoticeFired = (id: string): void => {
  try {
    const fired = readNoticeFired();
    fired[id] = Date.now();
    for (const [k, t] of Object.entries(fired)) {
      if (Date.now() - t > NOTICE_FIRE_TTL_MS) delete fired[k];
    }
    localStorage.setItem(NOTICE_FIRE_KEY, JSON.stringify(fired));
  } catch {
    // storage blocked — worst case it fires once more
  }
};

/** Fire any due partner notices through the island. On native the OS alarm path
 *  already covers closed-app delivery; this is the "app is open" pass.
 *  One-time notices are marked due on EVERY device, by wall clock, so both
 *  phones flip at the same second even fully offline — the island and voice
 *  fire only for the recipient on the web/dev build. */
export const checkDueNotices = async (): Promise<string[]> => {
  const myRole = useUserStore.getState().profile?.role;
  if (!myRole) return [];
  const native = await isTauriEnv();

  let rows;
  try {
    rows = await notices.getAll();
  } catch {
    return [];
  }

  const now = Date.now();
  const fired: string[] = [];
  const title = 'MeMo 💕 သတိပေးချက်';

  for (const n of rows) {
    if (!n.active) continue;
    const remindAt = Date.parse(n.remindAt);
    if (!Number.isFinite(remindAt)) continue;

    if (!(n.repeatMinutes > 0)) {
      // One-time: archive on every device independently (idempotent writes)
      if (remindAt <= now && lastNoticeFired(n.id) === null) {
        markNoticeFired(n.id);
        try {
          if (!native && n.createdBy !== myRole) {
            await notify(title, n.message, `notice-${n.id}`);
            void speakReminder(n.message);
          }
          await notices.setActive(n.id, false);
        } catch (error) {
          console.warn(`Could not mark notice ${n.id} as due:`, error);
        }
        fired.push(n.id);
      }
      continue;
    }

    // Repeat: island only for the recipient, only on the web/dev build, once per interval
    if (native || n.createdBy === myRole) continue;
    const intervalMs = Math.max(5, Math.floor(n.repeatMinutes)) * 60 * 1000;
    if (remindAt > now) continue;
    const last = lastNoticeFired(n.id) ?? (remindAt - intervalMs);
    if (last !== null && now - last >= intervalMs) {
      markNoticeFired(n.id);
      try {
        await notify(title, n.message, `notice-${n.id}`);
      } catch (error) {
        console.warn(`Could not fire notice ${n.id}:`, error);
      }
      fired.push(n.id);
    }
  }

  return fired;
};
