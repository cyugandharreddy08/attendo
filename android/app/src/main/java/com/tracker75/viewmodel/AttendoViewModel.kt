package com.tracker75.viewmodel

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tracker75.core.AttendoCore
import com.tracker75.core.NotificationHelper
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.*

data class ChatMsg(
    val id: String,
    val role: String,
    val content: String,
    val actionCard: JSONObject? = null,
    val timestamp: String
)

class AttendoViewModel : ViewModel() {
    private val dateFmt = SimpleDateFormat("yyyy-MM-dd", Locale.US)

    private val _selectedDate = MutableStateFlow(dateFmt.format(Date()))
    val selectedDate: StateFlow<String> = _selectedDate.asStateFlow()

    private val _snapshot = MutableStateFlow(JSONObject())
    val snapshot: StateFlow<JSONObject> = _snapshot.asStateFlow()

    private val _timetable = MutableStateFlow(JSONArray())
    val timetable: StateFlow<JSONArray> = _timetable.asStateFlow()

    private val _chatMessages = MutableStateFlow<List<ChatMsg>>(
        listOf(
            ChatMsg(
                id = "welcome",
                role = "assistant",
                content = "### 👋 Hey! I'm **Proxy**, your 24/7 Attendance Wingman.\n\nPowered by **Rust native speed**, I can:\n• Check your safe bunks & danger-zone subjects\n• Shift or unshift classes to leisure slots\n• Simulate bunk consequences before you skip\n• Plan your attendance till semester end!",
                timestamp = "Now"
            )
        )
    )
    val chatMessages: StateFlow<List<ChatMsg>> = _chatMessages.asStateFlow()

    private val _aiLoading = MutableStateFlow(false)
    val aiLoading: StateFlow<Boolean> = _aiLoading.asStateFlow()

    private val _studentProfile = MutableStateFlow<JSONObject?>(null)
    val studentProfile: StateFlow<JSONObject?> = _studentProfile.asStateFlow()

    private val _studentSearchResults = MutableStateFlow(JSONArray())
    val studentSearchResults: StateFlow<JSONArray> = _studentSearchResults.asStateFlow()

    private val _localBugs = MutableStateFlow(JSONArray())
    val localBugs: StateFlow<JSONArray> = _localBugs.asStateFlow()

    private val _updateInfo = MutableStateFlow<JSONObject?>(null)
    val updateInfo: StateFlow<JSONObject?> = _updateInfo.asStateFlow()

    private val _bannerMessage = MutableStateFlow<String?>(null)
    val bannerMessage: StateFlow<String?> = _bannerMessage.asStateFlow()

    private val _isSyncing = MutableStateFlow(false)
    val isSyncing: StateFlow<Boolean> = _isSyncing.asStateFlow()

    init {
        refreshAll()
    }

    fun clearBanner() {
        _bannerMessage.value = null
    }

    fun showBanner(msg: String) {
        _bannerMessage.value = msg
    }

    fun selectDate(dateStr: String) {
        _selectedDate.value = dateStr
        refreshDashboard(dateStr)
    }

    fun refreshAll() {
        refreshDashboard(_selectedDate.value)
        refreshTimetable()
        loadStudentProfile()
        loadLocalBugs()
    }

    fun refreshDashboard(dateStr: String = _selectedDate.value) {
        viewModelScope.launch {
            val res = AttendoCore.invoke("get_dashboard_snapshot", JSONObject().put("date", dateStr))
            res.onSuccess { _snapshot.value = it }
        }
    }

    fun refreshTimetable() {
        viewModelScope.launch {
            AttendoCore.invokeArray("get_timetable").onSuccess { _timetable.value = it }
        }
    }

    fun markInstance(id: Long, status: String?, notes: String? = null) {
        viewModelScope.launch {
            val p = JSONObject().put("id", id)
            if (status != null) p.put("status", status) else p.put("status", JSONObject.NULL)
            if (notes != null) p.put("notes", notes)
            AttendoCore.invoke("mark_instance", p).onSuccess {
                refreshDashboard()
                autoCloudSyncQuiet()
            }
        }
    }

    fun markEntireDay(dateStr: String, status: String) {
        viewModelScope.launch {
            val p = JSONObject().put("date", dateStr).put("status", status)
            AttendoCore.invoke("mark_entire_day", p).onSuccess {
                showBanner("Marked day as ${status.uppercase()}")
                refreshDashboard()
                autoCloudSyncQuiet()
            }
        }
    }

    fun shiftInstance(
        id: Long,
        targetDate: String,
        targetStart: String,
        targetEnd: String,
        reason: String,
        isPermanent: Boolean
    ) {
        viewModelScope.launch {
            val p = JSONObject()
                .put("id", id)
                .put("target_date", targetDate)
                .put("target_start_time", targetStart)
                .put("target_end_time", targetEnd)
                .put("reason", reason)
                .put("is_permanent", isPermanent)
            AttendoCore.invoke("shift_instance", p).onSuccess {
                showBanner("Class shifted to $targetDate $targetStart")
                refreshAll()
                autoCloudSyncQuiet()
            }
        }
    }

