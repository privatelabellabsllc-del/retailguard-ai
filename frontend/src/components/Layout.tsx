// ──────────────────────────────────────────────
// RetailGuard AI — Apple-White Layout with Collapsible Sections
// ──────────────────────────────────────────────

import { useState, useMemo, useCallback } from 'react';
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
  key: string;
  items: NavItem[];
  collapsible: boolean;
}

const navSections: NavSection[] = [
  {
    title: 'SECURITY',
    key: 'security',
    collapsible: false,
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: '🏠' },
      { label: 'Review Queue', path: '/incidents', icon: '🔍', featureKey: 'incidents' },
      { label: 'Alerts', path: '/alerts', icon: '🔔', featureKey: 'alerts' },
      { label: 'Offenders', path: '/persons', icon: '👤', featureKey: 'persons' },
      { label: 'Blacklist', path: '/blacklist', icon: '🚫', featureKey: 'blacklist' },
    ],
  },
  {
    title: 'INTELLIGENCE',
    key: 'intelligence',
    collapsible: true,
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
    key: 'operations',
    collapsible: true,
    items: [
      { label: 'Team', path: '/team', icon: '👥', featureKey: 'team' },
      { label: 'Cash Management', path: '/cash', icon: '💰', featureKey: 'cash' },
      { label: 'Store Scanner', path: '/scanner', icon: '📱', featureKey: 'scanner' },
    ],
  },
  {
    title: 'ANALYTICS',
    key: 'analytics',
    collapsible: true,
    items: [
      { label: 'Revenue', path: '/revenue', icon: '💵', featureKey: 'revenue' },
      { label: 'Projections', path: '/projections', icon: '📈', featureKey: 'projections' },
      { label: 'Reports', path: '/reports', icon: '📋', featureKey: 'reports' },
    ],
  },
  {
    title: 'SYSTEM',
    key: 'system',
    collapsible: false,
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
  if (!featureKey) return true;
  if (!user) return false;
  if (user.role === 'admin') return true;
  return user.features?.[featureKey] !== false;
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
    admin: 'bg-purple-100 text-purple-700',
    manager: 'bg-blue-100 text-blue-700',
    supervisor: 'bg-cyan-100 text-cyan-700',
    security: 'bg-red-100 text-red-700',
    cashier: 'bg-amber-100 text-amber-700',
    viewer: 'bg-gray-100 text-gray-600',
  };
  return colors[role] || colors.viewer;
}

// ─── Layout Component ────────────────────────

