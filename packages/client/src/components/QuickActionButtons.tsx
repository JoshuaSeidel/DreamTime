import { Moon, Sun, Baby, LogOut, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type SleepState = 'awake' | 'pending' | 'asleep';

interface QuickActionButtonsProps {
  currentState: SleepState;
  onAction: (action: 'put_down' | 'fell_asleep' | 'woke_up' | 'out_of_crib') => void;
  disabled?: boolean;
  hasActiveSession?: boolean;
}

export default function QuickActionButtons({
  currentState,
  onAction,
  disabled = false,
  hasActiveSession = false,
}: QuickActionButtonsProps) {
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

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Quick Actions</h2>
      <div className="grid grid-cols-1 gap-3">
        {availableActions.map((action) => {
          const config = actionConfig[action];
          const Icon = config.icon;

          return (
            <button
              key={action}
              onClick={() => onAction(action)}
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
              <div className={cn('flex items-center gap-1 text-sm', config.textClass === 'text-white' ? 'text-white/70' : 'text-gray-900/60')}>
                <Clock className="w-4 h-4" />
                {new Date().toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
