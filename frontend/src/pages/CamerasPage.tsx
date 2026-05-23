import React, { useState, useEffect } from 'react';
import api from '../services/api';

interface Camera {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline';
  ip: string;
  type: string;
  resolution: string;
  last_seen: string;
  rtsp_url?: string;
}

const StatCard: React.FC<{ label: string; value: string | number; icon: string; color?: string }> = ({ label, value, icon, color }) => (
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
    <p className={`text-2xl font-bold ${color || 'text-white'}`}>{value}</p>
  </div>
);

const CamerasPage: React.FC = () => {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', rtsp_url: '', location: '', type: 'indoor' });
  const [addLoading, setAddLoading] = useState(false);

  useEffect(() => {
    fetchCameras();
  }, []);

  const fetchCameras = async () => {
    try {
      const res = await api.cameras.list();
      setCameras(res.data || res || []);
    } catch (err) {
      console.error('Failed to fetch cameras:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    try {
      await api.cameras.create(formData);
      setShowAddForm(false);
      setFormData({ name: '', rtsp_url: '', location: '', type: 'indoor' });
      fetchCameras();
    } catch (err) {
      console.error('Failed to add camera:', err);
    } finally {
      setAddLoading(false);
    }
  };

  const online = cameras.filter((c) => c.status === 'online').length;
  const offline = cameras.length - online;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Cameras</h1>
          <p className="text-sm text-white/40 mt-1">Monitor and manage camera feeds</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2.5 rounded-full text-sm font-medium text-white transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
          style={{
            background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
            boxShadow: '0 4px 14px rgba(59,130,246,0.3)',
          }}
        >
          + Add Camera
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Cameras" value={cameras.length} icon="📷" />
        <StatCard label="Online" value={online} icon="🟢" color="text-green-400" />
        <StatCard label="Offline" value={offline} icon="🔴" color="text-red-400" />
      </div>

      {/* Camera Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <svg className="animate-spin h-6 w-6 text-white/30" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : cameras.length === 0 ? (
        <div className="text-center py-20">
          <span className="text-4xl mb-3 block">📷</span>
          <p className="text-white/40 text-sm">No cameras configured</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cameras.map((camera) => (
            <div
              key={camera.id}
              className="rounded-2xl border border-white/[0.06] overflow-hidden transition-all duration-200 hover:border-white/10 hover:-translate-y-0.5 group"
              style={{
                background: 'rgba(44,44,46,0.5)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.03)',
              }}
            >
              {/* Feed placeholder */}
              <div className="aspect-video relative flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
                <div className="text-center">
                  <svg className="w-8 h-8 text-white/15 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                  <span className="text-[10px] text-white/20 font-medium">LIVE FEED</span>
                </div>

                {/* Status badge */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium backdrop-blur-md"
                  style={{ background: 'rgba(0,0,0,0.5)' }}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${camera.status === 'online' ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                  <span className={camera.status === 'online' ? 'text-green-300' : 'text-red-300'}>
                    {camera.status === 'online' ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="p-4 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">{camera.name}</h3>
                  <p className="text-xs text-white/35 mt-0.5">{camera.location}</p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/30">IP</span>
                    <span className="text-white/60 font-mono text-[11px]">{camera.ip || '—'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-white/30">Type</span>
                    <span className="text-white/60 capitalize">{camera.type || '—'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-white/30">Resolution</span>
                    <span className="text-white/60">{camera.resolution || '—'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-white/30">Last seen</span>
                    <span className="text-white/60">
                      {camera.last_seen ? new Date(camera.last_seen).toLocaleString() : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Camera Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddForm(false)} />
          <div
            className="relative w-full max-w-sm rounded-2xl border border-white/10 p-6 backdrop-blur-xl"
            style={{
              background: 'rgba(44,44,46,0.9)',
              boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
            }}
          >
            <h2 className="text-lg font-bold text-white mb-1">Add Camera</h2>
            <p className="text-xs text-white/40 mb-5">Configure a new camera feed</p>

            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5 ml-1">Camera Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Main Entrance"
                  required
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/25 border border-white/10 outline-none transition-all duration-200 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                  style={{ background: 'rgba(0,0,0,0.3)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5 ml-1">RTSP URL</label>
                <input
                  type="text"
                  value={formData.rtsp_url}
                  onChange={(e) => setFormData({ ...formData, rtsp_url: e.target.value })}
                  placeholder="rtsp://192.168.1.100:554/stream"
                  required
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/25 border border-white/10 outline-none transition-all duration-200 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                  style={{ background: 'rgba(0,0,0,0.3)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5 ml-1">Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g. Floor 1, Aisle 3"
                  required
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/25 border border-white/10 outline-none transition-all duration-200 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                  style={{ background: 'rgba(0,0,0,0.3)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5 ml-1">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl text-sm text-white border border-white/10 outline-none transition-all duration-200 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 appearance-none"
                  style={{ background: 'rgba(0,0,0,0.3)' }}
                >
                  <option value="indoor">Indoor</option>
                  <option value="outdoor">Outdoor</option>
                  <option value="ptz">PTZ</option>
                  <option value="fisheye">Fisheye</option>
                  <option value="thermal">Thermal</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 py-2.5 rounded-full text-sm font-medium text-white/60 border border-white/10 transition-all duration-200 hover:bg-white/[0.04]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="flex-1 py-2.5 rounded-full text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)', boxShadow: '0 4px 14px rgba(59,130,246,0.3)' }}
                >
                  {addLoading ? 'Adding…' : 'Add Camera'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CamerasPage;
