// ──────────────────────────────────────────────
// RetailGuard AI — Dashboard
// One giant status card + big, simple tiles.
// If you can't understand it in 5 seconds, it's wrong.
// ──────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  incidents as incidentsApi,
  alerts as alertsApi,
  cameras as camerasApi,
  persons as personsApi,
} from '../services/api';

// ─── Icons ───────────────────────────────────

const CheckCircleIcon = ({ className = 'w-16 h-16' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const AlertIcon = ({ className = 'w-16 h-16' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
  </svg>
);

const ChevronIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

const PeopleIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  </svg>
);

const EyeIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const FlagIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18M3 4.5h13.5l-2.25 4.5 2.25 4.5H3" />
  </svg>
);

const CameraIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
  </svg>
);

// ─── Skeleton loader ─────────────────────────

function DashboardSkeleton() {
  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="h-48 md:h-56 bg-gray-100 rounded-3xl animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
        ))}
      </div>
      <div className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
    </div>
  );
}

// ─── Dashboard ───────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pendingReviews, setPendingReviews] = useState(0);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [offenderCount, setOffenderCount] = useState(0);
  const [camerasOnline, setCamerasOnline] = useState<{ online: number; total: number }>({ online: 0, total: 0 });

  useEffect(() => {
    const fetchData = async () => {
      const [statsRes, alertsRes, camerasRes, offendersRes] = await Promise.allSettled([
        incidentsApi.stats(),
        alertsApi.list(),
        camerasApi.list(),
        personsApi.offenders(),
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value) {
        setPendingReviews(statsRes.value.pending_review || 0);
      }
      if (alertsRes.status === 'fulfilled' && Array.isArray(alertsRes.value)) {
        setActiveAlerts(alertsRes.value);
      }
      if (camerasRes.status === 'fulfilled' && Array.isArray(camerasRes.value)) {
        const cams = camerasRes.value;
        const online = cams.filter(
          (c: any) => c.status === 'online' || c.status === 'active' || c.is_active === true
        ).length;
        setCamerasOnline({ online: online || cams.length, total: cams.length });
      }
      if (offendersRes.status === 'fulfilled' && Array.isArray(offendersRes.value)) {
        setOffenderCount(offendersRes.value.length);
      }
      setLoading(false);
    };
    fetchData();
    const timer = setInterval(fetchData, 60000);
    return () => clearInterval(timer);
  }, []);

  if (loading) return <DashboardSkeleton />;

  const attentionCount = activeAlerts.length + pendingReviews;
  const allClear = attentionCount === 0;

  const tiles = [
    {
      label: "Today's Visitors",
      value: '—',
      sub: 'Counting soon',
      icon: <PeopleIcon />,
      iconClasses: 'bg-blue-50 text-blue-500',
      onClick: () => navigate('/traffic'),
    },
    {
      label: 'Needs Your Review',
      value: String(pendingReviews),
      sub: pendingReviews === 0 ? 'All caught up' : 'Tap to review',
      icon: <EyeIcon />,
      iconClasses: pendingReviews > 0 ? 'bg-orange-50 text-orange-500' : 'bg-green-50 text-green-500',
      onClick: () => navigate('/incidents'),
    },
    {
      label: 'Known Offenders',
      value: String(offenderCount),
      sub: 'People to watch',
      icon: <FlagIcon />,
      iconClasses: 'bg-red-50 text-red-500',
      onClick: () => navigate('/persons'),
    },
    {
      label: 'Cameras Online',
      value: camerasOnline.total > 0 ? `${camerasOnline.online} of ${camerasOnline.total}` : '0',
      sub: camerasOnline.total > 0 && camerasOnline.online === camerasOnline.total ? 'All working' : 'Check cameras',
      icon: <CameraIcon />,
      iconClasses: 'bg-blue-50 text-blue-500',
      onClick: () => navigate('/cameras'),
    },
  ];

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      {/* ── Giant Status Card ─────────────────── */}
      {allClear ? (
        <div className="w-full rounded-3xl bg-green-500 text-white p-8 md:p-12 flex flex-col items-center justify-center text-center shadow-lg shadow-green-500/20">
          <CheckCircleIcon className="w-16 h-16 md:w-20 md:h-20 mb-4" />
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">All Clear</h1>
          <p className="text-green-50 text-base md:text-lg mt-2">
            Nothing needs your attention right now.
          </p>
        </div>
      ) : (
        <button
          onClick={() => navigate(activeAlerts.length > 0 ? '/alerts' : '/incidents')}
          className="w-full rounded-3xl bg-red-500 text-white p-8 md:p-12 flex flex-col items-center justify-center text-center shadow-lg shadow-red-500/25 hover:bg-red-600 active:scale-[0.99] transition-all"
        >
          <AlertIcon className="w-16 h-16 md:w-20 md:h-20 mb-4" />
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Attention Needed</h1>
          <p className="text-red-50 text-base md:text-lg mt-2">
            {activeAlerts.length > 0
              ? `${activeAlerts.length} live alert${activeAlerts.length !== 1 ? 's' : ''}`
              : ''}
            {activeAlerts.length > 0 && pendingReviews > 0 ? ' · ' : ''}
            {pendingReviews > 0
              ? `${pendingReviews} video${pendingReviews !== 1 ? 's' : ''} to review`
              : ''}
          </p>
          <span className="mt-5 inline-flex items-center gap-2 bg-white text-red-600 font-semibold text-base rounded-full px-6 py-3 min-h-[52px]">
            See what happened
            <ChevronIcon className="w-5 h-5" />
          </span>
        </button>
      )}

      {/* ── Big Stat Tiles ────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tiles.map((tile) => (
          <button
            key={tile.label}
            onClick={tile.onClick}
            className="bg-white border border-gray-100 rounded-2xl p-5 text-left hover:border-gray-200 hover:shadow-sm active:scale-[0.98] transition-all min-h-[52px]"
          >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${tile.iconClasses}`}>
              {tile.icon}
            </div>
            <p className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">{tile.value}</p>
            <p className="text-sm font-medium text-gray-900 mt-1">{tile.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{tile.sub}</p>
          </button>
        ))}
      </div>

      {/* ── Live Cameras Quick Link ───────────── */}
      <button
        onClick={() => navigate('/monitor')}
        className="w-full bg-white border border-gray-100 rounded-2xl p-5 md:p-6 flex items-center justify-between hover:border-gray-200 hover:shadow-sm active:scale-[0.99] transition-all min-h-[52px]"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center">
            <CameraIcon className="w-6 h-6" />
          </div>
          <div className="text-left">
            <h3 className="text-base md:text-lg font-semibold text-gray-900">Live Cameras</h3>
            <p className="text-sm text-gray-500 mt-0.5">Watch your store right now</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5 bg-green-50 text-green-600 text-xs font-semibold px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            LIVE
          </span>
          <ChevronIcon className="w-5 h-5 text-gray-400" />
        </div>
      </button>

      {/* ── Live Alerts preview ───────────────── */}
      {activeAlerts.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base md:text-lg font-semibold text-gray-900">Happening Now</h2>
            <button
              onClick={() => navigate('/alerts')}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 min-h-[44px] px-2"
            >
              See all
            </button>
          </div>
          <div className="space-y-2">
            {activeAlerts.slice(0, 3).map((alert: any) => (
              <button
                key={alert.id}
                onClick={() => navigate('/alerts')}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-red-50 hover:bg-red-100 active:scale-[0.99] transition-all text-left min-h-[52px]"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {alert.title || 'Suspicious activity'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {alert.person_display_name || 'Someone'} ·{' '}
                    {alert.created_at
                      ? new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : ''}
                  </p>
                </div>
                <ChevronIcon className="w-4 h-4 text-gray-400 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
