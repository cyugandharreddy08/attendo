export type AttendanceStatus = 'present' | 'absent' | 'holiday' | 'cancelled' | 'shifted';

export interface Subject {
  id: number;
  name: string;
  color: string;
  target_percent: number;
  subject_type?: 'theory' | 'lab';
  is_frozen: number; // 0 = active, 1 = frozen (leisure)
  past_attended: number; // mid-semester onboarding past attended
  past_total: number; // mid-semester onboarding past total
  credits: number; // weightage per class
}

export interface TimetableEntry {
  id: number;
  subject_id: number;
  day_of_week: string; // 'Monday' | 'Tuesday' | ...
  start_time: string; // 'HH:MM'
  end_time: string;
  room: string;
  subject?: Subject; // joined
}

export interface LectureInstance {
  id: number;
  subject_id: number;
  date: string; // 'YYYY-MM-DD'
  day_of_week: string;
  start_time: string;
  end_time: string;
  status: AttendanceStatus | null;
  marked_at: string | null;
  is_override: number; // 0 or 1
  original_timetable_id: number | null;
  room: string;
  notes: string;
  subject?: Subject; // joined
}

export interface Override {
  id: number;
  timetable_id: number;
  date: string;
  new_start_time: string | null;
  new_day: string | null;
  reason: string;
}

export interface EditHistory {
  id: number;
  lecture_instance_id: number;
  old_status: AttendanceStatus | null;
  new_status: AttendanceStatus;
  edited_at: string;
}

export interface AttendanceStats {
  total: number;
  attended: number;
  absent: number;
  holiday: number;
  cancelled: number;
  percent: number;
  maxBunkable: number;
  neededToTarget: number;
  isInDangerZone: boolean;
  statusMessage: string;
}

export interface AITimetableEntry {
  subject: string;
  type?: 'theory' | 'lab';
  day: string;
  start_time: string;
  end_time: string;
  room: string;
}

export interface VersionInfo {
  versionName: string;
  versionCode: number;
  apkUrl: string;
}

export type PriorityLevel = 'low' | 'medium' | 'high';

export interface TodoItem {
  id: number;
  title: string;
  subject_id: number | null;
  due_date: string; // 'YYYY-MM-DD'
  due_time: string | null; // 'HH:MM'
  priority: PriorityLevel;
  is_completed: number; // 0 or 1
  alarm_minutes_before: number; // e.g. 15, 30, 60, 0
  notes: string;
  created_at: string;
  subject?: Subject; // joined
}

export interface AttendanceActivityDay {
  date: string; // 'YYYY-MM-DD'
  count: number; // classes attended
  hours: number; // hours attended
  level: 0 | 1 | 2 | 3 | 4; // intensity level for LeetCode heatmap
}

export interface StudentProfile {
  id: string;
  email?: string;
  phone?: string;
  username: string;
  full_name: string;
  college: string;
  academic_year: string; // e.g. '1st Year', '2nd Year', '3rd Year', '4th Year'
  branch?: string;
  overall_percent: number;
  theory_percent: number;
  lab_percent: number;
  current_streak: number;
  longest_streak: number;
  total_attended_hours: number;
  total_held_hours: number;
  active_days_count: number;
  activity_matrix: AttendanceActivityDay[];
  badges: string[];
  is_public: boolean;
  updated_at?: string;
  last_active_at?: string;
}

export type RootStackParamList = {
  MainTabs: undefined;
  SubjectDetail: {subjectId: number; subjectName: string};
  AddSubject: {subject?: Subject};
  AddTimetableEntry: {entry?: TimetableEntry; subjectId?: number};
  TimetableScan: undefined;
  BugReport: undefined;
  MyBugs: undefined;
  Changelog: undefined;
  AccountSync: undefined;
  PhoneAuth: {onSuccess?: () => void} | undefined;
  StudentAuth: {onSuccess?: () => void} | undefined;
  StudentSearch: {initialCollege?: string} | undefined;
  PublicProfile: {profile?: StudentProfile; username?: string; profileId?: string};
  CalendarHeatmap: undefined;
};

export type BottomTabParamList = {
  Timetable: undefined;
  Todos: undefined;
  Peers?: undefined;
  Stats: undefined;
  Calendar: undefined;
  Settings: undefined;
};
