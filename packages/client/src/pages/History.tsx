import BottomNav from '../components/BottomNav';

export default function History() {
  return (
    <div className="min-h-screen pb-20">
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <h1 className="text-xl font-bold">Sleep History</h1>
      </header>

      <main className="px-4 py-6">
        <div className="card text-center py-12">
          <p className="text-gray-500">No sleep sessions recorded yet</p>
          <p className="text-sm text-gray-400 mt-2">
            Start tracking from the home screen
          </p>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
