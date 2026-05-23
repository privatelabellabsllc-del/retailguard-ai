import { useEffect, useState } from 'react';
import api from '../services/api';

interface StatCard {
  title: string;
  value: number;
  prefix?: string;
  suffix?: string;
  trend: number;
  icon: string;
}

interface Incident {
  id: string;
  title: string;
  severity: 'high' | 'medium' | 'low';
  time: string;
  location: string;
}

interface TeamMember {
  name: string;
  role: string;
  status: 'online' | 'away' | 'offline';
  avatar: string;
}

interface AIInsight {
  id: string;
  text: string;
  type: 'info' | 'warning' | 'success';
  time: string;
}

const AnimatedNumber = ({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) => {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    const duration = 1200;
    const steps = 40;
    const increment = end / steps;
    const stepTime = duration / steps;
    let current = start;

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
    <div className="group relative bg-white/[0.03] backdrop-blur-xl border border-white/[0.05] rounded-2xl p-5 transition-all duration-300 hover:bg-white/[0.06] hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5">
      <div className="flex items-start justify-between mb-4">
        <span className="text-2xl">{card.icon}</span>
        <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${isPositive ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'}`}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={!isPositive ? 'rotate-180' : ''}>
            <path d="M5 2L8 6H2L5 2Z" fill="currentColor" />
          </svg>
          {Math.abs(card.trend)}%
        </div>
      </div>
      <div className="text-3xl font-bold text-white tracking-tight mb-1">
        <AnimatedNumber value={card.value} prefix={card.prefix} suffix={card.suffix} />
      </div>
      <div className="text-[13px] text-white/40 font-medium">{card.title}</div>
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
      <h3 className="text-[15px] font-semibold text-white mb-1">Hourly Traffic</h3>
      <p className="text-[12px] text-white/30 mb-5">Today's foot traffic by hour</p>
      <div className="flex items-end gap-2 h-40">
        {hours.map((h, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-2">
            <div className="w-full relative group">
              <div
                className="w-full bg-blue-500/20 rounded-md transition-all duration-500 hover:bg-blue-500/40 group-hover:shadow-lg group-hover:shadow-blue-500/10"
                style={{ height: `${(h.value / max) * 140}px`, transitionDelay: `${i * 50}ms` }}
              >
                <div
                  className="absolute bottom-0 w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-md opacity-80"
                  style={{ height: `${(h.value / max) * 140}px` }}
                />
              </div>
            </div>
            <span className="text-[10px] text-white/30">{h.hour}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function DashboardPage() {
  const [stats, setStats] = useState<StatCard[]>([
    { title: 'Total Visitors Today', value: 2847, icon: '👥', trend: 12.5 },
    { title: 'Revenue Today', value: 18420, prefix: '$', icon: '💰', trend: 8.3 },
    { title: 'Active Alerts', value: 3, icon: '🔔', trend: -25 },
    { title: 'Conversion Rate', value: 34, suffix: '%', icon: '📊', trend: 4.2 },
  ]);
  const [incidents, setIncidents] = useState<Incident[]>([
    { id: '1', title: 'Suspicious activity — Aisle 5', severity: 'high', time: '2 min ago', location: 'Store A' },
    { id: '2', title: 'Cash register variance detected', severity: 'medium', time: '15 min ago', location: 'Store B' },
    { id: '3', title: 'Door sensor triggered after hours', severity: 'low', time: '1 hr ago', location: 'Store A' },
  ]);
  const [team, setTeam] = useState<TeamMember[]>([
    { name: 'Sarah K.', role: 'Floor Manager', status: 'online', avatar: '👩‍💼' },
    { name: 'Marcus T.', role: 'Security', status: 'online', avatar: '👨‍✈️' },
    { name: 'Aisha R.', role: 'Cashier', status: 'away', avatar: '👩' },
    { name: 'David L.', role: 'Stock', status: 'offline', avatar: '👨' },
  ]);
  const [insights, setInsights] = useState<AIInsight[]>([
    { id: '1', text: 'Traffic peaked 23% higher than last Tuesday — likely due to the flash sale on electronics. Consider extending promotions.', type: 'info', time: '5 min ago' },
    { id: '2', text: 'Aisle 7 dwell time increased 40% this week. Customers are spending more time near new seasonal displays.', type: 'success', time: '12 min ago' },
    { id: '3', text: 'Out-of-stock rate for dairy products rose to 8%. Recommend increasing reorder frequency.', type: 'warning', time: '30 min ago' },
  ]);
  const [outOfStock] = useState(12);
  const [cashStatus] = useState<'open' | 'closed'>('open');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dashRes] = await Promise.all([
          api.get('/api/dashboard/overview'),
        ]);
        if (dashRes.data) {
          if (dashRes.data.stats) setStats(dashRes.data.stats);
          if (dashRes.data.incidents) setIncidents(dashRes.data.incidents);
          if (dashRes.data.team) setTeam(dashRes.data.team);
          if (dashRes.data.insights) setInsights(dashRes.data.insights);
        }
      } catch {
        // Using placeholder data
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const severityColor: Record<string, string> = {
    high: 'bg-red-500',
    medium: 'bg-amber-500',
    low: 'bg-blue-400',
  };

  const statusColor: Record<string, string> = {
    online: 'bg-emerald-400',
    away: 'bg-amber-400',
    offline: 'bg-white/20',
  };

  const insightIcon: Record<string, string> = {
    info: '💡',
    warning: '⚠️',
    success: '✅',
  };

  return (
    <div className="min-h-screen p-8 space-y-6">
      {/* Header */}
      <div className="mb-2">
        <h1 className="text-[28px] font-bold text-white tracking-tight">Dashboard</h1>
        <p className="text-[13px] text-white/40 mt-1">Welcome back — here's what's happening today</p>
      </div>

      {/* Stat Cards */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 transition-opacity duration-500 ${loading ? 'opacity-50' : 'opacity-100'}`}>
        {stats.map((card, i) => (
          <StatCardComponent key={i} card={card} />
        ))}
      </div>

      {/* Traffic + Incidents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <HourlyTrafficChart />
        </div>
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.05] rounded-2xl p-6 transition-all duration-300">
          <h3 className="text-[15px] font-semibold text-white mb-1">Active Incidents</h3>
          <p className="text-[12px] text-white/30 mb-4">{incidents.length} ongoing</p>
          <div className="space-y-3">
            {incidents.map((inc) => (
              <div
                key={inc.id}
                className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] transition-all duration-200 cursor-pointer"
              >
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${severityColor[inc.severity]}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-white/80 font-medium truncate">{inc.title}</p>
                  <p className="text-[11px] text-white/30 mt-0.5">{inc.location} · {inc.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Team + OOS + Cash */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Team on Duty */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.05] rounded-2xl p-6 transition-all duration-300">
          <h3 className="text-[15px] font-semibold text-white mb-1">Team on Duty</h3>
          <p className="text-[12px] text-white/30 mb-4">{team.filter(t => t.status === 'online').length} active now</p>
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
                  <p className="text-[13px] text-white/80 font-medium">{member.name}</p>
                  <p className="text-[11px] text-white/30">{member.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Out of Stock */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.05] rounded-2xl p-6 transition-all duration-300 flex flex-col items-center justify-center text-center">
          <div className="text-4xl mb-3">📦</div>
          <div className="text-4xl font-bold text-amber-400 mb-1">
            <AnimatedNumber value={outOfStock} />
          </div>
          <p className="text-[13px] text-white/40 font-medium">Out of Stock Items</p>
          <p className="text-[11px] text-white/25 mt-1">Across all departments</p>
          <button className="mt-4 text-[12px] text-blue-400 hover:text-blue-300 font-medium transition-colors duration-200">
            View Details →
          </button>
        </div>

        {/* Cash Session */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.05] rounded-2xl p-6 transition-all duration-300 flex flex-col items-center justify-center text-center">
          <div className="text-4xl mb-3">💵</div>
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-semibold mb-2 ${cashStatus === 'open' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-red-400/10 text-red-400'}`}>
            <div className={`w-2 h-2 rounded-full ${cashStatus === 'open' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            {cashStatus === 'open' ? 'Session Active' : 'Session Closed'}
          </div>
          <p className="text-[13px] text-white/40 font-medium">Cash Session Status</p>
          <p className="text-[11px] text-white/25 mt-1">Started at 8:00 AM</p>
        </div>
      </div>

      {/* AI Insights */}
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.05] rounded-2xl p-6 transition-all duration-300">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🧠</span>
          <h3 className="text-[15px] font-semibold text-white">AI Insights</h3>
        </div>
        <p className="text-[12px] text-white/30 mb-5">Powered by RetailGuard Intelligence</p>
        <div className="space-y-3">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className="relative flex gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] transition-all duration-200"
            >
              <span className="text-lg flex-shrink-0">{insightIcon[insight.type]}</span>
              <div className="flex-1">
                <p className="text-[13px] text-white/70 leading-relaxed">{insight.text}</p>
                <p className="text-[11px] text-white/25 mt-2">{insight.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
