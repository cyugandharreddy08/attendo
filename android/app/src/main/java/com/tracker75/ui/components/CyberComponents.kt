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
 * Classic 7.0.0 Shield Emblem ('A') styled with Material 3 Expressive primary-container.
 */
@Composable
fun ClassicShieldLogo(
    size: Dp = 38.dp,
    cornerRadius: Dp = 12.dp,
    fontSize: Int = 19,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .size(size)
            .clip(RoundedCornerShape(cornerRadius))
            .background(CyberColors.ElectricViolet)
            .border(1.5.dp, CyberColors.Primary.copy(alpha = 0.6f), RoundedCornerShape(cornerRadius)),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = "A",
            color = CyberColors.OnPrimaryContainer,
            fontSize = fontSize.sp,
            fontWeight = FontWeight.Black
        )
    }
}

/**
 * Material 3 Expressive Elevated Card (surface-container-low #11141D + outline-variant #232838).
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
        targetValue = if (pressed && onClick != null) 0.98f else 1f,
        animationSpec = tween(durationMillis = 120),
        label = "cardScale"
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
        border = BorderStroke(1.dp, borderColor)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            content = content
        )
    }
}

/**
 * Circular SVG-style Weighted Attendance Gauge matching the Material 3 Expressive HTML spec.
 */
@Composable
fun CyberAttendanceGauge(
    percent: Int,
    targetPercent: Int = 75,
    size: Dp = 96.dp,
    strokeWidth: Dp = 8.dp
) {
    val animatedSweep by animateFloatAsState(
        targetValue = (percent.coerceIn(0, 100) / 100f) * 360f,
        animationSpec = spring(dampingRatio = 0.8f, stiffness = 140f),
        label = "gaugeSweep"
    )

    val ringColor = when {
        percent >= targetPercent -> CyberColors.Present
        percent >= targetPercent - 10 -> CyberColors.Cancelled
        else -> CyberColors.Absent
    }
    val delta = percent - targetPercent
    val deltaText = if (delta >= 0) "+$delta%" else "$delta%"

    Box(modifier = Modifier.size(size), contentAlignment = Alignment.Center) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val strokePx = strokeWidth.toPx()
            val arcSize = Size(this.size.width - strokePx, this.size.height - strokePx)
            val topLeft = Offset(strokePx / 2f, strokePx / 2f)

            drawArc(
                color = CyberColors.SurfaceHighest,
                startAngle = 0f,
                sweepAngle = 360f,
                useCenter = false,
                topLeft = topLeft,
                size = arcSize,
                style = Stroke(width = strokePx, cap = StrokeCap.Round)
            )

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
                fontSize = 21.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = deltaText,
                color = CyberColors.TextSecondary,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}

/**
 * Horizontal progress bar with vertical 75% target marker line matching the HTML spec.
 */
@Composable
fun TargetProgressBar(
    percent: Int,
    targetPercent: Int = 75,
    modifier: Modifier = Modifier
) {
    val barColor = when {
        percent >= targetPercent -> CyberColors.Present
        percent >= targetPercent - 10 -> CyberColors.Cancelled
        else -> CyberColors.Absent
    }
    val fillFraction = (percent.coerceIn(0, 100) / 100f)
    val targetFraction = (targetPercent.coerceIn(1, 99) / 100f)

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(6.dp)
            .clip(CircleShape)
            .background(CyberColors.SurfaceHighest)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth(fillFraction)
                .fillMaxHeight()
                .clip(CircleShape)
                .background(barColor)
        )
        // 75% Target Marker Tick
        Box(
            modifier = Modifier
                .fillMaxWidth(targetFraction)
                .fillMaxHeight(),
            contentAlignment = Alignment.CenterEnd
        ) {
            Box(
                modifier = Modifier
                    .width(2.dp)
                    .fillMaxHeight()
                    .background(CyberColors.TextPrimary.copy(alpha = 0.75f))
            )
        }
    }
}

fun Modifier.cyberGridBackground(): Modifier = this.background(CyberColors.ObsidianBg)

@Composable
fun StatusPill(label: String, color: Color, containerColor: Color = color.copy(alpha = 0.16f)) {
    Box(
        modifier = Modifier
            .clip(CircleShape)
            .background(containerColor)
            .padding(horizontal = 10.dp, vertical = 4.dp)
    ) {
        Text(
            text = label,
            color = color,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold
        )
    }
}