    fun unshiftInstance(id: Long) {
        viewModelScope.launch {
            AttendoCore.invoke("unshift_instance", JSONObject().put("id", id)).onSuccess {
                showBanner("Class unshifted back to original slot")
                refreshDashboard()
                autoCloudSyncQuiet()
            }
        }
    }

    fun addOrUpdateSubject(
        id: Long? = null,
        name: String,
        color: String,
        targetPercent: Int,
        subjectType: String,
        isFrozen: Boolean,
        pastAttended: Int,
        pastTotal: Int,
        credits: Int
    ) {
        viewModelScope.launch {
            val p = JSONObject()
                .put("name", name)
                .put("color", color)
                .put("target_percent", targetPercent)
                .put("subject_type", subjectType)
                .put("is_frozen", if (isFrozen) 1 else 0)
                .put("past_attended", pastAttended)
                .put("past_total", pastTotal)
                .put("credits", credits)
            val method = if (id != null) {
                p.put("id", id)
                "update_subject"
            } else {
                "add_subject"
            }
            AttendoCore.invoke(method, p).onSuccess {
                showBanner(if (id != null) "Updated $name" else "Added $name")
                refreshAll()
                autoCloudSyncQuiet()
            }
        }
    }

    fun deleteSubject(id: Long) {
        viewModelScope.launch {
            AttendoCore.invoke("delete_subject", JSONObject().put("id", id)).onSuccess {
                showBanner("Subject deleted")
                refreshAll()
                autoCloudSyncQuiet()
            }
        }
    }

    fun addTimetableEntry(subjectId: Long, day: String, start: String, end: String, room: String) {
        viewModelScope.launch {
            val p = JSONObject()
                .put("subject_id", subjectId)
                .put("day_of_week", day)
                .put("start_time", start)
                .put("end_time", end)
                .put("room", room)
            AttendoCore.invoke("add_timetable_entry", p).onSuccess {
                showBanner("Added slot on $day $start")
                refreshAll()
                autoCloudSyncQuiet()
            }
        }
    }

    fun deleteTimetableEntry(id: Long) {
        viewModelScope.launch {
            AttendoCore.invoke("delete_timetable_entry", JSONObject().put("id", id)).onSuccess {
                refreshAll()
                autoCloudSyncQuiet()
            }
        }
    }

    fun addTodo(
        title: String,
        subjectId: Long?,
        dueDate: String,
        dueTime: String?,
        priority: String,
        alarmMinutes: Int,
        notes: String
    ) {
        viewModelScope.launch {
            val p = JSONObject()
                .put("title", title)
                .put("subject_id", subjectId ?: JSONObject.NULL)
                .put("due_date", dueDate)
                .put("due_time", dueTime ?: JSONObject.NULL)
                .put("priority", priority)
                .put("alarm_minutes_before", alarmMinutes)
                .put("notes", notes)
            AttendoCore.invoke("add_todo", p).onSuccess {
                showBanner("Task added: $title")
                refreshDashboard()
                autoCloudSyncQuiet()
            }
        }
    }

    fun toggleTodo(id: Long) {
        viewModelScope.launch {
            AttendoCore.invoke("toggle_todo", JSONObject().put("id", id)).onSuccess {
                refreshDashboard()
                autoCloudSyncQuiet()
            }
        }
    }

    fun deleteTodo(id: Long) {
        viewModelScope.launch {
            AttendoCore.invoke("delete_todo", JSONObject().put("id", id)).onSuccess {
                refreshDashboard()
                autoCloudSyncQuiet()
            }
        }
    }

    fun sendAiChat(prompt: String) {
        if (prompt.isBlank() || _aiLoading.value) return
        val userMsg = ChatMsg(
            id = UUID.randomUUID().toString(),
            role = "user",
            content = prompt.trim(),
            timestamp = SimpleDateFormat("HH:mm", Locale.US).format(Date())
        )
        val prevHistory = _chatMessages.value
        _chatMessages.value = prevHistory + userMsg
        _aiLoading.value = true

        viewModelScope.launch {
            val histArr = JSONArray()
            prevHistory.takeLast(10).forEach { m ->
                histArr.put(
                    JSONObject()
                        .put("id", m.id)
                        .put("role", m.role)
                        .put("content", m.content)
                        .put("timestamp", m.timestamp)
                )
            }
            val p = JSONObject().put("prompt", prompt.trim()).put("history", histArr)
            val res = AttendoCore.invoke("send_ai_chat", p)
            _aiLoading.value = false
            res.onSuccess { data ->
                val aiMsg = ChatMsg(
                    id = UUID.randomUUID().toString(),
                    role = "assistant",
                    content = data.optString("content", "Done!"),
                    actionCard = data.optJSONObject("actionCard"),
                    timestamp = SimpleDateFormat("HH:mm", Locale.US).format(Date())
                )
                _chatMessages.value = _chatMessages.value + aiMsg
                refreshAll()
            }.onFailure { err ->
                val errMsg = ChatMsg(
                    id = UUID.randomUUID().toString(),
                    role = "assistant",
                    content = "> ⚠️ **Proxy AI Error**: ${err.message}\n\nCheck your internet connection or Groq API key in AI Settings.",
                    timestamp = SimpleDateFormat("HH:mm", Locale.US).format(Date())
                )
                _chatMessages.value = _chatMessages.value + errMsg
            }
        }
    }

