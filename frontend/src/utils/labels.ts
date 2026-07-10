// ──────────────────────────────────────────────
// RetailGuard AI — Plain-English Labels
// One place that turns system jargon into words
// a store owner understands in 5 seconds.
// ──────────────────────────────────────────────

export interface LabelStyle {
  label: string;
  /** Soft pill classes, e.g. "bg-red-50 text-red-600" */
  colorClasses: string;
  /** Solid banner classes, e.g. "bg-red-500 text-white" */
  bannerClasses: string;
  tone: 'good' | 'bad' | 'warn' | 'neutral';
}

// ─── Theft classification → plain English ────

const CLASSIFICATIONS: Record<string, LabelStyle> = {
  under_review: {
    label: 'Still watching',
    colorClasses: 'bg-gray-100 text-gray-600',
    bannerClasses: 'bg-gray-500 text-white',
    tone: 'neutral',
  },
  likely_paid: {
    label: 'Paid at register',
    colorClasses: 'bg-green-50 text-green-600',
    bannerClasses: 'bg-green-500 text-white',
    tone: 'good',
  },
  likely_theft: {
    label: 'Walked out without paying',
    colorClasses: 'bg-red-50 text-red-600',
    bannerClasses: 'bg-red-500 text-white',
    tone: 'bad',
  },
  partial_theft: {
    label: 'Paid, but not for everything',
    colorClasses: 'bg-orange-50 text-orange-600',
    bannerClasses: 'bg-orange-500 text-white',
    tone: 'warn',
  },
  cleared: {
    label: 'Cleared — no theft',
    colorClasses: 'bg-green-50 text-green-600',
    bannerClasses: 'bg-green-500 text-white',
    tone: 'good',
  },
  grab_and_run: {
    label: 'Grabbed and ran out',
    colorClasses: 'bg-red-50 text-red-600',
    bannerClasses: 'bg-red-600 text-white',
    tone: 'bad',
  },
};

const UNKNOWN_CLASSIFICATION: LabelStyle = {
  label: 'Still watching',
  colorClasses: 'bg-gray-100 text-gray-600',
  bannerClasses: 'bg-gray-500 text-white',
  tone: 'neutral',
};

/** Accepts 'LIKELY_THEFT', 'likely_theft', undefined, or anything else. */
export function classificationLabel(value?: string | null): LabelStyle {
  if (!value) return UNKNOWN_CLASSIFICATION;
  const key = String(value).toLowerCase().trim();
  return CLASSIFICATIONS[key] || UNKNOWN_CLASSIFICATION;
}

// ─── Confidence → "How sure" ─────────────────

export interface ConfidenceLabel {
  label: string; // "Very sure" | "Fairly sure" | "Not sure"
  colorClasses: string;
}

/** Accepts 0–1 or 0–100. Returns plain-English certainty. */
export function confidenceLabel(confidence?: number | null): ConfidenceLabel {
  if (confidence === undefined || confidence === null || isNaN(confidence)) {
    return { label: 'Not sure', colorClasses: 'bg-gray-100 text-gray-600' };
  }
  const pct = confidence > 1 ? confidence : confidence * 100;
  if (pct > 80) return { label: 'Very sure', colorClasses: 'bg-green-50 text-green-600' };
  if (pct >= 50) return { label: 'Fairly sure', colorClasses: 'bg-orange-50 text-orange-600' };
  return { label: 'Not sure', colorClasses: 'bg-gray-100 text-gray-600' };
}

/** "How sure: Very sure" */
export function howSureText(confidence?: number | null): string {
  return `How sure: ${confidenceLabel(confidence).label}`;
}

// ─── Review status → plain English ───────────

