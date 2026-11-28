package com.tracker75.ui.screens

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tracker75.ui.components.*
import com.tracker75.ui.theme.CyberColors
import com.tracker75.viewmodel.AttendoViewModel
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun TimetableScreen(
    vm: AttendoViewModel,
    onOpenProxyAI: () -> Unit,
    onOpenHeatmap: () -> Unit
) {
    val selectedDate by vm.selectedDate.collectAsState()
    val snapshot by vm.snapshot.collectAsState()
    val timetable by vm.timetable.collectAsState()
    val haptic = LocalHapticFeedback.current

    var isWeekGrid by remember { mutableStateOf(false) }
    var showBulkDialog by remember { mutableStateOf(false) }
    var shiftTargetClass by remember { mutableStateOf<JSONObject?>(null) }

    val report = snapshot.optJSONObject("report")
    val overall = report?.optJSONObject("overall")
    val theory = report?.optJSONObject("theory")
    val lab = report?.optJSONObject("lab")
    val dayClasses = snapshot.optJSONArray("dayClasses") ?: JSONArray()

    val dateList = remember {
        val cal = Calendar.getInstance()
        val fmt = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        val dayFmt = SimpleDateFormat("EEE", Locale.US)
        val numFmt = SimpleDateFormat("dd", Locale.US)
        (-3..7).map { offset ->
            val c = (cal.clone() as Calendar).apply { add(Calendar.DAY_OF_YEAR, offset) }
            Triple(fmt.format(c.time), dayFmt.format(c.time), numFmt.format(c.time))
        }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .cyberGridBackground(),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 108.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // 1. Cyber Header with Classic 7.0.0 Shield Logo
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.clickable { showBulkDialog = true }
                ) {
                    ClassicShieldLogo(size = 42.dp, cornerRadius = 13.dp, fontSize = 21)
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                "ATTENDO",
                                color = CyberColors.TextPrimary,
                                fontSize = 20.sp,
                                fontWeight = FontWeight.Black,
                                letterSpacing = 1.5.sp
                            )
                            Spacer(Modifier.width(8.dp))
                            StatusPill("v9.1.0", CyberColors.NeonCyan)
                        }
                        Text(
                            "Tap shield for Bulk Mark • $selectedDate",
                            color = CyberColors.TextSecondary,
                            fontSize = 11.sp
                        )
                    }
                }

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    IconButton(
                        onClick = onOpenHeatmap,
                        modifier = Modifier
                            .size(40.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(CyberColors.GlassSurface)
                            .border(1.dp, CyberColors.CyberBorder, RoundedCornerShape(12.dp))
                    ) {
                        Icon(Icons.Rounded.LocalFireDepartment, "Streak", tint = CyberColors.Cancelled, modifier = Modifier.size(20.dp))
                    }
                    Button(
                        onClick = onOpenProxyAI,
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 0.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = CyberColors.ElectricViolet),
                        modifier = Modifier.height(40.dp)
                    ) {
                        Text("✨ Proxy", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        // 2. Bento Overview Card (Gauge + Theory/Lab Split)
        item {
            val pct = overall?.optInt("percent", 0) ?: 0
            val statusMsg = overall?.optString("statusMessage", "Add subjects to start tracking") ?: ""
            val tPct = theory?.optInt("percent", 0) ?: 0
            val lPct = lab?.optInt("percent", 0) ?: 0

            CyberBentoCard(
                borderColor = CyberColors.NeonCyan.copy(alpha = 0.4f),
                glowColor = CyberColors.ElectricViolet
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    CyberAttendanceGauge(percent = pct, targetPercent = 75, size = 104.dp, strokeWidth = 10.dp)
                    Spacer(Modifier.width(16.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text("75% SHIELD STATUS", color = CyberColors.NeonCyan, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.2.sp)
                        Spacer(Modifier.height(4.dp))
                        Text(statusMsg, color = CyberColors.TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(10.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            StatusPill("Theory $tPct%", CyberColors.ElectricViolet)
                            StatusPill("Lab $lPct%", CyberColors.NeonCyan)
                        }
                    }
                }
            }
        }

        // 3. Date Strip + Day/Week Toggle
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    if (isWeekGrid) "WEEKLY MATRIX" else "DAILY TIMELINE",
                    color = CyberColors.TextSecondary,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 1.2.sp
                )
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(10.dp))
                        .background(CyberColors.GlassSurface)
                        .border(1.dp, CyberColors.CyberBorder, RoundedCornerShape(10.dp))
                        .padding(3.dp)
                ) {
                    listOf(false to "Day", true to "Week").forEach { (grid, label) ->
                        val active = isWeekGrid == grid
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (active) CyberColors.ElectricViolet else Color.Transparent)
                                .clickable { isWeekGrid = grid }
                                .padding(horizontal = 12.dp, vertical = 5.dp)
                        ) {
                            Text(label, color = if (active) Color.White else CyberColors.TextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            if (!isWeekGrid) {
                Spacer(Modifier.height(10.dp))
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(dateList) { (iso, dayName, dayNum) ->
                        val selected = iso == selectedDate
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier
                                .width(54.dp)
                                .clip(RoundedCornerShape(14.dp))
                                .background(if (selected) CyberColors.ElectricViolet else CyberColors.GlassCard)
                                .border(
                                    1.dp,
                                    if (selected) CyberColors.NeonCyan else CyberColors.CyberBorder,
                                    RoundedCornerShape(14.dp)
                                )
                                .clickable {
                                    haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                    vm.selectDate(iso)
                                }
                                .padding(vertical = 10.dp)
                        ) {
                            Text(dayName.uppercase(), color = if (selected) Color.White else CyberColors.TextMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                            Spacer(Modifier.height(4.dp))
                            Text(dayNum, color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Black)
                        }
                    }
                }
            }
        }

        // 4. Classes List OR Week Grid
        if (isWeekGrid) {
            val days = listOf("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday")
            items(days) { day ->
                val daySlots = (0 until timetable.length()).mapNotNull { i ->
                    val obj = timetable.optJSONObject(i)
                    if (obj?.optString("day_of_week")?.equals(day, ignoreCase = true) == true) obj else null
                }
                CyberBentoCard {
                    Text(day.uppercase(), color = CyberColors.NeonCyan, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.sp)
                    Spacer(Modifier.height(8.dp))
                    if (daySlots.isEmpty()) {
                        Text("No classes scheduled", color = CyberColors.TextMuted, fontSize = 12.sp)
                    } else {
                        daySlots.forEach { slot ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    slot.optString("subject_name", "Subject"),
                                    color = CyberColors.TextPrimary,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    modifier = Modifier.weight(1f)
                                )
                                Text(
                                    "${slot.optString("start_time")} - ${slot.optString("end_time")}",
                                    color = CyberColors.TextSecondary,
                                    fontSize = 12.sp
                                )
                            }
                        }
                    }
                }
            }
        } else if (dayClasses.length() == 0) {
            item {
                CyberBentoCard {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("🌴", fontSize = 34.sp)
                        Spacer(Modifier.height(8.dp))
                        Text("No Classes Scheduled", color = CyberColors.TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(4.dp))
                        Text("Add subjects & timetable slots in the Subjects tab.", color = CyberColors.TextSecondary, fontSize = 12.sp)
                    }
                }
            }
        } else {
            items(dayClasses.length()) { idx ->
                val inst = dayClasses.getJSONObject(idx)
                LectureInstanceCard(
                    inst = inst,
                    onMark = { status ->
                        haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                        vm.markInstance(inst.getLong("id"), status)
                    },
                    onShift = { shiftTargetClass = inst },
                    onUnshift = {
                        haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                        vm.unshiftInstance(inst.getLong("id"))
                    }
                )
            }
        }
    }

    if (showBulkDialog) {
        AlertDialog(
            onDismissRequest = { showBulkDialog = false },
            containerColor = CyberColors.GlassSurface,
            title = { Text("Bulk Mark $selectedDate", color = CyberColors.TextPrimary, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(
                        "present" to "Mark All Present",
                        "absent" to "Mark All Absent",
                        "holiday" to "Mark Day as Holiday",
                        "cancelled" to "Mark All Cancelled"
                    ).forEach { (status, label) ->
                        Button(
                            onClick = {
                                vm.markEntireDay(selectedDate, status)
                                showBulkDialog = false
                            },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = CyberColors.GlassElevated)
                        ) {
                            Text(label, color = CyberColors.TextPrimary)
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showBulkDialog = false }) {
                    Text("Close", color = CyberColors.NeonCyan)
                }
            }
        )
    }

    shiftTargetClass?.let { inst ->
        ShiftClassDialog(
            inst = inst,
            defaultDate = selectedDate,
            onDismiss = { shiftTargetClass = null },
            onConfirm = { targetDate, start, end, reason, perm ->
                vm.shiftInstance(inst.getLong("id"), targetDate, start, end, reason, perm)
                shiftTargetClass = null
            }
        )
    }
}

