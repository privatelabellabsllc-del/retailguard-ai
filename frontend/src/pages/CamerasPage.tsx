import React, { useState, useEffect, useCallback, useRef } from 'react';
import { cameras as camerasApi, streams as streamsApi } from '../services/api';

interface Camera {
  id: string;
  name: string;
  description?: string;
  channel_number?: number;
  rtsp_url?: string;
  is_active?: boolean;
  is_ptz?: boolean;
  resolution?: string;
  fps?: number;
  ai_enabled?: boolean;
  position_x?: number;
  position_y?: number;
}

/* ── Live thumbnail component ── */
const LiveFeed: React.FC<{ cameraId: string; hasRtsp: boolean }> = ({ cameraId, hasRtsp }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const token = localStorage.getItem('token');

  const fetchSnapshot = useCallback(async () => {
    if (!hasRtsp || !token) return;
    try {
      const res = await fetch(`/api/cameras/${cameraId}/snapshot`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setSrc((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
      setError(false);
      setLoading(false);
    } catch {
      setError(true);
      setLoading(false);
    }
  }, [cameraId, hasRtsp, token]);

  useEffect(() => {
    fetchSnapshot();
    timerRef.current = setInterval(fetchSnapshot, 3000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (src) URL.revokeObjectURL(src);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchSnapshot]);

  if (!hasRtsp) {
    return (
      <div className="aspect-video relative flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <svg className="w-8 h-8 text-gray-300 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
          </svg>
          <span className="text-[10px] text-[#86868B] font-medium">NO RTSP URL</span>
        </div>
      </div>
    );
  }

  return (
    <div className="aspect-video relative bg-gray-900 overflow-hidden">
      {loading && !src && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <svg className="animate-spin h-6 w-6 text-gray-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}
      {error && !src && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <svg className="w-6 h-6 text-amber-400 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <span className="text-[10px] text-[#86868B] font-medium">CONNECTING...</span>
          </div>
        </div>
      )}
      {src && (
        <img
          src={src}
          alt="Live feed"
          className="w-full h-full object-cover"
        />
      )}
      {/* Live indicator */}
      {src && !error && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-600/90 backdrop-blur-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <span className="text-[9px] font-bold text-white tracking-wider">LIVE</span>
        </div>
      )}
    </div>
  );
};

interface StreamStatus {
  ai_available: boolean;
  active_streams: number;
  face_cache?: { persons: number; embeddings: number };
}

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
    <div className="min-h-screen p-4 md:p-6 lg:p-8 space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-gray-500/10 via-slate-500/5 to-transparent border border-gray-200/50 rounded-2xl p-5 md:p-8 lg:p-10">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight mb-3">Cameras</h1>
            <p className="text-base text-[#86868B] leading-relaxed">Manage your RTSP camera feeds. Connect your Uniview NVR, monitor stream health, and view AI detection status for each channel.</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleDemoGenerate}
              disabled={streamActionLoading === 'demo-gen'}
              className="px-4 py-2 text-sm font-medium rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 transition-all duration-200 disabled:opacity-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
              {streamActionLoading === 'demo-gen' ? '...' : 'Generate Incident'}
            </button>
            <button
              onClick={handleDemoToggle}
              disabled={streamActionLoading === 'demo'}
              className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 disabled:opacity-50 flex items-center gap-2 ${
                demoRunning
                  ? 'bg-red-500/10 hover:bg-red-500/20 text-red-500'
                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600'
              }`}
            >
              {demoRunning ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                </svg>
              )}
              {streamActionLoading === 'demo' ? '...' : demoRunning ? 'Stop Demo' : 'Start Demo'}
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-6 py-3 text-sm font-semibold rounded-xl bg-blue-500 hover:bg-blue-400 text-white shadow-sm shadow-blue-500/20 transition-all duration-200 active:scale-95 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Camera
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gray-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{cameras.length}</p>
          <p className="text-xs text-[#86868B] mt-1">Total Cameras</p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{activeCount}</p>
          <p className="text-xs text-[#86868B] mt-1">Active</p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-xl ${streamStatus?.ai_available ? 'bg-emerald-500/10' : 'bg-red-500/10'} flex items-center justify-center`}>
              <svg className={`w-5 h-5 ${streamStatus?.ai_available ? 'text-emerald-500' : 'text-red-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
              </svg>
            </div>
          </div>
          <p className={`text-2xl font-bold ${streamStatus?.ai_available ? 'text-emerald-600' : 'text-red-500'}`}>
            {streamStatus?.ai_available ? 'Online' : 'Offline'}
          </p>
          <p className="text-xs text-[#86868B] mt-1">AI Status</p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-blue-600">{streamStatus?.active_streams || 0}</p>
          <p className="text-xs text-[#86868B] mt-1">AI Streams</p>
        </div>
      </div>

      {/* Face Cache Info */}
      {streamStatus?.face_cache && (
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-4 flex items-center gap-6">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-[#86868B]">Known Persons: </span>
              <span className="text-gray-900 font-medium">{streamStatus.face_cache.persons}</span>
            </div>
            <div>
              <span className="text-[#86868B]">Face Embeddings: </span>
              <span className="text-gray-900 font-medium">{streamStatus.face_cache.embeddings}</span>
            </div>
          </div>
        </div>
      )}

      {/* Camera Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <svg className="animate-spin h-6 w-6 text-gray-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : cameras.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#86868B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
          </div>
          <p className="text-[#86868B] text-sm">No cameras configured</p>
          <p className="text-[#636366] text-xs mt-1">Add a camera or use Demo Mode to generate test data</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cameras.map((camera) => (
            <div
              key={camera.id}
              className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl overflow-hidden transition-all duration-200 hover:border-[#48484A]/60 hover:shadow-sm hover:shadow-black/10 group"
            >
              {/* Live feed */}
              <div className="relative">
                <LiveFeed cameraId={camera.id} hasRtsp={!!camera.rtsp_url} />

                {/* Status badge */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium backdrop-blur-md bg-white/80 border border-gray-200/50">
                  <span className={`w-1.5 h-1.5 rounded-full ${camera.is_active ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                  <span className={camera.is_active ? 'text-emerald-600' : 'text-red-500'}>
                    {camera.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* AI badge */}
                {camera.ai_enabled && (
                  <span className="absolute top-3 right-3 text-[10px] font-medium px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-500 backdrop-blur-md flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                    </svg>
                    AI
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="p-5 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{camera.name}</h3>
                  {camera.description && <p className="text-xs text-[#86868B] mt-0.5">{camera.description}</p>}
                </div>

                <div className="space-y-1.5">
                  {camera.channel_number !== undefined && (
                    <div className="flex justify-between text-xs">
                      <span className="text-[#86868B]">Channel</span>
                      <span className="text-[#636366]">{camera.channel_number}</span>
                    </div>
                  )}
                  {camera.resolution && (
                    <div className="flex justify-between text-xs">
                      <span className="text-[#86868B]">Resolution</span>
                      <span className="text-[#636366]">{camera.resolution}</span>
                    </div>
                  )}
                  {camera.fps && (
                    <div className="flex justify-between text-xs">
                      <span className="text-[#86868B]">FPS</span>
                      <span className="text-[#636366]">{camera.fps}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs">
                    <span className="text-[#86868B]">PTZ</span>
                    <span className="text-[#636366]">{camera.is_ptz ? 'Yes' : 'No'}</span>
                  </div>
                </div>

                {/* AI Controls */}
                <div className="flex gap-2 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => handleStartAI(camera.id)}
                    disabled={streamActionLoading === camera.id}
                    className="flex-1 px-3 py-2 rounded-xl text-xs font-medium text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                    </svg>
                    {streamActionLoading === camera.id ? '...' : 'Start AI'}
                  </button>
                  <button
                    onClick={() => handleStopAI(camera.id)}
                    disabled={streamActionLoading === camera.id}
                    className="flex-1 px-3 py-2 rounded-xl text-xs font-medium text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" />
                    </svg>
                    {streamActionLoading === camera.id ? '...' : 'Stop AI'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Camera Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => setShowAddForm(false)} />
          <div className="bg-white border border-gray-200/50 rounded-2xl shadow-xl max-w-md w-full p-6 relative">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Add Camera</h2>
            <p className="text-xs text-[#86868B] mb-5">Configure a new camera feed</p>

            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#636366] mb-1.5 ml-1">Camera Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Main Entrance"
                  required
                  className="w-full px-4 py-2.5 bg-white/80 border border-gray-200/50 rounded-xl text-sm text-gray-900 placeholder:text-[#636366] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#636366] mb-1.5 ml-1">RTSP URL</label>
                <input
                  type="text"
                  value={formData.rtsp_url}
                  onChange={(e) => setFormData({ ...formData, rtsp_url: e.target.value })}
                  placeholder="rtsp://192.168.1.100:554/stream"
                  required
                  className="w-full px-4 py-2.5 bg-white/80 border border-gray-200/50 rounded-xl text-sm text-gray-900 placeholder:text-[#636366] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#636366] mb-1.5 ml-1">Location ID</label>
                <input
                  type="text"
                  value={formData.location_id}
                  onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                  placeholder="e.g. store-1, floor-2"
                  required
                  className="w-full px-4 py-2.5 bg-white/80 border border-gray-200/50 rounded-xl text-sm text-gray-900 placeholder:text-[#636366] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#636366] mb-1.5 ml-1">Description (optional)</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                  className="w-full px-4 py-2.5 bg-white/80 border border-gray-200/50 rounded-xl text-sm text-gray-900 placeholder:text-[#636366] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-all duration-200"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="flex-1 px-6 py-2.5 text-sm font-semibold rounded-xl bg-blue-500 hover:bg-blue-400 text-white shadow-sm shadow-blue-500/20 transition-all duration-200 active:scale-95 disabled:opacity-50"
                >
                  {addLoading ? 'Adding...' : 'Add Camera'}
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
