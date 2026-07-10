// ──────────────────────────────────────────────
// RetailGuard AI — Needs Your Review
// Tinder-simple: watch the video, tap one button,
// see the next one. That's it.
// ──────────────────────────────────────────────

import { useState, useEffect, useMemo } from 'react';
import { incidents as incidentsApi } from '../services/api';
import {
  classificationLabel,
  confidenceLabel,
  parseBehaviorSignals,
  plainEnglish,
} from '../utils/labels';

interface ReviewClip {
  id?: string;
  clip_url?: string;
  thumbnail_path?: string;
}

interface ReviewIncident {
  id: string;
  created_at: string;
  person_display_name?: string;
  person_status?: string;
  severity?: string;
  review_status: string;
  camera_id?: string;
  zone_name?: string;
  ai_confidence?: number;
  ai_description?: string;
  detected_at?: string;
  estimated_item?: string;
  estimated_value?: number;
  clips?: (ReviewClip | string)[];
  theft_classification?: string;
  classification_confidence?: number;
  classification_reason?: string;
  behavior_score?: number;
  behavior_signals?: string;
}

function clipUrl(inc: ReviewIncident): string | null {
  if (!inc.clips || inc.clips.length === 0) return null;
  const first = inc.clips[0];
  if (typeof first === 'string') return first || null;
  return first?.clip_url || null;
}

