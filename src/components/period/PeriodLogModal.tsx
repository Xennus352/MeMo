import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Droplet, Heart, Sparkles, Trash2 } from 'lucide-react';
import { cn, formatDateKeyFull, dateKey } from '@/utils/helpers';
import { GlassView, Button, GlassCard } from '@/components/ui/GlassComponents';
import { useCustomModals } from '@/components/ui/CustomModals';
import { PeriodEntry, UserRole } from '@/types';
import { createPortal } from 'react-dom';

interface PeriodLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  existingEntry?: PeriodEntry;
  onSave: (entry: Omit<PeriodEntry, 'id' | 'synced' | 'createdAt' | 'updatedAt'>) => void;
  onDelete?: (date: string) => void;
  userRole: UserRole;
}

const SYMPTOMS = [
  { id: 'cramps', label: 'Cramps', icon: Heart },
  { id: 'headache', label: 'Headache', icon: Sparkles },
  { id: 'bloating', label: 'Bloating', icon: Droplet },
  { id: 'mood', label: 'Mood Changes', icon: Heart },
  { id: 'fatigue', label: 'Fatigue', icon: Sparkles },
  { id: 'acne', label: 'Acne', icon: Sparkles },
  { id: 'backache', label: 'Backache', icon: Heart },
  { id: 'breast_tenderness', label: 'Breast Tenderness', icon: Heart },
];

const FLOW_OPTIONS: { value: 'light' | 'medium' | 'heavy'; label: string; color: string }[] = [
  { value: 'light', label: 'Light', color: '#FBCFE8' },
  { value: 'medium', label: 'Medium', color: '#D6336C' },
  { value: 'heavy', label: 'Heavy', color: '#BE123C' },
];

export const PeriodLogModal: React.FC<PeriodLogModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  existingEntry,
  onSave,
  onDelete,
  userRole,
}) => {
  const [isPeriodDay, setIsPeriodDay] = useState(true);
  const [flow, setFlow] = useState<'light' | 'medium' | 'heavy'>('medium');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const { showConfirm } = useCustomModals();

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (existingEntry) {
      setIsPeriodDay(existingEntry.isPeriodDay);
      setFlow(existingEntry.flow || 'medium');
      setSelectedSymptoms(existingEntry.symptoms || []);
      setNotes(existingEntry.notes || '');
    } else {
      setIsPeriodDay(true);
      setFlow('medium');
      setSelectedSymptoms([]);
      setNotes('');
    }
  }, [existingEntry, selectedDate]);

  const handleSave = () => {
    const entry = {
      date: selectedDate,
      isPeriodDay,
      flow: isPeriodDay ? flow : undefined,
      symptoms: isPeriodDay ? selectedSymptoms : undefined,
      notes: notes || undefined,
      createdBy: userRole,
    };
    onSave(entry);
    onClose();
  };

  const handleDelete = () => {
    if (!onDelete) return;
    showConfirm({
      title: 'Delete Period Log?',
      message: `Remove the log for ${formatDateKeyFull(selectedDate)}? This cannot be undone.`,
      type: 'danger',
      confirmText: 'Delete',
      onConfirm: () => { onDelete(selectedDate); onClose(); },
    });
  };

  const toggleSymptom = (symptomId: string) => {
    setSelectedSymptoms(prev => 
      prev.includes(symptomId) 
        ? prev.filter(s => s !== symptomId) 
        : [...prev, symptomId]
    );
  };

  const modalContent = (
    <motion.div
      initial={false}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/45 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md max-h-[92dvh]"
        onClick={e => e.stopPropagation()}
      >
        <GlassView className="modal-surface rounded-t-3xl sm:rounded-2xl p-4 md:p-6 max-h-[92dvh] overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-h3 font-bold text-text">Log Period</h2>
              <p className="text-body-sm text-text-muted mt-1">{formatDateKeyFull(selectedDate)}</p>
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-surface-subtle transition-colors"
            >
              <X className="w-5 h-5 text-text-muted" />
            </motion.button>
          </div>

          {/* Period Day Toggle */}
          <div className="mb-6">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent-light flex items-center justify-center flex-shrink-0">
                  <Droplet className="w-5 h-5 text-accent" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-text">Period Day</p>
                  <p className="text-caption text-text-muted normal-case">Mark this day as a period day</p>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsPeriodDay(!isPeriodDay)}
                className={cn(
                  'relative w-12 h-7 rounded-full transition-all duration-200 flex-shrink-0',
                  isPeriodDay ? 'bg-accent' : 'bg-text-muted/20'
                )}
                aria-pressed={isPeriodDay}
              >
                <motion.span
                  className="absolute left-0 top-0.5 w-6 h-6 rounded-full bg-white shadow-md"
                  animate={{ x: isPeriodDay ? 22 : 2 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                />
              </motion.button>
            </label>
          </div>

          {isPeriodDay && (
            <>
              {/* Flow Selection */}
              <div className="mb-6">
                <label className="block text-caption font-medium text-text-secondary mb-3">Flow</label>
                <div className="flex gap-2">
                  {FLOW_OPTIONS.map(option => (
                    <motion.button
                      key={option.value}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setFlow(option.value)}
                      className={cn(
                        'flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200',
                        flow === option.value
                          ? 'border-accent bg-accent-light'
                          : 'border-transparent hover:bg-surface-subtle'
                      )}
                      style={{ backgroundColor: flow === option.value ? option.color + '20' : undefined }}
                    >
                      <motion.div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: option.color }}
                        initial={false}
                        whileTap={{ scale: 1.2 }}
                      />
                      <span className={cn(
                        'text-caption font-medium',
                        flow === option.value ? 'text-accent' : 'text-text-secondary'
                      )}>
                        {option.label}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Symptoms */}
              <div className="mb-6">
                <label className="block text-caption font-medium text-text-secondary mb-3">Symptoms</label>
                <div className="flex flex-wrap gap-2">
                  {SYMPTOMS.map(({ id, label, icon: Icon }) => (
                    <motion.button
                      key={id}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => toggleSymptom(id)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-200',
                        selectedSymptoms.includes(id)
                          ? 'border-accent bg-accent-light text-accent'
                          : 'border-transparent bg-input text-text-secondary hover:bg-surface-subtle'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-body-sm">{label}</span>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="mb-6">
                <label className="block text-caption font-medium text-text-secondary mb-2">Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Add notes..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-input border border-border text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
                />
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {existingEntry && (
              <Button
                variant="ghost"
                onClick={handleDelete}
                className="flex-1"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            )}
            <Button
              variant="primary"
              onClick={handleSave}
              className="flex-1"
            >
              {existingEntry ? 'Update' : 'Save'}
            </Button>
          </div>
        </GlassView>
      </motion.div>
    </motion.div>
  );

  if (!isOpen) return null;

  return createPortal(modalContent, document.body);
};