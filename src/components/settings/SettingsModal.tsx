import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Check, User, Bell, Palette, Globe, Database, Share2, Download, Upload, Trash2, Shield, Info, Moon, Sun, Monitor, Heart, Users, Droplet, Sparkles, Calendar, Clock, Camera, Music, Plane, Car, Home, Baby, Award, Eye, Edit2, ChevronRight, ChevronLeft } from 'lucide-react';
import { cn, dateKey, formatDateKeyFull } from '@/utils/helpers';
import { exportData, importData } from '@/lib/tauri';
import { GlassView, Button, GlassCard, MotionGlassCard, ModalBackdrop } from '@/components/ui/GlassComponents';
import { UserRole, NotificationSettings, AppSettings } from '@/types';
import { createPortal } from 'react-dom';
import { useUserStore } from '@/stores';
import { usePeriodStore } from '@/stores';
import { useMilestoneStore } from '@/stores';
import { useAnniversaryStore } from '@/stores';
import { useCustomModals } from '@/components/ui/CustomModals';

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
    notificationSettings,
    updateNotificationSettings,
    appSettings,
    updateAppSettings,
    reset: resetUser,
  } = useUserStore();

  const { showConfirm, showAlert } = useCustomModals();

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
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
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
      showAlert('Import Failed', 'That file could not be read. Please choose a MeMo JSON backup and try again.', 'error');
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
              onClick={() => updateNotificationSettings({ [item.key]: !notificationSettings[item.key as keyof NotificationSettings] })}
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
              onClick={() => updateAppSettings({ theme: theme.value as 'light' | 'dark' })}
              className={cn(
                'p-4 rounded-xl border-2 transition-all',
                appSettings.theme === theme.value
                  ? 'border-accent bg-accent-light'
                  : 'border-border hover:border-accent/50'
              )}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="w-6 h-6 mx-auto mb-2"
              >
                <theme.icon className="w-6 h-6" />
              </motion.div>
              <p className="text-caption font-medium text-text">{theme.label}</p>
            </motion.button>
          ))}
        </div>
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
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 20 }}
          className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent to-secondary flex items-center justify-center mx-auto mb-4"
        >
          <Heart className="w-10 h-10 text-on-accent" />
        </motion.div>
        <h3 className="text-h2 font-bold text-text">MeMo 💕</h3>
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
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="pt-4 border-t border-border"
      >
        <p className="text-caption text-text-muted text-center">
          Made with ❤️ for couples everywhere
        </p>
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