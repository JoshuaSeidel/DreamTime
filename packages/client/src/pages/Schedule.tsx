import { useState } from 'react';
import { Calendar, Clock, Moon, Check, ChevronRight, Info } from 'lucide-react';
import BottomNav from '../components/BottomNav';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ScheduleType = 'TWO_NAP' | 'ONE_NAP' | 'TRANSITION' | null;

interface ScheduleOption {
  type: ScheduleType;
  label: string;
  description: string;
  recommended?: boolean;
}

const scheduleOptions: ScheduleOption[] = [
  {
    type: 'TWO_NAP',
    label: '2-Nap Schedule',
    description: 'For babies typically 6-15 months. Two naps per day with wake windows of 2-3.5 hours.',
    recommended: true,
  },
  {
    type: 'ONE_NAP',
    label: '1-Nap Schedule',
    description: 'For babies/toddlers 15+ months. Single midday nap with wake windows of 5-5.5 hours.',
  },
  {
    type: 'TRANSITION',
    label: '2-to-1 Transition',
    description: 'Guided 4-6 week transition from 2 naps to 1 nap with gradual timing adjustments.',
  },
];

export default function Schedule() {
  const [selectedType, setSelectedType] = useState<ScheduleType>(null);

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border px-4 py-4">
        <h1 className="text-xl font-bold text-primary">Sleep Schedule</h1>
        <p className="text-sm text-muted-foreground">Configure your baby's sleep routine</p>
      </header>

      <main className="px-4 py-6 space-y-6">
        {/* Schedule Type Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Schedule Type
            </CardTitle>
            <CardDescription>
              Select the sleep schedule that matches your baby's age and needs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {scheduleOptions.map((option) => (
              <button
                key={option.type}
                onClick={() => setSelectedType(option.type)}
                className={cn(
                  'w-full p-4 text-left rounded-lg border-2 transition-all',
                  selectedType === option.type
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-accent/50'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{option.label}</span>
                      {option.recommended && (
                        <Badge variant="default" className="text-xs">Recommended</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {option.description}
                    </p>
                  </div>
                  {selectedType === option.type && (
                    <div className="rounded-full bg-primary p-1">
                      <Check className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Wake Windows */}
        <Card className={cn(!selectedType && 'opacity-60')}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Wake Windows
            </CardTitle>
            <CardDescription>
              {selectedType
                ? 'Configure the time between sleep periods'
                : 'Select a schedule type first'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedType ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium">Wake to Nap 1</p>
                    <p className="text-sm text-muted-foreground">First wake window</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">2-2.5h</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
                {selectedType !== 'ONE_NAP' && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">Nap 1 to Nap 2</p>
                      <p className="text-sm text-muted-foreground">Second wake window</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">2.5-3.5h</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium">
                      {selectedType === 'ONE_NAP' ? 'Nap to Bedtime' : 'Last Nap to Bedtime'}
                    </p>
                    <p className="text-sm text-muted-foreground">Final wake window</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      {selectedType === 'ONE_NAP' ? '4-5h' : '3.5-4.5h'}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <Info className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">
                  Configure after selecting a schedule type
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sleep Caps */}
        <Card className={cn(!selectedType && 'opacity-60')}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Moon className="w-4 h-4" />
              Sleep Caps & Times
            </CardTitle>
            <CardDescription>
              {selectedType
                ? 'Maximum sleep durations and target times'
                : 'Select a schedule type first'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedType ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-2xl font-bold text-primary">3.5h</p>
                    <p className="text-sm text-muted-foreground">Day Sleep Cap</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-2xl font-bold text-primary">7:00 PM</p>
                    <p className="text-sm text-muted-foreground">Target Bedtime</p>
                  </div>
                </div>
                <Button className="w-full" variant="outline">
                  Customize Times
                </Button>
              </div>
            ) : (
              <div className="text-center py-6">
                <Info className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">
                  Configure after selecting a schedule type
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {selectedType && (
          <Button className="w-full" size="lg">
            Save Schedule
          </Button>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
