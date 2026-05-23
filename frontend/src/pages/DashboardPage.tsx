import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ClipboardCheck, Users, Ban,
  TrendingUp, DollarSign, Eye, ShieldAlert
} from 'lucide-react';
import { getIncidentStats, getActiveAlerts, getPendingIncidents, getOffenders } from '../services/api';
import type { IncidentStats, Alert, Incident, Person } from '../types';

export default function DashboardPage() {
  const [stats, setStats] = useState<IncidentStats | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([]);
  const [offenders, setOffenders] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getIncidentStats().then((r) => setStats(r.data)),
      getActiveAlerts().then((r) => setAlerts(r.data)),
      getPendingIncidents().then((r) => setRecentIncidents(r.data.slice(0, 5))),
      getOffenders().then((r) => setOffenders(r.data.slice(0, 5))),
    ])
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-gray-400">Loading dashboard...</div>;
  }

  const statCards = [
    {
      label: 'Pending Review',
      value: stats?.pending_review || 0,
      icon: ClipboardCheck,
      color: 'text-amber-400',
      bg: 'bg-amber-900/20',
      link: '/review',
    },
    {
      label: 'Confirmed Thefts',
      value: stats?.confirmed_thefts || 0,
      icon: ShieldAlert,
      color: 'text-red-400',
      bg: 'bg-red-900/20',
      link: '/review?status=theft',
    },
    {
      label: 'Known Offenders',
      value: offenders.length,
      icon: Users,
      color: 'text-orange-400',
      bg: 'bg-orange-900/20',
      link: '/offenders',
    },
    {
      label: 'Estimated Loss',
      value: `$${(stats?.total_estimated_loss || 0).toLocaleString()}`,
      icon: DollarSign,
      color: 'text-green-400',
      bg: 'bg-green-900/20',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Security Dashboard</h1>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Eye className="w-4 h-4" />
          AI Monitoring Active
        </div>
      </div>

      {/* Active Alerts Banner */}
      {alerts.length > 0 && (
        <div className="bg-red-950/50 border border-red-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-500 animate-pulse" />
            <div>
              <h3 className="font-bold text-red-400">
                {alerts.length} Active Alert{alerts.length > 1 ? 's' : ''}
              </h3>
              <p className="text-sm text-red-300/80">
                {alerts[0]?.title}
              </p>
            </div>
            <Link to="/alerts" className="ml-auto btn-danger text-sm">
              View Alerts
            </Link>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="card hover:border-gray-700 transition-colors">
            {stat.link ? (
              <Link to={stat.link} className="block">
                <StatCardContent stat={stat} />
              </Link>
            ) : (
              <StatCardContent stat={stat} />
            )}
          </div>
        ))}
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Incidents */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Recent Incidents</h3>
            <Link to="/review" className="text-sm text-blue-400 hover:text-blue-300">
              View All →
            </Link>
          </div>
          <div className="space-y-3">
            {recentIncidents.length === 0 ? (
              <p className="text-gray-600 text-sm">No pending incidents</p>
            ) : (
              recentIncidents.map((inc) => (
                <div key={inc.id} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    inc.severity === 'critical' ? 'bg-red-500' :
                    inc.severity === 'high' ? 'bg-orange-500' :
                    inc.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {inc.ai_description || inc.incident_type}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(inc.detected_at).toLocaleString()} · {(inc.ai_confidence * 100).toFixed(0)}% confidence
                    </p>
                  </div>
                  <span className={`badge text-xs ${
                    inc.review_status === 'pending' ? 'badge-warning' :
                    inc.review_status === 'theft' ? 'badge-danger' : 'badge-success'
                  }`}>
                    {inc.review_status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Known Offenders */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Known Offenders</h3>
            <Link to="/offenders" className="text-sm text-blue-400 hover:text-blue-300">
              View All →
            </Link>
          </div>
          <div className="space-y-3">
            {offenders.length === 0 ? (
              <p className="text-gray-600 text-sm">No known offenders</p>
            ) : (
              offenders.map((person) => (
                <Link
                  key={person.id}
                  to={`/person/${person.id}`}
                  className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center shrink-0">
                    {person.best_portrait_path ? (
                      <img src={person.best_portrait_path} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <Users className="w-5 h-5 text-gray-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {person.display_name || 'Unknown'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {person.total_confirmed_thefts} theft{person.total_confirmed_thefts !== 1 ? 's' : ''} · 
                      Last seen: {person.last_seen ? new Date(person.last_seen).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  <span className={`badge text-xs ${
                    person.status === 'blacklisted' ? 'badge-danger' : 'badge-warning'
                  }`}>
                    {person.status}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCardContent({ stat }: { stat: any }) {
  return (
    <div className="flex items-center gap-4">
      <div className={`w-12 h-12 ${stat.bg} rounded-lg flex items-center justify-center`}>
        <stat.icon className={`w-6 h-6 ${stat.color}`} />
      </div>
      <div>
        <p className="text-2xl font-bold">{stat.value}</p>
        <p className="text-sm text-gray-500">{stat.label}</p>
      </div>
    </div>
  );
}
