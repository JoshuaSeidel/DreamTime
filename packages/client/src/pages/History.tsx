import { useState, useEffect, useCallback } from 'react';
import { Moon, Sun, Clock, ChevronRight, Calendar, Loader2, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getSessions, type SleepSession } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

export default function History() {
  const { accessToken } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [sessions, setSessions] = useState<SleepSession[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<SleepSession | null>(null);

  // Get child ID from localStorage or state management
  useEffect(() => {
    const storedChildId = localStorage.getItem('selectedChildId');
    if (storedChildId) {
      setSelectedChildId(storedChildId);
    }
  }, []);

  const loadSessions = useCallback(async () => {
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
  }, [accessToken, selectedChildId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Refresh when page becomes visible (tab switch, navigation back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadSessions();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loadSessions]);

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '--:--';
    return new Date(dateString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '--';
    const date = new Date(dateString);
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (minutes: number | null | undefined) => {
    if (minutes === null || minutes === undefined || minutes <= 0) return '--';
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

  const handleSessionClick = (session: SleepSession) => {
    setSelectedSession(session);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20 md:pb-0">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border px-4 py-4 md:border-b-0">
          <h1 className="text-xl font-bold">Sleep History</h1>
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
        <h1 className="text-xl font-bold">Sleep History</h1>
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
                  onClick={() => handleSessionClick(session)}
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
                        {session.sleepMinutes && session.sleepMinutes > 0 && (
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

      {/* Session Details Dialog */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <Card className="w-full max-w-md max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 duration-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2">
                {selectedSession.sessionType === 'NIGHT_SLEEP' ? (
                  <Moon className="w-5 h-5 text-violet-500" />
                ) : (
                  <Sun className="w-5 h-5 text-yellow-500" />
                )}
                {selectedSession.sessionType === 'NIGHT_SLEEP'
                  ? 'Night Sleep'
                  : `Nap ${selectedSession.napNumber || ''}`}
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedSession(null)}
              >
                <X className="w-5 h-5" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                {getStateBadge(selectedSession.state)}
              </div>

              {/* Timestamps */}
              <div className="space-y-2 border-t pt-4">
                <h4 className="font-medium text-sm text-muted-foreground">Timeline</h4>

                {selectedSession.putDownAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Put Down</span>
                    <span>{formatDateTime(selectedSession.putDownAt)}</span>
                  </div>
                )}

                {selectedSession.asleepAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fell Asleep</span>
                    <span>{formatDateTime(selectedSession.asleepAt)}</span>
                  </div>
                )}

                {selectedSession.wokeUpAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Woke Up</span>
                    <span>{formatDateTime(selectedSession.wokeUpAt)}</span>
                  </div>
                )}

                {selectedSession.outOfCribAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Out of Crib</span>
                    <span>{formatDateTime(selectedSession.outOfCribAt)}</span>
                  </div>
                )}
              </div>

              {/* Durations */}
              <div className="space-y-2 border-t pt-4">
                <h4 className="font-medium text-sm text-muted-foreground">Durations</h4>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Crib Time</span>
                  <span className="font-medium">{formatDuration(selectedSession.totalMinutes)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Actual Sleep</span>
                  <span className="font-medium text-primary">{formatDuration(selectedSession.sleepMinutes)}</span>
                </div>

                {selectedSession.settlingMinutes !== null && selectedSession.settlingMinutes !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Settling Time</span>
                    <span>{formatDuration(selectedSession.settlingMinutes)}</span>
                  </div>
                )}

                {selectedSession.postWakeMinutes !== null && selectedSession.postWakeMinutes !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Post-Wake Time</span>
                    <span>{formatDuration(selectedSession.postWakeMinutes)}</span>
                  </div>
                )}
              </div>

              {/* Notes */}
              {selectedSession.notes && (
                <div className="space-y-2 border-t pt-4">
                  <h4 className="font-medium text-sm text-muted-foreground">Notes</h4>
                  <p className="text-sm">{selectedSession.notes}</p>
                </div>
              )}

              <Button
                className="w-full mt-4"
                variant="outline"
                onClick={() => setSelectedSession(null)}
              >
                Close
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
