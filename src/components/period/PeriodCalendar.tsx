import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Droplet, Heart, Sparkles } from 'lucide-react';
import { 
  cn, 
  dateKey, 
  addDaysToKey, 
  diffDays, 
  getDaysInMonth, 
  getFirstDayOfMonth, 
  getMonthName, 
  getWeekDays, 
  formatDateKey, 
  isDateInRange, 
  getPeriodDays, 
  getFertileWindowDays, 
  getCyclePhase, 
  getPhaseColor, 
  getPhaseLabel
} from '@/utils/helpers';
import { PredictionResult, PeriodEntry, CycleSettings } from '@/types';
import { GlassView, GlassCard, Button, MotionGlassCard } from '@/components/ui/GlassComponents';

interface PeriodCalendarProps {
  entries: PeriodEntry[];
  predictions: PredictionResult | null;
  cycleSettings: CycleSettings;
  onDateSelect: (date: string) => void;
  className?: string;
}

const FLOW_COLORS = {
  light: '#FBCFE8',
  medium: '#D6336C',
  heavy: '#BE123C',
};

const CYCLE_PHASE_ICONS = {
  period: Droplet,
  follicular: Sparkles,
  ovulation: Heart,
  luteal: Sparkles,
};

export const PeriodCalendar: React.FC<PeriodCalendarProps> = ({
  entries,
  predictions,
  cycleSettings,
  onDateSelect,
  className,
}) => {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  // "Today" is kept in state and re-checked on a timer and on window focus, so
  // when the day rolls over the calendar moves itself to the new month without
  // a refresh - the highlight and (unless the user navigated away) the view
  // follow the real date automatically.
  const [today, setToday] = useState(dateKey());
  const [direction, setDirection] = useState(1);
  // Once the user picks a month by hand, we stop following the calendar day
  const hasNavigated = useRef(false);

  useEffect(() => {
    const check = () => {
      const key = dateKey();
      setToday(prev => (prev === key ? prev : key));
    };
    const timer = window.setInterval(check, 30_000);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  // Auto-advance the view when the month rolls over (only while untouched)
  useEffect(() => {
    if (hasNavigated.current) return;
    const [y, m] = today.split('-').map(Number);
    setCurrentMonth(prev => {
      const currentKey = `${prev.getFullYear()}-${prev.getMonth()}`;
      const todayKeyStr = `${y}-${m - 1}`;
      if (currentKey === todayKeyStr) return prev;
      setDirection(1);
      return new Date(y, m - 1, 1);
    });
  }, [today]);

  const periodDays = useMemo(() => {
    if (!predictions) return [];
    return getPeriodDays(predictions.nextPeriodStart, cycleSettings.periodLength);
  }, [predictions, cycleSettings.periodLength]);

  const fertileDays = useMemo(() => {
    if (!predictions) return [];
    return getFertileWindowDays(predictions.ovulationDate);
  }, [predictions]);

  const ovulationDay = predictions?.ovulationDate;
  const nextPeriodStart = predictions?.nextPeriodStart;
  const nextPeriodEnd = predictions?.nextPeriodEnd;

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfWeek = getFirstDayOfMonth(year, month);
  const monthName = getMonthName(month);
  const weekDays = getWeekDays();

  const monthIndex = year * 12 + month;

  const prevMonth = () => {
    hasNavigated.current = true;
    setDirection(-1);
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    hasNavigated.current = true;
    setDirection(1);
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const getDayStatus = (day: number): {
    isPeriod: boolean;
    isFertile: boolean;
    isOvulation: boolean;
    isPredictedPeriod: boolean;
    isToday: boolean;
    isPast: boolean;
    isFuture: boolean;
    flow?: 'light' | 'medium' | 'heavy';
    symptoms?: string[];
    entry?: PeriodEntry;
  } => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const entry = entries.find(e => e.date === dateStr);
    const isTodayCheck = dateStr === today;

    return {
      isPeriod: entry?.isPeriodDay || false,
      isFertile: isDateInRange(dateStr, fertileDays[0] || '', fertileDays[fertileDays.length - 1] || ''),
      isOvulation: dateStr === ovulationDay,
      isPredictedPeriod: isDateInRange(dateStr, nextPeriodStart || '', nextPeriodEnd || ''),
      isToday: isTodayCheck,
      isPast: diffDays(today, dateStr) > 0,
      isFuture: diffDays(today, dateStr) < 0,
      flow: entry?.flow,
      symptoms: entry?.symptoms,
      entry,
    };
  };

  const renderDay = (day: number, index: number) => {
    if (day === 0) return <div key={`empty-${index}`} className="aspect-square" />;

    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const status = getDayStatus(day);
    const isCurrentMonth = true;

    const PhaseIcon = status.isOvulation ? Heart : status.isFertile ? Sparkles : Droplet;

    return (
      <motion.button
        key={dateStr}
        layout
        onClick={() => onDateSelect(dateStr)}
        className="group relative flex aspect-square min-h-12 cursor-pointer flex-col items-center justify-center rounded-full"
        style={{ minHeight: '48px' }}
        aria-label={formatDateKey(dateStr, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.12, zIndex: 10, transition: { type: 'spring', stiffness: 400, damping: 20 } }}
      >
        {/* The tappable layout stays 48px; the marker circle is compact but comfortably padded */}
        <span
          className={cn(
            'relative flex h-[46px] w-[46px] items-center justify-center rounded-full',
            'transition-colors duration-200 ease-out',
            'group-hover:bg-accent-light/70 group-hover:text-accent group-hover:ring-2 group-hover:ring-accent/40',
            'group-focus-visible:outline-none group-focus-visible:ring-2 group-focus-visible:ring-accent',
            status.isToday && 'ring-2 ring-accent bg-accent-light group-hover:ring-accent',
            status.isPeriod && 'bg-accent-light text-accent',
            status.isOvulation && 'bg-secondary-light text-secondary group-hover:ring-secondary/50',
            status.isFertile && !status.isOvulation && 'bg-secondary-light/50 text-secondary/70',
            status.isPredictedPeriod && !status.isPeriod && 'bg-accent-light/40 text-accent border border-dashed border-accent/40',
            !status.isToday && !status.isPeriod && !status.isOvulation && !status.isFertile && !status.isPredictedPeriod && 'text-text',
            !isCurrentMonth && 'text-text-muted/30',
            status.isPast && !status.isPeriod && 'opacity-60',
          )}
        >
          <span className={cn('text-sm font-medium z-10', status.isToday && 'text-accent')}>
            {day}
          </span>

          {status.isPeriod && (
            <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: FLOW_COLORS[status.flow || 'medium'] }} />
            </div>
          )}

          {status.isOvulation && (
            <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2">
              <Heart className="w-3 h-3 text-secondary" />
            </div>
          )}

          {status.isPredictedPeriod && !status.isPeriod && (
            <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
              <div className="w-1.5 h-1.5 rounded-full border border-accent/50" />
            </div>
          )}

          {status.symptoms && status.symptoms.length > 0 && (
            <div className="absolute top-0 right-0 flex gap-0.5 z-10">
              {status.symptoms.slice(0, 3).map((symptom) => (
                <motion.span
                  key={symptom}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 20 }}
                  className="text-[10px]"
                >
                  <Sparkles className="w-2.5 h-2.5 text-primary/50" />
                </motion.span>
              ))}
            </div>
          )}
        </span>
      </motion.button>
    );
  };

  const days = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    days.push(0);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  return (
    <GlassView className={cn('p-4 rounded-xl', className)}>
      <div className="space-y-4">
        {/* Month Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={prevMonth} aria-label="Previous month">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Droplet className="w-5 h-5 text-accent" />
            <div className="relative overflow-hidden h-8 flex items-center min-w-44">
              <AnimatePresence mode="popLayout" custom={direction} initial={false}>
                <motion.h3
                  key={monthIndex}
                  custom={direction}
                  initial={{ y: 18 * direction, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -18 * direction, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                  className="text-h3 font-bold text-text"
                >
                  {monthName} {year}
                </motion.h3>
              </AnimatePresence>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={nextMonth} aria-label="Next month">
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {/* Week Headers */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {weekDays.map((day) => (
            <div key={day} className="text-caption text-text-muted py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid - month slides in the direction of navigation */}
        <div className="relative overflow-hidden rounded-2xl">
          <AnimatePresence mode="popLayout" custom={direction} initial={false}>
            <motion.div
              key={monthIndex}
              custom={direction}
              initial={{ x: 72 * direction, opacity: 0, scale: 0.96 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              exit={{ x: -72 * direction, opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 250, damping: 26 }}
              className="grid grid-cols-7 gap-1"
            >
              {days.map((day, index) => renderDay(day, index))}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Tap hint - makes it obvious that every day is tappable */}
        <p className="text-center text-caption text-text-muted normal-case -mt-1">
          Tap any day to log or edit — future days included
        </p>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-caption text-text-muted">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-accent/30" />
            <span>Period</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full border border-accent/50" />
            <span>Predicted</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Heart className="w-3 h-3 text-secondary" />
            <span>Ovulation</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-secondary/10" />
            <span>Fertile</span>
          </div>
        </div>

        {/* Cycle Info Cards */}
        {predictions && (
          <div className="grid grid-cols-3 gap-3 pt-2">
            <MotionGlassCard delay={0} className="p-3 text-center">
              <div className="text-2xl font-bold text-accent">{predictions.cycleDay}</div>
              <div className="text-caption text-text-muted">Cycle Day</div>
            </MotionGlassCard>
            <MotionGlassCard delay={60} className="p-3 text-center">
              <div className="text-2xl font-bold text-secondary">{predictions.daysUntilPeriod}</div>
              <div className="text-caption text-text-muted">Days Until Period</div>
            </MotionGlassCard>
            <MotionGlassCard delay={120} className="p-3 text-center">
              <div className="text-2xl font-bold" style={{ color: getPhaseColor(getCyclePhase(predictions.cycleDay, cycleSettings.cycleLength), false) }}>
                {getPhaseLabel(getCyclePhase(predictions.cycleDay, cycleSettings.cycleLength)).split(' ')[0]}
              </div>
              <div className="text-caption text-text-muted">Phase</div>
            </MotionGlassCard>
          </div>
        )}
      </div>
    </GlassView>
  );
};