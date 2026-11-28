package com.tracker75

import android.graphics.Color as AndroidColor
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.*
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.MenuBook
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tracker75.ui.components.AuroraBackdrop
import com.tracker75.ui.components.GlassCard
import com.tracker75.ui.components.physicsPressable
import com.tracker75.ui.screens.*
import com.tracker75.ui.theme.AttendoColors
import com.tracker75.ui.theme.AttendoTheme
import com.tracker75.viewmodel.AttendoViewModel
import kotlinx.coroutines.delay

enum class AttendoTab(val label: String, val icon: ImageVector) {
    Timetable("Schedule", Icons.Rounded.CalendarToday),
    Subjects("Subjects", Icons.AutoMirrored.Rounded.MenuBook),
    ProxyAI("Copilot", Icons.Rounded.AutoAwesome),
    Tasks("Tasks", Icons.Rounded.CheckCircleOutline),
    Hub("Hub", Icons.Rounded.Tune)
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(AndroidColor.parseColor("#07090F")),
            navigationBarStyle = SystemBarStyle.dark(AndroidColor.parseColor("#07090F"))
        )
        setContent {
            AttendoTheme {
                AttendoRoot()
            }
        }
    }
}

@Composable
private fun AttendoRoot(vm: AttendoViewModel = viewModel()) {
    var showSplash by remember { mutableStateOf(true) }
    var activeTab by remember { mutableStateOf(AttendoTab.Timetable) }
    var showCalendarOverlay by remember { mutableStateOf(false) }
    val banner by vm.bannerMessage.collectAsState()
    val updateInfo by vm.updateInfo.collectAsState()
    val downloadProgress by vm.downloadProgress.collectAsState()
    val context = LocalContext.current

    LaunchedEffect(banner) {
        if (banner != null) {
            delay(2800)
            vm.clearBanner()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(AttendoColors.ObsidianCanvas)
    ) {
        AuroraBackdrop()

        Box(
            modifier = Modifier
                .fillMaxSize()
                .windowInsetsPadding(WindowInsets.systemBars)
        ) {
            if (showSplash) {
                CyberSplashScreen(onFinished = { showSplash = false })
            } else if (showCalendarOverlay) {
                CalendarHeatmapScreen(
                    vm = vm,
                    onBack = { showCalendarOverlay = false }
                )
            } else {
                Box(modifier = Modifier.fillMaxSize()) {
                    AnimatedContent(
                        targetState = activeTab,
                        transitionSpec = {
                            (fadeIn(tween(220)) + scaleIn(
                                initialScale = 0.97f,
                                animationSpec = spring(dampingRatio = 0.84f, stiffness = 360f)
                            )) togetherWith fadeOut(tween(140))
                        },
                        label = "tabTransition"
                    ) { tab ->
                        when (tab) {
                            AttendoTab.Timetable -> TimetableScreen(
                                vm = vm,
                                onOpenCalendar = { showCalendarOverlay = true }
                            )
                            AttendoTab.Subjects -> SubjectsScreen(
                                vm = vm,
                                onOpenVault = { activeTab = AttendoTab.Hub }
                            )
                            AttendoTab.ProxyAI -> ProxyAIScreen(vm = vm)
                            AttendoTab.Tasks -> TodoScreen(vm = vm)
                            AttendoTab.Hub -> SettingsAndHubScreen(vm = vm)
                        }
                    }

                    FloatingGlassDock(
                        activeTab = activeTab,
                        onSelect = { activeTab = it },
                        modifier = Modifier
                            .align(Alignment.BottomCenter)
                            .padding(horizontal = 16.dp, vertical = 12.dp)
                    )
                }
            }

            // Floating Glass Toast Banner
            AnimatedVisibility(
                visible = banner != null,
                enter = slideInVertically { -it } + fadeIn(),
                exit = slideOutVertically { -it } + fadeOut(),
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .padding(horizontal = 16.dp, vertical = 10.dp)
            ) {
                GlassCard(
                    cornerRadius = 18.dp,
                    accentColor = AttendoColors.Cyan,
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Rounded.Bolt,
                            contentDescription = null,
                            tint = AttendoColors.Cyan,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = banner ?: "",
                            color = AttendoColors.TextPrimary,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }

            // OTA Update Dialog
            updateInfo?.let { info ->
                val ver = info.optString("latestVersion", "")
                val notes = info.optString("releaseNotes", "")
                val url = info.optString("apkUrl", "")
                val patchUrl = info.optString("patchUrl", "").takeIf { it.isNotBlank() }
                val patchSize = info.optLong("patchSizeBytes", 0L)
                val sizeLabel = if (patchUrl != null && patchSize > 0) {
                    val mb = patchSize / (1024.0 * 1024.0)
                    String.format("Delta Update (%.1f MB)", mb)
                } else {
                    "Update Now"
                }

                AlertDialog(
                    onDismissRequest = { if (downloadProgress == null) vm.dismissUpdate() },
                    containerColor = AttendoColors.ElevatedSurface,
                    title = {
                        Text(
                            "Attendo v$ver Available",
                            color = AttendoColors.TextPrimary,
                            fontWeight = FontWeight.Bold
                        )
                    },
                    text = {
                        Column {
                            Text(notes, color = AttendoColors.TextSecondary, fontSize = 13.sp)
                            if (downloadProgress != null) {
                                Spacer(modifier = Modifier.height(14.dp))
                                LinearProgressIndicator(
                                    progress = { (downloadProgress ?: 0) / 100f },
                                    modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)),
                                    color = AttendoColors.Cyan,
                                    trackColor = Color(0x22FFFFFF)
                                )
                                Spacer(modifier = Modifier.height(6.dp))
                                Text(
                                    "Patching & installing: ${downloadProgress}%",
                                    color = AttendoColors.Cyan,
                                    fontSize = 12.sp
                                )
                            }
                        }
                    },
                    confirmButton = {
                        Button(
                            onClick = { vm.startInAppUpdate(context, url, patchUrl) },
                            enabled = downloadProgress == null && url.isNotBlank(),
                            colors = ButtonDefaults.buttonColors(containerColor = AttendoColors.Indigo)
                        ) {
                            Text(if (downloadProgress != null) "Updating..." else sizeLabel)
                        }
                    },
                    dismissButton = {
                        if (downloadProgress == null) {
                            TextButton(onClick = { vm.dismissUpdate() }) {
                                Text("Later", color = AttendoColors.TextSecondary)
                            }
                        }
                    }
                )
            }
        }
    }
}