    fun backupToCloud() {
        viewModelScope.launch {
            _isSyncing.value = true
            AttendoCore.invoke("backup_to_cloud").onSuccess { res ->
                showBanner(res.optString("message", "Cloud backup complete!"))
                refreshDashboard()
            }.onFailure { e ->
                showBanner("Backup failed: ${e.message}")
            }
            _isSyncing.value = false
        }
    }

    fun restoreFromCloud(code: String, mode: String) {
        viewModelScope.launch {
            _isSyncing.value = true
            val p = JSONObject().put("code", code).put("mode", mode)
            AttendoCore.invoke("restore_from_cloud", p).onSuccess { res ->
                showBanner(res.optString("message", "Restore complete!"))
                refreshAll()
            }.onFailure { e ->
                showBanner("Restore failed: ${e.message}")
            }
            _isSyncing.value = false
        }
    }

    private fun autoCloudSyncQuiet() {
        viewModelScope.launch {
            AttendoCore.invoke("backup_to_cloud")
        }
    }

    fun loadStudentProfile() {
        viewModelScope.launch {
            AttendoCore.invoke("get_student_profile").onSuccess { data ->
                if (data.has("username")) {
                    _studentProfile.value = data
                }
            }
        }
    }

    fun saveStudentProfile(
        fullName: String,
        username: String,
        college: String,
        year: String,
        branch: String,
        isPublic: Boolean
    ) {
        viewModelScope.launch {
            val report = _snapshot.value.optJSONObject("report")
            val overall = report?.optJSONObject("overall")?.optDouble("percent", 0.0) ?: 0.0
            val theory = report?.optJSONObject("theory")?.optDouble("percent", 0.0) ?: 0.0
            val lab = report?.optJSONObject("lab")?.optDouble("percent", 0.0) ?: 0.0
            val heatmap = _snapshot.value.optJSONObject("heatmap")

            val profile = JSONObject()
                .put("id", _studentProfile.value?.optString("id") ?: UUID.randomUUID().toString())
                .put("username", username.trim().lowercase())
                .put("full_name", fullName.trim())
                .put("college", college.trim())
                .put("academic_year", year)
                .put("branch", branch.trim())
                .put("overall_percent", overall)
                .put("theory_percent", theory)
                .put("lab_percent", lab)
                .put("current_streak", heatmap?.optInt("currentStreak", 0) ?: 0)
                .put("longest_streak", heatmap?.optInt("longestStreak", 0) ?: 0)
                .put("total_attended_hours", heatmap?.optDouble("totalAttendedHours", 0.0) ?: 0.0)
                .put("total_held_hours", heatmap?.optDouble("totalHeldHours", 0.0) ?: 0.0)
                .put("active_days_count", heatmap?.optInt("activeDaysCount", 0) ?: 0)
                .put("is_public", isPublic)

            AttendoCore.invoke("save_student_profile", profile).onSuccess {
                _studentProfile.value = profile
                showBanner("Profile saved & synced to campus directory!")
            }.onFailure { e ->
                showBanner("Profile save error: ${e.message}")
            }
        }
    }

    fun searchStudents(query: String, college: String = "") {
        viewModelScope.launch {
            val p = JSONObject().put("query", query).put("college", college)
            AttendoCore.invokeArray("search_students", p).onSuccess {
                _studentSearchResults.value = it
            }
        }
    }

    fun loadLocalBugs() {
        viewModelScope.launch {
            AttendoCore.invokeArray("get_local_bugs").onSuccess {
                _localBugs.value = it
            }
        }
    }

    fun submitBugReport(title: String, desc: String, category: String, severity: String, steps: String) {
        viewModelScope.launch {
            val p = JSONObject()
                .put("title", title)
                .put("description", desc)
                .put("category", category)
                .put("severity", severity)
                .put("steps", steps)
            AttendoCore.invoke("submit_bug_report", p).onSuccess {
                showBanner("Bug report submitted!")
                loadLocalBugs()
            }
        }
    }

    fun checkForUpdate() {
        viewModelScope.launch {
            AttendoCore.invoke("check_github_update", JSONObject().put("version_code", 900)).onSuccess {
                _updateInfo.value = it
                if (!it.optBoolean("hasUpdate", false)) {
                    showBanner("You are on the latest version (v9.0.0)!")
                }
            }.onFailure {
                showBanner("Could not reach GitHub Releases")
            }
        }
    }

    fun scheduleReminders(context: Context) {
        NotificationHelper.scheduleDailyNudge(context)
        showBanner("Daily 8:30 PM attendance nudge scheduled!")
    }
}
