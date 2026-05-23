// ──────────────────────────────────────────────
// RetailGuard AI — Core Type Definitions
// ──────────────────────────────────────────────

// ─── Auth & Users ────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'supervisor' | 'cashier' | 'security' | 'viewer';
  avatar_url?: string;
  has_pin: boolean;
  features: Record<string, boolean>;
  store_id?: string;
  created_at: string;
  updated_at: string;
  last_login?: string;
  is_active: boolean;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
  features: Record<string, boolean>;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  role?: string;
}

// ─── Incidents ───────────────────────────────

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'new' | 'reviewing' | 'confirmed' | 'resolved' | 'dismissed';

export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  camera_id: string;
  camera_name?: string;
  location_id?: string;
  location_name?: string;
  person_id?: string;
  person_name?: string;
  thumbnail_url?: string;
  video_url?: string;
  detected_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  tags: string[];
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ─── Alerts ──────────────────────────────────

export type AlertType = 'intrusion' | 'theft' | 'loitering' | 'blacklist_match' | 'unusual_activity' | 'system' | 'cash' | 'shelf';

export interface Alert {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  severity: IncidentSeverity;
  acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: string;
  incident_id?: string;
  camera_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// ─── Persons ─────────────────────────────────

export type PersonCategory = 'known' | 'unknown' | 'employee' | 'blacklisted' | 'vip';

export interface Person {
  id: string;
  name?: string;
  category: PersonCategory;
  face_encoding?: string;
  thumbnail_url?: string;
  first_seen: string;
  last_seen: string;
  visit_count: number;
  notes?: string;
  tags: string[];
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ─── Cameras & Locations ─────────────────────

export type CameraStatus = 'online' | 'offline' | 'maintenance' | 'error';

export interface Camera {
  id: string;
  name: string;
  location_id: string;
  location_name?: string;
  stream_url: string;
  status: CameraStatus;
  resolution?: string;
  fps?: number;
  ai_enabled: boolean;
  last_frame_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: string;
  name: string;
  address?: string;
  type: string;
  camera_count: number;
  created_at: string;
}

// ─── Traffic & Calendar ──────────────────────

export interface TrafficData {
  total_today: number;
  total_yesterday: number;
  change_percent: number;
  entries: number;
  exits: number;
  current_occupancy: number;
  max_occupancy: number;
  peak_hour: string;
  peak_count: number;
}

export interface HourlyTraffic {
  hour: string;
  entries: number;
  exits: number;
  occupancy: number;
}

export interface CalendarDay {
  date: string;
  total_visitors: number;
  entries: number;
  exits: number;
  peak_hour: string;
  peak_count: number;
  avg_dwell_minutes: number;
  sentiment?: 'low' | 'normal' | 'high' | 'exceptional';
}

export interface CalendarData {
  month: number;
  year: number;
  days: CalendarDay[];
  monthly_total: number;
  monthly_average: number;
  best_day: CalendarDay | null;
  worst_day: CalendarDay | null;
}

// ─── Team & Shifts ───────────────────────────

export type ShiftStatus = 'scheduled' | 'active' | 'completed' | 'missed' | 'cancelled';

export interface Shift {
  id: string;
  member_id: string;
  member_name?: string;
  date: string;
  start_time: string;
  end_time: string;
  actual_start?: string;
  actual_end?: string;
  status: ShiftStatus;
  role: string;
  notes?: string;
  created_at: string;
}

export interface TeamMember {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: string;
  avatar_url?: string;
  phone?: string;
  is_active: boolean;
  current_shift?: Shift;
  total_hours_week: number;
  total_hours_month: number;
  created_at: string;
}

export interface PerformanceMetric {
  id: string;
  member_id: string;
  metric_name: string;
  value: number;
  target: number;
  unit: string;
  period: string;
  trend: 'up' | 'down' | 'stable';
}

export interface PerformanceReview {
  id: string;
  member_id: string;
  member_name?: string;
  reviewer_id: string;
  reviewer_name?: string;
  period: string;
  overall_rating: number;
  metrics: PerformanceMetric[];
  comments: string;
  status: 'draft' | 'pending' | 'acknowledged' | 'disputed';
  created_at: string;
  updated_at: string;
}

// ─── Cash Management ─────────────────────────

export type CashSessionStatus = 'open' | 'closed' | 'reconciled' | 'discrepancy';

export interface CashSession {
  id: string;
  register_id: string;
  opened_by: string;
  opened_by_name?: string;
  closed_by?: string;
  closed_by_name?: string;
  opening_amount: number;
  closing_amount?: number;
  expected_amount?: number;
  discrepancy?: number;
  status: CashSessionStatus;
  opened_at: string;
  closed_at?: string;
  notes?: string;
}

export interface CashTransaction {
  id: string;
  session_id: string;
  type: 'sale' | 'refund' | 'void' | 'payout' | 'drop' | 'adjustment';
  amount: number;
  payment_method: 'cash' | 'card' | 'mobile' | 'other';
  reference?: string;
  description?: string;
  created_by: string;
  created_at: string;
}

export interface CashAlert {
  id: string;
  session_id?: string;
  type: 'discrepancy' | 'threshold' | 'unusual_void' | 'excessive_refund' | 'no_sale';
  severity: IncidentSeverity;
  message: string;
  amount?: number;
  acknowledged: boolean;
  created_at: string;
}

// ─── Shelves & Products ──────────────────────

export interface Shelf {
  id: string;
  name: string;
  aisle: string;
  section: string;
  location_id?: string;
  product_count: number;
  out_of_stock_count: number;
  last_scanned?: string;
  planogram_url?: string;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  category: string;
  shelf_id?: string;
  price: number;
  stock_level: number;
  min_stock: number;
  image_url?: string;
  is_active: boolean;
  created_at: string;
}

export interface OutOfStockAlert {
  id: string;
  shelf_id: string;
  shelf_name?: string;
  product_id: string;
  product_name?: string;
  detected_at: string;
  resolved_at?: string;
  resolved_by?: string;
  is_resolved: boolean;
  image_url?: string;
}

export interface StoreScan {
  id: string;
  initiated_by: string;
  initiated_by_name?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  total_shelves: number;
  scanned_shelves: number;
  issues_found: number;
  started_at: string;
  completed_at?: string;
}

// ─── Analytics & Heatmap ─────────────────────

export interface HeatmapZone {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  intensity: number;
  visitor_count: number;
  avg_dwell_seconds: number;
  color?: string;
}

export interface FridgeData {
  id: string;
  name: string;
  location: string;
  temperature: number;
  target_temperature: number;
  humidity: number;
  status: 'normal' | 'warning' | 'critical';
  door_open: boolean;
  last_opened?: string;
  product_count: number;
  alerts: number;
  updated_at: string;
}

export interface RevenueRecord {
  id: string;
  date: string;
  total_revenue: number;
  cash_revenue: number;
  card_revenue: number;
  mobile_revenue: number;
  transaction_count: number;
  avg_transaction: number;
  refund_total: number;
  net_revenue: number;
  created_at: string;
}

export interface DailyAnalytics {
  date: string;
  visitors: number;
  revenue: number;
  transactions: number;
  avg_basket_size: number;
  conversion_rate: number;
  incidents: number;
  alerts: number;
  staff_hours: number;
}

// ─── Permissions ─────────────────────────────

export interface FeaturePermission {
  id: string;
  feature_key: string;
  feature_name: string;
  description: string;
  category: string;
  is_premium: boolean;
}

export interface RoleTemplate {
  id: string;
  name: string;
  role: string;
  description: string;
  features: Record<string, boolean>;
  is_default: boolean;
}

// ─── Dashboard ───────────────────────────────

export interface DashboardStats {
  total_incidents_today: number;
  active_alerts: number;
  cameras_online: number;
  cameras_total: number;
  current_occupancy: number;
  max_occupancy: number;
  total_visitors_today: number;
  visitor_change_percent: number;
  revenue_today: number;
  revenue_yesterday: number;
  revenue_change_percent: number;
  active_staff: number;
  total_staff: number;
  open_cash_sessions: number;
  out_of_stock_items: number;
  avg_dwell_minutes: number;
  recent_incidents: Incident[];
  recent_alerts: Alert[];
  hourly_traffic: HourlyTraffic[];
  top_zones: HeatmapZone[];
}

// ─── API Helpers ─────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface ApiError {
  detail: string;
  status_code: number;
}
