import { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  Moon,
  Check,
  AlertTriangle,
  Loader2,
  ArrowRight,
  Bell,
  RotateCcw,
} from 'lucide-react';
import { HelpIcon } from '../components/HelpIcon';
import { HELP_CONTENT } from '@/lib/helpContent';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn, formatTimeString, formatTimeRange } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/components/ui/toaster';
import {
  getSchedule,
  saveSchedule,
  getTransition,
  startTransition,
  updateTransition,
  cancelTransition,
  type SleepSchedule,
  type ScheduleTransition,
  type ScheduleType,
  type CreateScheduleInput,
} from '@/lib/api';

const SELECTED_CHILD_KEY = 'selectedChildId';

// Default schedule configurations based on type
const DEFAULT_SCHEDULES: Record<Exclude<ScheduleType, 'TRANSITION'>, Partial<CreateScheduleInput>> = {
  TWO_NAP: {
    type: 'TWO_NAP',
    wakeWindow1Min: 120, // 2h
    wakeWindow1Max: 150, // 2.5h
    wakeWindow2Min: 150, // 2.5h
    wakeWindow2Max: 210, // 3.5h
    wakeWindow3Min: 210, // 3.5h
    wakeWindow3Max: 270, // 4.5h
    nap1Earliest: '08:30',
    nap1LatestStart: '09:00',
    nap1MaxDuration: 120,
    nap1EndBy: '11:00',
    nap2Earliest: '12:00',
    nap2LatestStart: '13:00',
    nap2MaxDuration: 120,
    nap2EndBy: '15:00',
    nap2ExceptionDuration: 150,
    bedtimeEarliest: '17:30',
    bedtimeLatest: '19:30',
    bedtimeGoalStart: '19:00',
    bedtimeGoalEnd: '19:30',
    wakeTimeEarliest: '06:30',
    wakeTimeLatest: '07:30',
    daySleepCap: 210, // 3.5h
    minimumCribMinutes: 60,
    napReminderMinutes: 30,
    bedtimeReminderMinutes: 30,
    wakeDeadlineReminderMinutes: 15,
  },
  ONE_NAP: {
    type: 'ONE_NAP',
    wakeWindow1Min: 300, // 5h
    wakeWindow1Max: 330, // 5.5h
    wakeWindow2Min: 240, // 4h
    wakeWindow2Max: 300, // 5h
    nap1Earliest: '12:00',
    nap1LatestStart: '13:00',
    nap1MaxDuration: 180,
    nap1EndBy: '15:30',
    bedtimeEarliest: '18:00',
    bedtimeLatest: '19:30',
    bedtimeGoalStart: '18:45',
    bedtimeGoalEnd: '19:30',
    wakeTimeEarliest: '06:30',
    wakeTimeLatest: '08:00',
    daySleepCap: 150, // 2.5h
    minimumCribMinutes: 60,
    napReminderMinutes: 30,
    bedtimeReminderMinutes: 30,
    wakeDeadlineReminderMinutes: 15,
  },
  THREE_NAP: {
    type: 'THREE_NAP',
    wakeWindow1Min: 90, // 1.5h
    wakeWindow1Max: 120, // 2h
    wakeWindow2Min: 120, // 2h
    wakeWindow2Max: 150, // 2.5h
    wakeWindow3Min: 150, // 2.5h
    wakeWindow3Max: 180, // 3h
    nap1Earliest: '08:00',
    nap1LatestStart: '08:30',
    nap1MaxDuration: 90,
    nap1EndBy: '10:00',
    nap2Earliest: '11:30',
    nap2LatestStart: '12:30',
    nap2MaxDuration: 90,
    nap2EndBy: '14:30',
    bedtimeEarliest: '18:00',
    bedtimeLatest: '19:30',
    bedtimeGoalStart: '18:30',
    bedtimeGoalEnd: '19:00',
    wakeTimeEarliest: '06:00',
    wakeTimeLatest: '07:00',
    daySleepCap: 270, // 4.5h
    minimumCribMinutes: 60,
    napReminderMinutes: 30,
    bedtimeReminderMinutes: 30,
    wakeDeadlineReminderMinutes: 15,
  },
};

interface ScheduleOption {
  type: Exclude<ScheduleType, 'TRANSITION'>;
  label: string;
  description: string;
  recommended?: boolean;
}

const scheduleOptions: ScheduleOption[] = [
  {
    type: 'TWO_NAP',
    label: '2-Nap Schedule',
    description: 'For babies typically 6-15 months. Two naps per day with wake windows of 2-3.5 hours.',
    recommended: true,
  },
  {
    type: 'ONE_NAP',
    label: '1-Nap Schedule',
    description: 'For babies/toddlers 15+ months. Single midday nap with wake windows of 5-5.5 hours.',
  },
  {
    type: 'THREE_NAP',
    label: '3-Nap Schedule',
    description: 'For younger babies 4-6 months. Three shorter naps with wake windows of 1.5-2.5 hours.',
  },
];

