package com.tracker75.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tracker75.ui.theme.CyberColors

/**
 * Classic 7.0.0 3D Shield Emblem ('A') preserved cleanly.
 */
@Composable
fun ClassicShieldLogo(
    size: Dp = 40.dp,
    cornerRadius: Dp = 12.dp,
    fontSize: Int = 20,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .size(size)
            .clip(RoundedCornerShape(cornerRadius))
            .background(
                Brush.linearGradient(
                    colors = listOf(CyberColors.ElectricViolet, CyberColors.VioletDeep)
                )
            )
            .border(1.8.dp, CyberColors.NeonCyan, RoundedCornerShape(cornerRadius)),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = "A",
            color = Color.White,
            fontSize = fontSize.sp,
            fontWeight = FontWeight.Black
        )
    }
}

/**
 * Clean Obsidian Glass Bento Card with smooth spring press physics.
 */
@Composable
fun CyberBentoCard(
    modifier: Modifier = Modifier,
    borderColor: Color = CyberColors.CyberBorder,
    glowColor: Color = Color.Transparent,
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit
) {
    val haptic = LocalHapticFeedback.current
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()

    val scale by animateFloatAsState(
        targetValue = if (pressed && onClick != null) 0.975f else 1f,
        animationSpec = spring(dampingRatio = 0.7f, stiffness = 420f),
        label = "bentoScale"
    )

    Surface(
        modifier = modifier
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
            }
            .then(
                if (onClick != null) {
                    Modifier.clickable(
                        interactionSource = interaction,
                        indication = null
                    ) {
                        haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                        onClick()
                    }
                } else Modifier
            ),
        shape = RoundedCornerShape(20.dp),
        color = CyberColors.GlassCard,
        border = BorderStroke(1.dp, borderColor),
        shadowElevation = if (glowColor != Color.Transparent) 6.dp else 0.dp
    ) {
        Column(
            modifier = Modifier
                .background(
                    if (glowColor != Color.Transparent) {
                        Brush.verticalGradient(
                            colors = listOf(
                                glowColor.copy(alpha = 0.06f),
                                CyberColors.GlassCard
                            )
                        )
                    } else {
                        Brush.verticalGradient(listOf(CyberColors.GlassCard, CyberColors.GlassCard))
                    }
                )
                .padding(16.dp),
            content = content
        )
    }
}

/**
 * Clean, high-contrast Attendance Ring Gauge with health-based color (Emerald / Amber / Crimson).
 */
@Composable
fun CyberAttendanceGauge(
    percent: Int,
    targetPercent: Int = 75,
    size: Dp = 108.dp,
    strokeWidth: Dp = 9.dp
) {
    val animatedSweep by animateFloatAsState(
        targetValue = (percent.coerceIn(0, 100) / 100f) * 360f,
        animationSpec = spring(dampingRatio = 0.78f, stiffness = 130f),
        label = "gaugeSweep"
    )

    val ringColor = when {
        percent >= targetPercent -> CyberColors.Present
        percent >= targetPercent - 10 -> CyberColors.Cancelled
        else -> CyberColors.Absent
    }

    Box(modifier = Modifier.size(size), contentAlignment = Alignment.Center) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val strokePx = strokeWidth.toPx()
            val arcSize = Size(this.size.width - strokePx, this.size.height - strokePx)
            val topLeft = Offset(strokePx / 2f, strokePx / 2f)

            // Subtle dark track
            drawArc(
                color = Color(0xFF1A1A28),
                startAngle = 0f,
                sweepAngle = 360f,
                useCenter = false,
                topLeft = topLeft,
                size = arcSize,
                style = Stroke(width = strokePx, cap = StrokeCap.Round)
            )

            // Clean solid health-colored arc
            drawArc(
                color = ringColor,
                startAngle = -90f,
                sweepAngle = animatedSweep,
                useCenter = false,
                topLeft = topLeft,
                size = arcSize,
                style = Stroke(width = strokePx, cap = StrokeCap.Round)
            )
        }

        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "$percent%",
                color = ringColor,
                fontSize = 23.sp,
                fontWeight = FontWeight.Black
            )
            Text(
                text = "GOAL $targetPercent%",
                color = CyberColors.TextMuted,
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.8.sp
            )
        }
    }
}

/**
 * Clean plain Obsidian background (no square grid lines).
 */
fun Modifier.cyberGridBackground(): Modifier = this.background(CyberColors.ObsidianBg)

@Composable
fun StatusPill(label: String, color: Color) {
    Box(
        modifier = Modifier
            .clip(CircleShape)
            .background(color.copy(alpha = 0.14f))
            .border(1.dp, color.copy(alpha = 0.45f), CircleShape)
            .padding(horizontal = 10.dp, vertical = 4.dp)
    ) {
        Text(
            text = label.uppercase(),
            color = color,
            fontSize = 10.sp,
            fontWeight = FontWeight.ExtraBold,
            letterSpacing = 0.8.sp
        )
    }
}
