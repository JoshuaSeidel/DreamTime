import { Moon, Sun, Baby } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type SessionType = 'NAP' | 'NIGHT_SLEEP';

interface SleepTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (type: SessionType, napNumber?: number) => void;
  currentNapCount: number;
}

export default function SleepTypeDialog({
  open,
  onOpenChange,
  onSelect,
  currentNapCount,
}: SleepTypeDialogProps) {
  const nextNapNumber = currentNapCount + 1;

  const handleSelect = (type: SessionType) => {
    if (type === 'NAP') {
      onSelect(type, nextNapNumber);
    } else {
      onSelect(type);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>What are you tracking?</DialogTitle>
          <DialogDescription>
            Choose the type of sleep to record
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 py-4">
          {/* Nap Option */}
          <button
            onClick={() => handleSelect('NAP')}
            className={cn(
              'flex items-center gap-4 p-4 rounded-xl border-2 transition-all',
              'border-blue-200 bg-blue-50 hover:border-blue-400 hover:bg-blue-100',
              'dark:border-blue-800 dark:bg-blue-950 dark:hover:border-blue-600 dark:hover:bg-blue-900'
            )}
          >
            <div className="rounded-full bg-blue-500 p-3 text-white">
              <Baby className="w-6 h-6" />
            </div>
            <div className="text-left flex-1">
              <p className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                Nap {nextNapNumber}
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Daytime sleep session
              </p>
            </div>
            <Sun className="w-5 h-5 text-blue-400" />
          </button>

          {/* Bedtime Option */}
          <button
            onClick={() => handleSelect('NIGHT_SLEEP')}
            className={cn(
              'flex items-center gap-4 p-4 rounded-xl border-2 transition-all',
              'border-violet-200 bg-violet-50 hover:border-violet-400 hover:bg-violet-100',
              'dark:border-violet-800 dark:bg-violet-950 dark:hover:border-violet-600 dark:hover:bg-violet-900'
            )}
          >
            <div className="rounded-full bg-violet-500 p-3 text-white">
              <Moon className="w-6 h-6" />
            </div>
            <div className="text-left flex-1">
              <p className="text-lg font-semibold text-violet-900 dark:text-violet-100">
                Bedtime
              </p>
              <p className="text-sm text-violet-700 dark:text-violet-300">
                Nighttime sleep
              </p>
            </div>
            <Moon className="w-5 h-5 text-violet-400" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
