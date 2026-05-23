import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

interface Shelf {
  id: string;
  name: string;
  aisle: string;
  section: string;
  stockLevel: number;
  status: string;
  lastChecked: string;
}

interface OutOfStockAlert {
  id: string;
  shelfName: string;
  productName: string;
  duration: string;
  estimatedLostRevenue: number;
  since: string;
}

const mockShelves: Shelf[] = [
  { id: '1', name: 'Shelf A-1', aisle: 'Aisle 1', section: 'Produce', stockLevel: 92, status: 'Stocked', lastChecked: '2 min ago' },
  { id: '2', name: 'Shelf A-2', aisle: 'Aisle 1', section: 'Produce', stockLevel: 65, status: 'Low Stock', lastChecked: '5 min ago' },
  { id: '3', name: 'Shelf B-1', aisle: 'Aisle 2', section: 'Dairy', stockLevel: 18, status: 'Critical', lastChecked: '1 min ago' },
  { id: '4', name: 'Shelf B-2', aisle: 'Aisle 2', section: 'Dairy', stockLevel: 100, status: 'Stocked', lastChecked: '8 min ago' },
  { id: '5', name: 'Shelf C-1', aisle: 'Aisle 3', section: 'Beverages', stockLevel: 45, status: 'Low Stock', lastChecked: '3 min ago' },
  { id: '6', name: 'Shelf C-2', aisle: 'Aisle 3', section: 'Beverages', stockLevel: 0, status: 'Empty', lastChecked: '12 min ago' },
  { id: '7', name: 'Shelf D-1', aisle: 'Aisle 4', section: 'Snacks', stockLevel: 78, status: 'Stocked', lastChecked: '6 min ago' },
  { id: '8', name: 'Shelf D-2', aisle: 'Aisle 4', section: 'Snacks', stockLevel: 33, status: 'Low Stock', lastChecked: '4 min ago' },
];

const mockAlerts: OutOfStockAlert[] = [
  { id: '1', shelfName: 'Shelf C-2', productName: 'Organic Almond Milk', duration: '3h 24m', estimatedLostRevenue: 284.50, since: '12:11 PM' },
  { id: '2', shelfName: 'Shelf B-1', productName: 'Greek Yogurt (Vanilla)', duration: '1h 48m', estimatedLostRevenue: 156.20, since: '1:47 PM' },
  { id: '3', shelfName: 'Shelf A-2', productName: 'Avocados (Hass)', duration: '0h 32m', estimatedLostRevenue: 67.80, since: '3:03 PM' },
];

