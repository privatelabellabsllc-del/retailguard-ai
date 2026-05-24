import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

interface MetricData {
  label: string;
  value: string;
  trend: number; // positive = up, negative = down
  bars: number[]; // 0-100 for sparkline
}

interface Review {
  id: string;
  weekOf: string;
  status: 'pending' | 'approved' | 'sent' | 'rejected';
  overallScore: number;
  scores: Record<string, number>;
  highlights: string[];
  improvements: string[];
  aiSummary: string;
}

interface ClerkOption {
  id: string;
  fullName: string;
}

interface PerformanceData {
  overallScore: number;
  metrics: MetricData[];
}

const statusBadge: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-amber-500/15', text: 'text-amber-500' },
  approved: { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  sent: { bg: 'bg-blue-500/15', text: 'text-blue-500' },
  rejected: { bg: 'bg-red-500/15', text: 'text-red-400' },
};

function ScoreRing({ score, size = 160 }: { score: number; size?: number }) {
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score < 50 ? '#EF4444' : score < 75 ? '#EAB308' : '#22C55E';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          opacity={0.3}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold tracking-tight" style={{ color }}>
          {score}
        </span>
        <span className="text-xs text-[#86868B] mt-0.5">Overall</span>
      </div>
    </div>
  );
}

function Sparkline({ bars }: { bars: number[] }) {
  const max = Math.max(...bars, 1);
  return (
    <div className="flex items-end gap-[2px] h-8">
      {bars.map((v, i) => (
        <div
          key={i}
          className="w-1.5 rounded-full bg-violet-400/60 transition-all duration-300"
          style={{ height: `${(v / max) * 100}%`, minHeight: '2px' }}
        />
      ))}
    </div>
  );
}

