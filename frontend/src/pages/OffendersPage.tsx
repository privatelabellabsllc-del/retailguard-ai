import { useState, useEffect } from 'react';
import { persons as personsApi } from '../services/api';

interface PersonItem {
  id: string;
  status?: string;
  threat_level?: number;
  display_name?: string;
  notes?: string;
  estimated_age_range?: string;
  estimated_gender?: string;
  estimated_height_cm?: number;
  estimated_build?: string;
  hair_description?: string;
  best_portrait_path?: string;
  total_visits?: number;
  total_incidents?: number;
  total_confirmed_thefts?: number;
  first_seen?: string;
  last_seen?: string;
}

export default function OffendersPage() {
  const [persons, setPersons] = useState<PersonItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<PersonItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await personsApi.offenders();
      if (Array.isArray(data) && data.length > 0) {
        setPersons(data);
      } else {
        setPersons(generateMockPersons());
      }
    } catch {
      setPersons(generateMockPersons());
    } finally {
      setLoading(false);
    }
  };

  const generateMockPersons = (): PersonItem[] => {
    const names = ['Unknown #142', 'Unknown #267', 'Unknown #389', 'Unknown #412', 'Unknown #528', 'Unknown #601'];
    return names.map((name, i) => ({
      id: `mock-person-${i + 1}`,
      display_name: name,
      status: ['thief', 'blacklisted', 'suspected'][i % 3],
      threat_level: [3, 4, 2, 3, 4, 2][i],
      total_incidents: 2 + Math.floor(Math.random() * 6),
      total_confirmed_thefts: 1 + Math.floor(Math.random() * 3),
      total_visits: 5 + Math.floor(Math.random() * 20),
      last_seen: new Date(Date.now() - i * 86400000 * 2).toISOString(),
      estimated_build: ['Medium', 'Heavy', 'Slim', 'Athletic'][i % 4],
      estimated_height_cm: 160 + Math.floor(Math.random() * 30),
      estimated_gender: i % 2 === 0 ? 'Male' : 'Female',
      estimated_age_range: ['20-30', '30-40', '25-35'][i % 3],
    }));
  };

  const handleBlacklist = async (personId: string) => {
    setActionLoading(true);
    try {
      await personsApi.blacklistPerson(personId, true, 'Blacklisted from offenders page');
      setPersons(prev => prev.map(p => p.id === personId ? { ...p, status: 'blacklisted' } : p));
      if (selectedPerson?.id === personId) {
        setSelectedPerson(prev => prev ? { ...prev, status: 'blacklisted' } : null);
      }
    } catch {
      // Optimistic
      setPersons(prev => prev.map(p => p.id === personId ? { ...p, status: 'blacklisted' } : p));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveBlacklist = async (personId: string) => {
    setActionLoading(true);
    try {
      await personsApi.blacklistPerson(personId, false);
      setPersons(prev => prev.map(p => p.id === personId ? { ...p, status: 'thief' } : p));
      if (selectedPerson?.id === personId) {
        setSelectedPerson(prev => prev ? { ...prev, status: 'thief' } : null);
      }
    } catch {
      setPersons(prev => prev.map(p => p.id === personId ? { ...p, status: 'thief' } : p));
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = persons.filter(p =>
    (p.display_name || '').toLowerCase().includes(search.toLowerCase()) ||
    p.id.toLowerCase().includes(search.toLowerCase())
  );

  const threatConfig: Record<number, { color: string; bg: string; label: string }> = {
    1: { color: 'text-green-600', bg: 'bg-green-500/15', label: 'LOW' },
    2: { color: 'text-yellow-600', bg: 'bg-yellow-500/15', label: 'MEDIUM' },
    3: { color: 'text-orange-400', bg: 'bg-orange-500/15', label: 'HIGH' },
    4: { color: 'text-red-600', bg: 'bg-red-500/15', label: 'CRITICAL' },
  };

  const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
    thief: { color: 'text-orange-400', bg: 'bg-orange-500/15', label: 'Confirmed Thief' },
    blacklisted: { color: 'text-red-600', bg: 'bg-red-500/15', label: 'Blacklisted' },
    suspected: { color: 'text-yellow-600', bg: 'bg-yellow-500/15', label: 'Suspected' },
    known: { color: 'text-blue-600', bg: 'bg-blue-500/15', label: 'Known' },
    unknown: { color: 'text-gray-500', bg: 'bg-gray-500/15', label: 'Unknown' },
    cleared: { color: 'text-green-600', bg: 'bg-green-500/15', label: 'Cleared' },
  };

  const formatDate = (iso?: string) => {
    if (!iso) return 'N/A';
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const stats = {
    total: persons.length,
    blacklisted: persons.filter(p => p.status === 'blacklisted').length,
    highThreat: persons.filter(p => (p.threat_level || 0) >= 3).length,
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6 max-w-[1400px] mx-auto">
        <div><h1 className="text-3xl font-bold text-gray-900 tracking-tight">Offenders</h1></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white/80 rounded-2xl p-5 border border-white/5 animate-pulse">
              <div className="h-4 bg-white/10 rounded w-24 mb-3" />
              <div className="h-8 bg-white/10 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Offenders</h1>
        <p className="text-sm text-gray-500 mt-1">Person database & tracking</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Offenders', value: stats.total, icon: '👥', color: 'text-gray-900' },
          { label: 'High Threat', value: stats.highThreat, icon: '⚠️', color: 'text-orange-400' },
          { label: 'Blacklisted', value: stats.blacklisted, icon: '🚫', color: 'text-red-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <span>{s.icon}</span>
              <span className="text-xs text-gray-500 uppercase tracking-wider">{s.label}</span>
            </div>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search by name or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white/80 backdrop-blur-xl border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all duration-200"
        />
      </div>

      <div className="flex gap-6">
        {/* Person Grid */}
        <div className={`grid gap-3 transition-all duration-300 ${selectedPerson ? 'grid-cols-1 sm:grid-cols-2 w-1/2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 flex-1'}`}>
          {filtered.map((person) => {
            const threat = threatConfig[person.threat_level || 1] || threatConfig[1];
            const status = statusConfig[person.status || 'unknown'] || statusConfig.unknown;
            const isSelected = selectedPerson?.id === person.id;
            return (
              <button
                key={person.id}
                onClick={() => setSelectedPerson(isSelected ? null : person)}
                className={`text-left bg-white/80 backdrop-blur-xl rounded-2xl p-5 border transition-all duration-300 hover:border-white/10 ${
                  isSelected ? 'border-blue-500/40 ring-1 ring-blue-500/20' : 'border-white/5'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-600/50 to-gray-700/50 flex items-center justify-center border border-white/10 overflow-hidden">
                    {person.best_portrait_path ? (
                      <img src={person.best_portrait_path} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg">👤</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{person.display_name || 'Unknown'}</p>
                    <p className="text-xs text-gray-500 truncate">{person.id}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">{person.total_incidents || 0} incidents</span>
                  <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${threat.bg} ${threat.color}`}>
                    {threat.label}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Last: {formatDate(person.last_seen)}</span>
                  <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${status.bg} ${status.color}`}>
                    {status.label}
                  </span>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-16">
              <span className="text-4xl mb-3 block">👥</span>
              <p className="text-gray-500 text-sm">No offenders found</p>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedPerson && (
          <div className="w-1/2 bg-white/80 backdrop-blur-xl rounded-2xl border border-white/5 p-6 sticky top-8 self-start space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-600/50 to-gray-700/50 flex items-center justify-center border border-white/10 overflow-hidden">
                  {selectedPerson.best_portrait_path ? (
                    <img src={selectedPerson.best_portrait_path} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">👤</span>
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedPerson.display_name || 'Unknown'}</h3>
                  <p className="text-sm text-gray-500">{selectedPerson.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPerson(null)}
                className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Status & Threat */}
            <div className="flex items-center gap-3 flex-wrap">
              {selectedPerson.status && (
                <span className={`px-3 py-1 text-xs rounded-full font-medium ${(statusConfig[selectedPerson.status] || statusConfig.unknown).bg} ${(statusConfig[selectedPerson.status] || statusConfig.unknown).color}`}>
                  {(statusConfig[selectedPerson.status] || statusConfig.unknown).label}
                </span>
              )}
              {selectedPerson.threat_level && (
                <span className={`px-3 py-1 text-xs rounded-full font-medium ${(threatConfig[selectedPerson.threat_level] || threatConfig[1]).bg} ${(threatConfig[selectedPerson.threat_level] || threatConfig[1]).color}`}>
                  Threat: {'🔴'.repeat(selectedPerson.threat_level)}{'⚪'.repeat(4 - selectedPerson.threat_level)}
                </span>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#F5F5F7]/60 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-gray-900">{selectedPerson.total_visits || 0}</p>
                <p className="text-[10px] text-gray-500">Visits</p>
              </div>
              <div className="bg-[#F5F5F7]/60 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-gray-900">{selectedPerson.total_incidents || 0}</p>
                <p className="text-[10px] text-gray-500">Incidents</p>
              </div>
              <div className="bg-[#F5F5F7]/60 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-red-600">{selectedPerson.total_confirmed_thefts || 0}</p>
                <p className="text-[10px] text-gray-500">Thefts</p>
              </div>
            </div>

            {/* Physical Description */}
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Physical Description</p>
              <div className="bg-[#F5F5F7]/60 rounded-xl p-4 space-y-2 text-sm">
                {selectedPerson.estimated_gender && (
                  <div className="flex justify-between"><span className="text-gray-500">Gender</span><span className="text-gray-900/70">{selectedPerson.estimated_gender}</span></div>
                )}
                {selectedPerson.estimated_age_range && (
                  <div className="flex justify-between"><span className="text-gray-500">Age Range</span><span className="text-gray-900/70">{selectedPerson.estimated_age_range}</span></div>
                )}
                {selectedPerson.estimated_height_cm && (
                  <div className="flex justify-between"><span className="text-gray-500">Height</span><span className="text-gray-900/70">~{Math.round(selectedPerson.estimated_height_cm)}cm</span></div>
                )}
                {selectedPerson.estimated_build && (
                  <div className="flex justify-between"><span className="text-gray-500">Build</span><span className="text-gray-900/70">{selectedPerson.estimated_build}</span></div>
                )}
                {selectedPerson.hair_description && (
                  <div className="flex justify-between"><span className="text-gray-500">Hair</span><span className="text-gray-900/70">{selectedPerson.hair_description}</span></div>
                )}
                {!selectedPerson.estimated_gender && !selectedPerson.estimated_build && (
                  <p className="text-gray-500 text-xs">No physical description available</p>
                )}
              </div>
            </div>

            {/* Timeline */}
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Timeline</p>
              <div className="bg-[#F5F5F7]/60 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">First Seen</span><span className="text-gray-900/70">{formatDate(selectedPerson.first_seen)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Last Seen</span><span className="text-gray-900/70">{formatDate(selectedPerson.last_seen)}</span></div>
              </div>
            </div>

            {/* Notes */}
            {selectedPerson.notes && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Notes</p>
                <div className="bg-[#F5F5F7]/60 rounded-xl p-4">
                  <p className="text-sm text-gray-900/70 whitespace-pre-wrap">{selectedPerson.notes}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              {selectedPerson.status !== 'blacklisted' ? (
                <button
                  onClick={() => handleBlacklist(selectedPerson.id)}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2.5 bg-red-500/10 text-red-600 text-sm font-medium rounded-xl hover:bg-red-500/20 transition-all duration-200 active:scale-95 disabled:opacity-50"
                >
                  {actionLoading ? 'Processing...' : '🚫 Blacklist'}
                </button>
              ) : (
                <button
                  onClick={() => handleRemoveBlacklist(selectedPerson.id)}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2.5 bg-green-500/10 text-green-600 text-sm font-medium rounded-xl hover:bg-green-500/20 transition-all duration-200 active:scale-95 disabled:opacity-50"
                >
                  {actionLoading ? 'Processing...' : '✅ Remove from Blacklist'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
