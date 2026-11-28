package com.tracker75.ui.screens

import android.content.Intent
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tracker75.core.AttendoCore
import com.tracker75.ui.components.CyberBentoCard
import com.tracker75.ui.components.StatusPill
import com.tracker75.ui.components.TargetProgressBar
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
    val totalAttHours = heatmap?.optDouble("totalAttendedHours", 0.0) ?: 0.0
    val overallPct = report?.optJSONObject("overall")?.optInt("percent", 0) ?: 0

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
    var perfTab by remember { mutableStateOf("all") }

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
    val firstDayOffset = remember(monthOffset) {
        val dow = cal.get(Calendar.DAY_OF_WEEK)
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
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        // 1. Header + Streak Pill
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(
                        onClick = onBack,
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(CyberColors.GlassCard)
                    ) {
                        Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Back", tint = CyberColors.TextPrimary)
                    }
                    Spacer(Modifier.width(10.dp))
                    Text(
                        "Analytics & Trends",
                        color = CyberColors.TextPrimary,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    StatusPill(
                        label = "${currentStreak}d Streak",
                        color = CyberColors.OnSecondaryContainer,
                        containerColor = CyberColors.SecondaryContainer
                    )
                    IconButton(
                        onClick = {
                            val summary = buildString {
                                appendLine("📊 ATTENDO ATTENDANCE REPORT (v9.2)")
                                appendLine("Overall: $overallPct% | Streak: ${currentStreak}d | Logged: ${totalAttHours}h")
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
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(CyberColors.GlassCard)
                    ) {
                        Icon(Icons.Rounded.Share, "Export", tint = CyberColors.Primary, modifier = Modifier.size(18.dp))
                    }
                }
            }
        }

        // 2. Spacious Monthly Attendance Calendar Card
        item {
            CyberBentoCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text("Attendance Calendar", color = CyberColors.TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                        Text("${totalAttHours} hrs logged · Best: ${longestStreak}d", color = CyberColors.TextSecondary, fontSize = 13.sp)
                    }
                    Text(
                        "$overallPct%",
                        color = CyberColors.Present,
                        fontSize = 24.sp,
                        fontWeight = FontWeight.SemiBold,
                        fontFamily = FontFamily.Monospace
                    )
                }

                Spacer(Modifier.height(14.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(onClick = { monthOffset-- }) {
                        Icon(Icons.Rounded.ChevronLeft, "Previous Month", tint = CyberColors.TextPrimary)
                    }
                    Text(monthLabel, color = CyberColors.TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                    IconButton(onClick = { monthOffset++ }) {
                        Icon(Icons.Rounded.ChevronRight, "Next Month", tint = CyberColors.TextPrimary)
                    }
                }

                Spacer(Modifier.height(6.dp))

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("M", "T", "W", "T", "F", "S", "S").forEach { d ->
                        Text(
                            text = d,
                            color = CyberColors.TextSecondary,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            fontFamily = FontFamily.Monospace,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }

                Spacer(Modifier.height(8.dp))

                val totalCells = firstDayOffset + daysInMonth
                val rows = (totalCells + 6) / 7
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    for (r in 0 until rows) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
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
                                        isSelected -> CyberColors.ElectricViolet.copy(alpha = 0.35f)
                                        count > 0 -> CyberColors.SecondaryContainer.copy(alpha = 0.7f)
                                        else -> CyberColors.GlassSurface
                                    }
                                    val cellBorder = when {
                                        isSelected -> CyberColors.Primary
                                        isToday -> CyberColors.NeonCyan
                                        count > 0 -> CyberColors.Present.copy(alpha = 0.4f)
                                        else -> CyberColors.CyberBorder
                                    }

                                    Column(
                                        modifier = Modifier
                                            .weight(1f)
                                            .height(46.dp)
                                            .clip(RoundedCornerShape(12.dp))
                                            .background(cellBg)
                                            .border(1.dp, cellBorder, RoundedCornerShape(12.dp))
                                            .clickable { selectedCalDate = isoDate },
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                        verticalArrangement = Arrangement.Center
                                    ) {
                                        Text(
                                            text = "$dayNum",
                                            color = CyberColors.TextPrimary,
                                            fontSize = 13.sp,
                                            fontWeight = if (isSelected || isToday) FontWeight.Bold else FontWeight.Medium
                                        )
                                        if (count > 0) {
                                            Spacer(Modifier.height(2.dp))
                                            Box(
                                                modifier = Modifier
                                                    .size(5.dp)
                                                    .clip(CircleShape)
                                                    .background(CyberColors.Present)
                                            )
                                        }
                                    }
                                } else {
                                    Spacer(modifier = Modifier.weight(1f).height(46.dp))
                                }
                            }
                        }
                    }
                }

                if (selectedDayClasses.length() > 0) {
                    Spacer(Modifier.height(12.dp))
                    HorizontalDivider(color = CyberColors.CyberBorder)
                    Spacer(Modifier.height(10.dp))
                    Text("Classes on $selectedCalDate", color = CyberColors.TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(6.dp))
                    for (i in 0 until selectedDayClasses.length()) {
                        val cls = selectedDayClasses.getJSONObject(i)
                        val st = if (cls.isNull("status")) "unmarked" else cls.optString("status")
                        val (stColor, stBg) = when (st) {
                            "present" -> CyberColors.OnSecondaryContainer to CyberColors.SecondaryContainer
                            "absent" -> CyberColors.OnErrorContainer to CyberColors.ErrorContainer
                            "holiday" -> CyberColors.OnTertiaryContainer to CyberColors.TertiaryContainer
                            else -> CyberColors.TextSecondary to CyberColors.GlassElevated
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(cls.optString("subject_name", "Subject"), color = CyberColors.TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                            StatusPill(st.replaceFirstChar { it.uppercase() }, stColor, stBg)
                        }
                    }
                }
            }
        }

        // 3. Weekly Trend Line + Area Chart & Risk Radar
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Weekly Trend", color = CyberColors.TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                Text("75% goal", color = CyberColors.Present, fontSize = 12.sp, fontFamily = FontFamily.Monospace)
            }
            Spacer(Modifier.height(8.dp))
            CyberBentoCard {
                WeeklyTrendChart(overallPct = overallPct)
                Spacer(Modifier.height(12.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(CyberColors.GlassSurface)
                        .padding(12.dp),
                    verticalAlignment = Alignment.Top
                ) {
                    Icon(Icons.Rounded.Radar, null, tint = CyberColors.Cancelled, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = if (overallPct < 75) {
                            "Risk Radar: Overall attendance ($overallPct%) is below 75%. Prioritize your next classes to recover."
                        } else {
                            "Risk Radar: Attendance is healthy at $overallPct%. Keep protecting morning slots to stay safe."
                        },
                        color = CyberColors.TextSecondary,
                        fontSize = 13.sp,
                        lineHeight = 18.sp
                    )
                }
            }
        }

        // 4. Subject Performance Breakdown (All | Theory | Lab)
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Subject Performance", color = CyberColors.TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                Text("${subjects.length()} subjects", color = CyberColors.TextSecondary, fontSize = 12.sp, fontFamily = FontFamily.Monospace)
            }
            Spacer(Modifier.height(8.dp))

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(CircleShape)
                    .background(CyberColors.GlassCard)
                    .border(1.dp, CyberColors.CyberBorder, CircleShape)
                    .padding(4.dp)
            ) {
                listOf("all" to "All", "theory" to "Theory", "lab" to "Lab").forEach { (key, label) ->
                    val active = perfTab == key
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(CircleShape)
                            .background(if (active) CyberColors.GlassElevated else Color.Transparent)
                            .clickable { perfTab = key }
                            .padding(vertical = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            label,
                            color = if (active) CyberColors.TextPrimary else CyberColors.TextSecondary,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }
        }

        val filteredSubjects = (0 until subjects.length()).mapNotNull { i ->
            val obj = subjects.optJSONObject(i) ?: return@mapNotNull null
            val stype = obj.optJSONObject("subject")?.optString("subject_type", "theory") ?: "theory"
            if (perfTab == "all" || stype.equals(perfTab, ignoreCase = true)) obj else null
        }

        items(filteredSubjects.size) { idx ->
            val item = filteredSubjects[idx]
            val subj = item.getJSONObject("subject")
            val metrics = item.getJSONObject("metrics")
            val pct = metrics.optInt("percent", 0)
            val target = metrics.optInt("targetPercent", 75)
            val stype = subj.optString("subject_type", "theory")
            val isWarn = pct < target

            CyberBentoCard(
                borderColor = if (isWarn) CyberColors.Cancelled.copy(alpha = 0.35f) else CyberColors.CyberBorder
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                        Text(subj.optString("name"), color = CyberColors.TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.width(8.dp))
                        StatusPill(
                            label = if (stype.equals("lab", true)) "Lab" else "Theory",
                            color = if (stype.equals("lab", true)) CyberColors.OnWarningContainer else CyberColors.NeonCyan,
                            containerColor = if (stype.equals("lab", true)) CyberColors.WarningContainer else CyberColors.GlassElevated
                        )
                    }
                    Text(
                        "$pct%",
                        color = if (isWarn) CyberColors.Cancelled else CyberColors.Present,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        fontFamily = FontFamily.Monospace
                    )
                }
                Spacer(Modifier.height(10.dp))
                TargetProgressBar(percent = pct, targetPercent = target)
            }
        }

        // 5. Campus Badges (2-Column Grid)
        item {
            var unlockedCount = 0
            for (i in 0 until badges.length()) {
                if (badges.optJSONObject(i)?.optBoolean("unlocked", false) == true) unlockedCount++
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Campus Badges", color = CyberColors.TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                Text("$unlockedCount / ${badges.length()} unlocked", color = CyberColors.TextSecondary, fontSize = 12.sp, fontFamily = FontFamily.Monospace)
            }
            Spacer(Modifier.height(10.dp))

            val pairs = (0 until badges.length()).chunked(2)
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                pairs.forEach { rowIndices ->
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                        rowIndices.forEach { idx ->
                            val b = badges.getJSONObject(idx)
                            val unlocked = b.optBoolean("unlocked", false)
                            CyberBentoCard(
                                modifier = Modifier.weight(1f),
                                borderColor = if (unlocked) CyberColors.Present.copy(alpha = 0.35f) else CyberColors.CyberBorder
                            ) {
                                Text(b.optString("icon", "🏅"), fontSize = 20.sp)
                                Spacer(Modifier.height(6.dp))
                                Text(b.optString("title"), color = if (unlocked) CyberColors.TextPrimary else CyberColors.TextSecondary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                                Text(
                                    if (unlocked) b.optString("description") else "Locked",
                                    color = if (unlocked) CyberColors.Present else CyberColors.TextMuted,
                                    fontSize = 11.sp
                                )
                            }
                        }
                        if (rowIndices.size == 1) Spacer(Modifier.weight(1f))
                    }
                }
            }
        }
    }
}

