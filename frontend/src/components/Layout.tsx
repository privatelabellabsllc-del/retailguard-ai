// ──────────────────────────────────────────────
// RetailGuard AI — Apple-White Layout with SVG Icons
// ──────────────────────────────────────────────

import { useState, useMemo, useCallback, useEffect, type ReactNode } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import type { User } from '../types';
import { alerts as alertsApi } from '../services/api';

// ─── SVG Icon Components ─────────────────────

function IconHome() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}

function IconBan() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}

function IconMap() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
    </svg>
  );
}

function IconShelves() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  );
}

function IconSnowflake() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m0-18l-3 3m3-3l3 3m-3 15l-3-3m3 3l3-3M3 12h18m-18 0l3-3m-3 3l3 3m15-3l-3-3m3 3l-3 3" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

function IconMoney() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
    </svg>
  );
}

function IconDollar() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconTrending() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
    </svg>
  );
}

function IconClipboard() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
    </svg>
  );
}

function IconCamera() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

function IconCog() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconBellHeader() {
  return (
    <svg className="w-[16px] h-[16px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );
}

// ─── Icon Map ────────────────────────────────

const iconMap: Record<string, () => ReactNode> = {
  home: IconHome,
  search: IconSearch,
  bell: IconBell,
  user: IconUser,
  ban: IconBan,
  chart: IconChart,
  calendar: IconCalendar,
  map: IconMap,
  shelves: IconShelves,
  snowflake: IconSnowflake,
  users: IconUsers,
  money: IconMoney,
  phone: IconPhone,
  dollar: IconDollar,
  trending: IconTrending,
  clipboard: IconClipboard,
  camera: IconCamera,
  cog: IconCog,
};

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
    title: 'WATCH',
    key: 'watch',
    collapsible: false,
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: 'home' },
      { label: 'Live Cameras', path: '/monitor', icon: 'camera', featureKey: 'cameras' },
      { label: 'Live Alerts', path: '/alerts', icon: 'bell', featureKey: 'alerts' },
    ],
  },
  {
    title: 'REVIEW',
    key: 'review',
    collapsible: true,
    items: [
      { label: 'Needs Your Review', path: '/incidents', icon: 'search', featureKey: 'incidents' },
      { label: 'Offenders', path: '/persons', icon: 'user', featureKey: 'persons' },
      { label: 'Banned People', path: '/blacklist', icon: 'ban', featureKey: 'blacklist' },
    ],
  },
  {
    title: 'MY STORE',
    key: 'mystore',
    collapsible: true,
    items: [
      { label: 'Traffic', path: '/traffic', icon: 'chart', featureKey: 'traffic' },
      { label: 'Calendar', path: '/calendar', icon: 'calendar', featureKey: 'calendar' },
      { label: 'Revenue', path: '/revenue', icon: 'dollar', featureKey: 'revenue' },
      { label: 'Shelves', path: '/shelves', icon: 'shelves', featureKey: 'shelves' },
      { label: 'Heatmap', path: '/heatmap', icon: 'map', featureKey: 'heatmap' },
      { label: 'Scanner', path: '/scanner', icon: 'phone', featureKey: 'scanner' },
      { label: 'Cash', path: '/cash', icon: 'money', featureKey: 'cash' },
    ],
  },
  {
    title: 'TEAM',
    key: 'team',
    collapsible: true,
    items: [
      { label: 'Team', path: '/team', icon: 'users', featureKey: 'team' },
      { label: 'Performance', path: '/performance', icon: 'trending', featureKey: 'team' },
    ],
  },
  {
    title: 'SETTINGS',
    key: 'settings',
    collapsible: false,
    items: [
      { label: 'Camera Setup', path: '/cameras', icon: 'camera', featureKey: 'cameras' },
      { label: 'Settings', path: '/settings', icon: 'cog' },
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const user = useMemo(() => getUser(), []);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    watch: true,
    review: true,
    settings: true,
  });

  // Active alert count for the mobile tab-bar badge
  const [alertCount, setAlertCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const fetchAlerts = async () => {
      try {
        const data = await alertsApi.list();
        if (!cancelled && Array.isArray(data)) setAlertCount(data.length);
      } catch {
        /* keep last known count */
      }
    };
    fetchAlerts();
    const timer = setInterval(fetchAlerts, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

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
      className="flex h-screen w-screen overflow-hidden bg-white"
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      {/* ── Mobile Backdrop ──────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ──────────────────────────── */}
      <aside
        className={`
          group flex flex-col shrink-0
          transition-all duration-300 ease-in-out
          bg-[#f5f5f7] border-r border-gray-200/80
          fixed inset-y-0 left-0 z-50 w-[250px]
          transform ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0 md:z-auto
          ${sidebarCollapsed ? 'md:w-[68px]' : 'md:w-[250px]'}
        `}
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
          {(!sidebarCollapsed || mobileOpen) && (
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

        {/* Collapse Toggle — hidden on mobile */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="
            hidden md:flex
            absolute top-5 -right-3 z-10
            w-6 h-6 rounded-full
            bg-white border border-gray-200 shadow-sm
            items-center justify-center
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
                {/* Section Header — always show on mobile, respect collapse on desktop */}
                {(!sidebarCollapsed || mobileOpen) && (
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

                    const IconComponent = iconMap[item.icon];

                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileOpen(false)}
                        className={`
                          group/item relative flex items-center gap-2.5 rounded-lg
                          transition-all duration-200 ease-in-out min-h-[44px] md:min-h-0
                          ${sidebarCollapsed && !mobileOpen ? 'justify-center px-2 py-2' : 'px-2.5 py-[7px]'}
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

                        <span className="shrink-0">
                          {IconComponent ? <IconComponent /> : null}
                        </span>

                        {(!sidebarCollapsed || mobileOpen) && (
                          <span className="text-[13px] font-medium truncate">{item.label}</span>
                        )}

                        {/* Tooltip for collapsed state — desktop only */}
                        {sidebarCollapsed && !mobileOpen && (
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
        {user && (!sidebarCollapsed || mobileOpen) && (
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
            px-4 md:px-8 h-[56px]
            border-b border-gray-100
            bg-white/80 backdrop-blur-xl
          "
        >
          <div className="flex items-center gap-3">
            <h1 className="text-[17px] md:text-[20px] font-semibold text-gray-900 tracking-tight">
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <button
              className="
                relative w-8 h-8 rounded-full
                bg-gray-100 hover:bg-gray-200
                flex items-center justify-center
                transition-all duration-200
              "
            >
              <IconBellHeader />
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500" />
            </button>

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
        <div className="flex-1 overflow-y-auto overflow-x-hidden bg-gray-50/50 pb-20 md:pb-0">
          <Outlet />
        </div>

        {/* ── Mobile Bottom Tab Bar ──────────── */}
        <nav
          className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t border-gray-200 flex items-stretch justify-around"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {[
            { label: 'Home', path: '/dashboard', icon: 'home' },
            { label: 'Cameras', path: '/monitor', icon: 'camera' },
            { label: 'Alerts', path: '/alerts', icon: 'bell', badge: alertCount },
            { label: 'Review', path: '/incidents', icon: 'search' },
          ].map((tab) => {
            const isActive =
              tab.path === '/dashboard'
                ? location.pathname === '/dashboard' || location.pathname === '/'
                : location.pathname.startsWith(tab.path);
            const TabIcon = iconMap[tab.icon];
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[56px] transition-colors ${
                  isActive ? 'text-blue-600' : 'text-gray-400'
                }`}
              >
                <span className="relative">
                  {TabIcon ? <TabIcon /> : null}
                  {tab.badge != null && tab.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                      {tab.badge > 9 ? '9+' : tab.badge}
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-medium">{tab.label}</span>
              </Link>
            );
          })}
          {/* More — opens the full menu */}
          <button
            onClick={() => setMobileOpen(true)}
            className="relative flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[56px] text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
            </svg>
            <span className="text-[10px] font-medium">More</span>
          </button>
        </nav>
      </main>
    </div>
  );
}
