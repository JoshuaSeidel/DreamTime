import { useState, useEffect } from 'react';
import { BarChart3, Calendar, Loader2 } from 'lucide-react';
import BottomNav from '../components/BottomNav';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getSessions, type SleepSession } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

export default function Analytics() {
  const { accessToken } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [sessions, setSessions] = useState<SleepSession[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

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
  const calculateAnalytics = () => {
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
  };

  const analytics = calculateAnalytics();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border px-4 py-4">
          <h1 className="text-xl font-bold text-primary">Analytics</h1>
        </header>
        <main className="px-4 py-6 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border px-4 py-4">
        <h1 className="text-xl font-bold text-primary">Analytics</h1>
        <p className="text-sm text-muted-foreground">Track sleep patterns and progress</p>
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
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Sleep Summary
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
                    <BarChart3 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-primary">Keep Tracking</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      More data will provide better insights into sleep patterns and trends.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
