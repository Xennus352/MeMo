import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { DateKey, CycleSettings, PredictionResult, PeriodEntry, DEFAULT_CYCLE_LENGTH, DEFAULT_PERIOD_LENGTH } from '@/types';
import { format, addDays, differenceInDays, startOfDay, isToday as isTodayFns, isBefore, isAfter } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function dateKey(date: Date = new Date()): DateKey {
  return format(date, 'yyyy-MM-dd');
}

export const addDaysToKey = (dateKey: DateKey, days: number): DateKey => {
  const date = new Date(dateKey + 'T00:00:00');
  return format(addDays(date, days), 'yyyy-MM-dd');
};

export const diffDays = (from: DateKey, to: DateKey): number => {
  const fromDate = startOfDay(new Date(from + 'T00:00:00'));
  const toDate = startOfDay(new Date(to + 'T00:00:00'));
  return differenceInDays(toDate, fromDate);
};

export const isToday = (dateKey: DateKey): boolean => {
  return isTodayFns(new Date(dateKey + 'T00:00:00'));
};

export const isPast = (dateKey: DateKey): boolean => {
  return isBefore(new Date(dateKey + 'T00:00:00'), startOfDay(new Date()));
};

export const isFuture = (dateKey: DateKey): boolean => {
  return isAfter(new Date(dateKey + 'T00:00:00'), startOfDay(new Date()));
};

export const calculatePredictions = (
  cycleSettings: CycleSettings,
  periodEntries: PeriodEntry[]
): PredictionResult => {
  const cycleLength = cycleSettings.cycleLength || DEFAULT_CYCLE_LENGTH;
  const periodLength = cycleSettings.periodLength || DEFAULT_PERIOD_LENGTH;
  const today = dateKey();

  let lastPeriodStart = cycleSettings.lastPeriodStart;
  
  if (!lastPeriodStart) {
    const sortedEntries = [...periodEntries].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    for (const entry of sortedEntries) {
      if (entry.isPeriodDay) {
        lastPeriodStart = entry.date;
        break;
      }
    }
  }

  if (!lastPeriodStart) {
    lastPeriodStart = addDaysToKey(today, -Math.floor(cycleLength / 2));
  }

  const daysSinceLastPeriod = diffDays(lastPeriodStart, today);
  const cyclesPassed = Math.max(0, Math.floor(daysSinceLastPeriod / cycleLength));
  const nextPeriodStart = addDaysToKey(lastPeriodStart, (cyclesPassed + 1) * cycleLength);
  const nextPeriodEnd = addDaysToKey(nextPeriodStart, periodLength - 1);

  const ovulationDate = addDaysToKey(nextPeriodStart, -14);
  const fertileWindowStart = addDaysToKey(ovulationDate, -5);
  const fertileWindowEnd = addDaysToKey(ovulationDate, 1);

  const cycleDay = diffDays(lastPeriodStart, today) + 1;
  const daysUntilPeriod = diffDays(today, nextPeriodStart);

  return {
    nextPeriodStart,
    nextPeriodEnd,
    ovulationDate,
    fertileWindowStart,
    fertileWindowEnd,
    cycleDay: Math.max(1, Math.min(cycleDay, cycleLength)),
    daysUntilPeriod: Math.max(0, daysUntilPeriod),
  };
};

export const getPeriodDays = (startDate: DateKey, periodLength: number): DateKey[] => {
  const days: DateKey[] = [];
  for (let i = 0; i < periodLength; i++) {
    days.push(addDaysToKey(startDate, i));
  }
  return days;
};

export const getFertileWindowDays = (ovulationDate: DateKey): DateKey[] => {
  const days: DateKey[] = [];
  for (let i = -5; i <= 1; i++) {
    days.push(addDaysToKey(ovulationDate, i));
  }
  return days;
};

export type CyclePhase = 'period' | 'follicular' | 'ovulation' | 'luteal';

export const getCyclePhase = (cycleDay: number, cycleLength: number): CyclePhase => {
  if (cycleDay <= 5) return 'period';
  if (cycleDay < cycleLength - 14) return 'follicular';
  if (cycleDay <= cycleLength - 11) return 'ovulation';
  return 'luteal';
};

export const getPhaseColor = (phase: CyclePhase, isDark: boolean): string => {
  const colors = {
    light: {
      period: '#EB9AC0',
      follicular: '#9F7AEA',
      ovulation: '#C4A3F5',
      luteal: '#D98FB6',
    },
    dark: {
      period: '#EB9AC0',
      follicular: '#9F7AEA',
      ovulation: '#C4A3F5',
      luteal: '#E3A8C7',
    },
  };
  return colors[isDark ? 'dark' : 'light'][phase];
};

export const getPhaseLabel = (phase: CyclePhase): string => {
  const labels = {
    period: 'Period',
    follicular: 'Follicular Phase',
    ovulation: 'Ovulation',
    luteal: 'Luteal Phase',
  };
  return labels[phase];
};

export const formatDateKey = (dateKey: DateKey, options?: Intl.DateTimeFormatOptions): string => {
  const date = new Date(dateKey + 'T00:00:00');
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...options,
  });
};

export const formatDateKeyFull = (dateKey: DateKey): string => {
  const date = new Date(dateKey + 'T00:00:00');
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const getRelativeTime = (dateKeyStr: DateKey): string => {
  const today = dateKey(new Date());
  const diff = diffDays(today, dateKeyStr);
  
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 0) return `In ${diff} days`;
  return `${Math.abs(diff)} days ago`;
};

export const isDateInRange = (date: DateKey, start: DateKey, end: DateKey): boolean => {
  return date >= start && date <= end;
};

export const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month + 1, 0).getDate();
};

export const getFirstDayOfMonth = (year: number, month: number): number => {
  return new Date(year, month, 1).getDay();
};

export const getMonthName = (month: number): string => {
  return new Date(2000, month, 1).toLocaleString('default', { month: 'long' });
};

export const getWeekDays = (): string[] => {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
};

export const generateId = (): string => {
  return crypto.randomUUID();
};

export const nowISO = (): string => {
  return new Date().toISOString();
};

export const parseJsonSafe = <T>(json: string, fallback: T): T => {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
};

export const debounce = <T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

export const throttle = <T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

