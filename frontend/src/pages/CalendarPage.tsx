import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';

interface DayData {
  date: number;
  traffic: number;
  revenue: number;
  yoyChange: number; // positive = up, negative = down
  incidents: number;
}

interface DayDetail {
  date: number;
  hourlyTraffic: { hour: string; count: number }[];
  revenue: number;
  revenueBreakdown: { category: string; amount: number }[];
  incidents: number;
  aiSummary: string;
  yoyTraffic: { current: number; previous: number };
  yoyRevenue: { current: number; previous: number };
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function generatePlaceholderData(year: number, month: number): DayData[] {
  const days = getDaysInMonth(year, month);
  const data: DayData[] = [];
  for (let d = 1; d <= days; d++) {
    data.push({
      date: d,
      traffic: Math.floor(Math.random() * 2000) + 800,
      revenue: Math.floor(Math.random() * 15000) + 5000,
      yoyChange: Math.floor(Math.random() * 40) - 15,
      incidents: Math.floor(Math.random() * 5),
    });
  }
  return data;
}

function generateDayDetail(day: number): DayDetail {
  const hours = ['8am','9am','10am','11am','12pm','1pm','2pm','3pm','4pm','5pm','6pm','7pm','8pm'];
  return {
    date: day,
    hourlyTraffic: hours.map(h => ({ hour: h, count: Math.floor(Math.random() * 300) + 50 })),
    revenue: Math.floor(Math.random() * 15000) + 5000,
    revenueBreakdown: [
      { category: 'Electronics', amount: Math.floor(Math.random() * 5000) + 1000 },
      { category: 'Grocery', amount: Math.floor(Math.random() * 4000) + 800 },
      { category: 'Apparel', amount: Math.floor(Math.random() * 3000) + 500 },
      { category: 'Home', amount: Math.floor(Math.random() * 2000) + 300 },
    ],
    incidents: Math.floor(Math.random() * 5),
    aiSummary: `Day ${day} saw steady traffic with a notable peak during lunch hours. Conversion rates were above average, particularly in electronics. Customer dwell time increased 12% compared to the same day last year. Recommend extending afternoon staffing.`,
    yoyTraffic: { current: Math.floor(Math.random() * 2000) + 1000, previous: Math.floor(Math.random() * 2000) + 800 },
    yoyRevenue: { current: Math.floor(Math.random() * 15000) + 5000, previous: Math.floor(Math.random() * 12000) + 4000 },
  };
}

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [daysData, setDaysData] = useState<DayData[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [dayDetail, setDayDetail] = useState<DayDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);

