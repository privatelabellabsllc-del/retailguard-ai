import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  User, Ban, ArrowLeft, Clock, MapPin, AlertTriangle, Eye
} from 'lucide-react';
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

  if (loading || !person) return <div className="text-gray-400">Loading...</div>;

  const statusConfig = {
    blacklisted: { color: 'badge-danger', label: '⛔ Blacklisted' },
    thief: { color: 'badge-warning', label: '⚠️ Confirmed Thief' },
    suspected: { color: 'badge-warning', label: '🔍 Suspected' },
    known: { color: 'badge-info', label: '👤 Known Visitor' },
    unknown: { color: 'badge-info', label: '❓ Unknown' },
    cleared: { color: 'badge-success', label: '✅ Cleared' },
  };

  const config = statusConfig[person.status as keyof typeof statusConfig] || statusConfig.unknown;

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 hover:text-gray-300 mb-4 text-sm">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Header */}
      <div className="card mb-6">
        <div className="flex gap-6">
          <div className="w-28 h-28 bg-gray-800 rounded-xl flex items-center justify-center shrink-0">
            {person.best_portrait_path ? (
              <img src={person.best_portrait_path} alt="" className="w-full h-full rounded-xl object-cover" />
            ) : (
              <User className="w-12 h-12 text-gray-600" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold">{person.display_name || 'Unknown Individual'}</h1>
              <span className={`badge ${config.color}`}>{config.label}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Threat Level</span>
                <p className="font-medium">{'🔴'.repeat(person.threat_level)}{'⚪'.repeat(4 - person.threat_level)}</p>
              </div>
              <div>
                <span className="text-gray-500">Total Visits</span>
                <p className="font-medium">{person.total_visits}</p>
              </div>
              <div>
                <span className="text-gray-500">Confirmed Thefts</span>
                <p className="font-medium text-red-400">{person.total_confirmed_thefts}</p>
              </div>
              <div>
                <span className="text-gray-500">Last Seen</span>
                <p className="font-medium">{person.last_seen ? new Date(person.last_seen).toLocaleDateString() : 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Physical Description */}
        <div className="card">
          <h3 className="font-semibold mb-3">Physical Description</h3>
          <div className="space-y-2 text-sm">
            {person.estimated_gender && <p><span className="text-gray-500">Gender:</span> {person.estimated_gender}</p>}
            {person.estimated_age_range && <p><span className="text-gray-500">Age Range:</span> {person.estimated_age_range}</p>}
            {person.estimated_height_cm && <p><span className="text-gray-500">Height:</span> ~{Math.round(person.estimated_height_cm)}cm ({Math.round(person.estimated_height_cm / 2.54 / 12)}'{Math.round((person.estimated_height_cm / 2.54) % 12)}")</p>}
            {person.estimated_build && <p><span className="text-gray-500">Build:</span> {person.estimated_build}</p>}
            {person.hair_description && <p><span className="text-gray-500">Hair:</span> {person.hair_description}</p>}
          </div>
        </div>

        {/* Notes */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Notes</h3>
            <button
              onClick={async () => {
                if (editNotes) {
                  await updatePerson(person.id, { notes });
                }
                setEditNotes(!editNotes);
              }}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              {editNotes ? 'Save' : 'Edit'}
            </button>
          </div>
          {editNotes ? (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              rows={4}
            />
          ) : (
            <p className="text-sm text-gray-400 whitespace-pre-wrap">{notes || 'No notes'}</p>
          )}
        </div>
      </div>

      {/* Visit History */}
      <div className="card mt-6">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Eye className="w-4 h-4" /> Visit History
        </h3>
        {sightings.length === 0 ? (
          <p className="text-gray-500 text-sm">No sighting records</p>
        ) : (
          <div className="space-y-2">
            {sightings.map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg text-sm">
                <Clock className="w-4 h-4 text-gray-600 shrink-0" />
                <div className="flex-1">
                  <span>{new Date(s.timestamp).toLocaleString()}</span>
                  {s.zones_visited && (
                    <span className="text-gray-500 ml-2">
                      Zones: {s.zones_visited.join(', ')}
                    </span>
                  )}
                </div>
                {s.match_confidence && (
                  <span className="text-xs text-gray-500">
                    {(s.match_confidence * 100).toFixed(0)}% match
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-6">
        {person.status !== 'blacklisted' && (
          <button
            onClick={async () => {
              if (confirm('Blacklist this person?')) {
                await blacklistPerson(person.id);
                setPerson({ ...person, status: 'blacklisted', threat_level: 4 });
              }
            }}
            className="btn-danger flex items-center gap-2"
          >
            <Ban className="w-4 h-4" /> Blacklist
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
            className="btn-outline"
          >
            Remove from Blacklist
          </button>
        )}
      </div>
    </div>
  );
}
