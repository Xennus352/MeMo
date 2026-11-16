import React from 'react';
import { OnboardingModal } from '@/components/onboarding/OnboardingModal';

interface OnboardingScreenProps {
  onComplete: (role: 'boy' | 'girl', name: string) => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  return (
    <OnboardingModal
      isOpen={true}
      onClose={() => {}}
      onComplete={onComplete}
    />
  );
};