import { useState } from 'react';
import { Car, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
import type { NapLocation } from '@/lib/api';

type AdHocLocation = Exclude<NapLocation, 'CRIB'>;

interface AdHocNapDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSubmit: (data: {
    location: AdHocLocation;
    asleepAt: string;
  }) => Promise<void>;
  trigger?: React.ReactNode;
}

const LOCATION_OPTIONS: { value: AdHocLocation; label: string }[] = [
  { value: 'CAR', label: 'Car' },
  { value: 'STROLLER', label: 'Stroller' },
  { value: 'CARRIER', label: 'Carrier' },
  { value: 'SWING', label: 'Swing' },
  { value: 'PLAYPEN', label: 'Playpen' },
  { value: 'OTHER', label: 'Other' },
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setLocation('');
    setError(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async () => {
    if (!location) {
      setError('Please select where baby is sleeping');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        location,
        asleepAt: new Date().toISOString(),
      });
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start nap');
    } finally {
      setIsSubmitting(false);
    }
  };

  const content = (
    <DialogContent className="sm:max-w-[350px]">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Car className="w-5 h-5 text-blue-500" />
          Start Ad-Hoc Nap
        </DialogTitle>
        <DialogDescription>
          Baby fell asleep outside the crib? Start tracking now, tap "Awake" when they wake up.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-4">
        {/* Location */}
        <div className="grid gap-2">
          <Label htmlFor="location">Where is baby sleeping?</Label>
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
          disabled={isSubmitting || !location}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Starting...
            </>
          ) : (
            'Start Nap'
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
