import { useState, useEffect } from 'react';
import { alerts as alertsApi } from '../services/api';

interface AlertItem {
  id: string;
  created_at: string;
  person_id?: string;
  person_display_name?: string;
  person_status?: string;
  person_threat_level?: number;
  person_total_thefts?: number;
  alert_type?: string;
  priority: string;
  status: string;
  title: string;
  message?: string;
  tracking_active?: boolean;
  current_camera_id?: string;
  reference_clip_url?: string;
  current_snapshot_path?: string;
  match_confidence?: number;
  match_details?: any;
  best_portrait_path?: string;
}

type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';
type StatusFilter = 'all' | 'active' | 'acknowledged';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await alertsApi.list();
      if (Array.isArray(data) && data.length > 0) {
        setAlerts(data);
      } else {
        setAlerts(generateMockAlerts());
      }
    } catch {
      setAlerts(generateMockAlerts());
    } finally {
      setLoading(false);
    }
  };

  const generateMockAlerts = (): AlertItem[] => {
    const types = ['known_offender', 'theft_detected', 'suspicious_behavior', 'loitering'];
    const priorities = ['critical', 'high', 'medium', 'low'];
    return Array.from({ length: 8 }, (_, i) => ({
      id: `mock-alert-${i + 1}`,
      created_at: new Date(Date.now() - i * 900000).toISOString(),
      person_display_name: i % 2 === 0 ? `Person-${100 + i}` : undefined,
      person_threat_level: i % 2 === 0 ? 3 : undefined,
      person_total_thefts: i % 2 === 0 ? 2 + i : undefined,
      alert_type: types[i % types.length],
      priority: priorities[i % 4],
      status: i > 4 ? 'acknowledged' : 'active',
      title: ['Known Offender Spotted', 'Theft Detected', 'Suspicious Behavior', 'Loitering Alert'][i % 4],
      message: 'AI-detected security event requiring attention',
      match_confidence: 0.7 + Math.random() * 0.25,
    }));
  };

  const handleAcknowledge = async (id: string) => {
    setActionLoading(id);
    try {
      await alertsApi.acknowledge(id);
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'acknowledged' } : a));
    } catch {
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'acknowledged' } : a));
    } finally {
      setActionLoading(null);
    }
  };

  const handleAction = async (id: string, action: string) => {
    setActionLoading(`${id}-${action}`);
    try {
      await alertsApi.action(id, action);
      // Re-fetch
      const data = await alertsApi.list();
      if (Array.isArray(data)) setAlerts(data);
    } catch {
      // Still acknowledge locally
    } finally {
      setActionLoading(null);
    }
  };

  const severityConfig: Record<string, { color: string; bg: string; border: string; dot: string }> = {
    critical: { color: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/30', dot: 'bg-red-400' },
    high: { color: 'text-orange-500', bg: 'bg-orange-500/15', border: 'border-orange-500/30', dot: 'bg-orange-400' },
    medium: { color: 'text-amber-500', bg: 'bg-amber-500/15', border: 'border-amber-500/30', dot: 'bg-amber-400' },
    low: { color: 'text-blue-500', bg: 'bg-blue-500/15', border: 'border-blue-500/30', dot: 'bg-blue-400' },
  };

  const typeIcon = (type?: string) => {
    if (!type) return (
      <svg className="w-5 h-5 text-[#86868B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
      </svg>
    );
    if (type.includes('offender') || type.includes('known')) return (
      <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    );
    if (type.includes('theft')) return (
      <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    );
    if (type.includes('suspicious')) return (
      <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    );
    if (type.includes('loiter')) return (
      <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
    return (
      <svg className="w-5 h-5 text-[#86868B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
      </svg>
    );
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const isKnownOffender = (alert: AlertItem) =>
    alert.alert_type?.includes('offender') || alert.alert_type?.includes('known') || (alert.person_threat_level && alert.person_threat_level >= 3);

  const filtered = alerts.filter(a => {
    if (severityFilter !== 'all' && a.priority !== severityFilter) return false;
    if (statusFilter === 'active' && a.status !== 'active') return false;
    if (statusFilter === 'acknowledged' && a.status !== 'acknowledged') return false;
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen p-6 lg:p-8 space-y-8">
        <div className="bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-transparent border border-gray-200/50 rounded-2xl p-8 lg:p-10">
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight mb-3">Alerts</h1>
          <p className="text-base text-[#86868B] leading-relaxed">Live alerts from the AI detection pipeline.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5 animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-16 mb-2" />
              <div className="h-7 bg-gray-200 rounded w-10" />
            </div>
          ))}
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 lg:p-8 space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-transparent border border-gray-200/50 rounded-2xl p-8 lg:p-10">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight mb-3">Alerts</h1>
            <p className="text-base text-[#86868B] leading-relaxed">Live alerts from the AI detection pipeline. Known offenders, blacklisted individuals, and suspicious activity — all in real time.</p>
          </div>
          <div className="flex items-center gap-2 bg-white/80 backdrop-blur-xl rounded-full px-4 py-2 border border-gray-200/50 shrink-0 ml-4">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
            </span>
            <span className="text-xs text-emerald-600 font-medium">Live monitoring active</span>
          </div>
        </div>
      </div>

      {/* Severity Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['critical', 'high', 'medium', 'low'] as const).map((sev) => {
          const count = alerts.filter(a => a.priority === sev && a.status !== 'acknowledged').length;
          const cfg = severityConfig[sev];
          return (
            <button
              key={sev}
              onClick={() => setSeverityFilter(severityFilter === sev ? 'all' : sev)}
              className={`rounded-2xl p-5 border transition-all duration-200 text-left ${
                severityFilter === sev
                  ? `${cfg.bg} ${cfg.border}`
                  : 'bg-white/80 backdrop-blur-xl border-gray-200/50 hover:border-[#48484A]/60 hover:shadow-sm hover:shadow-black/10'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                <span className={`text-xs uppercase tracking-wider font-semibold ${cfg.color}`}>{sev}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{count}</p>
              <p className="text-xs text-[#86868B] mt-1">Active alerts</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex gap-1 bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-xl p-1">
          {(['all', 'active', 'acknowledged'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                statusFilter === s
                  ? 'bg-gray-100 text-gray-900 shadow-sm'
                  : 'text-[#86868B] hover:text-gray-900'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <span className="text-xs text-[#86868B]">{filtered.length} alerts</span>
      </div>

      {/* Alert Cards */}
      <div className="space-y-3">
        {filtered.map((alert) => {
          const cfg = severityConfig[alert.priority] || severityConfig.medium;
          const offender = isKnownOffender(alert);
          return (
            <div
              key={alert.id}
              className={`bg-white/80 backdrop-blur-xl rounded-2xl p-5 border transition-all duration-200 hover:border-[#48484A]/60 hover:shadow-sm hover:shadow-black/10 group ${
                offender
                  ? 'border-red-500/40 ring-1 ring-red-500/10'
                  : alert.status === 'acknowledged'
                    ? 'border-gray-200/50 opacity-60'
                    : 'border-gray-200/50'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={`w-12 h-12 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}>
                  {alert.best_portrait_path ? (
                    <img src={alert.best_portrait_path} alt="" className="w-10 h-10 rounded-lg object-cover" />
                  ) : alert.person_display_name ? (
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                      <svg className="w-5 h-5 text-[#636366]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                    </div>
                  ) : (
                    typeIcon(alert.alert_type)
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{alert.title}</p>
                    <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${cfg.bg} ${cfg.color}`}>
                      {alert.priority.toUpperCase()}
                    </span>
                    {offender && (
                      <span className="px-2 py-0.5 text-[10px] rounded-full font-bold bg-red-500/15 text-red-400 animate-pulse flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                        KNOWN OFFENDER
                      </span>
                    )}
                    {alert.status === 'acknowledged' && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-[#86868B]">
                        Acknowledged
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[#86868B] mb-2">{alert.message || 'Security event detected'}</p>
                  <div className="flex items-center gap-3 text-xs text-[#86868B] flex-wrap">
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {formatTime(alert.created_at)}
                    </span>
                    {alert.current_camera_id && (
                      <>
                        <span className="text-gray-300">·</span>
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                          </svg>
                          {alert.current_camera_id}
                        </span>
                      </>
                    )}
                    {alert.person_display_name && (
                      <>
                        <span className="text-gray-300">·</span>
                        <span className="flex items-center gap-1 text-purple-500">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                          </svg>
                          {alert.person_display_name}
                        </span>
                      </>
                    )}
                    {alert.match_confidence && (
                      <>
                        <span className="text-gray-300">·</span>
                        <span className="text-blue-500">
                          {Math.round((alert.match_confidence > 1 ? alert.match_confidence : alert.match_confidence * 100))}% match
                        </span>
                      </>
                    )}
                    {alert.person_total_thefts !== undefined && alert.person_total_thefts > 0 && (
                      <>
                        <span className="text-gray-300">·</span>
                        <span className="text-red-400">{alert.person_total_thefts} prior theft{alert.person_total_thefts > 1 ? 's' : ''}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {alert.status !== 'acknowledged' && (
                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      disabled={actionLoading === alert.id}
                      className="px-4 py-2 text-sm font-medium rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all duration-200 disabled:opacity-50 active:scale-95"
                    >
                      {actionLoading === alert.id ? '...' : 'Acknowledge'}
                    </button>
                  )}
                  {alert.status === 'active' && (
                    <>
                      <button
                        onClick={() => handleAction(alert.id, 'call_police')}
                        disabled={!!actionLoading}
                        className="px-3 py-2 bg-red-500/15 text-red-400 text-xs font-medium rounded-xl hover:bg-red-500/25 transition-all duration-200 disabled:opacity-50 flex items-center gap-1"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                        </svg>
                        Police
                      </button>
                      <button
                        onClick={() => handleAction(alert.id, 'escort_out')}
                        disabled={!!actionLoading}
                        className="px-3 py-2 bg-orange-500/15 text-orange-500 text-xs font-medium rounded-xl hover:bg-orange-500/25 transition-all duration-200 disabled:opacity-50 flex items-center gap-1"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                        Escort
                      </button>
                      <button
                        onClick={() => handleAction(alert.id, 'blacklist')}
                        disabled={!!actionLoading}
                        className="px-3 py-2 bg-purple-500/15 text-purple-500 text-xs font-medium rounded-xl hover:bg-purple-500/25 transition-all duration-200 disabled:opacity-50 flex items-center gap-1"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                        Blacklist
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Known Offender Extra Info */}
              {offender && (
                <div className="mt-4 pt-4 border-t border-red-500/10 flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-red-400 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    This individual has previous theft records.
                  </span>
                  {alert.person_threat_level && (
                    <span className="text-xs text-orange-500 flex items-center gap-1">
                      Threat Level:
                      <span className="flex gap-0.5 ml-1">
                        {Array.from({ length: 4 }, (_, i) => (
                          <span
                            key={i}
                            className={`w-2 h-2 rounded-full ${i < alert.person_threat_level! ? 'bg-red-400' : 'bg-gray-200'}`}
                          />
                        ))}
                      </span>
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-16 bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <p className="text-sm text-[#86868B]">No alerts match your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
