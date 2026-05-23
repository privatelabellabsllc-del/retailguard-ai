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
  { id: 'general', label: 'General' },
  { id: 'team', label: 'Team Permissions' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'security', label: 'Security' },
];

const categoryIcons: Record<string, JSX.Element> = {
  general: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  team: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  notifications: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  ),
  integrations: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.54a4.5 4.5 0 00-6.364-6.364L4.5 8.25a4.5 4.5 0 006.364 6.364l4.5-4.5z" />
    </svg>
  ),
  security: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  ),
};

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
      enabled ? 'bg-blue-500' : 'bg-gray-200'
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
      case 'Owner': return 'bg-purple-500/15 text-purple-600';
      case 'Manager': return 'bg-blue-500/15 text-blue-500';
      case 'Clerk': return 'bg-emerald-500/15 text-emerald-400';
      default: return 'bg-gray-100 text-[#86868B]';
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
        <h2 className="text-lg font-semibold text-gray-900 mb-1">General Settings</h2>
        <p className="text-xs text-[#86868B]">Configure your store information</p>
      </div>
      <div className="space-y-3">
        {[
          { label: 'Store Name', key: 'storeName', type: 'text' },
          { label: 'Timezone', key: 'timezone', type: 'text' },
          { label: 'Opening Time', key: 'openTime', type: 'time' },
          { label: 'Closing Time', key: 'closeTime', type: 'time' },
        ].map((field) => (
          <div key={field.key} className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-4 flex items-center justify-between">
            <label className="text-sm font-semibold text-gray-900">{field.label}</label>
            <input
              type={field.type}
              value={general[field.key as keyof typeof general]}
              onChange={(e) => setGeneral({ ...general, [field.key]: e.target.value })}
              className="px-4 py-2.5 bg-white/80 border border-gray-200/50 rounded-xl text-sm text-gray-900 w-64 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-all duration-200"
            />
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <button className="px-6 py-3 text-sm font-semibold rounded-xl bg-blue-500 hover:bg-blue-400 text-white shadow-sm shadow-blue-500/20 transition-all duration-200 active:scale-95">
          Save Changes
        </button>
      </div>
    </div>
  );

  const renderTeam = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Team Permissions</h2>
        <p className="text-xs text-[#86868B]">Manage feature access for each team member</p>
      </div>

      {!selectedUser ? (
        <div className="space-y-2">
          {users.map((user) => (
            <button
              key={user.userId}
              onClick={() => setSelectedUser(user)}
              className="w-full bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-4 flex items-center gap-4 transition-all duration-200 hover:border-[#48484A]/60 hover:shadow-sm hover:shadow-black/10 group"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center text-gray-900 font-semibold text-sm">
                {user.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-semibold text-gray-900">{user.name}</p>
                <p className="text-xs text-[#86868B]">{user.email}</p>
              </div>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${roleBadgeColor(user.role)}`}>
                {user.role}
              </span>
              <span className="text-xs text-[#86868B]">{user.enabledFeatures.length} features</span>
              <svg className="w-4 h-4 text-[#86868B] group-hover:text-gray-900 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          <button
            onClick={() => setSelectedUser(null)}
            className="flex items-center gap-2 text-sm text-blue-500 hover:text-blue-400 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back to team
          </button>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center text-gray-900 font-semibold">
              {selectedUser.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900">{selectedUser.name}</p>
              <p className="text-xs text-[#86868B]">{selectedUser.email}</p>
            </div>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${roleBadgeColor(selectedUser.role)}`}>
              {selectedUser.role}
            </span>
          </div>

          {/* Template selector */}
          <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">Apply Template</p>
              <p className="text-xs text-[#86868B]">Quick-apply a permission preset</p>
            </div>
            <select
              onChange={(e) => applyTemplate(e.target.value)}
              defaultValue=""
              className="px-4 py-2.5 bg-white/80 border border-gray-200/50 rounded-xl text-sm text-gray-900 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 cursor-pointer"
            >
              <option value="" disabled>Choose template...</option>
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
                <p className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider px-1 pt-4 pb-2">{category}</p>
                {feats.map((feature) => (
                  <div
                    key={feature.id}
                    className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-4 flex items-center justify-between mb-1.5 transition-all duration-200 hover:border-[#48484A]/60 hover:shadow-sm hover:shadow-black/10"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{feature.name}</p>
                      <p className="text-xs text-[#86868B]">{feature.description}</p>
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
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Notifications</h2>
        <p className="text-xs text-[#86868B]">Choose what alerts you receive</p>
      </div>
      <div className="space-y-2">
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
            className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-4 flex items-center justify-between transition-all duration-200 hover:border-[#48484A]/60 hover:shadow-sm hover:shadow-black/10"
          >
            <div>
              <p className="text-sm font-semibold text-gray-900">{item.label}</p>
              <p className="text-xs text-[#86868B]">{item.desc}</p>
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
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Integrations</h2>
        <p className="text-xs text-[#86868B]">Manage connected services</p>
      </div>
      <div className="space-y-4">
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.54a4.5 4.5 0 00-6.364-6.364L4.5 8.25a4.5 4.5 0 006.364 6.364l4.5-4.5z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Clover POS</p>
                <p className="text-xs text-[#86868B]">Last synced 2 minutes ago</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-[10px] font-medium text-emerald-400">Connected</span>
            </div>
          </div>
          <button className="px-4 py-2 text-sm font-medium rounded-xl bg-red-500 hover:bg-red-400 text-white transition-all duration-200">
            Disconnect
          </button>
        </div>

        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5">
          <p className="text-sm font-semibold text-gray-900 mb-3">API Key</p>
          <div className="flex items-center gap-3">
            <code className="flex-1 bg-white/80 border border-gray-200/50 rounded-xl px-4 py-2.5 text-xs text-[#86868B] font-mono">
              rg_sk_••••••••••••••••••••••••
            </code>
            <button className="px-4 py-2 text-sm font-medium rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all duration-200">
              Reveal
            </button>
            <button className="px-4 py-2 text-sm font-medium rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all duration-200">
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
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Security</h2>
        <p className="text-xs text-[#86868B]">Manage your account security</p>
      </div>

      <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5 space-y-4">
        <p className="text-sm font-semibold text-gray-900">Change Password</p>
        {['Current Password', 'New Password', 'Confirm Password'].map((label) => (
          <div key={label}>
            <label className="block text-xs text-[#86868B] mb-1.5">{label}</label>
            <input
              type="password"
              className="w-full px-4 py-2.5 bg-white/80 border border-gray-200/50 rounded-xl text-sm text-gray-900 placeholder:text-[#636366] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-all duration-200"
            />
          </div>
        ))}
        <button className="px-6 py-3 text-sm font-semibold rounded-xl bg-blue-500 hover:bg-blue-400 text-white shadow-sm shadow-blue-500/20 transition-all duration-200 active:scale-95">
          Update Password
        </button>
      </div>

      <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-5">
        <p className="text-sm font-semibold text-gray-900 mb-3">Active Sessions</p>
        {[
          { device: 'Chrome on MacBook Pro', location: 'New York, US', current: true },
          { device: 'Safari on iPhone 15', location: 'New York, US', current: false },
          { device: 'Firefox on Windows', location: 'Chicago, US', current: false },
        ].map((s, i) => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
            <div>
              <p className="text-sm text-gray-900">{s.device}</p>
              <p className="text-xs text-[#86868B]">{s.location}</p>
            </div>
            {s.current ? (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">Current</span>
            ) : (
              <button className="text-xs font-medium text-red-400 hover:text-red-500 transition-colors">Revoke</button>
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
    <div className="min-h-screen p-6 lg:p-8 space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-gray-500/10 via-slate-500/5 to-transparent border border-gray-200/50 rounded-2xl p-8 lg:p-10">
        <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight mb-3">Settings</h1>
        <p className="text-base text-[#86868B] leading-relaxed">System configuration, user management, and feature permissions. Control every aspect of your RetailGuard AI deployment.</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-56 shrink-0">
          <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-2 space-y-0.5 sticky top-8">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { setActiveCategory(cat.id); setSelectedUser(null); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                  activeCategory === cat.id
                    ? 'bg-blue-500/10 text-blue-500'
                    : 'text-[#86868B] hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <span className={activeCategory === cat.id ? 'text-blue-500' : 'text-[#86868B]'}>{categoryIcons[cat.id]}</span>
                <span className="font-medium">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-8">
          {panelMap[activeCategory]?.()}
        </div>
      </div>
    </div>
  );
}
