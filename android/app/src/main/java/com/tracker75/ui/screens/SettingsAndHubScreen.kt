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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tracker75.core.AttendoCore
import com.tracker75.ui.components.GlassActionPill
import com.tracker75.ui.components.GlassCard
import com.tracker75.ui.components.StaggeredEntrance
import com.tracker75.ui.theme.AttendoColors
import com.tracker75.viewmodel.AttendoViewModel
import kotlinx.coroutines.launch
import org.json.JSONObject

@Composable
fun SettingsAndHubScreen(vm: AttendoViewModel) {
    val snapshot by vm.snapshot.collectAsState()
    val deletedHistory by vm.deletedHistory.collectAsState()
    val syncKey = snapshot.optString("syncKey", "ATND-...")
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var restoreCode by remember { mutableStateOf("") }

    LaunchedEffect(Unit) {
        vm.refreshDeletedHistory()
    }

    val deletedList = remember(deletedHistory) {
        (0 until deletedHistory.length()).map { deletedHistory.getJSONObject(it) }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 104.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Column {
                Text("Hub & Vault", color = AttendoColors.TextPrimary, fontSize = 26.sp, fontWeight = FontWeight.ExtraBold)
                Text("Attendo v10.0.1 • Groq + Rust Copilot", color = AttendoColors.Cyan, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }
        }

        // Database Recovery Vault
        item {
            StaggeredEntrance(index = 0) {
                GlassCard(accentColor = AttendoColors.Amber) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Rounded.RestoreFromTrash, contentDescription = null, tint = AttendoColors.Amber)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Database Recovery Vault", color = AttendoColors.TextPrimary, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        }
                        GlassActionPill(
                            text = "Refresh",
                            selected = false,
                            activeColor = AttendoColors.Amber,
                            onClick = { vm.refreshDeletedHistory() }
                        )
                    }
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        if (deletedList.isEmpty()) "No deleted subjects, classes, or tasks pending recovery."
                        else "${deletedList.size} deleted item(s) safely archived in SQLite:",
                        color = AttendoColors.TextSecondary,
                        fontSize = 12.sp
                    )
                }
            }
        }

        itemsIndexed(deletedList) { idx, item ->
            StaggeredEntrance(index = idx + 1) {
                GlassCard(accentColor = AttendoColors.Emerald) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(item.optString("label"), color = AttendoColors.TextPrimary, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            Text("${item.optString("entityType").uppercase()} • Deleted ${item.optString("deletedAt").take(10)}", color = AttendoColors.TextSecondary, fontSize = 11.sp)
                        }
                        GlassActionPill(
                            text = "Restore",
                            selected = true,
                            activeColor = AttendoColors.Emerald,
                            icon = Icons.Rounded.Restore,
                            onClick = { vm.restoreDeletedItem(item.optLong("id")) }
                        )
                    }
                }
            }
        }

        // Global Target %
        item {
            GlassCard(accentColor = AttendoColors.Indigo) {
                Text("Global Target Attendance", color = AttendoColors.TextPrimary, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                Spacer(modifier = Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(70, 75, 80, 85).forEach { pct ->
                        GlassActionPill(
                            text = "$pct%",
                            selected = false,
                            activeColor = AttendoColors.IndigoLight,
                            onClick = {
                                scope.launch {
                                    AttendoCore.invoke("set_setting", JSONObject().put("key", "global_target_percent").put("value", pct.toString()))
                                    vm.showBanner("Target set to $pct%")
                                    vm.refreshAll()
                                }
                            },
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }
        }

        // Cloud Sync & Delta OTA
        item {
            GlassCard(accentColor = AttendoColors.Cyan) {
                Text("Cloud Sync & Delta OTA", color = AttendoColors.TextPrimary, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                Spacer(modifier = Modifier.height(4.dp))
                Text("Sync Key: $syncKey", color = AttendoColors.Cyan, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                Spacer(modifier = Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    GlassActionPill(
                        text = "Backup",
                        selected = true,
                        activeColor = AttendoColors.Indigo,
                        icon = Icons.Rounded.CloudUpload,
                        onClick = { vm.backupToCloud() },
                        modifier = Modifier.weight(1f)
                    )
                    GlassActionPill(
                        text = "Check OTA",
                        selected = false,
                        activeColor = AttendoColors.Cyan,
                        icon = Icons.Rounded.SystemUpdate,
                        onClick = { vm.checkForUpdate(silent = false) },
                        modifier = Modifier.weight(1f)
                    )
                    GlassActionPill(
                        text = "Nudge",
                        selected = false,
                        activeColor = AttendoColors.Emerald,
                        icon = Icons.Rounded.NotificationsActive,
                        onClick = { vm.scheduleReminders(context) },
                        modifier = Modifier.weight(1f)
                    )
                }
                Spacer(modifier = Modifier.height(10.dp))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = restoreCode,
                        onValueChange = { restoreCode = it },
                        label = { Text("Restore Sync Key") },
                        modifier = Modifier.weight(1f),
                        singleLine = true
                    )
                    GlassActionPill(
                        text = "Merge",
                        selected = true,
                        activeColor = AttendoColors.Emerald,
                        onClick = {
                            if (restoreCode.isNotBlank()) vm.restoreFromCloud(restoreCode, "merge")
                        }
                    )
                }
            }
        }
    }
}
