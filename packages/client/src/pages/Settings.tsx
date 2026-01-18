import { useAuthStore } from '../store/authStore';
import BottomNav from '../components/BottomNav';

export default function Settings() {
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen pb-20">
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <h1 className="text-xl font-bold">Settings</h1>
      </header>

      <main className="px-4 py-6 space-y-6">
        {/* Profile Card */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Profile</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Name</span>
              <span className="font-medium">{user?.name ?? 'Demo User'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Email</span>
              <span className="font-medium">{user?.email ?? 'demo@example.com'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Timezone</span>
              <span className="font-medium">{user?.timezone ?? 'America/New_York'}</span>
            </div>
          </div>
        </div>

        {/* Children Card */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Children</h2>
          <button className="w-full p-3 text-center text-indigo-600 border border-dashed border-indigo-300 rounded-lg hover:bg-indigo-50">
            + Add Child
          </button>
        </div>

        {/* App Settings */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">App Settings</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Push Notifications</span>
              <button className="text-indigo-600 font-medium">Enable</button>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Dark Mode</span>
              <span className="text-gray-400">Coming soon</span>
            </div>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full btn bg-red-50 text-red-600 hover:bg-red-100 py-3"
        >
          Sign Out
        </button>

        {/* Version */}
        <p className="text-center text-sm text-gray-400">
          DreamTime v0.1.0
        </p>
      </main>

      <BottomNav />
    </div>
  );
}
