use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AttendanceStatus {
    Present,
    Absent,
    Holiday,
    Cancelled,
    Shifted,
}

impl AttendanceStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Present => "present",
            Self::Absent => "absent",
            Self::Holiday => "holiday",
            Self::Cancelled => "cancelled",
            Self::Shifted => "shifted",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s.trim().to_lowercase().as_str() {
            "present" => Some(Self::Present),
            "absent" => Some(Self::Absent),
            "holiday" => Some(Self::Holiday),
            "cancelled" => Some(Self::Cancelled),
            "shifted" => Some(Self::Shifted),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subject {
    pub id: i64,
    pub name: String,
    pub color: String,
    pub target_percent: i32,
    pub subject_type: String, // "theory" | "lab"
    pub is_frozen: i32,       // 0 = active, 1 = frozen (leisure)
    pub past_attended: i32,
    pub past_total: i32,
    pub credits: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubjectInput {
    pub name: String,
    pub color: String,
    pub target_percent: i32,
    pub subject_type: String,
    pub is_frozen: i32,
    pub past_attended: i32,
    pub past_total: i32,
    pub credits: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimetableEntry {
    pub id: i64,
    pub subject_id: i64,
    pub day_of_week: String,
    pub start_time: String,
    pub end_time: String,
    pub room: String,
    #[serde(default)]
    pub subject_name: Option<String>,
    #[serde(default)]
    pub subject_color: Option<String>,
    #[serde(default)]
    pub subject_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimetableEntryInput {
    pub subject_id: i64,
    pub day_of_week: String,
    pub start_time: String,
    pub end_time: String,
    pub room: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LectureInstance {
    pub id: i64,
    pub subject_id: i64,
    pub date: String,
    pub day_of_week: String,
    pub start_time: String,
    pub end_time: String,
    pub status: Option<String>,
    pub marked_at: Option<String>,
    pub is_override: i32,
    pub original_timetable_id: Option<i64>,
    pub room: String,
    pub notes: String,
    #[serde(default)]
    pub subject_name: Option<String>,
    #[serde(default)]
    pub subject_color: Option<String>,
    #[serde(default)]
    pub subject_type: Option<String>,
    #[serde(default)]
    pub is_frozen: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OverrideRecord {
    pub id: i64,
    pub timetable_id: i64,
    pub date: String,
    pub new_start_time: Option<String>,
    pub new_day: Option<String>,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditHistoryRecord {
    pub id: i64,
    pub lecture_instance_id: i64,
    pub old_status: Option<String>,
    pub new_status: String,
    pub edited_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TodoItem {
    pub id: i64,
    pub title: String,
    pub subject_id: Option<i64>,
    pub due_date: String,
    pub due_time: Option<String>,
    pub priority: String, // "low" | "medium" | "high"
    pub is_completed: i32,
    pub alarm_minutes_before: i32,
    pub notes: String,
    pub created_at: String,
    #[serde(default)]
    pub subject_name: Option<String>,
    #[serde(default)]
    pub subject_color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TodoInput {
    pub title: String,
    pub subject_id: Option<i64>,
    pub due_date: String,
    pub due_time: Option<String>,
    pub priority: String,
    pub alarm_minutes_before: i32,
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalBug {
    pub id: i64,
    pub title: String,
    pub description: String,
    pub category: String,
    pub severity: String,
    pub steps_to_reproduce: Option<String>,
    pub image_uri: Option<String>,
    pub created_at: String,
    pub is_synced: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BaseAttendanceMetrics {
    pub attended_hours: f64,
    pub conducted_hours: f64,
    pub absent_hours: f64,
    pub holiday_hours: f64,
    pub cancelled_hours: f64,
    pub percent: i32,
    pub target_percent: i32,
    pub is_eligible: bool,
    pub max_bunkable_hours: i32,
    pub needed_consecutive_hours: i32,
    pub status_message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SplitAttendanceReport {
    pub theory: BaseAttendanceMetrics,
    pub lab: BaseAttendanceMetrics,
    pub overall: BaseAttendanceMetrics,
    pub total_lecture_count: i32,
    pub total_present_count: i32,
    pub total_absent_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubjectWithMetrics {
    pub subject: Subject,
    pub metrics: BaseAttendanceMetrics,
    pub total_classes: i32,
    pub present_classes: i32,
    pub absent_classes: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SimulationResult {
    pub projected_percent: i32,
    pub projected_attended_hours: f64,
    pub projected_conducted_hours: f64,
    pub diff_percent: i32,
    pub is_eligible: bool,
    pub status_message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttendanceActivityDay {
    pub date: String,
    pub count: i32,
    pub hours: f64,
    pub level: u8, // 0..=4
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HeatmapSummary {
    pub days: Vec<AttendanceActivityDay>,
    pub current_streak: i32,
    pub longest_streak: i32,
    pub active_days_count: i32,
    pub total_attended_hours: f64,
    pub total_held_hours: f64,
    pub badges: Vec<AchievementBadge>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AchievementBadge {
    pub id: String,
    pub title: String,
    pub description: String,
    pub icon: String,
    pub unlocked: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudentProfile {
    pub id: String,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub phone: Option<String>,
    pub username: String,
    pub full_name: String,
    pub college: String,
    pub academic_year: String,
    #[serde(default)]
    pub branch: Option<String>,
    pub overall_percent: f64,
    pub theory_percent: f64,
    pub lab_percent: f64,
    pub current_streak: i32,
    pub longest_streak: i32,
    pub total_attended_hours: f64,
    pub total_held_hours: f64,
    pub active_days_count: i32,
    #[serde(default)]
    pub activity_matrix: Vec<AttendanceActivityDay>,
    #[serde(default)]
    pub badges: Vec<String>,
    pub is_public: bool,
    #[serde(default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudBackupPayload {
    pub schema_version: i32,
    pub app_version: String,
    pub exported_at: String,
    pub checksum: String,
    pub subjects: Vec<Subject>,
    pub timetable: Vec<TimetableEntry>,
    pub instances: Vec<LectureInstance>,
    pub overrides: Vec<OverrideRecord>,
    pub todos: Vec<TodoItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    pub success: bool,
    pub sync_key: String,
    pub message: String,
    pub subjects_count: usize,
    pub classes_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AIActionCardData {
    #[serde(rename = "type")]
    pub card_type: String,
    pub title: String,
    pub description: String,
    pub details: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub id: String,
    pub role: String,
    pub content: String,
    #[serde(default)]
    pub action_card: Option<AIActionCardData>,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckResult {
    pub has_update: bool,
    pub latest_version: String,
    pub latest_code: i32,
    pub apk_url: String,
    pub release_notes: String,
    pub is_mandatory: bool,
}