const REVIEW_STATUSES: Record<string, LabelStyle> = {
  pending_review: {
    label: 'Needs your review',
    colorClasses: 'bg-orange-50 text-orange-600',
    bannerClasses: 'bg-orange-500 text-white',
    tone: 'warn',
  },
  confirmed_theft: {
    label: 'Theft',
    colorClasses: 'bg-red-50 text-red-600',
    bannerClasses: 'bg-red-500 text-white',
    tone: 'bad',
  },
  not_theft: {
    label: 'Not theft',
    colorClasses: 'bg-green-50 text-green-600',
    bannerClasses: 'bg-green-500 text-white',
    tone: 'good',
  },
  unsure: {
    label: 'Not sure',
    colorClasses: 'bg-orange-50 text-orange-600',
    bannerClasses: 'bg-orange-500 text-white',
    tone: 'warn',
  },
  escalated: {
    label: 'Escalated',
    colorClasses: 'bg-blue-50 text-blue-600',
    bannerClasses: 'bg-blue-500 text-white',
    tone: 'neutral',
  },
};

export function reviewStatusLabel(value?: string | null): LabelStyle {
  if (!value) return UNKNOWN_CLASSIFICATION;
  const key = String(value).toLowerCase().trim();
  return (
    REVIEW_STATUSES[key] || {
      label: String(value).replace(/_/g, ' '),
      colorClasses: 'bg-gray-100 text-gray-600',
      bannerClasses: 'bg-gray-500 text-white',
      tone: 'neutral' as const,
    }
  );
}

// ─── Behavior signals → friendly chips ───────

const BEHAVIOR_SIGNALS: Record<string, string> = {
  loitering: 'Lingering in aisle',
  repeated_passes: 'Walked same aisle repeatedly',
  head_scanning: 'Looking around a lot',
  grab_and_run: 'Quick grab',
  concealment: 'May have hidden an item',
  lingering: 'Lingering in aisle',
};

/**
 * Parses behavior_signals (a JSON string like '["loitering","head_scanning"]'
 * or '{"loitering": true}') into friendly chip labels. Never throws.
 */
export function parseBehaviorSignals(raw?: string | null): string[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return [];
  }
  let keys: string[] = [];
  if (Array.isArray(parsed)) {
    keys = parsed.filter((k): k is string => typeof k === 'string');
  } else if (parsed && typeof parsed === 'object') {
    keys = Object.entries(parsed as Record<string, unknown>)
      .filter(([, v]) => !!v)
      .map(([k]) => k);
  }
  return keys.map((k) => {
    const norm = k.toLowerCase().trim();
    return BEHAVIOR_SIGNALS[norm] || norm.replace(/_/g, ' ');
  });
}

// ─── Alert / incident titles → plain English ─

const JARGON_REPLACEMENTS: [RegExp, string][] = [
  [/concealment detected/gi, 'Someone may have hidden an item'],
  [/concealment/gi, 'possible hidden item'],
  [/\bincidents\b/gi, 'suspicious activity'],
  [/\bincident\b/gi, 'suspicious activity'],
  [/call 911/gi, 'Contact Authorities'],
  [/call police/gi, 'Contact Authorities'],
];

/** Softens jargon in free-text titles/descriptions. */
export function plainEnglish(text?: string | null): string {
  if (!text) return '';
  let out = String(text);
  for (const [re, replacement] of JARGON_REPLACEMENTS) {
    out = out.replace(re, replacement);
  }
  return out.charAt(0).toUpperCase() + out.slice(1);
}

const ALERT_TYPE_LABELS: Record<string, string> = {
  concealment_detected: 'Someone may have hidden an item',
  offender_entry: 'A known offender just walked in',
  blacklist_entry: 'A banned person just walked in',
  theft_confirmed: 'Theft confirmed',
  grab_and_run: 'Someone grabbed and ran out',
};

export function alertTypeLabel(alertType?: string | null): string {
  if (!alertType) return 'Suspicious activity';
  const key = String(alertType).toLowerCase().trim();
  return ALERT_TYPE_LABELS[key] || plainEnglish(key.replace(/_/g, ' '));
}