@Composable
private fun LectureInstanceCard(
    inst: JSONObject,
    onMark: (String?) -> Unit,
    onShift: () -> Unit,
    onUnshift: () -> Unit
) {
    val name = inst.optString("subject_name", "Unknown Subject")
    val start = inst.optString("start_time", "")
    val end = inst.optString("end_time", "")
    val room = inst.optString("room", "")
    val status = if (inst.isNull("status")) null else inst.optString("status")
    val isOverride = inst.optInt("is_override", 0) == 1
    val notes = inst.optString("notes", "")

    val statusColor = when (status) {
        "present" -> CyberColors.Present
        "absent" -> CyberColors.Absent
        "holiday" -> CyberColors.Holiday
        "cancelled" -> CyberColors.Cancelled
        "shifted" -> CyberColors.Shifted
        else -> CyberColors.CyberBorder
    }

    CyberBentoCard(borderColor = statusColor.copy(alpha = 0.65f)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(name, color = CyberColors.TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    if (isOverride) {
                        Spacer(Modifier.width(6.dp))
                        StatusPill("SHIFTED IN", CyberColors.Shifted)
                    }
                }
                Spacer(Modifier.height(3.dp))
                Text(
                    buildString {
                        append("$start – $end")
                        if (room.isNotBlank()) append(" • Room $room")
                        if (notes.isNotBlank()) append(" • $notes")
                    },
                    color = CyberColors.TextSecondary,
                    fontSize = 12.sp
                )
            }
            if (status != null) {
                StatusPill(status, statusColor)
            }
        }

        Spacer(Modifier.height(12.dp))

        if (status == "shifted" || isOverride) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (status != "shifted") {
                    QuickMarkChip("Present", CyberColors.Present, status == "present") { onMark("present") }
                    QuickMarkChip("Absent", CyberColors.Absent, status == "absent") { onMark("absent") }
                }
                QuickMarkChip("Unshift ↩", CyberColors.Shifted, false) { onUnshift() }
            }
        } else {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                QuickMarkChip("✓ Present", CyberColors.Present, status == "present") {
                    onMark(if (status == "present") null else "present")
                }
                QuickMarkChip("✕ Absent", CyberColors.Absent, status == "absent") {
                    onMark(if (status == "absent") null else "absent")
                }
                QuickMarkChip("Holiday", CyberColors.Holiday, status == "holiday") {
                    onMark(if (status == "holiday") null else "holiday")
                }
                QuickMarkChip("Shift ⇄", CyberColors.NeonCyan, false) { onShift() }
            }
        }
    }
}

