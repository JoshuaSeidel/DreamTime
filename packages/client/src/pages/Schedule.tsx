import BottomNav from '../components/BottomNav';

export default function Schedule() {
  return (
    <div className="min-h-screen pb-20">
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <h1 className="text-xl font-bold">Sleep Schedule</h1>
      </header>

      <main className="px-4 py-6 space-y-6">
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Schedule Type</h2>
          <div className="space-y-2">
            {['2-Nap Schedule', '1-Nap Schedule', '2-to-1 Transition'].map((type) => (
              <button
                key={type}
                className="w-full p-4 text-left rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
              >
                <span className="font-medium">{type}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Wake Windows</h2>
          <p className="text-gray-500 text-sm">
            Configure after selecting a schedule type
          </p>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Sleep Caps</h2>
          <p className="text-gray-500 text-sm">
            Configure after selecting a schedule type
          </p>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