function TrendArrow({ value }: { value: number }) {
  if (value === 0) return <span className="text-[#86868B] text-xs">—</span>;
  const isUp = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isUp ? 'text-emerald-500' : 'text-red-500'}`}>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={isUp ? '' : 'rotate-180'}>
        <path d="M5 2l3.5 5H1.5L5 2z" fill="currentColor" />
      </svg>
      {Math.abs(value)}%
    </span>
  );
}

export default function PerformancePage() {
  const [clerks, setClerks] = useState<ClerkOption[]>([]);
  const [selectedClerkId, setSelectedClerkId] = useState<string>('');
  const [perfData, setPerfData] = useState<PerformanceData | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [expandedReview, setExpandedReview] = useState<string | null>(null);
  const [autoSendMode, setAutoSendMode] = useState<'manual' | 'auto_good' | 'full_auto'>('manual');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchClerks = useCallback(async () => {
    try {
      const res = await api.team.members();
      const members = res.data || res;
      const clerkList = members
        .filter((m: any) => m.role === 'clerk' || m.role === 'manager')
        .map((m: any) => ({ id: m.id, fullName: m.fullName }));
      setClerks(clerkList);
      if (clerkList.length > 0 && !selectedClerkId) {
        setSelectedClerkId(clerkList[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch clerks', err);
    }
  }, [selectedClerkId]);

  const fetchPerformance = useCallback(async () => {
    if (!selectedClerkId) return;
    try {
      setLoading(true);
      const [perfRes, reviewRes] = await Promise.all([
        api.team.performance(selectedClerkId),
        api.team.reviews(selectedClerkId),
      ]);
      setPerfData(perfRes.data || perfRes);
      setReviews(reviewRes.data || reviewRes);
    } catch (err) {
      console.error('Failed to fetch performance', err);
    } finally {
      setLoading(false);
    }
  }, [selectedClerkId]);

  useEffect(() => {
    fetchClerks();
  }, [fetchClerks]);

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  const handleReviewAction = async (reviewId: string, action: 'approve' | 'reject') => {
    setActionLoading(reviewId);
    try {
      await api.team.reviewAction(reviewId, action);
      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId ? { ...r, status: action === 'approve' ? 'approved' : 'rejected' } : r
        )
      );
    } catch (err) {
      console.error(`Failed to ${action} review`, err);
    } finally {
      setActionLoading(null);
    }
  };

  const autoModeLabels = {
    manual: 'Manual',
    auto_good: 'Auto Good',
    full_auto: 'Full Auto',
  };

  const defaultMetrics: MetricData[] = perfData?.metrics || [
    { label: 'Transaction Speed', value: '—', trend: 0, bars: [] },
    { label: 'Transactions/Hour', value: '—', trend: 0, bars: [] },
    { label: 'Greeting Rate', value: '—', trend: 0, bars: [] },
    { label: 'Void Rate', value: '—', trend: 0, bars: [] },
    { label: 'Revenue/Hour', value: '—', trend: 0, bars: [] },
    { label: 'On-Time Rate', value: '—', trend: 0, bars: [] },
  ];

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-transparent border border-gray-200/50 rounded-2xl p-5 md:p-8 lg:p-10">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight mb-3">Performance</h1>
            <p className="text-base text-[#86868B] leading-relaxed">AI-powered performance insights for your team. Track individual metrics, weekly reviews, and gamification leaderboards.</p>
          </div>
          {/* Auto-send toggle */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            {(Object.keys(autoModeLabels) as Array<keyof typeof autoModeLabels>).map((mode) => (
              <button
                key={mode}
                onClick={() => setAutoSendMode(mode)}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                  autoSendMode === mode
                    ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/20'
                    : 'text-[#86868B] hover:text-gray-900'
                }`}
              >
                {autoModeLabels[mode]}
              </button>
            ))}
          </div>
        </div>

        {/* Clerk selector */}
        <div className="relative inline-block mt-5">
          <select
            value={selectedClerkId}
            onChange={(e) => setSelectedClerkId(e.target.value)}
            className="px-4 py-2.5 bg-white/80 border border-gray-200/50 rounded-xl text-sm text-gray-900 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 pr-10 appearance-none"
          >
            {clerks.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName}
              </option>
            ))}
          </select>
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#86868B]" width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Score Ring + Metrics */}
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Score Ring */}
            <div className="flex-shrink-0 bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-8 flex items-center justify-center">
              <ScoreRing score={perfData?.overallScore ?? 0} />
            </div>

            {/* Metric Cards */}
            <div className="flex-1 grid grid-cols-2 lg:grid-cols-3 gap-3">
              {defaultMetrics.map((metric, i) => (
                <div
                  key={i}
                  className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5 transition-all duration-200 hover:border-[#48484A]/60 hover:shadow-sm hover:shadow-black/10 group"
                >
                  <p className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider mb-2">
                    {metric.label}
                  </p>
                  <div className="flex items-end justify-between mb-3">
                    <span className="text-2xl font-bold text-gray-900 tracking-tight">{metric.value}</span>
                    <TrendArrow value={metric.trend} />
                  </div>
                  {metric.bars.length > 0 && <Sparkline bars={metric.bars} />}
                </div>
              ))}
            </div>
          </div>

          {/* Weekly Reviews */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Weekly Reviews</h2>
            <div className="space-y-3">
              {reviews.length === 0 ? (
                <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-8 text-center text-[#86868B]">
                  No reviews available
                </div>
              ) : (
                reviews.map((review) => {
                  const badge = statusBadge[review.status] || statusBadge.pending;
                  const isExpanded = expandedReview === review.id;
                  return (
                    <div
                      key={review.id}
                      className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl overflow-hidden transition-all duration-200 hover:border-[#48484A]/60 hover:shadow-sm hover:shadow-black/10"
                    >
                      {/* Review header */}
                      <button
                        onClick={() => setExpandedReview(isExpanded ? null : review.id)}
                        className="w-full px-5 py-4 flex items-center justify-between text-left"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-500">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">Week of {review.weekOf}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
                                {review.status.charAt(0).toUpperCase() + review.status.slice(1)}
                              </span>
                              <span className="text-xs text-[#86868B]">Score: {review.overallScore}</span>
                            </div>
                          </div>
                        </div>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                          className={`text-[#86868B] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        >
                          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>

                      {/* Expanded content */}
                      <div
                        className={`overflow-hidden transition-all duration-300 ease-out ${
                          isExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
                        }`}
                      >
                        <div className="px-5 pb-5 space-y-4 border-t border-gray-100 pt-4">
                          {/* Scores */}
                          {review.scores && Object.keys(review.scores).length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider mb-2">Scores</p>
                              <div className="grid grid-cols-2 gap-2">
                                {Object.entries(review.scores).map(([key, val]) => (
                                  <div key={key} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                                    <span className="text-sm text-[#636366] capitalize">{key.replace(/_/g, ' ')}</span>
                                    <span className="text-sm font-semibold text-gray-900">{val}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Highlights */}
                          {review.highlights && review.highlights.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider mb-2">Highlights</p>
                              <ul className="space-y-1">
                                {review.highlights.map((h, i) => (
                                  <li key={i} className="text-sm text-emerald-600 flex items-start gap-2">
                                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                    {h}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Improvements */}
                          {review.improvements && review.improvements.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider mb-2">Areas for Improvement</p>
                              <ul className="space-y-1">
                                {review.improvements.map((imp, i) => (
                                  <li key={i} className="text-sm text-amber-600 flex items-start gap-2">
                                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                                    </svg>
                                    {imp}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* AI Summary */}
                          {review.aiSummary && (
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                              <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider mb-1.5">AI Summary</p>
                              <p className="text-sm text-[#636366] leading-relaxed">{review.aiSummary}</p>
                            </div>
                          )}

                          {/* Action buttons for pending */}
                          {review.status === 'pending' && (
                            <div className="flex gap-2 pt-2">
                              <button
                                onClick={() => handleReviewAction(review.id, 'approve')}
                                disabled={actionLoading === review.id}
                                className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-400 transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleReviewAction(review.id, 'reject')}
                                disabled={actionLoading === review.id}
                                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-400 transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
                              >
                                Reject
                              </button>
                              <button className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-all duration-200 active:scale-[0.98]">
                                Edit
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
