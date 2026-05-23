import React, { useState, useEffect } from 'react';
import { persons as personsApi } from '../services/api';

interface BlacklistedPerson {
  id: string;
  display_name?: string;
  status?: string;
  threat_level?: number;
  notes?: string;
  best_portrait_path?: string;
  total_visits?: number;
  total_incidents?: number;
  total_confirmed_thefts?: number;
  first_seen?: string;
  last_seen?: string;
  estimated_build?: string;
  estimated_height_cm?: number;
}

const StatCard: React.FC<{ label: string; value: string | number; icon: string }> = ({ label, value, icon }) => (
  <div
    className="rounded-2xl border border-white/[0.06] p-5 transition-all duration-200 hover:border-white/10"
    style={{
      background: 'rgba(44,44,46,0.5)',
      boxShadow: '0 2px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.03)',
    }}
  >
    <div className="flex items-center gap-3 mb-3">
      <span className="text-lg">{icon}</span>
      <span className="text-xs font-medium text-white/40 uppercase tracking-wider">{label}</span>
    </div>
    <p className="text-2xl font-bold text-white">{value}</p>
  </div>
);

const BlacklistPage: React.FC = () => {
  const [persons, setPersons] = useState<BlacklistedPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchId, setSearchId] = useState('');
  const [addReason, setAddReason] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [removeLoading, setRemoveLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchBlacklist();
  }, []);

  const fetchBlacklist = async () => {
    try {
      const data = await personsApi.blacklist();
      if (Array.isArray(data)) {
        setPersons(data);
      } else {
        setPersons([]);
      }
    } catch (err) {
      console.error('Failed to fetch blacklist:', err);
      setPersons([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (id: string) => {
    setRemoveLoading(id);
    try {
      await personsApi.blacklistPerson(id, false);
      setPersons((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error('Failed to remove from blacklist:', err);
    } finally {
      setRemoveLoading(null);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    try {
      await personsApi.blacklistPerson(searchId, true, addReason);
      setShowAddModal(false);
      setSearchId('');
      setAddReason('');
      fetchBlacklist();
    } catch (err) {
      console.error('Failed to add to blacklist:', err);
    } finally {
      setAddLoading(false);
    }
  };

  const highThreat = persons.filter(p => (p.threat_level || 0) >= 3).length;
  const totalThefts = persons.reduce((sum, p) => sum + (p.total_confirmed_thefts || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Blacklist</h1>
          <p className="text-sm text-white/40 mt-1">Manage blacklisted individuals</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-full text-sm font-medium text-white transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
          style={{
            background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
            boxShadow: '0 4px 14px rgba(59,130,246,0.3)',
          }}
        >
          + Add to Blacklist
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Blacklisted" value={persons.length} icon="🚫" />
        <StatCard label="High Threat" value={highThreat} icon="⚠️" />
        <StatCard label="Total Confirmed Thefts" value={totalThefts} icon="🔒" />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <svg className="animate-spin h-6 w-6 text-white/30" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : persons.length === 0 ? (
        <div className="text-center py-20">
          <span className="text-4xl mb-3 block">🛡️</span>
          <p className="text-white/40 text-sm">No blacklisted individuals</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {persons.map((person) => (
            <div
              key={person.id}
              className="rounded-2xl border border-white/[0.06] p-5 transition-all duration-200 hover:border-white/10 hover:-translate-y-0.5 group"
              style={{
                background: 'rgba(44,44,46,0.5)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.03)',
              }}
            >
              {/* Top row */}
              <div className="flex items-start gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg flex-shrink-0 overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  {person.best_portrait_path ? (
                    <img src={person.best_portrait_path} alt="" className="w-full h-full rounded-xl object-cover" />
                  ) : (
                    '👤'
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white truncate">{person.display_name || 'Unknown'}</h3>
                    {person.threat_level && person.threat_level >= 3 && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-red-300 border border-red-500/20" style={{ background: 'rgba(239,68,68,0.1)' }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                        High Threat
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/35 mt-0.5">ID: {person.id}</p>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-xs">
                  <span className="text-white/35">Threat Level</span>
                  <span className="text-white/70">
                    {person.threat_level ? '🔴'.repeat(person.threat_level) + '⚪'.repeat(4 - person.threat_level) : '—'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/35">Confirmed Thefts</span>
                  <span className="text-red-400 font-medium">{person.total_confirmed_thefts || 0}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/35">Total Incidents</span>
                  <span className="text-white/70">{person.total_incidents || 0}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/35">Last Seen</span>
                  <span className="text-white/70">
                    {person.last_seen ? new Date(person.last_seen).toLocaleDateString() : '—'}
                  </span>
                </div>
                {person.notes && (
                  <div className="flex justify-between text-xs">
                    <span className="text-white/35">Notes</span>
                    <span className="text-white/70 text-right max-w-[60%] truncate">{person.notes}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-white/[0.05]">
                <button
                  onClick={() => handleRemove(person.id)}
                  disabled={removeLoading === person.id}
                  className="flex-1 px-3 py-2 rounded-xl text-xs font-medium text-white/60 border border-white/[0.06] transition-all duration-200 hover:bg-white/[0.04] hover:text-white/80 disabled:opacity-50"
                >
                  {removeLoading === person.id ? 'Removing...' : 'Remove'}
                </button>
                <button className="flex-1 px-3 py-2 rounded-xl text-xs font-medium text-blue-400 border border-blue-500/20 transition-all duration-200 hover:bg-blue-500/10">
                  View History
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div
            className="relative w-full max-w-sm rounded-2xl border border-white/10 p-6 backdrop-blur-xl"
            style={{
              background: 'rgba(44,44,46,0.9)',
              boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
            }}
          >
            <h2 className="text-lg font-bold text-white mb-1">Add to Blacklist</h2>
            <p className="text-xs text-white/40 mb-5">Search by person ID to add to the blacklist</p>

            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5 ml-1">Person ID</label>
                <input
                  type="text"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  placeholder="Enter person ID"
                  required
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/25 border border-white/10 outline-none transition-all duration-200 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                  style={{ background: 'rgba(0,0,0,0.3)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5 ml-1">Reason</label>
                <input
                  type="text"
                  value={addReason}
                  onChange={(e) => setAddReason(e.target.value)}
                  placeholder="Reason for blacklisting"
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/25 border border-white/10 outline-none transition-all duration-200 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                  style={{ background: 'rgba(0,0,0,0.3)' }}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-full text-sm font-medium text-white/60 border border-white/10 transition-all duration-200 hover:bg-white/[0.04]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="flex-1 py-2.5 rounded-full text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)', boxShadow: '0 4px 14px rgba(239,68,68,0.3)' }}
                >
                  {addLoading ? 'Adding…' : 'Blacklist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlacklistPage;
