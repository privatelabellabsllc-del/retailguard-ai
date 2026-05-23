// ──────────────────────────────────────────────
// RetailGuard AI — API Service
// ──────────────────────────────────────────────

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import type {
  AuthResponse,
  LoginPayload,
  RegisterPayload,
  User,
  Incident,
  Alert,
  Person,
  Camera,
  TrafficData,
  HourlyTraffic,
  CalendarData,
  TeamMember,
  Shift,
  PerformanceMetric,
  PerformanceReview,
  CashSession,
  CashTransaction,
  CashAlert,
  Shelf,
  Product,
  OutOfStockAlert,
  StoreScan,
  DashboardStats,
  HeatmapZone,
  FridgeData,
  RevenueRecord,
  FeaturePermission,
  RoleTemplate,
  PaginatedResponse,
} from '../types';

// ─── Axios Instance ──────────────────────────

const api: AxiosInstance = axios.create({
  baseURL: '',
  headers: { 'Content-Type': 'application/json' },
});

// Attach token to every request
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('access_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

// ─── Auth ────────────────────────────────────

export const auth = {
  login: async (payload: LoginPayload): Promise<AuthResponse> => {
    const formData = new URLSearchParams();
    formData.append('username', payload.username);
    formData.append('password', payload.password);
    const { data } = await api.post<AuthResponse>('/api/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
  },

  register: async (payload: RegisterPayload): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>('/api/auth/register', payload);
    return data;
  },

  me: async (): Promise<User> => {
    const { data } = await api.get<User>('/api/auth/me');
    localStorage.setItem('user', JSON.stringify(data));
    return data;
  },

  listUsers: async (params?: { role?: string; is_active?: boolean }): Promise<User[]> => {
    const { data } = await api.get<User[]>('/api/auth/users', { params });
    return data;
  },

  updateUser: async (userId: string, payload: Partial<User>): Promise<User> => {
    const { data } = await api.patch<User>(`/api/auth/users/${userId}`, payload);
    return data;
  },

  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  },
};

// ─── Incidents ───────────────────────────────

export const incidents = {
  list: async (params?: {
    status?: string;
    severity?: string;
    page?: number;
    per_page?: number;
  }): Promise<PaginatedResponse<Incident>> => {
    const { data } = await api.get<PaginatedResponse<Incident>>('/api/incidents', { params });
    return data;
  },

  get: async (id: string): Promise<Incident> => {
    const { data } = await api.get<Incident>(`/api/incidents/${id}`);
    return data;
  },

  update: async (id: string, payload: Partial<Incident>): Promise<Incident> => {
    const { data } = await api.patch<Incident>(`/api/incidents/${id}`, payload);
    return data;
  },
};

// ─── Alerts ──────────────────────────────────

export const alerts = {
  list: async (params?: {
    type?: string;
    acknowledged?: boolean;
    page?: number;
    per_page?: number;
  }): Promise<PaginatedResponse<Alert>> => {
    const { data } = await api.get<PaginatedResponse<Alert>>('/api/alerts', { params });
    return data;
  },

  acknowledge: async (id: string): Promise<Alert> => {
    const { data } = await api.post<Alert>(`/api/alerts/${id}/acknowledge`);
    return data;
  },
};

// ─── Persons ─────────────────────────────────

export const persons = {
  list: async (params?: {
    category?: string;
    search?: string;
    page?: number;
    per_page?: number;
  }): Promise<PaginatedResponse<Person>> => {
    const { data } = await api.get<PaginatedResponse<Person>>('/api/persons', { params });
    return data;
  },

  get: async (id: string): Promise<Person> => {
    const { data } = await api.get<Person>(`/api/persons/${id}`);
    return data;
  },
};

// ─── Cameras ─────────────────────────────────

export const cameras = {
  list: async (params?: {
    status?: string;
    location_id?: string;
  }): Promise<Camera[]> => {
    const { data } = await api.get<Camera[]>('/api/cameras', { params });
    return data;
  },

  get: async (id: string): Promise<Camera> => {
    const { data } = await api.get<Camera>(`/api/cameras/${id}`);
    return data;
  },
};

// ─── Traffic ─────────────────────────────────

export const traffic = {
  today: async (): Promise<TrafficData> => {
    const { data } = await api.get<TrafficData>('/api/traffic/today');
    return data;
  },

  hourly: async (params?: { date?: string }): Promise<HourlyTraffic[]> => {
    const { data } = await api.get<HourlyTraffic[]>('/api/traffic/hourly', { params });
    return data;
  },

  calendar: async (params: { month: number; year: number }): Promise<CalendarData> => {
    const { data } = await api.get<CalendarData>('/api/traffic/calendar', { params });
    return data;
  },

  knownVisitors: async (params?: {
    page?: number;
    per_page?: number;
  }): Promise<PaginatedResponse<Person>> => {
    const { data } = await api.get<PaginatedResponse<Person>>('/api/traffic/known-visitors', { params });
    return data;
  },
};

