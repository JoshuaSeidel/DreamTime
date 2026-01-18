import { useState, useEffect } from 'react';
import { Moon, Sun, Clock, ChevronRight, Calendar, Loader2 } from 'lucide-react';
import BottomNav from '../components/BottomNav';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getSessions, type SleepSession } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

export default function History() {
  const { accessToken } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [sessions, setSessions] = useState<SleepSession[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  // Get child ID from localStorage or state management
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
          // Sort by most recent first
          setSessions(result.data.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          ));
        }
      } catch (err) {
        console.error('Failed to load sessions:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadSessions();
  }, [accessToken, selectedChildId]);

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '--:--';
    return new Date(dateString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '--';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getSessionIcon = (type: string) => {
    return type === 'NIGHT_SLEEP' ? Moon : Sun;
  };

  const getStateBadge = (state: string) => {
    switch (state) {
      case 'COMPLETED':
        return <Badge variant="success">Completed</Badge>;
      case 'ASLEEP':
        return <Badge variant="default">Asleep</Badge>;
      case 'AWAKE':
        return <Badge variant="warning">Awake</Badge>;
      default:
        return <Badge variant="secondary">In Crib</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border px-4 py-4">
          <h1 className="text-xl font-bold text-primary">Sleep History</h1>
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
        <h1 className="text-xl font-bold text-primary">Sleep History</h1>
        <p className="text-sm text-muted-foreground">View past sleep sessions</p>
      </header>

      <main className="px-4 py-6 space-y-4">
        {!selectedChildId ? (
          <Card>
            <CardContent className="text-center py-12">
              <div className="rounded-full bg-muted p-4 mx-auto w-fit mb-4">
                <Calendar className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">No child selected</p>
              <p className="text-sm text-muted-foreground/70 mt-2">
                Select a child from the home screen to view their history
              </p>
            </CardContent>
          </Card>
        ) : sessions.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <div className="rounded-full bg-muted p-4 mx-auto w-fit mb-4">
                <Calendar className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">No sleep sessions recorded yet</p>
              <p className="text-sm text-muted-foreground/70 mt-2">
                Start tracking from the home screen
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Date Group */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>Recent Sessions</span>
            </div>

            {sessions.map((session) => {
              const Icon = getSessionIcon(session.sessionType);
              return (
                <Card
                  key={session.id}
                  className="hover:bg-accent/50 transition-colors cursor-pointer"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'rounded-full p-2',
                            session.sessionType === 'NIGHT_SLEEP'
                              ? 'bg-violet-500/20'
                              : 'bg-yellow-500/20'
                          )}
                        >
                          <Icon
                            className={cn(
                              'w-5 h-5',
                              session.sessionType === 'NIGHT_SLEEP'
                                ? 'text-violet-500'
                                : 'text-yellow-500'
                            )}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {session.sessionType === 'NIGHT_SLEEP'
                                ? 'Night Sleep'
                                : `Nap${session.napNumber ? ` ${session.napNumber}` : ''}`}
                            </span>
                            {getStateBadge(session.state)}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <Clock className="w-3 h-3" />
                            <span>
                              {formatTime(session.putDownAt)}
                              {session.outOfCribAt &&
                                ` - ${formatTime(session.outOfCribAt)}`}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {session.sleepMinutes && (
                          <div className="text-right">
                            <p className="font-semibold text-primary">
                              {formatDuration(session.sleepMinutes)}
                            </p>
                            <p className="text-xs text-muted-foreground">slept</p>
                          </div>
                        )}
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
