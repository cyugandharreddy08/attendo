package com.tracker75.ui.screens

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.ChevronLeft
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tracker75.core.AttendoCore
import com.tracker75.ui.components.CyberBentoCard
import com.tracker75.ui.components.StatusPill
import com.tracker75.ui.components.cyberGridBackground
import com.tracker75.ui.theme.CyberColors
import com.tracker75.viewmodel.AttendoViewModel
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun CalendarHeatmapScreen(
    vm: AttendoViewModel,
    onBack: () -> Unit
) {
    val snapshot by vm.snapshot.collectAsState()
    val context = LocalContext.current
    val heatmap = snapshot.optJSONObject("heatmap")
    val report = snapshot.optJSONObject("report")
    val subjects = snapshot.optJSONArray("subjects") ?: JSONArray()

    val daysArr = heatmap?.optJSONArray("days") ?: JSONArray()
    val badges = heatmap?.optJSONArray("badges") ?: JSONArray()
    val currentStreak = heatmap?.optInt("currentStreak", 0) ?: 0
    val longestStreak = heatmap?.optInt("longestStreak", 0) ?: 0
    val activeDays = heatmap?.optInt("activeDaysCount", 0) ?: 0
    val totalAttHours = heatmap?.optDouble("totalAttendedHours", 0.0) ?: 0.0

    // Map "YYYY-MM-DD" -> (count, hours, level)
    val dayStatsMap = remember(daysArr) {
        val map = mutableMapOf<String, JSONObject>()
        for (i in 0 until daysArr.length()) {
            val obj = daysArr.optJSONObject(i) ?: continue
            map[obj.optString("date")] = obj
        }
        map
    }

    var monthOffset by remember { mutableIntStateOf(0) }
    val todayStr = remember { SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date()) }
    var selectedCalDate by remember { mutableStateOf(todayStr) }
    var selectedDayClasses by remember { mutableStateOf(JSONArray()) }

    LaunchedEffect(selectedCalDate) {
        AttendoCore.invokeArray("get_day_classes", JSONObject().put("date", selectedCalDate))
            .onSuccess { selectedDayClasses = it }
    }

    val cal = remember(monthOffset) {
        Calendar.getInstance().apply {
            set(Calendar.DAY_OF_MONTH, 1)
            add(Calendar.MONTH, monthOffset)
        }
    }
    val monthLabel = remember(monthOffset) {
        SimpleDateFormat("MMMM yyyy", Locale.US).format(cal.time)
    }
    val daysInMonth = cal.getActualMaximum(Calendar.DAY_OF_MONTH)
    // Monday = 0 .. Sunday = 6
    val firstDayOffset = remember(monthOffset) {
        val dow = cal.get(Calendar.DAY_OF_WEEK) // Sun=1, Mon=2..Sat=7
        if (dow == Calendar.SUNDAY) 6 else dow - 2
    }
    val yearMonthPrefix = remember(monthOffset) {
        SimpleDateFormat("yyyy-MM", Locale.US).format(cal.time)
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .cyberGridBackground(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Back", tint = CyberColors.TextPrimary)
                    }
                    Column {
                        Text("ATTENDANCE CALENDAR", color = CyberColors.NeonCyan, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.4.sp)
                        Text("Calendar & Reports", color = CyberColors.TextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Black)
                    }
                }
                Button(
                    onClick = {
                        val overallPct = report?.optJSONObject("overall")?.optInt("percent", 0) ?: 0
                        val summary = buildString {
                            appendLine("📊 ATTENDO ATTENDANCE REPORT (v9.0)")
                            appendLine("Overall Attendance: $overallPct% | Streak: ${currentStreak}d | Attended: ${totalAttHours}h")
                            appendLine("---")
                            for (i in 0 until subjects.length()) {
                                val item = subjects.getJSONObject(i)
                                val s = item.getJSONObject("subject")
                                val m = item.getJSONObject("metrics")
                                appendLine("• ${s.optString("name")}: ${m.optInt("percent")}% (${m.optDouble("attendedHours")}h / ${m.optDouble("conductedHours")}h)")
                            }
                        }
                        val intent = Intent(Intent.ACTION_SEND).apply {
                            type = "text/plain"
                            putExtra(Intent.EXTRA_TEXT, summary)
                        }
                        context.startActivity(Intent.createChooser(intent, "Share Attendance Report"))
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = CyberColors.ElectricViolet),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.Rounded.Share, null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Export", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        // Streak & Hours Summary
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                CyberBentoCard(modifier = Modifier.weight(1f), borderColor = CyberColors.Cancelled.copy(alpha = 0.45f)) {
                    Text("🔥 STREAK", color = CyberColors.TextMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    Text("${currentStreak}d", color = CyberColors.Cancelled, fontSize = 24.sp, fontWeight = FontWeight.Black)
                    Text("Best: ${longestStreak}d", color = CyberColors.TextSecondary, fontSize = 11.sp)
                }
                CyberBentoCard(modifier = Modifier.weight(1f), borderColor = CyberColors.Present.copy(alpha = 0.45f)) {
                    Text("⚡ LOGGED HOURS", color = CyberColors.TextMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    Text("${totalAttHours}h", color = CyberColors.Present, fontSize = 24.sp, fontWeight = FontWeight.Black)
                    Text("$activeDays active days", color = CyberColors.TextSecondary, fontSize = 11.sp)
                }
            }
        }

        // Spacious Monthly Calendar Card
        item {
            CyberBentoCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(onClick = { monthOffset-- }) {
                        Icon(Icons.Rounded.ChevronLeft, "Previous Month", tint = CyberColors.TextPrimary)
                    }
                    Text(monthLabel, color = CyberColors.TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold)
                    IconButton(onClick = { monthOffset++ }) {
                        Icon(Icons.Rounded.ChevronRight, "Next Month", tint = CyberColors.TextPrimary)
                    }
                }

                Spacer(Modifier.height(8.dp))

                // Weekday Header
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun").forEach { d ->
                        Text(
                            text = d,
                            color = CyberColors.TextMuted,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }

                Spacer(Modifier.height(10.dp))

                // Spacious Calendar Grid (6 rows max x 7 cols)
                val totalCells = firstDayOffset + daysInMonth
                val rows = (totalCells + 6) / 7
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    for (r in 0 until rows) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            for (c in 0 until 7) {
                                val cellIdx = r * 7 + c
                                val dayNum = cellIdx - firstDayOffset + 1
                                if (dayNum in 1..daysInMonth) {
                                    val isoDate = String.format(Locale.US, "%s-%02d", yearMonthPrefix, dayNum)
                                    val stats = dayStatsMap[isoDate]
                                    val count = stats?.optInt("count", 0) ?: 0
                                    val isToday = isoDate == todayStr
                                    val isSelected = isoDate == selectedCalDate

                                    val cellBg = when {
                                        isSelected -> CyberColors.ElectricViolet.copy(alpha = 0.28f)
                                        count > 0 -> CyberColors.Present.copy(alpha = 0.14f)
                                        else -> CyberColors.GlassSurface
                                    }
                                    val cellBorder = when {
                                        isSelected -> CyberColors.NeonCyan
                                        isToday -> CyberColors.ElectricViolet
                                        count > 0 -> CyberColors.Present.copy(alpha = 0.45f)
                                        else -> CyberColors.CyberBorder.copy(alpha = 0.5f)
                                    }

                                    Column(
                                        modifier = Modifier
                                            .weight(1f)
                                            .height(48.dp)
                                            .clip(RoundedCornerShape(12.dp))
                                            .background(cellBg)
                                            .border(1.dp, cellBorder, RoundedCornerShape(12.dp))
                                            .clickable { selectedCalDate = isoDate },
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                        verticalArrangement = Arrangement.Center
                                    ) {
                                        Text(
                                            text = "$dayNum",
                                            color = if (isSelected || isToday) Color.White else CyberColors.TextPrimary,
                                            fontSize = 13.sp,
                                            fontWeight = if (isSelected || isToday) FontWeight.Black else FontWeight.SemiBold
                                        )
                                        Spacer(Modifier.height(3.dp))
                                        if (count > 0) {
                                            Box(
                                                modifier = Modifier
                                                    .size(6.dp)
                                                    .clip(CircleShape)
                                                    .background(CyberColors.Present)
                                            )
                                        } else {
                                            Spacer(Modifier.height(6.dp))
                                        }
                                    }
                                } else {
                                    Spacer(modifier = Modifier.weight(1f).height(48.dp))
                                }
                            }
                        }
                    }
                }
            }
        }

        // Selected Date Schedule Detail
        item {
            CyberBentoCard(borderColor = CyberColors.ElectricViolet.copy(alpha = 0.4f)) {
                Text("CLASSES ON $selectedCalDate", color = CyberColors.NeonCyan, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.sp)
                Spacer(Modifier.height(8.dp))
                if (selectedDayClasses.length() == 0) {
                    Text("No classes recorded for this date.", color = CyberColors.TextMuted, fontSize = 12.sp)
                } else {
                    for (i in 0 until selectedDayClasses.length()) {
                        val cls = selectedDayClasses.getJSONObject(i)
                        val st = if (cls.isNull("status")) "unmarked" else cls.optString("status")
                        val stColor = when (st) {
                            "present" -> CyberColors.Present
                            "absent" -> CyberColors.Absent
                            "holiday" -> CyberColors.Holiday
                            "shifted" -> CyberColors.Shifted
                            else -> CyberColors.TextMuted
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 5.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(cls.optString("subject_name", "Subject"), color = CyberColors.TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                                Text("${cls.optString("start_time")} – ${cls.optString("end_time")}", color = CyberColors.TextSecondary, fontSize = 11.sp)
                            }
                            StatusPill(st, stColor)
                        }
                    }
                }
            }
        }

        // Achievement Badges
        item {
            Text("ACHIEVEMENT BADGES", color = CyberColors.TextSecondary, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.2.sp)
        }
        items(badges.length()) { i ->
            val b = badges.getJSONObject(i)
            val unlocked = b.optBoolean("unlocked", false)
            CyberBentoCard(borderColor = if (unlocked) CyberColors.Present.copy(alpha = 0.45f) else CyberColors.CyberBorder) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(b.optString("icon", "🏅"), fontSize = 26.sp)
                    Spacer(Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(b.optString("title"), color = if (unlocked) CyberColors.TextPrimary else CyberColors.TextMuted, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        Text(b.optString("description"), color = CyberColors.TextSecondary, fontSize = 12.sp)
                    }
                    StatusPill(if (unlocked) "UNLOCKED" else "LOCKED", if (unlocked) CyberColors.Present else CyberColors.TextMuted)
                }
            }
        }
    }
}
