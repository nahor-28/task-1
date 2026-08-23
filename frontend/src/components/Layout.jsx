import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const ICONS = {
  dashboard: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z',
  courses: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25',
  assignments: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H5.25a2.25 2.25 0 01-2.25-2.25V5.25A2.25 2.25 0 015.25 3h9.879a2.25 2.25 0 011.591.659l4.121 4.121a2.25 2.25 0 01.659 1.59V16.5a2.25 2.25 0 01-2.25 2.25z',
  reports: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
  menu: 'M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5',
  logout: 'M8.25 9V5.25A2.25 2.25 0 0110.5 3h6a2.25 2.25 0 012.25 2.25v13.5A2.25 2.25 0 0116.5 21h-6a2.25 2.25 0 01-2.25-2.25V15m-3 0l-3-3m0 0l3-3m-3 3H15',
};

function Icon({ path, className = 'size-5' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

const NAV_ITEMS = {
  student: [
    { to: '/student/dashboard', label: 'Dashboard', icon: ICONS.dashboard },
    { to: '/student/courses', label: 'Courses', icon: ICONS.courses },
    { to: '/student/reports', label: 'Reports', icon: ICONS.reports },
  ],
  educator: [
    { to: '/educator/dashboard', label: 'Dashboard', icon: ICONS.dashboard },
    { to: '/educator/courses', label: 'Courses', icon: ICONS.courses },
    { to: '/educator/assignments', label: 'Assignments', icon: ICONS.assignments },
    { to: '/educator/reports', label: 'Reports', icon: ICONS.reports },
  ],
};

function initials(name) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function Layout() {
  const { user, logout } = useAuth();
  const items = NAV_ITEMS[user?.role] ?? [];
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  return (
    <div className="drawer lg:drawer-open">
      <input
        id="app-drawer"
        type="checkbox"
        className="drawer-toggle"
        checked={drawerOpen}
        onChange={(e) => setDrawerOpen(e.target.checked)}
      />
      <div className="drawer-content flex flex-col min-h-screen bg-base-200">
        <div className="navbar bg-base-100 border-b border-base-300 lg:hidden">
          <label htmlFor="app-drawer" className="btn btn-square btn-ghost" aria-label="Open menu">
            <Icon path={ICONS.menu} />
          </label>
          <span className="font-semibold ml-2 text-base-content">Assignment Tracker</span>
        </div>
        <main className="flex-1 p-4 lg:p-8">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      <div className="drawer-side z-20">
        <label htmlFor="app-drawer" aria-label="Close menu" className="drawer-overlay"></label>
        <aside className="w-64 min-h-full bg-base-100 border-r border-base-300 flex flex-col">
          <div className="p-4 border-b border-base-300">
            <span className="font-semibold text-lg text-base-content">Assignment Tracker</span>
          </div>

          <ul className="menu p-3 flex-1 gap-1">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) => (isActive ? 'menu-active' : '')}
                >
                  <Icon path={item.icon} />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>

          {user && (
            <div className="p-3 border-t border-base-300 flex items-center gap-3">
              <div className="avatar avatar-placeholder shrink-0">
                <div className="bg-primary text-primary-content w-10 rounded-full">
                  <span className="text-sm">{initials(user.name)}</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-base-content truncate">{user.name}</p>
                <p className="text-xs text-base-content/60 truncate capitalize">{user.role}</p>
              </div>
              <button onClick={logout} className="btn btn-ghost btn-sm btn-square" title="Log out" aria-label="Log out">
                <Icon path={ICONS.logout} className="size-4" />
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
