import { create } from 'zustand';
import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { isTauri } from '@tauri-apps/api/core';
import { platform } from '@tauri-apps/plugin-os';
import { fetch as nativeFetch } from '@tauri-apps/plugin-http';
import { appCacheDir, join } from '@tauri-apps/api/path';
import { open, BaseDirectory } from '@tauri-apps/plugin-fs';
import { canInstall, install, requestInstallPermission } from 'tauri-plugin-android-installer-api';

export type UpdaterPhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'installing'
  | 'installed'
  | 'upToDate'
  | 'error';

export type UpdaterBranch = 'android' | 'desktop' | 'web';

interface GitHubAsset {
  name?: string;
  size?: number;
  url?: string;
  browser_download_url?: string;
}

interface GitHubRelease {
  tag_name?: string;
  body?: string | null;
  name?: string | null;
  assets?: GitHubAsset[];
}

export interface PendingApkUpdate {
  version: string;
  notes: string | null;
  assetUrl: string;
  assetSize: number | null;
}

export interface UpdaterState {
  phase: UpdaterPhase;
  open: boolean;
  manual: boolean;
  branch: UpdaterBranch | null;
  version: string | null;
  notes: string | null;
  downloadedBytes: number;
  totalBytes: number | null;
  error: string | null;

  /** Silent check at startup — opens the modal only when an update exists */
  autoCheck: () => Promise<void>;
  /** Manual check (About tab) — always opens the modal with the outcome */
  checkNow: () => Promise<void>;
  downloadAndInstall: () => Promise<void>;
  restartNow: () => Promise<void>;
  dismiss: () => void;
}

/** The native update resource — kept outside the store, it's not serializable */
let activeUpdate: Update | null = null;
/** The APK chosen from the latest GitHub release (Android path) */
let pendingApk: PendingApkUpdate | null = null;

const RELEASES_URL = 'https://github.com/Xennus352/MeMo/releases/latest';
const RELEASES_API = 'https://api.github.com/repos/Xennus352/MeMo/releases/latest';
const APK_NAME = 'memo-update.apk';
const FALLBACK_VERSION = '1.0.0';

/** Version the OS reports for this install (bundle version at runtime). Falls back on web. */
const getCurrentVersion = async (): Promise<string> => {
  try {
    const { getVersion } = await import('@tauri-apps/api/app');
    const v = await getVersion();
    return v || FALLBACK_VERSION;
  } catch {
    return FALLBACK_VERSION;
  }
};

const formatMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string') return error;
  return fallback;
};

const detectBranch = (): UpdaterBranch => {
  try {
    const p = platform();
    return p === 'android' ? 'android' : 'desktop';
  } catch {
    return 'desktop';
  }
};

/** "1.2.3" & pre-release suffixes → 3 numeric parts for comparison */
const versionParts = (v: string): number[] =>
  v
    .replace(/^v/i, '')
    .split('.')
    .slice(0, 3)
    .map(n => parseInt(n.replace(/[^0-9].*$/, ''), 10) || 0);

const isNewer = (latest: string, current: string): boolean => {
  const a = versionParts(latest);
  const b = versionParts(current);
  for (let i = 0; i < 3; i += 1) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return false;
};

/** GET JSON from GitHub — via the Rust HTTP plugin on native (no CORS), via window.fetch in the browser */
const fetchLatestRelease = async (): Promise<GitHubRelease | null> => {
  const native = await isTauri();
  const res = native
    ? await nativeFetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' } })
    : await fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' } });
  if (res.status === 404) return null; // no releases yet — app is as new as it gets
  if (!res.ok) throw new Error(`GitHub returned HTTP ${res.status}`);
  return (await res.json()) as GitHubRelease;
};

