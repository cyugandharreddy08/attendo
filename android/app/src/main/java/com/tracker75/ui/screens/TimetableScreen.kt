package com.tracker75.ui.screens

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tracker75.ui.components.*
import com.tracker75.ui.theme.AttendoColors
import com.tracker75.viewmodel.AttendoViewModel
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun TimetableScreen(
    vm: AttendoViewModel,
    onOpenCalendar: () -> Unit
) {
    val snapshot by vm.snapshot.collectAsState()
    val selectedDate by vm.selectedDate.collectAsState()

    val report = snapshot.optJSONObject("report")
    val overall = report?.optJSONObject("overall")
    val theory = report?.optJSONObject("theory")
    val lab = report?.optJSONObject("lab")
    val dayClasses = snapshot.optJSONArray("dayClasses") ?: JSONArray()
    val subjects = snapshot.optJSONArray("subjects") ?: JSONArray()

    var showAddSlotDialog by remember { mutableStateOf(false) }
    var shiftTarget by remember { mutableStateOf<JSONObject?>(null) }

    val weekDays = remember {
        val cal = Calendar.getInstance()
        cal.add(Calendar.DAY_OF_YEAR, -2)
        val fmt = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        val dayFmt = SimpleDateFormat("EEE", Locale.US)
        val numFmt = SimpleDateFormat("dd", Locale.US)
        (0..6).map {
            val d = cal.time
            val triple = Triple(fmt.format(d), dayFmt.format(d), numFmt.format(d))
            cal.add(Calendar.DAY_OF_YEAR, 1)
            triple
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 104.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Header Bar
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Schedule",
                        color = AttendoColors.TextPrimary,
                        fontSize = 26.sp,
                        fontWeight = FontWeight.ExtraBold
                    )
                    Text(
                        text = selectedDate,
                        color = AttendoColors.TextSecondary,
                        fontSize = 12.sp
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    GlassActionPill(
                        text = "Undo",
                        selected = false,
                        activeColor = AttendoColors.Amber,
                        icon = Icons.Rounded.Undo,
                        onClick = { vm.undoLastEdit() }
                    )
                    GlassActionPill(
                        text = "Calendar",
                        selected = true,
                        activeColor = AttendoColors.Indigo,
                        icon = Icons.Rounded.CalendarMonth,
                        onClick = onOpenCalendar
                    )
                    GlassActionPill(
                        text = "Slot",
                        selected = true,
                        activeColor = AttendoColors.Cyan,
                        icon = Icons.Rounded.Add,
                        onClick = { showAddSlotDialog = true }
                    )
                }
            }
        }

        // Hero Attendance Glass Card
        item {
            val pct = overall?.optInt("percent", 0) ?: 0
            val tgt = overall?.optInt("targetPercent", 75) ?: 75
            val bunks = overall?.optInt("maxBunkableHours", 0) ?: 0
            val needed = overall?.optInt("neededConsecutiveHours", 0) ?: 0
            val eligible = overall?.optBoolean("isEligible", true) ?: true

            StaggeredEntrance(index = 0) {
                GlassCard(accentColor = if (eligible) AttendoColors.Indigo else AttendoColors.Rose) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        AnimatedLiquidRing(
                            percent = pct,
                            targetPercent = tgt,
                            size = 92.dp,
                            strokeWidth = 8.dp,
                            label = "OVERALL"
                        )
                        Spacer(modifier = Modifier.width(16.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = if (eligible) "Safe Zone • Target $tgt%" else "Danger Zone • Target $tgt%",
                                color = if (eligible) AttendoColors.Emerald else AttendoColors.Rose,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = if (eligible) {
                                    "You can safely bunk $bunks lecture(s)"
                                } else {
                                    "Attend $needed consecutive lecture(s)"
                                },
                                color = AttendoColors.TextPrimary,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                            Spacer(modifier = Modifier.height(10.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                SplitChip("Theory", theory?.optInt("percent", 0) ?: 0, AttendoColors.IndigoLight)
                                SplitChip("Lab", lab?.optInt("percent", 0) ?: 0, AttendoColors.Cyan)
                            }
                        }
                    }
                }
            }
        }

        // Week Day Selector Strip
        item {
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                itemsIndexed(weekDays) { _, (iso, dayLabel, dayNum) ->
                    val isSelected = iso == selectedDate
                    val bg by animateColorAsState(
                        if (isSelected) AttendoColors.Indigo.copy(alpha = 0.32f) else Color(0x10FFFFFF),
                        label = "dayBg"
                    )
                    val border by animateColorAsState(
                        if (isSelected) AttendoColors.IndigoLight else Color(0x1FFFFFFF),
                        label = "dayBorder"
                    )
                    Column(
                        modifier = Modifier
                            .width(56.dp)
                            .physicsPressable(scaleDown = 0.92f) { vm.selectDate(iso) }
                            .clip(RoundedCornerShape(18.dp))
                            .background(bg)
                            .border(0.9.dp, border, RoundedCornerShape(18.dp))
                            .padding(vertical = 10.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = dayLabel,
                            color = if (isSelected) AttendoColors.Cyan else AttendoColors.TextSecondary,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = dayNum,
                            color = AttendoColors.TextPrimary,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                    }
                }
            }
        }

        // Bulk Mark Entire Day Bar
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                GlassActionPill(
                    text = "All Present",
                    selected = false,
                    activeColor = AttendoColors.Emerald,
                    icon = Icons.Rounded.DoneAll,
                    onClick = { vm.markEntireDay(selectedDate, "present") },
                    modifier = Modifier.weight(1f)
                )
                GlassActionPill(
                    text = "All Absent",
                    selected = false,
                    activeColor = AttendoColors.Rose,
                    icon = Icons.Rounded.Close,
                    onClick = { vm.markEntireDay(selectedDate, "absent") },
                    modifier = Modifier.weight(1f)
                )
                GlassActionPill(
                    text = "Holiday",
                    selected = false,
                    activeColor = AttendoColors.Amber,
                    icon = Icons.Rounded.WbSunny,
                    onClick = { vm.markEntireDay(selectedDate, "holiday") },
                    modifier = Modifier.weight(1f)
                )
            }
        }

        if (dayClasses.length() == 0) {
            item {
                GlassCard(
                    modifier = Modifier.fillMaxWidth(),
                    accentColor = AttendoColors.Cyan
                ) {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 18.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            Icons.Rounded.Weekend,
                            contentDescription = null,
                            tint = AttendoColors.Cyan,
                            modifier = Modifier.size(36.dp)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            "No classes scheduled",
                            color = AttendoColors.TextPrimary,
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp
                        )
                        Text(
                            "Tap '+ Slot' above or ask Attendo AI to schedule classes.",
                            color = AttendoColors.TextSecondary,
                            fontSize = 12.sp
                        )
                    }
                }
            }
        } else {
            itemsIndexed((0 until dayClasses.length()).map { dayClasses.getJSONObject(it) }) { idx, cls ->
                StaggeredEntrance(index = idx + 1) {
                    LectureGlassCard(
                        cls = cls,
                        onMark = { st ->
                            val cur = cls.optString("status", "")
                            val next = if (cur == st) null else st
                            vm.markInstance(cls.optLong("id"), next)
                        },
                        onShift = { shiftTarget = cls },
                        onUnshift = { vm.unshiftInstance(cls.optLong("id")) }
                    )
                }
            }
        }
    }

    if (showAddSlotDialog) {
        AddTimetableSlotDialog(
            subjects = subjects,
            onDismiss = { showAddSlotDialog = false },
            onSave = { subjId, day, start, end, room ->
                vm.addTimetableEntry(subjId, day, start, end, room)
                showAddSlotDialog = false
            }
        )
    }

    shiftTarget?.let { target ->
        ShiftLectureDialog(
            cls = target,
            onDismiss = { shiftTarget = null },
            onShift = { tgtDate, start, end, reason, perm ->
                vm.shiftInstance(target.optLong("id"), tgtDate, start, end, reason, perm)
                shiftTarget = null
            }
        )
    }
}

