import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, ChevronLeft, ChevronRight, Heart, Users, Share2, Copy, CheckCircle, AlertCircle, Calendar, ArrowRight, Shield, Link as LinkIcon, Unlink, Smartphone, ClipboardPaste } from 'lucide-react';
import { cn, dateKey, formatDateKeyFull } from '@/utils/helpers';
import { GlassView, Button, GlassCard, MotionGlassCard, ModalBackdrop } from '@/components/ui/GlassComponents';
import { UserRole } from '@/types';
import { createPortal } from 'react-dom';
import { usePairingStore } from '@/stores';
import { useUserStore } from '@/stores';
import { useToast } from '@/components/ui/CustomModals';
import { PAIRING_ERROR_MESSAGES } from '@/stores/pairingStore';

interface PairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Where the modal opens: the code it shows first */
  initialStep?: 'generate' | 'enter';
}

export const PairingModal: React.FC<PairingModalProps> = ({
  isOpen,
  onClose,
  initialStep = 'generate',
}) => {
  const [step, setStep] = useState<'generate' | 'enter' | 'success'>('generate');
  const [generatedCode, setGeneratedCode] = useState('');
  const [enteredCode, setEnteredCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState<{ anniversaryDate: string; partnerRole: UserRole } | null>(null);

  const { generateCode, enterCode, shareCode, copyCode, clearError } = usePairingStore();
  const { profile, deviceId } = useUserStore();
  const { showToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setStep(initialStep);
      setGeneratedCode('');
      setEnteredCode('');
      setError('');
      setSuccessData(null);
      clearError();
    }
  }, [isOpen, initialStep, clearError]);

  const handleGenerate = async () => {
    if (!profile) return;
    setLoading(true);
    setError('');
    try {
      const code = await generateCode(profile.role, profile.name);
      setGeneratedCode(code);
      setStep('generate');
    } catch (err) {
      setError('Failed to generate code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEnter = async () => {
    // Remove spaces from entered code
    const cleanCode = enteredCode.replace(/\s/g, '').toUpperCase();
    if (!cleanCode || cleanCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await enterCode(cleanCode);
      if (result.success) {
        setSuccessData({
          anniversaryDate: result.anniversaryDate || dateKey(),
          partnerRole: result.pairedRole || (profile?.role === 'girl' ? 'boy' : 'girl'),
        });
        setStep('success');
        showToast('Devices paired 💕', 'success');
      } else {
        setError(PAIRING_ERROR_MESSAGES[result.reason ?? ''] ?? 'Invalid or expired code. Please check and try again.');
      }
    } catch (err) {
      setError('Failed to pair. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Remember the code this device just copied/shared so "Paste Code" can
  // fill it later without any permission prompt.
  const rememberCopiedCode = (cleanCode: string) => {
    try {
      localStorage.setItem('memo_last_copied_code', cleanCode);
    } catch {
      // private mode — the direct clipboard read in Paste still works
    }
  };

  const handleShare = async () => {
    if (!generatedCode) return;
    const cleanCode = generatedCode.replace(/\s/g, '');

    // Real share sheet — the partner picks Telegram / Gmail / SMS / … from there
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'MeMo 💕',
          text: `Join me on MeMo 💕 — our cycle, anniversaries & milestones, together.\n\nPairing code: ${cleanCode}\n(the code expires in 24 hours)`,
        });
        rememberCopiedCode(cleanCode);
        showToast('Code shared 💕', 'success');
        return;
      } catch (error) {
        if ((error as Error | undefined)?.name === 'AbortError') return; // user dismissed
        // fall back to clipboard below
      }
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(cleanCode);
      } else {
        const input = document.getElementById('pairing-code-hidden') as HTMLInputElement | null;
        input?.select();
        document.execCommand('copy');
      }
      rememberCopiedCode(cleanCode);
      showToast('Code copied — share it from your clipboard', 'success');
    } catch {
      showToast('Could not share the code — try copying it', 'error');
    }
  };

  const handleCopy = async () => {
    if (!generatedCode) return;
    const cleanCode = generatedCode.replace(/\s/g, '');
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(cleanCode);
      } else {
        const input = document.getElementById('pairing-code-hidden') as HTMLInputElement | null;
        input?.select();
        document.execCommand('copy');
      }
      rememberCopiedCode(cleanCode);
      const hiddenInput = document.getElementById('pairing-code-hidden') as HTMLInputElement | null;
      if (hiddenInput) hiddenInput.select();
      showToast('Code copied 💕', 'success');
    } catch {
      showToast('Could not copy — long-press the code to copy it', 'error');
    }
  };

  // Read the clipboard and fill the 6 boxes — but only silently when the user
  // has already granted clipboard-read access. Otherwise focus box 1 and let
  // them paste with Ctrl/Cmd+V. Never triggers a native permission prompt.
  // Fill the 6 boxes from a raw clipboard string
  const fillFromClipboardText = (raw: string) => {
    const clean = (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (clean.length !== 6) return false;
    setEnteredCode(clean);
    setError('');
    return true;
  };

  const handlePaste = async () => {
    // Try the clipboard first — on a real user tap most browsers fill this in
    // silently. If the browser says no, fall back to the code this device last
    // copied inside the app. No permission popup, no Ctrl+V instructions.
    let readOk = false;
    try {
      const raw = await navigator.clipboard.readText();
      readOk = true;
      if (fillFromClipboardText(raw)) {
        showToast('Code pasted 💕', 'success');
        return;
      }
      showToast("Clipboard doesn't hold a 6-character code", 'error');
      return;
    } catch {
      // clipboard read blocked — fall back to the in-app memory below
    }

    if (!readOk) {
      try {
        const saved = localStorage.getItem('memo_last_copied_code');
        if (saved && fillFromClipboardText(saved)) {
          showToast('Code pasted 💕', 'success');
          return;
        }
      } catch {
        // ignore
      }
    }

    showToast('Nothing to paste yet — copy the code your partner shared first', 'error');
  };

  // Universal paste handler for the code grid: works with Ctrl/Cmd+V,
  // Android's paste suggestion, and long-press paste — no permission needed.
  const handleCodeGridPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const text = e.clipboardData?.getData('text') ?? '';
    if (fillFromClipboardText(text)) {
      e.preventDefault();
      showToast('Code pasted 💕', 'success');
    }
  };

  const modalContent = (
    <ModalBackdrop isOpen={isOpen} onClose={onClose}>
      <GlassView className="modal-surface rounded-3xl sm:rounded-2xl overflow-hidden flex flex-col w-full max-w-md max-h-[92dvh]">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-between p-4 border-b border-border flex-shrink-0"
        >
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-subtle transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-text-muted" />
          </motion.button>
          <h2 className="text-h3 font-bold text-text">Pair with Partner</h2>
          <div className="w-10" />
        </motion.div>

        {/* Steps Indicator */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="px-4 py-3 border-b border-border flex-shrink-0"
        >
          <div className="flex items-center justify-center gap-2">
            {['generate', 'enter', 'success'].map((s, i) => (
              <motion.div
                key={s}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1, type: 'spring', stiffness: 300, damping: 25 }}
                className="flex items-center"
              >
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-caption font-medium transition-all',
                  step === s || (step === 'success' && i < 2)
                    ? 'bg-accent text-on-accent'
                    : 'bg-input text-text-muted'
                )}>
                  {step === 'success' && i < 2 ? <CheckCircle className="w-5 h-5" /> : i + 1}
                </div>
                {i < 2 && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: step === 'success' || (step === 'enter' && i === 0) ? '100%' : 0 }}
                    transition={{ delay: i * 0.1 + 0.2, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className={cn(
                      'flex-1 max-w-12 h-1 rounded transition-all',
                      step === 'success' || (step === 'enter' && i === 0) ? 'bg-accent' : 'bg-input'
                    )} />
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="mb-4 p-3 rounded-xl bg-error-light border border-error/20 text-error text-body-sm flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          {/* Generate Code Step */}
          {step === 'generate' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 20 }}
                  className="w-16 h-16 rounded-2xl bg-accent-light flex items-center justify-center mx-auto mb-4"
                >
                  <Heart className="w-8 h-8 text-accent" />
                </motion.div>
                <h3 className="text-h2 font-bold text-text">Generate Your Code</h3>
                <p className="text-text-muted mt-2">Share this 6-digit code with your partner to connect</p>
              </div>

              {generatedCode ? (
                <MotionGlassCard className="p-6 text-center" elevated>
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <span className="text-caption font-medium text-text-muted uppercase tracking-wider">Your Code</span>
                    <span className="w-px h-6 bg-border" />
                    <span className="text-caption font-medium text-text-muted uppercase tracking-wider">Expires in 24h</span>
                  </div>
                  <motion.div
                    initial={{ letterSpacing: '1.2em', opacity: 0 }}
                    animate={{ letterSpacing: '0.32em', opacity: 1 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="font-mono text-3xl sm:text-4xl md:text-5xl font-bold text-text tracking-widest mb-4 select-all break-all"
                  >
                    {generatedCode.match(/.{1,3}/g)?.join(' ') || generatedCode}
                  </motion.div>
                  
                  {/* Hidden input for clean copy */}
                  <input 
                    type="text" 
                    value={generatedCode} 
                    readOnly 
                    className="hidden" 
                    id="pairing-code-hidden"
                  />
                  
                  <div className="flex items-center justify-center gap-3">
                    <Button variant="secondary" onClick={handleShare} className="flex-1">
                      <Share2 className="w-4 h-4 mr-2" />
                      Share
                    </Button>
                    <Button variant="ghost" onClick={handleCopy} className="flex-1">
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                  </div>
                  <p className="text-caption text-text-muted mt-4">Code expires in 24 hours</p>
                </MotionGlassCard>
              ) : (
                <Button 
                  variant="primary" 
                  onClick={handleGenerate} 
                  loading={loading}
                  className="w-full py-4"
                  size="lg"
                >
                  Generate Pairing Code
                </Button>
              )}

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-center"
              >
                <p className="text-caption text-text-muted">Or</p>
              </motion.div>

              <Button 
                variant="secondary" 
                onClick={() => setStep('enter')}
                className="w-full"
              >
                I Have a Code
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </motion.div>
          )}

          {/* Enter Code Step */}
          {step === 'enter' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 20 }}
                  className="w-16 h-16 rounded-2xl bg-secondary-light flex items-center justify-center mx-auto mb-4"
                >
                  <Users className="w-8 h-8 text-secondary" />
                </motion.div>
                <h3 className="text-h2 font-bold text-text">Enter Partner's Code</h3>
                <p className="text-text-muted mt-2">Enter the 6-digit code your partner shared with you</p>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                className="flex items-center justify-center gap-1.5 sm:gap-3"
                onPaste={handleCodeGridPaste}
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <motion.input
                    key={i}
                    type="text"
                    maxLength={1}
                    value={enteredCode[i] || ''}
                    onChange={e => {
                      const val = e.target.value.toUpperCase();
                      if (/^[A-Z0-9]$/.test(val) || val === '') {
                        setEnteredCode(prev => prev.slice(0, i) + val + prev.slice(i + 1));
                        if (val && i < 5) {
                          const nextInput = document.querySelectorAll('input[maxLength="1"]')[i + 1] as HTMLInputElement;
                          nextInput?.focus();
                        }
                      }
                      if (!val && i > 0) {
                        const prevInput = document.querySelectorAll('input[maxLength="1"]')[i - 1] as HTMLInputElement;
                        prevInput?.focus();
                      }
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Backspace' && !enteredCode[i] && i > 0) {
                        const prevInput = document.querySelectorAll('input[maxLength="1"]')[i - 1] as HTMLInputElement;
                        prevInput?.focus();
                      }
                    }}
                    className="w-10 h-14 sm:w-12 sm:h-16 text-center text-xl sm:text-2xl font-bold rounded-xl bg-input border border-border text-text focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                    autoComplete="off"
                    inputMode="text"
                    initial={false}
                    whileFocus={{ scale: 1.05, borderColor: 'var(--color-accent)' }}
                    transition={{ duration: 0.2 }}
                  />
                ))}
              </motion.div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  onClick={handlePaste}
                  className="w-full"
                >
                  <ClipboardPaste className="w-4 h-4 mr-2" />
                  Paste Code
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setStep('generate')}
                  className="w-full"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Generate
                </Button>
              </div>

              <Button
                variant="primary"
                onClick={handleEnter}
                loading={loading}
                disabled={enteredCode.length !== 6}
                className="w-full py-4"
                size="lg"
              >
                Pair Devices
              </Button>
            </motion.div>
          )}

          {/* Success Step */}
          {step === 'success' && successData && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-6 text-center"
            >
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 20 }}
                className="w-20 h-20 rounded-full bg-success-light flex items-center justify-center mx-auto mb-4"
              >
                <CheckCircle className="w-10 h-10 text-success" />
              </motion.div>
              <h3 className="text-h2 font-bold text-text">Successfully Paired!</h3>
              <p className="text-text-muted">You're now connected with your partner</p>

              <MotionGlassCard className="p-4" elevated>
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-3 p-3 rounded-xl bg-accent-light">
                    <Users className="w-6 h-6 text-accent" />
                    <div className="text-center">
                      <p className="font-medium text-text">Partner Role</p>
                      <p className="text-caption text-text-secondary capitalize">{successData.partnerRole}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-3 p-3 rounded-xl bg-secondary-light">
                    <Calendar className="w-6 h-6 text-secondary" />
                    <div className="text-center">
                      <p className="font-medium text-text">Anniversary Set</p>
                      <p className="text-caption text-text-secondary">{new Date(successData.anniversaryDate).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                  </div>
                </div>
              </MotionGlassCard>

              <Button 
                variant="primary" 
                onClick={onClose}
                className="w-full py-4"
                size="lg"
              >
                Continue to App
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </motion.div>
          )}
        </div>
      </GlassView>
    </ModalBackdrop>
  );

  if (!isOpen) return null;

  return createPortal(modalContent, document.body);
};