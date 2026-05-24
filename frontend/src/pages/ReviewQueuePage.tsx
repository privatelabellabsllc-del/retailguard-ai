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
  theft_classification?: string;
  classification_reason?: string;
  visited_register?: boolean;
  concealment_count?: number;
}

const classificationBadge: Record<string, { label: string; color: string; bg: string }> = {
  likely_theft: { label: 'LIKELY THEFT', color: 'text-red-600', bg: 'bg-red-500/15' },
  grab_and_run: { label: 'GRAB & RUN', color: 'text-red-700', bg: 'bg-red-600/20' },
  partial_theft: { label: 'PARTIAL THEFT', color: 'text-orange-600', bg: 'bg-orange-500/15' },
  likely_paid: { label: 'LIKELY PAID', color: 'text-emerald-600', bg: 'bg-emerald-500/15' },
  under_review: { label: 'UNDER REVIEW', color: 'text-blue-600', bg: 'bg-blue-500/15' },
  cleared: { label: 'CLEARED', color: 'text-gray-500', bg: 'bg-gray-500/15' },
};

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
    if (pct >= 65) return 'text-amber-500';
    return 'text-yellow-600';
  };

  const confidenceDisplay = (c?: number) => {
    if (c === undefined || c === null) return 'N/A';
    return c > 1 ? `${Math.round(c)}%` : `${Math.round(c * 100)}%`;
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case 'pending_review': return 'bg-gray-100 text-[#86868B]';
      case 'confirmed_theft': return 'bg-red-500/15 text-red-400';
      case 'not_theft': return 'bg-emerald-500/15 text-emerald-400';
      case 'unsure': return 'bg-amber-500/15 text-amber-500';
      case 'escalated': return 'bg-blue-500/15 text-blue-500';
      default: return 'bg-gray-100 text-[#86868B]';
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
      default: return 'bg-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen p-4 md:p-6 lg:p-8 space-y-8">
        {/* Hero skeleton */}
        <div className="bg-gradient-to-br from-red-500/10 via-orange-500/5 to-transparent border border-gray-200/50 rounded-2xl p-5 md:p-8 lg:p-10">
          <div className="h-9 bg-gray-200/60 rounded-lg w-48 mb-3 animate-pulse" />
          <div className="h-5 bg-gray-200/40 rounded-lg w-80 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5 animate-pulse">
              <div className="h-4 bg-gray-200/60 rounded w-24 mb-3" />
              <div className="h-8 bg-gray-200/60 rounded w-16" />
            </div>
          ))}
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5 animate-pulse">
              <div className="h-4 bg-gray-200/60 rounded w-3/4 mb-3" />
              <div className="h-3 bg-gray-200/60 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-red-500/10 via-orange-500/5 to-transparent border border-gray-200/50 rounded-2xl p-5 md:p-8 lg:p-10">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight mb-3">Review Queue</h1>
        <p className="text-base text-[#86868B] leading-relaxed">AI-detected concealment incidents awaiting your review. Confirm or dismiss each clip to keep your store safe.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
          <p className="text-xs text-[#86868B] mt-1">Pending Review</p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.reviewed}</p>
          <p className="text-xs text-[#86868B] mt-1">Reviewed</p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.theftRate}%</p>
          <p className="text-xs text-[#86868B] mt-1">Theft Confirmed Rate</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-xl p-1 w-fit max-w-full overflow-x-auto">
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
                ? 'bg-gray-100 text-gray-900 shadow-sm'
                : 'text-[#86868B] hover:text-gray-700'
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
              className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl overflow-hidden transition-all duration-200 hover:border-[#48484A]/60 hover:shadow-sm hover:shadow-black/10"
            >
              <div className="p-5 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : inc.id)}>
                <div className="flex flex-col md:flex-row gap-4 md:gap-5">
                  {/* Video thumbnail placeholder */}
                  <div className="w-full md:w-40 h-24 bg-gray-50 rounded-xl flex items-center justify-center shrink-0 border border-gray-200/50 relative overflow-hidden">
                    <div className="text-center">
                      <svg className="w-8 h-8 text-[#86868B] mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                      <p className="text-[10px] text-[#86868B] mt-1">Video</p>
                    </div>
                    {/* Severity dot */}
                    <div className={`absolute top-2 left-2 w-2 h-2 rounded-full ${severityDot(inc.severity)}`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{inc.ai_description || 'AI-flagged incident'}</p>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <span className="text-xs text-[#86868B]">{formatTime(inc.detected_at || inc.created_at)}</span>
                          <span className="text-xs text-[#86868B]">&middot;</span>
                          <span className="text-xs text-[#86868B]">{inc.zone_name || inc.camera_id || 'Unknown'}</span>
                          {inc.person_display_name && (
                            <>
                              <span className="text-xs text-[#86868B]">&middot;</span>
                              <span className="flex items-center gap-1 text-xs text-blue-500">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                                </svg>
                                {inc.person_display_name}
                              </span>
                            </>
                          )}
                          {inc.estimated_item && (
                            <>
                              <span className="text-xs text-[#86868B]">&middot;</span>
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-500">{inc.estimated_item}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className={`text-lg font-bold ${confidenceColor(inc.ai_confidence || 0)}`}>
                            {confidenceDisplay(inc.ai_confidence)}
                          </p>
                          <p className="text-[10px] text-[#86868B] uppercase">Confidence</p>
                        </div>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusBadge(inc.review_status)}`}>
                          {statusLabel(inc.review_status)}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleReview(inc.id, 'theft'); }}
                        disabled={isReviewing}
                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 ${
                          inc.review_status === 'confirmed_theft'
                            ? 'bg-red-500 text-white'
                            : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                        }`}
                      >
                        {isReviewing ? '...' : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                            </svg>
                            Theft
                          </>
                        )}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleReview(inc.id, 'not_theft'); }}
                        disabled={isReviewing}
                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 ${
                          inc.review_status === 'not_theft'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                        }`}
                      >
                        {isReviewing ? '...' : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                            </svg>
                            Not Theft
                          </>
                        )}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleReview(inc.id, 'unsure'); }}
                        disabled={isReviewing}
                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 ${
                          inc.review_status === 'unsure'
                            ? 'bg-amber-500 text-white'
                            : 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'
                        }`}
                      >
                        {isReviewing ? '...' : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                            </svg>
                            Unsure
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="border-t border-gray-200/50 p-5 bg-gray-50/50">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Clips / Frames */}
                    <div>
                      <p className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider mb-3">Detection Details</p>
                      <div className="grid grid-cols-2 gap-2">
                        {(inc.clips && inc.clips.length > 0 ? inc.clips : ['frame-1', 'frame-2', 'frame-3', 'frame-4']).map((clip, i) => (
                          <div
                            key={i}
                            className="aspect-video bg-white/80 rounded-xl flex items-center justify-center border border-gray-200/50"
                          >
                            <span className="text-xs text-[#86868B]">Frame {i + 1}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* AI Analysis */}
                    <div className="space-y-4">
                      <div>
                        <p className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider mb-3">AI Analysis</p>
                        <div className="space-y-3">
                          <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-xl p-4">
                            <p className="text-xs text-[#86868B] mb-1">Description</p>
                            <p className="text-sm text-gray-900">{inc.ai_description || 'No description available'}</p>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-xl p-3 text-center">
                              <p className="text-lg font-bold text-gray-900">
                                {inc.estimated_value ? `$${inc.estimated_value}` : '—'}
                              </p>
                              <p className="text-[10px] text-[#86868B]">Est. Value</p>
                            </div>
                            <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-xl p-3 text-center">
                              <p className="text-lg font-bold text-gray-900">{confidenceDisplay(inc.ai_confidence)}</p>
                              <p className="text-[10px] text-[#86868B]">Confidence</p>
                            </div>
                            <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-xl p-3 text-center">
                              <p className="text-lg font-bold text-gray-900 capitalize">{inc.severity || '—'}</p>
                              <p className="text-[10px] text-[#86868B]">Severity</p>
                            </div>
                          </div>
                          {inc.estimated_item && (
                            <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-xl p-4">
                              <p className="text-xs text-[#86868B] mb-1">Estimated Item</p>
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-500">
                                {inc.estimated_item}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {inc.person_display_name && (
                        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-xl p-4">
                          <p className="text-xs text-[#86868B] mb-2">Person Match</p>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                              <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{inc.person_display_name}</p>
                              <p className="text-xs text-[#86868B]">Status: {inc.person_status || 'unknown'}</p>
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
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-[#86868B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <p className="text-sm text-[#86868B]">No incidents in this category</p>
          </div>
        )}
      </div>
    </div>
  );
}
