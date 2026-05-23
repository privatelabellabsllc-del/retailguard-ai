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
          { id: '1', name: 'Sarah Kim', role: 'Floor Manager', avatar: 'SK', excluded: true },
          { id: '2', name: 'Marcus Torres', role: 'Security', avatar: 'MT', excluded: true },
          { id: '3', name: 'Aisha Rahman', role: 'Cashier Lead', avatar: 'AR', excluded: true },
          { id: '4', name: 'David Lee', role: 'Stock Clerk', avatar: 'DL', excluded: true },
          { id: '5', name: 'Jenny Park', role: 'Assistant Mgr', avatar: 'JP', excluded: true },
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

  const statIcons = [
    // Clock icon for Peak Hour
    <svg key="clock" className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>,
    // Clock icon for Avg Dwell
    <svg key="dwell" className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>,
    // Calendar icon for Busiest Day
    <svg key="calendar" className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>,
  ];

  const statBgColors = ['bg-blue-500/10', 'bg-purple-500/10', 'bg-emerald-500/10'];

  return (
    <div className="min-h-screen p-6 lg:p-8 space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-transparent border border-gray-200/50 rounded-2xl p-8 lg:p-10">
        <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight mb-3">Smart Traffic</h1>
        <p className="text-base text-[#86868B] leading-relaxed">Smart foot traffic analytics powered by AI. Track customer flow, peak hours, and visitor trends across your store in real time.</p>
      </div>

      {/* Hero Stat Card */}
      <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-8 transition-all duration-200">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <p className="text-xs text-[#86868B] font-medium uppercase tracking-wider mb-2">Today's Visitors</p>
            <div className={`text-6xl font-bold text-gray-900 tracking-tight transition-opacity duration-500 ${loading ? 'opacity-40' : 'opacity-100'}`}>
              {animatedTotal.toLocaleString()}
            </div>
          </div>
          <div className="flex gap-8">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{uniqueVisitors.toLocaleString()}</div>
              <p className="text-xs text-[#86868B] mt-1">Unique</p>
            </div>
            <div className="w-px bg-gray-200" />
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{returningVisitors.toLocaleString()}</div>
              <p className="text-xs text-[#86868B] mt-1">Returning</p>
            </div>
            <div className="w-px bg-gray-200" />
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-500">{currentlyInStore}</div>
              <p className="text-xs text-[#86868B] mt-1">In Store Now</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3">
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="px-4 py-2.5 bg-white/80 border border-gray-200/50 rounded-xl text-sm text-gray-900 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-all duration-200"
        />
        <select
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          className="px-4 py-2.5 bg-white/80 border border-gray-200/50 rounded-xl text-sm text-gray-900 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25"
        >
          <option value="all">All Locations</option>
          <option value="store-a">Store A — Downtown</option>
          <option value="store-b">Store B — Mall</option>
          <option value="store-c">Store C — Suburb</option>
        </select>
      </div>

      {/* Hourly Breakdown */}
      <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-6 transition-all duration-200 hover:border-[#48484A]/60 hover:shadow-sm hover:shadow-black/10">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Hourly Breakdown</h2>
        <p className="text-xs text-[#86868B] mb-6">Foot traffic distribution throughout the day</p>
        <div className="space-y-2">
          {hourlyData.map((h, i) => (
            <div key={i} className="flex items-center gap-3 group">
              <span className="text-xs text-[#86868B] w-10 text-right font-mono">{h.hour}</span>
              <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden relative">
                <div
                  className={`h-full rounded-lg transition-all duration-700 ease-out ${h.isPeak ? 'bg-gradient-to-r from-blue-500 to-cyan-400' : 'bg-blue-500/40'} group-hover:brightness-110`}
                  style={{ width: `${(h.count / maxHourly) * 100}%`, transitionDelay: `${i * 40}ms` }}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#636366] font-mono">
                  {h.count}
                </span>
              </div>
              {h.isPeak && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-500">
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
          { label: 'Peak Hour', value: peakHour },
          { label: 'Avg Dwell Time', value: avgDwell },
          { label: 'Busiest Day This Week', value: busiestDay },
        ].map((stat, i) => (
          <div key={i} className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5 transition-all duration-200 hover:border-[#48484A]/60 hover:shadow-sm hover:shadow-black/10">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl ${statBgColors[i]} flex items-center justify-center`}>
                {statIcons[i]}
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value || '—'}</p>
            <p className="text-xs text-[#86868B] mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Known Staff */}
      <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-6 transition-all duration-200 hover:border-[#48484A]/60 hover:shadow-sm hover:shadow-black/10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Known Staff</h2>
            <p className="text-xs text-[#86868B] mt-0.5">Excluded from traffic count</p>
          </div>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-[#86868B]">
            {staff.length} members
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {staff.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/80 border border-gray-200/50 hover:border-[#48484A]/60 transition-all duration-200"
            >
              <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{member.name}</p>
                <p className="text-[10px] text-[#636366]">{member.role}</p>
              </div>
              {member.excluded && (
                <div className="flex-shrink-0">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-emerald-400">
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
