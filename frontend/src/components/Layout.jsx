import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export function Layout() {
  const { user, logout } = useAuth();
  const base = user?.role === 'educator' ? '/educator' : '/student';

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-gray-900">Assignment Tracker</span>
          {user && (
            <div className="flex gap-4 text-sm text-gray-600">
              <Link to={`${base}/dashboard`} className="hover:text-gray-900">Dashboard</Link>
              <Link to={`${base}/courses`} className="hover:text-gray-900">Courses</Link>
              {user.role === 'educator' && (
                <Link to="/educator/assignments" className="hover:text-gray-900">Assignments</Link>
              )}
              <Link to={`${base}/reports`} className="hover:text-gray-900">Reports</Link>
            </div>
          )}
        </div>
        {user && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-500">{user.name} ({user.role})</span>
            <button
              onClick={logout}
              className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-100"
            >
              Log out
            </button>
          </div>
        )}
      </nav>
      <main className="max-w-4xl mx-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
