import { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
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
import { createChild } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

interface AddChildDialogProps {
  onChildAdded?: () => void;
  trigger?: React.ReactNode;
}

export default function AddChildDialog({ onChildAdded, trigger }: AddChildDialogProps) {
  const { accessToken } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !name || !birthDate) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await createChild(accessToken, { name, birthDate });
      if (result.success) {
        setName('');
        setBirthDate('');
        setIsOpen(false);
        onChildAdded?.();
      } else {
        setError(result.error?.message || 'Failed to add child');
      }
    } catch (err) {
      setError('Failed to add child');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(true);
  };

  // Clone the trigger element to add onClick handler, or use default button
  const renderTrigger = () => {
    if (trigger) {
      // If trigger is a React element, clone it with onClick
      if (typeof trigger === 'object' && trigger !== null && 'type' in trigger) {
        return (
          <div onClick={handleTriggerClick} style={{ cursor: 'pointer' }}>
            {trigger}
          </div>
        );
      }
      return <div onClick={handleTriggerClick}>{trigger}</div>;
    }
    return (
      <Button variant="outline" className="w-full border-dashed" onClick={handleTriggerClick}>
        <Plus className="w-4 h-4 mr-2" />
        Add Child
      </Button>
    );
  };

  return (
    <>
      {renderTrigger()}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Child</DialogTitle>
          <DialogDescription>
            Add your child's information to start tracking their sleep.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Baby's name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="birthDate">Birth Date</Label>
              <Input
                id="birthDate"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !name || !birthDate}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Child'
              )}
            </Button>
          </DialogFooter>
        </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
