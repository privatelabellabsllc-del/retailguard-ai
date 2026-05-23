import { useState, useEffect } from 'react';
import api from '../services/api';

interface Incident {
  id: string;
  timestamp: string;
  camera: string;
  confidence: number;
  status: 'pending' | 'theft' | 'not_theft' | 'unsure';
  thumbnailUrl?: string;
  description: string;
  aiAnalysis?: {
    objectsTaken: string[];
    estimatedValue: number;
    behaviorScore: number;
    timeInStore: string;
  };
  personMatch?: {
    name: string;
    matchScore: number;
  };
  frames?: string[];
}

type FilterTab = 'all' | 'pending' | 'theft' | 'not_theft' | 'unsure';

export default function ReviewQueuePage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await api.incidents.list();
      setIncidents(res.data || generateMockIncidents());
    } catch {
      setIncidents(generateMockIncidents());
    } finally {
      setLoading(false);
    }
  };

  const generateMockIncidents = (): Incident[] => {
    const statuses: Incident['status'][] = ['pending', 'pending', 'pending', 'theft', 'not_theft', 'unsure', 'pending', 'theft'];
    const cameras = ['Entrance Cam 1', 'Aisle 3 Cam', 'Checkout Cam 2', 'Electronics Cam', 'Exit Cam 1', 'Stockroom Cam'];
    return Array.from({ length: 16 }, (_, i) => ({
      id: `inc-${i + 1}`,
      timestamp: new Date(Date.now() - i * 3600000 * (1 + Math.random() * 3)).toISOString(),
      camera: cameras[i % cameras.length],
      confidence: 55 + Math.floor(Math.random() * 40),
      status: statuses[i % statuses.length],
      description: [
        'Subject concealed item in jacket pocket near electronics section',
        'Suspicious behavior detected — multiple items handled without purchase',
        'Subject bypassed checkout with unpaid merchandise',
        'Possible tag removal detected at clothing display',
        'Subject placed items in personal bag in cosmetics aisle',
        'Unusual loitering pattern detected near high-value items',
      ][i % 6],
      aiAnalysis: {
        objectsTaken: ['Wireless Earbuds', 'Phone Case', 'USB Cable'].slice(0, 1 + (i % 3)),
        estimatedValue: 25 + Math.floor(Math.random() * 200),
        behaviorScore: 60 + Math.floor(Math.random() * 35),
        timeInStore: `${5 + Math.floor(Math.random() * 25)} min`,
      },
      personMatch: i % 3 === 0 ? { name: `Person-${100 + i}`, matchScore: 70 + Math.floor(Math.random() * 25) } : undefined,
      frames: Array.from({ length: 4 }, (_, j) => `frame-${i}-${j}`),
    }));
  };

  const handleClassify = (id: string, status: 'theft' | 'not_theft' | 'unsure') => {
    setIncidents(prev => prev.map(inc => inc.id === id ? { ...inc, status } : inc));
  };

  const filtered = activeTab === 'all' ? incidents : incidents.filter(i => i.status === activeTab);
  const stats = {
    pending: incidents.filter(i => i.status === 'pending').length,
    reviewedToday: incidents.filter(i => i.status !== 'pending').length,
    theftRate: incidents.length > 0
      ? Math.round((incidents.filter(i => i.status === 'theft').length / Math.max(incidents.filter(i => i.status !== 'pending').length, 1)) * 100)
      : 0,
  };

  const confidenceColor = (c: number) => {
    if (c >= 80) return 'text-red-400';
    if (c >= 65) return 'text-orange-400';
    return 'text-yellow-400';
  };

  const statusBadge = (s: Incident['status']) => {
    switch (s) {
      case 'pending': return 'bg-gray-500/15 text-gray-400';
      case 'theft': return 'bg-red-500/15 text-red-400';
      case 'not_theft': return 'bg-green-500/15 text-green-400';
      case 'unsure': return 'bg-yellow-500/15 text-yellow-400';
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Review Queue</h1>
        <p className="text-sm text-gray-400 mt-1">Classify AI-flagged incidents</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Pending Review', value: stats.pending, color: 'text-yellow-400', icon: '⏳' },
          { label: 'Reviewed Today', value: stats.reviewedToday, color: 'text-blue-400', icon: '✅' },
          { label: 'Theft Confirmed Rate', value: `${stats.theftRate}%`, color: 'text-red-400', icon: '📊' },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-[#2C2C2E]/80 backdrop-blur-xl rounded-2xl p-5 border border-white/5"
          >
            <div className="flex items-center gap-2 mb-2">
              <span>{s.icon}</span>
              <span className="text-xs text-gray-400 uppercase tracking-wider">{s.label}</span>
            </div>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 bg-[#2C2C2E]/60 backdrop-blur-xl rounded-xl p-1 w-fit">
        {([
          { key: 'all', label: 'All' },
          { key: 'pending', label: 'Pending' },
          { key: 'theft', label: 'Theft' },
          { key: 'not_theft', label: 'Not Theft' },
          { key: 'unsure', label: 'Unsure' },
        ] as { key: FilterTab; label: string }[]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === tab.key
                ? 'bg-[#3A3A3C] text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            {tab.label}
            {tab.key !== 'all' && (
              <span className="ml-1.5 text-xs opacity-60">
                {incidents.filter(i => tab.key === 'all' ? true : i.status === tab.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Incident Cards */}
      <div className="space-y-4">
        {filtered.map((inc) => {
          const isExpanded = expandedId === inc.id;
          return (
            <div
              key={inc.id}
              className="bg-[#2C2C2E]/80 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden transition-all duration-300 hover:border-white/10"
            >
              <div
                className="p-5 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : inc.id)}
              >
                <div className="flex gap-5">
                  {/* Video thumbnail placeholder */}
                  <div className="w-40 h-24 bg-[#1C1C1E] rounded-xl flex items-center justify-center shrink-0 border border-white/5">
                    <div className="text-center">
                      <svg className="w-8 h-8 text-gray-600 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <p className="text-[10px] text-gray-600 mt-1">Video</p>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium text-white">{inc.description}</p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-xs text-gray-400">{formatTime(inc.timestamp)}</span>
                          <span className="text-xs text-gray-500">•</span>
                          <span className="text-xs text-gray-400">{inc.camera}</span>
                          {inc.personMatch && (
                            <>
                              <span className="text-xs text-gray-500">•</span>
                              <span className="text-xs text-purple-400">🔗 {inc.personMatch.name}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className={`text-lg font-bold ${confidenceColor(inc.confidence)}`}>{inc.confidence}%</p>
                          <p className="text-[10px] text-gray-500 uppercase">Confidence</p>
                        </div>
                        <span className={`px-2.5 py-0.5 text-xs rounded-full font-medium ${statusBadge(inc.status)}`}>
                          {inc.status === 'not_theft' ? 'Not Theft' : inc.status.charAt(0).toUpperCase() + inc.status.slice(1)}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleClassify(inc.id, 'theft'); }}
                        className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 active:scale-95 ${
                          inc.status === 'theft'
                            ? 'bg-red-500 text-white'
                            : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                        }`}
                      >
                        🚨 Theft
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleClassify(inc.id, 'not_theft'); }}
                        className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 active:scale-95 ${
                          inc.status === 'not_theft'
                            ? 'bg-green-500 text-white'
                            : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                        }`}
                      >
                        ✅ Not Theft
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleClassify(inc.id, 'unsure'); }}
                        className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 active:scale-95 ${
                          inc.status === 'unsure'
                            ? 'bg-yellow-500 text-white'
                            : 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20'
                        }`}
                      >
                        🤔 Unsure
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="border-t border-white/5 p-5 bg-[#1C1C1E]/40 animate-in">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Frames */}
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Captured Frames</p>
                      <div className="grid grid-cols-2 gap-2">
                        {(inc.frames || []).map((frame, i) => (
                          <div
                            key={frame}
                            className="aspect-video bg-[#2C2C2E] rounded-xl flex items-center justify-center border border-white/5"
                          >
                            <span className="text-xs text-gray-600">Frame {i + 1}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* AI Analysis */}
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">AI Analysis</p>
                        {inc.aiAnalysis && (
                          <div className="space-y-3">
                            <div className="bg-[#2C2C2E]/60 rounded-xl p-4">
                              <p className="text-xs text-gray-400 mb-1">Objects Detected</p>
                              <div className="flex flex-wrap gap-1.5">
                                {inc.aiAnalysis.objectsTaken.map((obj) => (
                                  <span key={obj} className="px-2.5 py-0.5 bg-blue-500/10 text-blue-400 text-xs rounded-full">
                                    {obj}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="bg-[#2C2C2E]/60 rounded-xl p-3 text-center">
                                <p className="text-lg font-bold text-white">${inc.aiAnalysis.estimatedValue}</p>
                                <p className="text-[10px] text-gray-500">Est. Value</p>
                              </div>
                              <div className="bg-[#2C2C2E]/60 rounded-xl p-3 text-center">
                                <p className="text-lg font-bold text-white">{inc.aiAnalysis.behaviorScore}%</p>
                                <p className="text-[10px] text-gray-500">Behavior</p>
                              </div>
                              <div className="bg-[#2C2C2E]/60 rounded-xl p-3 text-center">
                                <p className="text-lg font-bold text-white">{inc.aiAnalysis.timeInStore}</p>
                                <p className="text-[10px] text-gray-500">Time in Store</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {inc.personMatch && (
                        <div className="bg-[#2C2C2E]/60 rounded-xl p-4">
                          <p className="text-xs text-gray-400 mb-2">Person Match</p>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                              <span className="text-sm">👤</span>
                            </div>
                            <div>
                              <p className="text-sm text-white font-medium">{inc.personMatch.name}</p>
                              <p className="text-xs text-gray-400">Match score: {inc.personMatch.matchScore}%</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-500 text-sm">No incidents in this category</p>
          </div>
        )}
      </div>
    </div>
  );
}