function formatWhen(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ─── Skeleton ────────────────────────────────

function ReviewSkeleton() {
  return (
    <div className="min-h-screen p-4 md:p-8 max-w-2xl mx-auto space-y-4">
      <div className="h-8 bg-gray-100 rounded-xl w-56 animate-pulse" />
      <div className="h-4 bg-gray-100 rounded-lg w-72 animate-pulse" />
      <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden">
        <div className="aspect-video bg-gray-100 animate-pulse" />
        <div className="p-6 space-y-3">
          <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
          <div className="h-4 bg-gray-100 rounded-lg w-2/3 animate-pulse" />
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="h-14 bg-gray-100 rounded-2xl animate-pulse" />
            <div className="h-14 bg-gray-100 rounded-2xl animate-pulse" />
            <div className="h-14 bg-gray-100 rounded-2xl animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────

export default function ReviewQueuePage() {
  const [incidents, setIncidents] = useState<ReviewIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await incidentsApi.list();
      setIncidents(Array.isArray(data) ? data : []);
    } catch {
      setIncidents([]);
    } finally {
      setLoading(false);
    }
  };

  const queue = useMemo(
    () => incidents.filter((i) => i.review_status === 'pending_review'),
    [incidents]
  );
  const current = queue[0];

  const handleReview = async (action: 'theft' | 'not_theft' | 'unsure') => {
    if (!current || submitting) return;
    setSubmitting(true);
    const id = current.id;
    try {
      await incidentsApi.review(id, action);
    } catch {
      // Move on anyway — don't trap the owner on a broken card
    }
    setIncidents((prev) =>
      prev.map((inc) =>
        inc.id === id
          ? { ...inc, review_status: action === 'theft' ? 'confirmed_theft' : action }
          : inc
      )
    );
    setReviewedCount((n) => n + 1);
    setSubmitting(false);
  };

  if (loading) return <ReviewSkeleton />;

  // ── All done / empty state ──────────────────
  if (!current) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 rounded-full bg-green-50 text-green-500 flex items-center justify-center mx-auto mb-5">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {reviewedCount > 0 ? 'All done!' : 'Nothing to review'}
          </h1>
          <p className="text-base text-gray-500 mt-2">
            {reviewedCount > 0
              ? `You reviewed ${reviewedCount} video${reviewedCount !== 1 ? 's' : ''}. Nice work.`
              : "We'll let you know when a new video needs your eyes."}
          </p>
          <button
            onClick={loadData}
            className="mt-6 w-full sm:w-auto px-8 min-h-[52px] rounded-2xl bg-blue-500 text-white text-base font-semibold hover:bg-blue-600 active:scale-[0.98] transition-all"
          >
            Check again
          </button>
        </div>
      </div>
    );
  }

  const cls = classificationLabel(current.theft_classification);
  const sure = confidenceLabel(current.classification_confidence ?? current.ai_confidence);
  const chips = parseBehaviorSignals(current.behavior_signals);
  const video = clipUrl(current);

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-2xl mx-auto pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
            Needs Your Review
          </h1>
          <p className="text-sm md:text-base text-gray-500 mt-1">
            Watch the video, then tap one button.
          </p>
        </div>
        <span className="shrink-0 bg-orange-50 text-orange-600 text-sm font-semibold px-4 py-2 rounded-full">
          {queue.length} left
        </span>
      </div>

      {/* Card */}
      <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
        {/* Video */}
        <div className="aspect-video bg-gray-900 relative">
          {video ? (
            <video
              key={current.id}
              src={video}
              controls
              autoPlay
              muted
              playsInline
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
              <svg className="w-12 h-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <p className="text-sm">No video for this one</p>
            </div>
          )}
        </div>

        {/* Plain-English classification banner */}
        <div className={`px-5 py-4 flex items-center justify-between gap-3 ${cls.bannerClasses}`}>
          <p className="text-base md:text-lg font-bold">{cls.label}</p>
          <span className="shrink-0 bg-white/20 text-white text-xs md:text-sm font-semibold px-3 py-1.5 rounded-full">
            How sure: {sure.label}
          </span>
        </div>

        {/* Details */}
        <div className="p-5 space-y-4">
          {current.ai_description && (
            <p className="text-sm md:text-base text-gray-700 leading-relaxed">
              {plainEnglish(current.ai_description)}
            </p>
          )}

          {/* Behavior notes */}
          {chips.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Behavior notes
              </p>
              <div className="flex flex-wrap gap-2">
                {chips.map((chip) => (
                  <span
                    key={chip}
                    className="bg-orange-50 text-orange-600 text-sm font-medium px-3 py-1.5 rounded-full"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Facts row */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
            {formatWhen(current.detected_at || current.created_at) && (
              <span>{formatWhen(current.detected_at || current.created_at)}</span>
            )}
            {(current.zone_name || current.camera_id) && (
              <span>· {current.zone_name || current.camera_id}</span>
            )}
            {current.person_display_name && <span>· {current.person_display_name}</span>}
            {current.estimated_item && (
              <span>
                · {current.estimated_item}
                {current.estimated_value ? ` (about $${current.estimated_value})` : ''}
              </span>
            )}
          </div>
        </div>

        {/* One-tap buttons */}
        <div className="p-4 md:p-5 pt-0 grid grid-cols-3 gap-3">
          <button
            onClick={() => handleReview('not_theft')}
            disabled={submitting}
            className="min-h-[64px] rounded-2xl bg-gray-100 text-gray-700 font-bold text-base md:text-lg hover:bg-gray-200 active:scale-[0.97] transition-all disabled:opacity-50 flex flex-col items-center justify-center gap-1"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Not Theft
          </button>
          <button
            onClick={() => handleReview('unsure')}
            disabled={submitting}
            className="min-h-[64px] rounded-2xl bg-orange-500 text-white font-bold text-base md:text-lg hover:bg-orange-600 active:scale-[0.97] transition-all disabled:opacity-50 flex flex-col items-center justify-center gap-1"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M12 17.25h.008v.008H12v-.008z" />
            </svg>
            Not Sure
          </button>
          <button
            onClick={() => handleReview('theft')}
            disabled={submitting}
            className="min-h-[64px] rounded-2xl bg-red-500 text-white font-bold text-base md:text-lg hover:bg-red-600 active:scale-[0.97] transition-all disabled:opacity-50 flex flex-col items-center justify-center gap-1 shadow-lg shadow-red-500/25"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Theft
          </button>
        </div>
      </div>

      {/* Progress hint */}
      <p className="text-center text-sm text-gray-400 mt-4">
        One tap and the next video appears automatically.
      </p>
    </div>
  );
}
