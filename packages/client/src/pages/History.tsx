import { useState } from 'react';
import { Moon, Sun, Clock, ChevronRight, Calendar } from 'lucide-react';
import BottomNav from '../components/BottomNav';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface SleepSession {
  id: string;
  sessionType: 'NAP' | 'NIGHT_SLEEP';
  state: 'PENDING' | 'ASLEEP' | 'AWAKE' | 'COMPLETED';
  putDownAt: string;
  asleepAt?: string;
  wokeUpAt?: string;
  outOfCribAt?: string;
  sleepMinutes?: number;
  qualifiedRestMinutes?: number;
}

export default function History() {
  const [isLoading] = useState(false);

  // Mock data - will be replaced with API calls
  const sessions: SleepSession[] = [
    {
      id: '1',
      sessionType: 'NAP',
      state: 'COMPLETED',
      putDownAt: '2024-01-15T09:30:00',
      asleepAt: '2024-01-15T09:38:00',
      wokeUpAt: '2024-01-15T11:15:00',
      outOfCribAt: '2024-01-15T11:20:00',
      sleepMinutes: 97,
      qualifiedRestMinutes: 102,
    },
    {
      id: '2',
      sessionType: 'NAP',
      state: 'COMPLETED',
      putDownAt: '2024-01-15T14:00:00',
      asleepAt: '2024-01-15T14:10:00',
      wokeUpAt: '2024-01-15T15:30:00',
      outOfCribAt: '2024-01-15T15:35:00',
      sleepMinutes: 80,
      qualifiedRestMinutes: 87,
    },
  ];

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (minutes: number) => {
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
        <main className="px-4 py-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
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
        {sessions.length === 0 ? (
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
              <span>Today</span>
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
                                : 'Nap'}
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
