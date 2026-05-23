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
    <div className="min-h-screen p-8 space-y-6">
      {/* Header */}
      <div className="mb-2">
        <h1 className="text-[28px] font-bold text-white tracking-tight">Calendar</h1>
        <p className="text-[13px] text-white/40 mt-1">Store performance at a glance</p>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Monthly Traffic', value: totalTraffic.toLocaleString(), icon: '👥' },
          { label: 'Total Revenue', value: `$${(totalRevenue / 1000).toFixed(1)}k`, icon: '💰' },
          { label: 'Best Day', value: bestDay ? `${MONTH_NAMES[month].slice(0,3)} ${bestDay.date}` : '—', sub: bestDay ? `$${bestDay.revenue.toLocaleString()}` : '', icon: '🏆' },
          { label: 'Avg Daily Traffic', value: avgDaily.toLocaleString(), icon: '📊' },
        ].map((s, i) => (
          <div key={i} className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.05] rounded-2xl p-5 transition-all duration-300 hover:bg-white/[0.06]">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{s.icon}</span>
              <span className="text-[12px] text-white/30 font-medium">{s.label}</span>
            </div>
            <div className="text-xl font-bold text-white">{s.value}</div>
            {s.sub && <div className="text-[11px] text-white/25 mt-0.5">{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.08] transition-all duration-200"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M8.5 3L4.5 7L8.5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <h2 className="text-[18px] font-semibold text-white">
          {MONTH_NAMES[month]} {year}
        </h2>
        <button
          onClick={nextMonth}
          className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.08] transition-all duration-200"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5.5 3L9.5 7L5.5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

      {/* Calendar Grid */}
      <div className={`bg-white/[0.03] backdrop-blur-xl border border-white/[0.05] rounded-2xl p-4 transition-opacity duration-500 ${loading ? 'opacity-50' : 'opacity-100'}`}>
        {/* Day Names */}
        <div className="grid grid-cols-7 mb-2">
          {DAY_NAMES.map(d => (
            <div key={d} className="text-center text-[11px] text-white/25 font-medium py-2">{d}</div>
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
                  ${selected ? 'bg-blue-500/20 border-blue-500/30' : 'bg-white/[0.01] hover:bg-white/[0.05]'}
                  ${isToday(day) ? 'ring-2 ring-blue-500/50 ring-offset-1 ring-offset-[#1C1C1E]' : ''}
                  border border-white/[0.04]
                `}
              >
                <span className={`text-[13px] font-semibold ${isToday(day) ? 'text-blue-400' : 'text-white/60'}`}>
                  {day}
                </span>
                {data && (
                  <div className="w-full space-y-0.5">
                    <div className="text-[10px] text-white/40 truncate">{data.traffic.toLocaleString()}</div>
                    <div className="text-[10px] text-white/25 truncate">${(data.revenue / 1000).toFixed(1)}k</div>
                    <div className="flex items-center gap-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${data.yoyChange >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`} />
                      <span className={`text-[9px] ${data.yoyChange >= 0 ? 'text-emerald-400/60' : 'text-red-400/60'}`}>
                        {data.yoyChange >= 0 ? '+' : ''}{data.yoyChange}%
                      </span>
                    </div>
                  </div>
                )}
                {/* Traffic intensity background */}
                {data && (
                  <div
                    className="absolute inset-0 rounded-xl bg-blue-500/5 pointer-events-none transition-opacity duration-300"
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
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-[#1C1C1E]/95 backdrop-blur-2xl border-l border-white/[0.06] z-50 transition-transform duration-300 ease-out overflow-y-auto ${panelOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {dayDetail && (
          <div className="p-6 space-y-6">
            {/* Panel Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[20px] font-bold text-white">
                  {MONTH_NAMES[month]} {dayDetail.date}, {year}
                </h3>
                <p className="text-[12px] text-white/30 mt-0.5">Daily performance report</p>
              </div>
              <button
                onClick={closePanel}
                className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.1] transition-all duration-200"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-white">{dayDetail.hourlyTraffic.reduce((s, h) => s + h.count, 0).toLocaleString()}</div>
                <p className="text-[10px] text-white/30 mt-0.5">Visitors</p>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-emerald-400">${dayDetail.revenue.toLocaleString()}</div>
                <p className="text-[10px] text-white/30 mt-0.5">Revenue</p>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-amber-400">{dayDetail.incidents}</div>
                <p className="text-[10px] text-white/30 mt-0.5">Incidents</p>
              </div>
            </div>

            {/* Hourly Traffic */}
            <div>
              <h4 className="text-[13px] font-semibold text-white mb-3">Hourly Traffic</h4>
              <div className="space-y-1.5">
                {dayDetail.hourlyTraffic.map((h, i) => {
                  const max = Math.max(...dayDetail.hourlyTraffic.map(x => x.count), 1);
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[10px] text-white/25 w-8 text-right font-mono">{h.hour}</span>
                      <div className="flex-1 h-5 bg-white/[0.02] rounded overflow-hidden">
                        <div
                          className="h-full bg-blue-500/50 rounded transition-all duration-500"
                          style={{ width: `${(h.count / max) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-white/30 w-8 font-mono">{h.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Revenue Breakdown */}
            <div>
              <h4 className="text-[13px] font-semibold text-white mb-3">Revenue Breakdown</h4>
              <div className="space-y-2">
                {dayDetail.revenueBreakdown.map((cat, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <span className="text-[12px] text-white/60">{cat.category}</span>
                    <span className="text-[12px] text-white/80 font-semibold">${cat.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* YoY Comparison */}
            <div>
              <h4 className="text-[13px] font-semibold text-white mb-3">Year over Year</h4>
              <div className="space-y-3">
                {/* Traffic YoY */}
                <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-4">
                  <p className="text-[11px] text-white/30 mb-2">Traffic</p>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <div className="flex justify-between text-[10px] text-white/40 mb-1">
                        <span>This Year</span>
                        <span>{dayDetail.yoyTraffic.current.toLocaleString()}</span>
                      </div>
                      <div className="h-4 bg-white/[0.04] rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${(dayDetail.yoyTraffic.current / Math.max(dayDetail.yoyTraffic.current, dayDetail.yoyTraffic.previous)) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 items-end mt-2">
                    <div className="flex-1">
                      <div className="flex justify-between text-[10px] text-white/40 mb-1">
                        <span>Last Year</span>
                        <span>{dayDetail.yoyTraffic.previous.toLocaleString()}</span>
                      </div>
                      <div className="h-4 bg-white/[0.04] rounded-full overflow-hidden">
                        <div className="h-full bg-white/20 rounded-full transition-all duration-500" style={{ width: `${(dayDetail.yoyTraffic.previous / Math.max(dayDetail.yoyTraffic.current, dayDetail.yoyTraffic.previous)) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Revenue YoY */}
                <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-4">
                  <p className="text-[11px] text-white/30 mb-2">Revenue</p>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <div className="flex justify-between text-[10px] text-white/40 mb-1">
                        <span>This Year</span>
                        <span>${dayDetail.yoyRevenue.current.toLocaleString()}</span>
                      </div>
                      <div className="h-4 bg-white/[0.04] rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${(dayDetail.yoyRevenue.current / Math.max(dayDetail.yoyRevenue.current, dayDetail.yoyRevenue.previous)) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 items-end mt-2">
                    <div className="flex-1">
                      <div className="flex justify-between text-[10px] text-white/40 mb-1">
                        <span>Last Year</span>
                        <span>${dayDetail.yoyRevenue.previous.toLocaleString()}</span>
                      </div>
                      <div className="h-4 bg-white/[0.04] rounded-full overflow-hidden">
                        <div className="h-full bg-white/20 rounded-full transition-all duration-500" style={{ width: `${(dayDetail.yoyRevenue.previous / Math.max(dayDetail.yoyRevenue.current, dayDetail.yoyRevenue.previous)) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Summary */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm">🧠</span>
                <h4 className="text-[13px] font-semibold text-white">AI Summary</h4>
              </div>
              <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-4">
                <p className="text-[12px] text-white/50 leading-relaxed">{dayDetail.aiSummary}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
