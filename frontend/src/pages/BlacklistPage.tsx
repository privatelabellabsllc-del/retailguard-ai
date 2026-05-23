import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Ban, User, Shield } from 'lucide-react';
import { getBlacklist, updatePerson } from '../services/api';
import type { Person } from '../types';

export default function BlacklistPage() {
  const [blacklist, setBlacklist] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBlacklist()
      .then((r) => setBlacklist(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleRemove = async (id: string) => {
    if (!confirm('Remove from blacklist? This person will no longer trigger automatic alerts.')) return;
    await updatePerson(id, { status: 'thief' });
    setBlacklist((prev) => prev.filter((p) => p.id !== id));
  };

  if (loading) return <div className="text-gray-400">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Ban className="w-6 h-6 text-red-500" /> Blacklist
        </h1>
        <span className="text-sm text-gray-500">{blacklist.length} blacklisted</span>
      </div>

      <div className="bg-red-950/20 border border-red-900/50 rounded-xl p-4 mb-6">
        <p className="text-sm text-red-300">
          <Shield className="w-4 h-4 inline mr-1" />
          Blacklisted individuals trigger an <strong>immediate alert</strong> the moment they enter any monitored location.
          The system auto-tracks them and displays their previous theft video.
        </p>
      </div>

      {blacklist.length === 0 ? (
        <div className="card text-center py-16 text-gray-500">
          No one is blacklisted yet.
        </div>
      ) : (
        <div className="space-y-3">
          {blacklist.map((person) => (
            <div key={person.id} className="card flex items-center gap-4 border-l-4 border-red-600">
              <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center shrink-0">
                {person.best_portrait_path ? (
                  <img src={person.best_portrait_path} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <User className="w-6 h-6 text-gray-500" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{person.display_name || 'Unknown Individual'}</h3>
                <p className="text-sm text-gray-500">
                  {person.total_confirmed_thefts} thefts · 
                  Last seen: {person.last_seen ? new Date(person.last_seen).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              <div className="flex gap-2">
                <Link to={`/person/${person.id}`} className="btn-outline text-sm">
                  Profile
                </Link>
                <button
                  onClick={() => handleRemove(person.id)}
                  className="text-sm text-gray-500 hover:text-gray-300 px-3 py-2"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
