package com.tracker75.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tracker75.core.AttendoCore
import com.tracker75.ui.components.*
import com.tracker75.ui.theme.CyberColors
import com.tracker75.viewmodel.AttendoViewModel
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

@Composable
fun SubjectsScreen(vm: AttendoViewModel) {
    val snapshot by vm.snapshot.collectAsState()
    val timetable by vm.timetable.collectAsState()
    val subjects = snapshot.optJSONArray("subjects") ?: JSONArray()
    val report = snapshot.optJSONObject("report")

    var perfTab by remember { mutableStateOf("all") }
    var showAddSubject by remember { mutableStateOf(false) }
    var showAiPasteTimetable by remember { mutableStateOf(false) }
    var selectedSubject by remember { mutableStateOf<JSONObject?>(null) }
    var showSlotDialogFor by remember { mutableStateOf<JSONObject?>(null) }

    // If user tapped a subject, render full Material 3 Expressive Subject Detail view (matching HTML #2)
    selectedSubject?.let { item ->
        SubjectDetailScreen(
            item = item,
            timetable = timetable,
            allInstances = snapshot.optJSONArray("dayClasses") ?: JSONArray(),
            onDeleteSlot = { vm.deleteTimetableEntry(it) },
            onBack = { selectedSubject = null }
        )
        return
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .cyberGridBackground(),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 108.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("SUBJECT PERFORMANCE", color = CyberColors.TextSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 1.sp)
                    Text("Your Courses", color = CyberColors.TextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = { showAiPasteTimetable = true },
                        shape = RoundedCornerShape(999.dp)
                    ) {
                        Text("✨ AI Paste", color = CyberColors.Primary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    }
                    Button(
                        onClick = { showAddSubject = true },
                        shape = RoundedCornerShape(999.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = CyberColors.ElectricViolet)
                    ) {
                        Icon(Icons.Rounded.Add, null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Add", fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }

        // Split Theory vs Lab Overview
        item {
            val overallPct = report?.optJSONObject("overall")?.optInt("percent", 0) ?: 0
            val theoryPct = report?.optJSONObject("theory")?.optInt("percent", 0) ?: 0
            val labPct = report?.optJSONObject("lab")?.optInt("percent", 0) ?: 0
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                SplitStatPill("OVERALL", "$overallPct%", CyberColors.Present, Modifier.weight(1f))
                SplitStatPill("THEORY", "$theoryPct%", CyberColors.Primary, Modifier.weight(1f))
                SplitStatPill("LAB", "$labPct%", CyberColors.NeonCyan, Modifier.weight(1f))
            }
        }

        // All | Theory | Lab Segmented Pill Tabs
        item {
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
                        Text(label, color = if (active) CyberColors.TextPrimary else CyberColors.TextSecondary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }

        val filtered = (0 until subjects.length()).mapNotNull { i ->
            val obj = subjects.optJSONObject(i) ?: return@mapNotNull null
            val stype = obj.optJSONObject("subject")?.optString("subject_type", "theory") ?: "theory"
            if (perfTab == "all" || stype.equals(perfTab, ignoreCase = true)) obj else null
        }

        if (filtered.isEmpty()) {
            item {
                CyberBentoCard {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("📚", fontSize = 36.sp)
                        Spacer(Modifier.height(8.dp))
                        Text("No Subjects Yet", color = CyberColors.TextPrimary, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        Text("Tap + Add or ✨ AI Paste to build your timetable.", color = CyberColors.TextSecondary, fontSize = 12.sp)
                    }
                }
            }
        } else {
            items(filtered.size) { idx ->
                val item = filtered[idx]
                val subj = item.getJSONObject("subject")
                val metrics = item.getJSONObject("metrics")
                val pct = metrics.optInt("percent", 0)
                val target = metrics.optInt("targetPercent", 75)
                val isEligible = metrics.optBoolean("isEligible", true)
                val stype = subj.optString("subject_type", "theory")

                CyberBentoCard(
                    borderColor = if (isEligible) CyberColors.CyberBorder else CyberColors.Cancelled.copy(alpha = 0.4f),
                    onClick = { selectedSubject = item }
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(subj.optString("name"), color = CyberColors.TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                                Spacer(Modifier.width(8.dp))
                                StatusPill(
                                    label = if (stype.equals("lab", true)) "Lab" else "Theory",
                                    color = if (stype.equals("lab", true)) CyberColors.OnWarningContainer else CyberColors.NeonCyan,
                                    containerColor = if (stype.equals("lab", true)) CyberColors.WarningContainer else CyberColors.GlassElevated
                                )
                            }
                            Spacer(Modifier.height(4.dp))
                            Text(
                                "${metrics.optDouble("attendedHours", 0.0)} / ${metrics.optDouble("conductedHours", 0.0)} hrs · ${metrics.optString("statusMessage")}",
                                color = CyberColors.TextSecondary,
                                fontSize = 12.sp
                            )
                        }
                        Text(
                            "$pct%",
                            color = if (isEligible) CyberColors.Present else CyberColors.Cancelled,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                    Spacer(Modifier.height(10.dp))
                    TargetProgressBar(percent = pct, targetPercent = target)
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                        TextButton(onClick = { showSlotDialogFor = subj }, contentPadding = PaddingValues(horizontal = 4.dp)) {
                            Icon(Icons.Rounded.Schedule, null, tint = CyberColors.Primary, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Add Class Slot", color = CyberColors.Primary, fontSize = 12.sp)
                        }
                        IconButton(onClick = { vm.deleteSubject(subj.getLong("id")) }, modifier = Modifier.size(32.dp)) {
                            Icon(Icons.Rounded.Delete, "Delete", tint = CyberColors.TextMuted, modifier = Modifier.size(18.dp))
                        }
                    }
                }
            }
        }
    }

    if (showAddSubject) {
        AddSubjectDialog(
            onDismiss = { showAddSubject = false },
            onSave = { name, target, type, frozen, pastAtt, pastTot, credits ->
                vm.addOrUpdateSubject(null, name, "#7C3AED", target, type, frozen, pastAtt, pastTot, credits)
                showAddSubject = false
            }
        )
    }

    if (showAiPasteTimetable) {
        var rawSchedule by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showAiPasteTimetable = false },
            containerColor = CyberColors.GlassSurface,
            title = { Text("⚡ Needle 3 Timetable Extractor", color = CyberColors.Primary, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "Paste your college timetable or WhatsApp schedule text. Needle 3 extracts subjects & time slots 100% offline.",
                        color = CyberColors.TextSecondary,
                        fontSize = 12.sp
                    )
                    OutlinedTextField(
                        value = rawSchedule,
                        onValueChange = { rawSchedule = it },
                        placeholder = { Text("Monday 09:00-10:00 Operating Systems\nTuesday 14:00-16:00 DBMS Lab", fontSize = 11.sp) },
                        minLines = 4
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        vm.extractAndImportTimetable(rawSchedule)
                        showAiPasteTimetable = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = CyberColors.ElectricViolet)
                ) { Text("Extract & Import") }
            },
            dismissButton = { TextButton(onClick = { showAiPasteTimetable = false }) { Text("Cancel") } }
        )
    }

    showSlotDialogFor?.let { subj ->
        AddTimetableSlotDialog(
            subjectName = subj.optString("name"),
            onDismiss = { showSlotDialogFor = null },
            onSave = { day, start, end, room ->
                vm.addTimetableEntry(subj.getLong("id"), day, start, end, room)
                showSlotDialogFor = null
            }
        )
    }
}