@Composable
private fun SplitChip(label: String, pct: Int, color: Color) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(10.dp))
            .background(color.copy(alpha = 0.16f))
            .border(0.7.dp, color.copy(alpha = 0.4f), RoundedCornerShape(10.dp))
            .padding(horizontal = 10.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(color))
        Spacer(modifier = Modifier.width(6.dp))
        Text("$label $pct%", color = AttendoColors.TextPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun LectureGlassCard(
    cls: JSONObject,
    onMark: (String) -> Unit,
    onShift: () -> Unit,
    onUnshift: () -> Unit
) {
    val name = cls.optString("subject_name", "Subject")
    val start = cls.optString("start_time", "09:00")
    val end = cls.optString("end_time", "10:00")
    val room = cls.optString("room", "")
    val status = cls.optString("status", "")
    val isOverride = cls.optInt("is_override", 0) == 1
    val accent = when (status) {
        "present" -> AttendoColors.Emerald
        "absent" -> AttendoColors.Rose
        "holiday" -> AttendoColors.Amber
        "cancelled", "shifted" -> AttendoColors.TextMuted
        else -> AttendoColors.Indigo
    }

    GlassCard(accentColor = accent) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = name,
                    color = AttendoColors.TextPrimary,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = "$start – $end" + if (room.isNotBlank()) "  •  $room" else "",
                    color = AttendoColors.TextSecondary,
                    fontSize = 12.sp
                )
            }
            if (isOverride) {
                GlassActionPill(
                    text = "Unshift",
                    selected = true,
                    activeColor = AttendoColors.Amber,
                    onClick = onUnshift
                )
            } else {
                GlassActionPill(
                    text = "Shift",
                    selected = false,
                    activeColor = AttendoColors.Cyan,
                    icon = Icons.Rounded.SwapHoriz,
                    onClick = onShift
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            GlassActionPill(
                text = "Present",
                selected = status == "present",
                activeColor = AttendoColors.Emerald,
                onClick = { onMark("present") },
                modifier = Modifier.weight(1f)
            )
            GlassActionPill(
                text = "Absent",
                selected = status == "absent",
                activeColor = AttendoColors.Rose,
                onClick = { onMark("absent") },
                modifier = Modifier.weight(1f)
            )
            GlassActionPill(
                text = "Holiday",
                selected = status == "holiday",
                activeColor = AttendoColors.Amber,
                onClick = { onMark("holiday") },
                modifier = Modifier.weight(1f)
            )
            GlassActionPill(
                text = "Cancel",
                selected = status == "cancelled",
                activeColor = AttendoColors.TextMuted,
                onClick = { onMark("cancelled") },
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
private fun AddTimetableSlotDialog(
    subjects: JSONArray,
    onDismiss: () -> Unit,
    onSave: (Long, String, String, String, String) -> Unit
) {
    val subjectList = remember(subjects) {
        (0 until subjects.length()).map { subjects.getJSONObject(it).getJSONObject("subject") }
    }
    var selectedSubjId by remember { mutableStateOf(subjectList.firstOrNull()?.optLong("id") ?: 0L) }
    var day by remember { mutableStateOf("Monday") }
    var start by remember { mutableStateOf("09:00") }
    var end by remember { mutableStateOf("10:00") }
    var room by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = AttendoColors.ElevatedSurface,
        title = { Text("Add Timetable Slot", color = AttendoColors.TextPrimary, fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (subjectList.isEmpty()) {
                    Text("Add a subject first in Subjects tab.", color = AttendoColors.Amber)
                } else {
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        itemsIndexed(subjectList) { _, s ->
                            val sid = s.optLong("id")
                            GlassActionPill(
                                text = s.optString("name"),
                                selected = sid == selectedSubjId,
                                activeColor = AttendoColors.Indigo,
                                onClick = { selectedSubjId = sid }
                            )
                        }
                    }
                    OutlinedTextField(value = day, onValueChange = { day = it }, label = { Text("Day (e.g. Monday)") })
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(value = start, onValueChange = { start = it }, label = { Text("Start") }, modifier = Modifier.weight(1f))
                        OutlinedTextField(value = end, onValueChange = { end = it }, label = { Text("End") }, modifier = Modifier.weight(1f))
                    }
                    OutlinedTextField(value = room, onValueChange = { room = it }, label = { Text("Room (optional)") })
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { if (selectedSubjId > 0) onSave(selectedSubjId, day, start, end, room) },
                enabled = selectedSubjId > 0
            ) { Text("Save Slot") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}

@Composable
private fun ShiftLectureDialog(
    cls: JSONObject,
    onDismiss: () -> Unit,
    onShift: (String, String, String, String, Boolean) -> Unit
) {
    var tgtDate by remember { mutableStateOf(cls.optString("date", "")) }
    var start by remember { mutableStateOf("14:00") }
    var end by remember { mutableStateOf("15:00") }
    var reason by remember { mutableStateOf("Rescheduled") }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = AttendoColors.ElevatedSurface,
        title = { Text("Shift ${cls.optString("subject_name")}", color = AttendoColors.TextPrimary, fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = tgtDate, onValueChange = { tgtDate = it }, label = { Text("Target Date (YYYY-MM-DD)") })
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = start, onValueChange = { start = it }, label = { Text("Start") }, modifier = Modifier.weight(1f))
                    OutlinedTextField(value = end, onValueChange = { end = it }, label = { Text("End") }, modifier = Modifier.weight(1f))
                }
                OutlinedTextField(value = reason, onValueChange = { reason = it }, label = { Text("Reason") })
            }
        },
        confirmButton = {
            Button(onClick = { onShift(tgtDate, start, end, reason, false) }) { Text("Shift Class") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}
