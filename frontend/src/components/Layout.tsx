// ──────────────────────────────────────────────
// RetailGuard AI — Apple OS Style Layout
// ──────────────────────────────────────────────

import { useState, useMemo } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import type { User } from '../types';

// ─── Navigation Config ───────────────────────

interface NavItem {
  label: string;
  path: string;
  icon: string;
  featureKey?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'SECURITY',
    items: [
      { label: 'Dashboard', path: '/', icon: '🏠' },
      { label: 'Review Queue', path: '/incidents', icon: '🔍', featureKey: 'incidents' },
      { label: 'Alerts', path: '/alerts', icon: '🔔', featureKey: 'alerts' },
      { label: 'Offenders', path: '/persons', icon: '👤', featureKey: 'persons' },
      { label: 'Blacklist', path: '/blacklist', icon: '🚫', featureKey: 'blacklist' },
    ],
  },
  {
    title: 'INTELLIGENCE',
    items: [
      { label: 'Traffic', path: '/traffic', icon: '📊', featureKey: 'traffic' },
      { label: 'Calendar', path: '/calendar', icon: '📅', featureKey: 'calendar' },
      { label: 'Heatmap', path: '/heatmap', icon: '🗺️', featureKey: 'heatmap' },
      { label: 'Shelves', path: '/shelves', icon: '🗄️', featureKey: 'shelves' },
      { label: 'Fridge', path: '/fridge', icon: '❄️', featureKey: 'fridge' },
    ],
  },
  {
    title: 'OPERATIONS',
    items: [
      { label: 'Team', path: '/team', icon: '👥', featureKey: 'team' },
      { label: 'Cash Management', path: '/cash', icon: '💰', featureKey: 'cash' },
      { label: 'Store Scanner', path: '/scanner', icon: '📱', featureKey: 'scanner' },
    ],
  },
  {
    title: 'ANALYTICS',
    items: [
      { label: 'Revenue', path: '/revenue', icon: '💵', featureKey: 'revenue' },
      { label: 'Projections', path: '/projections', icon: '📈', featureKey: 'projections' },
      { label: 'Reports', path: '/reports', icon: '📋', featureKey: 'reports' },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      { label: 'Cameras', path: '/cameras', icon: '📹', featureKey: 'cameras' },
      { label: 'Settings', path: '/settings', icon: '⚙️' },
    ],
  },
];

// ─── Helpers ─────────────────────────────────