// ─── Team ────────────────────────────────────

export const team = {
  members: async (params?: { role?: string; is_active?: boolean }): Promise<TeamMember[]> => {
    const { data } = await api.get<TeamMember[]>('/api/team/members', { params });
    return data;
  },

  shifts: async (params?: {
    member_id?: string;
    date?: string;
    status?: string;
  }): Promise<Shift[]> => {
    const { data } = await api.get<Shift[]>('/api/team/shifts', { params });
    return data;
  },

  clockIn: async (shiftId: string): Promise<Shift> => {
    const { data } = await api.post<Shift>(`/api/team/shifts/${shiftId}/clock-in`);
    return data;
  },

  clockOut: async (shiftId: string): Promise<Shift> => {
    const { data } = await api.post<Shift>(`/api/team/shifts/${shiftId}/clock-out`);
    return data;
  },

  createShift: async (payload: {
    member_id: string;
    date: string;
    start_time: string;
    end_time: string;
    role: string;
    notes?: string;
  }): Promise<Shift> => {
    const { data } = await api.post<Shift>('/api/team/shifts', payload);
    return data;
  },

  performance: async (memberId: string): Promise<PerformanceMetric[]> => {
    const { data } = await api.get<PerformanceMetric[]>(`/api/team/members/${memberId}/performance`);
    return data;
  },

  reviews: async (params?: {
    member_id?: string;
    status?: string;
  }): Promise<PerformanceReview[]> => {
    const { data } = await api.get<PerformanceReview[]>('/api/team/reviews', { params });
    return data;
  },

  reviewAction: async (
    reviewId: string,
    action: 'acknowledge' | 'dispute',
    comments?: string,
  ): Promise<PerformanceReview> => {
    const { data } = await api.post<PerformanceReview>(`/api/team/reviews/${reviewId}/${action}`, {
      comments,
    });
    return data;
  },
};

// ─── Cash Management ─────────────────────────

export const cash = {
  verifyPin: async (pin: string): Promise<{ verified: boolean }> => {
    const { data } = await api.post<{ verified: boolean }>('/api/cash/verify-pin', { pin });
    return data;
  },

  setPin: async (pin: string): Promise<{ success: boolean }> => {
    const { data } = await api.post<{ success: boolean }>('/api/cash/set-pin', { pin });
    return data;
  },

  openSession: async (payload: {
    register_id: string;
    opening_amount: number;
  }): Promise<CashSession> => {
    const { data } = await api.post<CashSession>('/api/cash/sessions', payload);
    return data;
  },

  closeSession: async (
    sessionId: string,
    payload: { closing_amount: number; notes?: string },
  ): Promise<CashSession> => {
    const { data } = await api.post<CashSession>(
      `/api/cash/sessions/${sessionId}/close`,
      payload,
    );
    return data;
  },

  createTransaction: async (payload: {
    session_id: string;
    type: string;
    amount: number;
    payment_method: string;
    description?: string;
    reference?: string;
  }): Promise<CashTransaction> => {
    const { data } = await api.post<CashTransaction>('/api/cash/transactions', payload);
    return data;
  },

  sessions: async (params?: {
    status?: string;
    register_id?: string;
    page?: number;
    per_page?: number;
  }): Promise<PaginatedResponse<CashSession>> => {
    const { data } = await api.get<PaginatedResponse<CashSession>>('/api/cash/sessions', {
      params,
    });
    return data;
  },

  alerts: async (params?: {
    acknowledged?: boolean;
    page?: number;
    per_page?: number;
  }): Promise<PaginatedResponse<CashAlert>> => {
    const { data } = await api.get<PaginatedResponse<CashAlert>>('/api/cash/alerts', { params });
    return data;
  },
};

// ─── Shelves & Products ──────────────────────

