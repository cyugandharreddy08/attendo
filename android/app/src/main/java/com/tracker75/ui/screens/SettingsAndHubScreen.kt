package com.tracker75.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tracker75.ui.components.ClassicShieldLogo
import com.tracker75.ui.components.CyberBentoCard
import com.tracker75.ui.components.StatusPill
import com.tracker75.ui.components.cyberGridBackground
import com.tracker75.ui.theme.CyberColors
import com.tracker75.viewmodel.AttendoViewModel
import org.json.JSONArray

@Composable
fun SettingsAndHubScreen(
    vm: AttendoViewModel,
    onOpenHeatmap: () -> Unit
) {
    val snapshot by vm.snapshot.collectAsState()
    val profile by vm.studentProfile.collectAsState()
    val searchResults by vm.studentSearchResults.collectAsState()
    val localBugs by vm.localBugs.collectAsState()
    val isSyncing by vm.isSyncing.collectAsState()
    val context = LocalContext.current

    val syncKey = snapshot.optString("syncKey", "LOADING...")
    val lastSync = snapshot.optString("lastSync", "")

    var showRestoreDialog by remember { mutableStateOf(false) }
    var showProfileDialog by remember { mutableStateOf(false) }
    var showSearchDialog by remember { mutableStateOf(false) }
    var showBugDialog by remember { mutableStateOf(false) }
    var showChangelogDialog by remember { mutableStateOf(false) }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .cyberGridBackground(),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 108.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                ClassicShieldLogo(size = 44.dp, cornerRadius = 14.dp, fontSize = 22)
                Spacer(Modifier.width(12.dp))
                Column {
                    Text("Settings & Hub", color = CyberColors.TextPrimary, fontSize = 24.sp, fontWeight = FontWeight.Black)
                    Text("Rust Core v9.1.0 • Needle 3 Offline AI", color = CyberColors.NeonCyan, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        // 1. Account Security Code & Cloud Sync Card
        item {
            CyberBentoCard(borderColor = CyberColors.ElectricViolet.copy(alpha = 0.6f), glowColor = CyberColors.ElectricViolet) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    StatusPill("REAL-TIME CLOUD SYNC", CyberColors.Present)
                    if (lastSync.isNotBlank() && lastSync != "null") {
                        Text("Synced", color = CyberColors.TextMuted, fontSize = 11.sp)
                    }
                }
                Spacer(Modifier.height(10.dp))
                Text("YOUR ACCOUNT SECURITY CODE", color = CyberColors.TextMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
                Spacer(Modifier.height(6.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(CyberColors.ObsidianBg)
                        .border(1.dp, CyberColors.NeonCyan.copy(alpha = 0.4f), RoundedCornerShape(12.dp))
                        .padding(14.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = syncKey,
                        color = CyberColors.NeonCyan,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Black,
                        fontFamily = FontFamily.Monospace,
                        letterSpacing = 2.sp
                    )
                }
                Spacer(Modifier.height(12.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = {
                            val cb = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                            cb.setPrimaryClip(ClipData.newPlainText("Attendo Sync Key", syncKey))
                            vm.showBanner("Security Code copied: $syncKey")
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = CyberColors.GlassSurface)
                    ) { Text("📋 Copy", fontSize = 12.sp) }

                    Button(
                        onClick = { vm.backupToCloud() },
                        enabled = !isSyncing,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = CyberColors.ElectricViolet)
                    ) { Text(if (isSyncing) "Syncing..." else "☁️ Sync", fontSize = 12.sp) }

                    Button(
                        onClick = { showRestoreDialog = true },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = CyberColors.GlassElevated)
                    ) { Text("📥 Import", fontSize = 12.sp) }
                }
            }
        }

        // 2. Campus Profile & Social Search
        item {
            CyberBentoCard {
                Text("CAMPUS PROFILE & DIRECTORY", color = CyberColors.NeonCyan, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.2.sp)
                Spacer(Modifier.height(8.dp))
                if (profile != null) {
                    Text("${profile!!.optString("full_name")} (@${profile!!.optString("username")})", color = CyberColors.TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    Text("${profile!!.optString("college")} • ${profile!!.optString("academic_year")}", color = CyberColors.TextSecondary, fontSize = 12.sp)
                } else {
                    Text("Set up your student profile to appear on your campus leaderboard.", color = CyberColors.TextSecondary, fontSize = 12.sp)
                }
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = { showProfileDialog = true },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = CyberColors.ElectricViolet)
                    ) { Text(if (profile != null) "Edit Profile" else "Create Profile", fontSize = 12.sp) }

                    Button(
                        onClick = {
                            vm.searchStudents("")
                            showSearchDialog = true
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = CyberColors.GlassSurface)
                    ) { Text("🔍 Find Students", fontSize = 12.sp) }
                }
            }
        }

        // 3. Tools & Controls
        item {
            CyberBentoCard {
                Text("SYSTEM & TOOLS", color = CyberColors.NeonCyan, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.2.sp)
                Spacer(Modifier.height(8.dp))
                SettingsItemRow("📅 Monthly Calendar & Reports", "View spacious attendance calendar & export summary") { onOpenHeatmap() }
                HorizontalDivider(color = CyberColors.CyberBorder, modifier = Modifier.padding(vertical = 8.dp))
                SettingsItemRow("🔔 Schedule Daily Nudge", "8:30 PM attendance reminder via WorkManager") { vm.scheduleReminders(context) }
                HorizontalDivider(color = CyberColors.CyberBorder, modifier = Modifier.padding(vertical = 8.dp))
                SettingsItemRow("🐛 Report a Bug (${localBugs.length()} logged)", "Send diagnostics to Attendo backend") { showBugDialog = true }
                HorizontalDivider(color = CyberColors.CyberBorder, modifier = Modifier.padding(vertical = 8.dp))
                SettingsItemRow("📜 Changelog & Release Notes", "What's new in Attendo v9.0.1") { showChangelogDialog = true }
                HorizontalDivider(color = CyberColors.CyberBorder, modifier = Modifier.padding(vertical = 8.dp))
                SettingsItemRow("🚀 Check for App Updates", "Current: v9.1.0 (Build 910)") { vm.checkForUpdate(silent = false) }
            }
        }
    }

    // Import / Restore Dialog (Merge strictly keeps the NEW key!)
    if (showRestoreDialog) {
        var code by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showRestoreDialog = false },
            containerColor = CyberColors.GlassSurface,
            title = { Text("Import / Restore Backup", color = CyberColors.TextPrimary, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = code, onValueChange = { code = it }, label = { Text("ATND-XXXX-XXXX") }, singleLine = true)
                    Text("• Merge keeps your NEW active key ($syncKey) and backs up the merged data under it.\n• Replace overwrites local data and adopts the imported key.", color = CyberColors.TextSecondary, fontSize = 11.sp)
                }
            },
            confirmButton = {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = {
                            vm.restoreFromCloud(code, "merge")
                            showRestoreDialog = false
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = CyberColors.ElectricViolet)
                    ) { Text("Merge") }
                    Button(
                        onClick = {
                            vm.restoreFromCloud(code, "replace")
                            showRestoreDialog = false
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = CyberColors.Absent)
                    ) { Text("Replace") }
                }
            },
            dismissButton = { TextButton(onClick = { showRestoreDialog = false }) { Text("Cancel") } }
        )
    }

    if (showProfileDialog) {
        var fullName by remember { mutableStateOf(profile?.optString("full_name", "") ?: "") }
        var username by remember { mutableStateOf(profile?.optString("username", "") ?: "") }
        var college by remember { mutableStateOf(profile?.optString("college", "") ?: "") }
        var year by remember { mutableStateOf(profile?.optString("academic_year", "2nd Year") ?: "2nd Year") }
        var branch by remember { mutableStateOf(profile?.optString("branch", "CSE") ?: "CSE") }
        var isPublic by remember { mutableStateOf(profile?.optBoolean("is_public", true) ?: true) }

        AlertDialog(
            onDismissRequest = { showProfileDialog = false },
            containerColor = CyberColors.GlassSurface,
            title = { Text("Campus Profile", color = CyberColors.TextPrimary, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = fullName, onValueChange = { fullName = it }, label = { Text("Full Name") }, singleLine = true)
                    OutlinedTextField(value = username, onValueChange = { username = it }, label = { Text("Username") }, singleLine = true)
                    OutlinedTextField(value = college, onValueChange = { college = it }, label = { Text("College") }, singleLine = true)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(value = year, onValueChange = { year = it }, label = { Text("Year") }, modifier = Modifier.weight(1f), singleLine = true)
                        OutlinedTextField(value = branch, onValueChange = { branch = it }, label = { Text("Branch") }, modifier = Modifier.weight(1f), singleLine = true)
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Switch(checked = isPublic, onCheckedChange = { isPublic = it })
                        Spacer(Modifier.width(8.dp))
                        Text("Visible on Public Search", color = CyberColors.TextSecondary, fontSize = 12.sp)
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        vm.saveStudentProfile(fullName, username, college, year, branch, isPublic)
                        showProfileDialog = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = CyberColors.ElectricViolet)
                ) { Text("Save Profile") }
            },
            dismissButton = { TextButton(onClick = { showProfileDialog = false }) { Text("Cancel") } }
        )
    }

    if (showSearchDialog) {
        var q by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showSearchDialog = false },
            containerColor = CyberColors.GlassSurface,
            title = { Text("Campus Directory", color = CyberColors.TextPrimary, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        OutlinedTextField(value = q, onValueChange = { q = it }, label = { Text("Name or username") }, modifier = Modifier.weight(1f), singleLine = true)
                        Spacer(Modifier.width(6.dp))
                        Button(onClick = { vm.searchStudents(q) }) { Text("Go") }
                    }
                    for (i in 0 until minOf(searchResults.length(), 6)) {
                        val st = searchResults.getJSONObject(i)
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Column {
                                Text(st.optString("full_name"), color = CyberColors.TextPrimary, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                Text("@${st.optString("username")} • ${st.optString("college")}", color = CyberColors.TextMuted, fontSize = 11.sp)
                            }
                            Text("${st.optInt("overall_percent")}%", color = CyberColors.NeonCyan, fontWeight = FontWeight.Black)
                        }
                    }
                }
            },
            confirmButton = { TextButton(onClick = { showSearchDialog = false }) { Text("Close") } }
        )
    }

    if (showBugDialog) {
        var title by remember { mutableStateOf("") }
        var desc by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showBugDialog = false },
            containerColor = CyberColors.GlassSurface,
            title = { Text("Report Bug", color = CyberColors.TextPrimary, fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = title, onValueChange = { title = it }, label = { Text("Summary") }, singleLine = true)
                    OutlinedTextField(value = desc, onValueChange = { desc = it }, label = { Text("Details") }, minLines = 2)
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (title.isNotBlank()) {
                            vm.submitBugReport(title, desc, "general", "medium", "")
                            showBugDialog = false
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = CyberColors.ElectricViolet)
                ) { Text("Submit") }
            },
            dismissButton = { TextButton(onClick = { showBugDialog = false }) { Text("Cancel") } }
        )
    }

    if (showChangelogDialog) {
        AlertDialog(
            onDismissRequest = { showChangelogDialog = false },
            containerColor = CyberColors.GlassSurface,
            title = { Text("Attendo v9.0.1 Changelog", color = CyberColors.TextPrimary, fontWeight = FontWeight.Bold) },
            text = {
                Text(
                    "• Clean plain dark Obsidian background (removed square grid)\n" +
                    "• Refined health-colored percentage gauges (Emerald / Amber / Crimson)\n" +
                    "• Spacious Monthly Attendance Calendar replacing the tiny heatmap\n" +
                    "• In-App APK Auto-Updater with live progress bar & 1-tap install\n" +
                    "• Powered by Rust Native Core (attendo-core) + Jetpack Compose",
                    color = CyberColors.TextSecondary,
                    fontSize = 12.sp,
                    lineHeight = 18.sp
                )
            },
            confirmButton = { TextButton(onClick = { showChangelogDialog = false }) { Text("Awesome", color = CyberColors.NeonCyan) } }
        )
    }
}

@Composable
private fun SettingsItemRow(title: String, subtitle: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(title, color = CyberColors.TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            Text(subtitle, color = CyberColors.TextMuted, fontSize = 11.sp)
        }
        Text("›", color = CyberColors.NeonCyan, fontSize = 20.sp, fontWeight = FontWeight.Bold)
    }
}
