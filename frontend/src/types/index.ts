export interface Incident {
  id: string;
  created_at: string;
  person_id: string | null;
  person_display_name: string | null;
  person_status: string | null;
  incident_type: string;
  severity: string;
  review_status: string;
  camera_id: string | null;
  zone_name: string | null;
  ai_confidence: number;
  ai_description: string | null;
  detected_at: string;
  estimated_item: string | null;
  estimated_value: number | null;
  clips: Clip[];
  detection_details: any;
}

export interface Clip {
  id: string;
  clip_url: string;
  thumbnail_path: string | null;
  duration_seconds: number;
  key_moment_offset: number | null;
  annotations?: any;
}

export interface Alert {
  id: string;
  created_at: string;
  person_id: string;
  person_display_name: string | null;
  person_status: string;
  person_threat_level: number;
  person_total_thefts: number;
  alert_type: string;
  priority: string;
  status: string;
  title: string;
  message: string | null;
  tracking_active: boolean;
  current_camera_id: string | null;
  reference_clip_url: string | null;
  current_snapshot_path: string | null;
  match_confidence: number | null;
  match_details: any;
  best_portrait_path: string | null;
}

export interface Person {
  id: string;
  status: string;
  threat_level: number;
  display_name: string | null;
  notes: string | null;
  estimated_age_range: string | null;
  estimated_gender: string | null;
  estimated_height_cm: number | null;
  estimated_build: string | null;
  hair_description: string | null;
  best_portrait_path: string | null;
  total_visits: number;
  total_incidents: number;
  total_confirmed_thefts: number;
  first_seen: string | null;
  last_seen: string | null;
}

export interface IncidentStats {
  total_incidents: number;
  pending_review: number;
  confirmed_thefts: number;
  false_positives: number;
  total_estimated_loss: number;
}

export interface User {
  id: string;
  email: string;
  username: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
}
