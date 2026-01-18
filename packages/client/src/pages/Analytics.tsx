import { useState } from 'react';
import { TrendingUp, TrendingDown, Moon, Sun, Calendar, Clock } from 'lucide-react';
import BottomNav from '../components/BottomNav';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface TrendData {
  label: string;
  value: number;
  change: number;
  unit: string;
}

interface WeeklySummary {
  avgTotalSleep: number;
  avgNapCount: number;
  avgNapDuration: number;
  avgBedtime: string;
  avgWakeTime: string;
  sleepGoalProgress: number;
}

export default function Analytics() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading] = useState(false);

  // Mock data - will be replaced with API calls
  const trends: TrendData[] = [
    { label: 'Avg Daily Sleep', value: 13.5, change: 0.5, unit: 'hours' },
    { label: 'Avg Nap Duration', value: 90, change: -10, unit: 'min' },
    { label: 'Settling Time', value: 8, change: -3, unit: 'min' },
    { label: 'Night Wakes', value: 0.5, change: -0.3, unit: 'avg' },
  ];

  const weeklySummary: WeeklySummary = {
    avgTotalSleep: 13.5,
    avgNapCount: 2,
    avgNapDuration: 90,
    avgBedtime: '7:15 PM',
    avgWakeTime: '6:45 AM',
    sleepGoalProgress: 85,
  };

  const renderTrendIcon = (change: number) => {
    if (change > 0) {
      return <TrendingUp className="w-4 h-4 text-green-500" />;
    } else if (change < 0) {
      return <TrendingDown className="w-4 h-4 text-red-500" />;
    }
    return null;
  };

  const renderTrendBadge = (change: number) => {
    const isPositive = change > 0;
    return (
      <Badge variant={isPositive ? 'success' : 'destructive'} className="text-xs">
        {isPositive ? '+' : ''}{change}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border px-4 py-4">
          <h1 className="text-xl font-bold text-primary">Analytics</h1>
        </header>
        <main className="px-4 py-6 space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border px-4 py-4">
        <h1 className="text-xl font-bold text-primary">Analytics</h1>
        <p className="text-sm text-muted-foreground">Track sleep patterns and progress</p>
      </header>

      <main className="px-4 py-6 space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            {/* Sleep Goal Progress */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Weekly Sleep Goal</CardTitle>
                <CardDescription>
                  {weeklySummary.sleepGoalProgress}% of recommended sleep achieved
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Progress value={weeklySummary.sleepGoalProgress} className="h-3" />
                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                  <span>Current: {weeklySummary.avgTotalSleep}h avg</span>
                  <span>Goal: 14-15h</span>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Moon className="w-5 h-5 text-primary" />
                    <span className="text-sm text-muted-foreground">Avg Bedtime</span>
                  </div>
                  <p className="text-2xl font-bold mt-2">{weeklySummary.avgBedtime}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Sun className="w-5 h-5 text-yellow-500" />
                    <span className="text-sm text-muted-foreground">Avg Wake</span>
                  </div>
                  <p className="text-2xl font-bold mt-2">{weeklySummary.avgWakeTime}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-green-500" />
                    <span className="text-sm text-muted-foreground">Avg Naps</span>
                  </div>
                  <p className="text-2xl font-bold mt-2">{weeklySummary.avgNapCount}/day</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-violet-500" />
                    <span className="text-sm text-muted-foreground">Nap Length</span>
                  </div>
                  <p className="text-2xl font-bold mt-2">{weeklySummary.avgNapDuration}m</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="trends" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">7-Day Trends</CardTitle>
                <CardDescription>How sleep patterns are changing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {trends.map((trend) => (
                  <div
                    key={trend.label}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div>
                      <p className="font-medium">{trend.label}</p>
                      <p className="text-2xl font-bold">
                        {trend.value} {trend.unit}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {renderTrendIcon(trend.change)}
                      {renderTrendBadge(trend.change)}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="insights" className="space-y-4 mt-4">
            <Card className="border-green-500/50 bg-green-500/10">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-green-500/20 p-2">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-green-500">Great Progress!</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Settling time has improved by 3 minutes this week. Keep up the
                      consistent routine!
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/50 bg-primary/10">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/20 p-2">
                    <Moon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-primary">Tip</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Bedtime has been consistent this week at around 7:15 PM. This
                      consistency helps establish a strong sleep foundation.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-yellow-500/50 bg-yellow-500/10">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-yellow-500/20 p-2">
                    <Clock className="w-5 h-5 text-yellow-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-yellow-500">Watch For</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Nap duration decreased slightly. Consider adjusting wake windows
                      if this continues.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <BottomNav />
    </div>
  );
}
