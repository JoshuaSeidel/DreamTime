import { useState } from 'react';
import { Car, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { NapLocation } from '@/lib/api';

type AdHocLocation = Exclude<NapLocation, 'CRIB'>;

interface AdHocNapDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSubmit: (data: {
    location: AdHocLocation;
    asleepAt: string;
    wokeUpAt: string;
    notes?: string;
  }) => Promise<void>;
  trigger?: React.ReactNode;
}

const LOCATION_OPTIONS: { value: AdHocLocation; label: string; icon: string }[] = [
  { value: 'CAR', label: 'Car', icon: 'car' },
  { value: 'STROLLER', label: 'Stroller', icon: 'stroller' },
  { value: 'CARRIER', label: 'Carrier', icon: 'carrier' },
  { value: 'SWING', label: 'Swing', icon: 'swing' },
  { value: 'PLAYPEN', label: 'Playpen', icon: 'playpen' },
  { value: 'OTHER', label: 'Other', icon: 'other' },
];

export default function AdHocNapDialog({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onSubmit,
  trigger,
}: AdHocNapDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const onOpenChange = controlledOnOpenChange ?? setInternalOpen;

  const [location, setLocation] = useState<AdHocLocation | ''>('');
  const [asleepDate, setAsleepDate] = useState('');
  const [asleepTime, setAsleepTime] = useState('');
  const [wokeUpDate, setWokeUpDate] = useState('');
  const [wokeUpTime, setWokeUpTime] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setLocation('');
    setAsleepDate('');
    setAsleepTime('');
    setWokeUpDate('');
    setWokeUpTime('');
    setNotes('');
    setError(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      // Set default dates/times when opening
      const now = new Date();
      const today = now.toISOString().split('T')[0] ?? '';
      setAsleepDate(today);
      setWokeUpDate(today);
      // Default to 30 minutes ago for fell asleep
      const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);
      setAsleepTime(thirtyMinAgo.toTimeString().slice(0, 5));
      setWokeUpTime(now.toTimeString().slice(0, 5));
    } else {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async () => {
    if (!location || !asleepDate || !asleepTime || !wokeUpDate || !wokeUpTime) {
      setError('Please fill in all required fields');
      return;
    }

    // Combine date and time
    const asleepAt = new Date(`${asleepDate}T${asleepTime}:00`).toISOString();
    const wokeUpAt = new Date(`${wokeUpDate}T${wokeUpTime}:00`).toISOString();

    // Validate times
    if (new Date(wokeUpAt) <= new Date(asleepAt)) {
      setError('Wake up time must be after fell asleep time');
      return;
    }

    // Check for unrealistic durations (> 4 hours)
    const durationMs = new Date(wokeUpAt).getTime() - new Date(asleepAt).getTime();
    const durationMinutes = durationMs / (1000 * 60);
    if (durationMinutes > 240) {
      setError('Duration seems too long (> 4 hours). Please check times.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        location,
        asleepAt,
        wokeUpAt,
        notes: notes.trim() || undefined,
      });
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log nap');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate duration for display
  const getDurationDisplay = () => {
    if (!asleepDate || !asleepTime || !wokeUpDate || !wokeUpTime) return null;
    try {
      const asleepAt = new Date(`${asleepDate}T${asleepTime}:00`);
      const wokeUpAt = new Date(`${wokeUpDate}T${wokeUpTime}:00`);
      const durationMs = wokeUpAt.getTime() - asleepAt.getTime();
      if (durationMs <= 0) return null;
      const minutes = Math.floor(durationMs / (1000 * 60));
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      if (hours === 0) return `${mins}m`;
      if (mins === 0) return `${hours}h`;
      return `${hours}h ${mins}m`;
    } catch {
      return null;
    }
  };

  // Calculate credit for display
  const getCreditDisplay = () => {
    if (!asleepDate || !asleepTime || !wokeUpDate || !wokeUpTime) return null;
    try {
      const asleepAt = new Date(`${asleepDate}T${asleepTime}:00`);
      const wokeUpAt = new Date(`${wokeUpDate}T${wokeUpTime}:00`);
      const durationMs = wokeUpAt.getTime() - asleepAt.getTime();
      if (durationMs <= 0) return null;
      const minutes = Math.floor(durationMs / (1000 * 60));
      if (minutes < 15) return '0m (too short)';
      const credit = Math.round(minutes / 2);
      const hours = Math.floor(credit / 60);
      const mins = credit % 60;
      if (hours === 0) return `${mins}m`;
      if (mins === 0) return `${hours}h`;
      return `${hours}h ${mins}m`;
    } catch {
      return null;
    }
  };

  const duration = getDurationDisplay();
  const credit = getCreditDisplay();

  const content = (
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Car className="w-5 h-5 text-blue-500" />
          Log Ad-Hoc Nap
        </DialogTitle>
        <DialogDescription>
          Record an unscheduled nap (car, stroller, etc.). Ad-hoc naps count for half credit toward sleep goals.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-4">
        {/* Location */}
        <div className="grid gap-2">
          <Label htmlFor="location">Where did baby sleep?</Label>
          <Select value={location} onValueChange={(v) => setLocation(v as AdHocLocation)}>
            <SelectTrigger>
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              {LOCATION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Fell Asleep */}
        <div className="grid gap-2">
          <Label>When did baby fall asleep?</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              value={asleepDate}
              onChange={(e) => setAsleepDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
            <Input
              type="time"
              value={asleepTime}
              onChange={(e) => setAsleepTime(e.target.value)}
            />
          </div>
        </div>

        {/* Woke Up */}
        <div className="grid gap-2">
          <Label>When did baby wake up?</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              value={wokeUpDate}
              onChange={(e) => setWokeUpDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
            <Input
              type="time"
              value={wokeUpTime}
              onChange={(e) => setWokeUpTime(e.target.value)}
            />
          </div>
        </div>

        {/* Duration & Credit Preview */}
        {duration && (
          <div className="flex gap-4 p-3 rounded-lg bg-muted/50">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Duration</p>
              <p className="text-lg font-semibold">{duration}</p>
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Sleep Credit</p>
              <p className={cn(
                "text-lg font-semibold",
                credit?.includes('too short') ? "text-amber-500" : "text-green-600 dark:text-green-400"
              )}>
                {credit}
              </p>
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="grid gap-2">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            placeholder="Any notes about the nap..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => handleOpenChange(false)}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !location || !asleepDate || !asleepTime || !wokeUpDate || !wokeUpTime}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Log Nap'
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  );

  if (trigger) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        {content}
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {content}
    </Dialog>
  );
}
