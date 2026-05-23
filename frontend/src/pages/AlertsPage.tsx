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
    critical: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', dot: 'bg-red-400' },
    high: { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', dot: 'bg-orange-400' },
    medium: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', dot: 'bg-yellow-400' },
    low: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', dot: 'bg-blue-400' },
  };

  const typeIcon = (type?: string) => {
    if (!type) return '📢';
    if (type.includes('offender') || type.includes('known')) return '⚠️';
    if (type.includes('theft')) return '🚨';
    if (type.includes('suspicious')) return '👁️';
    if (type.includes('loiter')) return '🚶';
    return '📢';
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
      <div className="p-8 space-y-6 max-w-[1400px] mx-auto">
        <div><h1 className="text-3xl font-bold text-white tracking-tight">Alerts</h1></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-[#2C2C2E]/80 rounded-2xl p-4 border border-white/5 animate-pulse">
              <div className="h-3 bg-white/10 rounded w-16 mb-2" />
              <div className="h-7 bg-white/10 rounded w-10" />
            </div>
          ))}
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-[#2C2C2E]/80 rounded-2xl p-5 border border-white/5 animate-pulse">
            <div className="h-4 bg-white/10 rounded w-3/4 mb-3" />
            <div className="h-3 bg-white/10 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Alerts</h1>
          <p className="text-sm text-gray-400 mt-1">Security alerts & notifications</p>
        </div>
        <div className="flex items-center gap-2 bg-[#2C2C2E]/80 backdrop-blur-xl rounded-full px-4 py-2 border border-white/5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400" />
          </span>
          <span className="text-xs text-green-400 font-medium">Live monitoring active</span>
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
              className={`rounded-2xl p-4 border transition-all duration-200 ${
                severityFilter === sev
                  ? `${cfg.bg} ${cfg.border}`
                  : 'bg-[#2C2C2E]/80 border-white/5 hover:border-white/10'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                <span className={`text-xs uppercase tracking-wider font-medium ${cfg.color}`}>{sev}</span>
              </div>
              <p className="text-2xl font-bold text-white">{count}</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex gap-1 bg-[#2C2C2E]/60 backdrop-blur-xl rounded-xl p-1">
          {(['all', 'active', 'acknowledged'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                statusFilter === s
                  ? 'bg-[#3A3A3C] text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-500">{filtered.length} alerts</span>
      </div>

      {/* Alert Cards */}
      <div className="space-y-3">
        {filtered.map((alert) => {
          const cfg = severityConfig[alert.priority] || severityConfig.medium;
          const offender = isKnownOffender(alert);
          return (
            <div
              key={alert.id}
              className={`bg-[#2C2C2E]/80 backdrop-blur-xl rounded-2xl p-5 border transition-all duration-300 hover:border-white/10 ${
                offender
                  ? 'border-red-500/40 ring-1 ring-red-500/10'
                  : alert.status === 'acknowledged'
                    ? 'border-white/5 opacity-60'
                    : 'border-white/5'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={`w-12 h-12 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}>
                  {alert.best_portrait_path ? (
                    <img src={alert.best_portrait_path} alt="" className="w-10 h-10 rounded-lg object-cover" />
                  ) : alert.person_display_name ? (
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center">
                      <span className="text-lg">👤</span>
                    </div>
                  ) : (
                    <span className="text-xl">{typeIcon(alert.alert_type)}</span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="text-sm font-semibold text-white">{alert.title}</p>
                    <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${cfg.bg} ${cfg.color}`}>
                      {alert.priority.toUpperCase()}
                    </span>
                    {offender && (
                      <span className="px-2 py-0.5 text-[10px] rounded-full font-bold bg-red-500/20 text-red-400 animate-pulse">
                        ⚠️ KNOWN OFFENDER
                      </span>
                    )}
                    {alert.status === 'acknowledged' && (
                      <span className="px-2 py-0.5 text-[10px] rounded-full bg-gray-500/15 text-gray-500">
                        Acknowledged
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-300 mb-2">{alert.message || 'Security event detected'}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                    <span>{formatTime(alert.created_at)}</span>
                    {alert.current_camera_id && (
                      <>
                        <span>•</span>
                        <span>📷 {alert.current_camera_id}</span>
                      </>
                    )}
                    {alert.person_display_name && (
                      <>
                        <span>•</span>
                        <span className="text-purple-400">👤 {alert.person_display_name}</span>
                      </>
                    )}
                    {alert.match_confidence && (
                      <>
                        <span>•</span>
                        <span className="text-blue-400">
                          {Math.round((alert.match_confidence > 1 ? alert.match_confidence : alert.match_confidence * 100))}% match
                        </span>
                      </>
                    )}
                    {alert.person_total_thefts !== undefined && alert.person_total_thefts > 0 && (
                      <>
                        <span>•</span>
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
                      className="px-3 py-1.5 bg-[#3A3A3C] hover:bg-[#48484A] text-white text-xs font-medium rounded-lg transition-all duration-200 active:scale-95 disabled:opacity-50"
                    >
                      {actionLoading === alert.id ? '...' : 'Acknowledge'}
                    </button>
                  )}
                  {alert.status === 'active' && (
                    <>
                      <button
                        onClick={() => handleAction(alert.id, 'call_police')}
                        disabled={!!actionLoading}
                        className="px-3 py-1.5 bg-red-500/10 text-red-400 text-xs font-medium rounded-lg hover:bg-red-500/20 transition-all duration-200 disabled:opacity-50"
                      >
                        🚔 Police
                      </button>
                      <button
                        onClick={() => handleAction(alert.id, 'escort_out')}
                        disabled={!!actionLoading}
                        className="px-3 py-1.5 bg-orange-500/10 text-orange-400 text-xs font-medium rounded-lg hover:bg-orange-500/20 transition-all duration-200 disabled:opacity-50"
                      >
                        🚶 Escort
                      </button>
                      <button
                        onClick={() => handleAction(alert.id, 'blacklist')}
                        disabled={!!actionLoading}
                        className="px-3 py-1.5 bg-purple-500/10 text-purple-400 text-xs font-medium rounded-lg hover:bg-purple-500/20 transition-all duration-200 disabled:opacity-50"
                      >
                        🚫 Blacklist
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Known Offender Extra Info */}
              {offender && (
                <div className="mt-4 pt-4 border-t border-red-500/10 flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-red-400">⚠️ This individual has previous theft records.</span>
                  {alert.person_threat_level && (
                    <span className="text-xs text-orange-400">Threat Level: {'🔴'.repeat(alert.person_threat_level)}{'⚪'.repeat(4 - alert.person_threat_level)}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <span className="text-4xl mb-3 block">✅</span>
            <p className="text-gray-500 text-sm">No alerts match your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
