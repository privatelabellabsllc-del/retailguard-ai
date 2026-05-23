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

  return (
    <div className="min-h-screen p-6 lg:p-8 space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-teal-500/10 via-emerald-500/5 to-transparent border border-gray-200/50 rounded-2xl p-8 lg:p-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight mb-3">Shelves</h1>
            <p className="text-base text-[#86868B] leading-relaxed">Monitor shelf stock levels and out-of-stock alerts in real time. AI detects empty shelves and notifies your team automatically.</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 text-sm font-semibold rounded-xl bg-blue-500 hover:bg-blue-400 text-white shadow-sm shadow-blue-500/20 transition-all duration-200 active:scale-95 flex items-center gap-2 shrink-0 ml-6"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Shelf
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalShelves}</p>
          <p className="text-xs text-[#86868B] mt-1">Total Shelves</p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stocked}</p>
          <p className="text-xs text-[#86868B] mt-1">Stocked</p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{lowStock}</p>
          <p className="text-xs text-[#86868B] mt-1">Low Stock</p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{empty}</p>
          <p className="text-xs text-[#86868B] mt-1">Empty</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Shelf Grid */}
        <div className="xl:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">All Shelves</h2>
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
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      shelf.stockLevel > 70
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : shelf.stockLevel > 30
                        ? 'bg-amber-500/15 text-amber-500'
                        : shelf.stockLevel > 0
                        ? 'bg-red-500/15 text-red-400'
                        : 'bg-red-500/15 text-red-400'
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
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
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
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Out of Stock Alerts</h2>

          {/* Total Lost Revenue */}
          <div className="bg-white/80 backdrop-blur-xl border border-red-200/50 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                </svg>
              </div>
            </div>
            <p className="text-2xl font-bold text-red-600">${totalLostRevenue.toFixed(2)}</p>
            <p className="text-xs text-[#86868B] mt-1">Est. Lost Revenue · {alerts.length} active alert{alerts.length !== 1 ? 's' : ''}</p>
          </div>

          {/* Alert List */}
          <div className="space-y-3">
            {alerts.length === 0 && (
              <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-8 text-center">
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                  <p className="text-[#636366] text-sm">All shelves stocked</p>
                </div>
              </div>
            )}
            {alerts.map(alert => (
              <div
                key={alert.id}
                className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-4 transition-all duration-200 hover:border-[#48484A]/60 hover:shadow-sm hover:shadow-black/10"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                    <span className="text-sm font-semibold text-gray-900">{alert.shelfName}</span>
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200/50 rounded-2xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
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
                  className="w-full px-4 py-2.5 bg-white/80 border border-gray-200/50 rounded-xl text-sm text-gray-900 placeholder:text-[#636366] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-all duration-200"
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
                    className="w-full px-4 py-2.5 bg-white/80 border border-gray-200/50 rounded-xl text-sm text-gray-900 placeholder:text-[#636366] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#86868B] font-medium mb-1.5 block">Section</label>
                  <input
                    type="text"
                    value={newShelf.section}
                    onChange={e => setNewShelf(p => ({ ...p, section: e.target.value }))}
                    placeholder="Produce"
                    className="w-full px-4 py-2.5 bg-white/80 border border-gray-200/50 rounded-xl text-sm text-gray-900 placeholder:text-[#636366] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-all duration-200"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm font-medium rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleAddShelf}
                className="px-6 py-3 text-sm font-semibold rounded-xl bg-blue-500 hover:bg-blue-400 text-white shadow-sm shadow-blue-500/20 transition-all duration-200 active:scale-95"
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
