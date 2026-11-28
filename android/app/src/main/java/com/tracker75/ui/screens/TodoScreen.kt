package com.tracker75.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tracker75.ui.components.GlassActionPill
import com.tracker75.ui.components.GlassCard
import com.tracker75.ui.components.StaggeredEntrance
import com.tracker75.ui.theme.AttendoColors
import com.tracker75.viewmodel.AttendoViewModel
import org.json.JSONArray
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun TodoScreen(vm: AttendoViewModel) {
    val snapshot by vm.snapshot.collectAsState()
    val todos = snapshot.optJSONArray("todos") ?: JSONArray()
    var showAddDialog by remember { mutableStateOf(false) }

    val list = remember(todos) { (0 until todos.length()).map { todos.getJSONObject(it) } }

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
                    Text("Tasks", color = AttendoColors.TextPrimary, fontSize = 26.sp, fontWeight = FontWeight.ExtraBold)
                    Text("${list.size} task(s)", color = AttendoColors.TextSecondary, fontSize = 12.sp)
                }
                GlassActionPill(
                    text = "New Task",
                    selected = true,
                    activeColor = AttendoColors.Indigo,
                    icon = Icons.Rounded.Add,
                    onClick = { showAddDialog = true }
                )
            }
        }

        if (list.isEmpty()) {
            item {
                GlassCard(accentColor = AttendoColors.Cyan) {
                    Text("All caught up! Add a task or ask Attendo AI.", color = AttendoColors.TextSecondary, fontSize = 13.sp)
                }
            }
        } else {
            itemsIndexed(list) { idx, td ->
                val done = td.optInt("is_completed", 0) == 1
                val prio = td.optString("priority", "medium")
                val accent = when {
                    done -> AttendoColors.Emerald
                    prio == "high" -> AttendoColors.Rose
                    else -> AttendoColors.Indigo
                }
                StaggeredEntrance(index = idx) {
                    GlassCard(accentColor = accent) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Checkbox(
                                checked = done,
                                onCheckedChange = { vm.toggleTodo(td.optLong("id")) },
                                colors = CheckboxDefaults.colors(checkedColor = AttendoColors.Emerald)
                            )
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = td.optString("title"),
                                    color = AttendoColors.TextPrimary,
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    textDecoration = if (done) TextDecoration.LineThrough else null
                                )
                                Text(
                                    text = "Due ${td.optString("due_date")} • ${prio.uppercase()}",
                                    color = AttendoColors.TextSecondary,
                                    fontSize = 11.sp
                                )
                            }
                            IconButton(onClick = { vm.deleteTodo(td.optLong("id")) }) {
                                Icon(Icons.Rounded.DeleteOutline, contentDescription = "Delete", tint = AttendoColors.Rose)
                            }
                        }
                    }
                }
            }
        }
    }

    if (showAddDialog) {
        var title by remember { mutableStateOf("") }
        var due by remember { mutableStateOf(SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())) }
        var prio by remember { mutableStateOf("medium") }
        AlertDialog(
            onDismissRequest = { showAddDialog = false },
            containerColor = AttendoColors.ElevatedSurface,
            title = { Text("New Task", color = AttendoColors.TextPrimary, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = title, onValueChange = { title = it }, label = { Text("Title") })
                    OutlinedTextField(value = due, onValueChange = { due = it }, label = { Text("Due Date (YYYY-MM-DD)") })
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf("low", "medium", "high").forEach { p ->
                            GlassActionPill(
                                text = p.uppercase(),
                                selected = prio == p,
                                activeColor = AttendoColors.Cyan,
                                onClick = { prio = p },
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                }
            },
            confirmButton = {
                Button(onClick = {
                    if (title.isNotBlank()) {
                        vm.addTodo(title.trim(), null, due, null, prio, 15, "")
                        showAddDialog = false
                    }
                }) { Text("Add") }
            },
            dismissButton = { TextButton(onClick = { showAddDialog = false }) { Text("Cancel") } }
        )
    }
}
