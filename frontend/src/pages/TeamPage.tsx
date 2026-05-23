import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

interface TeamMember {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: 'owner' | 'manager' | 'clerk' | 'viewer';
  avatarUrl?: string;
  clockedIn: boolean;
  clockInTime?: string;
  weeklyHours?: number;
}

interface Shift {
  id: string;
  userId: string;
  userName: string;
  day: string;
  startHour: number;
  endHour: number;
  color: string;
}

const roleBadge: Record<string, { bg: string; text: string; label: string }> = {
  owner: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Owner' },
  manager: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Manager' },
  clerk: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Clerk' },
  viewer: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Viewer' },
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clockLoading, setClockLoading] = useState(false);

  // Add member form
  const [newMember, setNewMember] = useState({
    username: '',
    password: '',
    fullName: '',
    email: '',
    role: 'clerk' as string,
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [membersRes, shiftsRes] = await Promise.all([
        api.team.members(),
        api.team.shifts(),
      ]);
      setMembers(membersRes.data || membersRes);
      setShifts(shiftsRes.data || shiftsRes);
    } catch (err) {
      console.error('Failed to load team data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openPanel = (member: TeamMember) => {
    setSelectedMember(member);
    setPanelOpen(true);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setTimeout(() => setSelectedMember(null), 300);
  };

  const handleClockIn = async () => {
    if (!selectedMember) return;
    setClockLoading(true);
    try {
      await api.team.clockIn(selectedMember.id);
      setSelectedMember({ ...selectedMember, clockedIn: true, clockInTime: new Date().toISOString() });
      setMembers((prev) =>
        prev.map((m) => (m.id === selectedMember.id ? { ...m, clockedIn: true } : m))
      );
    } catch (err) {
      console.error('Clock in failed', err);
    } finally {
      setClockLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!selectedMember) return;
    setClockLoading(true);
    try {
      await api.team.clockOut(selectedMember.id);
      setSelectedMember({ ...selectedMember, clockedIn: false, clockInTime: undefined });
      setMembers((prev) =>
        prev.map((m) => (m.id === selectedMember.id ? { ...m, clockedIn: false } : m))
      );
    } catch (err) {
      console.error('Clock out failed', err);
    } finally {
      setClockLoading(false);
    }
  };

  const handleAddMember = async () => {
    try {
      await api.team.addMember(newMember);
      setModalOpen(false);
      setNewMember({ username: '', password: '', fullName: '', email: '', role: 'clerk' });
      fetchData();
    } catch (err) {
      console.error('Failed to add member', err);
    }
  };

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const formatElapsed = (isoTime?: string) => {
    if (!isoTime) return '—';
    const diff = Date.now() - new Date(isoTime).getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m`;
  };

  return (
    <div className="min-h-screen bg-[#1C1C1E] text-white relative">
      {/* Header */}
      <div className="px-8 pt-8 pb-4 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Team</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-full transition-all duration-200 active:scale-95"
        >
          <span className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Add Member
          </span>
        </button>
      </div>

      {/* Team Grid */}
      <div className="px-8 pb-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-20 text-white/40">
            <p className="text-lg">No team members yet</p>
            <p className="text-sm mt-1">Add your first team member to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {members.map((member) => {
              const badge = roleBadge[member.role] || roleBadge.viewer;
              return (
                <button
                  key={member.id}
                  onClick={() => openPanel(member)}
                  className="group text-left bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5 hover:bg-white/[0.08] hover:border-white/[0.12] hover:shadow-lg hover:shadow-black/20 transition-all duration-200 active:scale-[0.98]"
                >
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center text-sm font-semibold text-white/90">
                        {member.avatarUrl ? (
                          <img src={member.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          getInitials(member.fullName)
                        )}
                      </div>
                      {/* Status dot */}
                      <div
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#1C1C1E] transition-colors duration-200 ${
                          member.clockedIn ? 'bg-green-400' : 'bg-white/20'
                        }`}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white/90 truncate">{member.fullName}</p>
                      <p className="text-xs text-white/40 truncate mt-0.5">@{member.username}</p>
                      <span
                        className={`inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                  </div>
                  {member.clockedIn && (
                    <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center gap-1.5 text-xs text-green-400/80">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      On duty · {formatElapsed(member.clockInTime)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Shift Schedule */}
      <div className="px-8 pb-8">
        <h2 className="text-xl font-semibold mb-4 text-white/90">Shift Schedule</h2>
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="grid grid-cols-7 border-b border-white/[0.06]">
            {DAYS.map((day) => (
              <div key={day} className="px-3 py-3 text-center text-xs font-medium text-white/50 uppercase tracking-wider">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 min-h-[200px]">
            {DAYS.map((day) => {
              const dayShifts = shifts.filter((s) => s.day === day);
              return (
                <div key={day} className="border-r border-white/[0.04] last:border-r-0 p-2 space-y-1.5">
                  {dayShifts.map((shift) => {
                    const height = Math.max(((shift.endHour - shift.startHour) / 12) * 100, 30);
                    return (
                      <div
                        key={shift.id}
                        className="rounded-lg px-2 py-1.5 text-xs transition-all duration-200 hover:brightness-110 cursor-default"
                        style={{
                          backgroundColor: `${shift.color || '#3B82F6'}25`,
                          borderLeft: `3px solid ${shift.color || '#3B82F6'}`,
                          minHeight: `${height}px`,
                        }}
                      >
                        <p className="font-medium text-white/80 truncate">{shift.userName}</p>
                        <p className="text-white/40 mt-0.5">
                          {shift.startHour}:00–{shift.endHour}:00
                        </p>
                      </div>
                    );
                  })}
                  {dayShifts.length === 0 && (
                    <div className="h-full flex items-center justify-center text-white/10 text-xs">—</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Side Panel */}
      <div
        className={`fixed inset-0 z-40 transition-all duration-300 ${
          panelOpen ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
      >
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
            panelOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={closePanel}
        />
        {/* Panel */}
        <div
          className={`absolute right-0 top-0 bottom-0 w-full max-w-md bg-[#2C2C2E]/95 backdrop-blur-2xl border-l border-white/[0.08] shadow-2xl transition-transform duration-300 ease-out ${
            panelOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {selectedMember && (
            <div className="h-full overflow-y-auto">
              {/* Panel header */}
              <div className="sticky top-0 z-10 bg-[#2C2C2E]/80 backdrop-blur-xl border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
                <h3 className="font-semibold text-white/90">Member Details</h3>
                <button
                  onClick={closePanel}
                  className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.12] flex items-center justify-center transition-colors duration-200"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Profile */}
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center text-lg font-semibold">
                    {selectedMember.avatarUrl ? (
                      <img src={selectedMember.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      getInitials(selectedMember.fullName)
                    )}
                  </div>
                  <div>
                    <p className="text-lg font-semibold">{selectedMember.fullName}</p>
                    <p className="text-sm text-white/40">@{selectedMember.username}</p>
                    <p className="text-sm text-white/40">{selectedMember.email}</p>
                  </div>
                </div>

                {/* Role */}
                <div className="flex items-center gap-2">
                  {(() => {
                    const badge = roleBadge[selectedMember.role] || roleBadge.viewer;
                    return (
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                    );
                  })()}
                </div>

                {/* Status Card */}
                <div className="bg-white/[0.05] rounded-xl p-4 space-y-3">
                  <h4 className="text-sm font-medium text-white/60 uppercase tracking-wider">Current Shift</h4>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${
                        selectedMember.clockedIn ? 'bg-green-400 animate-pulse' : 'bg-white/20'
                      }`}
                    />
                    <span className="text-sm">
                      {selectedMember.clockedIn ? 'On Duty' : 'Off Duty'}
                    </span>
                    {selectedMember.clockedIn && selectedMember.clockInTime && (
                      <span className="text-sm text-white/40 ml-auto">
                        {formatElapsed(selectedMember.clockInTime)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Weekly Hours */}
                <div className="bg-white/[0.05] rounded-xl p-4">
                  <h4 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-2">This Week</h4>
                  <p className="text-3xl font-bold tracking-tight">
                    {selectedMember.weeklyHours ?? 0}
                    <span className="text-base font-normal text-white/40 ml-1">hrs</span>
                  </p>
                </div>

                {/* Quick Actions */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-3">Quick Actions</h4>
                  {selectedMember.clockedIn ? (
                    <button
                      onClick={handleClockOut}
                      disabled={clockLoading}
                      className="w-full py-3 rounded-xl bg-orange-500/20 text-orange-400 font-medium text-sm hover:bg-orange-500/30 transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
                    >
                      {clockLoading ? 'Processing...' : '⏱ Clock Out'}
                    </button>
                  ) : (
                    <button
                      onClick={handleClockIn}
                      disabled={clockLoading}
                      className="w-full py-3 rounded-xl bg-green-500/20 text-green-400 font-medium text-sm hover:bg-green-500/30 transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
                    >
                      {clockLoading ? 'Processing...' : '⏱ Clock In'}
                    </button>
                  )}
                  <button className="w-full py-3 rounded-xl bg-white/[0.05] text-white/80 font-medium text-sm hover:bg-white/[0.08] transition-all duration-200 active:scale-[0.98]">
                    ✏️ Edit Member
                  </button>
                  <button className="w-full py-3 rounded-xl bg-white/[0.05] text-white/80 font-medium text-sm hover:bg-white/[0.08] transition-all duration-200 active:scale-[0.98]">
                    📊 View Performance
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Member Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setModalOpen(false)}
          />
          <div className="relative w-full max-w-md bg-[#2C2C2E] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden animate-[scaleIn_200ms_ease-out]">
            <div className="px-6 py-5 border-b border-white/[0.06]">
              <h3 className="text-lg font-semibold">Add Team Member</h3>
              <p className="text-sm text-white/40 mt-0.5">Create a new account for your team</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/60 mb-1.5">Username</label>
                <input
                  type="text"
                  value={newMember.username}
                  onChange={(e) => setNewMember({ ...newMember, username: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/[0.05] border border-white/[0.1] rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all duration-200"
                  placeholder="johndoe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/60 mb-1.5">Password</label>
                <input
                  type="password"
                  value={newMember.password}
                  onChange={(e) => setNewMember({ ...newMember, password: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/[0.05] border border-white/[0.1] rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all duration-200"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/60 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={newMember.fullName}
                  onChange={(e) => setNewMember({ ...newMember, fullName: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/[0.05] border border-white/[0.1] rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all duration-200"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/60 mb-1.5">Email</label>
                <input
                  type="email"
                  value={newMember.email}
                  onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/[0.05] border border-white/[0.1] rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all duration-200"
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/60 mb-1.5">Role</label>
                <select
                  value={newMember.role}
                  onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/[0.05] border border-white/[0.1] rounded-xl text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all duration-200 appearance-none"
                >
                  <option value="clerk" className="bg-[#2C2C2E]">Clerk</option>
                  <option value="manager" className="bg-[#2C2C2E]">Manager</option>
                  <option value="viewer" className="bg-[#2C2C2E]">Viewer</option>
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-white/[0.06] flex justify-end gap-3">
              <button
                onClick={() => setModalOpen(false)}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-white/80 hover:bg-white/[0.05] transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMember}
                disabled={!newMember.username || !newMember.password || !newMember.fullName}
                className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
              >
                Add Member
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
