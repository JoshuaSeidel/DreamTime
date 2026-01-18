import { useState } from 'react';
import { Moon, Clock } from 'lucide-react';
import BottomNav from '../components/BottomNav';
import QuickActionButtons from '../components/QuickActionButtons';
import ChildSelector from '../components/ChildSelector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type SleepState = 'awake' | 'pending' | 'asleep';

export default function Dashboard() {
  const [currentState, setCurrentState] = useState<SleepState>('awake');
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  const handleAction = (action: 'put_down' | 'fell_asleep' | 'woke_up' | 'out_of_crib') => {
    // TODO: Call API and update state
    console.log('Action:', action);

    switch (action) {
      case 'put_down':
        setCurrentState('pending');
        break;
      case 'fell_asleep':
        setCurrentState('asleep');
        break;
      case 'woke_up':
      case 'out_of_crib':
        setCurrentState('awake');
        break;
    }
  };

  const getStateColor = () => {
    switch (currentState) {
      case 'asleep':
        return 'bg-violet-500';
      case 'pending':
        return 'bg-blue-500';
      default:
        return 'bg-green-500';
    }
  };

  const getStateText = () => {
    switch (currentState) {
      case 'asleep':
        return 'Asleep';
      case 'pending':
        return 'In Crib';
      default:
        return 'Awake';
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border px-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary">DreamTime</h1>
          <ChildSelector
            selectedId={selectedChildId}
            onSelect={setSelectedChildId}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-6 space-y-6">
        {/* Current State Card */}
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground mb-2">Current Status</p>
            <div className="flex items-center justify-center gap-3">
              <span
                className={cn(
                  'w-4 h-4 rounded-full',
                  getStateColor(),
                  currentState === 'asleep' && 'animate-pulse-slow',
                  currentState === 'pending' && 'animate-pulse'
                )}
              />
              <span className="text-3xl font-bold">{getStateText()}</span>
            </div>
            {currentState !== 'awake' && (
              <p className="text-sm text-muted-foreground mt-2">
                Started at 2:30 PM
              </p>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <QuickActionButtons
          currentState={currentState}
          onAction={handleAction}
        />

        {/* Today's Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Today's Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-3xl font-bold text-primary">0h 0m</p>
                <p className="text-sm text-muted-foreground">Total Sleep</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-3xl font-bold text-primary">0</p>
                <p className="text-sm text-muted-foreground">Naps</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Next Recommendation */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/20 p-2">
                <Moon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-primary">Next Recommendation</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Set up a schedule to see recommendations
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
}
