package com.tracker75.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

object CyberColors {
    val ObsidianBg = Color(0xFF05050A)
    val GlassCard = Color(0xFF0D0D18)
    val GlassSurface = Color(0xFF141424)
    val GlassElevated = Color(0xFF1C1C32)
    val CyberBorder = Color(0xFF282846)
    val NeonCyan = Color(0xFF06B6D4)
    val NeonCyanGlow = Color(0x4406B6D4)
    val ElectricViolet = Color(0xFF8B5CF6)
    val VioletBright = Color(0xFFA855F7)
    val VioletDeep = Color(0xFF7C3AED)
    val VioletGlow = Color(0x408B5CF6)
    val TextPrimary = Color(0xFFF4F4FF)
    val TextSecondary = Color(0xFF9494B8)
    val TextMuted = Color(0xFF5C5C7A)

    val Present = Color(0xFF22C55E)
    val Absent = Color(0xFFEF4444)
    val Holiday = Color(0xFF60A5FA)
    val Cancelled = Color(0xFFF59E0B)
    val Shifted = Color(0xFFEC4899)
}

private val AttendoDarkScheme = darkColorScheme(
    primary = CyberColors.ElectricViolet,
    secondary = CyberColors.NeonCyan,
    tertiary = CyberColors.Shifted,
    background = CyberColors.ObsidianBg,
    surface = CyberColors.GlassCard,
    surfaceVariant = CyberColors.GlassSurface,
    onPrimary = Color.White,
    onSecondary = Color.Black,
    onBackground = CyberColors.TextPrimary,
    onSurface = CyberColors.TextPrimary,
    onSurfaceVariant = CyberColors.TextSecondary,
    outline = CyberColors.CyberBorder,
)

@Composable
fun AttendoTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = AttendoDarkScheme,
        content = content
    )
}
