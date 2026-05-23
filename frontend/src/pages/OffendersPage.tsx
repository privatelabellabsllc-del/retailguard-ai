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
    1: { color: 'text-emerald-400', bg: 'bg-emerald-500/15', label: 'LOW' },
    2: { color: 'text-amber-500', bg: 'bg-amber-500/15', label: 'MEDIUM' },
    3: { color: 'text-orange-400', bg: 'bg-orange-500/15', label: 'HIGH' },
    4: { color: 'text-red-400', bg: 'bg-red-500/15', label: 'CRITICAL' },
  };

  const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
    thief: { color: 'text-orange-400', bg: 'bg-orange-500/15', label: 'Confirmed Thief' },
    blacklisted: { color: 'text-red-400', bg: 'bg-red-500/15', label: 'Blacklisted' },
    suspected: { color: 'text-amber-500', bg: 'bg-amber-500/15', label: 'Suspected' },
    known: { color: 'text-blue-500', bg: 'bg-blue-500/15', label: 'Known' },
    unknown: { color: 'text-[#86868B]', bg: 'bg-gray-100', label: 'Unknown' },
    cleared: { color: 'text-emerald-400', bg: 'bg-emerald-500/15', label: 'Cleared' },
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

  const renderThreatDots = (level: number) => {
    return (
      <span className="flex items-center gap-0.5">
        {[1, 2, 3, 4].map(i => (
          <span
            key={i}
            className={`w-2 h-2 rounded-full ${i <= level ? 'bg-red-400' : 'bg-gray-200'}`}
          />
        ))}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen p-6 lg:p-8 space-y-8">
        <div className="bg-gradient-to-br from-orange-500/10 via-red-500/5 to-transparent border border-gray-200/50 rounded-2xl p-8 lg:p-10">
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight mb-3">Offenders</h1>
          <p className="text-base text-[#86868B] leading-relaxed">Known offenders identified by the AI system. Each profile includes facial recognition data, incident history, and threat assessment.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-24 mb-3" />
              <div className="h-8 bg-gray-100 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 lg:p-8 space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-orange-500/10 via-red-500/5 to-transparent border border-gray-200/50 rounded-2xl p-8 lg:p-10">
        <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight mb-3">Offenders</h1>
        <p className="text-base text-[#86868B] leading-relaxed">Known offenders identified by the AI system. Each profile includes facial recognition data, incident history, and threat assessment.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-xs text-[#86868B] mt-1">Total Offenders</p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-orange-400">{stats.highThreat}</p>
          <p className="text-xs text-[#86868B] mt-1">High Threat</p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-red-400">{stats.blacklisted}</p>
          <p className="text-xs text-[#86868B] mt-1">Blacklisted</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search by name or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 pl-11 bg-white/80 border border-gray-200/50 rounded-xl text-sm text-gray-900 placeholder:text-[#636366] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-all duration-200"
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
                className={`text-left bg-white/80 backdrop-blur-xl rounded-2xl p-5 border transition-all duration-200 hover:border-[#48484A]/60 hover:shadow-sm hover:shadow-black/10 group ${
                  isSelected ? 'border-blue-500/40 ring-1 ring-blue-500/20' : 'border-gray-200/50'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center border border-gray-200/50 overflow-hidden">
                    {person.best_portrait_path ? (
                      <img src={person.best_portrait_path} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <svg className="w-6 h-6 text-[#86868B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{person.display_name || 'Unknown'}</p>
                    <p className="text-xs text-[#86868B] truncate">{person.id}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-[#86868B]">{person.total_incidents || 0} incidents</span>
                  <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${threat.bg} ${threat.color}`}>
                    {threat.label}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#86868B]">Last: {formatDate(person.last_seen)}</span>
                  <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${status.bg} ${status.color}`}>
                    {status.label}
                  </span>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-16">
              <svg className="w-10 h-10 text-[#86868B] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
              <p className="text-[#86868B] text-sm">No offenders found</p>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedPerson && (
          <div className="w-1/2 bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 p-6 sticky top-8 self-start space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center border border-gray-200/50 overflow-hidden">
                  {selectedPerson.best_portrait_path ? (
                    <img src={selectedPerson.best_portrait_path} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-8 h-8 text-[#86868B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedPerson.display_name || 'Unknown'}</h3>
                  <p className="text-sm text-[#86868B]">{selectedPerson.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPerson(null)}
                className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-[#86868B] hover:text-gray-900 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
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
                <span className={`px-3 py-1 text-xs rounded-full font-medium flex items-center gap-2 ${(threatConfig[selectedPerson.threat_level] || threatConfig[1]).bg} ${(threatConfig[selectedPerson.threat_level] || threatConfig[1]).color}`}>
                  Threat: {renderThreatDots(selectedPerson.threat_level)}
                </span>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-gray-900">{selectedPerson.total_visits || 0}</p>
                <p className="text-[10px] text-[#86868B]">Visits</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-gray-900">{selectedPerson.total_incidents || 0}</p>
                <p className="text-[10px] text-[#86868B]">Incidents</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-red-400">{selectedPerson.total_confirmed_thefts || 0}</p>
                <p className="text-[10px] text-[#86868B]">Thefts</p>
              </div>
            </div>

            {/* Physical Description */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Physical Description</h2>
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                {selectedPerson.estimated_gender && (
                  <div className="flex justify-between"><span className="text-[#86868B]">Gender</span><span className="text-gray-900">{selectedPerson.estimated_gender}</span></div>
                )}
                {selectedPerson.estimated_age_range && (
                  <div className="flex justify-between"><span className="text-[#86868B]">Age Range</span><span className="text-gray-900">{selectedPerson.estimated_age_range}</span></div>
                )}
                {selectedPerson.estimated_height_cm && (
                  <div className="flex justify-between"><span className="text-[#86868B]">Height</span><span className="text-gray-900">~{Math.round(selectedPerson.estimated_height_cm)}cm</span></div>
                )}
                {selectedPerson.estimated_build && (
                  <div className="flex justify-between"><span className="text-[#86868B]">Build</span><span className="text-gray-900">{selectedPerson.estimated_build}</span></div>
                )}
                {selectedPerson.hair_description && (
                  <div className="flex justify-between"><span className="text-[#86868B]">Hair</span><span className="text-gray-900">{selectedPerson.hair_description}</span></div>
                )}
                {!selectedPerson.estimated_gender && !selectedPerson.estimated_build && (
                  <p className="text-[#86868B] text-xs">No physical description available</p>
                )}
              </div>
            </div>

            {/* Timeline */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Timeline</h2>
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-[#86868B]">First Seen</span><span className="text-gray-900">{formatDate(selectedPerson.first_seen)}</span></div>
                <div className="flex justify-between"><span className="text-[#86868B]">Last Seen</span><span className="text-gray-900">{formatDate(selectedPerson.last_seen)}</span></div>
              </div>
            </div>

            {/* Notes */}
            {selectedPerson.notes && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-[#636366] whitespace-pre-wrap">{selectedPerson.notes}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              {selectedPerson.status !== 'blacklisted' ? (
                <button
                  onClick={() => handleBlacklist(selectedPerson.id)}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl bg-red-500 hover:bg-red-400 text-white transition-all duration-200 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  {actionLoading ? 'Processing...' : 'Blacklist'}
                </button>
              ) : (
                <button
                  onClick={() => handleRemoveBlacklist(selectedPerson.id)}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white transition-all duration-200 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                  {actionLoading ? 'Processing...' : 'Remove from Blacklist'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
