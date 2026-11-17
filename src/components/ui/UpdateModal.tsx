import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, CheckCircle2, AlertCircle, ArrowDownToLine, RotateCcw, Loader2 } from 'lucide-react';
import { GlassView, Button } from '@/components/ui/GlassComponents';
import { useUpdaterStore } from '@/stores/updaterStore';

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes)) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
};

/** Portal-hosted modal shown automatically when a newer release exists on GitHub */
export const UpdateModal: React.FC = () => {
  const { phase, open, version, notes, downloadedBytes, totalBytes, error, branch, downloadAndInstall, restartNow, checkNow, dismiss } = useUpdaterStore();
  const [appVersion, setAppVersion] = React.useState('1.0.0');
  const isAndroid = branch === 'android';

  React.useEffect(() => {
    let mounted = true;
    void import('@tauri-apps/api/app')
      .then(({ getVersion }) => getVersion())
      .then(v => { if (mounted && v) setAppVersion(v); })
      .catch(() => { /* keep the fallback on non-Tauri builds */ });
    return () => { mounted = false; };
  }, []);

  const percent = totalBytes && totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="update-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[550] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-3 sm:p-4"
          onClick={phase === 'downloading' || phase === 'installing' ? undefined : dismiss}
        >
          <motion.div
            initial={{ opacity: 0, y: 90, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 70, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <GlassView className="modal-surface rounded-3xl overflow-hidden">
              {/* Hero brand block */}
              <div
                className="relative px-5 pt-5 pb-5 sm:px-6 sm:pt-6 sm:pb-6 border-b border-border overflow-hidden"
                style={{ background: 'linear-gradient(155deg, rgba(235,154,192,0.32) 0%, rgba(186,128,240,0.28) 55%, rgba(39,24,59,0.12) 100%)' }}
              >
                <div aria-hidden className="absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(235,154,192,0.5), transparent 70%)' }} />
                <div aria-hidden className="absolute -bottom-20 -left-14 w-48 h-48 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(186,128,240,0.45), transparent 70%)' }} />
                <div className="relative flex items-center gap-3">
                  <img
                    src="/memo-logo.png"
                    alt="MeMo"
                    draggable={false}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover ring-1 ring-white/20 shadow-2xl flex-shrink-0 select-none"
                  />
                  <div className="min-w-0">
                    <p className="text-[10px] tracking-[0.24em] uppercase text-text-muted font-semibold">MeMo</p>
                    <h2 className="text-h3 sm:text-h2 font-extrabold tracking-tight text-text">
                      {phase === 'installed' ? (isAndroid ? 'Ready to install' : 'Updated') : phase === 'upToDate' ? "You're up to date" : 'New update'}
                    </h2>
                    <p className="text-caption text-text-muted">{phase === 'installed' ? `Version ${version}` : phase === 'upToDate' ? `Current version ${appVersion}` : 'Ready to download'}</p>
                  </div>
                  {phase !== 'downloading' && phase !== 'installing' && (
                    <button
                      onClick={dismiss}
                      className="ml-auto p-1.5 rounded-lg hover:bg-surface-subtle transition-colors flex-shrink-0"
                      aria-label="Close"
                    >
                      <X className="w-5 h-5 text-text-muted" />
                    </button>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="p-5 sm:p-6">
                {phase === 'available' && (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-accent-light text-accent">
                        <ArrowDownToLine className="w-3.5 h-3.5" />
                        Version {version}
                      </span>
                      <span className="text-caption text-text-muted">from v{appVersion}</span>
                    </div>
                    {notes ? (
                      <div className="rounded-2xl bg-input border border-border p-4 max-h-40 overflow-y-auto overscroll-contain">
                        <p className="text-caption font-medium text-text-secondary mb-1 uppercase tracking-wider">What's new</p>
                        <p className="text-body-sm text-text-secondary whitespace-pre-line">{notes}</p>
                      </div>
                    ) : (
                      <p className="text-body-sm text-text-secondary">The new version is ready to install. Your data, pairing and settings stay exactly as they are.</p>
                    )}
                    <div className="mt-5 flex flex-col gap-2">
                      <Button variant="primary" size="lg" onClick={downloadAndInstall} className="w-full min-h-14">
                        <Download className="w-5 h-5 mr-2" />
                        Download Update
                      </Button>
                      <button onClick={dismiss} className="w-full py-2.5 text-caption font-semibold text-text-muted hover:text-text transition-colors">
                        Later
                      </button>
                    </div>
                    <p className="text-caption text-text-muted normal-case mt-3 text-center">{isAndroid ? 'Android will open the package installer when the download finishes' : 'The update installs when the download finishes'}</p>
                  </>
                )}

                {phase === 'downloading' && (
                  <div className="text-center py-2">
                    <p className="text-h3 font-extrabold tracking-tight text-text">{percent !== null ? `${percent}` : '···'}<span className="text-xl text-accent align-top">%</span></p>
                    <p className="text-body-sm text-text-secondary mt-1">Downloading update{version ? ` ${version}` : ''}…</p>
                    <div
                      className="mt-4 h-2.5 w-full rounded-full bg-input border border-border overflow-hidden"
                      role="progressbar"
                      aria-valuenow={percent ?? undefined}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Update download progress"
                    >
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: 'linear-gradient(90deg, var(--color-accent), var(--color-secondary))' }}
                        animate={{ width: `${percent ?? 50}%` }}
                        transition={{ type: 'spring', stiffness: 120, damping: 22 }}
                      />
                    </div>
                    <p className="text-caption text-text-muted mt-3 tabular-nums">
                      {formatBytes(downloadedBytes)}{totalBytes ? ` of ${formatBytes(totalBytes)}` : ''}
                    </p>
                    <p className="text-caption text-text-muted normal-case mt-1">Keep the app open until the download finishes.</p>
                  </div>
                )}

                {phase === 'installing' && (
                  <div className="text-center py-4">
                    <Loader2 className="w-10 h-10 text-accent animate-spin mx-auto" />
                    <p className="text-h3 font-bold text-text mt-4">{isAndroid ? 'Opening Android installer…' : 'Installing update…'}</p>
                    <p className="text-body-sm text-text-muted mt-1">{isAndroid ? 'Tap Install when the Android prompt appears.' : 'This only takes a moment.'}</p>
                  </div>
                )}

                {phase === 'installed' && (
                  <div className="text-center py-2">
                    <CheckCircle2 className="w-14 h-14 text-success mx-auto" />
                    <p className="text-h3 font-extrabold text-text mt-3">{isAndroid ? 'Android installer is open' : 'Update installed'}</p>
                    <p className="text-body-sm text-text-secondary mt-1">
                      {isAndroid
                        ? `Tap Install in the Android prompt. Android replaces MeMo with v${version} and closes it — just open MeMo again afterwards. Your data, pairing and settings stay as they are.`
                        : `MeMo v${version} is ready. Restart the app to finish.`}
                    </p>
                    <div className="mt-5 flex flex-col gap-2">
                      <Button variant="primary" size="lg" onClick={restartNow} className="w-full min-h-14">
                        <RotateCcw className="w-5 h-5 mr-2" />
                        Restart Now
                      </Button>
                      <button onClick={dismiss} className="w-full py-2.5 text-caption font-semibold text-text-muted hover:text-text transition-colors">
                        Later
                      </button>
                    </div>
                  </div>
                )}

                {phase === 'upToDate' && (
                  <div className="text-center py-2">
                    <CheckCircle2 className="w-14 h-14 text-success mx-auto" />
                    <p className="text-h3 font-extrabold text-text mt-3">You're up to date</p>
                    <p className="text-body-sm text-text-secondary mt-1">MeMo v{appVersion} is the latest release on GitHub.</p>
                    <div className="mt-5">
                      <Button variant="primary" size="lg" onClick={dismiss} className="w-full min-h-14">
                        OK
                      </Button>
                    </div>
                  </div>
                )}

                {phase === 'error' && (
                  <div className="text-center py-2">
                    <AlertCircle className="w-14 h-14 text-error mx-auto" />
                    <p className="text-h3 font-extrabold text-text mt-3">Couldn't update</p>
                    <p className="text-body-sm text-text-secondary mt-1">{error}</p>
                    <div className="mt-5 flex flex-col gap-2">
                      <Button variant="primary" size="lg" onClick={checkNow} className="w-full min-h-14">
                        Try again
                      </Button>
                      <button onClick={dismiss} className="w-full py-2.5 text-caption font-semibold text-text-muted hover:text-text transition-colors">
                        Later
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </GlassView>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
