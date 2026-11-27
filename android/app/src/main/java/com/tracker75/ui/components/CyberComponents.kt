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
import androidx.compose.ui.draw.drawBehind
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
 * Classic 7.0.0 3D Shield Emblem ('A') preserved across the Obsidian Cyber-Grid UI.
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
 * Obsidian Glass Bento Card with spring press physics & subtle cyber border.
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
        targetValue = if (pressed && onClick != null) 0.97f else 1f,
        animationSpec = spring(dampingRatio = 0.65f, stiffness = 450f),
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
        shadowElevation = if (glowColor != Color.Transparent) 8.dp else 0.dp
    ) {
        Column(
            modifier = Modifier
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            glowColor.copy(alpha = 0.08f),
                            CyberColors.GlassCard
                        )
                    )
                )
                .padding(16.dp),
            content = content
        )
    }
}

/**
 * Animated Neon Cyber Gauge for attendance percentage.
 */
@Composable
fun CyberAttendanceGauge(
    percent: Int,
    targetPercent: Int = 75,
    size: Dp = 112.dp,
    strokeWidth: Dp = 10.dp
) {
    val animatedSweep by animateFloatAsState(
        targetValue = (percent.coerceIn(0, 100) / 100f) * 360f,
        animationSpec = spring(dampingRatio = 0.75f, stiffness = 120f),
        label = "gaugeSweep"
    )

    val ringColor = when {
        percent >= targetPercent -> CyberColors.NeonCyan
        percent >= targetPercent - 10 -> CyberColors.Cancelled
        else -> CyberColors.Absent
    }

    Box(modifier = Modifier.size(size), contentAlignment = Alignment.Center) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val strokePx = strokeWidth.toPx()
            val arcSize = Size(this.size.width - strokePx, this.size.height - strokePx)
            val topLeft = Offset(strokePx / 2f, strokePx / 2f)

            // Track
            drawArc(
                color = CyberColors.CyberBorder.copy(alpha = 0.6f),
                startAngle = 0f,
                sweepAngle = 360f,
                useCenter = false,
                topLeft = topLeft,
                size = arcSize,
                style = Stroke(width = strokePx, cap = StrokeCap.Round)
            )

            // Active Neon Gradient Arc
            drawArc(
                brush = Brush.sweepGradient(
                    colors = listOf(
                        CyberColors.ElectricViolet,
                        ringColor,
                        CyberColors.NeonCyan,
                        CyberColors.ElectricViolet
                    )
                ),
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
                color = CyberColors.TextPrimary,
                fontSize = 24.sp,
                fontWeight = FontWeight.Black
            )
            Text(
                text = "TARGET $targetPercent%",
                color = CyberColors.TextMuted,
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.8.sp
            )
        }
    }
}

/**
 * Subtle Cyber-Grid background painter for screens.
 */
fun Modifier.cyberGridBackground(): Modifier = this.drawBehind {
    drawRect(CyberColors.ObsidianBg)
    val step = 36.dp.toPx()
    val lineColor = Color(0xFF141428)
    var x = 0f
    while (x < size.width) {
        drawLine(lineColor, Offset(x, 0f), Offset(x, size.height), strokeWidth = 1f)
        x += step
    }
    var y = 0f
    while (y < size.height) {
        drawLine(lineColor, Offset(0f, y), Offset(size.width, y), strokeWidth = 1f)
        y += step
    }
}

@Composable
fun StatusPill(label: String, color: Color) {
    Box(
        modifier = Modifier
            .clip(CircleShape)
            .background(color.copy(alpha = 0.16f))
            .border(1.dp, color.copy(alpha = 0.5f), CircleShape)
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
