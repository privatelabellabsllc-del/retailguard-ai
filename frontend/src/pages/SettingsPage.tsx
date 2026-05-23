import { useState, useEffect } from 'react';
import api from '../services/api';

interface Feature {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface UserPermission {
  userId: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  enabledFeatures: string[];
}

const categories = [
  { id: 'general', label: 'General', icon: '⚙️' },
  { id: 'team', label: 'Team Permissions', icon: '👥' },
  { id: 'notifications', label: 'Notifications', icon: '🔔' },
  { id: 'integrations', label: 'Integrations', icon: '🔗' },
  { id: 'security', label: 'Security', icon: '🔒' },
];

const roleTemplates: Record<string, string[]> = {
  Owner: ['dashboard', 'cameras', 'alerts', 'incidents', 'review', 'persons', 'revenue', 'settings', 'team', 'reports', 'api'],
  Manager: ['dashboard', 'cameras', 'alerts', 'incidents', 'review', 'persons', 'revenue', 'reports'],
  Clerk: ['dashboard', 'alerts', 'incidents', 'review'],
  Viewer: ['dashboard'],
};

const Toggle = ({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) => (
  <button
    onClick={onToggle}
    className={`relative w-12 h-7 rounded-full transition-all duration-300 ${
      enabled ? 'bg-blue-500' : 'bg-[#3A3A3C]'
    }`}
  >
    <span
      className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ${
        enabled ? 'left-[22px]' : 'left-0.5'
      }`}
    />
  </button>
);

export default function SettingsPage() {
  const [activeCategory, setActiveCategory] = useState('general');
  const [features, setFeatures] = useState<Feature[]>([]);
  const [users, setUsers] = useState<UserPermission[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserPermission | null>(null);
  const [loading, setLoading] = useState(true);

  // General settings state
  const [general, setGeneral] = useState({
    storeName: 'RetailGuard Store #1',
    timezone: 'America/New_York',
    openTime: '09:00',
    closeTime: '21:00',
  });

  // Notification settings
  const [notifications, setNotifications] = useState({
    theftAlerts: true,
    systemUpdates: false,
    dailyDigest: true,
    knownOffender: true,
    revenueAlerts: true,
    cameraOffline: true,
    weeklyReport: false,
    smsAlerts: false,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [featRes, usersRes] = await Promise.all([
        api.permissions.features(),
        api.permissions.userPermissions(),
      ]);
      setFeatures(featRes.data || generateMockFeatures());
      setUsers(usersRes.data || generateMockUsers());
    } catch {
      setFeatures(generateMockFeatures());
      setUsers(generateMockUsers());
    } finally {
      setLoading(false);
    }
  };

  const generateMockFeatures = (): Feature[] => [
    { id: 'dashboard', name: 'Dashboard', description: 'View main dashboard', category: 'Core' },
    { id: 'cameras', name: 'Camera Management', description: 'View and manage cameras', category: 'Security' },
    { id: 'alerts', name: 'Alerts', description: 'View security alerts', category: 'Security' },
    { id: 'incidents', name: 'Incidents', description: 'View incident reports', category: 'Security' },
    { id: 'review', name: 'Review Queue', description: 'Review flagged incidents', category: 'Security' },
    { id: 'persons', name: 'Persons Database', description: 'Access person records', category: 'Security' },
    { id: 'revenue', name: 'Revenue Analytics', description: 'View revenue data', category: 'Business' },
    { id: 'settings', name: 'Settings', description: 'Modify system settings', category: 'Admin' },
    { id: 'team', name: 'Team Management', description: 'Manage team members', category: 'Admin' },
    { id: 'reports', name: 'Reports', description: 'Generate and export reports', category: 'Business' },
    { id: 'api', name: 'API Access', description: 'Use API keys', category: 'Admin' },
  ];

  const generateMockUsers = (): UserPermission[] => [
    { userId: '1', name: 'Sarah Chen', email: 'sarah@store.com', role: 'Owner', enabledFeatures: ['dashboard', 'cameras', 'alerts', 'incidents', 'review', 'persons', 'revenue', 'settings', 'team', 'reports', 'api'] },
    { userId: '2', name: 'Mike Johnson', email: 'mike@store.com', role: 'Manager', enabledFeatures: ['dashboard', 'cameras', 'alerts', 'incidents', 'review', 'persons', 'revenue', 'reports'] },
    { userId: '3', name: 'Emily Davis', email: 'emily@store.com', role: 'Clerk', enabledFeatures: ['dashboard', 'alerts', 'incidents', 'review'] },
    { userId: '4', name: 'Tom Wilson', email: 'tom@store.com', role: 'Viewer', enabledFeatures: ['dashboard'] },
  ];

  const handleToggleFeature = async (userId: string, featureId: string) => {
    setUsers(prev => prev.map(u => {
      if (u.id === userId || u.userId === userId) {
        const enabled = u.enabledFeatures.includes(featureId);
        return {
          ...u,
          enabledFeatures: enabled
            ? u.enabledFeatures.filter(f => f !== featureId)
            : [...u.enabledFeatures, featureId],
        };
      }
      return u;
    }));
    if (selectedUser) {
      setSelectedUser(prev => {
        if (!prev) return prev;
        const enabled = prev.enabledFeatures.includes(featureId);
        return {
          ...prev,
          enabledFeatures: enabled
            ? prev.enabledFeatures.filter(f => f !== featureId)
            : [...prev.enabledFeatures, featureId],
        };
      });
    }
    try {
      await api.permissions.toggle({ userId, featureId });
    } catch { /* handled optimistically */ }
  };

  const applyTemplate = (template: string) => {
    if (!selectedUser) return;
    const feats = roleTemplates[template] || [];
    setSelectedUser({ ...selectedUser, enabledFeatures: feats });
    setUsers(prev => prev.map(u =>
      u.userId === selectedUser.userId ? { ...u, enabledFeatures: feats } : u
    ));
  };

  const roleBadgeColor = (role: string) => {
    switch (role) {
      case 'Owner': return 'bg-purple-500/15 text-purple-400';
      case 'Manager': return 'bg-blue-500/15 text-blue-400';
      case 'Clerk': return 'bg-green-500/15 text-green-400';
      default: return 'bg-gray-500/15 text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const renderGeneral = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-white mb-1">General Settings</h3>
        <p className="text-sm text-gray-400">Configure your store information</p>
      </div>
      <div className="space-y-4">
        {[
          { label: 'Store Name', key: 'storeName', type: 'text' },
          { label: 'Timezone', key: 'timezone', type: 'text' },
          { label: 'Opening Time', key: 'openTime', type: 'time' },
          { label: 'Closing Time', key: 'closeTime', type: 'time' },
        ].map((field) => (
          <div key={field.key} className="bg-[#2C2C2E]/60 rounded-xl p-4 flex items-center justify-between">
            <label className="text-sm text-gray-300">{field.label}</label>
            <input
              type={field.type}
              value={general[field.key as keyof typeof general]}
              onChange={(e) => setGeneral({ ...general, [field.key]: e.target.value })}
              className="bg-[#1C1C1E] border border-white/10 rounded-lg px-4 py-2 text-sm text-white w-64 focus:outline-none focus:border-blue-500/50 transition-all duration-200"
            />
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <button className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-xl transition-all duration-200 active:scale-95">
          Save Changes
        </button>
      </div>
    </div>
  );

  const renderTeam = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-white mb-1">Team Permissions</h3>
        <p className="text-sm text-gray-400">Manage feature access for each team member</p>
      </div>

      {!selectedUser ? (
        <div className="space-y-2">
          {users.map((user) => (
            <button
              key={user.userId}
              onClick={() => setSelectedUser(user)}
              className="w-full bg-[#2C2C2E]/60 rounded-xl p-4 flex items-center gap-4 hover:bg-[#3A3A3C]/60 transition-all duration-200 group"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center text-white font-semibold text-sm">
                {user.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-medium text-white">{user.name}</p>
                <p className="text-xs text-gray-400">{user.email}</p>
              </div>
              <span className={`px-2.5 py-0.5 text-xs rounded-full font-medium ${roleBadgeColor(user.role)}`}>
                {user.role}
              </span>
              <span className="text-xs text-gray-500">{user.enabledFeatures.length} features</span>
              <svg className="w-4 h-4 text-gray-500 group-hover:text-gray-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          <button
            onClick={() => setSelectedUser(null)}
            className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back to team
          </button>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center text-white font-semibold">
              {selectedUser.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <p className="text-lg font-semibold text-white">{selectedUser.name}</p>
              <p className="text-sm text-gray-400">{selectedUser.email}</p>
            </div>
            <span className={`px-3 py-1 text-xs rounded-full font-medium ${roleBadgeColor(selectedUser.role)}`}>
              {selectedUser.role}
            </span>
          </div>

          {/* Template selector */}
          <div className="bg-[#2C2C2E]/60 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-white font-medium">Apply Template</p>
              <p className="text-xs text-gray-400">Quick-apply a permission preset</p>
            </div>
            <select
              onChange={(e) => applyTemplate(e.target.value)}
              defaultValue=""
              className="bg-[#1C1C1E] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all duration-200 cursor-pointer"
            >
              <option value="" disabled>Choose template…</option>
              {Object.keys(roleTemplates).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Feature toggles */}
          <div className="space-y-1">
            {Object.entries(
              features.reduce<Record<string, Feature[]>>((acc, f) => {
                (acc[f.category] = acc[f.category] || []).push(f);
                return acc;
              }, {})
            ).map(([category, feats]) => (
              <div key={category}>
                <p className="text-xs text-gray-500 uppercase tracking-wider px-1 pt-4 pb-2">{category}</p>
                {feats.map((feature) => (
                  <div
                    key={feature.id}
                    className="bg-[#2C2C2E]/60 rounded-xl p-4 flex items-center justify-between mb-1.5 hover:bg-[#3A3A3C]/40 transition-all duration-200"
                  >
                    <div>
                      <p className="text-sm text-white font-medium">{feature.name}</p>
                      <p className="text-xs text-gray-400">{feature.description}</p>
                    </div>
                    <Toggle
                      enabled={selectedUser.enabledFeatures.includes(feature.id)}
                      onToggle={() => handleToggleFeature(selectedUser.userId, feature.id)}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderNotifications = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-white mb-1">Notifications</h3>
        <p className="text-sm text-gray-400">Choose what alerts you receive</p>
      </div>
      <div className="space-y-1.5">
        {[
          { key: 'theftAlerts', label: 'Theft Alerts', desc: 'Get notified when theft is detected' },
          { key: 'knownOffender', label: 'Known Offender Alerts', desc: 'Alert when a known offender is spotted' },
          { key: 'cameraOffline', label: 'Camera Offline', desc: 'Notify when a camera goes offline' },
          { key: 'revenueAlerts', label: 'Revenue Alerts', desc: 'Revenue anomaly notifications' },
          { key: 'dailyDigest', label: 'Daily Digest', desc: 'Daily summary email' },
          { key: 'weeklyReport', label: 'Weekly Report', desc: 'Weekly analytics report' },
          { key: 'systemUpdates', label: 'System Updates', desc: 'Platform update notifications' },
          { key: 'smsAlerts', label: 'SMS Alerts', desc: 'Receive critical alerts via SMS' },
        ].map((item) => (
          <div
            key={item.key}
            className="bg-[#2C2C2E]/60 rounded-xl p-4 flex items-center justify-between hover:bg-[#3A3A3C]/40 transition-all duration-200"
          >
            <div>
              <p className="text-sm text-white font-medium">{item.label}</p>
              <p className="text-xs text-gray-400">{item.desc}</p>
            </div>
            <Toggle
              enabled={notifications[item.key as keyof typeof notifications]}
              onToggle={() => setNotifications(prev => ({ ...prev, [item.key]: !prev[item.key as keyof typeof prev] }))}
            />
          </div>
        ))}
      </div>
    </div>
  );

  const renderIntegrations = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-white mb-1">Integrations</h3>
        <p className="text-sm text-gray-400">Manage connected services</p>
      </div>
      <div className="space-y-4">
        <div className="bg-[#2C2C2E]/60 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-xl">🍀</span>
              <div>
                <p className="text-sm text-white font-medium">Clover POS</p>
                <p className="text-xs text-gray-400">Last synced 2 minutes ago</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-xs text-green-400">Connected</span>
            </div>
          </div>
          <button className="px-4 py-2 bg-red-500/10 text-red-400 text-xs font-medium rounded-lg hover:bg-red-500/20 transition-all duration-200">
            Disconnect
          </button>
        </div>

        <div className="bg-[#2C2C2E]/60 rounded-xl p-5">
          <p className="text-sm text-white font-medium mb-2">API Key</p>
          <div className="flex items-center gap-3">
            <code className="flex-1 bg-[#1C1C1E] border border-white/10 rounded-lg px-4 py-2.5 text-xs text-gray-400 font-mono">
              rg_sk_••••••••••••••••••••••••
            </code>
            <button className="px-4 py-2.5 bg-[#3A3A3C] text-white text-xs font-medium rounded-lg hover:bg-[#48484A] transition-all duration-200">
              Reveal
            </button>
            <button className="px-4 py-2.5 bg-[#3A3A3C] text-white text-xs font-medium rounded-lg hover:bg-[#48484A] transition-all duration-200">
              Regenerate
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSecurity = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-white mb-1">Security</h3>
        <p className="text-sm text-gray-400">Manage your account security</p>
      </div>

      <div className="bg-[#2C2C2E]/60 rounded-xl p-5 space-y-4">
        <p className="text-sm text-white font-medium">Change Password</p>
        {['Current Password', 'New Password', 'Confirm Password'].map((label) => (
          <div key={label}>
            <label className="block text-xs text-gray-400 mb-1.5">{label}</label>
            <input
              type="password"
              className="w-full bg-[#1C1C1E] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all duration-200"
            />
          </div>
        ))}
        <button className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-xl transition-all duration-200 active:scale-95">
          Update Password
        </button>
      </div>

      <div className="bg-[#2C2C2E]/60 rounded-xl p-5">
        <p className="text-sm text-white font-medium mb-3">Active Sessions</p>
        {[
          { device: 'Chrome on MacBook Pro', location: 'New York, US', current: true },
          { device: 'Safari on iPhone 15', location: 'New York, US', current: false },
          { device: 'Firefox on Windows', location: 'Chicago, US', current: false },
        ].map((s, i) => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
            <div>
              <p className="text-sm text-white">{s.device}</p>
              <p className="text-xs text-gray-400">{s.location}</p>
            </div>
            {s.current ? (
              <span className="text-xs text-green-400 font-medium">Current</span>
            ) : (
              <button className="text-xs text-red-400 hover:text-red-300 transition-colors">Revoke</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const panelMap: Record<string, () => JSX.Element> = {
    general: renderGeneral,
    team: renderTeam,
    notifications: renderNotifications,
    integrations: renderIntegrations,
    security: renderSecurity,
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white tracking-tight">Settings</h1>
        <p className="text-sm text-gray-400 mt-1">Configure your RetailGuard system</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-56 shrink-0">
          <div className="bg-[#2C2C2E]/80 backdrop-blur-xl rounded-2xl border border-white/5 p-2 space-y-0.5 sticky top-8">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { setActiveCategory(cat.id); setSelectedUser(null); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                  activeCategory === cat.id
                    ? 'bg-blue-500/15 text-blue-400'
                    : 'text-gray-400 hover:text-gray-300 hover:bg-white/[0.03]'
                }`}
              >
                <span className="text-base">{cat.icon}</span>
                <span className="font-medium">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 bg-[#2C2C2E]/80 backdrop-blur-xl rounded-2xl border border-white/5 p-8">
          {panelMap[activeCategory]?.()}
        </div>
      </div>
    </div>
  );
}
