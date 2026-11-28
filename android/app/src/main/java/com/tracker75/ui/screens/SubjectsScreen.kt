package com.tracker75.ui.screens

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
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
import com.tracker75.ui.components.*
import com.tracker75.ui.theme.AttendoColors
import com.tracker75.viewmodel.AttendoViewModel
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

@Composable
fun SubjectsScreen(
    vm: AttendoViewModel,
    onOpenVault: () -> Unit
) {
    val snapshot by vm.snapshot.collectAsState()
    val subjects = snapshot.optJSONArray("subjects") ?: JSONArray()
    var showAddDialog by remember { mutableStateOf(false) }
    var editingSubject by remember { mutableStateOf<JSONObject?>(null) }
    var showSimDialog by remember { mutableStateOf(false) }

    val list = remember(subjects) { (0 until subjects.length()).map { subjects.getJSONObject(it) } }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 104.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        "Subjects",
                        color = AttendoColors.TextPrimary,
                        fontSize = 26.sp,
                        fontWeight = FontWeight.ExtraBold
                    )
                    Text(
                        "${list.size} active course(s)",
                        color = AttendoColors.TextSecondary,
                        fontSize = 12.sp
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    GlassActionPill(
                        text = "Vault",
                        selected = false,
                        activeColor = AttendoColors.Amber,
                        icon = Icons.Rounded.RestoreFromTrash,
                        onClick = onOpenVault
                    )
                    GlassActionPill(
                        text = "What-If",
                        selected = false,
                        activeColor = AttendoColors.Cyan,
                        icon = Icons.Rounded.Calculate,
                        onClick = { showSimDialog = true }
                    )
                    GlassActionPill(
                        text = "Add",
                        selected = true,
                        activeColor = AttendoColors.Indigo,
                        icon = Icons.Rounded.Add,
                        onClick = { showAddDialog = true }
                    )
                }
            }
        }

        itemsIndexed(list) { idx, item ->
            val subj = item.getJSONObject("subject")
            val metrics = item.getJSONObject("metrics")
            val pct = metrics.optInt("percent", 0)
            val tgt = metrics.optInt("targetPercent", 75)
            val eligible = metrics.optBoolean("isEligible", true)
            val bunks = metrics.optInt("maxBunkableHours", 0)
            val needed = metrics.optInt("neededConsecutiveHours", 0)
            val attended = metrics.optDouble("attendedHours", 0.0).toInt()
            val conducted = metrics.optDouble("conductedHours", 0.0).toInt()

            val accent = if (eligible) AttendoColors.Emerald else AttendoColors.Rose
            val animRatio by animateFloatAsState(
                targetValue = (pct / 100f).coerceIn(0f, 1f),
                animationSpec = spring(dampingRatio = 0.78f, stiffness = 240f),
                label = "subjProgress"
            )

            StaggeredEntrance(index = idx) {
                GlassCard(accentColor = accent) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = subj.optString("name"),
                                color = AttendoColors.TextPrimary,
                                fontSize = 17.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "${subj.optString("subject_type").uppercase()} • ${subj.optInt("credits", 3)} Credits • $attended/$conducted hrs",
                                color = AttendoColors.TextSecondary,
                                fontSize = 12.sp
                            )
                        }
                        Text(
                            text = "$pct%",
                            color = accent,
                            fontSize = 22.sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                    }

                    Spacer(modifier = Modifier.height(10.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(7.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0x1EFFFFFF))
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxHeight()
                                .fillMaxWidth(animRatio)
                                .clip(RoundedCornerShape(8.dp))
                                .background(
                                    Brush.horizontalGradient(
                                        colors = listOf(accent, AttendoColors.Cyan)
                                    )
                                )
                        )
                    }

                    Spacer(modifier = Modifier.height(10.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = if (eligible) "Safe: Bunk $bunks hr(s)" else "Need $needed consecutive hr(s) for $tgt%",
                            color = if (eligible) AttendoColors.Emerald else AttendoColors.Rose,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            GlassActionPill(
                                text = "Edit",
                                selected = false,
                                activeColor = AttendoColors.IndigoLight,
                                onClick = { editingSubject = subj }
                            )
                            GlassActionPill(
                                text = "Delete",
                                selected = false,
                                activeColor = AttendoColors.Rose,
                                onClick = { vm.deleteSubject(subj.optLong("id")) }
                            )
                        }
                    }
                }
            }
        }
    }

    if (showAddDialog || editingSubject != null) {
        SubjectFormDialog(
            existing = editingSubject,
            onDismiss = {
                showAddDialog = false
                editingSubject = null
            },
            onSave = { name, type, tgt, credits, pastAtt, pastTot ->
                vm.addOrUpdateSubject(
                    id = editingSubject?.optLong("id"),
                    name = name,
                    color = "#6366F1",
                    targetPercent = tgt,
                    subjectType = type,
                    isFrozen = false,
                    pastAttended = pastAtt,
                    pastTotal = pastTot,
                    credits = credits
                )
                showAddDialog = false
                editingSubject = null
            }
        )
    }

    if (showSimDialog) {
        WhatIfSimulatorDialog(onDismiss = { showSimDialog = false })
    }
}