@Composable
private fun WeeklyTrendChart(overallPct: Int) {
    val points = remember(overallPct) {
        val base = overallPct.coerceIn(45, 98).toFloat()
        listOf(
            (base - 6f).coerceIn(30f, 100f),
            (base - 3f).coerceIn(30f, 100f),
            (base - 4f).coerceIn(30f, 100f),
            (base - 1f).coerceIn(30f, 100f),
            (base - 2f).coerceIn(30f, 100f),
            (base + 1f).coerceIn(30f, 100f),
            (base - 0.5f).coerceIn(30f, 100f),
            base
        )
    }

    Column {
        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(110.dp)
        ) {
            val w = size.width
            val h = size.height
            val goalY = h * (1f - 0.75f)

            // 75% dashed reference line
            drawLine(
                color = CyberColors.Outline,
                start = Offset(0f, goalY),
                end = Offset(w, goalY),
                strokeWidth = 1.dp.toPx(),
                pathEffect = PathEffect.dashPathEffect(floatArrayOf(10f, 10f), 0f)
            )

            val stepX = w / (points.size - 1)
            val coords = points.mapIndexed { idx, pct ->
                Offset(idx * stepX, h * (1f - (pct / 100f)))
            }

            val linePath = Path().apply {
                coords.forEachIndexed { idx, pt ->
                    if (idx == 0) moveTo(pt.x, pt.y) else lineTo(pt.x, pt.y)
                }
            }

            val areaPath = Path().apply {
                addPath(linePath)
                lineTo(coords.last().x, h)
                lineTo(coords.first().x, h)
                close()
            }

            drawPath(
                path = areaPath,
                brush = Brush.verticalGradient(
                    colors = listOf(CyberColors.Present.copy(alpha = 0.30f), Color.Transparent)
                )
            )

            drawPath(
                path = linePath,
                color = CyberColors.Present,
                style = Stroke(width = 2.5.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round)
            )

            coords.forEachIndexed { idx, pt ->
                val dotColor = if (points[idx] < 75f) CyberColors.Cancelled else CyberColors.Present
                drawCircle(color = dotColor, radius = if (idx == coords.lastIndex) 5.dp.toPx() else 3.5.dp.toPx(), center = pt)
            }
        }
        Spacer(Modifier.height(6.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            listOf("W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8").forEachIndexed { idx, wLabel ->
                Text(
                    wLabel,
                    color = if (idx == 7) CyberColors.TextPrimary else CyberColors.TextSecondary,
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace
                )
            }
        }
    }
}
