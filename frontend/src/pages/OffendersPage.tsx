import { useState, useEffect } from 'react';
import api from '../services/api';

interface IdentityScores {
  face: number;
  body: number;
  gait: number;
  height: number;
  marks: number;
}

interface IncidentRecord {
  id: string;
  date: string;
  type: string;
  camera: string;
  value: number;
}

interface Person {
  id: string;
  name: string;
  totalIncidents: number;
  riskLevel: 'high' | 'medium' | 'low';
  lastSeen: string;
  status: 'active' | 'blacklisted' | 'cleared';
  identityScores: IdentityScores;
  incidents: IncidentRecord[];
}

export default function OffendersPage() {
  const [persons, setPersons] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await api.persons.list();
      setPersons(res.data || generateMockPersons());
    } catch {
      setPersons(generateMockPersons());
    } finally {
      setLoading(false);
    }
  };

  const generateMockPersons = (): Person[] => {
    const names = ['John D.', 'Unknown #142', 'Sarah M.', 'Unknown #267', 'Mike R.', 'Unknown #389', 'Emily K.', 'Unknown #412', 'David L.', 'Unknown #528', 'Chris W.', 'Unknown #601'];
    const statuses: Person['status'][] = ['active', 'blacklisted', 'active', 'cleared', 'blacklisted', 'active'];
    const risks: Person['riskLevel'][] = ['high', 'high', 'medium', 'low', 'high', 'medium'];
    return names.map((name, i) => ({
      id: `person-${i + 1}`,
      name,
      totalIncidents: 1 + Math.floor(Math.random() * 8),
      riskLevel: risks[i % risks.length],
      lastSeen: new Date(Date.now() - i * 86400000 * (1 + Math.random() * 5)).toLocaleDateString(),
      status: statuses[i % statuses.length],
      identityScores: {
        face: 50 + Math.floor(Math.random() * 45),
        body: 40 + Math.floor(Math.random() * 50),
        gait: 30 + Math.floor(Math.random() * 55),
        height: 60 + Math.floor(Math.random() * 35),
        marks: 20 + Math.floor(Math.random() * 60),
      },
      incidents: Array.from({ length: 1 + Math.floor(Math.random() * 5) }, (_, j) => ({
        id: `inc-${i}-${j}`,
        date: new Date(Date.now() - (j + 1) * 86400000 * (2 + Math.random() * 10)).toLocaleDateString(),
        type: ['Theft', 'Suspicious Behavior', 'Loitering', 'Tag Removal'][j % 4],
        camera: ['Entrance Cam 1', 'Aisle 3 Cam', 'Electronics Cam', 'Exit Cam'][j % 4],
        value: 15 + Math.floor(Math.random() * 200),
      })),
    }));
  };

  const handleStatusChange = (personId: string, newStatus: Person['status']) => {
    setPersons(prev => prev.map(p => p.id === personId ? { ...p, status: newStatus } : p));
    if (selectedPerson?.id === personId) {
      setSelectedPerson(prev => prev ? { ...prev, status: newStatus } : null);
    }
  };

  const filtered = persons.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.id.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: persons.length,
    newThisMonth: Math.floor(persons.length * 0.3),
    blacklisted: persons.filter(p => p.status === 'blacklisted').length,
  };

  const riskConfig = {
    high: { color: 'text-red-400', bg: 'bg-red-500/15' },
    medium: { color: 'text-yellow-400', bg: 'bg-yellow-500/15' },
    low: { color: 'text-green-400', bg: 'bg-green-500/15' },
  };

  const statusConfig = {
    active: { color: 'text-orange-400', bg: 'bg-orange-500/15', label: 'Active Offender' },
    blacklisted: { color: 'text-red-400', bg: 'bg-red-500/15', label: 'Blacklisted' },
    cleared: { color: 'text-green-400', bg: 'bg-green-500/15', label: 'Cleared' },
  };

  const ScoreBar = ({ label, score }: { label: string; score: number }) => (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-400 w-14">{label}</span>
      <div className="flex-1 h-2 bg-[#1C1C1E] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-blue-500' : score >= 40 ? 'bg-yellow-500' : 'bg-gray-500'
          }`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs text-gray-300 w-8 text-right">{score}%</span>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Offenders</h1>
        <p className="text-sm text-gray-400 mt-1">Person database & tracking</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Offenders', value: stats.total, icon: '👥', color: 'text-white' },
          { label: 'New This Month', value: stats.newThisMonth, icon: '📈', color: 'text-blue-400' },
          { label: 'Blacklisted', value: stats.blacklisted, icon: '🚫', color: 'text-red-400' },
        ].map((s) => (
          <div key={s.label} className="bg-[#2C2C2E]/80 backdrop-blur-xl rounded-2xl p-5 border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <span>{s.icon}</span>
              <span className="text-xs text-gray-400 uppercase tracking-wider">{s.label}</span>
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
          className="w-full bg-[#2C2C2E]/80 backdrop-blur-xl border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all duration-200"
        />
      </div>

      <div className="flex gap-6">
        {/* Person Grid */}
        <div className={`grid gap-3 transition-all duration-300 ${selectedPerson ? 'grid-cols-1 sm:grid-cols-2 w-1/2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 flex-1'}`}>
          {filtered.map((person) => {
            const risk = riskConfig[person.riskLevel];
            const status = statusConfig[person.status];
            const isSelected = selectedPerson?.id === person.id;
            return (
              <button
                key={person.id}
                onClick={() => setSelectedPerson(isSelected ? null : person)}
                className={`text-left bg-[#2C2C2E]/80 backdrop-blur-xl rounded-2xl p-5 border transition-all duration-300 hover:border-white/10 ${
                  isSelected ? 'border-blue-500/40 ring-1 ring-blue-500/20' : 'border-white/5'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-600/50 to-gray-700/50 flex items-center justify-center border border-white/10">
                    <span className="text-lg">👤</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{person.name}</p>
                    <p className="text-xs text-gray-500">{person.id}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">{person.totalIncidents} incidents</span>
                  <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${risk.bg} ${risk.color}`}>
                    {person.riskLevel.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Last: {person.lastSeen}</span>
                  <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${status.bg} ${status.color}`}>
                    {status.label}
                  </span>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-16">
              <p className="text-gray-500 text-sm">No persons found</p>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedPerson && (
          <div className="w-1/2 bg-[#2C2C2E]/80 backdrop-blur-xl rounded-2xl border border-white/5 p-6 sticky top-8 self-start space-y-6 animate-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-600/50 to-gray-700/50 flex items-center justify-center border border-white/10">
                  <span className="text-2xl">👤</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedPerson.name}</h3>
                  <p className="text-sm text-gray-400">{selectedPerson.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPerson(null)}
                className="w-8 h-8 rounded-lg bg-[#3A3A3C] flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Status */}
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 text-xs rounded-full font-medium ${statusConfig[selectedPerson.status].bg} ${statusConfig[selectedPerson.status].color}`}>
                {statusConfig[selectedPerson.status].label}
              </span>
              <span className={`px-3 py-1 text-xs rounded-full font-medium ${riskConfig[selectedPerson.riskLevel].bg} ${riskConfig[selectedPerson.riskLevel].color}`}>
                {selectedPerson.riskLevel.toUpperCase()} RISK
              </span>
            </div>

            {/* Identity Match Scores */}
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Identity Match Scores</p>
              <div className="bg-[#1C1C1E]/60 rounded-xl p-4 space-y-3">
                <ScoreBar label="Face" score={selectedPerson.identityScores.face} />
                <ScoreBar label="Body" score={selectedPerson.identityScores.body} />
                <ScoreBar label="Gait" score={selectedPerson.identityScores.gait} />
                <ScoreBar label="Height" score={selectedPerson.identityScores.height} />
                <ScoreBar label="Marks" score={selectedPerson.identityScores.marks} />
              </div>
            </div>

            {/* Incidents */}
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">
                Incidents ({selectedPerson.incidents.length})
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {selectedPerson.incidents.map((inc) => (
                  <div
                    key={inc.id}
                    className="bg-[#1C1C1E]/60 rounded-xl p-3 flex items-center justify-between hover:bg-[#3A3A3C]/40 transition-all duration-200"
                  >
                    <div>
                      <p className="text-sm text-white font-medium">{inc.type}</p>
                      <p className="text-xs text-gray-500">{inc.date} • {inc.camera}</p>
                    </div>
                    <span className="text-sm text-red-400 font-medium">${inc.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              {selectedPerson.status !== 'blacklisted' ? (
                <button
                  onClick={() => handleStatusChange(selectedPerson.id, 'blacklisted')}
                  className="flex-1 px-4 py-2.5 bg-red-500/10 text-red-400 text-sm font-medium rounded-xl hover:bg-red-500/20 transition-all duration-200 active:scale-95"
                >
                  🚫 Blacklist
                </button>
              ) : (
                <button
                  onClick={() => handleStatusChange(selectedPerson.id, 'cleared')}
                  className="flex-1 px-4 py-2.5 bg-green-500/10 text-green-400 text-sm font-medium rounded-xl hover:bg-green-500/20 transition-all duration-200 active:scale-95"
                >
                  ✅ Remove from Blacklist
                </button>
              )}
              {selectedPerson.status !== 'cleared' && (
                <button
                  onClick={() => handleStatusChange(selectedPerson.id, 'cleared')}
                  className="flex-1 px-4 py-2.5 bg-[#3A3A3C] text-white text-sm font-medium rounded-xl hover:bg-[#48484A] transition-all duration-200 active:scale-95"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
