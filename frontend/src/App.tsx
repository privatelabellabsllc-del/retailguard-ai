import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';

// Lazy-loaded pages
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const ReviewQueuePage = React.lazy(() => import('./pages/ReviewQueuePage'));
const AlertsPage = React.lazy(() => import('./pages/AlertsPage'));
const OffendersPage = React.lazy(() => import('./pages/OffendersPage'));
const BlacklistPage = React.lazy(() => import('./pages/BlacklistPage'));
const TrafficPage = React.lazy(() => import('./pages/TrafficPage'));
const CalendarPage = React.lazy(() => import('./pages/CalendarPage'));
const HeatmapPage = React.lazy(() => import('./pages/HeatmapPage'));
const ShelvesPage = React.lazy(() => import('./pages/ShelvesPage'));
const TeamPage = React.lazy(() => import('./pages/TeamPage'));
const PerformancePage = React.lazy(() => import('./pages/PerformancePage'));
const CashPage = React.lazy(() => import('./pages/CashPage'));
const ScannerPage = React.lazy(() => import('./pages/ScannerPage'));
const RevenuePage = React.lazy(() => import('./pages/RevenuePage'));
const CamerasPage = React.lazy(() => import('./pages/CamerasPage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const PersonDetailPage = React.lazy(() => import('./pages/PersonDetailPage'));

// Auth guard component
const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

// Loading spinner
const LoadingSpinner: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center" style={{ background: '#F5F5F7' }}>
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-blue-500 animate-spin" />
      </div>
      <p className="text-xs text-gray-900/30 font-medium tracking-wide">Loading…</p>
    </div>
  </div>
);

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected routes with layout */}
          <Route
            element={
              <AuthGuard>
                <Layout />
              </AuthGuard>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/incidents" element={<ReviewQueuePage />} />
            <Route path="/review" element={<ReviewQueuePage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/persons" element={<OffendersPage />} />
            <Route path="/persons/:id" element={<PersonDetailPage />} />
            <Route path="/offenders" element={<OffendersPage />} />
            <Route path="/blacklist" element={<BlacklistPage />} />
            <Route path="/traffic" element={<TrafficPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/heatmap" element={<HeatmapPage />} />
            <Route path="/shelves" element={<ShelvesPage />} />
            <Route path="/fridge" element={<HeatmapPage />} />
            <Route path="/team" element={<TeamPage />} />
            <Route path="/performance" element={<PerformancePage />} />
            <Route path="/cash" element={<CashPage />} />
            <Route path="/scanner" element={<ScannerPage />} />
            <Route path="/revenue" element={<RevenuePage />} />
            <Route path="/cameras" element={<CamerasPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;
