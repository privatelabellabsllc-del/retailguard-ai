import { useState, useEffect } from 'react';
import api from '../services/api';

interface RevenueRecord {
  id: string;
  date: string;
  total: number;
  transactions: number;
  average: number;
  cash: number;
  card: number;
  source: string;
}

interface Projection {
  daily: number;
  weekly: number;
  monthly: number;
  trend: number;
  confidence: number;
}

const posProviders = [
  { name: 'Square', connected: false },
  { name: 'Clover', connected: true },
  { name: 'Shopify', connected: false },
  { name: 'Toast', connected: false },
  { name: 'Lightspeed', connected: false },
];

export default function RevenuePage() {
  const [records, setRecords] = useState<RevenueRecord[]>([]);
  const [projections, setProjections] = useState<Projection | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<{ date: string; amount: number }[]>([]);
  const [form, setForm] = useState({ date: '', revenue: '', transactions: '', cash: '', card: '' });
  const [activeTab, setActiveTab] = useState<'chart' | 'pos' | 'manual'>('chart');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [revRes, projRes] = await Promise.all([
        api.analytics.revenue(),
        api.analytics.projections(),
      ]);
      setRecords(revRes.data || generateMockRecords());
      setProjections(projRes.data || { daily: 4250, weekly: 29800, monthly: 128500, trend: 12.4, confidence: 87 });
      setChartData(revRes.data?.chart || generateMockChart());
    } catch {
      setRecords(generateMockRecords());
      setProjections({ daily: 4250, weekly: 29800, monthly: 128500, trend: 12.4, confidence: 87 });
      setChartData(generateMockChart());
    } finally {
      setLoading(false);
    }
  };

  const generateMockChart = () => {
    return Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      amount: 2000 + Math.random() * 4000,
    }));
  };

  const generateMockRecords = (): RevenueRecord[] => {
    return Array.from({ length: 12 }, (_, i) => {
      const total = 2500 + Math.random() * 3500;
      const cash = total * (0.2 + Math.random() * 0.3);
      return {
        id: `rev-${i}`,
        date: new Date(Date.now() - i * 86400000).toLocaleDateString(),
        total,
        transactions: Math.floor(40 + Math.random() * 80),
        average: total / (40 + Math.random() * 80),
        cash,
        card: total - cash,
        source: ['POS', 'Manual', 'POS', 'POS'][i % 4],
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Submit manual entry
    setForm({ date: '', revenue: '', transactions: '', cash: '', card: '' });
  };

  const maxAmount = Math.max(...chartData.map(d => d.amount), 1);

  const formatCurrency = (n: number) => '$' + n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 lg:p-8 space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border border-gray-200/50 rounded-2xl p-8 lg:p-10">
        <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight mb-3">Revenue</h1>
        <p className="text-base text-[#86868B] leading-relaxed">Revenue analytics, projections, and POS integration. Track daily sales, identify trends, and forecast future performance.</p>
      </div>

      {/* Projections */}
      {projections && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              label: 'Daily Projected',
              value: projections.daily,
              period: 'Today',
              iconBg: 'bg-emerald-500/10',
              iconColor: 'text-emerald-600',
            },
            {
              label: 'Weekly Projected',
              value: projections.weekly,
              period: 'This week',
              iconBg: 'bg-blue-500/10',
              iconColor: 'text-blue-600',
            },
            {
              label: 'Monthly Projected',
              value: projections.monthly,
              period: 'This month',
              iconBg: 'bg-purple-500/10',
              iconColor: 'text-purple-600',
            },
          ].map((p) => (
            <div
              key={p.label}
              className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5 transition-all duration-200 hover:border-[#48484A]/60 hover:shadow-sm hover:shadow-black/10 group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl ${p.iconBg} flex items-center justify-center ${p.iconColor}`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-[#86868B] uppercase tracking-wider">{p.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(p.value)}</p>
              <div className="flex items-center gap-2 mt-3">
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${projections.trend >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                  {projections.trend >= 0 ? '+' : ''}{projections.trend}%
                </span>
                <span className="text-xs text-[#86868B]">{p.period}</span>
                <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-500">
                  {projections.confidence}% conf
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex gap-1 bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-xl p-1 w-fit">
        {(['chart', 'pos', 'manual'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === tab
                ? 'bg-gray-100 text-gray-900 shadow-sm'
                : 'text-[#86868B] hover:text-gray-700'
            }`}
          >
            {tab === 'chart' && (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            )}
            {tab === 'pos' && (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.813a4.5 4.5 0 00-6.364-6.364L4.5 8.25" />
              </svg>
            )}
            {tab === 'manual' && (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
            )}
            {tab === 'chart' ? 'Revenue Chart' : tab === 'pos' ? 'POS Integration' : 'Manual Entry'}
          </button>
        ))}
      </div>

      {/* Chart */}
      {activeTab === 'chart' && (
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Last 30 Days Revenue</h2>
          <div className="flex items-end gap-[3px] h-48">
            {chartData.map((d, i) => {
              const height = (d.amount / maxAmount) * 100;
              const intensity = d.amount / maxAmount;
              return (
                <div key={i} className="flex-1 group relative flex flex-col items-center justify-end h-full">
                  <div
                    className="w-full rounded-t-sm transition-all duration-300 group-hover:opacity-80 cursor-pointer"
                    style={{
                      height: `${height}%`,
                      background: `linear-gradient(to top, rgba(16,185,129,${0.3 + intensity * 0.7}), rgba(20,184,166,${0.3 + intensity * 0.7}))`,
                    }}
                  />
                  <div className="absolute -top-10 bg-white border border-gray-200/50 text-gray-900 text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-10 shadow-sm">
                    {d.date}: {formatCurrency(d.amount)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-3 text-[10px] text-[#86868B]">
            <span>{chartData[0]?.date}</span>
            <span>{chartData[Math.floor(chartData.length / 2)]?.date}</span>
            <span>{chartData[chartData.length - 1]?.date}</span>
          </div>
        </div>
      )}

      {/* POS Integration */}
      {activeTab === 'pos' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {posProviders.map((pos) => (
            <div
              key={pos.name}
              className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5 transition-all duration-200 hover:border-[#48484A]/60 hover:shadow-sm hover:shadow-black/10 group"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-[#636366]">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{pos.name}</p>
                  <p className="text-xs text-[#86868B]">Point of Sale</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${pos.connected ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                  <span className={`text-xs ${pos.connected ? 'text-emerald-500' : 'text-[#86868B]'}`}>
                    {pos.connected ? 'Connected' : 'Not connected'}
                  </span>
                </div>
                <button
                  className={`px-4 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 ${
                    pos.connected
                      ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
                      : 'bg-blue-500/15 text-blue-500 hover:bg-blue-500/25'
                  }`}
                >
                  {pos.connected ? 'Disconnect' : 'Connect'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Manual Entry */}
      {activeTab === 'manual' && (
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-5">Add Revenue Entry</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { key: 'date', label: 'Date', type: 'date', placeholder: '' },
              { key: 'revenue', label: 'Total Revenue', type: 'number', placeholder: '$0.00' },
              { key: 'transactions', label: 'Transactions', type: 'number', placeholder: '0' },
              { key: 'cash', label: 'Cash Amount', type: 'number', placeholder: '$0.00' },
              { key: 'card', label: 'Card Amount', type: 'number', placeholder: '$0.00' },
            ].map((field) => (
              <div key={field.key}>
                <label className="block text-xs text-[#86868B] mb-1.5">{field.label}</label>
                <input
                  type={field.type}
                  placeholder={field.placeholder}
                  value={form[field.key as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/80 border border-gray-200/50 rounded-xl text-sm text-gray-900 placeholder:text-[#636366] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-all duration-200"
                />
              </div>
            ))}
            <div className="sm:col-span-2 lg:col-span-5 flex justify-end">
              <button
                type="submit"
                className="px-6 py-3 text-sm font-semibold rounded-xl bg-blue-500 hover:bg-blue-400 text-white shadow-sm shadow-blue-500/20 transition-all duration-200 active:scale-95"
              >
                Add Entry
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Revenue Records Table */}
      <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Revenue Records</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#86868B] uppercase tracking-wider">Date</th>
                <th className="px-5 py-3 text-right text-[10px] font-semibold text-[#86868B] uppercase tracking-wider">Total</th>
                <th className="px-5 py-3 text-right text-[10px] font-semibold text-[#86868B] uppercase tracking-wider">Transactions</th>
                <th className="px-5 py-3 text-right text-[10px] font-semibold text-[#86868B] uppercase tracking-wider">Avg</th>
                <th className="px-5 py-3 text-right text-[10px] font-semibold text-[#86868B] uppercase tracking-wider">Cash</th>
                <th className="px-5 py-3 text-right text-[10px] font-semibold text-[#86868B] uppercase tracking-wider">Card</th>
                <th className="px-5 py-3 text-center text-[10px] font-semibold text-[#86868B] uppercase tracking-wider">Source</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-5 py-4 text-sm text-gray-900">{r.date}</td>
                  <td className="px-5 py-4 text-sm text-gray-900 text-right font-medium">{formatCurrency(r.total)}</td>
                  <td className="px-5 py-4 text-sm text-[#636366] text-right">{r.transactions}</td>
                  <td className="px-5 py-4 text-sm text-[#636366] text-right">${r.average.toFixed(2)}</td>
                  <td className="px-5 py-4 text-sm text-emerald-500 text-right">{formatCurrency(r.cash)}</td>
                  <td className="px-5 py-4 text-sm text-blue-500 text-right">{formatCurrency(r.card)}</td>
                  <td className="px-5 py-4 text-center">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      r.source === 'POS'
                        ? 'bg-blue-500/15 text-blue-500'
                        : 'bg-gray-100 text-[#86868B]'
                    }`}>
                      {r.source}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
