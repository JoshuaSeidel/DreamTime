import { useState, useEffect } from 'react';
import { Clock, AlertTriangle, CheckCircle, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SleepSession } from '@/lib/api';

interface CribTimeCountdownProps {
  session: SleepSession;
  minimumCribMinutes?: number;
  napCapMinutes?: number;
}

export default function CribTimeCountdown({
  session,
  minimumCribMinutes = 60, // Default 60 minute crib rule
  napCapMinutes = 120, // Default 2 hour nap cap
}: CribTimeCountdownProps) {
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [sleepElapsedMinutes, setSleepElapsedMinutes] = useState(0);

  useEffect(() => {
    if (!session.putDownAt) return;

    const updateElapsed = () => {
      const putDownTime = new Date(session.putDownAt!).getTime();
      const now = Date.now();
      const elapsedMs = now - putDownTime;
      const totalSeconds = Math.floor(elapsedMs / 1000);
      setElapsedMinutes(Math.floor(totalSeconds / 60));
      setElapsedSeconds(totalSeconds % 60);

      // Track sleep elapsed time if baby is asleep
      if (session.asleepAt) {
        const asleepTime = new Date(session.asleepAt).getTime();
        const sleepElapsedMs = now - asleepTime;
        setSleepElapsedMinutes(Math.floor(sleepElapsedMs / 60000));
      }
    };

    // Update immediately
    updateElapsed();

    // Update every second
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [session.putDownAt, session.asleepAt]);

  // Calculate total remaining seconds for accurate countdown
  const totalElapsedSeconds = elapsedMinutes * 60 + elapsedSeconds;
  const totalTargetSeconds = minimumCribMinutes * 60;
  const totalRemainingSeconds = Math.max(0, totalTargetSeconds - totalElapsedSeconds);
  const remainingMinutes = Math.floor(totalRemainingSeconds / 60);
  const remainingSeconds = totalRemainingSeconds % 60;
  const isComplete = totalRemainingSeconds === 0;
  const progress = Math.min(100, (elapsedMinutes / minimumCribMinutes) * 100);

  // Nap cap tracking (only when baby is asleep)
  const isNapCapExceeded = session.state === 'ASLEEP' && sleepElapsedMinutes >= napCapMinutes;
  const napCapOverageMinutes = Math.max(0, sleepElapsedMinutes - napCapMinutes);
  const napCapProgress = session.state === 'ASLEEP' ? Math.min(100, (sleepElapsedMinutes / napCapMinutes) * 100) : 0;

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

      {/* Nap Cap Warning - Only for NAPs when asleep */}
      {session.sessionType === 'NAP' && session.state === 'ASLEEP' && (
        <div className={cn(
          'mt-4 p-3 rounded-lg border',
          isNapCapExceeded
            ? 'bg-red-50 border-red-300 dark:bg-red-950 dark:border-red-700 animate-pulse'
            : napCapProgress >= 80
            ? 'bg-orange-50 border-orange-300 dark:bg-orange-950 dark:border-orange-700'
            : 'bg-violet-50 border-violet-300 dark:bg-violet-950 dark:border-violet-700'
        )}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Moon className={cn(
                'w-4 h-4',
                isNapCapExceeded
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-violet-600 dark:text-violet-400'
              )} />
              <span className={cn(
                'font-medium text-sm',
                isNapCapExceeded
                  ? 'text-red-800 dark:text-red-200'
                  : 'text-violet-800 dark:text-violet-200'
              )}>
                {isNapCapExceeded ? 'Nap Cap Exceeded!' : 'Nap Duration'}
              </span>
            </div>
            <span className={cn(
              'text-sm font-mono font-bold',
              isNapCapExceeded
                ? 'text-red-700 dark:text-red-300'
                : 'text-violet-700 dark:text-violet-300'
            )}>
              {sleepElapsedMinutes}m / {napCapMinutes}m
            </span>
          </div>

          {/* Nap cap progress bar */}
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-1000 rounded-full',
                isNapCapExceeded
                  ? 'bg-red-500 dark:bg-red-400'
                  : napCapProgress >= 80
                  ? 'bg-orange-500 dark:bg-orange-400'
                  : 'bg-violet-500 dark:bg-violet-400'
              )}
              style={{ width: `${Math.min(100, napCapProgress)}%` }}
            />
          </div>

          {isNapCapExceeded && (
            <p className="text-xs text-red-700 dark:text-red-300 mt-2 text-center font-medium">
              Over by {napCapOverageMinutes} minutes - consider waking baby
            </p>
          )}
        </div>
      )}
    </div>
  );
}
