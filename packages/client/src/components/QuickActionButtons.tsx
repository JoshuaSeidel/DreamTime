import { Moon, Sun, Baby, LogOut } from 'lucide-react';

type SleepState = 'awake' | 'pending' | 'asleep';

interface QuickActionButtonsProps {
  currentState: SleepState;
  onAction: (action: 'put_down' | 'fell_asleep' | 'woke_up' | 'out_of_crib') => void;
}

export default function QuickActionButtons({
  currentState,
  onAction,
}: QuickActionButtonsProps) {
  const getAvailableActions = () => {
    switch (currentState) {
      case 'awake':
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
      bgColor: 'bg-put-down',
      hoverColor: 'hover:bg-blue-600',
      description: 'Baby placed in crib',
    },
    fell_asleep: {
      label: 'Fell Asleep',
      icon: Moon,
      bgColor: 'bg-asleep',
      hoverColor: 'hover:bg-violet-600',
      description: 'Baby fell asleep',
    },
    woke_up: {
      label: 'Woke Up',
      icon: Sun,
      bgColor: 'bg-awake',
      hoverColor: 'hover:bg-yellow-600',
      description: 'Baby woke up',
    },
    out_of_crib: {
      label: 'Out of Crib',
      icon: LogOut,
      bgColor: 'bg-out-of-crib',
      hoverColor: 'hover:bg-green-600',
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
              className={`
                ${config.bgColor} ${config.hoverColor}
                text-white rounded-xl p-6
                flex items-center justify-between
                transition-all duration-200
                active:scale-[0.98]
                shadow-sm hover:shadow-md
                min-h-[80px]
              `}
            >
              <div className="flex items-center gap-4">
                <div className="bg-white/20 rounded-full p-3">
                  <Icon className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <p className="text-lg font-semibold">{config.label}</p>
                  <p className="text-sm text-white/80">{config.description}</p>
                </div>
              </div>
              <div className="text-sm opacity-75">
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
