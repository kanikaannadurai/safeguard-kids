export interface Log {
  id: number;
  timestamp: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'system';
  category: string;
  severity: 'Low' | 'Medium' | 'High';
  content: string;
  status: 'blocked' | 'allowed';
  feedback?: 'safe' | 'unsafe';
}

export interface Settings {
  sensitivity: 'Low' | 'Medium' | 'High';
  alert_email: string;
  age_limit: number;
  allowed_categories: string[];
  screen_time_limit_minutes: number;
  blocked_websites: string[];
  face_detection_enabled: boolean;
  voice_alerts_enabled: boolean;
  password_enabled?: boolean;
  parent_face_data?: string;
  parent_password?: string;
}

export interface ContentItem {
  id: string;
  type: 'text' | 'image' | 'video';
  data: string;
  isBlocked: boolean;
  category?: string;
  reason?: string;
  ageRating?: number;
  isKidsSafe?: boolean;
}

export interface Stats {
  totalBlocked: number;
  categoryBreakdown: { category: string; count: number }[];
  screenTimeUsedMinutes: number;
}