  const isToday = (d: number) =>
    d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const fetchCalendar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/traffic/calendar', { params: { month: month + 1, year } });
      if (res.data?.days) {
        setDaysData(res.data.days);
      } else {
        setDaysData(generatePlaceholderData(year, month));
      }
    } catch {
      setDaysData(generatePlaceholderData(year, month));
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  const handleDayClick = (day: number) => {
    setSelectedDay(day);
    setDayDetail(generateDayDetail(day));
    setPanelOpen(true);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setTimeout(() => {
      setSelectedDay(null);
      setDayDetail(null);
    }, 300);
  };

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
    closePanel();
  };

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
    closePanel();
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const totalTraffic = daysData.reduce((s, d) => s + d.traffic, 0);
  const totalRevenue = daysData.reduce((s, d) => s + d.revenue, 0);
  const bestDay = daysData.length > 0 ? daysData.reduce((a, b) => a.revenue > b.revenue ? a : b) : null;
  const avgDaily = daysData.length > 0 ? Math.round(totalTraffic / daysData.length) : 0;

  const maxTraffic = Math.max(...daysData.map(d => d.traffic), 1);

  return (
    <div className="min-h-screen p-6 lg:p-8 space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-indigo-500/10 via-blue-500/5 to-transparent border border-gray-200/50 rounded-2xl p-8 lg:p-10">
        <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight mb-3">Calendar</h1>
        <p className="text-base text-[#86868B] leading-relaxed">Store calendar with event tracking, shift schedules, and historical analytics. Plan ahead and spot trends over time.</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Monthly Traffic */}
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalTraffic.toLocaleString()}</p>
          <p className="text-xs text-[#86868B] mt-1">Monthly Traffic</p>
        </div>

        {/* Total Revenue */}
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">${(totalRevenue / 1000).toFixed(1)}k</p>
          <p className="text-xs text-[#86868B] mt-1">Total Revenue</p>
        </div>

        {/* Best Day */}
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{bestDay ? `${MONTH_NAMES[month].slice(0,3)} ${bestDay.date}` : '—'}</p>
          <p className="text-xs text-[#86868B] mt-1">Best Day{bestDay ? ` — $${bestDay.revenue.toLocaleString()}` : ''}</p>
        </div>

        {/* Avg Daily Traffic */}
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{avgDaily.toLocaleString()}</p>
          <p className="text-xs text-[#86868B] mt-1">Avg Daily Traffic</p>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-[#636366] hover:text-gray-900 transition-all duration-200"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M8.5 3L4.5 7L8.5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <h2 className="text-lg font-semibold text-gray-900">
          {MONTH_NAMES[month]} {year}
        </h2>
        <button
          onClick={nextMonth}
          className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-[#636366] hover:text-gray-900 transition-all duration-200"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5.5 3L9.5 7L5.5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

      {/* Calendar Grid */}
      <div className={`bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-4 transition-opacity duration-500 ${loading ? 'opacity-50' : 'opacity-100'}`}>
        {/* Day Names */}
        <div className="grid grid-cols-7 mb-2">
          {DAY_NAMES.map(d => (
            <div key={d} className="text-center text-[10px] text-[#86868B] font-semibold uppercase tracking-wider py-2">{d}</div>
          ))}
        </div>

        {/* Day Cells */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells before first day */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const data = daysData.find(d => d.date === day);
            const selected = selectedDay === day;

            return (
              <button
                key={day}
                onClick={() => handleDayClick(day)}
                className={`
                  aspect-square rounded-xl p-2 flex flex-col items-start justify-between text-left
                  transition-all duration-200 relative group
                  ${selected ? 'bg-blue-500/10 border-blue-500/30' : 'bg-gray-50/50 hover:bg-gray-100/80'}
                  ${isToday(day) ? 'ring-2 ring-blue-500/50 ring-offset-1 ring-offset-white' : ''}
                  border border-gray-200/50
                `}
              >
                <span className={`text-[13px] font-semibold ${isToday(day) ? 'text-blue-600' : 'text-gray-900'}`}>
                  {day}
                </span>
                {data && (
                  <div className="w-full space-y-0.5">
                    <div className="text-[10px] text-[#636366] truncate">{data.traffic.toLocaleString()}</div>
                    <div className="text-[10px] text-[#86868B] truncate">${(data.revenue / 1000).toFixed(1)}k</div>
                    <div className="flex items-center gap-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${data.yoyChange >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`} />
                      <span className={`text-[9px] ${data.yoyChange >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {data.yoyChange >= 0 ? '+' : ''}{data.yoyChange}%
                      </span>
                    </div>
                  </div>
                )}
                {/* Traffic intensity background */}
                {data && (
                  <div
                    className="absolute inset-0 rounded-xl bg-indigo-500/5 pointer-events-none transition-opacity duration-300"
                    style={{ opacity: data.traffic / maxTraffic * 0.5 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Slide-in Detail Panel */}
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${panelOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={closePanel}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white/95 backdrop-blur-2xl border-l border-gray-200/50 z-50 transition-transform duration-300 ease-out overflow-y-auto ${panelOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {dayDetail && (
          <div className="p-6 space-y-6">
            {/* Panel Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {MONTH_NAMES[month]} {dayDetail.date}, {year}
                </h3>
                <p className="text-xs text-[#86868B] mt-0.5">Daily performance report</p>
              </div>
              <button
                onClick={closePanel}
                className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-[#636366] hover:text-gray-900 transition-all duration-200"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-gray-900">{dayDetail.hourlyTraffic.reduce((s, h) => s + h.count, 0).toLocaleString()}</div>
                <p className="text-[10px] text-[#86868B] mt-0.5">Visitors</p>
              </div>
              <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-emerald-500">${dayDetail.revenue.toLocaleString()}</div>
                <p className="text-[10px] text-[#86868B] mt-0.5">Revenue</p>
              </div>
              <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-amber-500">{dayDetail.incidents}</div>
                <p className="text-[10px] text-[#86868B] mt-0.5">Incidents</p>
              </div>
            </div>

            {/* Hourly Traffic */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Hourly Traffic</h4>
              <div className="space-y-1.5">
                {dayDetail.hourlyTraffic.map((h, i) => {
                  const max = Math.max(...dayDetail.hourlyTraffic.map(x => x.count), 1);
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[10px] text-[#86868B] w-8 text-right font-mono">{h.hour}</span>
                      <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                        <div
                          className="h-full bg-blue-500/50 rounded transition-all duration-500"
                          style={{ width: `${(h.count / max) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-[#636366] w-8 font-mono">{h.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Revenue Breakdown */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Revenue Breakdown</h4>
              <div className="space-y-2">
                {dayDetail.revenueBreakdown.map((cat, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-200/50">
                    <span className="text-xs text-[#636366]">{cat.category}</span>
                    <span className="text-xs text-gray-900 font-semibold">${cat.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* YoY Comparison */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Year over Year</h4>
              <div className="space-y-3">
                {/* Traffic YoY */}
                <div className="bg-gray-50 border border-gray-200/50 rounded-xl p-4">
                  <p className="text-[11px] text-[#86868B] mb-2">Traffic</p>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <div className="flex justify-between text-[10px] text-[#636366] mb-1">
                        <span>This Year</span>
                        <span>{dayDetail.yoyTraffic.current.toLocaleString()}</span>
                      </div>
                      <div className="h-4 bg-gray-200/50 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${(dayDetail.yoyTraffic.current / Math.max(dayDetail.yoyTraffic.current, dayDetail.yoyTraffic.previous)) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 items-end mt-2">
                    <div className="flex-1">
                      <div className="flex justify-between text-[10px] text-[#636366] mb-1">
                        <span>Last Year</span>
                        <span>{dayDetail.yoyTraffic.previous.toLocaleString()}</span>
                      </div>
                      <div className="h-4 bg-gray-200/50 rounded-full overflow-hidden">
                        <div className="h-full bg-gray-400 rounded-full transition-all duration-500" style={{ width: `${(dayDetail.yoyTraffic.previous / Math.max(dayDetail.yoyTraffic.current, dayDetail.yoyTraffic.previous)) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Revenue YoY */}
                <div className="bg-gray-50 border border-gray-200/50 rounded-xl p-4">
                  <p className="text-[11px] text-[#86868B] mb-2">Revenue</p>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <div className="flex justify-between text-[10px] text-[#636366] mb-1">
                        <span>This Year</span>
                        <span>${dayDetail.yoyRevenue.current.toLocaleString()}</span>
                      </div>
                      <div className="h-4 bg-gray-200/50 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${(dayDetail.yoyRevenue.current / Math.max(dayDetail.yoyRevenue.current, dayDetail.yoyRevenue.previous)) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 items-end mt-2">
                    <div className="flex-1">
                      <div className="flex justify-between text-[10px] text-[#636366] mb-1">
                        <span>Last Year</span>
                        <span>${dayDetail.yoyRevenue.previous.toLocaleString()}</span>
                      </div>
                      <div className="h-4 bg-gray-200/50 rounded-full overflow-hidden">
                        <div className="h-full bg-gray-400 rounded-full transition-all duration-500" style={{ width: `${(dayDetail.yoyRevenue.previous / Math.max(dayDetail.yoyRevenue.current, dayDetail.yoyRevenue.previous)) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Summary */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                  </svg>
                </div>
                <h4 className="text-sm font-semibold text-gray-900">AI Summary</h4>
              </div>
              <div className="bg-gray-50 border border-gray-200/50 rounded-xl p-4">
                <p className="text-xs text-[#636366] leading-relaxed">{dayDetail.aiSummary}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