@Composable
private fun SubjectDetailScreen(
    item: JSONObject,
    timetable: JSONArray,
    allInstances: JSONArray,
    onDeleteSlot: (Long) -> Unit,
    onBack: () -> Unit
) {
    val subj = item.getJSONObject("subject")
    val metrics = item.getJSONObject("metrics")
    val subjId = subj.getLong("id")
    val attended = metrics.optDouble("attendedHours", 0.0)
    val conducted = metrics.optDouble("conductedHours", 0.0)
    val absentHrs = metrics.optDouble("absentHours", 0.0)
    val needed = metrics.optInt("neededConsecutiveHours", 0)
    val pct = metrics.optInt("percent", 0)
    val target = metrics.optInt("targetPercent", 75)
    val stype = subj.optString("subject_type", "theory")

    var addAttend by remember { mutableFloatStateOf(0f) }
    var addMiss by remember { mutableFloatStateOf(0f) }
    var simText by remember { mutableStateOf("Slide to simulate future classes") }
    var historyTab by remember { mutableStateOf("all") }
    val scope = rememberCoroutineScope()

    LaunchedEffect(addAttend, addMiss) {
        scope.launch {
            val p = JSONObject()
                .put("attended", attended)
                .put("conducted", conducted)
                .put("additional_attended", addAttend.toDouble())
                .put("additional_missed", addMiss.toDouble())
                .put("target_percent", target)
            AttendoCore.invoke("simulate_attendance", p).onSuccess { res ->
                simText = res.optString("statusMessage", simText)
            }
        }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .cyberGridBackground(),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 108.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Contextual Detail Header
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                    IconButton(
                        onClick = onBack,
                        modifier = Modifier.size(40.dp).clip(CircleShape).background(CyberColors.GlassCard)
                    ) {
                        Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Back", tint = CyberColors.TextPrimary)
                    }
                    Spacer(Modifier.width(10.dp))
                    Column {
                        Text("SUBJECT ANALYTICS", color = CyberColors.TextSecondary, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                        Text(subj.optString("name"), color = CyberColors.TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    }
                }
                StatusPill(
                    label = if (stype.equals("lab", true)) "Lab" else "Theory",
                    color = if (stype.equals("lab", true)) CyberColors.OnWarningContainer else CyberColors.NeonCyan,
                    containerColor = if (stype.equals("lab", true)) CyberColors.WarningContainer else CyberColors.GlassElevated
                )
            }
        }

        // Weighted Hours Gauge Card (matching HTML #2)
        item {
            CyberBentoCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    CyberAttendanceGauge(percent = pct, targetPercent = target, size = 96.dp, strokeWidth = 8.dp)
                    Spacer(Modifier.width(16.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Weighted Hours", color = CyberColors.TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                            StatusPill(
                                label = if (pct >= target) "Safe" else "Below $target%",
                                color = if (pct >= target) CyberColors.OnSecondaryContainer else CyberColors.OnWarningContainer,
                                containerColor = if (pct >= target) CyberColors.SecondaryContainer else CyberColors.WarningContainer
                            )
                        }
                        Spacer(Modifier.height(6.dp))
                        Text(
                            "$attended / $conducted hrs",
                            color = CyberColors.TextPrimary,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.SemiBold,
                            fontFamily = FontFamily.Monospace
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(metrics.optString("statusMessage"), color = CyberColors.TextSecondary, fontSize = 13.sp)
                    }
                }
                Spacer(Modifier.height(14.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    MetricBox("Attended", "$attended hrs", CyberColors.Present, Modifier.weight(1f))
                    MetricBox("Missed", "$absentHrs hrs", CyberColors.Absent, Modifier.weight(1f))
                    MetricBox("Recovery", "+$needed hrs", CyberColors.TextPrimary, Modifier.weight(1f))
                }
            }
        }

        // What-If Bunk Simulator Card
        item {
            CyberBentoCard {
                Text("What-If Simulator", color = CyberColors.Primary, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(6.dp))
                Text("Attend +${addAttend.toInt()} hrs", color = CyberColors.Present, fontSize = 12.sp, fontFamily = FontFamily.Monospace)
                Slider(value = addAttend, onValueChange = { addAttend = it }, valueRange = 0f..20f)
                Text("Miss +${addMiss.toInt()} hrs", color = CyberColors.Absent, fontSize = 12.sp, fontFamily = FontFamily.Monospace)
                Slider(value = addMiss, onValueChange = { addMiss = it }, valueRange = 0f..20f)
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(CyberColors.GlassSurface)
                        .padding(12.dp)
                ) {
                    Text(simText, color = CyberColors.TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }

        // Weekly Timetable Slots
        item {
            CyberBentoCard {
                Text("Weekly Slots", color = CyberColors.TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(8.dp))
                var slotCount = 0
                for (i in 0 until timetable.length()) {
                    val slot = timetable.optJSONObject(i)
                    if (slot != null && slot.optLong("subject_id") == subjId) {
                        slotCount++
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("${slot.optString("day_of_week")} ${slot.optString("start_time")}–${slot.optString("end_time")}", color = CyberColors.TextPrimary, fontSize = 13.sp)
                            TextButton(onClick = { onDeleteSlot(slot.getLong("id")) }) {
                                Text("Remove", color = CyberColors.Absent, fontSize = 12.sp)
                            }
                        }
                    }
                }
                if (slotCount == 0) {
                    Text("No recurring slots added yet.", color = CyberColors.TextMuted, fontSize = 12.sp)
                }
            }
        }

        // Session History Tabs (matching HTML #2)
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(CircleShape)
                    .background(CyberColors.GlassCard)
                    .border(1.dp, CyberColors.CyberBorder, CircleShape)
                    .padding(4.dp)
            ) {
                listOf("all" to "All Sessions", "absent" to "Missed Only").forEach { (key, label) ->
                    val active = historyTab == key
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(CircleShape)
                            .background(if (active) CyberColors.GlassElevated else Color.Transparent)
                            .clickable { historyTab = key }
                            .padding(vertical = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(label, color = if (active) CyberColors.TextPrimary else CyberColors.TextSecondary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }

        val matchingSessions = (0 until allInstances.length()).mapNotNull { i ->
            val inst = allInstances.optJSONObject(i) ?: return@mapNotNull null
            if (inst.optLong("subject_id") != subjId) return@mapNotNull null
            val st = inst.optString("status", "")
            if (historyTab == "absent" && st != "absent") return@mapNotNull null
            inst
        }
        items(matchingSessions.size) { idx ->
            val inst = matchingSessions[idx]
            val st = if (inst.isNull("status")) "unmarked" else inst.optString("status")
            val (fg, bg) = when (st) {
                "present" -> CyberColors.OnSecondaryContainer to CyberColors.SecondaryContainer
                "absent" -> CyberColors.OnErrorContainer to CyberColors.ErrorContainer
                else -> CyberColors.TextSecondary to CyberColors.GlassElevated
            }
            CyberBentoCard {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column {
                        Text(inst.optString("date"), color = CyberColors.TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                        Text("${inst.optString("start_time")} – ${inst.optString("end_time")}", color = CyberColors.TextSecondary, fontSize = 12.sp, fontFamily = FontFamily.Monospace)
                    }
                    StatusPill(st.replaceFirstChar { it.uppercase() }, fg, bg)
                }
            }
        }
    }
}

@Composable
private fun MetricBox(label: String, value: String, valueColor: Color, modifier: Modifier) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(CyberColors.GlassSurface)
            .padding(10.dp)
    ) {
        Text(label, color = CyberColors.TextSecondary, fontSize = 11.sp)
        Spacer(Modifier.height(3.dp))
        Text(value, color = valueColor, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, fontFamily = FontFamily.Monospace)
    }
}

