import { ChevronDown, Plus, Check } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface Child {
  id: string;
  name: string;
}

interface ChildSelectorProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

// TODO: Replace with actual data from API
const mockChildren: Child[] = [
  { id: '1', name: 'Oliver' },
];

export default function ChildSelector({ selectedId, onSelect }: ChildSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedChild = mockChildren.find((c) => c.id === selectedId) ?? mockChildren[0];

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
              {mockChildren.map((child) => (
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
              <button
                onClick={() => {
                  // TODO: Navigate to add child page
                  setIsOpen(false);
                }}
                className="w-full px-4 py-2 text-left flex items-center gap-3 text-primary hover:bg-accent transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <span className="font-medium">Add Child</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
