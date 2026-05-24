import { useState, useEffect, useRef } from 'react';
import { alerts as alertsApi, persons as personsApi } from '../services/api';

/* ─── Types ─── */
interface AlertItem {
  id: string;
  created_at: string;
  person_id?: string;
  person_display_name?: string;
  person_status?: string;
  person_threat_level?: number;
  person_total_thefts?: number;
  alert_type?: string;
  priority: string;
  status: string;
  title: string;
  message?: string;
  tracking_active?: boolean;
  current_camera_id?: string;
  reference_clip_url?: string;
  current_snapshot_path?: string;
  match_confidence?: number;
  match_details?: any;
  best_portrait_path?: string;
  theft_classification?: string;
  classification_reason?: string;
  visited_register?: boolean;
  concealment_count?: number;
  // Timeline / backtracking
  theft_timestamp?: string;
  concealment_timestamp?: string;
  exit_timestamp?: string;
  timeline_frames?: { time: string; label: string; camera: string; thumbnail?: string }[];
}

interface PersonInfo {
  id: string;
  name?: string;
  display_name?: string;
  full_name?: string;
  date_of_birth?: string;
  address?: string;
  phone_number?: string;
  drivers_license?: string;
  id_photo_path?: string;
  id_type?: string;
  best_portrait_path?: string;
  estimated_age_range?: string;
  estimated_gender?: string;
  estimated_height_cm?: number;
  estimated_build?: string;
  hair_description?: string;
  total_confirmed_thefts?: number;
  total_incidents?: number;
  total_visits?: number;
  threat_level?: number;
  status?: string;
  notes?: string;
  category?: string;
}

type OffenderType = 'new' | 'returning' | 'unknown';
type AlertFilter = 'all' | 'new_offender' | 'returning_offender' | 'active' | 'acknowledged';

const API_BASE = import.meta.env.VITE_API_URL || '';

/* ─── Helpers ─── */
function getOffenderType(alert: AlertItem): OffenderType {
  // Returning offender: has prior thefts, known offender type alert, or high threat level
  if (
    (alert.person_total_thefts && alert.person_total_thefts > 0) ||
    alert.alert_type?.includes('known') ||
    alert.alert_type?.includes('reentry') ||
    alert.alert_type?.includes('re_entry') ||
    alert.person_status === 'confirmed_thief' ||
    alert.person_status === 'blacklisted'
  ) {
    return 'returning';
  }
  // New offender: concealment detected during this visit
  if (
    alert.theft_classification === 'likely_theft' ||
    alert.theft_classification === 'partial_theft' ||
    alert.theft_classification === 'grab_and_run' ||
    (alert.concealment_count && alert.concealment_count > 0)
  ) {
    return 'new';
  }
  return 'unknown';
}

const offenderConfig = {
  new: {
    label: 'NEW OFFENDER',
    sublabel: 'Just stole — this visit',
    color: 'text-orange-700',
    bg: 'bg-orange-500/15',
    border: 'border-orange-400/50',
    ring: 'ring-orange-500/10',
    dot: 'bg-orange-500',
    gradient: 'from-orange-600 to-amber-500',
    iconBg: 'bg-orange-500/15',
    pulse: true,
  },
  returning: {
    label: 'RETURNING OFFENDER',
    sublabel: 'Previously identified — back in store',
    color: 'text-red-700',
    bg: 'bg-red-500/15',
    border: 'border-red-500/50',
    ring: 'ring-red-500/15',
    dot: 'bg-red-600',
    gradient: 'from-red-700 to-red-500',
    iconBg: 'bg-red-500/15',
    pulse: true,
  },
  unknown: {
    label: 'ALERT',
    sublabel: 'Security event',
    color: 'text-gray-600',
    bg: 'bg-gray-500/10',
    border: 'border-gray-200/50',
    ring: 'ring-gray-500/5',
    dot: 'bg-gray-400',
    gradient: 'from-gray-600 to-gray-400',
    iconBg: 'bg-gray-500/10',
    pulse: false,
  },
};

const classificationConfig: Record<string, { label: string; color: string; bg: string }> = {
  likely_theft: { label: 'LIKELY THEFT', color: 'text-red-600', bg: 'bg-red-500/15' },
  grab_and_run: { label: 'GRAB & RUN', color: 'text-red-700', bg: 'bg-red-600/20' },
  partial_theft: { label: 'PARTIAL THEFT', color: 'text-orange-600', bg: 'bg-orange-500/15' },
  likely_paid: { label: 'LIKELY PAID', color: 'text-emerald-600', bg: 'bg-emerald-500/15' },
  under_review: { label: 'UNDER REVIEW', color: 'text-blue-600', bg: 'bg-blue-500/15' },
  cleared: { label: 'CLEARED', color: 'text-gray-500', bg: 'bg-gray-500/15' },
};