@Composable
private fun SplitStatPill(label: String, value: String, color: Color, modifier: Modifier) {
    CyberBentoCard(modifier = modifier) {
        Text(label, color = CyberColors.TextSecondary, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(4.dp))
        Text(value, color = color, fontSize = 20.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
    }
}

@Composable
private fun AddSubjectDialog(
    onDismiss: () -> Unit,
    onSave: (String, Int, String, Boolean, Int, Int, Int) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var target by remember { mutableStateOf("75") }
    var type by remember { mutableStateOf("theory") }
    var isFrozen by remember { mutableStateOf(false) }
    var pastAtt by remember { mutableStateOf("0") }
    var pastTot by remember { mutableStateOf("0") }
    var credits by remember { mutableStateOf("3") }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CyberColors.GlassSurface,
        title = { Text("New Subject", color = CyberColors.TextPrimary, fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Subject Name") }, singleLine = true)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("theory", "lab").forEach { t ->
                        FilterChip(selected = type == t, onClick = { type = t }, label = { Text(t.uppercase()) })
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = target, onValueChange = { target = it }, label = { Text("Target %") }, modifier = Modifier.weight(1f), singleLine = true)
                    OutlinedTextField(value = credits, onValueChange = { credits = it }, label = { Text("Credits") }, modifier = Modifier.weight(1f), singleLine = true)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = pastAtt, onValueChange = { pastAtt = it }, label = { Text("Past Attended") }, modifier = Modifier.weight(1f), singleLine = true)
                    OutlinedTextField(value = pastTot, onValueChange = { pastTot = it }, label = { Text("Past Total") }, modifier = Modifier.weight(1f), singleLine = true)
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = isFrozen, onCheckedChange = { isFrozen = it })
                    Text("Frozen / Leisure", color = CyberColors.TextSecondary, fontSize = 12.sp)
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (name.isNotBlank()) {
                        onSave(
                            name,
                            target.toIntOrNull() ?: 75,
                            type,
                            isFrozen,
                            pastAtt.toIntOrNull() ?: 0,
                            pastTot.toIntOrNull() ?: 0,
                            credits.toIntOrNull() ?: 3
                        )
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = CyberColors.ElectricViolet)
            ) { Text("Save") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}

