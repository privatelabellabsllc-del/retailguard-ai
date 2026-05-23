import { useEffect, useState } from 'react';
import { incidents as incidentsApi, alerts as alertsApi, streams as streamsApi } from '../services/api';

interface StatCard {
  title: string;
  value: number;
  prefix?: string;
  suffix?: string;
  trend: number;
  icon: string;
}

interface TeamMember {
  name: string;
  role: string;
  status: 'online' | 'away' | 'offline';
  avatar: string;
}

const AnimatedNumber = ({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) => {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let current = 0;
    const end = value;
    const duration = 1200;
    const steps = 40;
    const increment = end / steps;
    const stepTime = duration / steps;

    const timer = setInterval(() => {
      current += increment;
      if (current >= end) {
        setDisplay(end);
        clearInterval(timer);
      } else {
        setDisplay(Math.floor(current));
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <span>
      {prefix}{display.toLocaleString()}{suffix}
    </span>
  );
};

const StatCardComponent = ({ card }: { card: StatCard }) => {
  const isPositive = card.trend >= 0;

  return (
    <div className="group relative bg-white/[0.03] backdrop-blur-xl border border-white/[0.05] rounded-2xl p-5 transition-all duration-300 hover:bg-white/[0.06] hover:shadow-sm hover:shadow-black/20 hover:-translate-y-0.5">
      <div className="flex items-start justify-between mb-4">
        <span className="text-2xl">{card.icon}</span>
        <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${isPositive ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-600 bg-red-400/10'}`}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={!isPositive ? 'rotate-180' : ''}>
            <path d="M5 2L8 6H2L5 2Z" fill="currentColor" />
          </svg>
          {Math.abs(card.trend)}%
        </div>
      </div>
      <div className="text-3xl font-bold text-gray-900 tracking-tight mb-1">
        <AnimatedNumber value={card.value} prefix={card.prefix} suffix={card.suffix} />
      </div>
      <div className="text-[13px] text-gray-900/40 font-medium">{card.title}</div>
    </div>
  );
};

const HourlyTrafficChart = () => {
  const hours = Array.from({ length: 12 }, (_, i) => ({
    hour: `${i + 8}${i + 8 < 12 ? 'am' : 'pm'}`,
    value: Math.floor(Math.random() * 80) + 20,
  }));
  const max = Math.max(...hours.map(h => h.value));

  return (
    <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.05] rounded-2xl p-6 transition-all duration-300">
      <h3 className="text-[15px] font-semibold text-gray-900 mb-1">Hourly Traffic</h3>
      <p className="text-[12px] text-gray-900/30 mb-5">Today's foot traffic by hour</p>
      <div className="flex items-end gap-2 h-40">
        {hours.map((h, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-2">
            <div className="w-full relative group">
              <div
                className="w-full bg-blue-500/20 rounded-md transition-all duration-500 hover:bg-blue-500/40 group-hover:shadow-sm group-hover:shadow-blue-500/10"
                style={{ height: `${(h.value / max) * 140}px`, transitionDelay: `${i * 50}ms` }}
              >
                <div
                  className="absolute bottom-0 w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-md opacity-80"
                  style={{ height: `${(h.value / max) * 140}px` }}
                />
              </div>
            </div>
            <span className="text-[10px] text-gray-900/30">{h.hour}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function DashboardPage() {
  const [stats, setStats] = useState<StatCard[]>([
    { title: 'Total Incidents', value: 0, icon: '🔍', trend: 0 },
    { title: 'Pending Review', value: 0, icon: '⏳', trend: 0 },
    { title: 'Confirmed Thefts', value: 0, icon: '🚨', trend: 0 },
    { title: 'Est. Loss', value: 0, prefix: '$', icon: '💰', trend: 0 },
  ]);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [aiStatus, setAiStatus] = useState<{ ai_available: boolean; active_streams: number } | null>(null);
  const [team] = useState<TeamMember[]>([
    { name: 'Sarah K.', role: 'Floor Manager', status: 'online', avatar: '👩‍💼' },
    { name: 'Marcus T.', role: 'Security', status: 'online', avatar: '👨‍✈️' },
    { name: 'Aisha R.', role: 'Cashier', status: 'away', avatar: '👩' },
    { name: 'David L.', role: 'Stock', status: 'offline', avatar: '👨' },
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, alertsRes, streamRes] = await Promise.allSettled([
          incidentsApi.stats(),
          alertsApi.list(),
          streamsApi.status(),
        ]);

        if (statsRes.status === 'fulfilled' && statsRes.value) {
          const s = statsRes.value;
          setStats([
            { title: 'Total Incidents', value: s.total_incidents || 0, icon: '🔍', trend: 0 },
            { title: 'Pending Review', value: s.pending_review || 0, icon: '⏳', trend: 0 },
            { title: 'Confirmed Thefts', value: s.confirmed_thefts || 0, icon: '🚨', trend: 0 },
            { title: 'Est. Loss', value: Math.round(s.total_estimated_loss || 0), prefix: '$', icon: '💰', trend: 0 },
          ]);
        }

        if (alertsRes.status === 'fulfilled' && Array.isArray(alertsRes.value)) {
          setActiveAlerts(alertsRes.value.slice(0, 5));
        }

        if (streamRes.status === 'fulfilled' && streamRes.value) {
          setAiStatus(streamRes.value);
        }
      } catch {
        // Keep fallback data
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const severityColor: Record<string, string> = {
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-amber-500',
    low: 'bg-blue-400',
  };

  const statusColor: Record<string, string> = {
    online: 'bg-emerald-400',
    away: 'bg-amber-400',
    offline: 'bg-white/20',
  };

  return (
    <div className="min-h-screen p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="text-[28px] font-bold text-gray-900 tracking-tight">Dashboard</h1>
          <p className="text-[13px] text-gray-900/40 mt-1">Welcome back — here's what's happening today</p>
        </div>
        {/* AI Status */}
        <div className="flex items-center gap-2 bg-white/[0.03] backdrop-blur-xl border border-white/[0.05] rounded-full px-4 py-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${aiStatus?.ai_available ? 'bg-emerald-400' : 'bg-red-400'}`} />
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${aiStatus?.ai_available ? 'bg-emerald-400' : 'bg-red-400'}`} />
          </span>
          <span className={`text-xs font-medium ${aiStatus?.ai_available ? 'text-emerald-400' : 'text-red-600'}`}>
            {aiStatus ? (aiStatus.ai_available ? `AI Active · ${aiStatus.active_streams} stream${aiStatus.active_streams !== 1 ? 's' : ''}` : 'AI Offline') : 'Checking AI...'}
          </span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 transition-opacity duration-500 ${loading ? 'opacity-50' : 'opacity-100'}`}>
        {stats.map((card, i) => (
          <StatCardComponent key={i} card={card} />
        ))}
      </div>

      {/* Traffic + Active Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <HourlyTrafficChart />
        </div>
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.05] rounded-2xl p-6 transition-all duration-300">
          <h3 className="text-[15px] font-semibold text-gray-900 mb-1">Active Alerts</h3>
          <p className="text-[12px] text-gray-900/30 mb-4">
            {activeAlerts.length > 0 ? `${activeAlerts.length} alert${activeAlerts.length !== 1 ? 's' : ''}` : 'No active alerts'}
          </p>
          <div className="space-y-3">
            {activeAlerts.length > 0 ? activeAlerts.map((alert: any) => (
              <div
                key={alert.id}
                className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] transition-all duration-200 cursor-pointer"
              >
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${severityColor[alert.priority] || 'bg-blue-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-gray-900/80 font-medium truncate">{alert.title || alert.alert_type}</p>
                  <p className="text-[11px] text-gray-900/30 mt-0.5">
                    {alert.person_display_name || 'Unknown'} · {alert.created_at ? new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </p>
                </div>
              </div>
            )) : (
              <div className="text-center py-8">
                <span className="text-3xl mb-2 block">✅</span>
                <p className="text-[13px] text-gray-900/30">All clear — no active alerts</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Team + AI Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Team on Duty */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.05] rounded-2xl p-6 transition-all duration-300">
          <h3 className="text-[15px] font-semibold text-gray-900 mb-1">Team on Duty</h3>
          <p className="text-[12px] text-gray-900/30 mb-4">{team.filter(t => t.status === 'online').length} active now</p>
          <div className="space-y-3">
            {team.map((member, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center text-lg">
                    {member.avatar}
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#1C1C1E] ${statusColor[member.status]}`} />
                </div>
                <div>
                  <p className="text-[13px] text-gray-900/80 font-medium">{member.name}</p>
                  <p className="text-[11px] text-gray-900/30">{member.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Pipeline Status */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.05] rounded-2xl p-6 transition-all duration-300 flex flex-col items-center justify-center text-center">
          <div className="text-4xl mb-3">🧠</div>
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-semibold mb-2 ${aiStatus?.ai_available ? 'bg-emerald-400/10 text-emerald-400' : 'bg-red-400/10 text-red-600'}`}>
            <div className={`w-2 h-2 rounded-full ${aiStatus?.ai_available ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            {aiStatus?.ai_available ? 'AI Pipeline Active' : 'AI Pipeline Offline'}
          </div>
          <p className="text-[13px] text-gray-900/40 font-medium">Detection Engine</p>
          <p className="text-[11px] text-gray-900/25 mt-1">
            {aiStatus ? `${aiStatus.active_streams} active stream${aiStatus.active_streams !== 1 ? 's' : ''}` : 'Loading...'}
          </p>
        </div>

        {/* Quick Stats */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.05] rounded-2xl p-6 transition-all duration-300 flex flex-col items-center justify-center text-center">
          <div className="text-4xl mb-3">📊</div>
          <div className="text-4xl font-bold text-blue-600 mb-1">
            <AnimatedNumber value={stats[0].value} />
          </div>
          <p className="text-[13px] text-gray-900/40 font-medium">Total Incidents Tracked</p>
          <p className="text-[11px] text-gray-900/25 mt-1">By AI detection system</p>
        </div>
      </div>
    </div>
  );
}