function ClassificationBadge({ classification }: { classification?: string }) {
  if (!classification) return null;
  const cfg = classificationConfig[classification] || classificationConfig.under_review;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatFullTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function isOlderThanToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() !== now.toDateString();
}

/* ─── Generate demo theft timeline frames ─── */
function generateTimelineFrames(alert: AlertItem): { time: string; label: string; camera: string; type: 'entry' | 'concealment' | 'movement' | 'register' | 'exit' }[] {
  if (alert.timeline_frames && alert.timeline_frames.length > 0) {
    return alert.timeline_frames.map(f => ({
      time: f.time,
      label: f.label,
      camera: f.camera,
      type: 'movement' as const,
    }));
  }

  const baseTime = new Date(alert.created_at);
  const type = getOffenderType(alert);
  const frames = [];

  if (type === 'returning') {
    // Returning offender — show entry detection
    frames.push({ time: new Date(baseTime.getTime() - 30000).toISOString(), label: 'Entered store', camera: 'Front Entrance', type: 'entry' as const });
    frames.push({ time: new Date(baseTime.getTime() - 15000).toISOString(), label: 'AI face match — known offender', camera: 'Front Entrance', type: 'entry' as const });
    frames.push({ time: baseTime.toISOString(), label: 'Alert triggered', camera: 'Front Entrance', type: 'movement' as const });
  } else {
    // New offender — show theft sequence
    frames.push({ time: new Date(baseTime.getTime() - 180000).toISOString(), label: 'Entered store', camera: 'Front Entrance', type: 'entry' as const });
    frames.push({ time: new Date(baseTime.getTime() - 120000).toISOString(), label: 'Browsing aisle', camera: 'Aisle 1 — Snacks', type: 'movement' as const });
    frames.push({ time: new Date(baseTime.getTime() - 60000).toISOString(), label: 'Item concealed in jacket', camera: 'Aisle 2 — Electronics', type: 'concealment' as const });
    if (alert.visited_register) {
      frames.push({ time: new Date(baseTime.getTime() - 30000).toISOString(), label: 'Visited register — paid for other items', camera: 'Register Area', type: 'register' as const });
    }
    frames.push({ time: new Date(baseTime.getTime() - 10000).toISOString(), label: alert.visited_register ? 'Left with unpaid item' : 'Walked past register to exit', camera: 'Front Entrance', type: 'exit' as const });
    frames.push({ time: baseTime.toISOString(), label: 'Theft confirmed by AI', camera: 'System', type: 'exit' as const });
  }

  return frames;
}

