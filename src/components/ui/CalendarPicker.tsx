import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn, formatDateKeyFull } from '@/utils/helpers';
import { GlassView } from '@/components/ui/GlassComponents';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

interface CalendarPickerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Currently selected date (YYYY-MM-DD), or null/undefined when empty */
  value?: string | null;
  onSelect: (date: string) => void;
  title?: string;
  /** Optional bounds */
  min?: string;
  max?: string;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const dateAt = (year: number, month: number, day: number) => `${year}-${pad2(month + 1)}-${pad2(day)}`;
const monthKey = (year: number, month: number) => `${year}-${pad2(month + 1)}`;

export const CalendarPicker: React.FC<CalendarPickerProps> = ({
  isOpen,
  onClose,
  value,
  onSelect,
  title = 'Pick a date',
  min,
  max,
}) => {
  const selected = value ?? null;
  const [viewDate, setViewDate] = useState(() => (selected ? new Date(selected + 'T00:00:00') : new Date()));
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    if (isOpen) {
      setViewDate(selected ? new Date(selected + 'T00:00:00') : new Date());
      setDirection(1);
    }
  }, [isOpen, selected]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthLabel = viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const cells = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const out: Array<{ blank: boolean; key: string; day?: number }> = [];
    for (let i = 0; i < firstDay; i++) out.push({ blank: true, key: `blank-${i}` });
    for (let d = 1; d <= daysInMonth; d++) out.push({ blank: false, key: `day-${d}`, day: d });
    return out;
  }, [year, month]);

  const isDisabled = (day: number) => {
    const key = dateAt(year, month, day);
    if (min && key < min) return true;
    if (max && key > max) return true;
    return false;
  };

  const changeMonth = (delta: number) => {
    setDirection(delta >= 0 ? 1 : -1);
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const pick = (day: number) => {
    const key = dateAt(year, month, day);
    onSelect(key);
    window.setTimeout(onClose, 120); // let the tap spring read before closing
  };

  const today = new Date();
  const isToday = (day: number) =>
    dateAt(year, month, day) === `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;

  if (!isOpen) return null;

  const modal = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-sm p-3 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 80, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="w-full max-w-sm"
        onClick={e => e.stopPropagation()}
      >
        <GlassView className="modal-surface rounded-3xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <div>
              <p className="text-caption text-text-muted font-medium">{title}</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-text-muted hover:bg-surface-subtle transition-colors"
              aria-label="Close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>

          {/* Month navigation */}
          <div className="flex items-center justify-between px-4 py-2">
            <button
              onClick={() => changeMonth(-1)}
              className="p-2 rounded-xl hover:bg-surface-subtle text-text-secondary transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="relative overflow-hidden h-7 min-w-40 flex items-center justify-center">
              <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                <motion.h3
                  key={monthKey(year, month)}
                  custom={direction}
                  initial={{ x: 40 * direction, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -40 * direction, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className="font-semibold text-text"
                >
                  {monthLabel}
                </motion.h3>
              </AnimatePresence>
            </div>
            <button
              onClick={() => changeMonth(1)}
              className="p-2 rounded-xl hover:bg-surface-subtle text-text-secondary transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 px-4 pt-1 pb-1">
            {WEEKDAYS.map(d => (
              <div key={d} className="text-center text-caption text-text-muted font-semibold py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-y-1 px-4 pb-3">
            <AnimatePresence mode="popLayout" initial={false} custom={direction}>
              <motion.div
                key={monthKey(year, month)}
                custom={direction}
                initial={{ x: 60 * direction, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -60 * direction, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                className="col-span-7 grid grid-cols-7 gap-y-1"
              >
                {cells.map(cell => {
                  if (cell.blank) return <div key={cell.key} className="h-10" />;
                  const day = cell.day!;
                  const key = dateAt(year, month, day);
                  const isSelected = selected === key;
                  const disabled = isDisabled(day);

                  return (
                    <button
                      key={cell.key}
                      disabled={disabled}
                      onClick={() => pick(day)}
                      className={cn(
                        'relative h-10 w-10 mx-auto rounded-full text-sm font-medium transition-all duration-150',
                        'flex items-center justify-center',
                        disabled && 'opacity-25 cursor-not-allowed',
                        !disabled && !isSelected && 'text-text hover:bg-accent-light hover:text-accent',
                        !isSelected && isToday(day) && 'text-accent ring-1 ring-accent'
                      )}
                      style={
                        isSelected
                          ? {
                              background: 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-secondary) 100%)',
                              color: 'var(--color-on-accent)',
                              boxShadow: '0 4px 14px var(--color-accent-glow), inset 0 1px 0 rgba(255,255,255,0.35)',
                            }
                          : undefined
                      }
                      aria-label={formatDateKeyFull(key)}
                      aria-pressed={isSelected}
                    >
                      {day}
                      {isSelected && (
                        <motion.span
                          layoutId="calendar-picker-selected"
                          className="absolute inset-0 rounded-full"
                          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        />
                      )}
                    </button>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 px-4 pb-4 pt-1 border-t border-border">
            <button
              onClick={() => {
                const d = new Date();
                onSelect(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`);
                window.setTimeout(onClose, 120);
              }}
              className="px-4 py-2 text-body-sm font-medium text-accent-strong hover:bg-accent-light rounded-xl transition-colors"
            >
              Today
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 text-body-sm font-semibold rounded-xl text-on-accent"
              style={{ background: 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-secondary) 100%)' }}
            >
              Done
            </button>
          </div>
        </GlassView>
      </motion.div>
    </motion.div>
  );

  return createPortal(modal, document.body);
};

interface DatePickerFieldProps {
  value?: string | null;
  onChange: (date: string) => void;
  label?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  className?: string;
}

/** A read-only field button that opens the fancy calendar picker. */
export const DatePickerField: React.FC<DatePickerFieldProps> = ({
  value,
  onChange,
  label,
  placeholder = 'Pick a date',
  min,
  max,
  className,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className={className}>
      {label && (
        <label className="block text-caption font-medium text-text-secondary mb-2">{label}</label>
      )}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-input border border-border',
          'text-left text-text transition-all duration-200',
          'hover:border-accent hover:shadow-[0_0_0_3px_var(--color-accent-glow)]',
          'focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent'
        )}
      >
        <span className="w-8 h-8 rounded-lg bg-accent-light flex items-center justify-center flex-shrink-0">
          <Calendar className="w-4 h-4 text-accent" />
        </span>
        <span className="flex-1 min-w-0">
          <span className={cn('block font-medium truncate', !value && 'text-text-muted')}>
            {value ? formatDateKeyFull(value) : placeholder}
          </span>
        </span>
        <ChevronDown className="w-4 h-4 text-text-muted flex-shrink-0" />
      </button>

      <CalendarPicker
        isOpen={open}
        onClose={() => setOpen(false)}
        value={value ?? null}
        onSelect={onChange}
        title={label ?? 'Pick a date'}
        min={min}
        max={max}
      />
    </div>
  );
};

export default CalendarPicker;
