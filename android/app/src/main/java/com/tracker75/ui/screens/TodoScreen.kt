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
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.RadioButtonUnchecked
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tracker75.ui.components.CyberBentoCard
import com.tracker75.ui.components.StatusPill
import com.tracker75.ui.components.cyberGridBackground
import com.tracker75.ui.theme.CyberColors
import com.tracker75.viewmodel.AttendoViewModel
import org.json.JSONArray
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun TodoScreen(vm: AttendoViewModel) {
    val snapshot by vm.snapshot.collectAsState()
    val todos = snapshot.optJSONArray("todos") ?: JSONArray()
    val subjects = snapshot.optJSONArray("subjects") ?: JSONArray()

    var filterPriority by remember { mutableStateOf("all") }
    var showAddTodo by remember { mutableStateOf(false) }
    var showNoticeExtract by remember { mutableStateOf(false) }

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
                    Text("TASKS & DEADLINES", color = CyberColors.NeonCyan, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.4.sp)
                    Text("To-Do Shield", color = CyberColors.TextPrimary, fontSize = 24.sp, fontWeight = FontWeight.Black)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = { showNoticeExtract = true },
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("✨ Notice", color = CyberColors.NeonCyan, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                    Button(
                        onClick = { showAddTodo = true },
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = CyberColors.ElectricViolet)
                    ) {
                        Icon(Icons.Rounded.Add, null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Task", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("all", "high", "medium", "low").forEach { p ->
                    val selected = filterPriority == p
                    Box(
                        modifier = Modifier
                            .clip(CircleShape)
                            .background(if (selected) CyberColors.ElectricViolet else CyberColors.GlassSurface)
                            .border(1.dp, if (selected) CyberColors.NeonCyan else CyberColors.CyberBorder, CircleShape)
                            .clickable { filterPriority = p }
                            .padding(horizontal = 14.dp, vertical = 6.dp)
                    ) {
                        Text(p.uppercase(), color = if (selected) Color.White else CyberColors.TextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        val filtered = (0 until todos.length()).mapNotNull { i ->
            val td = todos.optJSONObject(i) ?: return@mapNotNull null
            if (filterPriority == "all" || td.optString("priority") == filterPriority) td else null
        }

        if (filtered.isEmpty()) {
            item {
                CyberBentoCard {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("✅", fontSize = 36.sp)
                        Spacer(Modifier.height(8.dp))
                        Text("All Caught Up!", color = CyberColors.TextPrimary, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        Text("Tap + Task to track assignments, labs, and exam prep.", color = CyberColors.TextSecondary, fontSize = 12.sp)
                    }
                }
            }
        } else {
            items(filtered.size) { idx ->
                val td = filtered[idx]
                val done = td.optInt("is_completed", 0) == 1
                val priority = td.optString("priority", "medium")
                val pColor = when (priority) {
                    "high" -> CyberColors.Absent
                    "low" -> CyberColors.Present
                    else -> CyberColors.Cancelled
                }

                CyberBentoCard(borderColor = if (done) CyberColors.CyberBorder else pColor.copy(alpha = 0.45f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(onClick = { vm.toggleTodo(td.getLong("id")) }) {
                            Icon(
                                if (done) Icons.Rounded.CheckCircle else Icons.Rounded.RadioButtonUnchecked,
                                "Toggle",
                                tint = if (done) CyberColors.Present else CyberColors.NeonCyan
                            )
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                td.optString("title"),
                                color = if (done) CyberColors.TextMuted else CyberColors.TextPrimary,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                textDecoration = if (done) TextDecoration.LineThrough else TextDecoration.None
                            )
                            Spacer(Modifier.height(3.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                                Text("Due ${td.optString("due_date")}", color = CyberColors.TextSecondary, fontSize = 11.sp)
                                StatusPill(priority, pColor)
                                val subjName = td.optString("subject_name", "")
                                if (subjName.isNotBlank() && subjName != "null") {
                                    StatusPill(subjName, CyberColors.ElectricViolet)
                                }
                            }
                        }
                        IconButton(onClick = { vm.deleteTodo(td.getLong("id")) }) {
                            Icon(Icons.Rounded.Delete, "Delete", tint = CyberColors.TextMuted, modifier = Modifier.size(18.dp))
                        }
                    }
                }
            }
        }
    }

    if (showAddTodo) {
        AddTodoDialog(
            subjects = subjects,
            onDismiss = { showAddTodo = false },
            onSave = { title, subjId, due, time, prio, notes ->
                vm.addTodo(title, subjId, due, time, prio, 15, notes)
                showAddTodo = false
            }
        )
    }

    if (showNoticeExtract) {
        var rawNotice by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showNoticeExtract = false },
            containerColor = CyberColors.GlassSurface,
            title = { Text("⚡ Needle 3 Notice-to-Tasks", color = CyberColors.NeonCyan, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "Paste any WhatsApp announcement or syllabus notice. Needle 3 extracts tasks & priorities offline.",
                        color = CyberColors.TextSecondary,
                        fontSize = 12.sp
                    )
                    OutlinedTextField(
                        value = rawNotice,
                        onValueChange = { rawNotice = it },
                        placeholder = { Text("Submit OS Lab record by Friday\nPrepare for DBMS Quiz next week", fontSize = 11.sp) },
                        minLines = 4
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        vm.extractAndAddTodos(rawNotice)
                        showNoticeExtract = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = CyberColors.ElectricViolet)
                ) { Text("Extract Tasks") }
            },
            dismissButton = { TextButton(onClick = { showNoticeExtract = false }) { Text("Cancel") } }
        )
    }
}

@Composable
private fun AddTodoDialog(
    subjects: JSONArray,
    onDismiss: () -> Unit,
    onSave: (String, Long?, String, String?, String, String) -> Unit
) {
    val today = remember { SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date()) }
    var title by remember { mutableStateOf("") }
    var dueDate by remember { mutableStateOf(today) }
    var priority by remember { mutableStateOf("medium") }
    var notes by remember { mutableStateOf("") }
    var selectedSubjId by remember { mutableStateOf<Long?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CyberColors.GlassSurface,
        title = { Text("New Task", color = CyberColors.TextPrimary, fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = title, onValueChange = { title = it }, label = { Text("Task Title") }, singleLine = true)
                OutlinedTextField(value = dueDate, onValueChange = { dueDate = it }, label = { Text("Due Date (YYYY-MM-DD)") }, singleLine = true)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("high", "medium", "low").forEach { p ->
                        FilterChip(selected = priority == p, onClick = { priority = p }, label = { Text(p.uppercase()) })
                    }
                }
                if (subjects.length() > 0) {
                    Text("Subject (Optional)", color = CyberColors.TextSecondary, fontSize = 11.sp)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        for (i in 0 until minOf(subjects.length(), 3)) {
                            val s = subjects.getJSONObject(i).getJSONObject("subject")
                            val sid = s.getLong("id")
                            FilterChip(
                                selected = selectedSubjId == sid,
                                onClick = { selectedSubjId = if (selectedSubjId == sid) null else sid },
                                label = { Text(s.optString("name").take(10), fontSize = 11.sp) }
                            )
                        }
                    }
                }
                OutlinedTextField(value = notes, onValueChange = { notes = it }, label = { Text("Notes") }, singleLine = true)
            }
        },
        confirmButton = {
            Button(
                onClick = { if (title.isNotBlank()) onSave(title, selectedSubjId, dueDate, null, priority, notes) },
                colors = ButtonDefaults.buttonColors(containerColor = CyberColors.ElectricViolet)
            ) { Text("Add") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}