export default function Layout() {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const user = useMemo(() => getUser(), []);

  // Track which collapsible sections are open
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    security: true,
    system: true,
  });

  const toggleSection = useCallback((key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

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
        background: '#ffffff',
      }}
    >
      {/* ── Sidebar ──────────────────────────── */}
      <aside
        className={`
          group relative flex flex-col shrink-0
          transition-all duration-300 ease-in-out
          ${sidebarCollapsed ? 'w-[68px]' : 'w-[250px]'}
        `}
        style={{
          background: '#f5f5f7',
          borderRight: '1px solid #e5e5e7',
        }}
      >
        {/* Logo Area */}
        <div className="flex items-center gap-3 px-5 py-5 shrink-0">
          <div className="relative shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
              <span className="text-white text-xs font-bold">R</span>
            </div>
            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-[#f5f5f7]">
              <div className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-40" />
            </div>
          </div>
          {!sidebarCollapsed && (
            <div className="overflow-hidden">
              <div className="text-[13px] font-semibold text-gray-900 tracking-tight leading-tight">
                RetailGuard
              </div>
              <div className="text-[10px] text-green-600 font-medium tracking-wide">
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
            bg-white border border-gray-200 shadow-sm
            flex items-center justify-center
            text-gray-500 hover:text-gray-700 hover:bg-gray-50
            transition-all duration-200
            opacity-0 group-hover:opacity-100
          "
          style={{ fontSize: '10px' }}
        >
          {sidebarCollapsed ? '›' : '‹'}
        </button>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2">
          {filteredSections.map((section) => {
            const isOpen = !section.collapsible || openSections[section.key];
            const hasActiveItem = section.items.some((item) =>
              location.pathname.startsWith(item.path)
            );

            return (
              <div key={section.key} className="mb-2">
                {/* Section Header */}
                {!sidebarCollapsed && (
                  <button
                    onClick={() => section.collapsible && toggleSection(section.key)}
                    className={`
                      w-full flex items-center justify-between
                      px-2 py-1.5 mb-0.5 rounded-md
                      text-[10px] font-semibold tracking-widest uppercase
                      transition-all duration-200
                      ${section.collapsible
                        ? 'text-gray-500 hover:text-gray-600 hover:bg-gray-200/50 cursor-pointer'
                        : 'text-gray-500 cursor-default'
                      }
                      ${hasActiveItem && !isOpen ? 'text-blue-500' : ''}
                    `}
                  >
                    <span>{section.title}</span>
                    {section.collapsible && (
                      <svg
                        className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </button>
                )}

                {/* Section Items */}
                <div
                  className={`
                    space-y-0.5 overflow-hidden transition-all duration-200
                    ${isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}
                  `}
                >
                  {section.items.map((item) => {
                    const isActive =
                      item.path === '/dashboard'
                        ? location.pathname === '/dashboard' || location.pathname === '/'
                        : location.pathname.startsWith(item.path);

                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`
                          group/item relative flex items-center gap-2.5 rounded-lg
                          transition-all duration-200 ease-in-out
                          ${sidebarCollapsed ? 'justify-center px-2 py-2' : 'px-2.5 py-[7px]'}
                          ${
                            isActive
                              ? 'bg-white text-gray-900 shadow-sm'
                              : 'text-gray-500 hover:bg-white/60 hover:text-gray-800'
                          }
                        `}
                      >
                        {/* Active indicator bar */}
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-blue-500" />
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
                              bg-gray-100 text-gray-900
                              text-[12px] font-medium whitespace-nowrap
                              opacity-0 invisible group-hover/item:opacity-100 group-hover/item:visible
                              transition-all duration-150 z-50
                              pointer-events-none shadow-sm
                            "
                          >
                            {item.label}
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* User Section at Bottom */}
        {user && !sidebarCollapsed && (
          <div className="shrink-0 px-4 py-3 border-t border-gray-200">
            <div className="flex items-center gap-2.5">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.name}
                  className="w-7 h-7 rounded-full object-cover ring-1 ring-gray-200"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <span className="text-[11px] font-semibold text-white">
                    {user.name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium text-gray-800 truncate">
                  {user.name}
                </div>
                <div className="text-[10px] text-gray-500 capitalize">{user.role}</div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* ── Main Content Area ────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 bg-white">
        {/* Top Bar */}
        <header
          className="
            shrink-0 flex items-center justify-between
            px-8 h-[56px]
            border-b border-gray-100
            bg-white/80 backdrop-blur-xl
          "
        >
          {/* Page Title */}
          <h1 className="text-[20px] font-semibold text-gray-900 tracking-tight">
            {pageTitle}
          </h1>

          {/* Right side */}
          <div className="flex items-center gap-4">
            {/* Notification Indicator */}
            <button
              className="
                relative w-8 h-8 rounded-full
                bg-gray-100 hover:bg-gray-200
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
                    className="w-8 h-8 rounded-full object-cover ring-2 ring-gray-200 hover:ring-gray-300 transition-all duration-200 cursor-pointer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center ring-2 ring-gray-200 hover:ring-gray-300 transition-all duration-200 cursor-pointer">
                    <span className="text-[12px] font-semibold text-gray-900">
                      {user.name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden bg-gray-50/50">
          <div className="p-8">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