export default function Schedule() {
  const { accessToken } = useAuthStore();
  const toast = useToast();

  const [selectedChildId] = useState<string | null>(() => {
    return localStorage.getItem(SELECTED_CHILD_KEY);
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [currentSchedule, setCurrentSchedule] = useState<SleepSchedule | null>(null);
  const [currentTransition, setCurrentTransition] = useState<ScheduleTransition | null>(null);
  const [selectedType, setSelectedType] = useState<Exclude<ScheduleType, 'TRANSITION'> | null>(null);
  const [scheduleConfig, setScheduleConfig] = useState<Partial<CreateScheduleInput>>({});

  const [showTransitionWarning, setShowTransitionWarning] = useState(false);
  const [showTransitionSetup, setShowTransitionSetup] = useState(false);
  const [transitionNapTime, setTransitionNapTime] = useState('11:30');
  const [transitionWeeks, setTransitionWeeks] = useState(6);

  // Load current schedule and transition
  const loadData = useCallback(async () => {
    if (!accessToken || !selectedChildId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Load schedule
      const scheduleResult = await getSchedule(accessToken, selectedChildId);
      if (scheduleResult.success && scheduleResult.data) {
        setCurrentSchedule(scheduleResult.data);
        const type = scheduleResult.data.type as ScheduleType;
        if (type !== 'TRANSITION') {
          setSelectedType(type);
          // Convert null to undefined for compatibility
          const config: Partial<CreateScheduleInput> = {
            type: scheduleResult.data.type as ScheduleType,
            wakeWindow1Min: scheduleResult.data.wakeWindow1Min,
            wakeWindow1Max: scheduleResult.data.wakeWindow1Max,
            wakeWindow2Min: scheduleResult.data.wakeWindow2Min ?? undefined,
            wakeWindow2Max: scheduleResult.data.wakeWindow2Max ?? undefined,
            wakeWindow3Min: scheduleResult.data.wakeWindow3Min ?? undefined,
            wakeWindow3Max: scheduleResult.data.wakeWindow3Max ?? undefined,
            nap1Earliest: scheduleResult.data.nap1Earliest ?? undefined,
            nap1LatestStart: scheduleResult.data.nap1LatestStart ?? undefined,
            nap1MaxDuration: scheduleResult.data.nap1MaxDuration ?? undefined,
            nap1EndBy: scheduleResult.data.nap1EndBy ?? undefined,
            nap2Earliest: scheduleResult.data.nap2Earliest ?? undefined,
            nap2LatestStart: scheduleResult.data.nap2LatestStart ?? undefined,
            nap2MaxDuration: scheduleResult.data.nap2MaxDuration ?? undefined,
            nap2EndBy: scheduleResult.data.nap2EndBy ?? undefined,
            nap2ExceptionDuration: scheduleResult.data.nap2ExceptionDuration ?? undefined,
            bedtimeEarliest: scheduleResult.data.bedtimeEarliest,
            bedtimeLatest: scheduleResult.data.bedtimeLatest,
            bedtimeGoalStart: scheduleResult.data.bedtimeGoalStart ?? undefined,
            bedtimeGoalEnd: scheduleResult.data.bedtimeGoalEnd ?? undefined,
            wakeTimeEarliest: scheduleResult.data.wakeTimeEarliest,
            wakeTimeLatest: scheduleResult.data.wakeTimeLatest,
            daySleepCap: scheduleResult.data.daySleepCap,
            minimumCribMinutes: scheduleResult.data.minimumCribMinutes ?? 60,
            napReminderMinutes: scheduleResult.data.napReminderMinutes ?? 30,
            bedtimeReminderMinutes: scheduleResult.data.bedtimeReminderMinutes ?? 30,
            wakeDeadlineReminderMinutes: scheduleResult.data.wakeDeadlineReminderMinutes ?? 15,
          };
          setScheduleConfig(config);
        }
      } else {
        // No schedule yet, use defaults
        setSelectedType(null);
        setCurrentSchedule(null);
      }

      // Load transition
      const transitionResult = await getTransition(accessToken, selectedChildId);
      if (transitionResult.success && transitionResult.data) {
        setCurrentTransition(transitionResult.data);
      } else {
        setCurrentTransition(null);
      }
    } catch (err) {
      console.error('[Schedule] Failed to load data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, selectedChildId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectType = (type: Exclude<ScheduleType, 'TRANSITION'>) => {
    // If switching from 2-nap to 1-nap, show transition warning
    if (currentSchedule?.type === 'TWO_NAP' && type === 'ONE_NAP') {
      setShowTransitionWarning(true);
      return;
    }

    setSelectedType(type);
    setScheduleConfig(DEFAULT_SCHEDULES[type]);
  };

  const handleSkipTransition = () => {
    setShowTransitionWarning(false);
    setSelectedType('ONE_NAP');
    setScheduleConfig(DEFAULT_SCHEDULES.ONE_NAP);
  };

  const handleStartTransition = () => {
    setShowTransitionWarning(false);
    setShowTransitionSetup(true);
  };

  const handleSaveSchedule = async () => {
    if (!accessToken || !selectedChildId || !selectedType) return;

    setIsSaving(true);
    try {
      const fullConfig: CreateScheduleInput = {
        ...DEFAULT_SCHEDULES[selectedType],
        ...scheduleConfig,
        type: selectedType,
      } as CreateScheduleInput;

      const result = await saveSchedule(accessToken, selectedChildId, fullConfig);
      if (result.success) {
        toast.success('Schedule saved', 'Your sleep schedule has been updated');
        setCurrentSchedule(result.data!);
      } else {
        toast.error('Failed to save', result.error?.message || 'Could not save schedule');
      }
    } catch (err) {
      console.error('[Schedule] Save error:', err);
      toast.error('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartTransitionConfirm = async () => {
    if (!accessToken || !selectedChildId) return;

    setIsSaving(true);
    try {
      const result = await startTransition(accessToken, selectedChildId, {
        fromType: 'TWO_NAP',
        toType: 'ONE_NAP',
        startNapTime: transitionNapTime,
        targetWeeks: transitionWeeks,
      });
      if (result.success) {
        toast.success('Transition started', 'Your 2-to-1 nap transition has begun');
        setCurrentTransition(result.data!);
        setShowTransitionSetup(false);
        loadData();
      } else {
        toast.error('Failed to start', result.error?.message || 'Could not start transition');
      }
    } catch (err) {
      console.error('[Schedule] Start transition error:', err);
      toast.error('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleProgressTransition = async () => {
    if (!accessToken || !selectedChildId || !currentTransition) return;

    setIsSaving(true);
    try {
      // Push nap time 15 minutes later
      const parts = currentTransition.currentNapTime.split(':').map(Number);
      const hours = parts[0] ?? 12;
      const minutes = parts[1] ?? 0;
      const newMinutes = minutes + 15;
      const newHours = hours + Math.floor(newMinutes / 60);
      const newTime = `${String(newHours).padStart(2, '0')}:${String(newMinutes % 60).padStart(2, '0')}`;

      const result = await updateTransition(accessToken, selectedChildId, {
        newNapTime: newTime,
        currentWeek: currentTransition.currentWeek + 1,
      });
      if (result.success) {
        toast.success('Progress saved', `Nap time moved to ${newTime}`);
        setCurrentTransition(result.data!);
      } else {
        toast.error('Failed to update', result.error?.message || 'Could not update transition');
      }
    } catch (err) {
      console.error('[Schedule] Progress error:', err);
      toast.error('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCompleteTransition = async () => {
    if (!accessToken || !selectedChildId) return;

    setIsSaving(true);
    try {
      const result = await updateTransition(accessToken, selectedChildId, { complete: true });
      if (result.success) {
        toast.success('Transition complete!', 'Your baby is now on a 1-nap schedule');
        setCurrentTransition(null);
        loadData();
      } else {
        toast.error('Failed to complete', result.error?.message || 'Could not complete transition');
      }
    } catch (err) {
      console.error('[Schedule] Complete error:', err);
      toast.error('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelTransition = async () => {
    if (!accessToken || !selectedChildId) return;

    if (!confirm('Cancel the transition? This will revert to the 2-nap schedule.')) return;

    setIsSaving(true);
    try {
      const result = await cancelTransition(accessToken, selectedChildId);
      if (result.success) {
        toast.info('Transition cancelled', 'Reverted to 2-nap schedule');
        setCurrentTransition(null);
        loadData();
      } else {
        toast.error('Failed to cancel', result.error?.message || 'Could not cancel transition');
      }
    } catch (err) {
      console.error('[Schedule] Cancel error:', err);
      toast.error('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateTargetWeeks = async (newTargetWeeks: number) => {
    if (!accessToken || !selectedChildId || !currentTransition) return;

    setIsSaving(true);
    try {
      const result = await updateTransition(accessToken, selectedChildId, {
        targetWeeks: newTargetWeeks,
      });
      if (result.success) {
        const isFastTrack = newTargetWeeks <= 4;
        toast.success(
          'Transition updated',
          isFastTrack ? `Fast-track mode: ${newTargetWeeks} weeks` : `Standard pace: ${newTargetWeeks} weeks`
        );
        setCurrentTransition(result.data!);
      } else {
        toast.error('Failed to update', result.error?.message || 'Could not update transition');
      }
    } catch (err) {
      console.error('[Schedule] Update target weeks error:', err);
      toast.error('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const formatMinutesToHours = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20 md:pb-0">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border px-4 py-4 md:border-b-0">
          <h1 className="text-xl font-bold">Sleep Schedule</h1>
        </header>
        <main className="px-4 py-6 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  if (!selectedChildId) {
    return (
      <div className="min-h-screen bg-background pb-20 md:pb-0">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border px-4 py-4 md:border-b-0">
          <h1 className="text-xl font-bold">Sleep Schedule</h1>
        </header>
        <main className="px-4 py-6">
          <Card>
            <CardContent className="text-center py-12">
              <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No child selected</p>
              <p className="text-sm text-muted-foreground/70 mt-2">
                Select a child from the home screen to configure their schedule
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Show active transition UI
  if (currentTransition && !currentTransition.completedAt) {
    const targetWeeks = currentTransition.targetWeeks || 6;
    const progressPercent = Math.min(100, (currentTransition.currentWeek / targetWeeks) * 100);

    return (
      <div className="min-h-screen bg-background pb-20 md:pb-0">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border px-4 py-4 md:border-b-0">
          <h1 className="text-xl font-bold">2-to-1 Nap Transition</h1>
          <p className="text-sm text-muted-foreground">Week {currentTransition.currentWeek} of {targetWeeks}</p>
        </header>

        <main className="px-4 py-6 space-y-6">
          {/* Progress Card */}
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowRight className="w-4 h-4" />
                Transition Progress
                <HelpIcon {...HELP_CONTENT.transitionProgress} />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Current Week</span>
                <span className="font-bold text-2xl text-primary">{currentTransition.currentWeek} / {targetWeeks}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Target Nap Time</span>
                <span className="font-bold text-2xl">{formatTimeString(currentTransition.currentNapTime)}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Goal: Nap at 12:30 - 1:00 PM by week {targetWeeks}
              </p>
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                This Week's Plan
                <HelpIcon {...HELP_CONTENT.transitionWeeklyPlan} />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">
                Aim for a single nap starting at <strong>{formatTimeString(currentTransition.currentNapTime)}</strong>.
              </p>
              <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-4">
                <li>Keep baby awake until the target nap time</li>
                <li>90-minute minimum crib time rule applies</li>
                <li>Expect earlier bedtime (6:00-7:00 PM) during transition</li>
                <li>It's okay if some days need a rescue nap</li>
              </ul>
            </CardContent>
          </Card>

          {/* Adjust Transition Duration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                Adjust Transition Pace
                <HelpIcon {...HELP_CONTENT.transitionPace} />
              </CardTitle>
              <CardDescription>
                {targetWeeks <= 4 ? 'Fast-track mode enabled' : 'Standard pace'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={2}
                  max={6}
                  value={targetWeeks}
                  onChange={(e) => handleUpdateTargetWeeks(parseInt(e.target.value))}
                  className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  disabled={isSaving}
                />
                <span className="w-16 text-center font-bold text-lg">{targetWeeks} wks</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {targetWeeks === 6 && 'Standard pace - recommended for most babies'}
                {targetWeeks === 5 && 'Slightly accelerated pace'}
                {targetWeeks === 4 && 'Accelerated pace - for babies showing strong readiness'}
                {targetWeeks === 3 && 'Fast pace - for babies adapting quickly'}
                {targetWeeks === 2 && 'Fastest pace - only if baby is fully ready'}
              </p>
              {targetWeeks <= 4 && (
                <div className="mt-2 p-2 bg-primary/10 rounded text-xs">
                  <strong>Fast-track tips:</strong>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Check temperament at 11:30am - if good, try pushing to 12pm</li>
                    <li>Can push nap time every 2-3 days if baby adapts well</li>
                    <li>Morning rest can help baby stay well-rested</li>
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              onClick={handleProgressTransition}
              className="w-full"
              size="lg"
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Clock className="w-4 h-4 mr-2" />
              )}
              Push Nap 15 Minutes Later
            </Button>

            {currentTransition.currentWeek >= 4 && (
              <Button
                onClick={handleCompleteTransition}
                variant="outline"
                className="w-full border-green-500 text-green-600 hover:bg-green-50"
                size="lg"
                disabled={isSaving}
              >
                <Check className="w-4 h-4 mr-2" />
                Complete Transition
              </Button>
            )}

            <Button
              onClick={handleCancelTransition}
              variant="ghost"
              className="w-full text-muted-foreground"
              disabled={isSaving}
            >
              Cancel Transition
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border px-4 py-4 md:border-b-0">
        <h1 className="text-xl font-bold">Sleep Schedule</h1>
        <p className="text-sm text-muted-foreground">Configure your baby's sleep routine</p>
      </header>

      <main className="px-4 py-6 space-y-6">
        {/* Transition Warning Modal */}
        {showTransitionWarning && (
          <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-amber-800 dark:text-amber-200">
                <AlertTriangle className="w-5 h-5" />
                2-to-1 Nap Transition Recommended
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Switching directly from a 2-nap to 1-nap schedule is not recommended.
                The transition should happen gradually over 4-6 weeks to avoid overtiredness.
              </p>
              <div className="flex gap-2">
                <Button onClick={handleStartTransition} className="flex-1">
                  Start Transition
                </Button>
                <Button
                  onClick={handleSkipTransition}
                  variant="outline"
                  className="flex-1 border-amber-500 text-amber-700"
                >
                  Skip Anyway
                </Button>
              </div>
              <Button
                onClick={() => setShowTransitionWarning(false)}
                variant="ghost"
                className="w-full"
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Transition Setup Modal */}
        {showTransitionSetup && (
          <Card className="border-primary">
            <CardHeader>
              <CardTitle className="text-base">Start 2-to-1 Transition</CardTitle>
              <CardDescription>
                Gradually transition from 2 naps to 1 nap over {transitionWeeks} weeks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Transition Duration (weeks)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={2}
                    max={6}
                    value={transitionWeeks}
                    onChange={(e) => setTransitionWeeks(parseInt(e.target.value))}
                    className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <span className="w-12 text-center font-bold text-lg">{transitionWeeks}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {transitionWeeks === 6 && 'Standard pace - recommended for most babies'}
                  {transitionWeeks === 5 && 'Slightly accelerated pace'}
                  {transitionWeeks === 4 && 'Accelerated pace - for babies showing strong readiness'}
                  {transitionWeeks === 3 && 'Fast pace - for babies adapting quickly'}
                  {transitionWeeks === 2 && 'Fastest pace - only if baby is fully ready'}
                </p>
                {transitionWeeks <= 4 && (
                  <div className="mt-2 p-2 bg-primary/10 rounded text-xs">
                    <strong>Fast-track tips:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>Check temperament at 11:30am - if good, try pushing to 12pm</li>
                      <li>If baby does well at 12/12:15pm for a few days, bump to 12:30pm</li>
                      <li>Some morning rest can help baby stay well-rested during transition</li>
                    </ul>
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Initial Single Nap Time
                </label>
                <Input
                  type="time"
                  value={transitionNapTime}
                  onChange={(e) => setTransitionNapTime(e.target.value)}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {transitionWeeks <= 4
                    ? 'Fast-track: Start at 12:00pm if baby shows readiness, or 11:30am to ease in'
                    : 'Recommended: 11:30 AM for week 1-2'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleStartTransitionConfirm}
                  className="flex-1"
                  disabled={isSaving}
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Start Transition'}
                </Button>
                <Button
                  onClick={() => setShowTransitionSetup(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Schedule Type Selection */}
        {!showTransitionWarning && !showTransitionSetup && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Schedule Type
                  <HelpIcon {...HELP_CONTENT.scheduleType} />
                </CardTitle>
                <CardDescription>
                  Select the sleep schedule that matches your baby's age and needs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {scheduleOptions.map((option) => (
                  <button
                    key={option.type}
                    onClick={() => handleSelectType(option.type)}
                    className={cn(
                      'w-full p-4 text-left rounded-lg border-2 transition-all',
                      selectedType === option.type
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50 hover:bg-accent/50'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{option.label}</span>
                          {option.recommended && (
                            <Badge variant="default" className="text-xs">Recommended</Badge>
                          )}
                          {currentSchedule?.type === option.type && (
                            <Badge variant="secondary" className="text-xs">Current</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {option.description}
                        </p>
                      </div>
                      {selectedType === option.type && (
                        <div className="rounded-full bg-primary p-1">
                          <Check className="w-4 h-4 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Wake Windows */}
            <Card className={cn(!selectedType && 'opacity-60')}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Wake Windows
                  <HelpIcon {...HELP_CONTENT.wakeWindows} />
                </CardTitle>
                <CardDescription>
                  {selectedType
                    ? 'Adjust time between sleep periods (in minutes)'
                    : 'Select a schedule type first'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedType ? (
                  <div className="space-y-4">
                    {/* Wake Window 1: Wake to First Nap */}
                    <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">
                            {selectedType === 'ONE_NAP' ? 'Wake to Nap' : 'Wake to Nap 1'}
                          </p>
                          <p className="text-xs text-muted-foreground">First wake window</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-primary">
                            {formatMinutesToHours(scheduleConfig.wakeWindow1Min || 0)}-
                            {formatMinutesToHours(scheduleConfig.wakeWindow1Max || 0)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            title="Reset to default"
                            onClick={() => {
                              const defaults = DEFAULT_SCHEDULES[selectedType as keyof typeof DEFAULT_SCHEDULES];
                              if (defaults) {
                                setScheduleConfig(prev => ({
                                  ...prev,
                                  wakeWindow1Min: defaults.wakeWindow1Min,
                                  wakeWindow1Max: defaults.wakeWindow1Max,
                                }));
                              }
                            }}
                          >
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-muted-foreground">Min (minutes)</label>
                          <Input
                            type="number"
                            min={30}
                            max={480}
                            step={15}
                            value={scheduleConfig.wakeWindow1Min || 120}
                            onChange={(e) => setScheduleConfig(prev => ({
                              ...prev,
                              wakeWindow1Min: parseInt(e.target.value) || 120
                            }))}
                            className="h-8"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Max (minutes)</label>
                          <Input
                            type="number"
                            min={30}
                            max={480}
                            step={15}
                            value={scheduleConfig.wakeWindow1Max || 150}
                            onChange={(e) => setScheduleConfig(prev => ({
                              ...prev,
                              wakeWindow1Max: parseInt(e.target.value) || 150
                            }))}
                            className="h-8"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Wake Window 2: Between Naps (for 2-nap/3-nap) OR Nap to Bedtime (for 1-nap) */}
                    {selectedType !== 'ONE_NAP' ? (
                      <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">Nap 1 to Nap 2</p>
                            <p className="text-xs text-muted-foreground">Second wake window</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-primary">
                              {formatMinutesToHours(scheduleConfig.wakeWindow2Min || 0)}-
                              {formatMinutesToHours(scheduleConfig.wakeWindow2Max || 0)}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              title="Reset to default"
                              onClick={() => {
                                const defaults = DEFAULT_SCHEDULES[selectedType as keyof typeof DEFAULT_SCHEDULES];
                                if (defaults) {
                                  setScheduleConfig(prev => ({
                                    ...prev,
                                    wakeWindow2Min: defaults.wakeWindow2Min,
                                    wakeWindow2Max: defaults.wakeWindow2Max,
                                  }));
                                }
                              }}
                            >
                              <RotateCcw className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-muted-foreground">Min (minutes)</label>
                            <Input
                              type="number"
                              min={30}
                              max={480}
                              step={15}
                              value={scheduleConfig.wakeWindow2Min || 150}
                              onChange={(e) => setScheduleConfig(prev => ({
                                ...prev,
                                wakeWindow2Min: parseInt(e.target.value) || 150
                              }))}
                              className="h-8"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Max (minutes)</label>
                            <Input
                              type="number"
                              min={30}
                              max={480}
                              step={15}
                              value={scheduleConfig.wakeWindow2Max || 210}
                              onChange={(e) => setScheduleConfig(prev => ({
                                ...prev,
                                wakeWindow2Max: parseInt(e.target.value) || 210
                              }))}
                              className="h-8"
                            />
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {/* Wake Window 3: Last Nap to Bedtime (for 2-nap/3-nap) OR use WW2 for 1-nap */}
                    <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">
                            {selectedType === 'ONE_NAP' ? 'Nap to Bedtime' : 'Last Nap to Bedtime'}
                          </p>
                          <p className="text-xs text-muted-foreground">Final wake window</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-primary">
                            {selectedType === 'ONE_NAP'
                              ? `${formatMinutesToHours(scheduleConfig.wakeWindow2Min || 0)}-${formatMinutesToHours(scheduleConfig.wakeWindow2Max || 0)}`
                              : `${formatMinutesToHours(scheduleConfig.wakeWindow3Min || 0)}-${formatMinutesToHours(scheduleConfig.wakeWindow3Max || 0)}`
                            }
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            title="Reset to default"
                            onClick={() => {
                              const defaults = DEFAULT_SCHEDULES[selectedType as keyof typeof DEFAULT_SCHEDULES];
                              if (defaults) {
                                if (selectedType === 'ONE_NAP') {
                                  setScheduleConfig(prev => ({
                                    ...prev,
                                    wakeWindow2Min: defaults.wakeWindow2Min,
                                    wakeWindow2Max: defaults.wakeWindow2Max,
                                  }));
                                } else {
                                  setScheduleConfig(prev => ({
                                    ...prev,
                                    wakeWindow3Min: defaults.wakeWindow3Min,
                                    wakeWindow3Max: defaults.wakeWindow3Max,
                                  }));
                                }
                              }
                            }}
                          >
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedType === 'ONE_NAP' ? (
                          <>
                            <div>
                              <label className="text-xs text-muted-foreground">Min (minutes)</label>
                              <Input
                                type="number"
                                min={30}
                                max={480}
                                step={15}
                                value={scheduleConfig.wakeWindow2Min || 240}
                                onChange={(e) => setScheduleConfig(prev => ({
                                  ...prev,
                                  wakeWindow2Min: parseInt(e.target.value) || 240
                                }))}
                                className="h-8"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Max (minutes)</label>
                              <Input
                                type="number"
                                min={30}
                                max={480}
                                step={15}
                                value={scheduleConfig.wakeWindow2Max || 300}
                                onChange={(e) => setScheduleConfig(prev => ({
                                  ...prev,
                                  wakeWindow2Max: parseInt(e.target.value) || 300
                                }))}
                                className="h-8"
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <label className="text-xs text-muted-foreground">Min (minutes)</label>
                              <Input
                                type="number"
                                min={30}
                                max={480}
                                step={15}
                                value={scheduleConfig.wakeWindow3Min || 210}
                                onChange={(e) => setScheduleConfig(prev => ({
                                  ...prev,
                                  wakeWindow3Min: parseInt(e.target.value) || 210
                                }))}
                                className="h-8"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Max (minutes)</label>
                              <Input
                                type="number"
                                min={30}
                                max={480}
                                step={15}
                                value={scheduleConfig.wakeWindow3Max || 270}
                                onChange={(e) => setScheduleConfig(prev => ({
                                  ...prev,
                                  wakeWindow3Max: parseInt(e.target.value) || 270
                                }))}
                                className="h-8"
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground">
                      Configure after selecting a schedule type
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sleep Caps & Times */}
            <Card className={cn(!selectedType && 'opacity-60')}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Moon className="w-4 h-4" />
                  Sleep Caps & Times
                  <HelpIcon {...HELP_CONTENT.sleepCaps} />
                </CardTitle>
                <CardDescription>
                  {selectedType
                    ? 'Maximum sleep durations and target times'
                    : 'Select a schedule type first'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedType ? (
                  <div className="space-y-4">
                    {/* Day Sleep Cap - Editable */}
                    <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <div className="min-w-0">
                          <p className="font-medium text-sm">Day Sleep Cap</p>
                          <p className="text-xs text-muted-foreground">Total nap sleep per day</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-semibold text-primary whitespace-nowrap">
                            {formatMinutesToHours(scheduleConfig.daySleepCap || 0)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            title="Reset to default"
                            onClick={() => {
                              const defaults = DEFAULT_SCHEDULES[selectedType as keyof typeof DEFAULT_SCHEDULES];
                              if (defaults) {
                                setScheduleConfig(prev => ({
                                  ...prev,
                                  daySleepCap: defaults.daySleepCap,
                                }));
                              }
                            }}
                          >
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Minutes</label>
                        <Input
                          type="number"
                          min={60}
                          max={480}
                          step={15}
                          value={scheduleConfig.daySleepCap || 210}
                          onChange={(e) => setScheduleConfig(prev => ({
                            ...prev,
                            daySleepCap: parseInt(e.target.value) || 210
                          }))}
                          className="h-8 w-full"
                        />
                      </div>
                    </div>

                    {/* Target Bedtime - Editable */}
                    <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <div className="min-w-0">
                          <p className="font-medium text-sm">Target Bedtime</p>
                          <p className="text-xs text-muted-foreground">Goal bedtime range</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-semibold text-primary whitespace-nowrap">
                            {formatTimeString(scheduleConfig.bedtimeGoalStart || scheduleConfig.bedtimeEarliest)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            title="Reset to default"
                            onClick={() => {
                              const defaults = DEFAULT_SCHEDULES[selectedType as keyof typeof DEFAULT_SCHEDULES];
                              if (defaults) {
                                setScheduleConfig(prev => ({
                                  ...prev,
                                  bedtimeGoalStart: defaults.bedtimeGoalStart,
                                  bedtimeGoalEnd: defaults.bedtimeGoalEnd,
                                }));
                              }
                            }}
                          >
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="min-w-0">
                          <label className="text-xs text-muted-foreground block mb-1">Start</label>
                          <Input
                            type="time"
                            value={scheduleConfig.bedtimeGoalStart || '19:00'}
                            onChange={(e) => setScheduleConfig(prev => ({
                              ...prev,
                              bedtimeGoalStart: e.target.value
                            }))}
                            className="h-8 w-full"
                          />
                        </div>
                        <div className="min-w-0">
                          <label className="text-xs text-muted-foreground block mb-1">End</label>
                          <Input
                            type="time"
                            value={scheduleConfig.bedtimeGoalEnd || '19:30'}
                            onChange={(e) => setScheduleConfig(prev => ({
                              ...prev,
                              bedtimeGoalEnd: e.target.value
                            }))}
                            className="h-8 w-full"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bedtime Range - Editable */}
                    <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <div className="min-w-0">
                          <p className="font-medium text-sm">Bedtime Range</p>
                          <p className="text-xs text-muted-foreground">Allowed bedtime window</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-semibold text-primary whitespace-nowrap">
                            {formatTimeRange(scheduleConfig.bedtimeEarliest, scheduleConfig.bedtimeLatest)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            title="Reset to default"
                            onClick={() => {
                              const defaults = DEFAULT_SCHEDULES[selectedType as keyof typeof DEFAULT_SCHEDULES];
                              if (defaults) {
                                setScheduleConfig(prev => ({
                                  ...prev,
                                  bedtimeEarliest: defaults.bedtimeEarliest,
                                  bedtimeLatest: defaults.bedtimeLatest,
                                }));
                              }
                            }}
                          >
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="min-w-0">
                          <label className="text-xs text-muted-foreground block mb-1">Earliest</label>
                          <Input
                            type="time"
                            value={scheduleConfig.bedtimeEarliest || '17:30'}
                            onChange={(e) => setScheduleConfig(prev => ({
                              ...prev,
                              bedtimeEarliest: e.target.value
                            }))}
                            className="h-8 w-full"
                          />
                        </div>
                        <div className="min-w-0">
                          <label className="text-xs text-muted-foreground block mb-1">Latest</label>
                          <Input
                            type="time"
                            value={scheduleConfig.bedtimeLatest || '19:30'}
                            onChange={(e) => setScheduleConfig(prev => ({
                              ...prev,
                              bedtimeLatest: e.target.value
                            }))}
                            className="h-8 w-full"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Wake Time Range - Editable */}
                    <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <div className="min-w-0">
                          <p className="font-medium text-sm">Wake Time Range</p>
                          <p className="text-xs text-muted-foreground">Expected morning wake</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-semibold text-primary whitespace-nowrap">
                            {formatTimeRange(scheduleConfig.wakeTimeEarliest, scheduleConfig.wakeTimeLatest)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            title="Reset to default"
                            onClick={() => {
                              const defaults = DEFAULT_SCHEDULES[selectedType as keyof typeof DEFAULT_SCHEDULES];
                              if (defaults) {
                                setScheduleConfig(prev => ({
                                  ...prev,
                                  wakeTimeEarliest: defaults.wakeTimeEarliest,
                                  wakeTimeLatest: defaults.wakeTimeLatest,
                                }));
                              }
                            }}
                          >
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="min-w-0">
                          <label className="text-xs text-muted-foreground block mb-1">Earliest</label>
                          <Input
                            type="time"
                            value={scheduleConfig.wakeTimeEarliest || '06:30'}
                            onChange={(e) => setScheduleConfig(prev => ({
                              ...prev,
                              wakeTimeEarliest: e.target.value
                            }))}
                            className="h-8 w-full"
                          />
                        </div>
                        <div className="min-w-0">
                          <label className="text-xs text-muted-foreground block mb-1">Latest</label>
                          <Input
                            type="time"
                            value={scheduleConfig.wakeTimeLatest || '07:30'}
                            onChange={(e) => setScheduleConfig(prev => ({
                              ...prev,
                              wakeTimeLatest: e.target.value
                            }))}
                            className="h-8 w-full"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground">
                      Configure after selecting a schedule type
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Nap Settings */}
            <Card className={cn(!selectedType && 'opacity-60')}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Nap Settings
                  <HelpIcon {...HELP_CONTENT.minimumCribTime} />
                </CardTitle>
                <CardDescription>
                  {selectedType
                    ? 'Configure nap-specific settings'
                    : 'Select a schedule type first'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedType ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Minimum Crib Time (minutes)
                      </label>
                      <p className="text-xs text-muted-foreground mb-2">
                        Minimum time baby should stay in crib during naps for sleep training
                      </p>
                      <Input
                        type="number"
                        min={30}
                        max={180}
                        value={scheduleConfig.minimumCribMinutes || 60}
                        onChange={(e) => setScheduleConfig(prev => ({
                          ...prev,
                          minimumCribMinutes: parseInt(e.target.value) || 60
                        }))}
                        className="w-full"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground">
                      Configure after selecting a schedule type
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notification Settings */}
            <Card className={cn(!selectedType && 'opacity-60')}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  Notification Reminders
                  <HelpIcon {...HELP_CONTENT.notifications} />
                </CardTitle>
                <CardDescription>
                  {selectedType
                    ? 'How far in advance to send reminders'
                    : 'Select a schedule type first'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedType ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Nap Reminder (minutes before)
                      </label>
                      <p className="text-xs text-muted-foreground mb-2">
                        Get notified before each nap time so you can prepare
                      </p>
                      <Input
                        type="number"
                        min={5}
                        max={120}
                        value={scheduleConfig.napReminderMinutes || 30}
                        onChange={(e) => setScheduleConfig(prev => ({
                          ...prev,
                          napReminderMinutes: parseInt(e.target.value) || 30
                        }))}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Bedtime Reminder (minutes before)
                      </label>
                      <p className="text-xs text-muted-foreground mb-2">
                        Get notified before bedtime to start the routine
                      </p>
                      <Input
                        type="number"
                        min={5}
                        max={120}
                        value={scheduleConfig.bedtimeReminderMinutes || 30}
                        onChange={(e) => setScheduleConfig(prev => ({
                          ...prev,
                          bedtimeReminderMinutes: parseInt(e.target.value) || 30
                        }))}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Wake Deadline Alert (minutes before)
                      </label>
                      <p className="text-xs text-muted-foreground mb-2">
                        Alert before the must-wake-by time during naps
                      </p>
                      <Input
                        type="number"
                        min={5}
                        max={60}
                        value={scheduleConfig.wakeDeadlineReminderMinutes || 15}
                        onChange={(e) => setScheduleConfig(prev => ({
                          ...prev,
                          wakeDeadlineReminderMinutes: parseInt(e.target.value) || 15
                        }))}
                        className="w-full"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground">
                      Configure after selecting a schedule type
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {selectedType && (
              <Button
                className="w-full"
                size="lg"
                onClick={handleSaveSchedule}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Schedule'
                )}
              </Button>
            )}
          </>
        )}
      </main>
    </div>
  );
}
