import { useEffect, useState, useRef, useCallback } from 'react';
import { cameras as camerasApi, alerts as alertsApi, persons } from '../services/api';
import type { Camera, Alert, Person } from '../types';

/* ───────────────────── SVG Icons ───────────────────── */

const ExpandIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9m11.25-5.25v4.5m0-4.5h-4.5m4.5 0L15 9m-11.25 11.25v-4.5m0 4.5h4.5m-4.5 0L9 15m11.25 5.25v-4.5m0 4.5h-4.5m4.5 0L15 15" />
  </svg>
);

const GridIcon = ({ size }: { size: number }) => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    {size === 1 ? (
      <rect x="3" y="3" width="18" height="18" rx="2" />
    ) : size === 4 ? (
      <>
        <rect x="3" y="3" width="7.5" height="7.5" rx="1" />
        <rect x="13.5" y="3" width="7.5" height="7.5" rx="1" />
        <rect x="3" y="13.5" width="7.5" height="7.5" rx="1" />
        <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1" />
      </>
    ) : (
      <>
        <rect x="3" y="3" width="5" height="5" rx="0.5" />
        <rect x="9.5" y="3" width="5" height="5" rx="0.5" />
        <rect x="16" y="3" width="5" height="5" rx="0.5" />
        <rect x="3" y="9.5" width="5" height="5" rx="0.5" />
        <rect x="9.5" y="9.5" width="5" height="5" rx="0.5" />
        <rect x="16" y="9.5" width="5" height="5" rx="0.5" />
        <rect x="3" y="16" width="5" height="5" rx="0.5" />
        <rect x="9.5" y="16" width="5" height="5" rx="0.5" />
        <rect x="16" y="16" width="5" height="5" rx="0.5" />
      </>
    )}
  </svg>
);

const PlayIcon = () => (
  <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const CameraIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
  </svg>
);

const ShieldIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.249-8.25-3.286Z" />
  </svg>
);

/* ───────────────── Demo Offender Tracking ───────────────── */

interface TrackedOffender {
  person: Person;
  currentCameraId: string;
  boundingBox: { x: number; y: number; w: number; h: number };
  enteredAt: string;
  matchConfidence: number;
  previousTheftClips: { cameraName: string; clipUrl: string; timestamp: string; description: string }[];
}

