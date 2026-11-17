# MeMo 💕 — Auto-Update Setup

**What the user gets in the app:** when a new GitHub release is published, the app shows a full-screen **New update** dialog → **Download Update** → real **download progress %** (percent bar + bytes) → Android package installer appears → **Restart Now** closes and reopens MeMo.

## How it works

| | Android | Desktop |
|---|---|---|
| Check | GitHub Releases API (`/repos/Xennus352/MeMo/releases/latest`), finds the newest `.apk` asset | Tauri updater against `latest.json` |
| Download | `tauri-plugin-http` streaming, bytes → real progress % | `tauri-plugin-updater` built in |
| Progress | ReadableStream chunks, `asset.size` as total | `downloadAndInstall` Progress events |
| Install | `tauri-plugin-android-installer` launches the Android package installer (`ACTION_VIEW`, `application/vnd.android.package-archive`, FileProvider with `FLAG_GRANT_READ_URI_PERMISSION`) | updater installs itself |
| Restart | `plugin-process` `relaunch()` | `relaunch()` |
| Install-unknown-apps gate | handled: `canInstall()` → `requestInstallPermission()` if needed | n/a |

On Android, silent self-install is impossible by design (and Google requires it), so the installer prompt always appears. On a successful install Android replaces the app and kills the process — **the user just opens MeMo again** (it is the new version). The "Restart Now" button calls `relaunch()`; on Android this closes MeMo through the system transition.

## What's wired (code side)

- `src-tauri/Cargo.toml` — `tauri-plugin-updater`, `tauri-plugin-process`, `tauri-plugin-http`, `tauri-plugin-fs`, `tauri-plugin-opener`, `tauri-plugin-os`, `tauri-plugin-android-installer`
- `src-tauri/src/lib.rs` — all plugins registered
- `src-tauri/capabilities/default.json` — `updater:*`, `http:default`, `fs:allow-app-write-recursive`, `os:allow-platform`, `opener:default`, `android-installer:default`, `process:allow-restart`
- `src-tauri/tauri.conf.json` — `plugins.updater` (desktop path) + `plugins.http` scope limited to GitHub + `scopeRedirects: true`
- `src/stores/updaterStore.ts` — `autoCheck` at launch (Android: GitHub API version compare; desktop: updater `check()`), `downloadAndInstall`, `restartNow`
- `src/components/ui/UpdateModal.tsx` — auto dialog with percent progress + restart
- `src/App.tsx` — auto-check 2.5 s after startup (native only)
- About → **Check for updates** row in Settings

## Signing keys (keep secret)

- `~/.tauri/MeMo.key` — private key (never commit)
- `~/.tauri/MeMo.key.pub` — public key (committed in `tauri.conf.json`)
- `~/.tauri/MeMo-signer-password.txt` — password

## Publishing a new release (what you do on GitHub)

1. Bump `version` in `src-tauri/tauri.conf.json`, `package.json` **and** `src-tauri/Cargo.toml` (all three must match; e.g. `1.0.1`)
2. Build the Android APK as usual: `npx tauri build --android` (first time on your machine: `npx tauri android init` as well)
3. Create a GitHub release, tag `v1.0.1`, attach the signed APK, e.g. `MeMo-1.0.1.apk`
   - The updater finds the **largest `.apk`** in the release assets and shows it to everyone on a lower version
   - `.apk` files only — AAB/other artifacts are ignored
   - The release can also carry a desktop `latest.json` (see below); the Android path does not need it
4. Publish. Next app launch, paired devices see **New update → Download → Install → restart** automatically.

### Desktop `latest.json` (optional, only if you ship desktop builds)

```json
{
  "version": "1.0.1",
  "notes": "What's new",
  "pub_date": "2026-11-17T12:00:00Z",
  "platforms": {
    "linux-x86_64": {
      "urls": ["https://github.com/Xennus352/MeMo/releases/download/v1.0.1/MeMo_1.0.1_amd64.AppImage"],
      "signature": "<base64 signature: npx tauri signer sign <file> -p \"$(cat ~/.tauri/MeMo-signer-password.txt)\">"
    }
  }
}
```

Note: `tauri-plugin-updater` does **not** support Android, which is why the Android path uses the APK + installer flow above.

## Notes & gotchas

- **Locked-phone Shoon speech** ships in a local plugin (`src-tauri/plugins/shoon-alarm/`). On Android it wakes a foreground service at the scheduled second via AlarmManager: plays the pre-cached Shoon WAV, or falls back to the device's built-in TTS when the WAV isn't there (e.g., the phone can't reach the Nara server at that moment). WAVs are cached at schedule time in `appCacheDir/shoon/`. **For the real Shoon voice on the lock screen, the phone must reach the computer running `nara_tts_server.py`** (same Wi-Fi, e.g. `http://192.168.1.20:8899`) — set it in Settings → Notifications → AI Voice → *Voice server address*. A standalone phone with no reachable server still speaks, via Android's built-in Burmese TTS (voice quality depends on the phone; it is not Shoon).
- **iOS**: Shoon speaks only while the app is open. iOS forbids apps from waking just to talk, and notification sounds must be bundled with the app — a locked iPhone gets the tray notification with text (and sound), not Shoon's voice.
- **Boot restore**: the Shoon alarm plugin re-arms its alarms after a reboot by itself; the tray notification schedule is rebuilt by the app on its next launch.

- **First launch ever** (no GitHub releases): the check silently returns — no modal, no error.
- **Version compare** is `tag_name` with leading `v` stripped, numeric `major.minor.patch`, `1.0.1 > 1.0.0` is what triggers the modal.
- **Android "install unknown apps"**: Android 8+ requires MeMo to be allowed to install unknown apps once. The app detects this with `canInstall()` and opens the right settings screen automatically; if the user declines, the error state says exactly what to enable.
- **Signature mismatch**: the new APK must be signed with the same keystore as the installed build (the updater signing key above is unrelated to the APK signing key — for sideload updates both must match the original install). Otherwise Android refuses with "App not installed".
- **Restart on Android**: the process is replaced by the OS on successful install. "Restart Now" calls `relaunch()` (closes MeMo through the system transition); if the install already replaced the app, just reopen it.
- **Size**: the percent bar uses the asset `size` from the release metadata for the total, so very small downloads still show honest progress.
