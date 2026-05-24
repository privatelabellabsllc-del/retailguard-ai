import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPerson, getPersonSightings, blacklistPerson, updatePerson } from '../services/api';
import type { Person } from '../types';

interface Sighting {
  id: string;
  timestamp: string;
  match_confidence: number | null;
  face_score: number | null;
  body_score: number | null;
  snapshot_path: string | null;
  zones_visited: string[] | null;
}

export default function PersonDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [person, setPerson] = useState<Person | null>(null);
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editNotes, setEditNotes] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!id) return;
    Promise.all([
      getPerson(id).then((r) => { setPerson(r.data); setNotes(r.data.notes || ''); }),
      getPersonSightings(id).then((r) => setSightings(r.data)),
    ])
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading || !person) return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 flex items-center justify-center">
      <p className="text-[#86868B] text-sm">Loading...</p>
    </div>
  );

  const statusConfig = {
    blacklisted: { bg: 'bg-red-500/15', text: 'text-red-400', label: 'Blacklisted' },
    thief: { bg: 'bg-amber-500/15', text: 'text-amber-500', label: 'Confirmed Thief' },
    suspected: { bg: 'bg-amber-500/15', text: 'text-amber-500', label: 'Suspected' },
    known: { bg: 'bg-blue-500/15', text: 'text-blue-500', label: 'Known Visitor' },
    unknown: { bg: 'bg-gray-100', text: 'text-[#86868B]', label: 'Unknown' },
    cleared: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Cleared' },
  };

  const config = statusConfig[person.status as keyof typeof statusConfig] || statusConfig.unknown;

  const threatDots = (level: number) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full ${i <= level ? 'bg-red-500' : 'bg-gray-200'}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 space-y-8">
      {/* Back Button */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-[#86868B] hover:text-gray-900 text-sm transition-colors duration-200">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back
      </button>

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-transparent border border-gray-200/50 rounded-2xl p-5 md:p-8 lg:p-10">
        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          <div className="w-20 h-20 md:w-28 md:h-28 bg-white/80 border border-gray-200/50 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden">
            {person.best_portrait_path ? (
              <img src={person.best_portrait_path} alt="" className="w-full h-full rounded-2xl object-cover" />
            ) : (
              <svg className="w-12 h-12 text-[#86868B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight">{person.display_name || 'Unknown Individual'}</h1>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${config.bg} ${config.text}`}>{config.label}</span>
            </div>
            <p className="text-base text-[#86868B] leading-relaxed">Full identity profile with facial recognition data, incident history, and AI-powered threat assessment.</p>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
          </div>
          <div className="mb-1">{threatDots(person.threat_level)}</div>
          <p className="text-xs text-[#86868B] mt-1">Threat Level</p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{person.total_visits}</p>
          <p className="text-xs text-[#86868B] mt-1">Total Visits</p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-red-500">{person.total_confirmed_thefts}</p>
          <p className="text-xs text-[#86868B] mt-1">Confirmed Thefts</p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{person.last_seen ? new Date(person.last_seen).toLocaleDateString() : 'N/A'}</p>
          <p className="text-xs text-[#86868B] mt-1">Last Seen</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Physical Description */}
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5 transition-all duration-200 hover:border-[#48484A]/60 hover:shadow-sm hover:shadow-black/10 group">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Physical Description</h2>
          <div className="space-y-3 text-sm">
            {person.estimated_gender && (
              <div className="flex items-center justify-between">
                <span className="text-[#86868B]">Gender</span>
                <span className="text-sm font-semibold text-gray-900">{person.estimated_gender}</span>
              </div>
            )}
            {person.estimated_age_range && (
              <div className="flex items-center justify-between">
                <span className="text-[#86868B]">Age Range</span>
                <span className="text-sm font-semibold text-gray-900">{person.estimated_age_range}</span>
              </div>
            )}
            {person.estimated_height_cm && (
              <div className="flex items-center justify-between">
                <span className="text-[#86868B]">Height</span>
                <span className="text-sm font-semibold text-gray-900">~{Math.round(person.estimated_height_cm)}cm ({Math.round(person.estimated_height_cm / 2.54 / 12)}'{Math.round((person.estimated_height_cm / 2.54) % 12)}")</span>
              </div>
            )}
            {person.estimated_build && (
              <div className="flex items-center justify-between">
                <span className="text-[#86868B]">Build</span>
                <span className="text-sm font-semibold text-gray-900">{person.estimated_build}</span>
              </div>
            )}
            {person.hair_description && (
              <div className="flex items-center justify-between">
                <span className="text-[#86868B]">Hair</span>
                <span className="text-sm font-semibold text-gray-900">{person.hair_description}</span>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5 transition-all duration-200 hover:border-[#48484A]/60 hover:shadow-sm hover:shadow-black/10 group">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Notes</h2>
            <button
              onClick={async () => {
                if (editNotes) {
                  await updatePerson(person.id, { notes });
                }
                setEditNotes(!editNotes);
              }}
              className="px-4 py-2 text-sm font-medium rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all duration-200"
            >
              {editNotes ? 'Save' : 'Edit'}
            </button>
          </div>
          {editNotes ? (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/80 border border-gray-200/50 rounded-xl text-sm text-gray-900 placeholder:text-[#636366] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-all duration-200"
              rows={4}
            />
          ) : (
            <p className="text-sm text-[#86868B] whitespace-pre-wrap">{notes || 'No notes'}</p>
          )}
        </div>
      </div>

      {/* Visit History */}
      <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-[#636366]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Visit History
        </h2>
        {sightings.length === 0 ? (
          <p className="text-[#86868B] text-sm">No sighting records</p>
        ) : (
          <div className="space-y-2">
            {sightings.map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-3 bg-gray-50/80 border border-gray-100 rounded-xl text-sm transition-all duration-200 hover:bg-gray-100/60">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <span className="text-sm font-semibold text-gray-900">{new Date(s.timestamp).toLocaleString()}</span>
                  {s.zones_visited && (
                    <span className="text-[#86868B] ml-2 text-xs">
                      Zones: {s.zones_visited.join(', ')}
                    </span>
                  )}
                </div>
                {s.match_confidence && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-500">
                    {(s.match_confidence * 100).toFixed(0)}% match
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {person.status !== 'blacklisted' && (
          <button
            onClick={async () => {
              if (confirm('Blacklist this person?')) {
                await blacklistPerson(person.id);
                setPerson({ ...person, status: 'blacklisted', threat_level: 4 });
              }
            }}
            className="px-6 py-3 text-sm font-semibold rounded-xl bg-red-500 hover:bg-red-400 text-white shadow-sm shadow-red-500/20 transition-all duration-200 active:scale-95 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            Blacklist
          </button>
        )}
        {person.status === 'blacklisted' && (
          <button
            onClick={async () => {
              if (confirm('Remove from blacklist?')) {
                await updatePerson(person.id, { status: 'thief' });
                setPerson({ ...person, status: 'thief' });
              }
            }}
            className="px-4 py-2 text-sm font-medium rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all duration-200"
          >
            Remove from Blacklist
          </button>
        )}
      </div>
    </div>
  );
}
