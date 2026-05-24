import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

interface Scan {
  id: string;
  date: string;
  type: string;
  productsFound: number;
  compliancePercent: number;
  status: string;
}

interface Product {
  id: string;
  name: string;
  category: string;
  location: string;
  imageUrl?: string;
}

const mockScans: Scan[] = [
  { id: '1', date: '2026-05-23 14:30', type: 'Full Store', productsFound: 847, compliancePercent: 94, status: 'Complete' },
  { id: '2', date: '2026-05-22 09:15', type: 'Aisle 1-3', productsFound: 312, compliancePercent: 88, status: 'Complete' },
  { id: '3', date: '2026-05-21 16:45', type: 'Full Store', productsFound: 831, compliancePercent: 91, status: 'Complete' },
  { id: '4', date: '2026-05-20 11:00', type: 'Dairy Section', productsFound: 128, compliancePercent: 96, status: 'Complete' },
];

const mockProducts: Product[] = [
  { id: '1', name: 'Organic Whole Milk', category: 'Dairy', location: 'Aisle 2, Shelf B-2' },
  { id: '2', name: 'Sourdough Bread', category: 'Bakery', location: 'Aisle 5, Shelf E-1' },
  { id: '3', name: 'Hass Avocados', category: 'Produce', location: 'Aisle 1, Shelf A-1' },
  { id: '4', name: 'Sparkling Water 12pk', category: 'Beverages', location: 'Aisle 3, Shelf C-1' },
  { id: '5', name: 'Greek Yogurt (Plain)', category: 'Dairy', location: 'Aisle 2, Shelf B-1' },
  { id: '6', name: 'Granola Bars', category: 'Snacks', location: 'Aisle 4, Shelf D-1' },
  { id: '7', name: 'Baby Spinach', category: 'Produce', location: 'Aisle 1, Shelf A-2' },
  { id: '8', name: 'Cheddar Cheese Block', category: 'Dairy', location: 'Aisle 2, Shelf B-3' },
  { id: '9', name: 'Cold Brew Coffee', category: 'Beverages', location: 'Aisle 3, Shelf C-2' },
  { id: '10', name: 'Trail Mix', category: 'Snacks', location: 'Aisle 4, Shelf D-2' },
  { id: '11', name: 'Almond Butter', category: 'Pantry', location: 'Aisle 6, Shelf F-1' },
  { id: '12', name: 'Fresh Salmon Fillet', category: 'Seafood', location: 'Aisle 7, Shelf G-1' },
];

const overallCompliance = 92;

const steps = [
  {
    number: '1',
    title: 'Open Camera',
    description: 'Launch the scanner from your phone and point it at the shelves',
    icon: (
      <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
      </svg>
    ),
  },
  {
    number: '2',
    title: 'Walk Each Aisle',
    description: 'Slowly walk through each aisle — the camera captures everything automatically',
    icon: (
      <svg className="w-7 h-7 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
      </svg>
    ),
  },
  {
    number: '3',
    title: 'AI Maps Products',
    description: 'Our AI identifies every product and checks planogram compliance instantly',
    icon: (
      <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
      </svg>
    ),
  },
];

