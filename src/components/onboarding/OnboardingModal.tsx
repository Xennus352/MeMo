import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronRight, ChevronLeft, Heart, Sparkles, Droplet, Calendar, Users, Shield, Bell, CheckCircle, ArrowRight, Image, Lock, Eye } from 'lucide-react';
import { cn, dateKey } from '@/utils/helpers';
import { GlassView, Button, GlassCard, MotionGlassCard, ModalBackdrop } from '@/components/ui/GlassComponents';
import { UserRole } from '@/types';
import { createPortal } from 'react-dom';

const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to MeMo 💕',
    subtitle: 'Your private space for two',
    icon: Heart,
    description: 'Track periods, celebrate milestones, and stay in sync with your partner — all in one beautiful app.',
  },
  {
    id: 'role',
    title: 'Who are you?',
    subtitle: 'Choose your role',
    icon: Users,
    description: 'This helps us personalize your experience and enable partner features.',
  },
  {
    id: 'period',
    title: 'Period Tracking',
    subtitle: 'Log your cycle with ease',
    icon: Droplet,
    description: 'Track periods, flow, symptoms, and get smart predictions for your next cycle.',
  },
  {
    id: 'milestones',
    title: 'Shared Milestones',
    subtitle: 'Celebrate together',
    icon: Sparkles,
    description: 'Create and share anniversaries, memories, and special moments with your partner.',
  },
  {
    id: 'pairing',
    title: 'Connect with Partner',
    subtitle: 'Pair your devices',
    icon: Calendar,
    description: 'Generate a 6-digit code to securely link with your partner and share data.',
  },
  {
    id: 'privacy',
    title: 'Privacy First',
    subtitle: 'Your data stays yours',
    icon: Shield,
    description: 'All data is stored locally on your device. No cloud, no tracking, completely private.',
  },
  {
    id: 'notifications',
    title: 'Smart Reminders',
    subtitle: 'Never miss a moment',
    icon: Bell,
    description: 'Get gentle reminders for periods, ovulation, milestones, and anniversaries.',
  },
];

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (role: UserRole, name: string) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [role, setRole] = useState<UserRole | null>(null);
  const [name, setName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      setRole(null);
      setName('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleRoleSelect = (selectedRole: UserRole) => {
    setRole(selectedRole);
  };

  const handleComplete = () => {
    if (role && name.trim()) {
      onComplete(role, name.trim());
    }
  };

  const currentStepData = STEPS[currentStep];

  const renderRoleStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="text-center mb-8"
    >
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 20 }}
        className="w-16 h-16 rounded-2xl bg-accent-light flex items-center justify-center mx-auto mb-4"
      >
        <currentStepData.icon className="w-8 h-8 text-accent" />
      </motion.div>
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.3 }}
        className="text-h2 font-bold text-text"
      >
        {currentStepData.title}
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.3 }}
        className="text-text-muted mt-2"
      >
        {currentStepData.description}
      </motion.p>
    </motion.div>
  );

  const renderRegularStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="text-center mb-8"
    >
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 20 }}
        className="w-16 h-16 rounded-2xl bg-accent-light flex items-center justify-center mx-auto mb-4"
      >
        <currentStepData.icon className="w-8 h-8 text-accent" />
      </motion.div>
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.3 }}
        className="text-h2 font-bold text-text"
      >
        {currentStepData.title}
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.3 }}
        className="text-text-muted mt-2"
      >
        {currentStepData.subtitle}
      </motion.p>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.3 }}
        className="text-text-secondary mt-4 max-w-md mx-auto"
      >
        {currentStepData.description}
      </motion.p>
    </motion.div>
  );

  const renderPeriodFeatures = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-3"
    >
      <MotionGlassCard className="p-4" delay={0}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-accent-light flex items-center justify-center">
            <Calendar className="w-6 h-6 text-accent" />
          </div>
          <div>
            <p className="font-medium text-text">Smart Predictions</p>
            <p className="text-caption text-text-muted">AI-powered cycle forecasting</p>
          </div>
        </div>
      </MotionGlassCard>
      <MotionGlassCard className="p-4" delay={60}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-secondary-light flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-secondary" />
          </div>
          <div>
            <p className="font-medium text-text">Fertile Window</p>
            <p className="text-caption text-text-muted">Know your most fertile days</p>
          </div>
        </div>
      </MotionGlassCard>
      <MotionGlassCard className="p-4" delay={120}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-accent-light flex items-center justify-center">
            <Droplet className="w-6 h-6 text-accent" />
          </div>
          <div>
            <p className="font-medium text-text">Symptom Tracking</p>
            <p className="text-caption text-text-muted">Log flow, mood, and more</p>
          </div>
        </div>
      </MotionGlassCard>
    </motion.div>
  );

  const renderMilestonesFeatures = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-3"
    >
      <MotionGlassCard className="p-4" delay={0}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-secondary-light flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-secondary" />
          </div>
          <div>
            <p className="font-medium text-text">Anniversaries</p>
            <p className="text-caption text-text-muted">Never forget special dates</p>
          </div>
        </div>
      </MotionGlassCard>
      <MotionGlassCard className="p-4" delay={60}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-accent-light flex items-center justify-center">
            <Heart className="w-6 h-6 text-accent" />
          </div>
          <div>
            <p className="font-medium text-text">Shared Memories</p>
            <p className="text-caption text-text-muted">Create moments together</p>
          </div>
        </div>
      </MotionGlassCard>
      <MotionGlassCard className="p-4" delay={120}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-accent-light flex items-center justify-center">
            <Image className="w-6 h-6 text-accent" />
          </div>
          <div>
            <p className="font-medium text-text">Photos & Notes</p>
            <p className="text-caption text-text-muted">Attach memories to milestones</p>
          </div>
        </div>
      </MotionGlassCard>
    </motion.div>
  );

  const renderPairingFeatures = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-3"
    >
      <MotionGlassCard className="p-4" delay={0}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-accent-light flex items-center justify-center">
            <Users className="w-6 h-6 text-accent" />
          </div>
          <div>
            <p className="font-medium text-text">6-Digit Code</p>
            <p className="text-caption text-text-muted">Simple, secure pairing</p>
          </div>
        </div>
      </MotionGlassCard>
      <MotionGlassCard className="p-4" delay={60}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-secondary-light flex items-center justify-center">
            <Shield className="w-6 h-6 text-secondary" />
          </div>
          <div>
            <p className="font-medium text-text">Cross-Device Sync</p>
            <p className="text-caption text-text-muted">See each other's data</p>
          </div>
        </div>
      </MotionGlassCard>
      <MotionGlassCard className="p-4" delay={120}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-accent-light flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-accent" />
          </div>
          <div>
            <p className="font-medium text-text">Shared Control</p>
            <p className="text-caption text-text-muted">Both can add/edit data</p>
          </div>
        </div>
      </MotionGlassCard>
    </motion.div>
  );

  const renderPrivacyFeatures = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-3"
    >
      <MotionGlassCard className="p-4" delay={0}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-accent-light flex items-center justify-center">
            <Shield className="w-6 h-6 text-accent" />
          </div>
          <div>
            <p className="font-medium text-text">Local-First Storage</p>
            <p className="text-caption text-text-muted">All data stays on your device</p>
          </div>
        </div>
      </MotionGlassCard>
      <MotionGlassCard className="p-4" delay={60}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-secondary-light flex items-center justify-center">
            <Lock className="w-6 h-6 text-secondary" />
          </div>
          <div>
            <p className="font-medium text-text">No Cloud Sync</p>
            <p className="text-caption text-text-muted">Zero server-side data</p>
          </div>
        </div>
      </MotionGlassCard>
      <MotionGlassCard className="p-4" delay={120}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-accent-light flex items-center justify-center">
            <Eye className="w-6 h-6 text-accent" />
          </div>
          <div>
            <p className="font-medium text-text">No Tracking</p>
            <p className="text-caption text-text-muted">No analytics, no ads</p>
          </div>
        </div>
      </MotionGlassCard>
    </motion.div>
  );

  const renderNotificationsFeatures = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-3"
    >
      <MotionGlassCard className="p-4" delay={0}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-accent-light flex items-center justify-center">
            <Bell className="w-6 h-6 text-accent" />
          </div>
          <div>
            <p className="font-medium text-text">Period Reminders</p>
            <p className="text-caption text-text-muted">Know when it's coming</p>
          </div>
        </div>
      </MotionGlassCard>
      <MotionGlassCard className="p-4" delay={60}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-secondary-light flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-secondary" />
          </div>
          <div>
            <p className="font-medium text-text">Ovulation Alerts</p>
            <p className="text-caption text-text-muted">Fertile window notifications</p>
          </div>
        </div>
      </MotionGlassCard>
      <MotionGlassCard className="p-4" delay={120}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-accent-light flex items-center justify-center">
            <Calendar className="w-6 h-6 text-accent" />
          </div>
          <div>
            <p className="font-medium text-text">Milestone Reminders</p>
            <p className="text-caption text-text-muted">Upcoming anniversaries</p>
          </div>
        </div>
      </MotionGlassCard>
    </motion.div>
  );

  const renderStepContent = () => {
    if (currentStepData.id === 'role') {
      return (
        <>
          {renderRoleStep()}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="grid grid-cols-2 gap-3 sm:gap-4 mb-6"
          >
            {['girl', 'boy'].map(r => (
              <motion.button
                key={r}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleRoleSelect(r as UserRole)}
                className={cn(
                  'p-4 sm:p-6 rounded-2xl border-2 transition-all',
                  role === r
                    ? 'border-accent bg-accent-light'
                    : 'border-border hover:border-accent/50'
                )}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: 'spring', stiffness: 300, damping: 20 }}
                  className="text-4xl mb-2"
                >
                  {r === 'girl' ? '👧' : '👦'}
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="font-semibold text-text capitalize"
                >
                  {r}
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-caption text-text-muted mt-1"
                >
                  {r === 'girl' ? 'Track your cycle' : 'Support your partner'}
                </motion.div>
              </motion.button>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.4 }}
            className="mb-6"
          >
            <label className="block text-caption font-medium text-text-secondary mb-2">Your Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-3 rounded-xl bg-input border border-border text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-center"
            />
          </motion.div>
        </>
      );
    }

    if (currentStepData.id === 'period') {
      return <>{renderRegularStep()}{renderPeriodFeatures()}</>;
    }
    if (currentStepData.id === 'milestones') {
      return <>{renderRegularStep()}{renderMilestonesFeatures()}</>;
    }
    if (currentStepData.id === 'pairing') {
      return <>{renderRegularStep()}{renderPairingFeatures()}</>;
    }
    if (currentStepData.id === 'privacy') {
      return <>{renderRegularStep()}{renderPrivacyFeatures()}</>;
    }
    if (currentStepData.id === 'notifications') {
      return <>{renderRegularStep()}{renderNotificationsFeatures()}</>;
    }
    return <>{renderRegularStep()}</>;
  };

  const modalContent = (
    <motion.div
      initial={false}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: -20 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg my-auto"
        onClick={e => e.stopPropagation()}
      >
        <GlassView className="modal-surface rounded-3xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[92dvh]">
          {/* Progress Indicator */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="px-3 sm:px-6 py-3 sm:py-4 border-b border-border flex-shrink-0 overflow-x-auto"
          >
            <div className="flex items-center justify-between">
              {STEPS.map((step, index) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05, type: 'spring', stiffness: 300, damping: 25 }}
                  className="flex items-center"
                >
                  <div className={cn(
                    'w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[11px] sm:text-caption font-semibold transition-all flex-shrink-0',
                    index < currentStep ? 'bg-accent text-on-accent' :
                    index === currentStep ? 'bg-accent-light text-accent border-2 border-accent' :
                    'bg-input text-text-muted'
                  )}>
                    {index < currentStep ? <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" /> : index + 1}
                  </div>
                  {index < STEPS.length - 1 && (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: '100%' }}
                      transition={{ delay: index * 0.05 + 0.3, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      className={cn(
                        'flex-1 min-w-2 h-1 mx-1 sm:mx-2 rounded transition-all',
                        index < currentStep ? 'bg-accent' : 'bg-input'
                      )}
                    />
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Step Content */}
          <div className="p-4 sm:p-6 md:p-8 overflow-y-auto overscroll-contain">
            {renderStepContent()}

            {/* Navigation */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.4 }}
              className="flex flex-wrap justify-between gap-3 mt-6 sm:mt-8 pt-4 border-t border-border"
            >
              {currentStep > 0 && (
                <Button variant="ghost" onClick={prevStep}>
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              )}
              
              {currentStep < STEPS.length - 1 ? (
                <Button variant="primary" onClick={nextStep} disabled={currentStepData.id === 'role' && (!role || !name.trim())}>
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button variant="primary" onClick={handleComplete} disabled={!role || !name.trim()}>
                  Get Started
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </motion.div>
          </div>
        </GlassView>
      </motion.div>
    </motion.div>
  );

  if (!isOpen) return null;

  return createPortal(modalContent, document.body);
};