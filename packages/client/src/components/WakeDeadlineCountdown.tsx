import { useState, useEffect } from 'react';
import { Clock, AlertTriangle, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SleepSession } from '@/lib/api';

interface WakeDeadlineCountdownProps {
  session: SleepSession;
  mustWakeBy: string; // HH:mm format
  childName?: string;
}

export default function WakeDeadlineCountdown({
  session,
  mustWakeBy,
  childName = 'Baby',
}: WakeDeadlineCountdownProps) {
  const [minutesRemaining, setMinutesRemaining] = useState<number | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [isPastDeadline, setIsPastDeadline] = useState(false);
  const [minutesPastDeadline, setMinutesPastDeadline] = useState(0);

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const [hours, minutes] = mustWakeBy.split(':').map(Number);

      // Create deadline time for today
      const deadline = new Date();
      deadline.setHours(hours ?? 7, minutes ?? 30, 0, 0);

      // If deadline already passed today (e.g., it's 6pm and deadline is 7:30am),
      // use tomorrow's deadline since this is for overnight sleep
      if (deadline.getTime() < now.getTime()) {
        deadline.setDate(deadline.getDate() + 1);
      }

      const diffMs = deadline.getTime() - now.getTime();

      if (diffMs <= 0) {
        // Past deadline
        setIsPastDeadline(true);
        setMinutesPastDeadline(Math.floor(Math.abs(diffMs) / 60000));
        setMinutesRemaining(null);
        setSecondsRemaining(0);
      } else {
        setIsPastDeadline(false);
        setMinutesPastDeadline(0);
        const totalSeconds = Math.floor(diffMs / 1000);
        setMinutesRemaining(Math.floor(totalSeconds / 60));
        setSecondsRemaining(totalSeconds % 60);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [mustWakeBy]);

  // Only show for night sleep sessions that are asleep
  if (session.sessionType !== 'NIGHT_SLEEP' || session.state !== 'ASLEEP') {
    return null;
  }

  // Only show when within 10 minutes of deadline or past it
  if (!isPastDeadline && (minutesRemaining === null || minutesRemaining > 10)) {
    return null;
  }

  const formatTime = (mins: number, secs: number) => {
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={cn(
        'rounded-xl p-4 border-2 transition-all',
        isPastDeadline
          ? 'bg-red-50 border-red-400 dark:bg-red-950 dark:border-red-700 animate-pulse'
          : 'bg-orange-50 border-orange-400 dark:bg-orange-950 dark:border-orange-700'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isPastDeadline ? (
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          ) : (
            <Sun className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          )}
          <span
            className={cn(
              'font-semibold',
              isPastDeadline
                ? 'text-red-800 dark:text-red-200'
                : 'text-orange-800 dark:text-orange-200'
            )}
          >
            {isPastDeadline ? 'Wake Deadline Passed!' : 'Wake Deadline Approaching'}
          </span>
        </div>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>Must wake by {mustWakeBy}</span>
        </div>
      </div>

      {/* Time Display */}
      <div className="text-center py-2">
        {isPastDeadline ? (
          <>
            <p className="text-4xl font-bold font-mono text-red-600 dark:text-red-400">
              +{minutesPastDeadline}m
            </p>
            <p className="text-sm text-red-700 dark:text-red-300 mt-2">
              Wake {childName} now to preserve schedule!
            </p>
          </>
        ) : (
          <>
            <p className="text-4xl font-bold font-mono text-orange-600 dark:text-orange-400">
              {formatTime(minutesRemaining ?? 0, secondsRemaining)}
            </p>
            <p className="text-sm text-orange-700 dark:text-orange-300 mt-2">
              Until wake deadline
            </p>
          </>
        )}
      </div>
    </div>
  );
}
