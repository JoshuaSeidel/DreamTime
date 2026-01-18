import { useState } from 'react';
import { Moon, Sun, Baby, LogOut, Clock, Loader2, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type SleepState = 'awake' | 'pending' | 'asleep';

interface QuickActionButtonsProps {
  currentState: SleepState;
  onAction: (action: 'put_down' | 'fell_asleep' | 'woke_up' | 'out_of_crib', customTime?: string) => void;
  disabled?: boolean;
  hasActiveSession?: boolean;
}

export default function QuickActionButtons({
  currentState,
  onAction,
  disabled = false,
  hasActiveSession = false,
}: QuickActionButtonsProps) {
  const [showTimeDialog, setShowTimeDialog] = useState(false);
  const [selectedAction, setSelectedAction] = useState<'put_down' | 'fell_asleep' | 'woke_up' | 'out_of_crib' | null>(null);
  const [customTime, setCustomTime] = useState('');
  const [customDate, setCustomDate] = useState('');

  const getAvailableActions = () => {
    switch (currentState) {
      case 'awake':
        // If there's an active session (baby woke during nap), show options to go back to sleep or finish
        if (hasActiveSession) {
          return ['fell_asleep', 'out_of_crib'] as const;
        }
        return ['put_down'] as const;
      case 'pending':
        return ['fell_asleep', 'out_of_crib'] as const;
      case 'asleep':
        return ['woke_up'] as const;
      default:
        return [];
    }
  };

  const actionConfig = {
    put_down: {
      label: 'Put Down',
      icon: Baby,
      bgClass: 'bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700',
      textClass: 'text-white',
      description: 'Baby placed in crib',
    },
    fell_asleep: {
      label: 'Fell Asleep',
      icon: Moon,
      bgClass: 'bg-violet-500 hover:bg-violet-600 dark:bg-violet-600 dark:hover:bg-violet-700',
      textClass: 'text-white',
      description: 'Baby fell asleep',
    },
    woke_up: {
      label: 'Woke Up',
      icon: Sun,
      bgClass: 'bg-yellow-500 hover:bg-yellow-600 dark:bg-yellow-500 dark:hover:bg-yellow-600',
      textClass: 'text-gray-900',
      description: 'Baby woke up',
    },
    out_of_crib: {
      label: 'Out of Crib',
      icon: LogOut,
      bgClass: 'bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700',
      textClass: 'text-white',
      description: 'Baby taken out of crib',
    },
  } as const;

  const availableActions = getAvailableActions();

  const handleEditTime = (action: 'put_down' | 'fell_asleep' | 'woke_up' | 'out_of_crib', e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedAction(action);
    // Set default values to now
    const now = new Date();
    setCustomDate(now.toISOString().split('T')[0] ?? '');
    setCustomTime(now.toTimeString().slice(0, 5));
    setShowTimeDialog(true);
  };

  const handleConfirmCustomTime = () => {
    if (selectedAction && customDate && customTime) {
      // Combine date and time into ISO string
      const dateTimeString = `${customDate}T${customTime}:00`;
      const customDateTime = new Date(dateTimeString).toISOString();
      onAction(selectedAction, customDateTime);
      setShowTimeDialog(false);
      setSelectedAction(null);
    }
  };

  const handleQuickAction = (action: 'put_down' | 'fell_asleep' | 'woke_up' | 'out_of_crib') => {
    onAction(action);
  };

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Quick Actions</h2>
          <p className="text-xs text-muted-foreground">Tap time to edit</p>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {availableActions.map((action) => {
            const config = actionConfig[action];
            const Icon = config.icon;

            return (
              <button
                key={action}
                onClick={() => handleQuickAction(action)}
                disabled={disabled}
                className={cn(
                  'rounded-xl p-5 flex items-center justify-between transition-all duration-200 active:scale-[0.98] shadow-md hover:shadow-lg min-h-[88px]',
                  config.bgClass,
                  config.textClass,
                  disabled && 'opacity-70 cursor-not-allowed'
                )}
              >
                <div className="flex items-center gap-4">
                  <div className="bg-white/20 rounded-full p-3">
                    {disabled ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <Icon className="w-6 h-6" />
                    )}
                  </div>
                  <div className="text-left">
                    <p className="text-lg font-semibold">{config.label}</p>
                    <p className={cn('text-sm', config.textClass === 'text-white' ? 'text-white/80' : 'text-gray-900/70')}>
                      {config.description}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => handleEditTime(action, e)}
                  disabled={disabled}
                  className={cn(
                    'flex items-center gap-1 text-sm px-2 py-1 rounded-lg transition-colors',
                    config.textClass === 'text-white'
                      ? 'text-white/70 hover:text-white hover:bg-white/10'
                      : 'text-gray-900/60 hover:text-gray-900 hover:bg-black/10'
                  )}
                  title="Click to enter custom time"
                >
                  <Clock className="w-4 h-4" />
                  {new Date().toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  <Edit2 className="w-3 h-3 ml-1" />
                </button>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Time Dialog */}
      <Dialog open={showTimeDialog} onOpenChange={setShowTimeDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Set Custom Time</DialogTitle>
            <DialogDescription>
              {selectedAction && (
                <>Enter the time when baby {actionConfig[selectedAction].description.toLowerCase()}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="customDate">Date</Label>
              <Input
                id="customDate"
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="customTime">Time</Label>
              <Input
                id="customTime"
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTimeDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmCustomTime}
              disabled={!customDate || !customTime}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
