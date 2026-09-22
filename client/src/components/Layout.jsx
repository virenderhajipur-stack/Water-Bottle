import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, PackagePlus, RefreshCcw, HandCoins,
  Boxes, Scale, BarChart3, ClipboardList, Settings as SettingsIcon,
  LogOut, Menu, X, UserCog, Droplets, Bell
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import GlobalSearch from './GlobalSearch.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/new-bottle', label: 'New Bottle', icon: PackagePlus },
  { to: '/refill', label: 'Refill', icon: RefreshCcw },
  { to: '/payments', label: 'Payments', icon: HandCoins },
  { to: '/inventory', label: 'Bottle Inventory', icon: Boxes },
  { to: '/reconciliation', label: 'Reconciliation', icon: Scale },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/audit-logs', label: 'Audit Logs', icon: ClipboardList }
];

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const doLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [...NAV];
  if (isAdmin) navItems.push({ to: '/users', label: 'Users', icon: UserCog });
  navItems.push({ to: '/settings', label: 'Settings', icon: SettingsIcon });

  const SidebarContent = ({ onNavigate }) => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
          <Droplets className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-extrabold text-white leading-tight">AquaTrack</p>
          <p className="text-xs text-white/70">Bottles · Refill · Udhaar</p>
        </div>
      </div>
      <nav className="flex-none max-h-[calc(100vh-220px)] px-3 space-y-1 overflow-y-auto pb-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <item.icon className="w-5 h-5 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-3 pb-4 space-y-1">
        <div className="px-3 py-2.5 rounded-lg bg-white/10">
          <p className="text-xs text-white/70">Logged in as</p>
          <p className="text-sm font-bold text-white">{user?.name}</p>
          <p className="text-xs text-white/70 capitalize">{user?.role}</p>
        </div>
        <button
          onClick={() => { doLogout(); onNavigate?.(); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-red-200 hover:bg-red-500/20 transition-colors"
        >
          <LogOut className="w-5 h-5" /> Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Mobile header */}
      <header className="lg:hidden sticky top-0 z-40 bg-dark text-white no-print">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Droplets className="w-5 h-5" />
            <span className="font-extrabold">AquaTrack</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setMenuOpen(true)} className="p-2 rounded-lg hover:bg-white/10">
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
        <div className="px-3 pb-3">
          <GlobalSearch />
        </div>
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 bg-dark sticky top-0 h-screen no-print">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden no-print">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMenuOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-dark shadow-2xl overflow-y-auto">
            <button onClick={() => setMenuOpen(false)} className="absolute right-3 top-3 p-2 text-white/70">
              <X className="w-5 h-5" />
            </button>
            <SidebarContent onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <div className="no-print hidden lg:block bg-white border-b border-slate-200 sticky top-0 z-30">
          <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-end gap-4">
            <div className="w-80 self-center">
              <GlobalSearch />
            </div>
            <button className="relative p-2 rounded-lg text-ink-500 hover:bg-slate-100" title="Notifications">
              <Bell className="w-5 h-5" />
            </button>
            <span className="text-sm font-semibold text-ink-700 capitalize">
              {user?.name} <span className="text-ink-400 font-normal">({user?.role})</span>
            </span>
          </div>
        </div>
        <div className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-5 py-5">
          <Outlet />
        </div>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 flex no-print">
          {[
            { to: '/', label: 'Home', icon: LayoutDashboard },
            { to: '/customers', label: 'Customers', icon: Users },
            { to: '/new-bottle', label: 'New', icon: PackagePlus },
            { to: '/refill', label: 'Refill', icon: RefreshCcw },
            { to: '/payments', label: 'Payments', icon: HandCoins }
          ].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center py-2 text-xs font-semibold ${isActive ? 'text-brand-600' : 'text-ink-400'}`
              }
            >
              <item.icon className="w-5 h-5 mb-0.5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="h-14 lg:hidden" />
      </main>
    </div>
  );
}