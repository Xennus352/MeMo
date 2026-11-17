import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, User, Bell, Palette, Globe, Database, Share2, Download, Upload, Trash2, Shield, Info, Moon, Sun, Monitor, Heart, Users, Droplet, Droplets, Sparkles, Calendar, Clock, Camera, Music, Plane, Car, Home, Baby, Award, Eye, Edit2, ChevronRight, ChevronLeft, Volume2, Layers, MoveHorizontal, Circle, MoveDiagonal, Paintbrush, Shuffle, SlidersHorizontal, Waves } from 'lucide-react';
import { cn, dateKey, formatDateKeyFull } from '@/utils/helpers';
import { exportData, importData, unpairRemoteDevice } from '@/lib/tauri';
import { DatePickerField } from '@/components/ui/CalendarPicker';
import { GlassView, Button, GlassCard, MotionGlassCard, ModalBackdrop } from '@/components/ui/GlassComponents';
import { UserRole, NotificationSettings, AppSettings } from '@/types';
import { createPortal } from 'react-dom';
import { useUserStore } from '@/stores';
import { usePeriodStore } from '@/stores';
import { useMilestoneStore } from '@/stores';
import { useAnniversaryStore } from '@/stores';
import { useCustomModals, useToast } from '@/components/ui/CustomModals';
import { requestNotificationPermission, getNotificationPermissionState, notify } from '@/lib/reminders';
import { useVoiceStore } from '@/stores';
import { useUpdaterStore } from '@/stores';
import { speakTest } from '@/lib/voiceAlert';
import { isTauri, invoke } from '@tauri-apps/api/core';
import { parseThemeTransition, serializeThemeTransition, type ThemeTransitionConfig, type ThemeTransitionEffect, type WipeOrientation, type CircleOrigin, type SwipeDirection } from '@/lib/theme';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'data', label: 'Data', icon: Database },
  { id: 'about', label: 'About', icon: Info },
] as const;