@Composable
private fun RowScope.QuickMarkChip(
    label: String,
    color: Color,
    selected: Boolean,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .weight(1f)
            .clip(RoundedCornerShape(10.dp))
            .background(if (selected) color.copy(alpha = 0.28f) else CyberColors.GlassSurface)
            .border(1.dp, if (selected) color else CyberColors.CyberBorder, RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(vertical = 8.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            label,
            color = if (selected) Color.White else color,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            maxLines = 1
        )
    }
}

@Composable
private fun ShiftClassDialog(
    inst: JSONObject,
    defaultDate: String,
    onDismiss: () -> Unit,
    onConfirm: (String, String, String, String, Boolean) -> Unit
) {
    var targetDate by remember { mutableStateOf(defaultDate) }
    var startTime by remember { mutableStateOf("14:00") }
    var endTime by remember { mutableStateOf("15:00") }
    var reason by remember { mutableStateOf("") }
    var isPermanent by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CyberColors.GlassSurface,
        title = { Text("Shift ${inst.optString("subject_name")}", color = CyberColors.TextPrimary, fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(value = targetDate, onValueChange = { targetDate = it }, label = { Text("Target Date (YYYY-MM-DD)") }, singleLine = true)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = startTime, onValueChange = { startTime = it }, label = { Text("Start") }, modifier = Modifier.weight(1f), singleLine = true)
                    OutlinedTextField(value = endTime, onValueChange = { endTime = it }, label = { Text("End") }, modifier = Modifier.weight(1f), singleLine = true)
                }
                OutlinedTextField(value = reason, onValueChange = { reason = it }, label = { Text("Reason (optional)") }, singleLine = true)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = isPermanent, onCheckedChange = { isPermanent = it })
                    Text("Update weekly timetable permanently", color = CyberColors.TextSecondary, fontSize = 12.sp)
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { onConfirm(targetDate, startTime, endTime, reason, isPermanent) },
                colors = ButtonDefaults.buttonColors(containerColor = CyberColors.ElectricViolet)
            ) {
                Text("Shift Class")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel", color = CyberColors.TextSecondary) }
        }
    )
}
