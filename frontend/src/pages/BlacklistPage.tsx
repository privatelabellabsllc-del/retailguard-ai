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

const StatCard: React.FC<{ label: string; value: string | number; icon: React.ReactNode; color: string }> = ({ label, value, icon, color }) => (
  <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5">
    <div className="flex items-center gap-3 mb-3">
      <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
        {icon}
      </div>
    </div>
    <p className="text-2xl font-bold text-gray-900">{value}</p>
    <p className="text-xs text-[#86868B] mt-1">{label}</p>
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
    <div className="min-h-screen p-4 md:p-6 lg:p-8 space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-red-500/10 via-rose-500/5 to-transparent border border-gray-200/50 rounded-2xl p-5 md:p-8 lg:p-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight mb-3">Banned People</h1>
            <p className="text-base text-[#86868B] leading-relaxed">Permanently banned individuals. AI auto-detects these people the moment they enter your store and triggers an immediate alert.</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 text-sm font-semibold rounded-xl bg-red-500 hover:bg-red-400 text-white shadow-sm shadow-red-500/20 transition-all duration-200 active:scale-95 flex items-center gap-2 flex-shrink-0 ml-6"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add to Blacklist
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="People Banned"
          value={persons.length}
          color="bg-red-500/10"
          icon={
            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          }
        />
        <StatCard
          label="High Threat"
          value={highThreat}
          color="bg-amber-500/10"
          icon={
            <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          }
        />
        <StatCard
          label="Total Confirmed Thefts"
          value={totalThefts}
          color="bg-purple-500/10"
          icon={
            <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          }
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <svg className="animate-spin h-6 w-6 text-gray-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : persons.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#86868B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <p className="text-[#86868B] text-sm">No blacklisted individuals</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {persons.map((person) => (
            <div
              key={person.id}
              className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5 transition-all duration-200 hover:border-[#48484A]/60 hover:shadow-sm hover:shadow-black/10 group"
            >
              {/* Top row */}
              <div className="flex items-start gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {person.best_portrait_path ? (
                    <img src={person.best_portrait_path} alt="" className="w-full h-full rounded-xl object-cover" />
                  ) : (
                    <svg className="w-6 h-6 text-[#86868B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">{person.display_name || 'Unknown'}</h3>
                    {person.threat_level && person.threat_level >= 3 && (
                      <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                        High Threat
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#86868B] mt-0.5">ID: {person.id}</p>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-xs">
                  <span className="text-[#86868B]">Threat Level</span>
                  <span className="text-gray-900 font-medium">
                    {person.threat_level ? (
                      <span className="flex items-center gap-0.5">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <span
                            key={i}
                            className={`w-2 h-2 rounded-full ${i < (person.threat_level || 0) ? 'bg-red-400' : 'bg-gray-200'}`}
                          />
                        ))}
                      </span>
                    ) : '—'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#86868B]">Confirmed Thefts</span>
                  <span className="text-red-500 font-medium">{person.total_confirmed_thefts || 0}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#86868B]">Suspicious Activity</span>
                  <span className="text-[#636366]">{person.total_incidents || 0}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#86868B]">Last Seen</span>
                  <span className="text-[#636366]">
                    {person.last_seen ? new Date(person.last_seen).toLocaleDateString() : '—'}
                  </span>
                </div>
                {person.notes && (
                  <div className="flex justify-between text-xs">
                    <span className="text-[#86868B]">Notes</span>
                    <span className="text-[#636366] text-right max-w-[60%] truncate">{person.notes}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <button
                  onClick={() => handleRemove(person.id)}
                  disabled={removeLoading === person.id}
                  className="flex-1 px-3 py-2 rounded-xl text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all duration-200 disabled:opacity-50"
                >
                  {removeLoading === person.id ? 'Removing...' : 'Remove'}
                </button>
                <button className="flex-1 px-3 py-2 rounded-xl text-xs font-medium text-blue-500 bg-blue-500/10 hover:bg-blue-500/20 transition-all duration-200">
                  View History
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-white border border-gray-200/50 rounded-2xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Ban Someone</h2>
            <p className="text-xs text-[#86868B] mb-5">Search by person ID to add to the blacklist</p>

            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#636366] mb-1.5 ml-1">Person ID</label>
                <input
                  type="text"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  placeholder="Enter person ID"
                  required
                  className="w-full px-4 py-2.5 bg-white/80 border border-gray-200/50 rounded-xl text-sm text-gray-900 placeholder:text-[#636366] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#636366] mb-1.5 ml-1">Reason</label>
                <input
                  type="text"
                  value={addReason}
                  onChange={(e) => setAddReason(e.target.value)}
                  placeholder="Reason for blacklisting"
                  className="w-full px-4 py-2.5 bg-white/80 border border-gray-200/50 rounded-xl text-sm text-gray-900 placeholder:text-[#636366] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-all duration-200"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl bg-red-500 hover:bg-red-400 text-white transition-all duration-200 disabled:opacity-50"
                >
                  {addLoading ? 'Adding...' : 'Ban This Person'}
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
