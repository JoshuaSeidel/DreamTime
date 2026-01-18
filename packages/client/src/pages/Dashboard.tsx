import { useState, useEffect, useCallback } from 'react';
import { Moon, Clock, Loader2 } from 'lucide-react';
import QuickActionButtons from '../components/QuickActionButtons';
import ChildSelector from '../components/ChildSelector';
import SleepTypeDialog from '../components/SleepTypeDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/components/ui/toaster';
import {
  getActiveSession,
  getSessions,
  createSession,
  updateSession,
  type SleepSession,
} from '@/lib/api';

type SleepState = 'awake' | 'pending' | 'asleep';

const SELECTED_CHILD_KEY = 'selectedChildId';

export default function Dashboard() {
  const { accessToken } = useAuthStore();
  const toast = useToast();
  const [currentState, setCurrentState] = useState<SleepState>('awake');
  const [selectedChildId, setSelectedChildId] = useState<string | null>(() => {
    return localStorage.getItem(SELECTED_CHILD_KEY);
  });
  const [activeSession, setActiveSession] = useState<SleepSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [todaySummary, setTodaySummary] = useState({ totalMinutes: 0, napCount: 0 });
  const [showSleepTypeDialog, setShowSleepTypeDialog] = useState(false);

  // Save selected child to localStorage
  useEffect(() => {
    if (selectedChildId) {
      localStorage.setItem(SELECTED_CHILD_KEY, selectedChildId);
    }
  }, [selectedChildId]);

  // Load active session and today's summary
  const loadSessionData = useCallback(async () => {
    if (!accessToken || !selectedChildId) return;

    setIsLoading(true);
    try {
      // Get active session
      const activeResult = await getActiveSession(accessToken, selectedChildId);
      if (activeResult.success) {
        setActiveSession(activeResult.data || null);
        if (activeResult.data) {
          if (activeResult.data.state === 'PENDING') {
            setCurrentState('pending');
          } else if (activeResult.data.state === 'ASLEEP') {
            setCurrentState('asleep');
          } else {
            setCurrentState('awake');
          }
        } else {
          setCurrentState('awake');
        }
      }

      // Get today's sessions for summary
      const sessionsResult = await getSessions(accessToken, selectedChildId);
      if (sessionsResult.success && sessionsResult.data) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todaySessions = sessionsResult.data.filter((s) => {
          const sessionDate = new Date(s.createdAt);
          sessionDate.setHours(0, 0, 0, 0);
          return sessionDate.getTime() === today.getTime() && s.state === 'COMPLETED';
        });

        const totalMinutes = todaySessions.reduce((sum, s) => sum + (s.sleepMinutes || 0), 0);
        const napCount = todaySessions.filter((s) => s.sessionType === 'NAP').length;

        setTodaySummary({ totalMinutes, napCount });
      }
    } catch (err) {
      console.error('[Dashboard] Failed to load session data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, selectedChildId]);

  useEffect(() => {
    loadSessionData();
  }, [loadSessionData]);

  const handleAction = async (action: 'put_down' | 'fell_asleep' | 'woke_up' | 'out_of_crib') => {
    if (!accessToken || !selectedChildId) {
      toast.error('No child selected', 'Please select a child first');
      return;
    }

    if (action === 'put_down') {
      // Show sleep type selection dialog
      setShowSleepTypeDialog(true);
      return;
    }

    setIsActionLoading(true);
    const now = new Date().toISOString();

    try {
      if (activeSession) {
        // Update existing session
        const eventMap = {
          fell_asleep: { event: 'fell_asleep' as const, asleepAt: now },
          woke_up: { event: 'woke_up' as const, wokeUpAt: now },
          out_of_crib: { event: 'out_of_crib' as const, outOfCribAt: now },
        };

        const updateData = eventMap[action];
        const result = await updateSession(
          accessToken,
          selectedChildId,
          activeSession.id,
          updateData
        );

        if (result.success && result.data) {
          setActiveSession(result.data.state === 'COMPLETED' ? null : result.data);

          switch (action) {
            case 'fell_asleep':
              setCurrentState('asleep');
              // Check if this is baby falling back asleep after a brief wake
              if (activeSession.state === 'AWAKE') {
                toast.success('Back to sleep', 'Fell asleep again');
              } else {
                toast.success('Fell asleep', 'Sweet dreams');
              }
              break;
            case 'woke_up':
              setCurrentState('awake');
              toast.info('Woke up', 'Baby is awake in crib');
              break;
            case 'out_of_crib':
              setCurrentState('awake');
              const mins = result.data.sleepMinutes;
              toast.success(
                'Session complete',
                mins ? `Total sleep: ${Math.floor(mins / 60)}h ${mins % 60}m` : 'Session recorded'
              );
              // Reload to update summary
              loadSessionData();
              break;
          }
        } else {
          toast.error('Failed to update', result.error?.message || 'Try again');
        }
      }
    } catch (err) {
      console.error('[Dashboard] Action error:', err);
      toast.error('Error', 'Something went wrong');
    } finally {
      setIsActionLoading(false);
    }
  };

  const getStateColor = () => {
    switch (currentState) {
      case 'asleep':
        return 'bg-violet-500';
      case 'pending':
        return 'bg-blue-500';
      default:
        return 'bg-green-500';
    }
  };

  const getStateText = () => {
    switch (currentState) {
      case 'asleep':
        return 'Asleep';
      case 'pending':
        return 'In Crib';
      default:
        return 'Awake';
    }
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const handleSleepTypeSelect = async (
    sessionType: 'NAP' | 'NIGHT_SLEEP',
    napNumber?: number
  ) => {
    if (!accessToken || !selectedChildId) return;

    setIsActionLoading(true);
    const now = new Date().toISOString();

    try {
      const result = await createSession(accessToken, selectedChildId, {
        sessionType,
        napNumber,
        putDownAt: now,
      });

      if (result.success && result.data) {
        setActiveSession(result.data);
        setCurrentState('pending');
        toast.success(
          sessionType === 'NAP' ? `Nap ${napNumber} started` : 'Bedtime started',
          'Tap "Fell Asleep" when baby is asleep'
        );
        loadSessionData();
      } else {
        toast.error('Failed to record', result.error?.message || 'Try again');
      }
    } catch (err) {
      console.error('[Dashboard] Create session error:', err);
      toast.error('Error', 'Something went wrong');
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border px-4 py-4 md:border-b-0">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary md:hidden">DreamTime</h1>
          <h1 className="text-xl font-bold hidden md:block">Dashboard</h1>
          <ChildSelector
            selectedId={selectedChildId}
            onSelect={setSelectedChildId}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : !selectedChildId ? (
          <Card>
            <CardContent className="text-center py-12">
              <Moon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium">No child selected</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add a child to start tracking sleep
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Current State Card */}
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground mb-2">Current Status</p>
                <div className="flex items-center justify-center gap-3">
                  <span
                    className={cn(
                      'w-4 h-4 rounded-full',
                      getStateColor(),
                      currentState === 'asleep' && 'animate-pulse-slow',
                      currentState === 'pending' && 'animate-pulse'
                    )}
                  />
                  <span className="text-3xl font-bold">{getStateText()}</span>
                </div>
                {activeSession && currentState !== 'awake' && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {currentState === 'pending' && activeSession.putDownAt
                      ? `Put down at ${formatTime(activeSession.putDownAt)}`
                      : currentState === 'asleep' && activeSession.asleepAt
                      ? `Fell asleep at ${formatTime(activeSession.asleepAt)}`
                      : ''}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <QuickActionButtons
              currentState={currentState}
              onAction={handleAction}
              disabled={isActionLoading}
              hasActiveSession={activeSession !== null}
            />

            {/* Today's Summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Today's Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-3xl font-bold text-primary">
                      {formatDuration(todaySummary.totalMinutes)}
                    </p>
                    <p className="text-sm text-muted-foreground">Total Sleep</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-3xl font-bold text-primary">{todaySummary.napCount}</p>
                    <p className="text-sm text-muted-foreground">Naps</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Next Recommendation */}
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/20 p-2">
                    <Moon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-primary">Next Recommendation</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Set up a schedule to see personalized recommendations
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>

      {/* Sleep Type Selection Dialog */}
      <SleepTypeDialog
        open={showSleepTypeDialog}
        onOpenChange={setShowSleepTypeDialog}
        onSelect={handleSleepTypeSelect}
        currentNapCount={todaySummary.napCount}
      />
    </div>
  );
}
