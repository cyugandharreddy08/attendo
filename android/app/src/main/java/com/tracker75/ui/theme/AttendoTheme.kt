package com.tracker75.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/**
 * Exact Material 3 Expressive design tokens from the Attendo Tailwind/Stitch spec.
 */
object CyberColors {
    // Surfaces
    val ObsidianBg = Color(0xFF090B10)          // surface / background
    val SurfaceDim = Color(0xFF06070B)          // surface-container-lowest / surface-dim
    val GlassCard = Color(0xFF11141D)           // surface-container-low
    val GlassSurface = Color(0xFF171B26)        // surface-container
    val GlassElevated = Color(0xFF1F2433)       // surface-container-high
    val SurfaceHighest = Color(0xFF282E40)      // surface-container-highest
    val CyberBorder = Color(0xFF232838)         // outline-variant
    val Outline = Color(0xFF6E768E)             // outline

    // Brand & Accents
    val Primary = Color(0xFFC4B5FD)             // primary
    val OnPrimary = Color(0xFF2E1065)
    val ElectricViolet = Color(0xFF7C3AED)      // primary-container
    val OnPrimaryContainer = Color(0xFFF5F3FF)
    val VioletBright = Color(0xFFC4B5FD)
    val VioletDeep = Color(0xFF6D28D9)

    val NeonCyan = Color(0xFF38BDF8)            // tertiary
    val TertiaryContainer = Color(0xFF0C4A6E)
    val OnTertiaryContainer = Color(0xFFBAE6FD)

    // Semantic Status
    val Present = Color(0xFF34D399)             // secondary (emerald)
    val SecondaryContainer = Color(0xFF064E3B)
    val OnSecondaryContainer = Color(0xFF6EE7B7)

    val Cancelled = Color(0xFFFBBF24)           // warning (amber)
    val WarningContainer = Color(0xFF451A03)
    val OnWarningContainer = Color(0xFFFDE68A)

    val Absent = Color(0xFFFB7185)              // error (rose)
    val ErrorContainer = Color(0xFF4C0519)
    val OnErrorContainer = Color(0xFFFECDD3)

    val Holiday = Color(0xFF38BDF8)
    val Shifted = Color(0xFFC4B5FD)

    // Typography
    val TextPrimary = Color(0xFFF2F4F8)         // on-surface
    val TextSecondary = Color(0xFF9CA3B8)       // on-surface-variant
    val TextMuted = Color(0xFF6E768E)           // outline
}

private val AttendoDarkScheme = darkColorScheme(
    primary = CyberColors.Primary,
    onPrimary = CyberColors.OnPrimary,
    primaryContainer = CyberColors.ElectricViolet,
    onPrimaryContainer = CyberColors.OnPrimaryContainer,
    secondary = CyberColors.Present,
    secondaryContainer = CyberColors.SecondaryContainer,
    onSecondaryContainer = CyberColors.OnSecondaryContainer,
    tertiary = CyberColors.NeonCyan,
    background = CyberColors.ObsidianBg,
    surface = CyberColors.ObsidianBg,
    surfaceVariant = CyberColors.GlassSurface,
    onBackground = CyberColors.TextPrimary,
    onSurface = CyberColors.TextPrimary,
    onSurfaceVariant = CyberColors.TextSecondary,
    outline = CyberColors.Outline,
    outlineVariant = CyberColors.CyberBorder,
    error = CyberColors.Absent,
    errorContainer = CyberColors.ErrorContainer,
    onErrorContainer = CyberColors.OnErrorContainer,
)

@Composable
fun AttendoTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = AttendoDarkScheme,
        content = content
    )
}