/** Finds the installable APK asset inside a release */
const pickApkAsset = (release: GitHubRelease): GitHubAsset | null => {
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const apks = assets.filter(a => typeof a?.name === 'string' && /\.apk$/i.test(a.name));
  if (apks.length === 0) return null;
  // The app APK is the largest .apk (the others, if any, are usually splits)
  return apks.reduce((best, a) => ((a.size ?? 0) > (best.size ?? 0) ? a : best));
};

export const useUpdaterStore = create<UpdaterState>((set, get) => ({
  phase: 'idle',
  open: false,
  manual: false,
  branch: null,
  version: null,
  notes: null,
  downloadedBytes: 0,
  totalBytes: null,
  error: null,

  autoCheck: async () => {
    if (!(await isTauri())) return;
    try {
      const branch = detectBranch();
      if (branch === 'android') {
        // Android has no self-installing updater — compare the installed version
        // against the newest GitHub release that carries an APK asset.
        const release = await fetchLatestRelease();
        if (!release) return;
        const latest = (release.tag_name ?? '').replace(/^v/i, '');
        const asset = pickApkAsset(release);
        const current = await getCurrentVersion();
        if (!latest || !asset || !isNewer(latest, current)) return;
        pendingApk = {
          version: latest,
          notes: release.body ?? null,
          // The API asset URL streams the binary directly with the octet-stream Accept header
          assetUrl: asset.url ?? asset.browser_download_url ?? '',
          assetSize: asset.size ?? null,
        };
        set({
          phase: 'available',
          open: true,
          manual: false,
          branch: 'android',
          version: latest,
          notes: release.body ?? null,
        });
        return;
      }
      const update = await check({ timeout: 30_000 });
      if (update === null) return;
      activeUpdate = update;
      set({
        phase: 'available',
        open: true,
        manual: false,
        branch: 'desktop',
        version: update.version,
        notes: update.body ?? null,
      });
    } catch (error) {
      // Startup check must never disturb the user
      console.error('Update check failed:', error);
    }
  },

  checkNow: async () => {
    set({ phase: 'checking', open: true, manual: true, error: null });

    if (await isTauri()) {
      const branch = detectBranch();

      if (branch === 'android') {
        try {
          const current = await getCurrentVersion();
          const release = await fetchLatestRelease();
          const latest = (release?.tag_name ?? '').replace(/^v/i, '');
          const asset = release ? pickApkAsset(release) : null;
          if (!release || !latest || !asset) {
            set({ phase: 'upToDate', version: null, notes: null, branch });
            return;
          }
          if (!isNewer(latest, current)) {
            set({ phase: 'upToDate', version: null, notes: null, branch });
            return;
          }
          pendingApk = {
            version: latest,
            notes: release.body ?? null,
            assetUrl: asset.url ?? asset.browser_download_url ?? '',
            assetSize: asset.size ?? null,
          };
          set({ phase: 'available', version: latest, notes: release.body ?? null, branch });
        } catch (error) {
          set({ phase: 'error', error: formatMessage(error, 'Could not reach GitHub. Check your connection.') });
        }
        return;
      }

      try {
        const update = await check({ timeout: 30_000 });
        if (update === null) {
          set({ phase: 'upToDate', version: null, notes: null, branch: 'desktop' });
          return;
        }
        activeUpdate = update;
        set({
          phase: 'available',
          version: update.version,
          notes: update.body ?? null,
          branch: 'desktop',
        });
      } catch (error) {
        set({ phase: 'error', error: formatMessage(error, 'Could not check for updates. Check your connection and try again.') });
      }
      return;
    }

    // Web / preview builds: query the same GitHub release the APK installs from
    try {
      const current = await getCurrentVersion();
      const release = await fetchLatestRelease();
      const latest = (release?.tag_name ?? '').replace(/^v/i, '');
      if (!release || !latest || !isNewer(latest, current)) {
        set({ phase: 'upToDate', version: null, notes: null, branch: 'web' });
        return;
      }
      set({ phase: 'available', version: latest, notes: release.body ?? null, branch: 'web' });
    } catch (error) {
      set({ phase: 'error', error: formatMessage(error, 'Could not reach GitHub. Check your connection.') });
    }
  },

  downloadAndInstall: async () => {
    const { branch } = get();

    // Android: stream the APK into the app cache with real progress, then hand
    // it to the system package installer. The installer UI always shows; on a
    // successful install Android replaces the app and kills the process.
    if (branch === 'android') {
      if (!pendingApk || !pendingApk.assetUrl) {
        set({ phase: 'error', error: 'The update is no longer available. Please check again.' });
        return;
      }
      set({
        phase: 'downloading',
        downloadedBytes: 0,
        totalBytes: pendingApk.assetSize,
        error: null,
      });
      try {
        const res = await nativeFetch(pendingApk.assetUrl, {
          headers: { Accept: 'application/octet-stream' },
        });
        if (!res.ok) throw new Error(`GitHub returned HTTP ${res.status}`);

        const lengthHeader = res.headers.get('content-length');
        const totalBytes = lengthHeader ? Number(lengthHeader) || pendingApk.assetSize : pendingApk.assetSize;
        if (totalBytes && totalBytes !== pendingApk.assetSize) {
          set({ totalBytes });
        }

        const file = await open(APK_NAME, {
          write: true,
          create: true,
          truncate: true,
          baseDir: BaseDirectory.AppCache,
        });
        const apkPath = await join(await appCacheDir(), APK_NAME);
        try {
          if (!res.body) throw new Error('The download stream was empty.');
          const reader = res.body.getReader();
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!value || value.byteLength === 0) continue;
            await file.write(value);
            set(state => ({ downloadedBytes: state.downloadedBytes + value.byteLength }));
          }
        } finally {
          await file.close();
        }

        // Make sure "install unknown apps" is allowed for MeMo before launching the installer
        set({ phase: 'installing' });
        if (!(await canInstall())) {
          await requestInstallPermission();
          if (!(await canInstall())) {
            set({
              phase: 'error',
              error: 'Please allow "Install unknown apps" for MeMo, then try again.',
            });
            return;
          }
        }
        await install(apkPath);
        set({ phase: 'installed' });
      } catch (error) {
        set({
          phase: 'error',
          error: formatMessage(error, 'The update could not be downloaded or installed. Please try again.'),
        });
      }
      return;
    }

    // Desktop: the official updater — downloads, verifies and installs, then
    // the user restarts into the new version.
    if (branch === 'desktop' && activeUpdate) {
      set({ phase: 'downloading', downloadedBytes: 0, totalBytes: null, error: null });
      try {
        await activeUpdate.downloadAndInstall((event) => {
          if (event.event === 'Started') {
            set({ totalBytes: event.data.contentLength ?? null });
            return;
          }
          if (event.event === 'Progress') {
            set(state => ({ downloadedBytes: state.downloadedBytes + event.data.chunkLength }));
            return;
          }
          if (event.event === 'Finished') {
            set({ phase: 'installing' });
          }
        });
        set({ phase: 'installed' });
      } catch (error) {
        set({ phase: 'error', error: formatMessage(error, 'The update could not be installed. Please try again.') });
      }
      return;
    }

    // Web preview (and desktop without a native update resource) —
    // take the user to the release page instead
    window.open(RELEASES_URL, '_blank', 'noopener,noreferrer');
    set({ phase: 'upToDate', open: false });
  },

  restartNow: async () => {
    try {
      await relaunch();
    } catch (error) {
      set({ phase: 'error', error: formatMessage(error, 'Restart failed. Please close and reopen the app.') });
    }
  },

  dismiss: () => {
    set({ open: false, phase: 'idle', version: null, notes: null, downloadedBytes: 0, totalBytes: null, error: null, branch: null });
    activeUpdate?.close().catch(() => {});
    activeUpdate = null;
    pendingApk = null;
  },
}));