export const shelves = {
  list: async (params?: {
    aisle?: string;
    page?: number;
    per_page?: number;
  }): Promise<PaginatedResponse<Shelf>> => {
    const { data } = await api.get<PaginatedResponse<Shelf>>('/api/shelves', { params });
    return data;
  },

  create: async (payload: {
    name: string;
    aisle: string;
    section: string;
    location_id?: string;
  }): Promise<Shelf> => {
    const { data } = await api.post<Shelf>('/api/shelves', payload);
    return data;
  },

  outOfStock: async (params?: {
    is_resolved?: boolean;
    page?: number;
    per_page?: number;
  }): Promise<PaginatedResponse<OutOfStockAlert>> => {
    const { data } = await api.get<PaginatedResponse<OutOfStockAlert>>('/api/shelves/out-of-stock', {
      params,
    });
    return data;
  },

  resolveOos: async (id: string): Promise<OutOfStockAlert> => {
    const { data } = await api.post<OutOfStockAlert>(`/api/shelves/out-of-stock/${id}/resolve`);
    return data;
  },

  products: async (params?: {
    shelf_id?: string;
    category?: string;
    search?: string;
    page?: number;
    per_page?: number;
  }): Promise<PaginatedResponse<Product>> => {
    const { data } = await api.get<PaginatedResponse<Product>>('/api/shelves/products', { params });
    return data;
  },

  createProduct: async (payload: {
    name: string;
    sku: string;
    barcode?: string;
    category: string;
    shelf_id?: string;
    price: number;
    stock_level: number;
    min_stock: number;
  }): Promise<Product> => {
    const { data } = await api.post<Product>('/api/shelves/products', payload);
    return data;
  },

  scans: async (params?: {
    status?: string;
    page?: number;
    per_page?: number;
  }): Promise<PaginatedResponse<StoreScan>> => {
    const { data } = await api.get<PaginatedResponse<StoreScan>>('/api/shelves/scans', { params });
    return data;
  },

  startScan: async (): Promise<StoreScan> => {
    const { data } = await api.post<StoreScan>('/api/shelves/scans');
    return data;
  },
};

// ─── Analytics ───────────────────────────────

export const analytics = {
  dashboard: async (): Promise<DashboardStats> => {
    const { data } = await api.get<DashboardStats>('/api/analytics/dashboard');
    return data;
  },

  heatmap: async (params?: {
    date?: string;
    zone_id?: string;
  }): Promise<HeatmapZone[]> => {
    const { data } = await api.get<HeatmapZone[]>('/api/analytics/heatmap', { params });
    return data;
  },

  fridge: async (): Promise<FridgeData[]> => {
    const { data } = await api.get<FridgeData[]>('/api/analytics/fridge');
    return data;
  },

  revenue: async (params?: {
    start_date?: string;
    end_date?: string;
    page?: number;
    per_page?: number;
  }): Promise<PaginatedResponse<RevenueRecord>> => {
    const { data } = await api.get<PaginatedResponse<RevenueRecord>>('/api/analytics/revenue', {
      params,
    });
    return data;
  },

  addRevenue: async (payload: {
    date: string;
    total_revenue: number;
    cash_revenue: number;
    card_revenue: number;
    mobile_revenue: number;
    transaction_count: number;
    refund_total: number;
  }): Promise<RevenueRecord> => {
    const { data } = await api.post<RevenueRecord>('/api/analytics/revenue', payload);
    return data;
  },

  projections: async (params?: {
    period?: 'week' | 'month' | 'quarter';
  }): Promise<{
    period: string;
    projected_revenue: number;
    projected_visitors: number;
    projected_transactions: number;
    confidence: number;
    data_points: Array<{ date: string; value: number; projected: boolean }>;
  }> => {
    const { data } = await api.get('/api/analytics/projections', { params });
    return data;
  },
};

// ─── Permissions ─────────────────────────────

export const permissions = {
  features: async (): Promise<FeaturePermission[]> => {
    const { data } = await api.get<FeaturePermission[]>('/api/permissions/features');
    return data;
  },

  userPermissions: async (userId: string): Promise<Record<string, boolean>> => {
    const { data } = await api.get<Record<string, boolean>>(
      `/api/permissions/users/${userId}`,
    );
    return data;
  },

  toggle: async (
    userId: string,
    featureKey: string,
    enabled: boolean,
  ): Promise<{ success: boolean }> => {
    const { data } = await api.post<{ success: boolean }>('/api/permissions/toggle', {
      user_id: userId,
      feature_key: featureKey,
      enabled,
    });
    return data;
  },

  bulk: async (
    userId: string,
    features: Record<string, boolean>,
  ): Promise<{ success: boolean }> => {
    const { data } = await api.post<{ success: boolean }>('/api/permissions/bulk', {
      user_id: userId,
      features,
    });
    return data;
  },

  applyTemplate: async (
    userId: string,
    templateId: string,
  ): Promise<{ success: boolean }> => {
    const { data } = await api.post<{ success: boolean }>('/api/permissions/apply-template', {
      user_id: userId,
      template_id: templateId,
    });
    return data;
  },

  templates: async (): Promise<RoleTemplate[]> => {
    const { data } = await api.get<RoleTemplate[]>('/api/permissions/templates');
    return data;
  },
};

// ─── Unified API Object ──────────────────────
const apiService = Object.assign(api, {
  auth,
  incidents,
  alerts,
  persons,
  cameras,
  traffic,
  team,
  cash,
  shelves,
  analytics,
  permissions,
});

export default apiService;
