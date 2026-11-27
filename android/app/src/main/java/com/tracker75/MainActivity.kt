package com.tracker75

import android.graphics.Color as AndroidColor
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tracker75.ui.screens.*
import com.tracker75.ui.theme.AttendoTheme
import com.tracker75.ui.theme.CyberColors
import com.tracker75.viewmodel.AttendoViewModel
import kotlinx.coroutines.delay

enum class CyberTab(val label: String, val icon: ImageVector) {
    Timetable("Schedule", Icons.Rounded.CalendarToday),
    Subjects("Subjects", Icons.Rounded.MenuBook),
    ProxyAI("Proxy AI", Icons.Rounded.AutoAwesome),
    Tasks("Tasks", Icons.Rounded.CheckCircleOutline),
    Hub("Hub", Icons.Rounded.Tune)
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(AndroidColor.parseColor("#05050A")),
            navigationBarStyle = SystemBarStyle.dark(AndroidColor.parseColor("#05050A"))
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
    var activeTab by remember { mutableStateOf(CyberTab.Timetable) }
    var showHeatmapOverlay by remember { mutableStateOf(false) }
    val banner by vm.bannerMessage.collectAsState()

    LaunchedEffect(banner) {
        if (banner != null) {
            delay(2800)
            vm.clearBanner()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(CyberColors.ObsidianBg)
            .windowInsetsPadding(WindowInsets.systemBars)
    ) {
        if (showSplash) {
            CyberSplashScreen(onFinished = { showSplash = false })
        } else if (showHeatmapOverlay) {
            CalendarHeatmapScreen(
                vm = vm,
                onBack = { showHeatmapOverlay = false }
            )
        } else {
            Box(modifier = Modifier.fillMaxSize()) {
                AnimatedContent(
                    targetState = activeTab,
                    transitionSpec = { fadeIn() togetherWith fadeOut() },
                    label = "tabTransition"
                ) { tab ->
                    when (tab) {
                        CyberTab.Timetable -> TimetableScreen(
                            vm = vm,
                            onOpenProxyAI = { activeTab = CyberTab.ProxyAI },
                            onOpenHeatmap = { showHeatmapOverlay = true }
                        )
                        CyberTab.Subjects -> SubjectsScreen(vm = vm)
                        CyberTab.ProxyAI -> ProxyAIScreen(vm = vm)
                        CyberTab.Tasks -> TodoScreen(vm = vm)
                        CyberTab.Hub -> SettingsAndHubScreen(
                            vm = vm,
                            onOpenHeatmap = { showHeatmapOverlay = true }
                        )
                    }
                }

                // Floating Obsidian Glass Cyber Dock
                FloatingCyberDock(
                    activeTab = activeTab,
                    onSelect = { activeTab = it },
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(horizontal = 14.dp, vertical = 12.dp)
                )
            }
        }

        // Floating Notification Banner
        AnimatedVisibility(
            visible = banner != null,
            enter = slideInVertically(initialOffsetY = { -it }) + fadeIn(),
            exit = slideOutVertically(targetOffsetY = { -it }) + fadeOut(),
            modifier = Modifier
                .align(Alignment.TopCenter)
                .padding(horizontal = 16.dp, vertical = 12.dp)
        ) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(14.dp))
                    .background(CyberColors.GlassElevated)
                    .border(1.dp, CyberColors.NeonCyan.copy(alpha = 0.7f), RoundedCornerShape(14.dp))
                    .padding(horizontal = 16.dp, vertical = 10.dp)
            ) {
                Text(banner ?: "", color = CyberColors.TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun FloatingCyberDock(
    activeTab: CyberTab,
    onSelect: (CyberTab) -> Unit,
    modifier: Modifier = Modifier
) {
    val haptic = LocalHapticFeedback.current
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(22.dp))
            .background(CyberColors.GlassCard.copy(alpha = 0.96f))
            .border(1.dp, CyberColors.ElectricViolet.copy(alpha = 0.4f), RoundedCornerShape(22.dp))
            .padding(horizontal = 6.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.CenterVertically
    ) {
        CyberTab.entries.forEach { tab ->
            val selected = tab == activeTab
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(14.dp))
                    .background(if (selected) CyberColors.ElectricViolet.copy(alpha = 0.22f) else Color.Transparent)
                    .clickable {
                        haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                        onSelect(tab)
                    }
                    .padding(vertical = 6.dp)
            ) {
                Icon(
                    imageVector = tab.icon,
                    contentDescription = tab.label,
                    tint = if (selected) CyberColors.NeonCyan else CyberColors.TextMuted,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = tab.label,
                    color = if (selected) CyberColors.TextPrimary else CyberColors.TextMuted,
                    fontSize = 10.sp,
                    fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium
                )
            }
        }
    }
}