@Composable
private fun SubjectFormDialog(
    existing: JSONObject?,
    onDismiss: () -> Unit,
    onSave: (String, String, Int, Int, Int, Int) -> Unit
) {
    var name by remember { mutableStateOf(existing?.optString("name") ?: "") }
    var type by remember { mutableStateOf(existing?.optString("subject_type") ?: "theory") }
    var target by remember { mutableStateOf((existing?.optInt("target_percent") ?: 75).toString()) }
    var credits by remember { mutableStateOf((existing?.optInt("credits") ?: 3).toString()) }
    var pastAtt by remember { mutableStateOf((existing?.optInt("past_attended") ?: 0).toString()) }
    var pastTot by remember { mutableStateOf((existing?.optInt("past_total") ?: 0).toString()) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = AttendoColors.ElevatedSurface,
        title = {
            Text(
                if (existing == null) "New Subject" else "Edit Subject",
                color = AttendoColors.TextPrimary,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Subject Name") })
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    GlassActionPill(
                        text = "Theory",
                        selected = type == "theory",
                        activeColor = AttendoColors.Indigo,
                        onClick = { type = "theory" },
                        modifier = Modifier.weight(1f)
                    )
                    GlassActionPill(
                        text = "Lab",
                        selected = type == "lab",
                        activeColor = AttendoColors.Cyan,
                        onClick = { type = "lab" },
                        modifier = Modifier.weight(1f)
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = target, onValueChange = { target = it }, label = { Text("Target %") }, modifier = Modifier.weight(1f))
                    OutlinedTextField(value = credits, onValueChange = { credits = it }, label = { Text("Credits") }, modifier = Modifier.weight(1f))
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = pastAtt, onValueChange = { pastAtt = it }, label = { Text("Past Attended") }, modifier = Modifier.weight(1f))
                    OutlinedTextField(value = pastTot, onValueChange = { pastTot = it }, label = { Text("Past Total") }, modifier = Modifier.weight(1f))
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (name.isNotBlank()) {
                        onSave(
                            name.trim(),
                            type,
                            target.toIntOrNull() ?: 75,
                            credits.toIntOrNull() ?: 3,
                            pastAtt.toIntOrNull() ?: 0,
                            pastTot.toIntOrNull() ?: 0
                        )
                    }
                }
            ) { Text("Save") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}

@Composable
private fun WhatIfSimulatorDialog(onDismiss: () -> Unit) {
    var attended by remember { mutableStateOf("18") }
    var conducted by remember { mutableStateOf("20") }
    var addAttend by remember { mutableStateOf("0") }
    var addMiss by remember { mutableStateOf("3") }
    var resultText by remember { mutableStateOf("Adjust values & tap Simulate") }
    val scope = rememberCoroutineScope()

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = AttendoColors.ElevatedSurface,
        title = { Text("What-If Bunk Simulator", color = AttendoColors.TextPrimary, fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = attended, onValueChange = { attended = it }, label = { Text("Attended") }, modifier = Modifier.weight(1f))
                    OutlinedTextField(value = conducted, onValueChange = { conducted = it }, label = { Text("Conducted") }, modifier = Modifier.weight(1f))
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = addAttend, onValueChange = { addAttend = it }, label = { Text("+ Attend") }, modifier = Modifier.weight(1f))
                    OutlinedTextField(value = addMiss, onValueChange = { addMiss = it }, label = { Text("+ Bunk") }, modifier = Modifier.weight(1f))
                }
                Text(resultText, color = AttendoColors.Cyan, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            }
        },
        confirmButton = {
            Button(onClick = {
                scope.launch {
                    val p = JSONObject()
                        .put("attended", attended.toDoubleOrNull() ?: 0.0)
                        .put("conducted", conducted.toDoubleOrNull() ?: 0.0)
                        .put("additional_attended", addAttend.toDoubleOrNull() ?: 0.0)
                        .put("additional_missed", addMiss.toDoubleOrNull() ?: 0.0)
                        .put("target_percent", 75)
                    AttendoCore.invoke("simulate_attendance", p).onSuccess { r ->
                        resultText = "${r.optInt("projectedPercent")}% • ${r.optString("statusMessage")}"
                    }
                }
            }) { Text("Simulate") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Close") } }
    )
}
