import { useState, useEffect, useCallback } from 'react';
import { Moon, Clock, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getTodaySummary, type TodaySummary } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

interface TodaySummaryCardProps {
  childId: string;
  refreshTrigger?: number; // Increment this to trigger a refresh
}

export default function TodaySummaryCard({ childId, refreshTrigger }: TodaySummaryCardProps) {
  const { accessToken } = useAuthStore();
  const [summary, setSummary] = useState<TodaySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    if (!accessToken || !childId) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await getTodaySummary(accessToken, childId);
      if (result.success && result.data) {
        setSummary(result.data);
      } else {
        setError(result.error?.message || 'Failed to load summary');
      }
    } catch (err) {
      console.error('[TodaySummary] Failed to load:', err);
      setError('Failed to load today\'s summary');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, childId]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary, refreshTrigger]);

  const formatTime = (isoString: string | null) => {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const formatDuration = (minutes: number | null) => {
    if (minutes === null) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !summary) {
    return null; // Don't show card if no schedule is set
  }

  const hasCompletedNaps = summary.completedNaps > 0;
  const hasSleepDebt = summary.sleepDebtMinutes > 0;

  return (
    <Card className={cn(
      "border-violet-500/30 bg-gradient-to-br from-violet-500/5 to-transparent",
      hasSleepDebt && "border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent"
    )}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Moon className="w-4 h-4 text-violet-500" />
          Today's Bedtime
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Recommended Bedtime - Main focus */}
        <div className="text-center py-2">
          <p className="text-sm text-muted-foreground mb-1">Recommended Bedtime</p>
          <p className={cn(
            "text-4xl font-bold",
            hasSleepDebt ? "text-amber-600 dark:text-amber-400" : "text-violet-600 dark:text-violet-400"
          )}>
            {formatTime(summary.recommendedBedtime)}
          </p>
          {summary.bedtimeNotes.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {summary.bedtimeNotes[0]}
            </p>
          )}
        </div>

        {/* Sleep Debt Alert */}
        {hasSleepDebt && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <p className="text-xs">
              {summary.sleepDebtNote}
            </p>
          </div>
        )}

        {/* Naps Summary */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Today's Naps</p>
          <div className="grid gap-2">
            {summary.naps.map((nap) => (
              <div
                key={nap.napNumber}
                className={cn(
                  "flex items-center justify-between p-2 rounded-lg",
                  nap.status === 'completed' && "bg-green-500/10",
                  nap.status === 'in_progress' && "bg-blue-500/10",
                  nap.status === 'upcoming' && "bg-muted/50"
                )}
              >
                <div className="flex items-center gap-2">
                  {nap.status === 'completed' ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : nap.status === 'in_progress' ? (
                    <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                  ) : (
                    <Clock className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium">
                    Nap {nap.napNumber}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {nap.status === 'completed' ? (
                    <span className={cn(
                      nap.duration && nap.duration >= summary.napGoalMinutes
                        ? "text-green-600 dark:text-green-400"
                        : "text-amber-600 dark:text-amber-400"
                    )}>
                      {formatDuration(nap.duration)}
                    </span>
                  ) : nap.status === 'in_progress' ? (
                    <span className="text-blue-500">In progress</span>
                  ) : (
                    <span>-</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Total Day Sleep */}
          {hasCompletedNaps && (
            <div className="flex justify-between items-center pt-2 border-t border-border/50">
              <span className="text-xs text-muted-foreground">Total Day Sleep</span>
              <span className={cn(
                "text-sm font-medium",
                summary.totalNapMinutes >= (summary.isOnOneNapSchedule ? 90 : 120)
                  ? "text-green-600 dark:text-green-400"
                  : "text-muted-foreground"
              )}>
                {formatDuration(summary.totalNapMinutes)}
              </span>
            </div>
          )}
        </div>

        {/* Bedtime Window */}
        <div className="pt-2 border-t border-border/50">
          <p className="text-xs text-muted-foreground mb-1">Bedtime Window</p>
          <p className="text-sm">
            {formatTime(summary.bedtimeWindow.earliest)} - {formatTime(summary.bedtimeWindow.latest)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