@Composable
private fun FloatingGlassDock(
    activeTab: AttendoTab,
    onSelect: (AttendoTab) -> Unit,
    modifier: Modifier = Modifier
) {
    val tabs = AttendoTab.entries
    val shape = RoundedCornerShape(28.dp)

    BoxWithConstraints(
        modifier = modifier
            .fillMaxWidth()
            .height(66.dp)
            .clip(shape)
            .background(
                Brush.verticalGradient(
                    colors = listOf(Color(0x261A2033), Color(0xE60B0F1A))
                ),
                shape
            )
            .border(
                0.9.dp,
                Brush.linearGradient(
                    colors = listOf(AttendoColors.GlassBorderTop, AttendoColors.GlassBorderBottom)
                ),
                shape
            )
            .padding(6.dp)
    ) {
        val tabWidth = maxWidth / tabs.size
        val indicatorOffset by animateDpAsState(
            targetValue = tabWidth * activeTab.ordinal,
            animationSpec = spring(
                dampingRatio = Spring.DampingRatioMediumBouncy,
                stiffness = Spring.StiffnessMedium
            ),
            label = "dockIndicator"
        )

        // Sliding Glass Pill
        Box(
            modifier = Modifier
                .offset(x = indicatorOffset)
                .width(tabWidth)
                .fillMaxHeight()
                .clip(RoundedCornerShape(22.dp))
                .background(
                    Brush.linearGradient(
                        colors = listOf(
                            AttendoColors.Indigo.copy(alpha = 0.34f),
                            AttendoColors.Cyan.copy(alpha = 0.18f)
                        )
                    )
                )
                .border(
                    0.8.dp,
                    AttendoColors.IndigoLight.copy(alpha = 0.55f),
                    RoundedCornerShape(22.dp)
                )
        )

        Row(modifier = Modifier.fillMaxSize()) {
            tabs.forEach { tab ->
                val selected = tab == activeTab
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .physicsPressable(scaleDown = 0.91f) { onSelect(tab) },
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Icon(
                        imageVector = tab.icon,
                        contentDescription = tab.label,
                        tint = if (selected) Color.White else AttendoColors.TextSecondary,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = tab.label,
                        color = if (selected) Color.White else AttendoColors.TextMuted,
                        fontSize = 10.sp,
                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                        maxLines = 1
                    )
                }
            }
        }
    }
}
