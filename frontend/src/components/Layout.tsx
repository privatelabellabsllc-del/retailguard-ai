import { NavLink } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import {
  Shield, LayoutDashboard, ClipboardCheck, Bell, Users,
  Ban, Camera, LogOut, AlertTriangle, Menu, X
} from 'lucide-react';
import AlertPanel from './AlertPanel';
import { createAlertWebSocket } from '../services/api';
import type { User, Alert } from '../types';

interface LayoutProps {
  user: User;
  onLogout: () => void;
  children: React.ReactNode;
}

export default function Layout({ user, onLogout, children }: LayoutProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activeAlert, setActiveAlert] = useState<Alert | null>(null);
  const [showMobileNav, setShowMobileNav] = useState(false);

  // WebSocket connection for real-time alerts
  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: any;

    const connect = () => {
      try {
        ws = createAlertWebSocket();
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === 'new_alert') {
            const newAlert = data.alert as Alert;
            setAlerts((prev) => [newAlert, ...prev]);
            setActiveAlert(newAlert);

            // Play alert sound
            try {
              const audio = new Audio('/alert-sound.mp3');
              audio.play().catch(() => {});
            } catch {}
          } else if (data.type === 'alert_resolved') {
            setAlerts((prev) => prev.filter((a) => a.id !== data.alert_id));
            if (activeAlert?.id === data.alert_id) {
              setActiveAlert(null);
            }
          }
        };
        ws.onclose = () => {
          reconnectTimer = setTimeout(connect, 3000);
        };
      } catch {}
    };

    connect();
    return () => {
      ws?.close();
      clearTimeout(reconnectTimer);
    };
  }, []);

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/review', icon: ClipboardCheck, label: 'Review Queue' },
    { to: '/alerts', icon: Bell, label: 'Alerts', badge: alerts.length },
    { to: '/offenders', icon: Users, label: 'Offenders' },
    { to: '/blacklist', icon: Ban, label: 'Blacklist' },
    { to: '/cameras', icon: Camera, label: 'Cameras' },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className={`${showMobileNav ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-40 w-64 bg-gray-900 border-r border-gray-800 flex flex-col transition-transform`}>
        {/* Logo */}
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-white">RetailGuard</h1>
              <span className="text-xs text-blue-400">AI Security Platform</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setShowMobileNav(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
              {item.badge ? (
                <span className="ml-auto bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">
                  {item.badge}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-sm font-medium">
              {user.full_name?.[0] || user.username[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-200 truncate">
                {user.full_name || user.username}
              </p>
              <p className="text-xs text-gray-500 capitalize">{user.role}</p>
            </div>
            <button onClick={onLogout} className="text-gray-500 hover:text-gray-300">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 border-b border-gray-800 flex items-center px-6 shrink-0">
          <button
            onClick={() => setShowMobileNav(!showMobileNav)}
            className="lg:hidden mr-4 text-gray-400"
          >
            {showMobileNav ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex-1" />

          {/* Active alerts indicator */}
          {alerts.length > 0 && (
            <button
              onClick={() => setActiveAlert(alerts[0])}
              className="flex items-center gap-2 bg-red-600/20 text-red-400 px-3 py-1.5 rounded-lg animate-pulse-alert"
            >
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">
                {alerts.length} Active Alert{alerts.length > 1 ? 's' : ''}
              </span>
            </button>
          )}
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </main>

      {/* Alert side panel */}
      {activeAlert && (
        <AlertPanel
          alert={activeAlert}
          onClose={() => setActiveAlert(null)}
          onAction={() => {
            setAlerts((prev) => prev.filter((a) => a.id !== activeAlert.id));
            setActiveAlert(null);
          }}
        />
      )}

      {/* Mobile overlay */}
      {showMobileNav && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setShowMobileNav(false)}
        />
      )}
    </div>
  );
}
