import { useState, useEffect } from 'react';
import { Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SleepSession } from '@/lib/api';

interface CribTimeCountdownProps {
  session: SleepSession;
  minimumCribMinutes?: number;
}

export default function CribTimeCountdown({
  session,
  minimumCribMinutes = 60, // Default 60 minute crib rule
}: CribTimeCountdownProps) {
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!session.putDownAt) return;

    const updateElapsed = () => {
      const putDownTime = new Date(session.putDownAt!).getTime();
      const now = Date.now();
      const elapsedMs = now - putDownTime;
      const totalSeconds = Math.floor(elapsedMs / 1000);
      setElapsedMinutes(Math.floor(totalSeconds / 60));
      setElapsedSeconds(totalSeconds % 60);
    };

    // Update immediately
    updateElapsed();

    // Update every second
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [session.putDownAt]);

  const remainingMinutes = Math.max(0, minimumCribMinutes - elapsedMinutes - 1);
  const remainingSeconds = remainingMinutes > 0 ? 60 - elapsedSeconds : 0;
  const isComplete = elapsedMinutes >= minimumCribMinutes;
  const progress = Math.min(100, (elapsedMinutes / minimumCribMinutes) * 100);

  // Only show when session is active (not completed)
  if (session.state === 'COMPLETED') {
    return null;
  }

  const formatTime = (mins: number, secs: number) => {
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={cn(
        'rounded-xl p-4 border-2 transition-all',
        isComplete
          ? 'bg-green-50 border-green-300 dark:bg-green-950 dark:border-green-700'
          : 'bg-amber-50 border-amber-300 dark:bg-amber-950 dark:border-amber-700'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isComplete ? (
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 animate-pulse" />
          )}
          <span
            className={cn(
              'font-semibold',
              isComplete
                ? 'text-green-800 dark:text-green-200'
                : 'text-amber-800 dark:text-amber-200'
            )}
          >
            {isComplete ? 'Crib Time Complete' : 'Crib Time Active'}
          </span>
        </div>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>
            {session.sessionType === 'NAP'
              ? `Nap ${session.napNumber || ''}`
              : 'Bedtime'}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
        <div
          className={cn(
            'h-full transition-all duration-1000 rounded-full',
            isComplete
              ? 'bg-green-500 dark:bg-green-400'
              : 'bg-amber-500 dark:bg-amber-400'
          )}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Time Display */}
      <div className="grid grid-cols-2 gap-4 text-center">
        <div>
          <p
            className={cn(
              'text-3xl font-bold font-mono',
              isComplete
                ? 'text-green-700 dark:text-green-300'
                : 'text-amber-700 dark:text-amber-300'
            )}
          >
            {formatTime(elapsedMinutes, elapsedSeconds)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Time in Crib</p>
        </div>
        <div>
          {isComplete ? (
            <>
              <p className="text-3xl font-bold font-mono text-green-700 dark:text-green-300">
                Done
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Ready when baby is
              </p>
            </>
          ) : (
            <>
              <p className="text-3xl font-bold font-mono text-amber-700 dark:text-amber-300">
                {formatTime(remainingMinutes, remainingSeconds)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Time Remaining</p>
            </>
          )}
        </div>
      </div>

      {/* Warning Message */}
      {!isComplete && (
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-3 text-center">
          Minimum {minimumCribMinutes} minutes recommended for sleep training
        </p>
      )}
    </div>
  );
}
