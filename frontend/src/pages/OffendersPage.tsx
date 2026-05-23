import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, User, ChevronRight, Ban } from 'lucide-react';
import { getOffenders, blacklistPerson } from '../services/api';
import type { Person } from '../types';

export default function OffendersPage() {
  const [offenders, setOffenders] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOffenders()
      .then((r) => setOffenders(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleBlacklist = async (id: string) => {
    if (!confirm('Are you sure you want to blacklist this person?')) return;
    await blacklistPerson(id);
    setOffenders((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'blacklisted', threat_level: 4 } : p))
    );
  };

  if (loading) return <div className="text-gray-400">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Users className="w-6 h-6" /> Known Offenders
      </h1>

      {offenders.length === 0 ? (
        <div className="card text-center py-16 text-gray-500">
          No known offenders in the system.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {offenders.map((person) => (
            <div key={person.id} className="card hover:border-gray-700 transition-colors">
              <div className="flex items-center gap-4 mb-3">
                <div className="w-14 h-14 bg-gray-800 rounded-full flex items-center justify-center shrink-0">
                  {person.best_portrait_path ? (
                    <img src={person.best_portrait_path} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <User className="w-7 h-7 text-gray-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{person.display_name || 'Unknown'}</h3>
                  <span className={`badge text-xs ${
                    person.status === 'blacklisted' ? 'badge-danger' : 'badge-warning'
                  }`}>
                    {person.status === 'blacklisted' ? '⛔ Blacklisted' : '⚠️ Confirmed Thief'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-sm mb-3">
                <div className="bg-gray-800/50 rounded p-2">
                  <p className="font-bold text-red-400">{person.total_confirmed_thefts}</p>
                  <p className="text-xs text-gray-500">Thefts</p>
                </div>
                <div className="bg-gray-800/50 rounded p-2">
                  <p className="font-bold">{person.total_visits}</p>
                  <p className="text-xs text-gray-500">Visits</p>
                </div>
                <div className="bg-gray-800/50 rounded p-2">
                  <p className="font-bold">{'🔴'.repeat(person.threat_level)}</p>
                  <p className="text-xs text-gray-500">Threat</p>
                </div>
              </div>

              <div className="text-xs text-gray-500 space-y-1 mb-3">
                {person.estimated_height_cm && <p>Height: ~{Math.round(person.estimated_height_cm)}cm</p>}
                {person.estimated_build && <p>Build: {person.estimated_build}</p>}
                {person.last_seen && <p>Last seen: {new Date(person.last_seen).toLocaleDateString()}</p>}
              </div>

              <div className="flex gap-2">
                <Link to={`/person/${person.id}`} className="btn-outline text-xs flex-1 text-center">
                  View Profile
                </Link>
                {person.status !== 'blacklisted' && (
                  <button
                    onClick={() => handleBlacklist(person.id)}
                    className="btn-danger text-xs flex items-center gap-1"
                  >
                    <Ban className="w-3 h-3" /> Blacklist
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
