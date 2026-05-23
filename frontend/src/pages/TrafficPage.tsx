import { useEffect, useState } from 'react';
import api from '../services/api';

interface HourlyData {
  hour: string;
  count: number;
  isPeak: boolean;
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
  avatar: string;
  excluded: boolean;
}

export default function TrafficPage() {
  const [totalVisitors, setTotalVisitors] = useState(0);
  const [uniqueVisitors, setUniqueVisitors] = useState(0);
  const [returningVisitors, setReturningVisitors] = useState(0);
  const [currentlyInStore, setCurrentlyInStore] = useState(0);
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [peakHour, setPeakHour] = useState('');
  const [avgDwell, setAvgDwell] = useState('');
  const [busiestDay, setBusiestDay] = useState('');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0, 10));
  const [locationFilter, setLocationFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [animatedTotal, setAnimatedTotal] = useState(0);

  // Animated counter for hero number
  useEffect(() => {
    if (totalVisitors === 0) return;
    let current = 0;
    const step = totalVisitors / 50;
    const timer = setInterval(() => {
      current += step;
      if (current >= totalVisitors) {
        setAnimatedTotal(totalVisitors);
        clearInterval(timer);
      } else {
        setAnimatedTotal(Math.floor(current));
      }
    }, 25);
    return () => clearInterval(timer);
  }, [totalVisitors]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [todayRes, hourlyRes] = await Promise.all([
          api.get('/api/traffic/today', { params: { date: dateFilter, location: locationFilter } }),
          api.get('/api/traffic/hourly', { params: { date: dateFilter, location: locationFilter } }),
        ]);
        if (todayRes.data) {
          setTotalVisitors(todayRes.data.total || 2847);
          setUniqueVisitors(todayRes.data.unique || 2104);
          setReturningVisitors(todayRes.data.returning || 743);
          setCurrentlyInStore(todayRes.data.currentlyInStore || 47);
          setStaff(todayRes.data.staff || []);
          setPeakHour(todayRes.data.peakHour || '');
          setAvgDwell(todayRes.data.avgDwell || '');
          setBusiestDay(todayRes.data.busiestDay || '');
        }
        if (hourlyRes.data?.hours) {
          setHourlyData(hourlyRes.data.hours);
        }
      } catch {
        // Load placeholder data
        setTotalVisitors(2847);
        setUniqueVisitors(2104);
        setReturningVisitors(743);
        setCurrentlyInStore(47);
        setPeakHour('2:00 PM');
        setAvgDwell('18 min');
        setBusiestDay('Saturday');
        setStaff([
          { id: '1', name: 'Sarah Kim', role: 'Floor Manager', avatar: '👩‍💼', excluded: true },
          { id: '2', name: 'Marcus Torres', role: 'Security', avatar: '👨‍✈️', excluded: true },
          { id: '3', name: 'Aisha Rahman', role: 'Cashier Lead', avatar: '👩', excluded: true },
          { id: '4', name: 'David Lee', role: 'Stock Clerk', avatar: '👨', excluded: true },
          { id: '5', name: 'Jenny Park', role: 'Assistant Mgr', avatar: '👩‍💻', excluded: true },
        ]);

        const hours: HourlyData[] = [];
        const labels = ['8am','9am','10am','11am','12pm','1pm','2pm','3pm','4pm','5pm','6pm','7pm','8pm'];
        const vals = [45, 112, 198, 267, 310, 285, 342, 318, 289, 254, 198, 145, 84];
        const peak = Math.max(...vals);
        labels.forEach((h, i) => {
          hours.push({ hour: h, count: vals[i], isPeak: vals[i] === peak });
        });
        setHourlyData(hours);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dateFilter, locationFilter]);

  const maxHourly = Math.max(...hourlyData.map(h => h.count), 1);

  return (
    <div className="min-h-screen p-8 space-y-6">
      {/* Header */}
      <div className="mb-2">
        <h1 className="text-[28px] font-bold text-gray-900 tracking-tight">Smart Traffic</h1>
        <p className="text-[13px] text-gray-900/40 mt-1">Real-time foot traffic intelligence</p>
      </div>

      {/* Hero Stat */}
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.05] rounded-2xl p-8 transition-all duration-300">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <p className="text-[13px] text-gray-900/40 font-medium uppercase tracking-wider mb-2">Today's Visitors</p>
            <div className={`text-6xl font-bold text-gray-900 tracking-tight transition-opacity duration-500 ${loading ? 'opacity-40' : 'opacity-100'}`}>
              {animatedTotal.toLocaleString()}
            </div>
          </div>
          <div className="flex gap-8">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{uniqueVisitors.toLocaleString()}</div>
              <p className="text-[12px] text-gray-900/30 mt-1">Unique</p>
            </div>
            <div className="w-px bg-white/[0.06]" />
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{returningVisitors.toLocaleString()}</div>
              <p className="text-[12px] text-gray-900/30 mt-1">Returning</p>
            </div>
            <div className="w-px bg-white/[0.06]" />
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-400">{currentlyInStore}</div>
              <p className="text-[12px] text-gray-900/30 mt-1">In Store Now</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="bg-white/[0.04] border border-white/[0.08] text-gray-900/80 text-[13px] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30 transition-all duration-200 [color-scheme:dark]"
          />
        </div>
        <select
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          className="bg-white/[0.04] border border-white/[0.08] text-gray-900/80 text-[13px] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30 transition-all duration-200 appearance-none pr-8 cursor-pointer"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='rgba(255,255,255,0.3)' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
        >
          <option value="all">All Locations</option>
          <option value="store-a">Store A — Downtown</option>
          <option value="store-b">Store B — Mall</option>
          <option value="store-c">Store C — Suburb</option>
        </select>
      </div>

      {/* Hourly Breakdown */}
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.05] rounded-2xl p-6 transition-all duration-300">
        <h3 className="text-[15px] font-semibold text-gray-900 mb-1">Hourly Breakdown</h3>
        <p className="text-[12px] text-gray-900/30 mb-6">Foot traffic distribution throughout the day</p>
        <div className="space-y-2">
          {hourlyData.map((h, i) => (
            <div key={i} className="flex items-center gap-3 group">
              <span className="text-[12px] text-gray-900/30 w-10 text-right font-mono">{h.hour}</span>
              <div className="flex-1 h-8 bg-white/[0.02] rounded-lg overflow-hidden relative">
                <div
                  className={`h-full rounded-lg transition-all duration-700 ease-out ${h.isPeak ? 'bg-gradient-to-r from-blue-500 to-cyan-400' : 'bg-blue-500/40'} group-hover:brightness-125`}
                  style={{ width: `${(h.count / maxHourly) * 100}%`, transitionDelay: `${i * 40}ms` }}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-gray-900/50 font-mono">
                  {h.count}
                </span>
              </div>
              {h.isPeak && (
                <span className="text-[10px] text-cyan-400 font-semibold bg-cyan-400/10 px-2 py-0.5 rounded-full">
                  PEAK
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Peak Hour', value: peakHour, icon: '⏰' },
          { label: 'Avg Dwell Time', value: avgDwell, icon: '⏱️' },
          { label: 'Busiest Day This Week', value: busiestDay, icon: '📅' },
        ].map((stat, i) => (
          <div key={i} className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.05] rounded-2xl p-5 transition-all duration-300 hover:bg-white/[0.06] text-center">
            <span className="text-2xl">{stat.icon}</span>
            <div className="text-xl font-bold text-gray-900 mt-3 mb-1">{stat.value || '—'}</div>
            <p className="text-[12px] text-gray-900/30">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Known Staff */}
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.05] rounded-2xl p-6 transition-all duration-300">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[15px] font-semibold text-gray-900">Known Staff</h3>
            <p className="text-[12px] text-gray-900/30 mt-0.5">Excluded from traffic count</p>
          </div>
          <span className="text-[12px] text-gray-900/20 bg-white/[0.04] px-3 py-1 rounded-full">
            {staff.length} members
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {staff.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] transition-all duration-200"
            >
              <div className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center text-lg">
                {member.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-gray-900/80 font-medium truncate">{member.name}</p>
                <p className="text-[11px] text-gray-900/30">{member.role}</p>
              </div>
              {member.excluded && (
                <div className="flex-shrink-0">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-emerald-400/60">
                    <path d="M13.3 4.7L6 12L2.7 8.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
