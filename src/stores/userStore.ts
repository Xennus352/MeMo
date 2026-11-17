import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { UserProfile, UserRole, CycleSettings, NotificationSettings, AppSettings } from '@/types';
import { userProfile, cycleSettings, notificationSettings, appSettings, getOrCreateDeviceId } from '@/lib/tauri';
import { usePeriodStore } from './periodStore';
import { applyTheme, applyThemeAnimated, resolveTheme, setThemeTransitionConfig } from '@/lib/theme';

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
  updateAppSettings: (settings: Partial<Omit<AppSettings, 'id' | 'updatedAt'>>, opts?: { originX?: number; originY?: number }) => Promise<void>;
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
        periodEndedReminder: true,
        ovulationReminder: true,
        milestoneReminder: true,
        milestoneReminderDays: 3,
        anniversaryReminder: true,
        anniversaryReminderDays: 3,
        updatedAt: new Date().toISOString(),
      },
      appSettings: { id: 'default', theme: 'light', language: 'en', widgetEnabled: true, themeTransition: '{"mode":"random"}', updatedAt: new Date().toISOString() },
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

          // Keep the stored profile's deviceId identical to the canonical
          // hourglass_device_id, so pairing lookups never disagree.
          let alignedProfile = profile;
          if (profile && profile.deviceId !== deviceId) {
            try {
              await userProfile.update({ deviceId });
              alignedProfile = { ...profile, deviceId, updatedAt: new Date().toISOString() };
            } catch (error) {
              console.error('Failed to align device id:', error);
            }
          }

          // Apply theme on init (stored "system" falls back to light)
          applyTheme(resolveTheme(app.theme));
          setThemeTransitionConfig(app.themeTransition);

          set({
            profile: alignedProfile,
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
        // Keep predictions (cycle day, days until period, calendar phases) in sync
        usePeriodStore.getState().refreshPredictions();
      },

      setLastPeriodStart: async (date: string) => {
        await cycleSettings.update({ lastPeriodStart: date });
        set({ cycleSettings: { ...get().cycleSettings, lastPeriodStart: date, updatedAt: new Date().toISOString() } });
        usePeriodStore.getState().refreshPredictions();
      },

      updateNotificationSettings: async (settings) => {
        await notificationSettings.update(settings);
        set({ notificationSettings: { ...get().notificationSettings, ...settings, updatedAt: new Date().toISOString() } });
      },

      updateAppSettings: async (settings, opts) => {
        await appSettings.update(settings);
        const newSettings = { ...get().appSettings, ...settings, updatedAt: new Date().toISOString() };
        set({ appSettings: newSettings });

        // Keep the transition engine's config snapshot fresh
        setThemeTransitionConfig(newSettings.themeTransition);

        // Apply theme to document immediately — animated when triggered by the user
        if (settings.theme) {
          applyThemeAnimated(resolveTheme(settings.theme), opts);
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
            periodEndedReminder: true,
            ovulationReminder: true,
            milestoneReminder: true,
            milestoneReminderDays: 3,
            anniversaryReminder: true,
        anniversaryReminderDays: 3,
            updatedAt: new Date().toISOString(),
          },
          appSettings: { id: 'default', theme: 'light', language: 'en', widgetEnabled: true, themeTransition: '{"mode":"random"}', updatedAt: new Date().toISOString() },
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