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
  pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  approved: { bg: 'bg-green-500/20', text: 'text-green-400' },
  sent: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  rejected: { bg: 'bg-red-500/20', text: 'text-red-400' },
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
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
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
        <span className="text-xs text-white/40 mt-0.5">Overall</span>
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
          className="w-1.5 rounded-full bg-blue-400/60 transition-all duration-300"
          style={{ height: `${(v / max) * 100}%`, minHeight: '2px' }}
        />
      ))}
    </div>
  );
}

function TrendArrow({ value }: { value: number }) {
  if (value === 0) return <span className="text-white/30 text-xs">—</span>;
  const isUp = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isUp ? 'text-green-400' : 'text-red-400'}`}>
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
    <div className="min-h-screen bg-[#1C1C1E] text-white">
      {/* Header */}
      <div className="px-8 pt-8 pb-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Performance</h1>
          {/* Auto-send toggle */}
          <div className="flex items-center gap-2 bg-white/[0.05] rounded-xl p-1">
            {(Object.keys(autoModeLabels) as Array<keyof typeof autoModeLabels>).map((mode) => (
              <button
                key={mode}
                onClick={() => setAutoSendMode(mode)}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                  autoSendMode === mode
                    ? 'bg-blue-500 text-white shadow-lg'
                    : 'text-white/50 hover:text-white/70'
                }`}
              >
                {autoModeLabels[mode]}
              </button>
            ))}
          </div>
        </div>

        {/* Clerk selector */}
        <div className="relative inline-block">
          <select
            value={selectedClerkId}
            onChange={(e) => setSelectedClerkId(e.target.value)}
            className="appearance-none bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-2.5 pr-10 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all duration-200"
          >
            {clerks.map((c) => (
              <option key={c.id} value={c.id} className="bg-[#2C2C2E]">
                {c.fullName}
              </option>
            ))}
          </select>
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5l3 3 3-3" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Score Ring + Metrics */}
          <div className="px-8 pb-8">
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Score Ring */}
              <div className="flex-shrink-0 bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-8 flex items-center justify-center">
                <ScoreRing score={perfData?.overallScore ?? 0} />
              </div>

              {/* Metric Cards */}
              <div className="flex-1 grid grid-cols-2 lg:grid-cols-3 gap-3">
                {defaultMetrics.map((metric, i) => (
                  <div
                    key={i}
                    className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 hover:bg-white/[0.07] transition-all duration-200"
                  >
                    <p className="text-xs text-white/40 font-medium uppercase tracking-wider mb-2">
                      {metric.label}
                    </p>
                    <div className="flex items-end justify-between mb-3">
                      <span className="text-2xl font-bold tracking-tight">{metric.value}</span>
                      <TrendArrow value={metric.trend} />
                    </div>
                    {metric.bars.length > 0 && <Sparkline bars={metric.bars} />}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Weekly Reviews */}
          <div className="px-8 pb-8">
            <h2 className="text-xl font-semibold mb-4 text-white/90">Weekly Reviews</h2>
            <div className="space-y-3">
              {reviews.length === 0 ? (
                <div className="bg-white/[0.05] rounded-2xl p-8 text-center text-white/30">
                  No reviews available
                </div>
              ) : (
                reviews.map((review) => {
                  const badge = statusBadge[review.status] || statusBadge.pending;
                  const isExpanded = expandedReview === review.id;
                  return (
                    <div
                      key={review.id}
                      className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden transition-all duration-200 hover:bg-white/[0.06]"
                    >
                      {/* Review header */}
                      <button
                        onClick={() => setExpandedReview(isExpanded ? null : review.id)}
                        className="w-full px-5 py-4 flex items-center justify-between text-left"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center text-lg">
                            📋
                          </div>
                          <div>
                            <p className="font-medium text-white/90">Week of {review.weekOf}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                                {review.status.charAt(0).toUpperCase() + review.status.slice(1)}
                              </span>
                              <span className="text-xs text-white/40">Score: {review.overallScore}</span>
                            </div>
                          </div>
                        </div>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                          className={`text-white/30 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
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
                        <div className="px-5 pb-5 space-y-4 border-t border-white/[0.06] pt-4">
                          {/* Scores */}
                          {review.scores && Object.keys(review.scores).length > 0 && (
                            <div>
                              <p className="text-xs text-white/40 font-medium uppercase tracking-wider mb-2">Scores</p>
                              <div className="grid grid-cols-2 gap-2">
                                {Object.entries(review.scores).map(([key, val]) => (
                                  <div key={key} className="flex items-center justify-between bg-white/[0.04] rounded-lg px-3 py-2">
                                    <span className="text-sm text-white/60 capitalize">{key.replace(/_/g, ' ')}</span>
                                    <span className="text-sm font-semibold">{val}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Highlights */}
                          {review.highlights && review.highlights.length > 0 && (
                            <div>
                              <p className="text-xs text-white/40 font-medium uppercase tracking-wider mb-2">Highlights</p>
                              <ul className="space-y-1">
                                {review.highlights.map((h, i) => (
                                  <li key={i} className="text-sm text-green-400/80 flex items-start gap-2">
                                    <span className="mt-0.5">✓</span>
                                    {h}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Improvements */}
                          {review.improvements && review.improvements.length > 0 && (
                            <div>
                              <p className="text-xs text-white/40 font-medium uppercase tracking-wider mb-2">Areas for Improvement</p>
                              <ul className="space-y-1">
                                {review.improvements.map((imp, i) => (
                                  <li key={i} className="text-sm text-yellow-400/80 flex items-start gap-2">
                                    <span className="mt-0.5">→</span>
                                    {imp}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* AI Summary */}
                          {review.aiSummary && (
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                              <p className="text-xs text-blue-400 font-medium uppercase tracking-wider mb-1.5">AI Summary</p>
                              <p className="text-sm text-white/70 leading-relaxed">{review.aiSummary}</p>
                            </div>
                          )}

                          {/* Action buttons for pending */}
                          {review.status === 'pending' && (
                            <div className="flex gap-2 pt-2">
                              <button
                                onClick={() => handleReviewAction(review.id, 'approve')}
                                disabled={actionLoading === review.id}
                                className="flex-1 py-2.5 rounded-xl bg-green-500/20 text-green-400 text-sm font-medium hover:bg-green-500/30 transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleReviewAction(review.id, 'reject')}
                                disabled={actionLoading === review.id}
                                className="flex-1 py-2.5 rounded-xl bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
                              >
                                Reject
                              </button>
                              <button className="flex-1 py-2.5 rounded-xl bg-white/[0.05] text-white/60 text-sm font-medium hover:bg-white/[0.08] transition-all duration-200 active:scale-[0.98]">
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
