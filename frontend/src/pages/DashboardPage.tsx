import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

const SearchIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const ClockIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const WarningIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
  </svg>
);

const MoneyIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
  </svg>
);

const statIcons: Record<string, () => JSX.Element> = {
  search: SearchIcon,
  clock: ClockIcon,
  warning: WarningIcon,
  money: MoneyIcon,
};

const statIconColors: Record<string, string> = {
  search: 'bg-blue-500/10 text-blue-500',
  clock: 'bg-amber-500/10 text-amber-500',
  warning: 'bg-red-500/10 text-red-500',
  money: 'bg-emerald-500/10 text-emerald-500',
};

const StatCardComponent = ({ card }: { card: StatCard }) => {
  const isPositive = card.trend >= 0;
  const IconComp = statIcons[card.icon] || SearchIcon;
  const iconColor = statIconColors[card.icon] || 'bg-blue-500/10 text-blue-500';

  return (
    <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5 transition-all duration-200 hover:border-[#48484A]/60 hover:shadow-sm hover:shadow-black/10 group">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl ${iconColor} flex items-center justify-center`}>
          <IconComp />
        </div>
        {card.trend !== 0 && (
          <div className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${isPositive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={!isPositive ? 'rotate-180' : ''}>
              <path d="M5 2L8 6H2L5 2Z" fill="currentColor" />
            </svg>
            {Math.abs(card.trend)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 tracking-tight">
        <AnimatedNumber value={card.value} prefix={card.prefix} suffix={card.suffix} />
      </p>
      <p className="text-xs text-[#86868B] mt-1">{card.title}</p>
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
    <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-6 transition-all duration-200">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Hourly Traffic</h2>
      <p className="text-xs text-[#86868B] mb-5">Today's foot traffic by hour</p>
      <div className="flex items-end gap-2 h-40">
        {hours.map((h, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-2">
            <div className="w-full relative group">
              <div
                className="w-full bg-blue-500/15 rounded-md transition-all duration-500 hover:bg-blue-500/30"
                style={{ height: `${(h.value / max) * 140}px`, transitionDelay: `${i * 50}ms` }}
              >
                <div
                  className="absolute bottom-0 w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-md opacity-70"
                  style={{ height: `${(h.value / max) * 140}px` }}
                />
              </div>
            </div>
            <span className="text-[10px] text-[#86868B]">{h.hour}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<StatCard[]>([
    { title: 'Total Incidents', value: 0, icon: 'search', trend: 0 },
    { title: 'Pending Review', value: 0, icon: 'clock', trend: 0 },
    { title: 'Confirmed Thefts', value: 0, icon: 'warning', trend: 0 },
    { title: 'Est. Loss', value: 0, prefix: '$', icon: 'money', trend: 0 },
  ]);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [aiStatus, setAiStatus] = useState<{ ai_available: boolean; active_streams: number } | null>(null);
  const [team] = useState<TeamMember[]>([
    { name: 'Sarah K.', role: 'Floor Manager', status: 'online', avatar: 'SK' },
    { name: 'Marcus T.', role: 'Security', status: 'online', avatar: 'MT' },
    { name: 'Aisha R.', role: 'Cashier', status: 'away', avatar: 'AR' },
    { name: 'David L.', role: 'Stock', status: 'offline', avatar: 'DL' },
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
            { title: 'Total Incidents', value: s.total_incidents || 0, icon: 'search', trend: 0 },
            { title: 'Pending Review', value: s.pending_review || 0, icon: 'clock', trend: 0 },
            { title: 'Confirmed Thefts', value: s.confirmed_thefts || 0, icon: 'warning', trend: 0 },
            { title: 'Est. Loss', value: Math.round(s.total_estimated_loss || 0), prefix: '$', icon: 'money', trend: 0 },
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
    offline: 'bg-gray-300',
  };

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-transparent border border-gray-200/50 rounded-2xl p-5 md:p-8 lg:p-10">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight mb-3">Dashboard</h1>
            <p className="text-base text-[#86868B] leading-relaxed">Welcome back — here's your real-time security overview, team status, and store intelligence at a glance.</p>
          </div>
          {/* AI Status */}
          <div className="flex items-center gap-2 bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-full px-4 py-2 flex-shrink-0 ml-4">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${aiStatus?.ai_available ? 'bg-emerald-400' : 'bg-red-400'}`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${aiStatus?.ai_available ? 'bg-emerald-400' : 'bg-red-400'}`} />
            </span>
            <span className={`text-xs font-medium ${aiStatus?.ai_available ? 'text-emerald-500' : 'text-red-500'}`}>
              {aiStatus ? (aiStatus.ai_available ? `AI Active · ${aiStatus.active_streams} stream${aiStatus.active_streams !== 1 ? 's' : ''}` : 'AI Offline') : 'Checking AI...'}
            </span>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 transition-opacity duration-500 ${loading ? 'opacity-50' : 'opacity-100'}`}>
        {stats.map((card, i) => (
          <StatCardComponent key={i} card={card} />
        ))}
      </div>

      {/* Live Monitor Quick Access */}
      <button
        onClick={() => navigate('/monitor')}
        className="w-full bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-5 md:p-6 text-left transition-all hover:shadow-xl hover:shadow-gray-900/20 group relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-red-500/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <div>
              <h3 className="text-white font-bold text-lg group-hover:text-blue-200 transition-colors">Live Camera Monitor</h3>
              <p className="text-gray-400 text-sm mt-0.5">Real-time feeds with AI offender tracking · Click to add/remove cameras</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold px-3 py-1.5 rounded-full">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              LIVE
            </div>
            <svg className="w-5 h-5 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </div>
        </div>
      </button>

      {/* Traffic + Active Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <HourlyTrafficChart />
        </div>
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-6 transition-all duration-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Active Alerts</h2>
              <p className="text-xs text-[#86868B]">
                {activeAlerts.length > 0 ? `${activeAlerts.length} alert${activeAlerts.length !== 1 ? 's' : ''}` : 'No active alerts'}
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {activeAlerts.length > 0 ? activeAlerts.map((alert: any) => (
              <div
                key={alert.id}
                className="flex items-start gap-3 p-3 rounded-xl bg-gray-50/80 border border-gray-100 hover:bg-gray-100/80 transition-all duration-200 cursor-pointer"
              >
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${severityColor[alert.priority] || 'bg-blue-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{alert.title || alert.alert_type}</p>
                  <p className="text-[10px] text-[#86868B] mt-0.5">
                    {alert.person_display_name || 'Unknown'} · {alert.created_at ? new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </p>
                </div>
              </div>
            )) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-3 text-emerald-500">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </div>
                <p className="text-sm text-[#86868B]">All clear — no active alerts</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Team + AI Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Team on Duty */}
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-6 transition-all duration-200 hover:border-[#48484A]/60 hover:shadow-sm hover:shadow-black/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Team on Duty</h2>
              <p className="text-xs text-[#86868B]">{team.filter(t => t.status === 'online').length} active now</p>
            </div>
          </div>
          <div className="space-y-3">
            {team.map((member, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600">
                    {member.avatar}
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${statusColor[member.status]}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{member.name}</p>
                  <p className="text-[10px] text-[#86868B]">{member.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Pipeline Status */}
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-6 transition-all duration-200 hover:border-[#48484A]/60 hover:shadow-sm hover:shadow-black/10 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500 mb-4">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-medium mb-2 ${aiStatus?.ai_available ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
            <div className={`w-2 h-2 rounded-full ${aiStatus?.ai_available ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            {aiStatus?.ai_available ? 'AI Pipeline Active' : 'AI Pipeline Offline'}
          </div>
          <p className="text-sm font-semibold text-gray-900">Detection Engine</p>
          <p className="text-xs text-[#86868B] mt-1">
            {aiStatus ? `${aiStatus.active_streams} active stream${aiStatus.active_streams !== 1 ? 's' : ''}` : 'Loading...'}
          </p>
        </div>

        {/* Quick Stats */}
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-6 transition-all duration-200 hover:border-[#48484A]/60 hover:shadow-sm hover:shadow-black/10 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 mb-4">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">
            <AnimatedNumber value={stats[0].value} />
          </div>
          <p className="text-sm font-semibold text-gray-900">Total Incidents Tracked</p>
          <p className="text-xs text-[#86868B] mt-1">By AI detection system</p>
        </div>
      </div>
    </div>
  );
}
