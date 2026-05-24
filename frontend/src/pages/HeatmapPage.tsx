import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';

interface Zone {
  id: string;
  name: string;
  trafficCount: number;
  avgDwellTime: string;
  peakCount: number;
}

interface Fridge {
  id: string;
  name: string;
  opensToday: number;
  grabRate: number;
  avgOpenDuration: string;
  leftOpenAlerts: number;
}

const generateHeatmapData = (): number[][] => {
  const data: number[][] = [];
  for (let r = 0; r < 10; r++) {
    const row: number[] = [];
    for (let c = 0; c < 10; c++) {
      // Create organic-looking clusters
      const cx1 = 3, cy1 = 7, cx2 = 7, cy2 = 3, cx3 = 5, cy3 = 5;
      const d1 = Math.sqrt((r - cx1) ** 2 + (c - cy1) ** 2);
      const d2 = Math.sqrt((r - cx2) ** 2 + (c - cy2) ** 2);
      const d3 = Math.sqrt((r - cx3) ** 2 + (c - cy3) ** 2);
      const base = Math.max(0, 1 - Math.min(d1, d2, d3) / 6);
      const noise = Math.random() * 0.25;
      row.push(Math.min(1, Math.max(0, base + noise)));
    }
    data.push(row);
  }
  return data;
};

const mockZones: Zone[] = [
  { id: '1', name: 'Entrance', trafficCount: 1247, avgDwellTime: '0m 42s', peakCount: 89 },
  { id: '2', name: 'Produce Section', trafficCount: 983, avgDwellTime: '3m 18s', peakCount: 64 },
  { id: '3', name: 'Checkout Area', trafficCount: 1102, avgDwellTime: '4m 55s', peakCount: 72 },
  { id: '4', name: 'Dairy Aisle', trafficCount: 671, avgDwellTime: '2m 07s', peakCount: 41 },
  { id: '5', name: 'Beverages', trafficCount: 534, avgDwellTime: '1m 34s', peakCount: 38 },
];

const mockFridges: Fridge[] = [
  { id: '1', name: 'Dairy Cooler A', opensToday: 342, grabRate: 78, avgOpenDuration: '4.2s', leftOpenAlerts: 2 },
  { id: '2', name: 'Beverage Fridge B', opensToday: 287, grabRate: 65, avgOpenDuration: '3.8s', leftOpenAlerts: 0 },
  { id: '3', name: 'Deli Cooler C', opensToday: 198, grabRate: 82, avgOpenDuration: '5.1s', leftOpenAlerts: 1 },
  { id: '4', name: 'Frozen Foods D', opensToday: 156, grabRate: 71, avgOpenDuration: '6.3s', leftOpenAlerts: 3 },
];

const getCellColor = (value: number): string => {
  if (value < 0.15) return 'bg-blue-50/60';
  if (value < 0.3) return 'bg-blue-700/60';
  if (value < 0.45) return 'bg-cyan-600/60';
  if (value < 0.6) return 'bg-emerald-500/60';
  if (value < 0.75) return 'bg-yellow-500/60';
  if (value < 0.85) return 'bg-orange-500/70';
  return 'bg-red-500/80';
};

