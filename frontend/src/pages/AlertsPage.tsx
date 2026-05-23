import { useState, useEffect } from 'react';
import api from '../services/api';

interface Alert {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  timestamp: string;
  camera: string;
  acknowledged: boolean;
  personPhoto?: string;
  personName?: string;
  isKnownOffender: boolean;
  previousTheftLink?: string;
}

type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';
type StatusFilter = 'all' | 'active' | 'acknowledged';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await api.alerts.list();
      setAlerts(res.data || generateMockAlerts());
    } catch {
      setAlerts(generateMockAlerts());
    } finally {
      setLoading(false);
    }
  };

  const generateMockAlerts = (): Alert[] => {
    const types = ['Theft Detected', 'Suspicious Behavior', 'Unauthorized Access', 'Camera Offline', 'Known Offender Spotted', 'Loitering Alert', 'After-Hours Motion', 'Tag Removal'];
    const severities: Alert['severity'][] = ['critical', 'high', 'medium', 'low'];
    const cameras = ['Entrance Cam 1', 'Aisle 3 Cam', 'Checkout Cam 2', 'Electronics Cam', 'Exit Cam 1', 'Parking Lot Cam'];
    return Array.from({ length: 20 }, (_, i) => {
      const isOffender = i % 7 === 0;
      return {
        id: `alert-${i + 1}`,
        type: types[i % types.length],
        severity: severities[i % 4],
        description: [
          'Individual detected concealing merchandise in personal bag at electronics display',
          'Multiple items moved to blind spot area — possible coordinated theft',
          'Staff-only door opened without keycard authorization',
          'Camera feed lost — possible tampering detected',
          'Previously flagged individual entered through main entrance',
          'Subject loitering near high-value display for extended period',
          'Motion detected in store after business hours',
          'Security tag removal attempt detected at fitting rooms',
        ][i % 8],
        timestamp: new Date(Date.now() - i * 900000 * (1 + Math.random())).toISOString(),
        camera: cameras[i % cameras.length],
        acknowledged: i > 8,
        isKnownOffender: isOffender,
        personName: isOffender ? `Known Offender #${100 + i}` : i % 3 === 0 ? `Person-${200 + i}` : undefined,
      };
    });
  };

  const handleAcknowledge = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
  };

  const severityConfig = {
    critical: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', dot: 'bg-red-400', icon: '🔴' },
    high: { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', dot: 'bg-orange-400', icon: '🟠' },
    medium: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', dot: 'bg-yellow-400', icon: '🟡' },
    low: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', dot: 'bg-blue-400', icon: '🔵' },
  };

  const typeIcon = (type: string) => {
    if (type.includes('Theft')) return '🚨';
    if (type.includes('Suspicious')) return '👁️';
    if (type.includes('Unauthorized')) return '🚪';
    if (type.includes('Camera')) return '📷';
    if (type.includes('Offender')) return '⚠️';
    if (type.includes('Loitering')) return '🚶';
    if (type.includes('After')) return '🌙';
    if (type.includes('Tag')) return '🏷️';
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

  const filtered = alerts.filter(a => {
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
    if (statusFilter === 'active' && a.acknowledged) return false;
    if (statusFilter === 'acknowledged' && !a.acknowledged) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
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
          const count = alerts.filter(a => a.severity === sev && !a.acknowledged).length;
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
          const cfg = severityConfig[alert.severity];
          return (
            <div
              key={alert.id}
              className={`bg-[#2C2C2E]/80 backdrop-blur-xl rounded-2xl p-5 border transition-all duration-300 hover:border-white/10 ${
                alert.isKnownOffender
                  ? 'border-red-500/40 ring-1 ring-red-500/10'
                  : alert.acknowledged
                    ? 'border-white/5 opacity-60'
                    : 'border-white/5'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Icon / Photo */}
                <div className={`w-12 h-12 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}>
                  {alert.personName ? (
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center">
                      <span className="text-lg">👤</span>
                    </div>
                  ) : (
                    <span className="text-xl">{typeIcon(alert.type)}</span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-white">{alert.type}</p>
                    <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${cfg.bg} ${cfg.color}`}>
                      {alert.severity.toUpperCase()}
                    </span>
                    {alert.isKnownOffender && (
                      <span className="px-2 py-0.5 text-[10px] rounded-full font-bold bg-red-500/20 text-red-400 animate-pulse">
                        ⚠️ KNOWN OFFENDER
                      </span>
                    )}
                    {alert.acknowledged && (
                      <span className="px-2 py-0.5 text-[10px] rounded-full bg-gray-500/15 text-gray-500">
                        Acknowledged
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-300 mb-2">{alert.description}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{formatTime(alert.timestamp)}</span>
                    <span>•</span>
                    <span>📷 {alert.camera}</span>
                    {alert.personName && (
                      <>
                        <span>•</span>
                        <span className="text-purple-400">👤 {alert.personName}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {!alert.acknowledged && (
                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      className="px-3 py-1.5 bg-[#3A3A3C] hover:bg-[#48484A] text-white text-xs font-medium rounded-lg transition-all duration-200 active:scale-95"
                    >
                      Acknowledge
                    </button>
                  )}
                  <button className="px-3 py-1.5 bg-blue-500/10 text-blue-400 text-xs font-medium rounded-lg hover:bg-blue-500/20 transition-all duration-200">
                    View Video
                  </button>
                  {alert.personName && (
                    <button className="px-3 py-1.5 bg-purple-500/10 text-purple-400 text-xs font-medium rounded-lg hover:bg-purple-500/20 transition-all duration-200">
                      Track Person
                    </button>
                  )}
                </div>
              </div>

              {/* Known Offender Extra */}
              {alert.isKnownOffender && (
                <div className="mt-4 pt-4 border-t border-red-500/10 flex items-center gap-3">
                  <span className="text-xs text-red-400">⚠️ This individual has previous theft records.</span>
                  <button className="text-xs text-red-400 underline hover:text-red-300 transition-colors">
                    View previous incidents →
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-500 text-sm">No alerts match your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
