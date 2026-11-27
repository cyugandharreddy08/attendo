package com.tracker75.ui.screens

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tracker75.ui.components.CyberBentoCard
import com.tracker75.ui.components.StatusPill
import com.tracker75.ui.components.cyberGridBackground
import com.tracker75.ui.theme.CyberColors
import com.tracker75.viewmodel.AttendoViewModel
import org.json.JSONArray

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

    val days = heatmap?.optJSONArray("days") ?: JSONArray()
    val badges = heatmap?.optJSONArray("badges") ?: JSONArray()
    val currentStreak = heatmap?.optInt("currentStreak", 0) ?: 0
    val longestStreak = heatmap?.optInt("longestStreak", 0) ?: 0
    val activeDays = heatmap?.optInt("activeDaysCount", 0) ?: 0
    val totalAttHours = heatmap?.optDouble("totalAttendedHours", 0.0) ?: 0.0

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
                        Icon(Icons.Rounded.ArrowBack, "Back", tint = CyberColors.TextPrimary)
                    }
                    Column {
                        Text("ANALYTICS & REPORTS", color = CyberColors.NeonCyan, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.4.sp)
                        Text("Streak & Heatmap", color = CyberColors.TextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Black)
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

        // Streak Bento Grid
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                CyberBentoCard(modifier = Modifier.weight(1f), borderColor = CyberColors.Cancelled.copy(alpha = 0.5f)) {
                    Text("🔥 STREAK", color = CyberColors.TextMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    Text("${currentStreak}d", color = CyberColors.Cancelled, fontSize = 24.sp, fontWeight = FontWeight.Black)
                    Text("Best: ${longestStreak}d", color = CyberColors.TextSecondary, fontSize = 11.sp)
                }
                CyberBentoCard(modifier = Modifier.weight(1f), borderColor = CyberColors.NeonCyan.copy(alpha = 0.5f)) {
                    Text("⚡ HOURS", color = CyberColors.TextMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    Text("${totalAttHours}h", color = CyberColors.NeonCyan, fontSize = 24.sp, fontWeight = FontWeight.Black)
                    Text("$activeDays active days", color = CyberColors.TextSecondary, fontSize = 11.sp)
                }
            }
        }

        // LeetCode-Style Cyber Heatmap Matrix
        item {
            CyberBentoCard {
                Text("ACTIVITY HEATMAP", color = CyberColors.NeonCyan, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.sp)
                Spacer(Modifier.height(10.dp))
                if (days.length() == 0) {
                    Text("Mark classes to light up your Cyber Activity Matrix!", color = CyberColors.TextMuted, fontSize = 12.sp)
                } else {
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        val cols = (days.length() + 6) / 7
                        items(cols) { col ->
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                for (row in 0 until 7) {
                                    val idx = col * 7 + row
                                    if (idx < days.length()) {
                                        val d = days.getJSONObject(idx)
                                        val lvl = d.optInt("level", 0)
                                        val cellColor = when (lvl) {
                                            4 -> CyberColors.NeonCyan
                                            3 -> CyberColors.Present
                                            2 -> CyberColors.ElectricViolet
                                            1 -> CyberColors.VioletDeep.copy(alpha = 0.6f)
                                            else -> CyberColors.GlassSurface
                                        }
                                        Box(
                                            modifier = Modifier
                                                .size(16.dp)
                                                .clip(RoundedCornerShape(4.dp))
                                                .background(cellColor)
                                        )
                                    }
                                }
                            }
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
            CyberBentoCard(borderColor = if (unlocked) CyberColors.NeonCyan.copy(alpha = 0.55f) else CyberColors.CyberBorder) {
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
