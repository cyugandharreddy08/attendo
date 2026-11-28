package com.tracker75.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

object AttendoColors {
    val ObsidianCanvas = Color(0xFF07090F)
    val DeepSurface = Color(0xFF0D111A)
    val ElevatedSurface = Color(0xFF141926)

    // True multi-stop glassmorphism tokens
    val GlassTop = Color(0x20FFFFFF)
    val GlassMid = Color(0x10FFFFFF)
    val GlassBottom = Color(0x06FFFFFF)
    val GlassBorderTop = Color(0x44FFFFFF)
    val GlassBorderBottom = Color(0x0EFFFFFF)

    // Refined Obsidian Aurora Palette
    val Indigo = Color(0xFF6366F1)
    val IndigoLight = Color(0xFF818CF8)
    val Violet = Color(0xFFA855F7)
    val Cyan = Color(0xFF22D3EE)
    val Emerald = Color(0xFF10B981)
    val Amber = Color(0xFFF59E0B)
    val Rose = Color(0xFFF43F5E)

    // Typography
    val TextPrimary = Color(0xFFF8FAFC)
    val TextSecondary = Color(0xFF94A3B8)
    val TextMuted = Color(0xFF64748B)
}

private val AttendoDarkScheme = darkColorScheme(
    primary = AttendoColors.IndigoLight,
    onPrimary = Color.White,
    secondary = AttendoColors.Cyan,
    onSecondary = AttendoColors.ObsidianCanvas,
    tertiary = AttendoColors.Emerald,
    background = AttendoColors.ObsidianCanvas,
    surface = AttendoColors.DeepSurface,
    surfaceVariant = AttendoColors.ElevatedSurface,
    onBackground = AttendoColors.TextPrimary,
    onSurface = AttendoColors.TextPrimary,
    onSurfaceVariant = AttendoColors.TextSecondary,
    error = AttendoColors.Rose,
    outline = AttendoColors.GlassBorderTop
)

val AttendoTypography = Typography(
    displaySmall = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.ExtraBold,
        fontSize = 32.sp,
        letterSpacing = (-0.8).sp,
        fontFeatureSettings = "tnum"
    ),
    headlineSmall = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 22.sp,
        letterSpacing = (-0.4).sp,
        fontFeatureSettings = "tnum"
    ),
    titleMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 16.sp,
        letterSpacing = (-0.2).sp
    ),
    bodyMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp,
        lineHeight = 20.sp
    ),
    labelMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 11.sp,
        letterSpacing = 0.4.sp,
        fontFeatureSettings = "tnum"
    )
)

@Composable
fun AttendoTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = AttendoDarkScheme,
        typography = AttendoTypography,
        content = content
    )
}
