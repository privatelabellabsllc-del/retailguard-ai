import { useState, useEffect } from 'react';
import { Camera, Plus, Wifi, WifiOff, Eye } from 'lucide-react';
import { getCameras } from '../services/api';

interface CameraData {
  id: string;
  name: string;
  description: string | null;
  channel_number: number | null;
  is_active: boolean;
  is_ptz: boolean;
  resolution: string | null;
  fps: number;
  ai_enabled: boolean;
}

export default function CamerasPage() {
  const [cameras, setCameras] = useState<CameraData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCameras()
      .then((r) => setCameras(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400">Loading cameras...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Camera className="w-6 h-6" /> Camera Management
        </h1>
        <button className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Add Camera
        </button>
      </div>

      <div className="bg-blue-950/20 border border-blue-900/50 rounded-xl p-4 mb-6">
        <p className="text-sm text-blue-300">
          📹 Connected to your <strong>Uniview Tec NR324XPC</strong> NVR via RTSP/ONVIF.
          Each camera can have detection zones configured for targeted monitoring.
        </p>
      </div>

      {cameras.length === 0 ? (
        <div className="card text-center py-16">
          <Camera className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 mb-4">No cameras configured yet</p>
          <button className="btn-primary">Add Your First Camera</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cameras.map((cam) => (
            <div key={cam.id} className="card">
              {/* Camera preview placeholder */}
              <div className="bg-black rounded-lg h-40 flex items-center justify-center mb-3">
                <Camera className="w-8 h-8 text-gray-700" />
              </div>
              
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">{cam.name}</h3>
                <span className={`flex items-center gap-1 text-xs ${cam.is_active ? 'text-green-400' : 'text-red-400'}`}>
                  {cam.is_active ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                  {cam.is_active ? 'Online' : 'Offline'}
                </span>
              </div>
              
              <div className="text-xs text-gray-500 space-y-1">
                {cam.channel_number && <p>Channel: {cam.channel_number}</p>}
                {cam.resolution && <p>Resolution: {cam.resolution}</p>}
                <p>FPS: {cam.fps}</p>
                <p className="flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  AI: {cam.ai_enabled ? '✅ Enabled' : '❌ Disabled'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