@Composable
private fun AddTimetableSlotDialog(
    subjectName: String,
    onDismiss: () -> Unit,
    onSave: (String, String, String, String) -> Unit
) {
    val days = listOf("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday")
    var selectedDay by remember { mutableStateOf("Monday") }
    var start by remember { mutableStateOf("09:00") }
    var end by remember { mutableStateOf("10:00") }
    var room by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CyberColors.GlassSurface,
        title = { Text("Add Slot · $subjectName", color = CyberColors.TextPrimary, fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                ScrollableTabRow(selectedTabIndex = days.indexOf(selectedDay), edgePadding = 0.dp, containerColor = Color.Transparent) {
                    days.forEach { d -> Tab(selected = selectedDay == d, onClick = { selectedDay = d }, text = { Text(d.take(3)) }) }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = start, onValueChange = { start = it }, label = { Text("Start HH:MM") }, modifier = Modifier.weight(1f), singleLine = true)
                    OutlinedTextField(value = end, onValueChange = { end = it }, label = { Text("End HH:MM") }, modifier = Modifier.weight(1f), singleLine = true)
                }
                OutlinedTextField(value = room, onValueChange = { room = it }, label = { Text("Room / Lab") }, singleLine = true)
            }
        },
        confirmButton = {
            Button(
                onClick = { onSave(selectedDay, start, end, room) },
                colors = ButtonDefaults.buttonColors(containerColor = CyberColors.ElectricViolet)
            ) { Text("Add Slot") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}
