import { useState, useEffect } from 'react';
import { Pencil, Loader2 } from 'lucide-react';
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
import { updateChild, type Child } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

interface EditChildDialogProps {
  child: Child;
  onChildUpdated?: () => void;
}

export default function EditChildDialog({ child, onChildUpdated }: EditChildDialogProps) {
  const { accessToken } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(child.name);
  const [birthDate, setBirthDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper to format date string
  const formatDateForInput = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0] ?? '';
  };

  // Format birthDate for input (YYYY-MM-DD)
  useEffect(() => {
    if (child.birthDate) {
      setBirthDate(formatDateForInput(child.birthDate));
    }
  }, [child.birthDate]);

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setName(child.name);
      if (child.birthDate) {
        setBirthDate(formatDateForInput(child.birthDate));
      }
      setError(null);
    }
  }, [isOpen, child]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!accessToken || !name || !birthDate) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await updateChild(accessToken, child.id, { name, birthDate });
      if (result.success) {
        setIsOpen(false);
        onChildUpdated?.();
      } else {
        setError(result.error?.message || 'Failed to update child');
      }
    } catch (err) {
      setError('Failed to update child');
    } finally {
      setIsLoading(false);
    }
  };

  const hasChanges = name !== child.name || birthDate !== formatDateForInput(child.birthDate);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-foreground"
        onClick={() => setIsOpen(true)}
      >
        <Pencil className="w-4 h-4" />
      </Button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Child</DialogTitle>
            <DialogDescription>
              Update your child's information.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  placeholder="Baby's name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-birthDate">Birth Date</Label>
                <Input
                  id="edit-birthDate"
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
              <Button type="submit" disabled={isLoading || !name || !birthDate || !hasChanges}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