// Demo: simulate an offender being tracked across cameras
function useDemoOffenderTracking(cameraList: Camera[]): TrackedOffender | null {
  const [offender, setOffender] = useState<TrackedOffender | null>(null);

  useEffect(() => {
    if (cameraList.length === 0) return;

    // Create demo offender after 3 seconds
    const timer = setTimeout(() => {
      setOffender({
        person: {
          id: 'demo-offender-1',
          name: 'Marcus Johnson',
          display_name: 'Marcus Johnson',
          category: 'known',
          status: 'confirmed_thief',
          threat_level: 4,
          thumbnail_url: '',
          first_seen: '2025-11-15T14:30:00Z',
          last_seen: new Date().toISOString(),
          visit_count: 3,
          total_visits: 3,
          total_incidents: 2,
          total_confirmed_thefts: 2,
          estimated_age_range: '25-35',
          estimated_gender: 'Male',
          estimated_height_cm: 183,
          estimated_build: 'Medium',
          hair_description: 'Short, dark',
          tags: ['repeat-offender', 'concealment'],
          notes: 'Previously caught concealing electronics in jacket. Visits on weekends.',
          created_at: '2025-11-15T14:30:00Z',
          updated_at: new Date().toISOString(),
        },
        currentCameraId: cameraList[0].id,
        boundingBox: { x: 35, y: 25, w: 12, h: 28 },
        enteredAt: new Date().toISOString(),
        matchConfidence: 94.2,
        previousTheftClips: [
          { cameraName: 'Aisle 3 — Electronics', clipUrl: '', timestamp: '2025-12-01 14:22:15', description: 'Subject picks up wireless earbuds from shelf' },
          { cameraName: 'Aisle 3 — Close-up', clipUrl: '', timestamp: '2025-12-01 14:22:38', description: 'Subject places earbuds inside jacket pocket' },
          { cameraName: 'Front Register', clipUrl: '', timestamp: '2025-12-01 14:25:10', description: 'Subject bypasses register, walks toward exit' },
          { cameraName: 'Exit Door', clipUrl: '', timestamp: '2025-12-01 14:25:44', description: 'Subject exits store without paying' },
        ],
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, [cameraList]);

  // Simulate movement between cameras
  useEffect(() => {
    if (!offender || cameraList.length < 2) return;

    const moveInterval = setInterval(() => {
      setOffender(prev => {
        if (!prev) return prev;
        const currentIdx = cameraList.findIndex(c => c.id === prev.currentCameraId);
        const nextIdx = (currentIdx + 1) % cameraList.length;
        return {
          ...prev,
          currentCameraId: cameraList[nextIdx].id,
          boundingBox: {
            x: 20 + Math.random() * 50,
            y: 15 + Math.random() * 40,
            w: 10 + Math.random() * 5,
            h: 22 + Math.random() * 10,
          },
        };
      });
    }, 8000);

    return () => clearInterval(moveInterval);
  }, [offender, cameraList]);

  return offender;
}

/* ───────────────── Camera Feed Card ───────────────── */

function CameraFeed({
  camera,
  isTracking,
  offenderBox,
  onExpand,
  isExpanded,
}: {
  camera: Camera;
  isTracking: boolean;
  offenderBox?: { x: number; y: number; w: number; h: number };
  onExpand: () => void;
  isExpanded: boolean;
}) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className={`relative rounded-xl overflow-hidden transition-all duration-500 ${
        isTracking
          ? 'ring-4 ring-red-500 shadow-[0_0_30px_rgba(239,68,68,0.4)]'
          : 'ring-1 ring-gray-200 shadow-sm'
      } ${isExpanded ? 'col-span-full row-span-full' : ''}`}
    >
      {/* Pulsing red border effect */}
      {isTracking && (
        <div className="absolute inset-0 rounded-xl ring-4 ring-red-500 animate-pulse z-10 pointer-events-none" />
      )}

      {/* Camera feed placeholder */}
      <div className="relative bg-gray-900 aspect-video w-full">
        {/* Simulated camera feed — gradient background with noise */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-700 to-gray-900 opacity-90" />

        {/* Camera overlay grid lines */}
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />

        {/* Simulated scene elements */}
        <div className="absolute inset-0 flex items-center justify-center opacity-20">
          <CameraIcon />
        </div>

        {/* Store shelf outlines for realism */}
        <div className="absolute bottom-0 left-0 right-0 h-1/3 opacity-10">
          <div className="absolute bottom-0 left-[5%] w-[25%] h-full border-l border-t border-white/40 rounded-tl-sm" />
          <div className="absolute bottom-0 right-[5%] w-[25%] h-full border-r border-t border-white/40 rounded-tr-sm" />
          <div className="absolute bottom-[40%] left-[35%] w-[30%] h-[2px] bg-white/20" />
        </div>

        {/* ─── Offender Tracking Overlay ─── */}
        {isTracking && offenderBox && (
          <>
            {/* Bounding box */}
            <div
              className="absolute border-2 border-red-500 rounded-sm z-20 transition-all duration-700"
              style={{
                left: `${offenderBox.x}%`,
                top: `${offenderBox.y}%`,
                width: `${offenderBox.w}%`,
                height: `${offenderBox.h}%`,
              }}
            >
              {/* Corner brackets */}
              <div className="absolute -top-0.5 -left-0.5 w-3 h-3 border-t-2 border-l-2 border-red-400" />
              <div className="absolute -top-0.5 -right-0.5 w-3 h-3 border-t-2 border-r-2 border-red-400" />
              <div className="absolute -bottom-0.5 -left-0.5 w-3 h-3 border-b-2 border-l-2 border-red-400" />
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 border-b-2 border-r-2 border-red-400" />

              {/* Pulsing fill */}
              <div className="absolute inset-0 bg-red-500/10 animate-pulse" />
            </div>

            {/* Offender tag above box */}
            <div
              className="absolute z-30 transition-all duration-700"
              style={{
                left: `${offenderBox.x}%`,
                top: `${offenderBox.y - 6}%`,
              }}
            >
              <div className="flex items-center gap-1 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg whitespace-nowrap">
                <ShieldIcon />
                <span>KNOWN OFFENDER</span>
                <span className="bg-white/20 px-1.5 rounded-full">94%</span>
              </div>
            </div>

            {/* Tracking trail dots */}
            <div
              className="absolute w-1.5 h-1.5 rounded-full bg-red-400/60 z-20"
              style={{ left: `${offenderBox.x + offenderBox.w / 2 - 2}%`, top: `${offenderBox.y + offenderBox.h + 2}%` }}
            />
            <div
              className="absolute w-1 h-1 rounded-full bg-red-400/30 z-20"
              style={{ left: `${offenderBox.x + offenderBox.w / 2 - 5}%`, top: `${offenderBox.y + offenderBox.h + 5}%` }}
            />
          </>
        )}

        {/* Top bar: camera name + status */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 py-2 bg-gradient-to-b from-black/60 to-transparent z-20">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${camera.status === 'online' ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-red-400'}`} />
            <span className="text-white text-xs font-medium">{camera.name}</span>
          </div>
          {isTracking && (
            <span className="text-[10px] font-bold text-red-400 bg-red-950/80 px-2 py-0.5 rounded-full animate-pulse">
              ● TRACKING
            </span>
          )}
        </div>

        {/* Bottom bar: timestamp + REC indicator */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2 bg-gradient-to-t from-black/60 to-transparent z-20">
          <span className="text-white/70 text-[10px] font-mono">
            {time.toLocaleDateString()} {time.toLocaleTimeString()}
          </span>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-400 text-[10px] font-bold">REC</span>
          </div>
        </div>

        {/* Expand button */}
        <button
          onClick={onExpand}
          className="absolute top-2 right-2 p-1.5 bg-black/40 hover:bg-black/60 rounded-lg text-white/80 hover:text-white z-30 transition-colors"
        >
          <ExpandIcon />
        </button>
      </div>
    </div>
  );
}

/* ───────────────── Theft Video Review Modal ───────────────── */

function TheftReviewModal({
  offender,
  onClose,
  onAction,
}: {
  offender: TrackedOffender;
  onClose: () => void;
  onAction: (action: string) => void;
}) {
  const [activeClip, setActiveClip] = useState(0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col z-10">
        {/* ─── Red Alert Header ─── */}
        <div className="bg-gradient-to-r from-red-600 to-red-500 px-4 md:px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <ShieldIcon />
            </div>
            <div className="text-white">
              <h2 className="font-bold text-lg">⚠️ Known Offender Detected</h2>
              <p className="text-red-100 text-sm">
                {offender.person.display_name} · {offender.matchConfidence}% match · Entered {new Date(offender.enteredAt).toLocaleTimeString()}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors">
            <CloseIcon />
          </button>
        </div>

        {/* ─── Content ─── */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {/* Top: Person info + current tracking */}
          <div className="flex flex-col md:flex-row gap-4">
            {/* Person card */}
            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200/60 md:w-72 shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center border-2 border-red-200 shadow-lg overflow-hidden">
                  {offender.person.thumbnail_url ? (
                    <img src={offender.person.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" />
                    </svg>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{offender.person.display_name || 'Unknown'}</h3>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full mt-1">
                    CONFIRMED THIEF
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Prior Thefts</span>
                  <span className="font-bold text-red-600">{offender.person.total_confirmed_thefts}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Visits</span>
                  <span className="font-semibold text-gray-900">{offender.person.total_visits}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Height</span>
                  <span className="font-semibold text-gray-900">{offender.person.estimated_height_cm ? `${offender.person.estimated_height_cm}cm` : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Build</span>
                  <span className="font-semibold text-gray-900">{offender.person.estimated_build || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Match</span>
                  <span className="font-bold text-red-600">{offender.matchConfidence}%</span>
                </div>
              </div>

              {offender.person.notes && (
                <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200/50 text-xs text-amber-800">
                  <span className="font-semibold">Notes:</span> {offender.person.notes}
                </div>
              )}
            </div>

            {/* 4-Angle Theft Video Grid */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                  Previous Theft Evidence — 4 Camera Angles
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {offender.previousTheftClips.map((clip, idx) => (
                  <div
                    key={idx}
                    className={`rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                      activeClip === idx
                        ? 'border-red-500 shadow-lg shadow-red-500/20'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setActiveClip(idx)}
                  >
                    {/* Video placeholder */}
                    <div className="relative aspect-video bg-gray-900">
                      <div className="absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-750 to-gray-900" />

                      {/* Camera angle label */}
                      <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10">
                        <span className="bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          CAM {idx + 1}
                        </span>
                        <span className="bg-red-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          EVIDENCE
                        </span>
                      </div>

                      {/* Play button overlay */}
                      <div className="absolute inset-0 flex items-center justify-center z-10">
                        <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors">
                          <PlayIcon />
                        </div>
                      </div>

                      {/* Timestamp */}
                      <div className="absolute bottom-2 left-2 z-10">
                        <span className="text-white/80 text-[10px] font-mono bg-black/50 px-1.5 py-0.5 rounded">
                          {clip.timestamp}
                        </span>
                      </div>

                      {/* Active indicator */}
                      {activeClip === idx && (
                        <div className="absolute top-2 right-2 z-10">
                          <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                            ● PLAYING
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    <div className="px-3 py-2 bg-white">
                      <p className="text-xs font-semibold text-gray-700">{clip.cameraName}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{clip.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Timeline strip */}
          <div className="bg-gray-50 rounded-xl border border-gray-200/60 p-4">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Theft Sequence Timeline</h4>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-0">
              {offender.previousTheftClips.map((clip, idx) => (
                <div key={idx} className="flex items-center flex-1 w-full md:w-auto">
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all w-full md:w-auto ${
                      activeClip === idx ? 'bg-red-50 border border-red-200' : 'hover:bg-gray-100'
                    }`}
                    onClick={() => setActiveClip(idx)}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      activeClip === idx ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{clip.cameraName}</p>
                      <p className="text-[10px] text-gray-500 truncate">{clip.description}</p>
                    </div>
                  </div>
                  {idx < offender.previousTheftClips.length - 1 && (
                    <div className="hidden md:block w-8 h-0.5 bg-gray-200 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Action Buttons ─── */}
        <div className="shrink-0 border-t border-gray-200 bg-gray-50 px-4 md:px-6 py-4">
          <div className="flex flex-wrap gap-3 justify-end">
            <button
              onClick={() => onAction('release')}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all"
            >
              Release
            </button>
            <button
              onClick={() => onAction('paid')}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/25 transition-all"
            >
              💰 Paid
            </button>
            <button
              onClick={() => onAction('blacklist')}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-600/25 transition-all"
            >
              🚫 Blacklist
            </button>
            <button
              onClick={() => onAction('police')}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/25 transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
              </svg>
              Call 911
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────── Main: Live Monitor Page ───────────────── */

const PlusIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

const MinusIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
  </svg>
);

export default function LiveMonitorPage() {
  const [allCameras, setAllCameras] = useState<Camera[]>([]);
  const [selectedCameraIds, setSelectedCameraIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [gridSize, setGridSize] = useState<1 | 4 | 9>(9);
  const [expandedCamera, setExpandedCamera] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [showCameraPicker, setShowCameraPicker] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // The cameras shown on the grid are only selected ones
  const cameraList = allCameras.filter(c => selectedCameraIds.has(c.id));
  const offender = useDemoOffenderTracking(cameraList);

  const toggleCamera = (camId: string) => {
    setSelectedCameraIds(prev => {
      const next = new Set(prev);
      if (next.has(camId)) {
        next.delete(camId);
      } else {
        next.add(camId);
      }
      return next;
    });
  };

  const selectAll = () => setSelectedCameraIds(new Set(allCameras.map(c => c.id)));
  const clearAll = () => setSelectedCameraIds(new Set());

  // Fetch cameras
  useEffect(() => {
    const demoCams: Camera[] = [
      { id: 'cam-1', name: 'Front Entrance', location_id: '', stream_url: '', status: 'online', ai_enabled: true, created_at: '', updated_at: '' },
      { id: 'cam-2', name: 'Aisle 1 — Snacks', location_id: '', stream_url: '', status: 'online', ai_enabled: true, created_at: '', updated_at: '' },
      { id: 'cam-3', name: 'Aisle 2 — Electronics', location_id: '', stream_url: '', status: 'online', ai_enabled: true, created_at: '', updated_at: '' },
      { id: 'cam-4', name: 'Register Area', location_id: '', stream_url: '', status: 'online', ai_enabled: true, created_at: '', updated_at: '' },
      { id: 'cam-5', name: 'Back Storage', location_id: '', stream_url: '', status: 'online', ai_enabled: true, created_at: '', updated_at: '' },
      { id: 'cam-6', name: 'Exit Door', location_id: '', stream_url: '', status: 'online', ai_enabled: true, created_at: '', updated_at: '' },
      { id: 'cam-7', name: 'Parking Lot', location_id: '', stream_url: '', status: 'online', ai_enabled: true, created_at: '', updated_at: '' },
      { id: 'cam-8', name: 'Aisle 3 — Beverages', location_id: '', stream_url: '', status: 'online', ai_enabled: true, created_at: '', updated_at: '' },
      { id: 'cam-9', name: 'Manager Office', location_id: '', stream_url: '', status: 'offline', ai_enabled: false, created_at: '', updated_at: '' },
    ];

    const load = async () => {
      try {
        const data = await camerasApi.list();
        const list = Array.isArray(data) ? data : [];
        const cams = list.length >= 4 ? list : demoCams;
        setAllCameras(cams);
        // Auto-select first 4 cameras
        setSelectedCameraIds(new Set(cams.slice(0, 4).map(c => c.id)));
      } catch {
        setAllCameras(demoCams);
        setSelectedCameraIds(new Set(demoCams.slice(0, 4).map(c => c.id)));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Reset alert dismissed when new offender
  useEffect(() => {
    if (offender) setAlertDismissed(false);
  }, [offender?.person.id]);

  const handleAction = (action: string) => {
    setShowReviewModal(false);
    setAlertDismissed(true);
    // In production, would call API here
  };

  const displayCameras = expandedCamera
    ? cameraList.filter(c => c.id === expandedCamera)
    : cameraList;

  const camCount = displayCameras.length;
  const gridCols = expandedCamera
    ? 'grid-cols-1'
    : camCount <= 1
    ? 'grid-cols-1'
    : camCount <= 4
    ? 'grid-cols-1 md:grid-cols-2'
    : camCount <= 6
    ? 'grid-cols-2 md:grid-cols-3'
    : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`${isFullscreen ? 'bg-gray-950 p-4' : ''}`}>
      {/* ─── Header ─── */}
      <div className="mb-6">
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-6 md:p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">Live Monitor</h1>
                <p className="text-gray-400 mt-1">Real-time camera feeds with AI-powered offender tracking</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold px-3 py-1.5 rounded-full">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  {cameraList.filter(c => c.status === 'online').length} Online
                </div>
                {offender && !alertDismissed && (
                  <div className="flex items-center gap-1 bg-red-500/20 text-red-400 text-xs font-bold px-3 py-1.5 rounded-full animate-pulse">
                    <ShieldIcon />
                    Offender Tracking
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Toolbar ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          {/* Grid size selector */}
          <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 p-1">
            {([1, 4, 9] as const).map(size => (
              <button
                key={size}
                onClick={() => { setGridSize(size); setExpandedCamera(null); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  gridSize === size && !expandedCamera
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <GridIcon size={size} />
                {size === 1 ? '1×1' : size === 4 ? '2×2' : '3×3'}
              </button>
            ))}
          </div>

          {/* Add/Remove cameras button */}
          <button
            onClick={() => setShowCameraPicker(!showCameraPicker)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              showCameraPicker
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
            }`}
          >
            <PlusIcon />
            {showCameraPicker ? 'Done' : 'Add Cameras'}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${showCameraPicker ? 'bg-white/20' : 'bg-blue-50 text-blue-600'}`}>
              {selectedCameraIds.size}/{allCameras.length}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {expandedCamera && (
            <button
              onClick={() => setExpandedCamera(null)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              ← Back to Grid
            </button>
          )}
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <ExpandIcon />
            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
        </div>
      </div>

      {/* ─── Camera Picker Panel ─── */}
      {showCameraPicker && (
        <div className="mb-4 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-slide-up">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Select Cameras for Monitor</h3>
              <p className="text-xs text-gray-500 mt-0.5">Click cameras to add or remove them from your live view</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={selectAll}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
              >
                Select All
              </button>
              <button
                onClick={clearAll}
                className="text-xs font-medium text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {allCameras.map(cam => {
              const isSelected = selectedCameraIds.has(cam.id);
              const isOnline = cam.status === 'online';
              const isTrackingThis = offender?.currentCameraId === cam.id && !alertDismissed;
              return (
                <button
                  key={cam.id}
                  onClick={() => toggleCamera(cam.id)}
                  className={`relative group rounded-xl border-2 p-3 text-left transition-all ${
                    isSelected
                      ? isTrackingThis
                        ? 'border-red-500 bg-red-50 shadow-md shadow-red-500/10'
                        : 'border-blue-500 bg-blue-50 shadow-md shadow-blue-500/10'
                      : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-white'
                  }`}
                >
                  {/* Camera preview mini */}
                  <div className={`w-full aspect-video rounded-lg mb-2 flex items-center justify-center ${
                    isOnline ? 'bg-gray-800' : 'bg-gray-300'
                  }`}>
                    <div className="text-center">
                      <CameraIcon />
                      {isTrackingThis && (
                        <div className="mt-1">
                          <span className="text-[8px] font-bold text-red-400 bg-red-950/80 px-1.5 py-0.5 rounded-full animate-pulse">
                            ● TRACKING
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Camera info */}
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">{cam.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-gray-400'}`} />
                        <span className={`text-[10px] ${isOnline ? 'text-emerald-600' : 'text-gray-400'}`}>
                          {isOnline ? 'Online' : 'Offline'}
                        </span>
                        {cam.ai_enabled && (
                          <span className="text-[10px] text-blue-500 font-medium">· AI</span>
                        )}
                      </div>
                    </div>

                    {/* Selection indicator */}
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-400 group-hover:bg-gray-300'
                    }`}>
                      {isSelected ? <CheckIcon /> : <PlusIcon />}
                    </div>
                  </div>

                  {/* Remove overlay on hover when selected */}
                  {isSelected && (
                    <div className="absolute inset-0 rounded-xl bg-red-500/0 group-hover:bg-red-500/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all pointer-events-none">
                      <div className="bg-white/90 backdrop-blur-sm rounded-full p-1 shadow-lg">
                        <MinusIcon />
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Empty State (no cameras selected) ─── */}
      {cameraList.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <CameraIcon />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">No cameras selected</h3>
          <p className="text-sm text-gray-500 mb-4">Click "Add Cameras" to select which feeds to display</p>
          <button
            onClick={() => setShowCameraPicker(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/25 transition-all"
          >
            <PlusIcon />
            Add Cameras
          </button>
        </div>
      )}

      {/* ─── Camera Grid ─── */}
      <div className={`grid ${gridCols} gap-3`}>
        {displayCameras.map(camera => (
          <CameraFeed
            key={camera.id}
            camera={camera}
            isTracking={offender?.currentCameraId === camera.id && !alertDismissed}
            offenderBox={offender?.currentCameraId === camera.id ? offender.boundingBox : undefined}
            onExpand={() => setExpandedCamera(expandedCamera === camera.id ? null : camera.id)}
            isExpanded={expandedCamera === camera.id}
          />
        ))}
      </div>

      {/* ─── Bottom Offender Alert Bar ─── */}
      {offender && !alertDismissed && !showReviewModal && (
        <div className="fixed bottom-0 left-0 right-0 z-40 md:left-64 animate-slide-up">
          <div className="bg-gradient-to-r from-red-600 to-red-500 shadow-2xl shadow-red-500/30">
            <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                {/* Person avatar */}
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0 border-2 border-white/30">
                  <svg className="w-6 h-6 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold text-sm truncate">{offender.person.display_name}</span>
                    <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                      {offender.matchConfidence}% MATCH
                    </span>
                  </div>
                  <p className="text-red-100 text-xs truncate">
                    Known offender · {offender.person.total_confirmed_thefts} prior thefts · Currently on{' '}
                    {cameraList.find(c => c.id === offender.currentCameraId)?.name || 'Camera'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setAlertDismissed(true)}
                  className="px-3 py-2 rounded-lg text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors hidden md:block"
                >
                  Dismiss
                </button>
                <button
                  onClick={() => setShowReviewModal(true)}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-white text-red-600 hover:bg-red-50 shadow-lg transition-all flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                  Review Theft
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Theft Review Modal ─── */}
      {showReviewModal && offender && (
        <TheftReviewModal
          offender={offender}
          onClose={() => setShowReviewModal(false)}
          onAction={handleAction}
        />
      )}

      {/* Slide-up animation */}
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slide-up 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}
