import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ReviewQueuePage from './pages/ReviewQueuePage';
import AlertsPage from './pages/AlertsPage';
import OffendersPage from './pages/OffendersPage';
import BlacklistPage from './pages/BlacklistPage';
import CamerasPage from './pages/CamerasPage';
import PersonDetailPage from './pages/PersonDetailPage';
import { getMe } from './services/api';
import type { User } from './types';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      getMe()
        .then((res) => setUser(res.data))
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading RetailGuard AI...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={setUser} />;
  }

  return (
    <Layout user={user} onLogout={() => { localStorage.removeItem('token'); setUser(null); }}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/review" element={<ReviewQueuePage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/offenders" element={<OffendersPage />} />
        <Route path="/blacklist" element={<BlacklistPage />} />
        <Route path="/cameras" element={<CamerasPage />} />
        <Route path="/person/:id" element={<PersonDetailPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
}

export default App;
