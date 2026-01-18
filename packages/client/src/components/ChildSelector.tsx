import { ChevronDown, Plus, Check, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { getChildren, type Child } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import AddChildDialog from './AddChildDialog';

interface ChildSelectorProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function ChildSelector({ selectedId, onSelect }: ChildSelectorProps) {
  const { accessToken } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState<Child[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadChildren = async () => {
    if (!accessToken) return;

    setIsLoading(true);
    try {
      const result = await getChildren(accessToken);
      if (result.success && result.data) {
        setChildren(result.data);
        // Auto-select first child if none selected
        if (!selectedId && result.data.length > 0) {
          const firstChild = result.data[0];
          if (firstChild) {
            onSelect(firstChild.id);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load children:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadChildren();
  }, [accessToken]);

  const selectedChild = children.find((c) => c.id === selectedId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <AddChildDialog
        onChildAdded={loadChildren}
        trigger={
          <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
            <Plus className="w-4 h-4" />
            <span className="font-medium">Add Child</span>
          </button>
        }
      />
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-sm font-medium text-primary">
            {selectedChild?.name.charAt(0) ?? '?'}
          </span>
        </div>
        <span className="font-medium">{selectedChild?.name ?? 'Select child'}</span>
        <ChevronDown className={cn(
          'w-4 h-4 text-muted-foreground transition-transform',
          isOpen && 'rotate-180'
        )} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-56 bg-popover rounded-lg shadow-lg border border-border z-20 overflow-hidden">
            <div className="py-1">
              {children.map((child) => (
                <button
                  key={child.id}
                  onClick={() => {
                    onSelect(child.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'w-full px-4 py-2 text-left flex items-center justify-between hover:bg-accent transition-colors',
                    selectedId === child.id && 'bg-accent'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {child.name.charAt(0)}
                      </span>
                    </div>
                    <span className="font-medium">{child.name}</span>
                  </div>
                  {selectedId === child.id && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </button>
              ))}
              <div className="h-px bg-border my-1" />
              <AddChildDialog
                onChildAdded={loadChildren}
                trigger={
                  <button
                    className="w-full px-4 py-2 text-left flex items-center gap-3 text-primary hover:bg-accent transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Plus className="w-4 h-4" />
                    </div>
                    <span className="font-medium">Add Child</span>
                  </button>
                }
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