type TabId = typeof TABS[number]['id'];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editName, setEditName] = useState(false);
  const [editRole, setEditRole] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [roleInput, setRoleInput] = useState<'boy' | 'girl'>('girl');

  const {
    profile,
    updateProfile,
    cycleSettings,
    updateCycleSettings,
    setLastPeriodStart,
    notificationSettings,
    updateNotificationSettings,
    appSettings,
    updateAppSettings,
    reset: resetUser,
    deviceId,
  } = useUserStore();

  const { showConfirm, showAlert } = useCustomModals();
  const { showToast } = useToast();
  const [permState, setPermState] = useState<'granted' | 'denied' | 'off' | 'unsupported'>('off');

  // Re-read the permission whenever the user returns to the app (e.g. after flipping the switch in OS settings)
  useEffect(() => {
    const refresh = () => { getNotificationPermissionState().then(setPermState).catch(() => {}); };
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh(); };
    void refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      getNotificationPermissionState().then(setPermState).catch(() => setPermState('off'));
    }
  }, [isOpen]);

  const handleNotificationToggle = async (key: string, next: boolean) => {
    await updateNotificationSettings({ [key]: next });
    if (next) {
      // Ask for permission right at the moment the user opts in
      await requestNotificationPermission();
      setPermState(await getNotificationPermissionState());
    }
  };

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      setPermState('granted');
      showToast('Notifications enabled 💕', 'success');
      return;
    }
    // Permission was denied before, or the system refused — take them straight to the switch
    try {
      if (await isTauri()) {
        await invoke('plugin:shoon-alarm|open_notification_settings');
        showToast('Turn on notifications in Settings, then come back', 'success');
        return;
      }
    } catch (error) {
      console.warn('Could not open notification settings directly:', error);
    }
    setPermState(await getNotificationPermissionState());
    showToast('Notifications are still blocked', 'error');
  };

  const handleTestNotification = async () => {
    await requestNotificationPermission();
    setPermState(await getNotificationPermissionState());
    // The Dynamic Island IS what a reminder looks like with MeMo open
    await notify('MeMo 💕', 'အသိပေးချက်များ ဖြစ်ပါတယ်။', 'memo-test');
    showToast('Test reminder sent 💕', 'success');
  };

  const voice = useVoiceStore();

  const handleTestVoice = async () => {
    const result = await speakTest();
    showToast(
      result === 'nara' ? 'Shoon 💕 is Speaking'
        : result === 'system' ? 'Speaking via the Myanmar system voice 💕'
        : 'No voice output available on this device',
      result === 'none' ? 'error' : 'success'
    );
  };

  const { entries: periodEntries } = usePeriodStore();
  const { items: milestones } = useMilestoneStore();
  const { items: anniversaries } = useAnniversaryStore();

  useEffect(() => {
    if (isOpen && profile) {
      setNameInput(profile?.name || '');
      setRoleInput(profile?.role || 'girl');
    }
  }, [isOpen, profile]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `memo-backup-${dateKey()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('Backup downloaded 💕', 'success');
    } catch (error) {
      console.error('Export failed:', error);
      showToast('Export failed — please try again', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      await importData(text); // reloads the app with the restored backup
    } catch (error) {
      console.error('Import failed:', error);
      showAlert('Import Failed', 'That file could not be restored. It must be an untouched MeMo JSON backup — nothing was changed.', 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleResetAll = () => {
    showConfirm({
      title: 'Delete All Data?',
      message: 'This will delete ALL your data. This action cannot be undone.',
      type: 'danger',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: () => {
        showConfirm({
          title: 'Type "DELETE" to confirm',
          message: 'This is permanent and cannot be undone.',
          type: 'danger',
          confirmText: 'Delete',
          cancelText: 'Cancel',
          onConfirm: () => {
            resetUser();
            // Best-effort unpair so the partner's device stops pairing into a tombstoned store
            unpairRemoteDevice(profile?.deviceId ?? deviceId ?? '').catch(() => {});
            localStorage.clear();
            window.location.reload();
          },
        });
      },
    });
  };

  const handleSaveName = async () => {
    if (nameInput.trim()) {
      await updateProfile({ name: nameInput.trim() });
      setEditName(false);
    }
  };

  const handleSaveRole = async () => {
    await updateProfile({ role: roleInput });
    setEditRole(false);
  };

  useEffect(() => {
    if (profile) {
      setNameInput(profile?.name || '');
      setRoleInput(profile?.role || 'girl');
    }
  }, [profile, isOpen]);

  const renderProfileTab = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Profile Section */}
      <MotionGlassCard className="p-4">
        <div className="flex items-center gap-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-accent-light flex items-center justify-center flex-shrink-0"
          >
            {roleInput === 'girl' ? '👧' : '👦'}
          </motion.div>
          <div className="flex-1 min-w-0">
            {/* Name */}
            {editName ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                  onBlur={handleSaveName}
                  autoFocus
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-input border border-border text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-h3 font-bold"
                />
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={handleSaveName}
                  className="p-2 rounded-lg bg-accent-light text-accent hover:bg-accent/80"
                >
                  <Check className="w-5 h-5" />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setEditName(false)}
                  className="p-2 rounded-lg hover:bg-surface-subtle"
                >
                  <X className="w-5 h-5 text-text-muted" />
                </motion.button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h3 className="text-h3 font-bold text-text">{profile?.name || 'Not Set'}</h3>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => { setNameInput(profile?.name || ''); setEditName(true); }}
                  className="p-1 rounded-lg hover:bg-surface-subtle"
                >
                  <Edit2 className="w-5 h-5 text-text-muted" />
                </motion.button>
              </div>
            )}
            {/* Role */}
            {editRole ? (
              <div className="flex items-center gap-2 mt-1">
                <select
                  value={roleInput}
                  onChange={e => setRoleInput(e.target.value as 'boy' | 'girl')}
                  onBlur={handleSaveRole}
                  className="px-3 py-2 rounded-lg bg-input border border-border text-text focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-caption"
                >
                  <option value="girl">👧 Girl</option>
                  <option value="boy">👦 Boy</option>
                </select>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={handleSaveRole}
                  className="p-2 rounded-lg bg-accent-light text-accent hover:bg-accent/80"
                >
                  <Check className="w-4 h-4" />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setEditRole(false)}
                  className="p-2 rounded-lg hover:bg-surface-subtle"
                >
                  <X className="w-4 h-4 text-text-muted" />
                </motion.button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <p className="text-caption text-text-muted capitalize">{profile?.role || 'Not Set'}</p>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => { setRoleInput(profile?.role || 'girl'); setEditRole(true); }}
                  className="p-1 rounded-lg hover:bg-surface-subtle"
                >
                  <Edit2 className="w-4 h-4 text-text-muted" />
                </motion.button>
              </div>
            )}
          </div>
        </div>
      </MotionGlassCard>

      {/* Cycle Settings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        <h4 className="font-medium text-text-secondary mb-3 flex items-center gap-2">
          <Droplet className="w-4 h-4 text-accent" />
          Cycle Settings
        </h4>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <MotionGlassCard className="p-3 sm:p-4 min-w-0">
            <label className="block text-caption font-medium text-text-secondary mb-2">Cycle Length</label>
            <select
              value={cycleSettings.cycleLength}
              onChange={e => updateCycleSettings({ cycleLength: parseInt(e.target.value) })}
              className="w-full min-w-0 px-3 py-3 rounded-xl bg-input border border-border text-body-sm text-text focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            >
              {[21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35].map(d => (
                <option key={d} value={d}>{d} days</option>
              ))}
            </select>
          </MotionGlassCard>
          <MotionGlassCard className="p-3 sm:p-4 min-w-0">
            <label className="block text-caption font-medium text-text-secondary mb-2">Period Length</label>
            <select
              value={cycleSettings.periodLength}
              onChange={e => updateCycleSettings({ periodLength: parseInt(e.target.value) })}
              className="w-full min-w-0 px-3 py-3 rounded-xl bg-input border border-border text-body-sm text-text focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            >
              {[3, 4, 5, 6, 7, 8, 9, 10].map(d => (
                <option key={d} value={d}>{d} days</option>
              ))}
            </select>
          </MotionGlassCard>
        </div>

        {/* Last period start — drives the cycle predictions everywhere */}
        <div className="mt-4">
          <label className="block text-caption font-medium text-text-secondary mb-2">
            Last Period Started
          </label>
          <DatePickerField
            value={cycleSettings.lastPeriodStart ?? undefined}
            onChange={date => setLastPeriodStart(date)}
            placeholder="Pick the day your period started"
            max={dateKey(new Date())}
          />
          <p className="text-caption text-text-muted mt-2 normal-case">
            Used to predict your next period and fertile window across the app.
          </p>
        </div>
      </motion.div>

      {/* Partner Status */}
      {profile?.pairedDeviceId && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <h4 className="font-medium text-text-secondary mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-secondary" />
            Partner Connected
          </h4>
          <MotionGlassCard className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="w-10 h-10 rounded-xl bg-secondary-light flex items-center justify-center"
                >
                  <Users className="w-5 h-5 text-secondary" />
                </motion.div>
                <div>
                  <p className="font-medium text-text">Paired</p>
                  <p className="text-caption text-text-muted">Data syncing enabled</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-caption font-medium bg-success-light text-success">Connected</span>
            </div>
          </MotionGlassCard>
        </motion.div>
      )}
    </motion.div>
  );

  const renderNotificationsTab = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {[
        { key: 'periodReminder', label: 'Period Reminder', desc: 'Get notified before your period starts', icon: Droplet },
        { key: 'periodEndedReminder', label: 'Period Ended', desc: 'A sweet note for surviving your period — you are strong', icon: Droplets },
        { key: 'ovulationReminder', label: 'Ovulation Reminder', desc: 'Know when you\'re most fertile', icon: Sparkles },
        { key: 'milestoneReminder', label: 'Milestone Reminders', desc: 'Upcoming anniversaries & memories', icon: Heart },
        { key: 'anniversaryReminder', label: 'Anniversary Reminders', desc: 'Never forget special dates', icon: Award },
      ].map((item, index) => (
        <MotionGlassCard key={item.key} className="p-3.5 sm:p-4" delay={index * 60}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 20 }}
                className="w-10 h-10 rounded-xl bg-accent-light flex items-center justify-center flex-shrink-0"
              >
                <item.icon className="w-5 h-5 text-accent" />
              </motion.div>
              <div className="min-w-0">
                <p className="font-medium text-text">{item.label}</p>
                <p className="text-caption text-text-muted normal-case">{item.desc}</p>
              </div>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => handleNotificationToggle(item.key, !notificationSettings[item.key as keyof NotificationSettings])}
              className={cn(
                'relative w-12 h-7 rounded-full transition-all duration-200 flex-shrink-0',
                notificationSettings[item.key as keyof NotificationSettings] ? 'bg-accent' : 'bg-text-muted/20'
              )}
              aria-pressed={Boolean(notificationSettings[item.key as keyof NotificationSettings])}
            >
              <motion.span
                className="absolute left-0 top-0.5 w-6 h-6 rounded-full bg-white shadow-md"
                animate={{ x: notificationSettings[item.key as keyof NotificationSettings] ? 22 : 2 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              />
            </motion.button>
          </div>
        </MotionGlassCard>
      ))}

      {/* Permission banner — reminders only fire when notifications are allowed */}
      <MotionGlassCard className={cn('p-4 flex items-center gap-3', permState === 'granted' ? 'border border-success/30' : 'border border-warning/30')}>
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', permState === 'granted' ? 'bg-success-light' : 'bg-warning-light')}>
          <Bell className={cn('w-5 h-5', permState === 'granted' ? 'text-success' : 'text-warning')} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-text">{permState === 'granted' ? 'Notifications on' : permState === 'denied' ? 'Notifications blocked' : 'Notifications off'}</p>
          <p className="text-caption text-text-muted normal-case">{permState === 'granted' ? 'You’ll get reminders while the app is open (and on schedule on native builds)' : permState === 'denied' ? 'We’ll open Android’s notification settings — flip on Notifications there' : 'Turn them on to receive reminders'}</p>
        </div>
        {permState !== 'granted' && (
          <Button variant="secondary" size="sm" onClick={handleEnableNotifications} className="flex-shrink-0">
            Turn on
          </Button>
        )}
      </MotionGlassCard>

      <MotionGlassCard className="p-4">
        <button
          onClick={handleTestNotification}
          className="w-full flex items-center gap-3 text-left rounded-xl px-2 py-1.5 hover:bg-surface-subtle transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-secondary-light flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-secondary" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-text">Send test notification</p>
            <p className="text-caption text-text-muted normal-case">See exactly what your reminders will look like</p>
          </div>
          <ChevronRight className="w-5 h-5 text-text-muted ml-auto flex-shrink-0" />
        </button>
      </MotionGlassCard>

      {/* AI Voice — Shoon speaks the reminder out loud (on/off only) */}
      <MotionGlassCard className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-light flex items-center justify-center flex-shrink-0">
              <Volume2 className="w-5 h-5 text-accent" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-text">AI Voice</p>
              <p className="text-caption text-text-muted normal-case">Shoon reads the reminder aloud · Burmese</p>
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => voice.setEnabled(!voice.enabled)}
            className={cn(
              'relative w-12 h-7 rounded-full transition-all duration-200 flex-shrink-0',
              voice.enabled ? 'bg-accent' : 'bg-text-muted/20'
            )}
            aria-pressed={voice.enabled}
            aria-label="AI Voice"
          >
            <motion.span
              className="absolute left-0 top-0.5 w-6 h-6 rounded-full bg-white shadow-md"
              animate={{ x: voice.enabled ? 22 : 2 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            />
          </motion.button>
        </div>

        {voice.enabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 pt-4 border-t border-border space-y-3 overflow-hidden"
          >
            <p className="text-caption text-text-muted normal-case">
              Shoon · Burmese &amp; English
            </p>
            <button
              onClick={handleTestVoice}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-body-sm font-semibold bg-accent-light text-accent hover:brightness-105 transition-all"
            >
              <Volume2 className="w-4 h-4" />
              Test voice
            </button>
            {/* <div>
              <label htmlFor="nara-url" className="block text-caption font-medium text-text-secondary mb-1.5">
                Voice server address
              </label>
              <input
                id="nara-url"
                type="text"
                defaultValue={voice.naraUrl}
                onBlur={e => voice.setNaraUrl(e.target.value.trim() || 'http://127.0.0.1:8899')}
                placeholder="http://192.168.x.x:8899"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                inputMode="url"
                className="w-full px-3 py-2.5 rounded-xl bg-input border border-border text-text text-body-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
              <p className="text-caption text-text-muted normal-case mt-1.5">
                Locked-phone Shoon: point this at the computer running the Shoon server on the same Wi-Fi (e.g. <code>http://192.168.1.20:8899</code>), then the reminder is cached for speaking while the phone is locked. Leave as-is for in-app voice only.
              </p>
            </div> */}
          </motion.div>
        )}
      </MotionGlassCard>

      {notificationSettings.periodReminder && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          <MotionGlassCard className="p-4">
            <label className="block text-caption font-medium text-text-secondary mb-2">Days Before Period</label>
            <select
              value={notificationSettings.periodReminderDays}
              onChange={e => updateNotificationSettings({ periodReminderDays: parseInt(e.target.value) })}
              className="w-full px-4 py-3 rounded-xl bg-input border border-border text-text focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            >
              {[1, 2, 3, 5, 7].map(d => (
                <option key={d} value={d}>{d} day{ d > 1 ? 's' : '' } before</option>
              ))}
            </select>
          </MotionGlassCard>
        </motion.div>
      )}

      {notificationSettings.anniversaryReminder && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.4 }}
        >
          <MotionGlassCard className="p-4">
            <label className="block text-caption font-medium text-text-secondary mb-2">Days Before Anniversary</label>
            <select
              value={notificationSettings.anniversaryReminderDays}
              onChange={e => updateNotificationSettings({ anniversaryReminderDays: parseInt(e.target.value) })}
              className="w-full px-4 py-3 rounded-xl bg-input border border-border text-text focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            >
              {[1, 2, 3, 5, 7, 14, 30].map(d => (
                <option key={d} value={d}>{d} day{d > 1 ? 's' : ''} before</option>
              ))}
            </select>
            <p className="text-caption text-text-muted mt-2 normal-case">Applies to every anniversary you add — each one reminds you this many days before its date every year.</p>
          </MotionGlassCard>
        </motion.div>
      )}

      {notificationSettings.milestoneReminder && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
        >
          <MotionGlassCard className="p-4">
            <label className="block text-caption font-medium text-text-secondary mb-2">Days Before Milestone</label>
            <select
              value={notificationSettings.milestoneReminderDays}
              onChange={e => updateNotificationSettings({ milestoneReminderDays: parseInt(e.target.value) })}
              className="w-full px-4 py-3 rounded-xl bg-input border border-border text-text focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            >
              {[1, 2, 3, 5, 7].map(d => (
                <option key={d} value={d}>{d} day{ d > 1 ? 's' : '' } before</option>
              ))}
            </select>
          </MotionGlassCard>
        </motion.div>
      )}
    </motion.div>
  );

  const transition = parseThemeTransition(appSettings.themeTransition);
  const updateTransition = (patch: Partial<ThemeTransitionConfig>) => {
    const next = { ...parseThemeTransition(appSettings.themeTransition), ...patch };
    updateAppSettings({ themeTransition: serializeThemeTransition(next) });
  };

  const transitionEffects: { id: ThemeTransitionEffect; label: string; icon: typeof Layers; swatch: string }[] = [
    { id: 'fade', label: 'Fade', icon: Layers, swatch: 'tx-fade' },
    { id: 'wipe', label: 'Wipe', icon: MoveHorizontal, swatch: 'tx-wipe-h' },
    { id: 'circle', label: 'Circle', icon: Circle, swatch: 'tx-circle' },
    { id: 'swipe', label: 'Swipe', icon: MoveDiagonal, swatch: 'tx-swipe-left' },
    { id: 'paint', label: 'Paint', icon: Paintbrush, swatch: 'tx-paint' },
  ];

  const renderAppearanceTab = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        <h4 className="font-medium text-text-secondary mb-3 flex items-center gap-2">
          <Palette className="w-4 h-4 text-accent" />
          Theme
        </h4>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 'light', label: 'Light', icon: Sun },
            { value: 'dark', label: 'Dark', icon: Moon },
          ].map(theme => (
            <motion.button
              key={theme.value}
              whileTap={{ scale: 0.97 }}
              onClick={(e) => updateAppSettings(
                { theme: theme.value as 'light' | 'dark' },
                { originX: e.clientX / window.innerWidth, originY: e.clientY / window.innerHeight }
              )}
              className={cn(
                'relative p-4 rounded-xl border-2 transition-all',
                appSettings.theme === theme.value
                  ? 'border-accent bg-accent-light'
                  : 'border-border hover:border-accent/50'
              )}
            >
              <AnimatePresence initial={false}>
                {appSettings.theme === theme.value && (
                  <motion.div
                    key={`check-${theme.value}`}
                    initial={{ scale: 0, rotate: -120, opacity: 0 }}
                    animate={{ scale: 1, rotate: 0, opacity: 1 }}
                    exit={{ scale: 0, rotate: 120, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 460, damping: 22 }}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-accent text-on-accent flex items-center justify-center"
                    aria-hidden
                  >
                    <Check className="w-3.5 h-3.5" strokeWidth={3} />
                  </motion.div>
                )}
              </AnimatePresence>
              <motion.div
                key={`icon-${theme.value}-${appSettings.theme === theme.value ? 'active' : 'idle'}`}
                initial={{ scale: 0.4, rotate: -25, opacity: 0.4 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 380, damping: 20 }}
                className="w-6 h-6 mx-auto mb-2"
              >
                <theme.icon className="w-6 h-6" />
              </motion.div>
              <p className="text-caption font-medium text-text">{theme.label}</p>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Theme Transition — Serpantinum wallpaper-style switching */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        <div className="flex items-center justify-between mb-3 gap-2">
          <h4 className="font-medium text-text-secondary flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" />
            Theme Transition
          </h4>
          <div className="flex gap-1 p-1 rounded-full bg-input border border-border">
            <button
              onClick={() => updateTransition({ mode: 'random' })}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-caption font-semibold transition-all',
                transition.mode === 'random' ? 'bg-accent text-on-accent shadow-sm' : 'text-text-muted'
              )}
            >
              <Shuffle className="w-3.5 h-3.5" />
              Surprise me
            </button>
            <button
              onClick={() => updateTransition({ mode: 'custom' })}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-caption font-semibold transition-all',
                transition.mode === 'custom' ? 'bg-accent text-on-accent shadow-sm' : 'text-text-muted'
              )}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Custom
            </button>
          </div>
        </div>
        <p className="text-caption text-text-muted normal-case mb-3">
          {transition.mode === 'random'
            ? 'Every switch plays a random transition from the full set — tap Light/Dark to try it.'
            : 'Pick exactly which transition plays on every theme switch.'}
        </p>

        <div className="grid grid-cols-2 min-[420px]:grid-cols-3 sm:grid-cols-5 gap-2.5">
          {transitionEffects.map(effect => {
            const selected = transition.mode === 'custom' && transition.custom === effect.id;
            return (
              <motion.button
                key={effect.id}
                whileTap={{ scale: 0.94 }}
                onClick={() => updateTransition({ mode: 'custom', custom: effect.id })}
                className={cn(
                  'group relative p-2 rounded-2xl border-2 transition-all text-left',
                  selected ? 'border-accent bg-accent-light' : 'border-border hover:border-accent/50'
                )}
                aria-pressed={selected}
                aria-label={`Use ${effect.label} transition`}
              >
                <div className={cn('tx-swatch mb-2 aspect-[4/3] w-full', effect.swatch)} aria-hidden>
                  <div className="tx-swatch-new" />
                </div>
                <div className="flex items-center gap-1.5">
                  <effect.icon className="w-4 h-4 text-text-secondary flex-shrink-0" strokeWidth={2.2} />
                  <span className="text-caption font-semibold text-text">{effect.label}</span>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Per-effect options, only in Custom mode */}
        {transition.mode === 'custom' && (
          <>
            {transition.custom === 'wipe' && (
              <div className="mt-3">
                <p className="text-caption font-medium text-text-secondary mb-1.5">Direction</p>
                <div className="flex gap-1 flex-wrap">
                  {(['random', 'horizontal', 'vertical'] as WipeOrientation[]).map(option => (
                    <button
                      key={option}
                      onClick={() => updateTransition({ wipeOrientation: option })}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-caption font-semibold border transition-all',
                        transition.wipeOrientation === option
                          ? 'border-accent bg-accent-light text-accent'
                          : 'border-border text-text-secondary'
                      )}
                    >
                      {option === 'random' ? 'Random' : option === 'horizontal' ? 'Horizontal' : 'Vertical'}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {transition.custom === 'circle' && (
              <div className="mt-3">
                <p className="text-caption font-medium text-text-secondary mb-1.5">Origin</p>
                <div className="flex gap-1 flex-wrap">
                  {(['random', 'center'] as CircleOrigin[]).map(option => (
                    <button
                      key={option}
                      onClick={() => updateTransition({ circleOrigin: option })}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-caption font-semibold border transition-all',
                        transition.circleOrigin === option
                          ? 'border-accent bg-accent-light text-accent'
                          : 'border-border text-text-secondary'
                      )}
                    >
                      {option === 'random' ? 'Random' : 'Center'}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {transition.custom === 'swipe' && (
              <div className="mt-3">
                <p className="text-caption font-medium text-text-secondary mb-1.5">Direction</p>
                <div className="flex gap-1 flex-wrap">
                  {(['random', 'left', 'right', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right'] as SwipeDirection[]).map(option => (
                    <button
                      key={option}
                      onClick={() => updateTransition({ swipeDirection: option })}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-caption font-semibold border transition-all',
                        transition.swipeDirection === option
                          ? 'border-accent bg-accent-light text-accent'
                          : 'border-border text-text-secondary'
                      )}
                    >
                      {option === 'random' ? 'Random' : option.split('-').map(s => s[0].toUpperCase() + s.slice(1)).join('-')}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {transition.custom === 'fade' && (
              <p className="text-caption text-text-muted normal-case mt-3">Fade has no options — it just dissolves.</p>
            )}
            {transition.custom === 'paint' && (
              <p className="text-caption text-text-muted normal-case mt-3">Paint blooms from where you tap — no options, just organic colonies spreading.</p>
            )}
          </>
        )}
      </motion.div>
    </motion.div>
  );

  const renderDataTab = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h4 className="font-medium text-text-secondary mb-3 flex items-center gap-2">
          <Download className="w-4 h-4 text-accent" />
          Export Data
        </h4>
        <p className="text-caption text-text-muted mb-4">Download a complete backup of all your data</p>
        <Button
          variant="primary"
          onClick={handleExport}
          loading={exporting}
          className="w-full"
        >
          <Download className="w-4 h-4 mr-2" />
          Export Backup
        </Button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        <h4 className="font-medium text-text-secondary mb-3 flex items-center gap-2">
          <Upload className="w-4 h-4 text-secondary" />
          Import Data
        </h4>
        <p className="text-caption text-text-muted mb-4">Restore from a previously exported backup</p>
        <label className="w-full">
          <input
            type="file"
            accept=".json"
            onChange={e => e.target.files?.[0] && handleImport(e.target.files[0])}
            className="sr-only"
            id="import-file"
            disabled={importing}
          />
          <motion.button
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={() => document.getElementById('import-file')?.click()}
            disabled={importing}
            className={cn(
              'w-full px-4 py-3 rounded-xl border-2 transition-all',
              importing ? 'border-border opacity-50 cursor-not-allowed' : 'border-border hover:border-secondary/50'
            )}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="w-5 h-5 mx-auto mb-2"
            >
              <Upload className="w-5 h-5" />
            </motion.div>
            <p className="text-caption font-medium text-text">Choose Backup File</p>
            <p className="text-caption text-text-muted">JSON format only</p>
          </motion.button>
        </label>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        <h4 className="font-medium text-text-secondary mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-accent" />
          Privacy & Security
        </h4>
        <div className="space-y-3">
          <MotionGlassCard className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="w-10 h-10 rounded-xl bg-accent-light flex items-center justify-center"
                >
                  <Database className="w-5 h-5 text-accent" />
                </motion.div>
                <div>
                  <p className="font-medium text-text">Local Storage Only</p>
                  <p className="text-caption text-text-muted">All data stored on your device</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-caption font-medium bg-success-light text-success">Active</span>
            </div>
          </MotionGlassCard>
          <MotionGlassCard className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 20 }}
                  className="w-10 h-10 rounded-xl bg-secondary-light flex items-center justify-center"
                >
                  <Shield className="w-5 h-5 text-secondary" />
                </motion.div>
                <div>
                  <p className="font-medium text-text">No Cloud Sync</p>
                  <p className="text-caption text-text-muted">Zero server-side data storage</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-caption font-medium bg-success-light text-success">Active</span>
            </div>
          </MotionGlassCard>
          <MotionGlassCard className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 20 }}
                  className="w-10 h-10 rounded-xl bg-accent-light flex items-center justify-center"
                >
                  <Eye className="w-5 h-5 text-accent" />
                </motion.div>
                <div>
                  <p className="font-medium text-text">No Tracking</p>
                  <p className="text-caption text-text-muted">No analytics or advertising</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-caption font-medium bg-success-light text-success">Active</span>
            </div>
          </MotionGlassCard>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <h4 className="font-medium text-text-secondary mb-3 flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-error" />
          Danger Zone
        </h4>
        <Button
          variant="ghost"
          onClick={handleResetAll}
          className="w-full text-error hover:bg-error-light"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete All Data
        </Button>
        <p className="text-caption text-text-muted text-center mt-2">This action cannot be undone</p>
      </motion.div>
    </motion.div>
  );

  const renderAboutTab = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="text-center py-4"
      >
        <motion.img
          src="/memo-logo.png"
          alt="MeMo"
          draggable={false}
          initial={{ scale: 0, rotate: -180, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 220, damping: 20 }}
          className="w-28 h-28 rounded-2xl object-cover ring-1 ring-white/10 mx-auto mb-4 select-none pointer-events-none drop-shadow-[0_6px_24px_rgba(235,154,192,0.45)]"
        />
        <h3 className="text-h2 font-bold text-text">MeMo</h3>
        <p className="text-text-muted mt-1">Version 1.0.0</p>
        <p className="text-caption text-text-muted mt-2">Your private couple space</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="space-y-3"
      >
        <MotionGlassCard className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="w-10 h-10 rounded-xl bg-accent-light flex items-center justify-center"
              >
                <Shield className="w-5 h-5 text-accent" />
              </motion.div>
              <div>
                <p className="font-medium text-text">Privacy First</p>
                <p className="text-caption text-text-muted">Local-only, no cloud, no tracking</p>
              </div>
            </div>
          </div>
        </MotionGlassCard>

        <MotionGlassCard className="p-4">
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 20 }}
              className="w-10 h-10 rounded-xl bg-accent-light flex items-center justify-center flex-shrink-0"
            >
              <Volume2 className="w-5 h-5 text-accent" />
            </motion.div>
            <div className="min-w-0">
              <p className="font-medium text-text">AI Voice</p>
              <p className="text-caption text-text-muted normal-case">Uses Nara Mini v1 by Nara contributors, a Kokoro-based Burmese and English speech model. <a href="https://naraaudio.app" target="_blank" rel="noreferrer" className="text-accent hover:underline">naraaudio.app</a> · <a href="https://huggingface.co/YeeNyunn/nara-mini-v1" target="_blank" rel="noreferrer" className="text-accent hover:underline">Hugging Face</a>. Licensed under Apache 2.0.</p>
            </div>
          </div>
        </MotionGlassCard>

        <MotionGlassCard className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 20 }}
                className="w-10 h-10 rounded-xl bg-secondary-light flex items-center justify-center"
              >
                <Sparkles className="w-5 h-5 text-secondary" />
              </motion.div>
              <div>
                <p className="font-medium text-text">Liquid Glass UI</p>
                <p className="text-caption text-text-muted">Premium glassmorphism design</p>
              </div>
            </div>
          </div>
        </MotionGlassCard>

        <MotionGlassCard className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 20 }}
                className="w-10 h-10 rounded-xl bg-accent-light flex items-center justify-center"
              >
                <Heart className="w-5 h-5 text-accent" />
              </motion.div>
              <div>
                <p className="font-medium text-text">Built for Couples</p>
                <p className="text-caption text-text-muted">Shared milestones & period tracking</p>
              </div>
            </div>
          </div>
        </MotionGlassCard>

        <MotionGlassCard className="p-4">
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 20 }}
              className="w-10 h-10 rounded-xl bg-secondary-light flex items-center justify-center flex-shrink-0"
            >
              <Waves className="w-5 h-5 text-secondary" />
            </motion.div>
            <div className="min-w-0">
              <p className="font-medium text-text">Serpantinum transitions</p>
              <p className="text-caption text-text-muted normal-case">Theme switching animations adapted from the Serpantinum shell&apos;s wallpaper effects. <a href="https://github.com/Xennus352/serpantinum" target="_blank" rel="noreferrer" className="text-accent hover:underline">github.com/Xennus352/serpantinum</a> · GNU AGPL-3.0</p>
            </div>
          </div>
        </MotionGlassCard>

        <MotionGlassCard className="p-4">
          <div className="flex items-center gap-3">
            <img
              src="/memo-logo.png"
              alt="MeMo"
              draggable={false}
              className="w-12 h-12 rounded-2xl object-cover ring-1 ring-white/10 flex-shrink-0 select-none"
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-text">App Updates</p>
              <p className="text-caption text-text-muted normal-case">Version 1.0.0 · updates ship through GitHub Releases</p>
            </div>
            <button
              onClick={() => useUpdaterStore.getState().checkNow()}
              className="flex-shrink-0 px-4 py-2.5 rounded-xl text-caption font-semibold bg-accent-light text-accent hover:brightness-105 transition-all whitespace-nowrap"
            >
              Check for updates
            </button>
          </div>
        </MotionGlassCard>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="pt-4 border-t border-border"
      >
        <div className="pt-2 flex items-center justify-center gap-1.5 text-caption text-text-muted normal-case tracking-wide">
          <span>Made with love 💕</span>
          <span className="uppercase font-semibold text-text-secondary">BY SMK</span>
        </div>
      </motion.div>
    </motion.div>
  );

  const renderTab = () => {
    switch (activeTab) {
      case 'profile': return renderProfileTab();
      case 'notifications': return renderNotificationsTab();
      case 'appearance': return renderAppearanceTab();
      case 'data': return renderDataTab();
      case 'about': return renderAboutTab();
    }
  };

  const modalContent = (
    <ModalBackdrop isOpen={isOpen} onClose={onClose}>
      <GlassView className="modal-surface rounded-3xl sm:rounded-2xl overflow-hidden flex flex-col w-full max-w-2xl h-[min(90dvh,760px)] max-h-[92dvh]">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-between p-4 border-b border-border"
        >
          <h2 className="text-h3 font-bold text-text">Settings</h2>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-subtle transition-colors"
            aria-label="Close settings"
          >
            <X className="w-5 h-5 text-text-muted" />
          </motion.button>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="flex flex-wrap gap-1 px-2 py-2 border-b border-border flex-shrink-0"
        >
          {TABS.map((tab, index) => (
            <motion.button
              key={tab.id}
              whileTap={{ scale: 0.97 }}
              onClick={() => setActiveTab(tab.id)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 + 0.2, duration: 0.3 }}
              className={cn(
                'flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-xl text-caption font-medium whitespace-nowrap transition-all',
                activeTab === tab.id
                  ? 'bg-accent-light text-accent'
                  : 'text-text-muted hover:text-text-secondary hover:bg-surface-subtle'
              )}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 20 }}
                className="w-4 h-4"
              >
                <tab.icon className="w-4 h-4" />
              </motion.div>
              {tab.label}
            </motion.button>
          ))}
        </motion.div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 md:p-6">
          {renderTab()}
        </div>
      </GlassView>
    </ModalBackdrop>
  );

  if (!isOpen) return null;

  return createPortal(modalContent, document.body);
};