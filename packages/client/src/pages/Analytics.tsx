import { useState, useEffect, useMemo } from 'react';
import { BarChart3, Calendar, Loader2, TrendingUp, TrendingDown, Minus, Moon, Sun } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getSessions, type SleepSession } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

// Helper to group sessions by date
function groupSessionsByDate(sessions: SleepSession[]) {
  const groups: Record<string, SleepSession[]> = {};
  sessions.forEach(s => {
    const dateStr = new Date(s.createdAt).toISOString().split('T')[0] ?? '';
    if (!groups[dateStr]) groups[dateStr] = [];
    groups[dateStr].push(s);
  });
  return groups;
}

// Get last N days as array of YYYY-MM-DD strings
function getLastNDays(n: number): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    if (dateStr) days.push(dateStr);
  }
  return days;
}

// Simple bar chart component
function BarChart({
  data,
  maxValue,
  label,
  color = 'primary',
}: {
  data: { label: string; value: number; highlight?: boolean }[];
  maxValue: number;
  label: string;
  color?: 'primary' | 'blue' | 'violet';
}) {
  const colorClasses = {
    primary: 'bg-primary',
    blue: 'bg-blue-500',
    violet: 'bg-violet-500',
  };

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-1 h-24">
        {data.map((item, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={cn(
                'w-full rounded-t transition-all',
                colorClasses[color],
                item.highlight && 'opacity-100',
                !item.highlight && 'opacity-60'
              )}
              style={{
                height: maxValue > 0 ? `${(item.value / maxValue) * 100}%` : '0%',
                minHeight: item.value > 0 ? '4px' : '0',
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        {data.map((item, i) => (
          <span key={i} className={cn('flex-1 text-center', item.highlight && 'font-medium text-foreground')}>
            {item.label}
          </span>
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center">{label}</p>
    </div>
  );
}

// Trend indicator
function TrendIndicator({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null;
  const change = ((current - previous) / previous) * 100;
  const isUp = change > 5;
  const isDown = change < -5;

  return (
    <span className={cn(
      'text-xs flex items-center gap-0.5',
      isUp && 'text-green-600 dark:text-green-400',
      isDown && 'text-red-600 dark:text-red-400',
      !isUp && !isDown && 'text-muted-foreground'
    )}>
      {isUp && <TrendingUp className="w-3 h-3" />}
      {isDown && <TrendingDown className="w-3 h-3" />}
      {!isUp && !isDown && <Minus className="w-3 h-3" />}
      {Math.abs(change).toFixed(0)}%
    </span>
  );
}

export default function Analytics() {
  const { accessToken } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [sessions, setSessions] = useState<SleepSession[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '14d' | '30d'>('7d');

  // Get child ID from localStorage
  useEffect(() => {
    const storedChildId = localStorage.getItem('selectedChildId');
    if (storedChildId) {
      setSelectedChildId(storedChildId);
    }
  }, []);

  useEffect(() => {
    const loadSessions = async () => {
      if (!accessToken || !selectedChildId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const result = await getSessions(accessToken, selectedChildId);
        if (result.success && result.data) {
          setSessions(result.data);
        }
      } catch (err) {
        console.error('Failed to load sessions:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadSessions();
  }, [accessToken, selectedChildId]);

  // Calculate analytics from real data
  const analytics = useMemo(() => {
    if (sessions.length === 0) return null;

    const completedSessions = sessions.filter(s => s.state === 'COMPLETED');
    if (completedSessions.length === 0) return null;

    const totalSleepMinutes = completedSessions.reduce(
      (sum, s) => sum + (s.sleepMinutes || 0),
      0
    );
    const napSessions = completedSessions.filter(s => s.sessionType === 'NAP');
    const nightSessions = completedSessions.filter(s => s.sessionType === 'NIGHT_SLEEP');

    return {
      totalSessions: completedSessions.length,
      totalSleepHours: (totalSleepMinutes / 60).toFixed(1),
      avgNapMinutes: napSessions.length > 0
        ? Math.round(napSessions.reduce((sum, s) => sum + (s.sleepMinutes || 0), 0) / napSessions.length)
        : 0,
      napCount: napSessions.length,
      nightCount: nightSessions.length,
    };
  }, [sessions]);

  // Weekly data for charts
  const weeklyData = useMemo(() => {
    const days = timeRange === '7d' ? 7 : timeRange === '14d' ? 14 : 30;
    const lastNDays = getLastNDays(days);
    const grouped = groupSessionsByDate(sessions.filter(s => s.state === 'COMPLETED'));
    const today = new Date().toISOString().split('T')[0];

    // Daily sleep totals
    const dailySleep = lastNDays.map(date => {
      const daySessions = grouped[date] || [];
      const totalMinutes = daySessions.reduce((sum, s) => sum + (s.sleepMinutes || 0), 0);
      const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'short' }).charAt(0);
      return {
        date,
        label: dayOfWeek,
        value: totalMinutes,
        highlight: date === today,
      };
    });

    // Daily nap counts
    const dailyNaps = lastNDays.map(date => {
      const daySessions = grouped[date] || [];
      const napCount = daySessions.filter(s => s.sessionType === 'NAP').length;
      const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'short' }).charAt(0);
      return {
        date,
        label: dayOfWeek,
        value: napCount,
        highlight: date === today,
      };
    });

    // Average nap duration per day
    const avgNapDurations = lastNDays.map(date => {
      const daySessions = grouped[date] || [];
      const naps = daySessions.filter(s => s.sessionType === 'NAP' && s.sleepMinutes);
      const avg = naps.length > 0
        ? naps.reduce((sum, s) => sum + (s.sleepMinutes || 0), 0) / naps.length
        : 0;
      const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'short' }).charAt(0);
      return {
        date,
        label: dayOfWeek,
        value: Math.round(avg),
        highlight: date === today,
      };
    });

    // Calculate week-over-week comparison
    const halfPoint = Math.floor(days / 2);
    const recentHalf = lastNDays.slice(halfPoint);
    const previousHalf = lastNDays.slice(0, halfPoint);

    const recentSleep = recentHalf.reduce((sum, d) => {
      const mins = (grouped[d] || []).reduce((s, sess) => s + (sess.sleepMinutes || 0), 0);
      return sum + mins;
    }, 0);

    const previousSleep = previousHalf.reduce((sum, d) => {
      const mins = (grouped[d] || []).reduce((s, sess) => s + (sess.sleepMinutes || 0), 0);
      return sum + mins;
    }, 0);

    return {
      dailySleep,
      dailyNaps,
      avgNapDurations,
      maxSleep: Math.max(...dailySleep.map(d => d.value), 60),
      maxNaps: Math.max(...dailyNaps.map(d => d.value), 1),
      maxAvgNap: Math.max(...avgNapDurations.map(d => d.value), 30),
      recentSleep,
      previousSleep,
      avgDailySleep: recentSleep / recentHalf.length,
    };
  }, [sessions, timeRange]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20 md:pb-0">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border px-4 py-4 md:border-b-0">
          <h1 className="text-xl font-bold">Analytics</h1>
        </header>
        <main className="px-4 py-6 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border px-4 py-4 md:border-b-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Analytics</h1>
            <p className="text-sm text-muted-foreground">Track sleep patterns and progress</p>
          </div>
          {selectedChildId && analytics && (
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              {(['7d', '14d', '30d'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={cn(
                    'px-2 py-1 text-xs rounded-md transition-colors',
                    timeRange === range
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {range}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="px-4 py-6 space-y-6">
        {!selectedChildId ? (
          <Card>
            <CardContent className="text-center py-12">
              <div className="rounded-full bg-muted p-4 mx-auto w-fit mb-4">
                <BarChart3 className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">No child selected</p>
              <p className="text-sm text-muted-foreground/70 mt-2">
                Select a child from the home screen to view analytics
              </p>
            </CardContent>
          </Card>
        ) : !analytics ? (
          <Card>
            <CardContent className="text-center py-12">
              <div className="rounded-full bg-muted p-4 mx-auto w-fit mb-4">
                <BarChart3 className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">No data available yet</p>
              <p className="text-sm text-muted-foreground/70 mt-2">
                Start tracking sleep sessions to see analytics
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Moon className="w-4 h-4" />
                    <span className="text-xs">Avg Daily Sleep</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">
                      {(weeklyData.avgDailySleep / 60).toFixed(1)}h
                    </span>
                    <TrendIndicator
                      current={weeklyData.recentSleep}
                      previous={weeklyData.previousSleep}
                    />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Sun className="w-4 h-4" />
                    <span className="text-xs">Avg Nap Length</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{analytics.avgNapMinutes}m</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Daily Sleep Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Daily Sleep
                </CardTitle>
                <CardDescription>Total sleep per day (minutes)</CardDescription>
              </CardHeader>
              <CardContent>
                <BarChart
                  data={weeklyData.dailySleep}
                  maxValue={weeklyData.maxSleep}
                  label="Total sleep minutes per day"
                  color="violet"
                />
              </CardContent>
            </Card>

            {/* Nap Count Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sun className="w-4 h-4" />
                  Daily Nap Count
                </CardTitle>
                <CardDescription>Number of naps per day</CardDescription>
              </CardHeader>
              <CardContent>
                <BarChart
                  data={weeklyData.dailyNaps}
                  maxValue={weeklyData.maxNaps}
                  label="Number of naps per day"
                  color="blue"
                />
              </CardContent>
            </Card>

            {/* Average Nap Duration Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Average Nap Duration
                </CardTitle>
                <CardDescription>Average nap length per day (minutes)</CardDescription>
              </CardHeader>
              <CardContent>
                <BarChart
                  data={weeklyData.avgNapDurations}
                  maxValue={weeklyData.maxAvgNap}
                  label="Average nap duration per day"
                  color="primary"
                />
              </CardContent>
            </Card>

            {/* All-Time Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  All-Time Summary
                </CardTitle>
                <CardDescription>
                  Based on {analytics.totalSessions} recorded session{analytics.totalSessions !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-3xl font-bold text-primary">{analytics.totalSleepHours}h</p>
                    <p className="text-sm text-muted-foreground">Total Sleep</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-3xl font-bold text-primary">{analytics.napCount}</p>
                    <p className="text-sm text-muted-foreground">Naps</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-3xl font-bold text-primary">{analytics.avgNapMinutes}m</p>
                    <p className="text-sm text-muted-foreground">Avg Nap</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-3xl font-bold text-primary">{analytics.nightCount}</p>
                    <p className="text-sm text-muted-foreground">Night Sessions</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/20 p-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-primary">Tracking Progress</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {weeklyData.recentSleep > weeklyData.previousSleep
                        ? 'Sleep time is improving! Keep up the great work.'
                        : weeklyData.recentSleep < weeklyData.previousSleep
                        ? 'Sleep time has decreased recently. Check your schedule settings.'
                        : 'Sleep patterns are stable. Continue with the current routine.'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
