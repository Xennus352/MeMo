import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { UserProfile, UserRole, CycleSettings, NotificationSettings, AppSettings } from '@/types';
import { userProfile, cycleSettings, notificationSettings, appSettings, getOrCreateDeviceId } from '@/lib/tauri';
import { applyTheme, resolveTheme } from '@/lib/theme';

interface UserState {
  profile: UserProfile | null;
  cycleSettings: CycleSettings;
  notificationSettings: NotificationSettings;
  appSettings: AppSettings;
  deviceId: string;
  loading: boolean;
  initialized: boolean;
  
  initialize: () => Promise<void>;
  setRole: (role: UserRole, name: string) => Promise<void>;
  updateProfile: (updates: Partial<Omit<UserProfile, 'id' | 'createdAt'>>) => Promise<void>;
  setPairingCode: (code: string) => Promise<void>;
  clearPairingCode: () => Promise<void>;
  setPairedDevice: (pairedDeviceId: string) => Promise<void>;
  updateCycleSettings: (settings: Partial<Omit<CycleSettings, 'id' | 'updatedAt'>>) => Promise<void>;
  setLastPeriodStart: (date: string) => Promise<void>;
  updateNotificationSettings: (settings: Partial<Omit<NotificationSettings, 'id' | 'updatedAt'>>) => Promise<void>;
  updateAppSettings: (settings: Partial<Omit<AppSettings, 'id' | 'updatedAt'>>) => Promise<void>;
  reset: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      profile: null,
      cycleSettings: { id: 'default', cycleLength: 28, periodLength: 5, updatedAt: new Date().toISOString() },
      notificationSettings: {
        id: 'default',
        periodReminder: true,
        periodReminderDays: 1,
        ovulationReminder: true,
        milestoneReminder: true,
        milestoneReminderDays: 3,
        anniversaryReminder: true,
        updatedAt: new Date().toISOString(),
      },
      appSettings: { id: 'default', theme: 'light', language: 'en', widgetEnabled: true, updatedAt: new Date().toISOString() },
      deviceId: '',
      loading: false,
      initialized: false,

      initialize: async () => {
        set({ loading: true });
        try {
          const deviceId = await getOrCreateDeviceId();
          
          const [profile, cycle, notifications, app] = await Promise.all([
            userProfile.get(),
            cycleSettings.get(),
            notificationSettings.get(),
            appSettings.get(),
          ]);

          // Apply theme on init (stored "system" falls back to light)
          applyTheme(resolveTheme(app.theme));

          set({
            profile,
            cycleSettings: cycle,
            notificationSettings: notifications,
            appSettings: app,
            deviceId,
            initialized: true,
            loading: false,
          });
        } catch (error) {
          console.error('Failed to initialize user store:', error);
          set({ loading: false, initialized: true });
        }
      },

      setRole: async (role: UserRole, name: string) => {
        const { deviceId } = get();
        const newProfile: UserProfile = {
          id: crypto.randomUUID(),
          role,
          name,
          deviceId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await userProfile.create(newProfile);
        set({ profile: newProfile });
      },

      updateProfile: async (updates) => {
        const { profile } = get();
        if (!profile) return;
        await userProfile.update(updates);
        set({ profile: { ...profile, ...updates, updatedAt: new Date().toISOString() } });
      },

      setPairingCode: async (code: string) => {
        const { profile } = get();
        if (!profile) return;
        await userProfile.update({ pairingCode: code });
        set({ profile: { ...profile, pairingCode: code, updatedAt: new Date().toISOString() } });
      },

      clearPairingCode: async () => {
        const { profile } = get();
        if (!profile) return;
        await userProfile.update({ pairingCode: undefined });
        set({ profile: { ...profile, pairingCode: undefined, updatedAt: new Date().toISOString() } });
      },

      setPairedDevice: async (pairedDeviceId: string) => {
        const { profile } = get();
        if (!profile) return;
        await userProfile.update({ pairedDeviceId });
        set({ profile: { ...profile, pairedDeviceId, updatedAt: new Date().toISOString() } });
      },

      updateCycleSettings: async (settings) => {
        await cycleSettings.update(settings);
        set({ cycleSettings: { ...get().cycleSettings, ...settings, updatedAt: new Date().toISOString() } });
      },

      setLastPeriodStart: async (date: string) => {
        await cycleSettings.update({ lastPeriodStart: date });
        set({ cycleSettings: { ...get().cycleSettings, lastPeriodStart: date, updatedAt: new Date().toISOString() } });
      },

      updateNotificationSettings: async (settings) => {
        await notificationSettings.update(settings);
        set({ notificationSettings: { ...get().notificationSettings, ...settings, updatedAt: new Date().toISOString() } });
      },

      updateAppSettings: async (settings) => {
        await appSettings.update(settings);
        const newSettings = { ...get().appSettings, ...settings, updatedAt: new Date().toISOString() };
        set({ appSettings: newSettings });
        
        // Apply theme to document immediately
        if (settings.theme) {
          applyTheme(resolveTheme(settings.theme));
        }
      },

      reset: () => {
        set({
          profile: null,
          cycleSettings: { id: 'default', cycleLength: 28, periodLength: 5, updatedAt: new Date().toISOString() },
          notificationSettings: {
            id: 'default',
            periodReminder: true,
            periodReminderDays: 1,
            ovulationReminder: true,
            milestoneReminder: true,
            milestoneReminderDays: 3,
            anniversaryReminder: true,
            updatedAt: new Date().toISOString(),
          },
          appSettings: { id: 'default', theme: 'light', language: 'en', widgetEnabled: true, updatedAt: new Date().toISOString() },
          deviceId: '',
          initialized: false,
        });
      },
    }),
    {
      name: 'hourglass-user-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        deviceId: state.deviceId,
      }),
    }
  )
);