export default function ShelvesPage() {
  const [shelves, setShelves] = useState<Shelf[]>(mockShelves);
  const [alerts, setAlerts] = useState<OutOfStockAlert[]>(mockAlerts);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newShelf, setNewShelf] = useState({ name: '', aisle: '', section: '' });

  const fetchData = useCallback(async () => {
    try {
      const [shelvesRes, alertsRes] = await Promise.all([
        api.shelves.list(),
        api.shelves.outOfStock(),
      ]);
      if (shelvesRes?.data?.length) setShelves(shelvesRes.data);
      if (alertsRes?.data?.length) setAlerts(alertsRes.data);
    } catch {
      // Use mock data
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalShelves = shelves.length;
  const stocked = shelves.filter(s => s.stockLevel > 70).length;
  const lowStock = shelves.filter(s => s.stockLevel > 0 && s.stockLevel <= 70).length;
  const empty = shelves.filter(s => s.stockLevel === 0).length;
  const totalLostRevenue = alerts.reduce((sum, a) => sum + a.estimatedLostRevenue, 0);

  const getStockColor = (level: number) => {
    if (level > 70) return { bar: 'bg-emerald-500', dot: 'bg-emerald-400' };
    if (level > 30) return { bar: 'bg-amber-500', dot: 'bg-amber-400' };
    return { bar: 'bg-red-500', dot: 'bg-red-400' };
  };

  const resolveAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const handleAddShelf = () => {
    if (!newShelf.name) return;
    const shelf: Shelf = {
      id: String(Date.now()),
      name: newShelf.name,
      aisle: newShelf.aisle || 'Unassigned',
      section: newShelf.section || 'General',
      stockLevel: 100,
      status: 'Stocked',
      lastChecked: 'Just now',
    };
    setShelves(prev => [...prev, shelf]);
    setNewShelf({ name: '', aisle: '', section: '' });
    setShowAddModal(false);
  };

  const summaryCards = [
    { label: 'Total Shelves', value: totalShelves, color: 'bg-blue-400' },
    { label: 'Stocked', value: stocked, color: 'bg-emerald-400' },
    { label: 'Low Stock', value: lowStock, color: 'bg-amber-400' },
    { label: 'Empty', value: empty, color: 'bg-red-400' },
  ];

  return (
    <div className="min-h-screen p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Shelf Monitor</h1>
          <p className="text-sm text-[#86868B] mt-1">Real-time shelf inventory and out-of-stock tracking</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-5 py-2.5 bg-blue-500 hover:bg-blue-400 text-gray-900 text-sm font-medium rounded-xl transition-all duration-200 active:scale-95"
        >
          + Add Shelf
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map(card => (
          <div
            key={card.label}
            className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5 transition-all duration-200 hover:border-[#48484A]/60"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-2 h-2 rounded-full ${card.color}`} />
              <span className="text-xs text-[#86868B] font-medium uppercase tracking-wide">{card.label}</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Shelf Grid */}
        <div className="xl:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">All Shelves</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {shelves.map(shelf => {
              const colors = getStockColor(shelf.stockLevel);
              return (
                <div
                  key={shelf.id}
                  className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5 transition-all duration-200 hover:border-[#48484A]/60 hover:shadow-sm hover:shadow-black/10 group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors duration-200">{shelf.name}</h3>
                      <p className="text-xs text-[#86868B] mt-0.5">{shelf.aisle} · {shelf.section}</p>
                    </div>
                    <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full ${
                      shelf.stockLevel > 70
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : shelf.stockLevel > 30
                        ? 'bg-amber-500/15 text-amber-600'
                        : shelf.stockLevel > 0
                        ? 'bg-red-500/15 text-red-600'
                        : 'bg-red-500/20 text-red-600'
                    }`}>
                      {shelf.status}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-[#86868B]">Stock Level</span>
                      <span className="text-xs font-medium text-gray-900">{shelf.stockLevel}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${colors.bar} transition-all duration-500`}
                        style={{ width: `${shelf.stockLevel}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <svg className="w-3 h-3 text-[#636366]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-[11px] text-[#636366]">Checked {shelf.lastChecked}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Out of Stock Alerts */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Out of Stock Alerts</h2>

          {/* Total Lost Revenue */}
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5">
            <p className="text-xs text-red-600/70 font-medium uppercase tracking-wide mb-1">Est. Lost Revenue</p>
            <p className="text-2xl font-bold text-red-600">${totalLostRevenue.toFixed(2)}</p>
            <p className="text-[11px] text-red-600/50 mt-1">{alerts.length} active alert{alerts.length !== 1 ? 's' : ''}</p>
          </div>

          {/* Alert List */}
          <div className="space-y-3">
            {alerts.length === 0 && (
              <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-8 text-center">
                <p className="text-[#636366] text-sm">All shelves stocked ✓</p>
              </div>
            )}
            {alerts.map(alert => (
              <div
                key={alert.id}
                className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-4 transition-all duration-200 hover:border-[#48484A]/60"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                    <span className="text-sm font-medium text-gray-900">{alert.shelfName}</span>
                  </div>
                  <span className="text-xs text-[#636366]">{alert.duration}</span>
                </div>
                <p className="text-xs text-[#86868B] mb-3 pl-4">{alert.productName}</p>
                <div className="flex items-center justify-between pl-4">
                  <span className="text-sm font-semibold text-red-600">-${alert.estimatedLostRevenue.toFixed(2)}</span>
                  <button
                    onClick={() => resolveAlert(alert.id)}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-medium px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition-all duration-200 active:scale-95"
                  >
                    Resolve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Shelf Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-md shadow-lg animate-in">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Add New Shelf</h3>
            <p className="text-sm text-[#86868B] mb-6">Enter shelf details to begin monitoring</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-[#86868B] font-medium mb-1.5 block">Shelf Name</label>
                <input
                  type="text"
                  value={newShelf.name}
                  onChange={e => setNewShelf(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Shelf E-1"
                  className="w-full px-4 py-2.5 bg-[#F5F5F7] border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-[#636366] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-all duration-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#86868B] font-medium mb-1.5 block">Aisle</label>
                  <input
                    type="text"
                    value={newShelf.aisle}
                    onChange={e => setNewShelf(p => ({ ...p, aisle: e.target.value }))}
                    placeholder="Aisle 1"
                    className="w-full px-4 py-2.5 bg-[#F5F5F7] border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-[#636366] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#86868B] font-medium mb-1.5 block">Section</label>
                  <input
                    type="text"
                    value={newShelf.section}
                    onChange={e => setNewShelf(p => ({ ...p, section: e.target.value }))}
                    placeholder="Produce"
                    className="w-full px-4 py-2.5 bg-[#F5F5F7] border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-[#636366] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-all duration-200"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm text-[#86868B] hover:text-gray-900 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleAddShelf}
                className="px-5 py-2.5 bg-blue-500 hover:bg-blue-400 text-gray-900 text-sm font-medium rounded-xl transition-all duration-200 active:scale-95"
              >
                Add Shelf
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
