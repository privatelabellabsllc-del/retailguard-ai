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
  // Journey / classification
  theft_classification?: string;
  classification_reason?: string;
  visited_register?: boolean;
  concealment_count?: number;
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

type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';
type StatusFilter = 'all' | 'active' | 'acknowledged';

const API_BASE = import.meta.env.VITE_API_URL || '';

/* ─── Classification Badge ─── */
const classificationConfig: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  likely_theft: { label: 'LIKELY THEFT', color: 'text-red-600', bg: 'bg-red-500/15', icon: '🚨' },
  grab_and_run: { label: 'GRAB & RUN', color: 'text-red-700', bg: 'bg-red-600/20', icon: '🏃' },
  partial_theft: { label: 'PARTIAL THEFT', color: 'text-orange-600', bg: 'bg-orange-500/15', icon: '⚠️' },
  likely_paid: { label: 'LIKELY PAID', color: 'text-emerald-600', bg: 'bg-emerald-500/15', icon: '✅' },
  under_review: { label: 'UNDER REVIEW', color: 'text-blue-600', bg: 'bg-blue-500/15', icon: '🔍' },
  cleared: { label: 'CLEARED', color: 'text-gray-500', bg: 'bg-gray-500/15', icon: '✓' },
};

function ClassificationBadge({ classification }: { classification?: string }) {
  if (!classification) return null;
  const cfg = classificationConfig[classification] || classificationConfig.under_review;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${cfg.bg} ${cfg.color}`}>
      <span>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}


/* ═══════════════════════════════════════════
   OFFENDER RE-ENTRY MODAL
   The centerpiece — shows when a known offender
   is detected back in the store
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

  // Manual entry form
  const [manualForm, setManualForm] = useState({
    full_name: '',
    date_of_birth: '',
    address: '',
    phone_number: '',
    drivers_license: '',
    notes: '',
    estimated_height_cm: '',
    hair_description: '',
    estimated_build: '',
  });

  // ID photo upload
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idPreview, setIdPreview] = useState<string | null>(null);
  const [idType, setIdType] = useState('drivers_license');
  const [uploadingId, setUploadingId] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadPerson();
  }, [alert.person_id]);

  const loadPerson = async () => {
    if (!alert.person_id) { setLoading(false); return; }
    try {
      const data = await personsApi.get(alert.person_id);
      setPerson(data);
      // Pre-fill manual form with existing data
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
      if (data.id_photo_path) {
        setIdPreview(`${API_BASE}${data.id_photo_path}`);
      }
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
      if (payload.estimated_height_cm) {
        payload.estimated_height_cm = parseInt(payload.estimated_height_cm);
      } else {
        delete payload.estimated_height_cm;
      }
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
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[92vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── Red Alert Header ─── */}
        <div className="bg-gradient-to-r from-red-600 to-red-500 px-8 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {alert.person_display_name || 'Unknown Person'} — Re-Entry Detected
              </h2>
              <p className="text-red-100 text-sm mt-0.5">
                Known offender identified in store · {alert.match_confidence
                  ? `${Math.round((alert.match_confidence > 1 ? alert.match_confidence : alert.match_confidence * 100))}% match confidence`
                  : 'AI match confirmed'
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
        <div className="flex-1 overflow-y-auto p-8">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-10 h-10 border-4 border-red-200 border-t-red-500 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* ─── Top Row: Person Photo + Info + Video ─── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Person Photo & Identity */}
                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200/60">
                  <div className="flex gap-5">
                    {/* Portrait */}
                    <div className="shrink-0">
                      {portraitUrl ? (
                        <img
                          src={portraitUrl}
                          alt="Subject"
                          className="w-28 h-28 rounded-2xl object-cover border-2 border-red-200 shadow-lg"
                        />
                      ) : (
                        <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center border-2 border-gray-200">
                          <svg className="w-14 h-14 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Person Details */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-gray-900 mb-1">
                        {person?.full_name || person?.display_name || 'Unidentified'}
                      </h3>
                      <div className="space-y-1.5 text-sm">
                        {person?.status && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">Status:</span>
                            <span className={`font-semibold ${
                              person.status === 'confirmed_thief' ? 'text-red-600' :
                              person.status === 'blacklisted' ? 'text-purple-600' :
                              'text-gray-700'
                            }`}>
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
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">Build:</span>
                            <span className="text-gray-700">{person.estimated_build}</span>
                          </div>
                        )}
                        {person?.hair_description && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">Hair:</span>
                            <span className="text-gray-700">{person.hair_description}</span>
                          </div>
                        )}
                      </div>

                      {/* Threat Level */}
                      {(person?.threat_level || alert.person_threat_level) && (
                        <div className="mt-3 flex items-center gap-2">
                          <span className="text-xs text-gray-500 font-medium">Threat:</span>
                          <div className="flex gap-1">
                            {Array.from({ length: 5 }, (_, i) => (
                              <span
                                key={i}
                                className={`w-3 h-3 rounded-full ${
                                  i < (person?.threat_level || alert.person_threat_level || 0)
                                    ? 'bg-red-500'
                                    : 'bg-gray-200'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Classification */}
                  {alert.theft_classification && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <ClassificationBadge classification={alert.theft_classification} />
                        {alert.concealment_count && alert.concealment_count > 0 && (
                          <span className="text-xs text-gray-500">
                            {alert.concealment_count} item{alert.concealment_count > 1 ? 's' : ''} concealed
                          </span>
                        )}
                      </div>
                      {alert.classification_reason && (
                        <p className="mt-2 text-xs text-gray-500 leading-relaxed">
                          {alert.classification_reason}
                        </p>
                      )}
                      {alert.visited_register !== undefined && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${alert.visited_register ? 'bg-emerald-400' : 'bg-red-400'}`} />
                          <span className="text-xs text-gray-500">
                            {alert.visited_register ? 'Visited register' : 'Did NOT visit register'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: Previous Theft Video */}
                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200/60">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    Previous Theft Evidence
                  </h4>
                  {alert.reference_clip_url ? (
                    <video
                      src={`${API_BASE}${alert.reference_clip_url}`}
                      controls
                      className="w-full rounded-xl bg-black aspect-video"
                      poster={alert.current_snapshot_path ? `${API_BASE}${alert.current_snapshot_path}` : undefined}
                    />
                  ) : (
                    <div className="w-full aspect-video rounded-xl bg-gray-200 flex flex-col items-center justify-center">
                      <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                      <p className="text-sm text-gray-400">No previous theft clip available</p>
                      <p className="text-xs text-gray-400 mt-1">Clip will appear here after first confirmed theft</p>
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
                        activeTab === tab.key
                          ? 'bg-white text-gray-900 border-b-2 border-blue-500'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
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
                  {/* Overview Tab */}
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

                      {/* ID on file */}
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

                      {/* Personal info if available */}
                      {(person?.full_name || person?.date_of_birth || person?.address || person?.phone_number) && (
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200/50">
                          <p className="text-sm font-medium text-gray-700 mb-3">Personal Information On File</p>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            {person.full_name && (
                              <div><span className="text-gray-500">Name:</span> <span className="font-medium text-gray-900">{person.full_name}</span></div>
                            )}
                            {person.date_of_birth && (
                              <div><span className="text-gray-500">DOB:</span> <span className="font-medium text-gray-900">{person.date_of_birth}</span></div>
                            )}
                            {person.address && (
                              <div className="col-span-2"><span className="text-gray-500">Address:</span> <span className="font-medium text-gray-900">{person.address}</span></div>
                            )}
                            {person.phone_number && (
                              <div><span className="text-gray-500">Phone:</span> <span className="font-medium text-gray-900">{person.phone_number}</span></div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ID Capture Tab */}
                  {activeTab === 'id' && (
                    <div className="space-y-5">
                      <p className="text-sm text-gray-500">Take a photo of the customer's ID or upload an existing image. This will be stored with their record.</p>

                      {/* ID Type Selector */}
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
                                idType === opt.value
                                  ? 'bg-blue-500 text-white border-blue-500'
                                  : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Upload Area */}
                      <div
                        className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              setIdFile(f);
                              setIdPreview(URL.createObjectURL(f));
                            }
                          }}
                        />
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
                        <button
                          onClick={handleIdUpload}
                          disabled={uploadingId}
                          className="w-full py-3 bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 transition disabled:opacity-50"
                        >
                          {uploadingId ? 'Uploading...' : 'Save ID Photo'}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Manual Entry Tab */}
                  {activeTab === 'manual' && (
                    <div className="space-y-5">
                      <p className="text-sm text-gray-500">Enter or update customer/offender information manually.</p>

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
                        <input
                          type="text"
                          placeholder="123 Main St, City, State ZIP"
                          value={manualForm.address}
                          onChange={(e) => setManualForm({ ...manualForm, address: e.target.value })}
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes / Distinguishing Marks</label>
                        <textarea
                          placeholder="Tattoos, scars, clothing description, behavior notes..."
                          value={manualForm.notes}
                          onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                          rows={3}
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition bg-white resize-none"
                        />
                      </div>

                      <button
                        onClick={handleManualSave}
                        disabled={actionLoading === 'save'}
                        className="w-full py-3 bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 transition disabled:opacity-50"
                      >
                        {actionLoading === 'save' ? 'Saving...' : 'Save Information'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── Action Bar (always visible at bottom) ─── */}
        <div className="border-t border-gray-200 bg-gray-50 px-8 py-5 shrink-0">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Choose an action:</p>
            <div className="flex items-center gap-3">
              {/* Call Police */}
              <button
                onClick={() => handleAction('call_police')}
                disabled={!!actionLoading}
                className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-red-500/25"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
                Call Police
              </button>

              {/* Paid */}
              <button
                onClick={() => handleAction('paid')}
                disabled={!!actionLoading}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Paid
              </button>

              {/* Release */}
              <button
                onClick={() => handleAction('release')}
                disabled={!!actionLoading}
                className="flex items-center gap-2 px-6 py-3 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition-all active:scale-95 disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
                Release
              </button>

              {/* Blacklist */}
              <button
                onClick={() => handleAction('blacklist')}
                disabled={!!actionLoading}
                className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-all active:scale-95 disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
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
   MAIN ALERTS PAGE
   ═══════════════════════════════════════════ */
export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);

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
      person_threat_level: 4,
      person_total_thefts: 3,
      alert_type: 'known_offender',
      priority: 'critical',
      status: 'active',
      title: 'Known Offender Re-Entry',
      message: 'Previously confirmed thief detected entering the store. 3 prior theft incidents on record.',
      match_confidence: 0.94,
      theft_classification: 'likely_theft',
      classification_reason: 'Subject concealed 2 items, bypassed register, heading toward exit.',
      visited_register: false,
      concealment_count: 2,
    },
  ];

  const handleAcknowledge = async (id: string) => {
    setActionLoading(id);
    try {
      await alertsApi.acknowledge(id);
    } catch { /* ok */ }
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'acknowledged' } : a));
    setActionLoading(null);
  };

  const handleAlertAction = async (action: string, data?: any) => {
    if (!selectedAlert) return;
    try {
      await alertsApi.action(selectedAlert.id, action, data);
    } catch { /* ok */ }
    setAlerts(prev => prev.map(a => a.id === selectedAlert.id ? { ...a, status: 'acknowledged' } : a));
    setSelectedAlert(null);
    await loadData();
  };

  const severityConfig: Record<string, { color: string; bg: string; border: string; dot: string }> = {
    critical: { color: 'text-red-600', bg: 'bg-red-500/15', border: 'border-red-500/30', dot: 'bg-red-500' },
    high: { color: 'text-orange-600', bg: 'bg-orange-500/15', border: 'border-orange-500/30', dot: 'bg-orange-500' },
    medium: { color: 'text-amber-600', bg: 'bg-amber-500/15', border: 'border-amber-500/30', dot: 'bg-amber-500' },
    low: { color: 'text-blue-600', bg: 'bg-blue-500/15', border: 'border-blue-500/30', dot: 'bg-blue-500' },
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const isKnownOffender = (a: AlertItem) =>
    a.alert_type?.includes('offender') || a.alert_type?.includes('known') || (a.person_threat_level && a.person_threat_level >= 3);

  const filtered = alerts.filter(a => {
    if (severityFilter !== 'all' && a.priority !== severityFilter) return false;
    if (statusFilter === 'active' && a.status !== 'active') return false;
    if (statusFilter === 'acknowledged' && a.status !== 'acknowledged') return false;
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen p-6 lg:p-8 space-y-8">
        <div className="bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-transparent border border-gray-200/50 rounded-2xl p-8 lg:p-10">
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight mb-3">Alerts</h1>
          <p className="text-base text-[#86868B]">Loading alert data...</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5 animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-16 mb-2" />
              <div className="h-7 bg-gray-200 rounded w-10" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 lg:p-8 space-y-8">
      {/* Offender Modal */}
      {selectedAlert && (
        <OffenderModal
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onAction={handleAlertAction}
        />
      )}

      {/* Hero */}
      <div className="bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-transparent border border-gray-200/50 rounded-2xl p-8 lg:p-10">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight mb-3">Alerts</h1>
            <p className="text-base text-[#86868B] leading-relaxed max-w-2xl">
              Live alerts from the AI detection pipeline. Known offenders, theft classifications, and suspicious activity. Click any alert to open the full action panel.
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

      {/* Severity Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['critical', 'high', 'medium', 'low'] as const).map((sev) => {
          const count = alerts.filter(a => a.priority === sev && a.status !== 'acknowledged').length;
          const cfg = severityConfig[sev];
          return (
            <button
              key={sev}
              onClick={() => setSeverityFilter(severityFilter === sev ? 'all' : sev)}
              className={`rounded-2xl p-5 border transition-all duration-200 text-left ${
                severityFilter === sev ? `${cfg.bg} ${cfg.border}` : 'bg-white/80 backdrop-blur-xl border-gray-200/50 hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                <span className={`text-xs uppercase tracking-wider font-semibold ${cfg.color}`}>{sev}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{count}</p>
              <p className="text-xs text-[#86868B] mt-1">Active</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex gap-1 bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-xl p-1">
          {(['all', 'active', 'acknowledged'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                statusFilter === s ? 'bg-gray-100 text-gray-900 shadow-sm' : 'text-[#86868B] hover:text-gray-900'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <span className="text-xs text-[#86868B]">{filtered.length} alerts</span>
      </div>

      {/* Alert Cards */}
      <div className="space-y-3">
        {filtered.map((alert) => {
          const cfg = severityConfig[alert.priority] || severityConfig.medium;
          const offender = isKnownOffender(alert);
          return (
            <div
              key={alert.id}
              onClick={() => setSelectedAlert(alert)}
              className={`bg-white/80 backdrop-blur-xl rounded-2xl p-5 border transition-all duration-200 cursor-pointer hover:shadow-md group ${
                offender
                  ? 'border-red-400/50 ring-1 ring-red-500/10 hover:border-red-500/60'
                  : alert.status === 'acknowledged'
                    ? 'border-gray-200/50 opacity-60'
                    : 'border-gray-200/50 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={`w-12 h-12 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}>
                  {alert.best_portrait_path ? (
                    <img src={`${API_BASE}${alert.best_portrait_path}`} alt="" className="w-10 h-10 rounded-lg object-cover" />
                  ) : (
                    <svg className={`w-5 h-5 ${cfg.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                    </svg>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{alert.title}</p>
                    <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${cfg.bg} ${cfg.color}`}>
                      {alert.priority.toUpperCase()}
                    </span>
                    {offender && (
                      <span className="px-2 py-0.5 text-[10px] rounded-full font-bold bg-red-500/15 text-red-600 animate-pulse">
                        KNOWN OFFENDER
                      </span>
                    )}
                    <ClassificationBadge classification={alert.theft_classification} />
                    {alert.status === 'acknowledged' && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-[#86868B]">Acknowledged</span>
                    )}
                  </div>
                  <p className="text-sm text-[#86868B] mb-2">{alert.message || 'Security event detected'}</p>
                  <div className="flex items-center gap-3 text-xs text-[#86868B] flex-wrap">
                    <span>{formatTime(alert.created_at)}</span>
                    {alert.person_display_name && (
                      <><span className="text-gray-300">·</span><span className="text-purple-500">{alert.person_display_name}</span></>
                    )}
                    {alert.match_confidence && (
                      <><span className="text-gray-300">·</span><span className="text-blue-500">{Math.round((alert.match_confidence > 1 ? alert.match_confidence : alert.match_confidence * 100))}% match</span></>
                    )}
                    {alert.person_total_thefts !== undefined && alert.person_total_thefts > 0 && (
                      <><span className="text-gray-300">·</span><span className="text-red-500">{alert.person_total_thefts} prior theft{alert.person_total_thefts > 1 ? 's' : ''}</span></>
                    )}
                    {alert.concealment_count !== undefined && alert.concealment_count > 0 && (
                      <><span className="text-gray-300">·</span><span className="text-orange-500">{alert.concealment_count} item{alert.concealment_count > 1 ? 's' : ''} concealed</span></>
                    )}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-2 shrink-0">
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
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-16 bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <p className="text-sm text-[#86868B]">All clear — no alerts match your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
