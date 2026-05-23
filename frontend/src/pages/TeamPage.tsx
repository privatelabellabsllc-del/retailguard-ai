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
  owner: { bg: 'bg-purple-500/15', text: 'text-purple-500', label: 'Owner' },
  manager: { bg: 'bg-blue-500/15', text: 'text-blue-500', label: 'Manager' },
  clerk: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Clerk' },
  viewer: { bg: 'bg-gray-100', text: 'text-[#86868B]', label: 'Viewer' },
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
    <div className="min-h-screen p-6 lg:p-8 space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-purple-500/10 via-violet-500/5 to-transparent border border-gray-200/50 rounded-2xl p-8 lg:p-10">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight mb-3">Team</h1>
            <p className="text-base text-[#86868B] leading-relaxed">Manage your team, shifts, and schedules. Track who's on duty, clock in/out times, and build your weekly roster.</p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="px-6 py-3 text-sm font-semibold rounded-xl bg-blue-500 hover:bg-blue-400 text-white shadow-sm shadow-blue-500/20 transition-all duration-200 active:scale-95"
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Member
            </span>
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{members.length}</p>
          <p className="text-xs text-[#86868B] mt-1">Total Members</p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{members.filter(m => m.clockedIn).length}</p>
          <p className="text-xs text-[#86868B] mt-1">On Duty Now</p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{shifts.length}</p>
          <p className="text-xs text-[#86868B] mt-1">Scheduled Shifts</p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{members.reduce((sum, m) => sum + (m.weeklyHours ?? 0), 0)}</p>
          <p className="text-xs text-[#86868B] mt-1">Weekly Hours</p>
        </div>
      </div>

      {/* Team Grid */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Team Members</h2>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : members.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-12 text-center">
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-[#86868B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-900">No team members yet</p>
            <p className="text-xs text-[#86868B] mt-1">Add your first team member to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {members.map((member) => {
              const badge = roleBadge[member.role] || roleBadge.viewer;
              return (
                <button
                  key={member.id}
                  onClick={() => openPanel(member)}
                  className="text-left bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5 transition-all duration-200 hover:border-[#48484A]/60 hover:shadow-sm hover:shadow-black/10 group"
                >
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center text-sm font-semibold text-gray-900">
                        {member.avatarUrl ? (
                          <img src={member.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          getInitials(member.fullName)
                        )}
                      </div>
                      {/* Status dot */}
                      <div
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white transition-colors duration-200 ${
                          member.clockedIn ? 'bg-emerald-400' : 'bg-gray-200'
                        }`}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{member.fullName}</p>
                      <p className="text-xs text-[#86868B] truncate mt-0.5">@{member.username}</p>
                      <span
                        className={`inline-block mt-2 text-[10px] font-medium px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                  </div>
                  {member.clockedIn && (
                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-1.5 text-xs text-emerald-500">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
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
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Shift Schedule</h2>
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-100">
            {DAYS.map((day) => (
              <div key={day} className="px-3 py-3 text-center text-[10px] font-semibold text-[#86868B] uppercase tracking-wider">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 min-h-[200px]">
            {DAYS.map((day) => {
              const dayShifts = shifts.filter((s) => s.day === day);
              return (
                <div key={day} className="border-r border-gray-50 last:border-r-0 p-2 space-y-1.5">
                  {dayShifts.map((shift) => {
                    const height = Math.max(((shift.endHour - shift.startHour) / 12) * 100, 30);
                    return (
                      <div
                        key={shift.id}
                        className="rounded-lg px-2 py-1.5 text-xs transition-all duration-200 hover:brightness-110 cursor-default border-l-[3px]"
                        style={{
                          backgroundColor: `${shift.color || '#3B82F6'}15`,
                          borderLeftColor: shift.color || '#3B82F6',
                          minHeight: `${height}px`,
                        }}
                      >
                        <p className="font-medium text-gray-900 truncate">{shift.userName}</p>
                        <p className="text-[#86868B] mt-0.5">
                          {shift.startHour}:00–{shift.endHour}:00
                        </p>
                      </div>
                    );
                  })}
                  {dayShifts.length === 0 && (
                    <div className="h-full flex items-center justify-center text-gray-200 text-xs">—</div>
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
          className={`absolute right-0 top-0 bottom-0 w-full max-w-md bg-white border-l border-gray-200/50 shadow-xl transition-transform duration-300 ease-out ${
            panelOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {selectedMember && (
            <div className="h-full overflow-y-auto">
              {/* Panel header */}
              <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-xl border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Member Details</h3>
                <button
                  onClick={closePanel}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors duration-200"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Profile */}
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center text-lg font-semibold text-gray-900">
                    {selectedMember.avatarUrl ? (
                      <img src={selectedMember.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      getInitials(selectedMember.fullName)
                    )}
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-gray-900">{selectedMember.fullName}</p>
                    <p className="text-sm text-[#86868B]">@{selectedMember.username}</p>
                    <p className="text-sm text-[#86868B]">{selectedMember.email}</p>
                  </div>
                </div>

                {/* Role */}
                <div className="flex items-center gap-2">
                  {(() => {
                    const badge = roleBadge[selectedMember.role] || roleBadge.viewer;
                    return (
                      <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                    );
                  })()}
                </div>

                {/* Status Card */}
                <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5">
                  <h4 className="text-xs text-[#86868B] uppercase tracking-wider mb-3">Current Shift</h4>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${
                        selectedMember.clockedIn ? 'bg-emerald-400 animate-pulse' : 'bg-gray-200'
                      }`}
                    />
                    <span className="text-sm font-semibold text-gray-900">
                      {selectedMember.clockedIn ? 'On Duty' : 'Off Duty'}
                    </span>
                    {selectedMember.clockedIn && selectedMember.clockInTime && (
                      <span className="text-xs text-[#86868B] ml-auto">
                        {formatElapsed(selectedMember.clockInTime)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Weekly Hours */}
                <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5">
                  <h4 className="text-xs text-[#86868B] uppercase tracking-wider mb-2">This Week</h4>
                  <p className="text-3xl font-bold text-gray-900 tracking-tight">
                    {selectedMember.weeklyHours ?? 0}
                    <span className="text-base font-normal text-[#86868B] ml-1">hrs</span>
                  </p>
                </div>

                {/* Quick Actions */}
                <div className="space-y-2">
                  <h4 className="text-xs text-[#86868B] uppercase tracking-wider mb-3">Quick Actions</h4>
                  {selectedMember.clockedIn ? (
                    <button
                      onClick={handleClockOut}
                      disabled={clockLoading}
                      className="w-full py-3 rounded-xl bg-amber-500/15 text-amber-500 font-medium text-sm hover:bg-amber-500/25 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {clockLoading ? 'Processing...' : 'Clock Out'}
                    </button>
                  ) : (
                    <button
                      onClick={handleClockIn}
                      disabled={clockLoading}
                      className="w-full py-3 rounded-xl bg-emerald-500/15 text-emerald-500 font-medium text-sm hover:bg-emerald-500/25 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {clockLoading ? 'Processing...' : 'Clock In'}
                    </button>
                  )}
                  <button className="w-full py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                    </svg>
                    Edit Member
                  </button>
                  <button className="w-full py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                    </svg>
                    View Performance
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Member Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            onClick={() => setModalOpen(false)}
          />
          <div className="relative bg-white border border-gray-200/50 rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Add Team Member</h3>
              <p className="text-sm text-[#86868B] mt-0.5">Create a new account for your team</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1.5">Username</label>
                <input
                  type="text"
                  value={newMember.username}
                  onChange={(e) => setNewMember({ ...newMember, username: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/80 border border-gray-200/50 rounded-xl text-sm text-gray-900 placeholder:text-[#636366] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-all duration-200"
                  placeholder="johndoe"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1.5">Password</label>
                <input
                  type="password"
                  value={newMember.password}
                  onChange={(e) => setNewMember({ ...newMember, password: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/80 border border-gray-200/50 rounded-xl text-sm text-gray-900 placeholder:text-[#636366] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-all duration-200"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={newMember.fullName}
                  onChange={(e) => setNewMember({ ...newMember, fullName: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/80 border border-gray-200/50 rounded-xl text-sm text-gray-900 placeholder:text-[#636366] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-all duration-200"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1.5">Email</label>
                <input
                  type="email"
                  value={newMember.email}
                  onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/80 border border-gray-200/50 rounded-xl text-sm text-gray-900 placeholder:text-[#636366] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-all duration-200"
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1.5">Role</label>
                <select
                  value={newMember.role}
                  onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/80 border border-gray-200/50 rounded-xl text-sm text-gray-900 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 appearance-none"
                >
                  <option value="clerk">Clerk</option>
                  <option value="manager">Manager</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm font-medium rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMember}
                disabled={!newMember.username || !newMember.password || !newMember.fullName}
                className="px-6 py-3 text-sm font-semibold rounded-xl bg-blue-500 hover:bg-blue-400 text-white shadow-sm shadow-blue-500/20 transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
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
