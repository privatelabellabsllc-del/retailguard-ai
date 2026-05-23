import { useState, useEffect } from 'react';
import { incidents as incidentsApi } from '../services/api';

interface Incident {
  id: string;
  created_at: string;
  person_id?: string;
  person_display_name?: string;
  person_status?: string;
  incident_type?: string;
  severity?: string;
  review_status: string;
  camera_id?: string;
  zone_name?: string;
  ai_confidence?: number;
  ai_description?: string;
  detected_at?: string;
  estimated_item?: string;
  estimated_value?: number;
  clips?: string[];
  detection_details?: any;
}

type FilterTab = 'all' | 'pending_review' | 'confirmed_theft' | 'not_theft' | 'unsure';

export default function ReviewQueuePage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await incidentsApi.list();
      if (Array.isArray(data) && data.length > 0) {
        setIncidents(data);
      } else {
        setIncidents(generateMockIncidents());
      }
    } catch {
      setIncidents(generateMockIncidents());
    } finally {
      setLoading(false);
    }
  };

  const generateMockIncidents = (): Incident[] => {
    const statuses = ['pending_review', 'pending_review', 'pending_review', 'confirmed_theft', 'not_theft', 'unsure', 'pending_review', 'confirmed_theft'];
    const cameras = ['cam-entrance', 'cam-aisle3', 'cam-checkout', 'cam-electronics', 'cam-exit', 'cam-stock'];
    return Array.from({ length: 12 }, (_, i) => ({
      id: `mock-inc-${i + 1}`,
      created_at: new Date(Date.now() - i * 3600000 * (1 + Math.random() * 3)).toISOString(),
      person_display_name: i % 3 === 0 ? `Person-${100 + i}` : undefined,
      severity: ['critical', 'high', 'medium', 'low'][i % 4],
      review_status: statuses[i % statuses.length],
      camera_id: cameras[i % cameras.length],
      zone_name: ['Electronics', 'Clothing', 'Cosmetics', 'Exit'][i % 4],
      ai_confidence: 0.55 + Math.random() * 0.4,
      ai_description: [
        'Subject concealed item in jacket pocket near electronics section',
        'Suspicious behavior detected — multiple items handled without purchase',
        'Subject bypassed checkout with unpaid merchandise',
        'Possible tag removal detected at clothing display',
      ][i % 4],
      detected_at: new Date(Date.now() - i * 3600000).toISOString(),
      estimated_item: ['Wireless Earbuds', 'Phone Case', 'Lipstick Set', 'USB Cable'][i % 4],
      estimated_value: 25 + Math.floor(Math.random() * 200),
    }));
  };

  const handleReview = async (id: string, action: 'theft' | 'not_theft' | 'unsure') => {
    setReviewingId(id);
    try {
      await incidentsApi.review(id, action);
      // Update local state optimistically
      setIncidents(prev => prev.map(inc =>
        inc.id === id
          ? { ...inc, review_status: action === 'theft' ? 'confirmed_theft' : action }
          : inc
      ));
      // Re-fetch to sync
      const data = await incidentsApi.list();
      if (Array.isArray(data) && data.length > 0) {
        setIncidents(data);
      }
    } catch {
      // Optimistic update stays
      setIncidents(prev => prev.map(inc =>
        inc.id === id
          ? { ...inc, review_status: action === 'theft' ? 'confirmed_theft' : action }
          : inc
      ));
    } finally {
      setReviewingId(null);
    }
  };

  const filtered = activeTab === 'all' ? incidents : incidents.filter(i => i.review_status === activeTab);
  const counts = {
    all: incidents.length,
    pending_review: incidents.filter(i => i.review_status === 'pending_review').length,
    confirmed_theft: incidents.filter(i => i.review_status === 'confirmed_theft').length,
    not_theft: incidents.filter(i => i.review_status === 'not_theft').length,
    unsure: incidents.filter(i => i.review_status === 'unsure').length,
  };

  const stats = {
    pending: counts.pending_review,
    reviewed: incidents.filter(i => i.review_status !== 'pending_review').length,
    theftRate: incidents.length > 0
      ? Math.round((counts.confirmed_theft / Math.max(incidents.filter(i => i.review_status !== 'pending_review').length, 1)) * 100)
      : 0,
  };

  const confidenceColor = (c: number) => {
    const pct = c > 1 ? c : c * 100;
    if (pct >= 80) return 'text-red-400';
    if (pct >= 65) return 'text-orange-400';
    return 'text-yellow-400';
  };

  const confidenceDisplay = (c?: number) => {
    if (c === undefined || c === null) return 'N/A';
    return c > 1 ? `${Math.round(c)}%` : `${Math.round(c * 100)}%`;
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case 'pending_review': return 'bg-gray-500/15 text-gray-400';
      case 'confirmed_theft': return 'bg-red-500/15 text-red-400';
      case 'not_theft': return 'bg-green-500/15 text-green-400';
      case 'unsure': return 'bg-yellow-500/15 text-yellow-400';
      case 'escalated': return 'bg-purple-500/15 text-purple-400';
      default: return 'bg-gray-500/15 text-gray-400';
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'pending_review': return 'Pending';
      case 'confirmed_theft': return 'Theft';
      case 'not_theft': return 'Not Theft';
      case 'unsure': return 'Unsure';
      case 'escalated': return 'Escalated';
      default: return s;
    }
  };

  const formatTime = (iso?: string) => {
    if (!iso) return 'Unknown';
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const severityDot = (sev?: string) => {
    switch (sev) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-400';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6 max-w-[1400px] mx-auto">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Review Queue</h1>
          <p className="text-sm text-gray-400 mt-1">Classify AI-flagged incidents</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-[#2C2C2E]/80 backdrop-blur-xl rounded-2xl p-5 border border-white/5 animate-pulse">
              <div className="h-4 bg-white/10 rounded w-24 mb-3" />
              <div className="h-8 bg-white/10 rounded w-16" />
            </div>
          ))}
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-[#2C2C2E]/80 backdrop-blur-xl rounded-2xl p-5 border border-white/5 animate-pulse">
              <div className="h-4 bg-white/10 rounded w-3/4 mb-3" />
              <div className="h-3 bg-white/10 rounded w-1/2" />
            </div>
          ))}
        </div>
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
          { label: 'Reviewed', value: stats.reviewed, color: 'text-blue-400', icon: '✅' },
          { label: 'Theft Confirmed Rate', value: `${stats.theftRate}%`, color: 'text-red-400', icon: '📊' },
        ].map((s) => (
          <div key={s.label} className="bg-[#2C2C2E]/80 backdrop-blur-xl rounded-2xl p-5 border border-white/5">
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
          { key: 'pending_review', label: 'Pending' },
          { key: 'confirmed_theft', label: 'Theft' },
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
            <span className="ml-1.5 text-xs opacity-60">{counts[tab.key]}</span>
          </button>
        ))}
      </div>

      {/* Incident Cards */}
      <div className="space-y-4">
        {filtered.map((inc) => {
          const isExpanded = expandedId === inc.id;
          const isReviewing = reviewingId === inc.id;
          return (
            <div
              key={inc.id}
              className="bg-[#2C2C2E]/80 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden transition-all duration-300 hover:border-white/10"
            >
              <div className="p-5 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : inc.id)}>
                <div className="flex gap-5">
                  {/* Video thumbnail placeholder */}
                  <div className="w-40 h-24 bg-[#1C1C1E] rounded-xl flex items-center justify-center shrink-0 border border-white/5 relative overflow-hidden">
                    <div className="text-center">
                      <svg className="w-8 h-8 text-gray-600 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <p className="text-[10px] text-gray-600 mt-1">Video</p>
                    </div>
                    {/* Severity dot */}
                    <div className={`absolute top-2 left-2 w-2 h-2 rounded-full ${severityDot(inc.severity)}`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium text-white">{inc.ai_description || 'AI-flagged incident'}</p>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <span className="text-xs text-gray-400">{formatTime(inc.detected_at || inc.created_at)}</span>
                          <span className="text-xs text-gray-500">•</span>
                          <span className="text-xs text-gray-400">{inc.zone_name || inc.camera_id || 'Unknown'}</span>
                          {inc.person_display_name && (
                            <>
                              <span className="text-xs text-gray-500">•</span>
                              <span className="text-xs text-purple-400">🔗 {inc.person_display_name}</span>
                            </>
                          )}
                          {inc.estimated_item && (
                            <>
                              <span className="text-xs text-gray-500">•</span>
                              <span className="text-xs text-blue-400">📦 {inc.estimated_item}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className={`text-lg font-bold ${confidenceColor(inc.ai_confidence || 0)}`}>
                            {confidenceDisplay(inc.ai_confidence)}
                          </p>
                          <p className="text-[10px] text-gray-500 uppercase">Confidence</p>
                        </div>
                        <span className={`px-2.5 py-0.5 text-xs rounded-full font-medium ${statusBadge(inc.review_status)}`}>
                          {statusLabel(inc.review_status)}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleReview(inc.id, 'theft'); }}
                        disabled={isReviewing}
                        className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 ${
                          inc.review_status === 'confirmed_theft'
                            ? 'bg-red-500 text-white'
                            : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                        }`}
                      >
                        {isReviewing ? '...' : '🚨 Theft'}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleReview(inc.id, 'not_theft'); }}
                        disabled={isReviewing}
                        className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 ${
                          inc.review_status === 'not_theft'
                            ? 'bg-green-500 text-white'
                            : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                        }`}
                      >
                        {isReviewing ? '...' : '✅ Not Theft'}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleReview(inc.id, 'unsure'); }}
                        disabled={isReviewing}
                        className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 ${
                          inc.review_status === 'unsure'
                            ? 'bg-yellow-500 text-white'
                            : 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20'
                        }`}
                      >
                        {isReviewing ? '...' : '🤔 Unsure'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="border-t border-white/5 p-5 bg-[#1C1C1E]/40">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Clips / Frames */}
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Detection Details</p>
                      <div className="grid grid-cols-2 gap-2">
                        {(inc.clips && inc.clips.length > 0 ? inc.clips : ['frame-1', 'frame-2', 'frame-3', 'frame-4']).map((clip, i) => (
                          <div
                            key={i}
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
                        <div className="space-y-3">
                          <div className="bg-[#2C2C2E]/60 rounded-xl p-4">
                            <p className="text-xs text-gray-400 mb-1">Description</p>
                            <p className="text-sm text-white/80">{inc.ai_description || 'No description available'}</p>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-[#2C2C2E]/60 rounded-xl p-3 text-center">
                              <p className="text-lg font-bold text-white">
                                {inc.estimated_value ? `$${inc.estimated_value}` : '—'}
                              </p>
                              <p className="text-[10px] text-gray-500">Est. Value</p>
                            </div>
                            <div className="bg-[#2C2C2E]/60 rounded-xl p-3 text-center">
                              <p className="text-lg font-bold text-white">{confidenceDisplay(inc.ai_confidence)}</p>
                              <p className="text-[10px] text-gray-500">Confidence</p>
                            </div>
                            <div className="bg-[#2C2C2E]/60 rounded-xl p-3 text-center">
                              <p className="text-lg font-bold text-white capitalize">{inc.severity || '—'}</p>
                              <p className="text-[10px] text-gray-500">Severity</p>
                            </div>
                          </div>
                          {inc.estimated_item && (
                            <div className="bg-[#2C2C2E]/60 rounded-xl p-4">
                              <p className="text-xs text-gray-400 mb-1">Estimated Item</p>
                              <span className="px-2.5 py-0.5 bg-blue-500/10 text-blue-400 text-xs rounded-full">
                                {inc.estimated_item}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {inc.person_display_name && (
                        <div className="bg-[#2C2C2E]/60 rounded-xl p-4">
                          <p className="text-xs text-gray-400 mb-2">Person Match</p>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                              <span className="text-sm">👤</span>
                            </div>
                            <div>
                              <p className="text-sm text-white font-medium">{inc.person_display_name}</p>
                              <p className="text-xs text-gray-400">Status: {inc.person_status || 'unknown'}</p>
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
            <span className="text-4xl mb-3 block">📋</span>
            <p className="text-gray-500 text-sm">No incidents in this category</p>
          </div>
        )}
      </div>
    </div>
  );
}
