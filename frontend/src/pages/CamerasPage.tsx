import React, { useState, useEffect } from 'react';
import { cameras as camerasApi, streams as streamsApi } from '../services/api';

interface Camera {
  id: string;
  name: string;
  description?: string;
  channel_number?: number;
  is_active?: boolean;
  is_ptz?: boolean;
  resolution?: string;
  fps?: number;
  ai_enabled?: boolean;
  position_x?: number;
  position_y?: number;
}

interface StreamStatus {
  ai_available: boolean;
  active_streams: number;
  face_cache?: { persons: number; embeddings: number };
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
      <span className="text-xs font-medium text-gray-900/40 uppercase tracking-wider">{label}</span>
    </div>
    <p className={`text-2xl font-bold ${color || 'text-gray-900'}`}>{value}</p>
  </div>
);

const CamerasPage: React.FC = () => {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [streamStatus, setStreamStatus] = useState<StreamStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', rtsp_url: '', location_id: '', description: '', channel_number: '' });
  const [addLoading, setAddLoading] = useState(false);
  const [streamActionLoading, setStreamActionLoading] = useState<string | null>(null);
  const [demoRunning, setDemoRunning] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [camsData, statusData] = await Promise.allSettled([
        camerasApi.list(),
        streamsApi.status(),
      ]);

      if (camsData.status === 'fulfilled') {
        const d = Array.isArray(camsData.value) ? camsData.value : [];
        setCameras(d);
      }

      if (statusData.status === 'fulfilled' && statusData.value) {
        setStreamStatus(statusData.value);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    try {
      await camerasApi.create({
        name: formData.name,
        rtsp_url: formData.rtsp_url,
        location_id: formData.location_id,
        description: formData.description || undefined,
        channel_number: formData.channel_number ? parseInt(formData.channel_number) : undefined,
      } as any);
      setShowAddForm(false);
      setFormData({ name: '', rtsp_url: '', location_id: '', description: '', channel_number: '' });
      fetchData();
    } catch (err) {
      console.error('Failed to add camera:', err);
    } finally {
      setAddLoading(false);
    }
  };

  const handleStartAI = async (cameraId: string) => {
    setStreamActionLoading(cameraId);
    try {
      await streamsApi.start(cameraId);
      const status = await streamsApi.status();
      setStreamStatus(status);
    } catch (err) {
      console.error('Failed to start AI:', err);
    } finally {
      setStreamActionLoading(null);
    }
  };

  const handleStopAI = async (cameraId: string) => {
    setStreamActionLoading(cameraId);
    try {
      await streamsApi.stop(cameraId);
      const status = await streamsApi.status();
      setStreamStatus(status);
    } catch (err) {
      console.error('Failed to stop AI:', err);
    } finally {
      setStreamActionLoading(null);
    }
  };

  const handleDemoToggle = async () => {
    setStreamActionLoading('demo');
    try {
      if (demoRunning) {
        await streamsApi.demoStop();
        setDemoRunning(false);
      } else {
        await streamsApi.demoStart(30);
        setDemoRunning(true);
      }
    } catch (err) {
      console.error('Failed to toggle demo:', err);
    } finally {
      setStreamActionLoading(null);
    }
  };

  const handleDemoGenerate = async () => {
    setStreamActionLoading('demo-gen');
    try {
      await streamsApi.demoGenerate();
    } catch (err) {
      console.error('Failed to generate demo incident:', err);
    } finally {
      setStreamActionLoading(null);
    }
  };

  const activeCount = cameras.filter(c => c.is_active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Cameras</h1>
          <p className="text-sm text-gray-900/40 mt-1">Monitor and manage camera feeds</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Demo Controls */}
          <button
            onClick={handleDemoGenerate}
            disabled={streamActionLoading === 'demo-gen'}
            className="px-4 py-2.5 rounded-full text-sm font-medium text-yellow-600 border border-yellow-500/30 transition-all duration-200 hover:bg-yellow-500/10 active:scale-[0.97] disabled:opacity-50"
          >
            {streamActionLoading === 'demo-gen' ? '...' : '⚡ Generate Incident'}
          </button>
          <button
            onClick={handleDemoToggle}
            disabled={streamActionLoading === 'demo'}
            className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-200 active:scale-[0.97] disabled:opacity-50 ${
              demoRunning
                ? 'text-red-600 border border-red-500/30 hover:bg-red-500/10'
                : 'text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10'
            }`}
          >
            {streamActionLoading === 'demo' ? '...' : demoRunning ? '⏹ Stop Demo' : '▶ Start Demo'}
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2.5 rounded-full text-sm font-medium text-gray-900 transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
            style={{
              background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
              boxShadow: '0 4px 14px rgba(59,130,246,0.3)',
            }}
          >
            + Add Camera
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="Total Cameras" value={cameras.length} icon="📷" />
        <StatCard label="Active" value={activeCount} icon="🟢" color="text-green-600" />
        <StatCard
          label="AI Status"
          value={streamStatus?.ai_available ? 'Online' : 'Offline'}
          icon="🧠"
          color={streamStatus?.ai_available ? 'text-emerald-400' : 'text-red-600'}
        />
        <StatCard
          label="AI Streams"
          value={streamStatus?.active_streams || 0}
          icon="📡"
          color="text-blue-600"
        />
      </div>

      {/* Face Cache Info */}
      {streamStatus?.face_cache && (
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.05] rounded-2xl p-4 flex items-center gap-6">
          <span className="text-lg">🧬</span>
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-gray-900/40">Known Persons: </span>
              <span className="text-gray-900 font-medium">{streamStatus.face_cache.persons}</span>
            </div>
            <div>
              <span className="text-gray-900/40">Face Embeddings: </span>
              <span className="text-gray-900 font-medium">{streamStatus.face_cache.embeddings}</span>
            </div>
          </div>
        </div>
      )}

      {/* Camera Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <svg className="animate-spin h-6 w-6 text-gray-900/30" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : cameras.length === 0 ? (
        <div className="text-center py-20">
          <span className="text-4xl mb-3 block">📷</span>
          <p className="text-gray-900/40 text-sm">No cameras configured</p>
          <p className="text-gray-900/25 text-xs mt-1">Add a camera or use Demo Mode to generate test data</p>
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
                  <svg className="w-8 h-8 text-gray-900/15 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                  <span className="text-[10px] text-gray-900/20 font-medium">LIVE FEED</span>
                </div>

                {/* Status badge */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium backdrop-blur-md"
                  style={{ background: 'rgba(0,0,0,0.5)' }}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${camera.is_active ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                  <span className={camera.is_active ? 'text-green-500' : 'text-red-500'}>
                    {camera.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* AI badge */}
                {camera.ai_enabled && (
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium backdrop-blur-md bg-emerald-500/20 text-emerald-300">
                    🧠 AI
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{camera.name}</h3>
                  {camera.description && <p className="text-xs text-gray-900/35 mt-0.5">{camera.description}</p>}
                </div>

                <div className="space-y-1.5">
                  {camera.channel_number !== undefined && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-900/30">Channel</span>
                      <span className="text-gray-900/60">{camera.channel_number}</span>
                    </div>
                  )}
                  {camera.resolution && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-900/30">Resolution</span>
                      <span className="text-gray-900/60">{camera.resolution}</span>
                    </div>
                  )}
                  {camera.fps && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-900/30">FPS</span>
                      <span className="text-gray-900/60">{camera.fps}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-900/30">PTZ</span>
                    <span className="text-gray-900/60">{camera.is_ptz ? 'Yes' : 'No'}</span>
                  </div>
                </div>

                {/* AI Controls */}
                <div className="flex gap-2 pt-2 border-t border-white/[0.05]">
                  <button
                    onClick={() => handleStartAI(camera.id)}
                    disabled={streamActionLoading === camera.id}
                    className="flex-1 px-3 py-2 rounded-xl text-xs font-medium text-emerald-400 border border-emerald-500/20 transition-all duration-200 hover:bg-emerald-500/10 disabled:opacity-50"
                  >
                    {streamActionLoading === camera.id ? '...' : '▶ Start AI'}
                  </button>
                  <button
                    onClick={() => handleStopAI(camera.id)}
                    disabled={streamActionLoading === camera.id}
                    className="flex-1 px-3 py-2 rounded-xl text-xs font-medium text-red-600 border border-red-500/20 transition-all duration-200 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    {streamActionLoading === camera.id ? '...' : '⏹ Stop AI'}
                  </button>
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
            <h2 className="text-lg font-bold text-gray-900 mb-1">Add Camera</h2>
            <p className="text-xs text-gray-900/40 mb-5">Configure a new camera feed</p>

            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-900/50 mb-1.5 ml-1">Camera Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Main Entrance"
                  required
                  className="w-full px-4 py-3 rounded-xl text-sm text-gray-900 placeholder-white/25 border border-white/10 outline-none transition-all duration-200 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                  style={{ background: 'rgba(0,0,0,0.3)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-900/50 mb-1.5 ml-1">RTSP URL</label>
                <input
                  type="text"
                  value={formData.rtsp_url}
                  onChange={(e) => setFormData({ ...formData, rtsp_url: e.target.value })}
                  placeholder="rtsp://192.168.1.100:554/stream"
                  required
                  className="w-full px-4 py-3 rounded-xl text-sm text-gray-900 placeholder-white/25 border border-white/10 outline-none transition-all duration-200 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                  style={{ background: 'rgba(0,0,0,0.3)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-900/50 mb-1.5 ml-1">Location ID</label>
                <input
                  type="text"
                  value={formData.location_id}
                  onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                  placeholder="e.g. store-1, floor-2"
                  required
                  className="w-full px-4 py-3 rounded-xl text-sm text-gray-900 placeholder-white/25 border border-white/10 outline-none transition-all duration-200 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                  style={{ background: 'rgba(0,0,0,0.3)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-900/50 mb-1.5 ml-1">Description (optional)</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                  className="w-full px-4 py-3 rounded-xl text-sm text-gray-900 placeholder-white/25 border border-white/10 outline-none transition-all duration-200 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                  style={{ background: 'rgba(0,0,0,0.3)' }}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 py-2.5 rounded-full text-sm font-medium text-gray-900/60 border border-white/10 transition-all duration-200 hover:bg-white/[0.04]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="flex-1 py-2.5 rounded-full text-sm font-semibold text-gray-900 transition-all duration-200 hover:brightness-110 disabled:opacity-50"
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
