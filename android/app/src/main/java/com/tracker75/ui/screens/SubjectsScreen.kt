package com.tracker75.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tracker75.core.AttendoCore
import com.tracker75.ui.components.CyberBentoCard
import com.tracker75.ui.components.StatusPill
import com.tracker75.ui.components.cyberGridBackground
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

    var showAddSubject by remember { mutableStateOf(false) }
    var selectedSubject by remember { mutableStateOf<JSONObject?>(null) }
    var showSlotDialogFor by remember { mutableStateOf<JSONObject?>(null) }

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
                    Text("SUBJECTS & SIMULATOR", color = CyberColors.NeonCyan, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.4.sp)
                    Text("Your Courses", color = CyberColors.TextPrimary, fontSize = 24.sp, fontWeight = FontWeight.Black)
                }
                Button(
                    onClick = { showAddSubject = true },
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = CyberColors.ElectricViolet)
                ) {
                    Icon(Icons.Rounded.Add, null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Add", fontWeight = FontWeight.Bold)
                }
            }
        }

        // Split Theory vs Lab Analytics Banner
        item {
            val overallPct = report?.optJSONObject("overall")?.optInt("percent", 0) ?: 0
            val theoryPct = report?.optJSONObject("theory")?.optInt("percent", 0) ?: 0
            val labPct = report?.optJSONObject("lab")?.optInt("percent", 0) ?: 0
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                SplitStatPill("OVERALL", "$overallPct%", CyberColors.NeonCyan, Modifier.weight(1f))
                SplitStatPill("THEORY", "$theoryPct%", CyberColors.ElectricViolet, Modifier.weight(1f))
                SplitStatPill("LAB", "$labPct%", CyberColors.Shifted, Modifier.weight(1f))
            }
        }

        if (subjects.length() == 0) {
            item {
                CyberBentoCard {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("📚", fontSize = 36.sp)
                        Spacer(Modifier.height(8.dp))
                        Text("No Subjects Yet", color = CyberColors.TextPrimary, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        Text("Tap + Add to create your first course and weekly timetable.", color = CyberColors.TextSecondary, fontSize = 12.sp)
                    }
                }
            }
        } else {
            items(subjects.length()) { idx ->
                val item = subjects.getJSONObject(idx)
                val subj = item.getJSONObject("subject")
                val metrics = item.getJSONObject("metrics")
                val pct = metrics.optInt("percent", 0)
                val target = metrics.optInt("targetPercent", 75)
                val isEligible = metrics.optBoolean("isEligible", true)
                val barColor = if (isEligible) CyberColors.Present else CyberColors.Absent

                CyberBentoCard(
                    borderColor = if (isEligible) CyberColors.CyberBorder else CyberColors.Absent.copy(alpha = 0.5f),
                    onClick = { selectedSubject = item }
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(subj.optString("name"), color = CyberColors.TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                                Spacer(Modifier.width(8.dp))
                                StatusPill(subj.optString("subject_type", "theory"), CyberColors.NeonCyan)
                                if (subj.optInt("is_frozen", 0) == 1) {
                                    Spacer(Modifier.width(6.dp))
                                    StatusPill("FROZEN", CyberColors.Holiday)
                                }
                            }
                            Spacer(Modifier.height(4.dp))
                            Text(
                                "${metrics.optDouble("attendedHours", 0.0)}h / ${metrics.optDouble("conductedHours", 0.0)}h • ${metrics.optString("statusMessage")}",
                                color = CyberColors.TextSecondary,
                                fontSize = 12.sp
                            )
                        }
                        Text(
                            "$pct%",
                            color = barColor,
                            fontSize = 22.sp,
                            fontWeight = FontWeight.Black
                        )
                    }
                    Spacer(Modifier.height(10.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(6.dp)
                            .clip(CircleShape)
                            .background(CyberColors.ObsidianBg)
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth((pct.coerceIn(0, 100) / 100f))
                                .fillMaxHeight()
                                .clip(CircleShape)
                                .background(Brush.horizontalGradient(listOf(CyberColors.ElectricViolet, barColor)))
                        )
                    }
                    Spacer(Modifier.height(10.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TextButton(onClick = { showSlotDialogFor = subj }, contentPadding = PaddingValues(horizontal = 8.dp)) {
                            Icon(Icons.Rounded.Schedule, null, tint = CyberColors.NeonCyan, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Add Class Slot", color = CyberColors.NeonCyan, fontSize = 12.sp)
                        }
                        Spacer(Modifier.weight(1f))
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
                vm.addOrUpdateSubject(null, name, "#8B5CF6", target, type, frozen, pastAtt, pastTot, credits)
                showAddSubject = false
            }
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

    selectedSubject?.let { item ->
        SubjectDetailAndSimulatorDialog(
            item = item,
            timetable = timetable,
            onDeleteSlot = { vm.deleteTimetableEntry(it) },
            onDismiss = { selectedSubject = null }
        )
    }
}

@Composable
private fun SplitStatPill(label: String, value: String, color: Color, modifier: Modifier) {
    CyberBentoCard(modifier = modifier, borderColor = color.copy(alpha = 0.4f)) {
        Text(label, color = CyberColors.TextMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(4.dp))
        Text(value, color = color, fontSize = 20.sp, fontWeight = FontWeight.Black)
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
                        FilterChip(
                            selected = type == t,
                            onClick = { type = t },
                            label = { Text(t.uppercase()) }
                        )
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
                    Text("Frozen / Leisure (exclude from global %)", color = CyberColors.TextSecondary, fontSize = 12.sp)
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
        title = { Text("Add Slot • $subjectName", color = CyberColors.TextPrimary, fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                ScrollableTabRow(selectedTabIndex = days.indexOf(selectedDay), edgePadding = 0.dp, containerColor = Color.Transparent) {
                    days.forEach { d ->
                        Tab(selected = selectedDay == d, onClick = { selectedDay = d }, text = { Text(d.take(3)) })
                    }
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

@Composable
private fun SubjectDetailAndSimulatorDialog(
    item: JSONObject,
    timetable: JSONArray,
    onDeleteSlot: (Long) -> Unit,
    onDismiss: () -> Unit
) {
    val subj = item.getJSONObject("subject")
    val metrics = item.getJSONObject("metrics")
    val subjId = subj.getLong("id")
    val attended = metrics.optDouble("attendedHours", 0.0)
    val conducted = metrics.optDouble("conductedHours", 0.0)
    val target = metrics.optInt("targetPercent", 75)

    var addAttend by remember { mutableFloatStateOf(0f) }
    var addMiss by remember { mutableFloatStateOf(0f) }
    var simText by remember { mutableStateOf("Adjust sliders to simulate future classes") }
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

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CyberColors.GlassSurface,
        title = { Text(subj.optString("name"), color = CyberColors.TextPrimary, fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("What-If Bunk Simulator (Rust Engine)", color = CyberColors.NeonCyan, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Text("Attend +${addAttend.toInt()}h", color = CyberColors.Present, fontSize = 12.sp)
                Slider(value = addAttend, onValueChange = { addAttend = it }, valueRange = 0f..20f)
                Text("Miss +${addMiss.toInt()}h", color = CyberColors.Absent, fontSize = 12.sp)
                Slider(value = addMiss, onValueChange = { addMiss = it }, valueRange = 0f..20f)
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(CyberColors.ObsidianBg)
                        .padding(10.dp)
                ) {
                    Text(simText, color = CyberColors.TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                }

                Text("Weekly Slots", color = CyberColors.TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                (0 until timetable.length()).forEach { i ->
                    val slot = timetable.optJSONObject(i)
                    if (slot != null && slot.optLong("subject_id") == subjId) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("${slot.optString("day_of_week")} ${slot.optString("start_time")}-${slot.optString("end_time")}", color = CyberColors.TextPrimary, fontSize = 12.sp)
                            TextButton(onClick = { onDeleteSlot(slot.getLong("id")) }) {
                                Text("Remove", color = CyberColors.Absent, fontSize = 11.sp)
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("Done", color = CyberColors.NeonCyan) }
        }
    )
}
