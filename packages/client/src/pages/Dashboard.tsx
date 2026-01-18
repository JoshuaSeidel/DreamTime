import { useState } from 'react';
import BottomNav from '../components/BottomNav';
import QuickActionButtons from '../components/QuickActionButtons';
import ChildSelector from '../components/ChildSelector';

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

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-indigo-600">DreamTime</h1>
          <ChildSelector
            selectedId={selectedChildId}
            onSelect={setSelectedChildId}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-6 space-y-6">
        {/* Current State Card */}
        <div className="card text-center">
          <p className="text-sm text-gray-500 mb-1">Current Status</p>
          <div className="flex items-center justify-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${
                currentState === 'asleep'
                  ? 'bg-asleep animate-pulse-slow'
                  : currentState === 'pending'
                  ? 'bg-put-down animate-pulse'
                  : 'bg-out-of-crib'
              }`}
            />
            <span className="text-2xl font-semibold capitalize">
              {currentState === 'pending' ? 'In Crib' : currentState}
            </span>
          </div>
        </div>

        {/* Quick Actions */}
        <QuickActionButtons
          currentState={currentState}
          onAction={handleAction}
        />

        {/* Today's Summary */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Today's Summary</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-indigo-600">0h 0m</p>
              <p className="text-sm text-gray-500">Total Sleep</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-indigo-600">0</p>
              <p className="text-sm text-gray-500">Naps</p>
            </div>
          </div>
        </div>

        {/* Next Recommendation */}
        <div className="card bg-indigo-50 border-indigo-100">
          <h2 className="text-lg font-semibold text-indigo-900 mb-2">
            Next Recommendation
          </h2>
          <p className="text-indigo-700">
            Set up a schedule to see recommendations
          </p>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
