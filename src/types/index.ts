export type UserRole = 'boy' | 'girl';

export type DateKey = string; // YYYY-MM-DD

export interface PeriodEntry {
  id: string;
  date: DateKey;
  isPeriodDay: boolean;
  flow?: 'light' | 'medium' | 'heavy';
  symptoms?: string[];
  notes?: string;
  createdBy: UserRole;
  synced: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CycleSettings {
  id: string;
  cycleLength: number;
  periodLength: number;
  lastPeriodStart?: DateKey;
  updatedAt: string;
}

export interface Milestone {
  id: string;
  title: string;
  date: string;
  emoji: string;
  note?: string;
  createdBy: UserRole;
  synced: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Anniversary {
  id: string;
  date: string;
  label: string;
  isPrimary: boolean;
  createdAt: string;
}

export interface DevicePairingData {
  code: string;
  role: UserRole;
  deviceId: string;
  name: string;
  expiresAt: string;
}

export interface UserProfile {
  id: string;
  role: UserRole;
  name: string;
  deviceId: string;
  pairingCode?: string;
  pairedDeviceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CouplePair {
  id: string;
  boyDeviceId: string;
  girlDeviceId: string;
  anniversaryDate: string;
  createdAt: string;
}

export interface NotificationSettings {
  id: string;
  periodReminder: boolean;
  periodReminderDays: number;
  ovulationReminder: boolean;
  milestoneReminder: boolean;
  milestoneReminderDays: number;
  anniversaryReminder: boolean;
  updatedAt: string;
}

export interface AppSettings {
  id: string;
  theme: 'light' | 'dark' | 'system';
  language: string;
  widgetEnabled: boolean;
  updatedAt: string;
}

export interface SyncQueueItem {
  id: string;
  type: 'period' | 'milestone' | 'anniversary' | 'cycle_settings' | 'notification_settings' | 'app_settings';
  action: 'insert' | 'update' | 'delete';
  payload: Record<string, unknown>;
  retries: number;
  createdAt: string;
  lastAttemptAt?: string;
}

export interface PairingCode {
  id: string;
  code: string;
  role: UserRole;
  deviceId: string;
  name: string;
  expiresAt: string;
  used: boolean;
  usedAt?: string;
  usedByDeviceId?: string;
}

export interface PredictionResult {
  nextPeriodStart: DateKey;
  nextPeriodEnd: DateKey;
  ovulationDate: DateKey;
  fertileWindowStart: DateKey;
  fertileWindowEnd: DateKey;
  cycleDay: number;
  daysUntilPeriod: number;
}

export const DEFAULT_CYCLE_LENGTH = 28;
export const DEFAULT_PERIOD_LENGTH = 5;
export const PAIRING_CODE_EXPIRY_HOURS = 24;
export const PAIRING_CODE_LENGTH = 6;