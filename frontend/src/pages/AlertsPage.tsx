import { useState, useEffect } from 'react';
import { AlertTriangle, Bell, Shield, Clock, User } from 'lucide-react';
import { getActiveAlerts } from '../services/api';
import AlertPanel from '../components/AlertPanel';
import type { Alert } from '../types';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getActiveAlerts()
      .then((r) => setAlerts(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const priorityConfig = {
    critical: { color: 'border-red-600 bg-red-950/30', icon: '🚨', label: 'CRITICAL' },
    high: { color: 'border-orange-600 bg-orange-950/30', icon: '⚠️', label: 'HIGH' },
    medium: { color: 'border-yellow-600 bg-yellow-950/30', icon: '👁️', label: 'MEDIUM' },
    low: { color: 'border-blue-600 bg-blue-950/30', icon: 'ℹ️', label: 'LOW' },
  };

  if (loading) return <div className="text-gray-400">Loading alerts...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="w-6 h-6" /> Active Alerts
        </h1>
        <span className="text-sm text-gray-500">{alerts.length} active</span>
      </div>

      {alerts.length === 0 ? (
        <div className="card text-center py-16">
          <Shield className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-300">All Clear</h2>
          <p className="text-gray-500 mt-1">No active alerts. The system is monitoring all cameras.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const config = priorityConfig[alert.priority as keyof typeof priorityConfig] || priorityConfig.medium;
            return (
              <button
                key={alert.id}
                onClick={() => setSelectedAlert(alert)}
                className={`w-full text-left p-4 rounded-xl border-l-4 ${config.color} transition-colors hover:brightness-110`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center shrink-0">
                    {alert.best_portrait_path ? (
                      <img src={alert.best_portrait_path} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <User className="w-6 h-6 text-gray-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{config.icon}</span>
                      <h3 className="font-bold">{alert.title}</h3>
                      <span className="badge badge-danger text-xs ml-auto">{config.label}</span>
                    </div>
                    <p className="text-sm text-gray-400 truncate">{alert.message}</p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(alert.created_at).toLocaleString()}
                      </span>
                      {alert.match_confidence && (
                        <span>Match: {(alert.match_confidence * 100).toFixed(0)}%</span>
                      )}
                      <span>{alert.person_total_thefts} prior theft{alert.person_total_thefts !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selectedAlert && (
        <AlertPanel
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onAction={() => {
            setAlerts((prev) => prev.filter((a) => a.id !== selectedAlert.id));
            setSelectedAlert(null);
          }}
        />
      )}
    </div>
  );
}
