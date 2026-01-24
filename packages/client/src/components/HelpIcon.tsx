import { HelpCircle } from 'lucide-react';
import { useToast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';

interface HelpIconProps {
  title: string;
  description: string;
  className?: string;
}

export function HelpIcon({ title, description, className }: HelpIconProps) {
  const toast = useToast();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    toast.info(title, description);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'inline-flex items-center justify-center w-5 h-5 rounded-full',
        'text-muted-foreground hover:text-primary hover:bg-primary/10',
        'transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20',
        className
      )}
      aria-label={`Help: ${title}`}
    >
      <HelpCircle className="w-4 h-4" />
    </button>
  );
}
