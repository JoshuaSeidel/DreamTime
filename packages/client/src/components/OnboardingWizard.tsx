import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Moon,
  Clock,
  Baby,
  ArrowRight,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { completeOnboarding } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';

interface OnboardingWizardProps {
  open: boolean;
  onComplete: () => void;
}

interface Step {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

const STEPS: Step[] = [
  {
    id: 'welcome',
    title: 'Welcome to DreamTime!',
    description: 'Your personal baby sleep tracking assistant',
    icon: <Moon className="w-12 h-12 text-primary" />,
    content: (
      <div className="space-y-4 text-center">
        <p className="text-muted-foreground">
          DreamTime helps you track your baby's sleep, follow age-appropriate schedules,
          and get personalized recommendations based on sleep consultant principles.
        </p>
        <div className="grid grid-cols-3 gap-4 pt-4">
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xs text-muted-foreground">Track Sleep</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Baby className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xs text-muted-foreground">Smart Schedules</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xs text-muted-foreground">Better Nights</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'states',
    title: 'Sleep Tracking States',
    description: 'Track every transition for accurate data',
    icon: <ArrowRight className="w-12 h-12 text-primary" />,
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground text-center">
          Track your baby through 4 sleep states to calculate "qualified rest":
        </p>
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-600 font-medium text-sm">
              1
            </div>
            <div>
              <p className="font-medium text-sm">Put Down</p>
              <p className="text-xs text-muted-foreground">Baby placed in crib, settling</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-600 font-medium text-sm">
              2
            </div>
            <div>
              <p className="font-medium text-sm">Fell Asleep</p>
              <p className="text-xs text-muted-foreground">Baby is sleeping</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-600 font-medium text-sm">
              3
            </div>
            <div>
              <p className="font-medium text-sm">Woke Up</p>
              <p className="text-xs text-muted-foreground">Baby woke, still in crib</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-600 font-medium text-sm">
              4
            </div>
            <div>
              <p className="font-medium text-sm">Out of Crib</p>
              <p className="text-xs text-muted-foreground">Session complete</p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'wakeWindows',
    title: 'Wake Windows',
    description: 'The key to preventing overtiredness',
    icon: <Clock className="w-12 h-12 text-primary" />,
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground text-center">
          Wake windows are the maximum time your baby should be awake between sleep periods.
        </p>
        <div className="bg-muted/50 p-4 rounded-lg space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm">Too Short:</span>
            <span className="text-sm text-yellow-600 dark:text-yellow-400">Undertired fights</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm">Just Right:</span>
            <span className="text-sm text-green-600 dark:text-green-400">Easy settling</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm">Too Long:</span>
            <span className="text-sm text-red-600 dark:text-red-400">Overtired meltdowns</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center">
          DreamTime calculates optimal nap and bedtimes based on your configured wake windows.
        </p>
      </div>
    ),
  },
  {
    id: 'cribTime',
    title: 'Crib Time Rule',
    description: '60-90 minutes builds the sleep habit',
    icon: <Baby className="w-12 h-12 text-primary" />,
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground text-center">
          For sleep training success, baby needs consistent time in the crib - even if they don't sleep.
        </p>
        <div className="bg-primary/10 p-4 rounded-lg space-y-2">
          <p className="text-sm font-medium text-center">The 60-90 Minute Rule</p>
          <p className="text-xs text-muted-foreground text-center">
            Keep baby in the crib for at least 60-90 minutes. This builds the association:
            <span className="font-medium"> crib = sleep</span>.
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Short attempts don't work:</span> Taking baby out after 20 minutes
            teaches them that crying gets results.
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Quiet crib time counts:</span> Even if baby doesn't sleep,
            restful time in the crib is valuable and counted as "qualified rest."
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'recommendations',
    title: 'Smart Recommendations',
    description: 'Data-driven nap and bedtime guidance',
    icon: <Sparkles className="w-12 h-12 text-primary" />,
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground text-center">
          DreamTime uses your logged data and schedule to recommend optimal sleep times.
        </p>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
            <p className="text-sm">
              <span className="font-medium">Wake windows:</span> Calculates time since last sleep
            </p>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
            <p className="text-sm">
              <span className="font-medium">Sleep debt:</span> Adjusts bedtime if naps were short
            </p>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
            <p className="text-sm">
              <span className="font-medium">Schedule limits:</span> Respects your earliest/latest times
            </p>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
            <p className="text-sm">
              <span className="font-medium">Day sleep cap:</span> Protects night sleep
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'getStarted',
    title: "You're Ready!",
    description: 'Start tracking for better sleep',
    icon: <CheckCircle2 className="w-12 h-12 text-green-500" />,
    content: (
      <div className="space-y-4 text-center">
        <p className="text-muted-foreground">
          You're all set to start tracking your baby's sleep!
        </p>
        <div className="bg-muted/50 p-4 rounded-lg space-y-2">
          <p className="text-sm font-medium">Quick Tips:</p>
          <ul className="text-xs text-muted-foreground space-y-1 text-left list-disc list-inside">
            <li>Add your child in Settings if you haven't already</li>
            <li>Configure a schedule in the Schedule tab</li>
            <li>Use the quick action buttons to track sleep</li>
            <li>Tap the ? icons anytime for help</li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">
          You can always re-run this guide from Settings.
        </p>
      </div>
    ),
  },
];

export function OnboardingWizard({ open, onComplete }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { accessToken, setOnboardingCompleted } = useAuthStore();

  const step = STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === STEPS.length - 1;

  // Safety check - should never happen in practice
  if (!step) {
    return null;
  }

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      if (accessToken) {
        await completeOnboarding(accessToken);
      }
      setOnboardingCompleted();
      onComplete();
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      // Still close the wizard even if the API call fails
      setOnboardingCompleted();
      onComplete();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader className="items-center">
          <div className="mb-2">{step.icon}</div>
          <DialogTitle className="text-center">{step.title}</DialogTitle>
          <DialogDescription className="text-center">{step.description}</DialogDescription>
        </DialogHeader>

        <div className="py-4">{step.content}</div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 py-2">
          {STEPS.map((_, index) => (
            <div
              key={index}
              className={cn(
                'w-2 h-2 rounded-full transition-colors',
                index === currentStep
                  ? 'bg-primary'
                  : index < currentStep
                    ? 'bg-primary/50'
                    : 'bg-muted-foreground/30'
              )}
            />
          ))}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <div>
            {!isFirstStep && (
              <Button variant="ghost" onClick={handleBack} disabled={isSubmitting}>
                Back
              </Button>
            )}
            {isFirstStep && (
              <Button variant="ghost" onClick={handleSkip} disabled={isSubmitting}>
                Skip
              </Button>
            )}
          </div>
          <Button onClick={handleNext} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isLastStep ? 'Get Started' : 'Next'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
