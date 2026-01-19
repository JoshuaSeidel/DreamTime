import { useState, useEffect, useCallback } from 'react';
import { Moon, Clock, Loader2, Plus, Baby, Car } from 'lucide-react';
import QuickActionButtons from '../components/QuickActionButtons';
import ChildSelector from '../components/ChildSelector';
import SleepTypeDialog from '../components/SleepTypeDialog';
import AdHocNapDialog from '../components/AdHocNapDialog';
import CribTimeCountdown from '../components/CribTimeCountdown';
import WakeDeadlineCountdown from '../components/WakeDeadlineCountdown';
import AddChildDialog from '../components/AddChildDialog';
import TodaySummaryCard from '../components/TodaySummaryCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/components/ui/toaster';
import {
  getActiveSession,
  getSessions,
  createSession,
  createAdHocSession,
  updateSession,
  getNextAction,
  getSchedule,
  type SleepSession,
  type NextActionRecommendation,
  type SleepSchedule,
  type NapLocation,
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
  const [nextAction, setNextAction] = useState<NextActionRecommendation | null>(null);
  const [hasSchedule, setHasSchedule] = useState(false);
  const [schedule, setSchedule] = useState<SleepSchedule | null>(null);
  const [summaryRefreshTrigger, setSummaryRefreshTrigger] = useState(0);

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

      // Get schedule for crib time settings
      const scheduleResult = await getSchedule(accessToken, selectedChildId);
      if (scheduleResult.success && scheduleResult.data) {
        setSchedule(scheduleResult.data);
        setHasSchedule(true);

        // Get next action recommendation (only if we have a schedule)
        const nextActionResult = await getNextAction(accessToken, selectedChildId);
        if (nextActionResult.success && nextActionResult.data) {
          setNextAction(nextActionResult.data);
        }
      } else {
        setSchedule(null);
        setNextAction(null);
        setHasSchedule(false);
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

  // Track pending put_down custom time for the sleep type dialog
  const [pendingPutDownTime, setPendingPutDownTime] = useState<string | null>(null);

  const handleAction = async (action: 'put_down' | 'fell_asleep' | 'woke_up' | 'out_of_crib', customTime?: string) => {
    if (!accessToken || !selectedChildId) {
      toast.error('No child selected', 'Please select a child first');
      return;
    }

    if (action === 'put_down') {
      // Store custom time if provided, then show sleep type selection dialog
      setPendingPutDownTime(customTime || null);
      setShowSleepTypeDialog(true);
      return;
    }

    setIsActionLoading(true);
    const eventTime = customTime || new Date().toISOString();

    try {
      if (activeSession) {
        // Update existing session with the event time
        const eventMap = {
          fell_asleep: { event: 'fell_asleep' as const, asleepAt: eventTime },
          woke_up: { event: 'woke_up' as const, wokeUpAt: eventTime },
          out_of_crib: { event: 'out_of_crib' as const, outOfCribAt: eventTime },
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

          const timeDisplay = customTime
            ? new Date(customTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
            : null;

          switch (action) {
            case 'fell_asleep':
              setCurrentState('asleep');
              // Check if this is baby falling back asleep after a brief wake
              if (activeSession.state === 'AWAKE') {
                toast.success('Back to sleep', timeDisplay ? `At ${timeDisplay}` : 'Fell asleep again');
              } else {
                toast.success('Fell asleep', timeDisplay ? `At ${timeDisplay}` : 'Sweet dreams');
              }
              break;
            case 'woke_up':
              setCurrentState('awake');
              toast.info('Woke up', timeDisplay ? `At ${timeDisplay}` : 'Baby is awake in crib');
              break;
            case 'out_of_crib':
              setCurrentState('awake');
              const mins = result.data.sleepMinutes;
              toast.success(
                'Session complete',
                mins && mins > 0 ? `Total sleep: ${Math.floor(mins / 60)}h ${mins % 60}m` : 'Session recorded'
              );
              // Reload to update summary and trigger bedtime refresh
              loadSessionData();
              setSummaryRefreshTrigger(prev => prev + 1);
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
    // Use pending custom time if set, otherwise use current time
    const putDownTime = pendingPutDownTime || new Date().toISOString();

    try {
      const result = await createSession(accessToken, selectedChildId, {
        sessionType,
        napNumber,
        putDownAt: putDownTime,
      });

      if (result.success && result.data) {
        setActiveSession(result.data);
        setCurrentState('pending');

        const timeDisplay = pendingPutDownTime
          ? new Date(pendingPutDownTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
          : null;

        toast.success(
          sessionType === 'NAP' ? `Nap ${napNumber} started` : 'Bedtime started',
          timeDisplay
            ? `Put down at ${timeDisplay}`
            : 'Tap "Fell Asleep" when baby is asleep'
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
      setPendingPutDownTime(null); // Clear the pending time
    }
  };

  const handleAdHocNapSubmit = async (data: {
    location: Exclude<NapLocation, 'CRIB'>;
    asleepAt: string;
    wokeUpAt: string;
    notes?: string;
  }) => {
    if (!accessToken || !selectedChildId) {
      throw new Error('No child selected');
    }

    const result = await createAdHocSession(accessToken, selectedChildId, data);

    if (result.success && result.data) {
      const mins = result.data.sleepMinutes || 0;
      const credit = result.data.qualifiedRestMinutes || 0;
      const locationLabel = data.location.charAt(0) + data.location.slice(1).toLowerCase();

      toast.success(
        `${locationLabel} nap logged`,
        mins < 15
          ? `${mins}m (too short for credit)`
          : `${mins}m sleep, ${credit}m credit`
      );

      // Reload to update summary
      loadSessionData();
      setSummaryRefreshTrigger(prev => prev + 1);
    } else {
      throw new Error(result.error?.message || 'Failed to log nap');
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
          <Card className="border-2 border-dashed border-primary/30">
            <CardContent className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Baby className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Welcome to DreamTime!</h2>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                Add your child to start tracking their sleep patterns and get personalized schedule recommendations.
              </p>
              <AddChildDialog
                onChildAdded={() => window.location.reload()}
                trigger={
                  <Button size="lg" className="gap-2">
                    <Plus className="w-5 h-5" />
                    Add Your Child
                  </Button>
                }
              />
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

            {/* Crib Time Countdown - Shows when baby is in crib for NAPs only (not bedtime) */}
            {activeSession && activeSession.sessionType === 'NAP' && (
              <CribTimeCountdown
                session={activeSession}
                minimumCribMinutes={schedule?.minimumCribMinutes ?? 60}
                napCapMinutes={schedule?.napCapMinutes ?? 120}
              />
            )}

            {/* Wake Deadline Countdown - Shows for night sleep approaching must-wake-by time */}
            {activeSession && activeSession.sessionType === 'NIGHT_SLEEP' && schedule?.mustWakeBy && (
              <WakeDeadlineCountdown
                session={activeSession}
                mustWakeBy={schedule.mustWakeBy}
              />
            )}

            {/* Quick Actions */}
            <QuickActionButtons
              currentState={currentState}
              onAction={handleAction}
              disabled={isActionLoading}
              hasActiveSession={activeSession !== null}
            />

            {/* Ad-Hoc Nap Button */}
            <AdHocNapDialog
              onSubmit={handleAdHocNapSubmit}
              trigger={
                <Button
                  variant="outline"
                  className="w-full gap-2 border-dashed border-muted-foreground/30 hover:border-blue-500/50 hover:bg-blue-500/5"
                >
                  <Car className="w-4 h-4 text-blue-500" />
                  Log Car/Stroller Nap
                </Button>
              }
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

            {/* Today's Bedtime Recommendation - Dynamic based on actual nap data */}
            {hasSchedule && (
              <TodaySummaryCard
                childId={selectedChildId}
                refreshTrigger={summaryRefreshTrigger}
              />
            )}

            {/* Next Recommendation */}
            <Card className={cn(
              "border-primary/30",
              nextAction?.action === 'NAP' && "bg-blue-500/5 border-blue-500/30",
              nextAction?.action === 'BEDTIME' && "bg-violet-500/5 border-violet-500/30",
              nextAction?.action === 'WAIT' && "bg-primary/5",
              !hasSchedule && "bg-muted/30 border-muted"
            )}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "rounded-full p-2",
                    nextAction?.action === 'NAP' && "bg-blue-500/20",
                    nextAction?.action === 'BEDTIME' && "bg-violet-500/20",
                    nextAction?.action === 'WAIT' && "bg-primary/20",
                    !hasSchedule && "bg-muted"
                  )}>
                    <Moon className={cn(
                      "w-5 h-5",
                      nextAction?.action === 'NAP' && "text-blue-500",
                      nextAction?.action === 'BEDTIME' && "text-violet-500",
                      nextAction?.action === 'WAIT' && "text-primary",
                      !hasSchedule && "text-muted-foreground"
                    )} />
                  </div>
                  <div className="flex-1">
                    <h3 className={cn(
                      "font-semibold",
                      nextAction?.action === 'NAP' && "text-blue-600 dark:text-blue-400",
                      nextAction?.action === 'BEDTIME' && "text-violet-600 dark:text-violet-400",
                      nextAction?.action === 'WAIT' && "text-primary",
                      !hasSchedule && "text-muted-foreground"
                    )}>
                      {hasSchedule && nextAction ? (
                        nextAction.action === 'NAP' ? `Nap ${nextAction.napNumber}` :
                        nextAction.action === 'BEDTIME' ? 'Bedtime' :
                        'Wait'
                      ) : (
                        'Next Recommendation'
                      )}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {hasSchedule && nextAction ? (
                        <>
                          {nextAction.description}
                          {nextAction.timeWindow && (
                            <span className="block mt-1 font-medium text-foreground">
                              {nextAction.minutesUntilEarliest && nextAction.minutesUntilEarliest > 0 ? (
                                `Target: ${formatTime(nextAction.timeWindow.recommended)} (in ${nextAction.minutesUntilEarliest}m)`
                              ) : (
                                `Now - ${formatTime(nextAction.timeWindow.latest)}`
                              )}
                            </span>
                          )}
                        </>
                      ) : (
                        'Set up a schedule to see personalized recommendations'
                      )}
                    </p>
                    {hasSchedule && nextAction?.notes && nextAction.notes.length > 0 && (
                      <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                        {nextAction.notes.map((note, i) => (
                          <li key={i}>• {note}</li>
                        ))}
                      </ul>
                    )}
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