const timelineTypeConfig = {
  entry: { color: 'bg-blue-500', icon: 'M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75' },
  concealment: { color: 'bg-red-500', icon: 'M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88' },
  movement: { color: 'bg-gray-400', icon: 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z' },
  register: { color: 'bg-emerald-500', icon: 'M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z' },
  exit: { color: 'bg-purple-500', icon: 'M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9' },
};


/* ═══════════════════════════════════════════
   THEFT TIMELINE COMPONENT
   Quick-view frame-by-frame backtracking
   ═══════════════════════════════════════════ */
function TheftTimeline({ alert, expanded }: { alert: AlertItem; expanded: boolean }) {
  const frames = generateTimelineFrames(alert);
  const [selectedFrame, setSelectedFrame] = useState(0);

  if (!expanded) return null;

  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Theft Timeline</span>
      </div>

      {/* Timeline Track */}
      <div className="relative">
        {/* Horizontal scrolling frame strip */}
        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
          {frames.map((frame, i) => {
            const cfg = timelineTypeConfig[frame.type] || timelineTypeConfig.movement;
            const isSelected = i === selectedFrame;
            return (
              <button
                key={i}
                onClick={() => setSelectedFrame(i)}
                className={`shrink-0 rounded-xl border-2 transition-all duration-200 ${
                  isSelected
                    ? `border-blue-500 bg-blue-50 shadow-md shadow-blue-500/10`
                    : 'border-gray-200/60 bg-white hover:border-gray-300 hover:shadow-sm'
                }`}
                style={{ minWidth: '140px' }}
              >
                {/* Frame thumbnail placeholder */}
                <div className={`h-20 rounded-t-lg ${isSelected ? 'bg-gradient-to-br from-blue-100 to-blue-50' : 'bg-gray-100'} flex items-center justify-center relative overflow-hidden`}>
                  <svg className={`w-8 h-8 ${isSelected ? 'text-blue-400' : 'text-gray-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={cfg.icon} />
                  </svg>
                  {/* Frame number */}
                  <span className={`absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                    frame.type === 'concealment' ? 'bg-red-500 text-white' :
                    frame.type === 'exit' ? 'bg-purple-500 text-white' :
                    'bg-gray-800/60 text-white'
                  }`}>
                    {i + 1}/{frames.length}
                  </span>
                  {/* Camera name */}
                  <span className="absolute bottom-1 right-1.5 text-[8px] text-gray-500 bg-white/80 px-1 rounded">{frame.camera}</span>
                </div>
                <div className="px-2 py-1.5">
                  <p className={`text-[10px] font-semibold truncate ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>
                    {frame.label}
                  </p>
                  <p className="text-[9px] text-gray-400">
                    {new Date(frame.time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected frame detail */}
      <div className="mt-2 flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200/50">
        <div className={`w-8 h-8 rounded-lg ${timelineTypeConfig[frames[selectedFrame]?.type]?.color || 'bg-gray-400'} flex items-center justify-center shrink-0`}>
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={timelineTypeConfig[frames[selectedFrame]?.type]?.icon || timelineTypeConfig.movement.icon} />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{frames[selectedFrame]?.label}</p>
          <p className="text-xs text-gray-500">{frames[selectedFrame]?.camera} · {new Date(frames[selectedFrame]?.time).toLocaleTimeString()}</p>
        </div>
        <span className="text-[10px] font-bold text-gray-400 bg-gray-200/60 px-2 py-1 rounded-lg">
          Frame {selectedFrame + 1} of {frames.length}
        </span>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════
   OFFENDER RE-ENTRY MODAL
   (Kept from previous version, fully intact)
   ═══════════════════════════════════════════ */
function OffenderModal({
  alert,
  onClose,
  onAction,
}: {
  alert: AlertItem;
  onClose: () => void;
  onAction: (action: string, data?: any) => void;
}) {
  const [person, setPerson] = useState<PersonInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'id' | 'manual'>('overview');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const offType = getOffenderType(alert);
  const cfg = offenderConfig[offType];

  const [manualForm, setManualForm] = useState({
    full_name: '', date_of_birth: '', address: '', phone_number: '',
    drivers_license: '', notes: '', estimated_height_cm: '', hair_description: '', estimated_build: '',
  });

  const [idFile, setIdFile] = useState<File | null>(null);
  const [idPreview, setIdPreview] = useState<string | null>(null);
  const [idType, setIdType] = useState('drivers_license');
  const [uploadingId, setUploadingId] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadPerson(); }, [alert.person_id]);

  const loadPerson = async () => {
    if (!alert.person_id) { setLoading(false); return; }
    try {
      const data = await personsApi.get(alert.person_id);
      setPerson(data);
      setManualForm({
        full_name: data.full_name || data.display_name || '',
        date_of_birth: data.date_of_birth || '',
        address: data.address || '',
        phone_number: data.phone_number || '',
        drivers_license: data.drivers_license || '',
        notes: data.notes || '',
        estimated_height_cm: data.estimated_height_cm?.toString() || '',
        hair_description: data.hair_description || '',
        estimated_build: data.estimated_build || '',
      });
      if (data.id_photo_path) setIdPreview(`${API_BASE}${data.id_photo_path}`);
    } catch { /* no person data */ }
    setLoading(false);
  };

  const handleIdUpload = async () => {
    if (!idFile || !alert.person_id) return;
    setUploadingId(true);
    try {
      await personsApi.uploadIdPhoto(alert.person_id, idFile, idType);
      setIdPreview(URL.createObjectURL(idFile));
    } catch { /* ignore */ }
    setUploadingId(false);
  };

  const handleManualSave = async () => {
    if (!alert.person_id) return;
    setActionLoading('save');
    try {
      const payload: any = { ...manualForm };
      if (payload.estimated_height_cm) payload.estimated_height_cm = parseInt(payload.estimated_height_cm);
      else delete payload.estimated_height_cm;
      await personsApi.update(alert.person_id, payload);
      await loadPerson();
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  const handleAction = async (action: string) => {
    setActionLoading(action);
    try {
      await onAction(action, { person_id: alert.person_id, alert_id: alert.id });
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  const portraitUrl = person?.best_portrait_path
    ? `${API_BASE}${person.best_portrait_path}`
    : alert.best_portrait_path
      ? `${API_BASE}${alert.best_portrait_path}`
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white shadow-2xl w-full h-full md:rounded-3xl md:max-w-5xl md:max-h-[92vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>

        {/* ─── Header with offender type color ─── */}
        <div className={`bg-gradient-to-r ${cfg.gradient} px-4 md:px-8 py-4 md:py-5 flex items-center justify-between shrink-0`}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h2 className="text-xl font-bold text-white">
                  {alert.person_display_name || 'Unknown Person'}
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-white/25 text-white uppercase tracking-wider">
                  {cfg.label}
                </span>
              </div>
              <p className="text-white/80 text-sm">
                {offType === 'returning'
                  ? `Known offender re-entered · ${alert.match_confidence ? `${Math.round((alert.match_confidence > 1 ? alert.match_confidence : alert.match_confidence * 100))}% match` : 'AI match confirmed'}`
                  : `Theft detected this visit · ${alert.concealment_count || 0} item${(alert.concealment_count || 0) !== 1 ? 's' : ''} concealed`
                }
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ─── Content ─── */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-10 h-10 border-4 border-red-200 border-t-red-500 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Top Row: Person + Video */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Person Photo & Identity */}
                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200/60">
                  <div className="flex gap-5">
                    <div className="shrink-0">
                      {portraitUrl ? (
                        <img src={portraitUrl} alt="Subject" className={`w-28 h-28 rounded-2xl object-cover border-2 shadow-lg ${offType === 'returning' ? 'border-red-300' : 'border-orange-300'}`} />
                      ) : (
                        <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center border-2 border-gray-200">
                          <svg className="w-14 h-14 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-gray-900 mb-1">
                        {person?.full_name || person?.display_name || 'Unidentified'}
                      </h3>
                      <div className="space-y-1.5 text-sm">
                        {person?.status && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">Status:</span>
                            <span className={`font-semibold ${person.status === 'confirmed_thief' ? 'text-red-600' : person.status === 'blacklisted' ? 'text-purple-600' : 'text-gray-700'}`}>
                              {person.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                          </div>
                        )}
                        {person?.total_confirmed_thefts !== undefined && person.total_confirmed_thefts > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">Prior Thefts:</span>
                            <span className="font-bold text-red-600">{person.total_confirmed_thefts}</span>
                          </div>
                        )}
                        {person?.total_visits !== undefined && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">Total Visits:</span>
                            <span className="font-semibold text-gray-700">{person.total_visits}</span>
                          </div>
                        )}
                        {person?.estimated_height_cm && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">Height:</span>
                            <span className="text-gray-700">{person.estimated_height_cm}cm ({Math.floor(person.estimated_height_cm / 2.54 / 12)}'{Math.round(person.estimated_height_cm / 2.54 % 12)}")</span>
                          </div>
                        )}
                        {person?.estimated_build && (
                          <div className="flex items-center gap-2"><span className="text-gray-500">Build:</span><span className="text-gray-700">{person.estimated_build}</span></div>
                        )}
                        {person?.hair_description && (
                          <div className="flex items-center gap-2"><span className="text-gray-500">Hair:</span><span className="text-gray-700">{person.hair_description}</span></div>
                        )}
                      </div>

                      {(person?.threat_level || alert.person_threat_level) && (
                        <div className="mt-3 flex items-center gap-2">
                          <span className="text-xs text-gray-500 font-medium">Threat:</span>
                          <div className="flex gap-1">
                            {Array.from({ length: 5 }, (_, i) => (
                              <span key={i} className={`w-3 h-3 rounded-full ${i < (person?.threat_level || alert.person_threat_level || 0) ? 'bg-red-500' : 'bg-gray-200'}`} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {alert.theft_classification && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <ClassificationBadge classification={alert.theft_classification} />
                        {alert.concealment_count && alert.concealment_count > 0 && (
                          <span className="text-xs text-gray-500">{alert.concealment_count} item{alert.concealment_count > 1 ? 's' : ''} concealed</span>
                        )}
                      </div>
                      {alert.classification_reason && (
                        <p className="mt-2 text-xs text-gray-500 leading-relaxed">{alert.classification_reason}</p>
                      )}
                      {alert.visited_register !== undefined && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${alert.visited_register ? 'bg-emerald-400' : 'bg-red-400'}`} />
                          <span className="text-xs text-gray-500">{alert.visited_register ? 'Visited register' : 'Did NOT visit register'}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Previous Theft Video */}
                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200/60">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    {offType === 'returning' ? 'Previous Theft Evidence' : 'Current Theft Evidence'}
                  </h4>
                  {alert.reference_clip_url ? (
                    <video src={`${API_BASE}${alert.reference_clip_url}`} controls className="w-full rounded-xl bg-black aspect-video" poster={alert.current_snapshot_path ? `${API_BASE}${alert.current_snapshot_path}` : undefined} />
                  ) : (
                    <div className="w-full aspect-video rounded-xl bg-gray-200 flex flex-col items-center justify-center">
                      <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                      <p className="text-sm text-gray-400">No clip available</p>
                      <p className="text-xs text-gray-400 mt-1">Evidence clip will appear after capture</p>
                    </div>
                  )}
                  {person?.notes && (
                    <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200/50">
                      <p className="text-xs text-amber-700 font-medium mb-1">Notes:</p>
                      <p className="text-xs text-amber-600 whitespace-pre-wrap">{person.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ─── Theft Timeline / Backtracking ─── */}
              <TheftTimeline alert={alert} expanded={true} />

              {/* ─── Tabs: Overview / ID Capture / Manual Entry ─── */}
              <div className="border border-gray-200/60 rounded-2xl overflow-hidden">
                <div className="flex border-b border-gray-200/60 bg-gray-50">
                  {[
                    { key: 'overview' as const, label: 'Overview', icon: 'M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z' },
                    { key: 'id' as const, label: 'Capture ID', icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z' },
                    { key: 'manual' as const, label: 'Manual Entry', icon: 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10' },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                        activeTab === tab.key ? 'bg-white text-gray-900 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
                      </svg>
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="p-6 bg-white">
                  {activeTab === 'overview' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          { label: 'Match Confidence', value: alert.match_confidence ? `${Math.round((alert.match_confidence > 1 ? alert.match_confidence : alert.match_confidence * 100))}%` : 'N/A', color: 'text-blue-600' },
                          { label: 'Prior Thefts', value: person?.total_confirmed_thefts?.toString() || '0', color: 'text-red-600' },
                          { label: 'Total Visits', value: person?.total_visits?.toString() || '—', color: 'text-gray-700' },
                          { label: 'Status', value: person?.status?.replace(/_/g, ' ') || 'Unknown', color: person?.status === 'blacklisted' ? 'text-purple-600' : 'text-gray-700' },
                        ].map((stat) => (
                          <div key={stat.label} className="bg-gray-50 rounded-xl p-4 border border-gray-200/50">
                            <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
                            <p className={`text-xl font-bold capitalize ${stat.color}`}>{stat.value}</p>
                          </div>
                        ))}
                      </div>

                      {person?.id_photo_path && (
                        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200/50">
                          <p className="text-sm font-medium text-blue-800 mb-2 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                            </svg>
                            ID On File ({person.id_type?.replace(/_/g, ' ') || 'ID'})
                          </p>
                          <img src={`${API_BASE}${person.id_photo_path}`} alt="ID" className="h-40 rounded-lg border border-blue-200" />
                          {person.drivers_license && (
                            <p className="mt-2 text-sm text-blue-700">License #: <span className="font-mono font-semibold">{person.drivers_license}</span></p>
                          )}
                        </div>
                      )}

                      {(person?.full_name || person?.date_of_birth || person?.address || person?.phone_number) && (
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200/50">
                          <p className="text-sm font-medium text-gray-700 mb-3">Personal Information On File</p>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            {person.full_name && <div><span className="text-gray-500">Name:</span> <span className="font-medium text-gray-900">{person.full_name}</span></div>}
                            {person.date_of_birth && <div><span className="text-gray-500">DOB:</span> <span className="font-medium text-gray-900">{person.date_of_birth}</span></div>}
                            {person.address && <div className="col-span-2"><span className="text-gray-500">Address:</span> <span className="font-medium text-gray-900">{person.address}</span></div>}
                            {person.phone_number && <div><span className="text-gray-500">Phone:</span> <span className="font-medium text-gray-900">{person.phone_number}</span></div>}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'id' && (
                    <div className="space-y-5">
                      <p className="text-sm text-gray-500">Take a photo of the customer's ID or upload an existing image.</p>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">ID Type</label>
                        <div className="flex gap-2 flex-wrap">
                          {[
                            { value: 'drivers_license', label: "Driver's License" },
                            { value: 'state_id', label: 'State ID' },
                            { value: 'passport', label: 'Passport' },
                            { value: 'other', label: 'Other' },
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => setIdType(opt.value)}
                              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                                idType === opt.value ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-blue-400 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setIdFile(f); setIdPreview(URL.createObjectURL(f)); }}} />
                        {idPreview ? (
                          <div className="space-y-3">
                            <img src={idPreview} alt="ID Preview" className="max-h-52 mx-auto rounded-xl border border-gray-200 shadow-sm" />
                            <p className="text-sm text-gray-500">Click to replace</p>
                          </div>
                        ) : (
                          <div>
                            <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                            </svg>
                            <p className="text-sm font-medium text-gray-700 mb-1">Take photo or upload ID</p>
                            <p className="text-xs text-gray-400">Tap to open camera or browse files</p>
                          </div>
                        )}
                      </div>

                      {idFile && (
                        <button onClick={handleIdUpload} disabled={uploadingId} className="w-full py-3 bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 transition disabled:opacity-50">
                          {uploadingId ? 'Uploading...' : 'Save ID Photo'}
                        </button>
                      )}
                    </div>
                  )}

                  {activeTab === 'manual' && (
                    <div className="space-y-5">
                      <p className="text-sm text-gray-500">Enter or update offender information manually.</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                          { key: 'full_name', label: 'Full Name', placeholder: 'John Doe', type: 'text' },
                          { key: 'date_of_birth', label: 'Date of Birth', placeholder: 'MM/DD/YYYY', type: 'text' },
                          { key: 'phone_number', label: 'Phone Number', placeholder: '(555) 123-4567', type: 'tel' },
                          { key: 'drivers_license', label: "Driver's License #", placeholder: 'DL12345678', type: 'text' },
                          { key: 'estimated_height_cm', label: 'Height (cm)', placeholder: '175', type: 'number' },
                          { key: 'estimated_build', label: 'Build', placeholder: 'Medium, Slim, Heavy...', type: 'text' },
                          { key: 'hair_description', label: 'Hair Description', placeholder: 'Brown, short, curly...', type: 'text' },
                        ].map((field) => (
                          <div key={field.key}>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">{field.label}</label>
                            <input
                              type={field.type}
                              placeholder={field.placeholder}
                              value={(manualForm as any)[field.key]}
                              onChange={(e) => setManualForm({ ...manualForm, [field.key]: e.target.value })}
                              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition bg-white"
                            />
                          </div>
                        ))}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Address</label>
                        <input type="text" placeholder="123 Main St, City, State ZIP" value={manualForm.address} onChange={(e) => setManualForm({ ...manualForm, address: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition bg-white" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes / Distinguishing Marks</label>
                        <textarea placeholder="Tattoos, scars, clothing description, behavior notes..." value={manualForm.notes} onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })} rows={3} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition bg-white resize-none" />
                      </div>
                      <button onClick={handleManualSave} disabled={actionLoading === 'save'} className="w-full py-3 bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 transition disabled:opacity-50">
                        {actionLoading === 'save' ? 'Saving...' : 'Save Information'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── Action Bar ─── */}
        <div className="border-t border-gray-200 bg-gray-50 px-4 md:px-8 py-4 md:py-5 shrink-0">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <p className="text-sm text-gray-500">Choose an action:</p>
            <div className="flex items-center gap-2 md:gap-3 flex-wrap">
              <button onClick={() => handleAction('call_police')} disabled={!!actionLoading} className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-red-500/25">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
                Contact Authorities
              </button>
              <button onClick={() => handleAction('paid')} disabled={!!actionLoading} className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Paid
              </button>
              <button onClick={() => handleAction('release')} disabled={!!actionLoading} className="flex items-center gap-2 px-6 py-3 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition-all active:scale-95 disabled:opacity-50">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
                Release
              </button>
              <button onClick={() => handleAction('blacklist')} disabled={!!actionLoading} className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-all active:scale-95 disabled:opacity-50">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                Blacklist
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════
   MAIN LIVE ALERTS PAGE
   ═══════════════════════════════════════════ */
export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AlertFilter>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);
  const [expandedTimeline, setExpandedTimeline] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const data = await alertsApi.list();
      if (Array.isArray(data) && data.length > 0) {
        setAlerts(data);
      } else {
        setAlerts(generateMockAlerts());
      }
    } catch {
      setAlerts(generateMockAlerts());
    } finally {
      setLoading(false);
    }
  };

  const generateMockAlerts = (): AlertItem[] => [
    {
      id: 'demo-alert-1',
      created_at: new Date(Date.now() - 120000).toISOString(),
      person_id: undefined,
      person_display_name: 'Person-4821',
      person_status: 'confirmed_thief',
      person_threat_level: 4,
      person_total_thefts: 3,
      alert_type: 'known_offender_reentry',
      priority: 'critical',
      status: 'active',
      title: 'Returning Offender — Re-Entry Detected',
      message: 'Previously identified thief (3 prior incidents) detected entering the store via front entrance. Last theft: May 15.',
      match_confidence: 0.94,
      theft_classification: 'likely_theft',
      classification_reason: 'Subject has 3 confirmed prior thefts. Identified by face recognition at entry camera.',
      visited_register: false,
      concealment_count: 0,
    },
    {
      id: 'demo-alert-2',
      created_at: new Date(Date.now() - 45000).toISOString(),
      person_id: undefined,
      person_display_name: 'Unknown Male',
      person_status: undefined,
      person_threat_level: undefined,
      person_total_thefts: 0,
      alert_type: 'concealment_detected',
      priority: 'high',
      status: 'active',
      title: 'New Theft Detected — Item Concealed',
      message: 'Subject concealed 2 items in jacket pocket in Aisle 2, bypassed register, heading toward exit.',
      match_confidence: undefined,
      theft_classification: 'likely_theft',
      classification_reason: 'Subject concealed 2 items in jacket, walked past register directly to exit. No payment detected.',
      visited_register: false,
      concealment_count: 2,
    },
  ];

  const handleAcknowledge = async (id: string) => {
    setActionLoading(id);
    try { await alertsApi.acknowledge(id); } catch { /* ok */ }
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'acknowledged' } : a));
    setActionLoading(null);
  };

  const handleAlertAction = async (action: string, data?: any) => {
    if (!selectedAlert) return;
    try { await alertsApi.action(selectedAlert.id, action, data); } catch { /* ok */ }
    setAlerts(prev => prev.map(a => a.id === selectedAlert.id ? { ...a, status: 'acknowledged' } : a));
    setSelectedAlert(null);
    await loadData();
  };

  // Count offender types
  const newCount = alerts.filter(a => getOffenderType(a) === 'new' && a.status !== 'acknowledged').length;
  const returningCount = alerts.filter(a => getOffenderType(a) === 'returning' && a.status !== 'acknowledged').length;
  const activeCount = alerts.filter(a => a.status !== 'acknowledged').length;

  const filtered = alerts.filter(a => {
    if (filter === 'new_offender') return getOffenderType(a) === 'new';
    if (filter === 'returning_offender') return getOffenderType(a) === 'returning';
    if (filter === 'active') return a.status !== 'acknowledged';
    if (filter === 'acknowledged') return a.status === 'acknowledged';
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen p-4 md:p-6 lg:p-8 space-y-8">
        <div className="bg-gradient-to-br from-red-500/10 via-orange-500/5 to-transparent border border-gray-200/50 rounded-2xl p-5 md:p-8 lg:p-10">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight mb-3">Live Alerts</h1>
          <p className="text-base text-[#86868B]">Loading...</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5 animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-20 mb-2" />
              <div className="h-7 bg-gray-200 rounded w-10" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 space-y-8">
      {/* Offender Modal */}
      {selectedAlert && (
        <OffenderModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} onAction={handleAlertAction} />
      )}

      {/* ─── Hero ─── */}
      <div className="bg-gradient-to-br from-red-500/10 via-orange-500/5 to-transparent border border-gray-200/50 rounded-2xl p-5 md:p-8 lg:p-10">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight mb-3">Live Alerts</h1>
            <p className="text-base text-[#86868B] leading-relaxed max-w-2xl">
              Active in-store offender alerts. <strong className="text-orange-600">New offenders</strong> were just caught stealing this visit. <strong className="text-red-600">Returning offenders</strong> are previously identified thieves re-entering the store.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white/80 backdrop-blur-xl rounded-full px-4 py-2 border border-gray-200/50 shrink-0 ml-4">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
            </span>
            <span className="text-xs text-emerald-600 font-medium">Live</span>
          </div>
        </div>
      </div>

      {/* ─── Offender Type Stats ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* New Offenders */}
        <button
          onClick={() => setFilter(filter === 'new_offender' ? 'all' : 'new_offender')}
          className={`rounded-2xl p-5 border-2 transition-all duration-200 text-left ${
            filter === 'new_offender'
              ? 'border-orange-400 bg-orange-500/10 shadow-md shadow-orange-500/10'
              : 'border-gray-200/50 bg-white/80 backdrop-blur-xl hover:border-orange-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <span className="text-xs font-bold text-orange-600 uppercase tracking-wider">New Offender</span>
              <p className="text-[10px] text-gray-500 mt-0.5">Just stole — this visit</p>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{newCount}</p>
        </button>

        {/* Returning Offenders */}
        <button
          onClick={() => setFilter(filter === 'returning_offender' ? 'all' : 'returning_offender')}
          className={`rounded-2xl p-5 border-2 transition-all duration-200 text-left ${
            filter === 'returning_offender'
              ? 'border-red-500 bg-red-500/10 shadow-md shadow-red-500/10'
              : 'border-gray-200/50 bg-white/80 backdrop-blur-xl hover:border-red-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <div>
              <span className="text-xs font-bold text-red-600 uppercase tracking-wider">Returning Offender</span>
              <p className="text-[10px] text-gray-500 mt-0.5">Previously identified — back in store</p>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{returningCount}</p>
        </button>

        {/* All Active */}
        <button
          onClick={() => setFilter(filter === 'active' ? 'all' : 'active')}
          className={`rounded-2xl p-5 border-2 transition-all duration-200 text-left ${
            filter === 'active'
              ? 'border-blue-500 bg-blue-500/10 shadow-md shadow-blue-500/10'
              : 'border-gray-200/50 bg-white/80 backdrop-blur-xl hover:border-blue-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            </div>
            <div>
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Total Active</span>
              <p className="text-[10px] text-gray-500 mt-0.5">All unacknowledged alerts</p>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{activeCount}</p>
        </button>
      </div>

      {/* ─── Filter Bar ─── */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-1 bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-xl p-1">
          {([
            { key: 'all' as const, label: 'All' },
            { key: 'new_offender' as const, label: 'New' },
            { key: 'returning_offender' as const, label: 'Returning' },
            { key: 'acknowledged' as const, label: 'Resolved' },
          ]).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === f.key ? 'bg-gray-100 text-gray-900 shadow-sm' : 'text-[#86868B] hover:text-gray-900'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-[#86868B]">{filtered.length} alert{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* ─── Alert Cards ─── */}
      <div className="space-y-3">
        {filtered.map((alert) => {
          const offType = getOffenderType(alert);
          const cfg = offenderConfig[offType];
          const isExpanded = expandedTimeline === alert.id;
          const isOld = isOlderThanToday(alert.created_at);

          return (
            <div
              key={alert.id}
              className={`bg-white/80 backdrop-blur-xl rounded-2xl border-2 transition-all duration-200 overflow-hidden ${
                alert.status === 'acknowledged'
                  ? 'border-gray-200/50 opacity-60'
                  : `${cfg.border} ring-1 ${cfg.ring} hover:shadow-md`
              }`}
            >
              {/* Card Content */}
              <div className="p-5 cursor-pointer" onClick={() => setSelectedAlert(alert)}>
                <div className="flex items-start gap-4">
                  {/* Icon / Portrait */}
                  <div className={`w-14 h-14 rounded-xl ${cfg.iconBg} flex items-center justify-center shrink-0 relative`}>
                    {alert.best_portrait_path ? (
                      <img src={`${API_BASE}${alert.best_portrait_path}`} alt="" className="w-12 h-12 rounded-lg object-cover" />
                    ) : (
                      <svg className={`w-6 h-6 ${cfg.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                    )}
                    {/* Pulsing dot for active */}
                    {alert.status !== 'acknowledged' && cfg.pulse && (
                      <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cfg.dot} opacity-75`} />
                        <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${cfg.dot}`} />
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {/* Offender Type Tag */}
                      <span className={`px-2.5 py-0.5 text-[10px] rounded-full font-black uppercase tracking-wider ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      <ClassificationBadge classification={alert.theft_classification} />
                      {alert.status === 'acknowledged' && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-[#86868B]">Resolved</span>
                      )}
                      {isOld && offType === 'returning' && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600">Previously Identified</span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-gray-900 mb-0.5">{alert.title}</p>
                    <p className="text-sm text-[#86868B] mb-2 line-clamp-2">{alert.message || 'Security event detected'}</p>

                    {/* Meta row */}
                    <div className="flex items-center gap-3 text-xs text-[#86868B] flex-wrap">
                      <span className="font-medium">{formatTime(alert.created_at)}</span>
                      {alert.person_display_name && (
                        <><span className="text-gray-300">·</span><span className="font-semibold text-gray-700">{alert.person_display_name}</span></>
                      )}
                      {alert.match_confidence && (
                        <><span className="text-gray-300">·</span><span className="text-blue-500">{Math.round((alert.match_confidence > 1 ? alert.match_confidence : alert.match_confidence * 100))}% match</span></>
                      )}
                      {alert.person_total_thefts !== undefined && alert.person_total_thefts > 0 && (
                        <><span className="text-gray-300">·</span><span className="text-red-500 font-semibold">{alert.person_total_thefts} prior theft{alert.person_total_thefts > 1 ? 's' : ''}</span></>
                      )}
                      {alert.concealment_count !== undefined && alert.concealment_count > 0 && (
                        <><span className="text-gray-300">·</span><span className="text-orange-500">{alert.concealment_count} item{alert.concealment_count > 1 ? 's' : ''} concealed</span></>
                      )}
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Timeline expand toggle */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setExpandedTimeline(isExpanded ? null : alert.id); }}
                      className={`px-3 py-2 text-xs font-medium rounded-xl border transition-all flex items-center gap-1.5 ${
                        isExpanded ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
                      }`}
                      title="Show theft timeline"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Timeline
                    </button>
                    {alert.status !== 'acknowledged' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleAcknowledge(alert.id); }}
                        disabled={actionLoading === alert.id}
                        className="px-4 py-2 text-sm font-medium rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition disabled:opacity-50"
                      >
                        {actionLoading === alert.id ? '...' : 'Ack'}
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedAlert(alert); }}
                      className="px-4 py-2 text-sm font-medium rounded-xl bg-blue-500 hover:bg-blue-600 text-white transition"
                    >
                      Open
                    </button>
                  </div>
                </div>
              </div>

              {/* Expandable Theft Timeline */}
              {isExpanded && (
                <div className="px-5 pb-5">
                  <TheftTimeline alert={alert} expanded={true} />
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-16 bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700 mb-1">All Clear</p>
            <p className="text-sm text-[#86868B]">No alerts match your current filter</p>
          </div>
        )}
      </div>

      {/* ─── Legend ─── */}
      <div className="bg-white/60 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Legend</p>
        <div className="flex items-center gap-6 flex-wrap text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-orange-500" />
            <span className="text-gray-700"><strong className="text-orange-600">New Offender</strong> — Theft detected during this visit. Not yet caught.</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-600" />
            <span className="text-gray-700"><strong className="text-red-600">Returning Offender</strong> — Previously identified thief re-entering the store.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