export default function ScannerPage() {
  const [scans, setScans] = useState<Scan[]>(mockScans);
  const [products, setProducts] = useState<Product[]>(mockProducts);
  const [searchQuery, setSearchQuery] = useState('');
  const [scanning, setScanning] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [scansRes, productsRes] = await Promise.all([
        api.shelves.scans(),
        api.shelves.products(),
      ]);
      if (scansRes?.data?.length) setScans(scansRes.data);
      if (productsRes?.data?.length) setProducts(productsRes.data);
    } catch {
      // Use mock data
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const startScan = async () => {
    setScanning(true);
    try {
      await api.shelves.startScan();
    } catch {
      // Mock scan
    }
    setTimeout(() => setScanning(false), 3000);
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const complianceColor = overallCompliance >= 90 ? 'text-emerald-400' : overallCompliance >= 70 ? 'text-amber-600' : 'text-red-600';
  const complianceStroke = overallCompliance >= 90 ? 'stroke-emerald-400' : overallCompliance >= 70 ? 'stroke-amber-400' : 'stroke-red-400';

  const circumference = 2 * Math.PI * 54;
  const dashOffset = circumference - (overallCompliance / 100) * circumference;

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-transparent border border-gray-200/50 rounded-2xl p-5 md:p-8 lg:p-10">
        <div className="max-w-2xl">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight mb-3">
            Store Scanner
          </h1>
          <p className="text-base text-[#86868B] leading-relaxed">
            Scan your store with your phone camera to map every product. Our AI automatically identifies items, checks planogram compliance, and builds a complete inventory map.
          </p>
          <button
            onClick={startScan}
            disabled={scanning}
            className={`mt-6 px-6 py-3 text-sm font-semibold rounded-xl transition-all duration-200 active:scale-95 ${
              scanning
                ? 'bg-gray-100 text-[#636366] cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-400 text-gray-900 shadow-sm shadow-blue-500/20'
            }`}
          >
            {scanning ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Scanning...
              </span>
            ) : (
              '⚡ Start New Scan'
            )}
          </button>
        </div>
      </div>

      {/* How It Works */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {steps.map(step => (
            <div
              key={step.number}
              className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-6 transition-all duration-200 hover:border-[#48484A]/60 hover:shadow-sm hover:shadow-black/10 group"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gray-100/50 flex items-center justify-center group-hover:bg-[#48484A]/50 transition-colors duration-200">
                  {step.icon}
                </div>
                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                  <span className="text-xs font-bold text-[#86868B]">{step.number}</span>
                </div>
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">{step.title}</h3>
              <p className="text-xs text-[#86868B] leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent Scans */}
        <div className="xl:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Scans</h2>
          <div className="space-y-3">
            {scans.map(scan => (
              <div
                key={scan.id}
                className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5 transition-all duration-200 hover:border-[#48484A]/60 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-gray-900">{scan.type}</h3>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      scan.status === 'Complete'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-amber-500/15 text-amber-600'
                    }`}>
                      {scan.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#636366]">{scan.date}</p>
                </div>

                <div className="flex items-center gap-6 text-center">
                  <div>
                    <p className="text-lg font-bold text-gray-900">{scan.productsFound}</p>
                    <p className="text-[10px] text-[#636366]">Products</p>
                  </div>
                  <div>
                    <p className={`text-lg font-bold ${
                      scan.compliancePercent >= 90 ? 'text-emerald-400' : scan.compliancePercent >= 70 ? 'text-amber-600' : 'text-red-600'
                    }`}>{scan.compliancePercent}%</p>
                    <p className="text-[10px] text-[#636366]">Compliance</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Planogram Compliance Ring */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Planogram Compliance</h2>
          <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-8 flex flex-col items-center">
            <div className="relative w-36 h-36 mb-4">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle
                  cx="60" cy="60" r="54"
                  fill="none"
                  stroke="#3A3A3C"
                  strokeWidth="8"
                />
                <circle
                  cx="60" cy="60" r="54"
                  fill="none"
                  className={complianceStroke}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  style={{ transition: 'stroke-dashoffset 1s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-bold ${complianceColor}`}>{overallCompliance}%</span>
                <span className="text-[10px] text-[#636366]">Overall</span>
              </div>
            </div>
            <p className="text-xs text-[#86868B] text-center leading-relaxed">
              Based on the latest full-store scan. Products are matched against the expected planogram layout.
            </p>
          </div>

          <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5">
            <div className="space-y-3">
              {[
                { label: 'Correct Position', value: '782', pct: '92%', color: 'bg-emerald-400' },
                { label: 'Wrong Position', value: '41', pct: '5%', color: 'bg-amber-400' },
                { label: 'Missing', value: '24', pct: '3%', color: 'bg-red-400' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${item.color}`} />
                    <span className="text-xs text-[#86868B]">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{item.value}</span>
                    <span className="text-xs text-[#636366]">{item.pct}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Products Discovered */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Products Discovered</h2>
          <div className="relative">
            <svg className="w-4 h-4 text-[#636366] absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="pl-10 pr-4 py-2 bg-white/80 border border-gray-200/50 rounded-xl text-sm text-gray-900 placeholder:text-[#636366] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-all duration-200 w-64"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map(product => (
            <div
              key={product.id}
              className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5 transition-all duration-200 hover:border-[#48484A]/60 hover:shadow-sm hover:shadow-black/10 group"
            >
              {/* Image Placeholder */}
              <div className="w-full h-28 rounded-xl bg-gray-100/40 mb-4 flex items-center justify-center group-hover:bg-gray-100/60 transition-colors duration-200">
                <svg className="w-8 h-8 text-[#636366]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors duration-200">{product.name}</h3>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-[#86868B]">
                  {product.category}
                </span>
              </div>
              <p className="text-[11px] text-[#636366] flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {product.location}
              </p>
            </div>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-12 text-center">
            <p className="text-[#636366] text-sm">No products match your search</p>
          </div>
        )}
      </div>
    </div>
  );
}