function getUser(): User | null {
  try {
    const raw = localStorage.getItem('user');
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function hasFeature(user: User | null, featureKey?: string): boolean {
  if (!featureKey) return true; // No restriction
  if (!user) return false;
  if (user.role === 'admin') return true; // Admins see everything
  return user.features?.[featureKey] !== false; // Default allow unless explicitly false
}

function getPageTitle(pathname: string): string {
  for (const section of navSections) {
    for (const item of section.items) {
      if (item.path === pathname) return item.label;
    }
  }
  return 'Dashboard';
}

function getRoleBadgeColor(role: string): string {
  const colors: Record<string, string> = {
    admin: 'bg-purple-500/20 text-purple-300',
    manager: 'bg-blue-500/20 text-blue-300',
    supervisor: 'bg-cyan-500/20 text-cyan-300',
    security: 'bg-red-500/20 text-red-300',
    cashier: 'bg-amber-500/20 text-amber-300',
    viewer: 'bg-gray-500/20 text-gray-400',
  };
  return colors[role] || colors.viewer;
}

// ─── Layout Component ────────────────────────

export default function Layout() {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const user = useMemo(() => getUser(), []);

  const filteredSections = useMemo(() => {
    return navSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => hasFeature(user, item.featureKey)),
      }))
      .filter((section) => section.items.length > 0);
  }, [user]);

  const pageTitle = getPageTitle(location.pathname);

  return (
    <div
      className="flex h-screen w-screen overflow-hidden"
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        background: '#000000',
      }}
    >
      {/* ── Sidebar ──────────────────────────── */}
      <aside
        className={`
          relative flex flex-col shrink-0
          transition-all duration-300 ease-in-out
          ${sidebarCollapsed ? 'w-[68px]' : 'w-[250px]'}
        `}
        style={{
          background: 'rgba(28, 28, 30, 0.80)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        {/* Logo Area */}
        <div className="flex items-center gap-3 px-5 py-5 shrink-0">
          {/* AI Pulse Dot */}
          <div className="relative shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">R</span>
            </div>
            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-[#1C1C1E]">
              <div className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-40" />
            </div>
          </div>
          {!sidebarCollapsed && (
            <div className="overflow-hidden">
              <div className="text-[13px] font-semibold text-white tracking-tight leading-tight">
                RetailGuard
              </div>
              <div className="text-[10px] text-green-400 font-medium tracking-wide">
                AI Active
              </div>
            </div>
          )}
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="
            absolute top-5 -right-3 z-10
            w-6 h-6 rounded-full
            bg-[#2C2C2E] border border-white/10
            flex items-center justify-center
            text-white/50 hover:text-white hover:bg-[#3A3A3C]
            transition-all duration-200
            opacity-0 hover:opacity-100 group-hover:opacity-100
          "
          style={{ fontSize: '10px' }}
        >
          {sidebarCollapsed ? '›' : '‹'}
        </button>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 scrollbar-thin">
          {filteredSections.map((section) => (
            <div key={section.title} className="mb-4">
              {!sidebarCollapsed && (
                <div className="px-2 mb-1.5 text-[10px] font-semibold text-white/30 tracking-widest uppercase">
                  {section.title}
                </div>
              )}

              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive =
                    item.path === '/'
                      ? location.pathname === '/'
                      : location.pathname.startsWith(item.path);

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`
                        group relative flex items-center gap-2.5 rounded-lg
                        transition-all duration-200 ease-in-out
                        ${sidebarCollapsed ? 'justify-center px-2 py-2' : 'px-2.5 py-[7px]'}
                        ${
                          isActive
                            ? 'bg-white/10 text-white'
                            : 'text-white/50 hover:bg-white/[0.06] hover:text-white/80'
                        }
                      `}
                    >
                      {/* Active indicator bar */}
                      {isActive && (
                        <div
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-blue-400"
                          style={{
                            transition: 'all 200ms ease',
                          }}
                        />
                      )}

                      <span className="text-[15px] shrink-0 leading-none">{item.icon}</span>

                      {!sidebarCollapsed && (
                        <span className="text-[13px] font-medium truncate">{item.label}</span>
                      )}

                      {/* Tooltip for collapsed state */}
                      {sidebarCollapsed && (
                        <div
                          className="
                            absolute left-full ml-2 px-2.5 py-1.5 rounded-lg
                            bg-[#2C2C2E] border border-white/10
                            text-[12px] text-white font-medium whitespace-nowrap
                            opacity-0 invisible group-hover:opacity-100 group-hover:visible
                            transition-all duration-150 z-50
                            pointer-events-none
                          "
                          style={{
                            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
                          }}
                        >
                          {item.label}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Section at Bottom */}
        {user && !sidebarCollapsed && (
          <div
            className="shrink-0 px-4 py-3 border-t border-white/[0.06]"
          >
            <div className="flex items-center gap-2.5">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.name}
                  className="w-7 h-7 rounded-full object-cover ring-1 ring-white/10"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <span className="text-[11px] font-semibold text-white">
                    {user.name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium text-white/80 truncate">
                  {user.name}
                </div>
                <div className="text-[10px] text-white/30 capitalize">{user.role}</div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* ── Main Content Area ────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#000000]">
        {/* Top Bar */}
        <header
          className="
            shrink-0 flex items-center justify-between
            px-8 h-[56px]
            border-b border-white/[0.06]
          "
          style={{
            background: 'rgba(0, 0, 0, 0.60)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          {/* Page Title */}
          <h1 className="text-[20px] font-semibold text-white tracking-tight">
            {pageTitle}
          </h1>

          {/* Right side */}
          <div className="flex items-center gap-4">
            {/* Notification Indicator */}
            <button
              className="
                relative w-8 h-8 rounded-full
                bg-white/[0.06] hover:bg-white/[0.10]
                flex items-center justify-center
                transition-all duration-200
              "
            >
              <span className="text-[14px]">🔔</span>
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500" />
            </button>

            {/* User Info */}
            {user && (
              <div className="flex items-center gap-3">
                <span
                  className={`
                    px-2.5 py-1 rounded-full text-[11px] font-medium capitalize
                    ${getRoleBadgeColor(user.role)}
                  `}
                >
                  {user.role}
                </span>

                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.name}
                    className="w-8 h-8 rounded-full object-cover ring-2 ring-white/10 hover:ring-white/20 transition-all duration-200 cursor-pointer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center ring-2 ring-white/10 hover:ring-white/20 transition-all duration-200 cursor-pointer">
                    <span className="text-[12px] font-semibold text-white">
                      {user.name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-8">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