export default function HeatmapPage() {
  const [heatmapData, setHeatmapData] = useState<number[][]>(() => generateHeatmapData());
  const [zones, setZones] = useState<Zone[]>(mockZones);
  const [fridges, setFridges] = useState<Fridge[]>(mockFridges);
  const [selectedDate, setSelectedDate] = useState('2026-05-23');
  const [selectedHour, setSelectedHour] = useState(14);
  const [selectedCamera, setSelectedCamera] = useState('all');

  const fetchData = useCallback(async () => {
    try {
      const [heatmapRes, fridgeRes] = await Promise.all([
        api.analytics.heatmap(),
        api.analytics.fridge(),
      ]);
      if (heatmapRes?.data?.grid?.length) setHeatmapData(heatmapRes.data.grid);
      if (heatmapRes?.data?.zones?.length) setZones(heatmapRes.data.zones);
      if (fridgeRes?.data?.length) setFridges(fridgeRes.data);
    } catch {
      // Use mock data
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const refreshHeatmap = () => {
    setHeatmapData(generateHeatmapData());
  };

  const mostOpenedFridge = useMemo(() => {
    return fridges.reduce((max, f) => f.opensToday > max.opensToday ? f : max, fridges[0]);
  }, [fridges]);

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-cyan-500/10 via-teal-500/5 to-transparent border border-gray-200/50 rounded-2xl p-5 md:p-8 lg:p-10">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight mb-3">Traffic Heatmap</h1>
            <p className="text-base text-[#86868B] leading-relaxed">Visual traffic heatmaps showing where customers spend the most time. Optimize store layout and product placement with AI insights.</p>
          </div>
          <button
            onClick={refreshHeatmap}
            className="px-6 py-3 text-sm font-semibold rounded-xl bg-blue-500 hover:bg-blue-400 text-white shadow-sm shadow-blue-500/20 transition-all duration-200 active:scale-95 flex items-center gap-2 shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-xl px-4 py-2.5 flex items-center gap-2">
          <svg className="w-4 h-4 text-[#636366]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="bg-transparent text-sm text-gray-900 focus:outline-none"
          />
        </div>

        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-xl px-4 py-2.5 flex items-center gap-3 flex-1 min-w-[200px] max-w-xs">
          <svg className="w-4 h-4 text-[#636366] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <input
            type="range"
            min={0}
            max={23}
            value={selectedHour}
            onChange={e => { setSelectedHour(Number(e.target.value)); refreshHeatmap(); }}
            className="flex-1 accent-blue-500 h-1"
          />
          <span className="text-sm text-gray-900 font-medium tabular-nums w-12 text-right">
            {String(selectedHour).padStart(2, '0')}:00
          </span>
        </div>

        <select
          value={selectedCamera}
          onChange={e => setSelectedCamera(e.target.value)}
          className="px-4 py-2.5 bg-white/80 border border-gray-200/50 rounded-xl text-sm text-gray-900 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25"
        >
          <option value="all">All Cameras</option>
          <option value="cam1">Camera 1 — Entrance</option>
          <option value="cam2">Camera 2 — Aisles</option>
          <option value="cam3">Camera 3 — Checkout</option>
          <option value="cam4">Camera 4 — Back</option>
        </select>
      </div>

      {/* Heatmap Grid */}
      <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Store Floor Plan</h2>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-[#86868B]">
            <span>Low</span>
            <div className="flex gap-0.5">
              {['bg-blue-50/60', 'bg-blue-700/60', 'bg-cyan-600/60', 'bg-emerald-500/60', 'bg-yellow-500/60', 'bg-orange-500/70', 'bg-red-500/80'].map((c, i) => (
                <div key={i} className={`w-5 h-2.5 rounded-sm ${c}`} />
              ))}
            </div>
            <span>High</span>
          </div>
        </div>
        <div className="overflow-x-auto"><div className="grid grid-cols-10 gap-1 aspect-[2/1] max-w-3xl mx-auto min-w-[400px]">
          {heatmapData.map((row, r) =>
            row.map((val, c) => (
              <div
                key={`${r}-${c}`}
                className={`rounded-lg ${getCellColor(val)} transition-colors duration-300 hover:ring-1 hover:ring-white/20 cursor-crosshair relative group`}
                title={`Row ${r + 1}, Col ${c + 1}: ${Math.round(val * 100)}% traffic`}
              >
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-[10px] text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap z-10">
                  {Math.round(val * 100)}%
                </div>
              </div>
            ))
          )}
        </div>
        </div>
      </div>

      {/* Zone Cards */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Detected Zones</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {zones.map(zone => (
            <div
              key={zone.id}
              className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5 transition-all duration-200 hover:border-[#48484A]/60 hover:shadow-sm hover:shadow-black/10 group"
            >
              <h3 className="text-sm font-semibold text-gray-900 mb-3">{zone.name}</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#86868B]">Traffic</span>
                  <span className="text-sm font-medium text-gray-900">{zone.trafficCount.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#86868B]">Avg Dwell</span>
                  <span className="text-sm font-medium text-gray-900">{zone.avgDwellTime}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#86868B]">Peak</span>
                  <span className="text-sm font-medium text-gray-900">{zone.peakCount}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fridge Analytics */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Fridge Analytics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {fridges.map(fridge => {
            const isMostOpened = fridge.id === mostOpenedFridge?.id;
            return (
              <div
                key={fridge.id}
                className={`bg-white/80 backdrop-blur-xl border rounded-2xl p-5 transition-all duration-200 hover:shadow-sm hover:shadow-black/10 relative ${
                  isMostOpened ? 'border-blue-500/40 hover:border-blue-500/60' : 'border-gray-200/50 hover:border-[#48484A]/60'
                }`}
              >
                {isMostOpened && (
                  <div className="absolute -top-2.5 right-4 px-2.5 py-0.5 bg-blue-500 text-[10px] font-semibold text-white rounded-full">
                    Most Opened
                  </div>
                )}
                <h3 className="text-sm font-semibold text-gray-900 mb-4">{fridge.name}</h3>

                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-3xl font-bold text-gray-900">{fridge.opensToday}</span>
                  <span className="text-xs text-[#86868B]">opens today</span>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#86868B]">Grab Rate</span>
                    <span className="text-sm font-medium text-emerald-400">{fridge.grabRate}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#86868B]">Avg Open</span>
                    <span className="text-sm font-medium text-gray-900">{fridge.avgOpenDuration}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#86868B]">Left-Open</span>
                    <span className={`text-sm font-medium ${fridge.leftOpenAlerts > 0 ? 'text-amber-500' : 'text-[#636366]'}`}>
                      {fridge.leftOpenAlerts > 0 ? (
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                          {fridge.leftOpenAlerts}
                        </span>
                      ) : '0'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
