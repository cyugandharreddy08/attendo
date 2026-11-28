package com.tracker75.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.*
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tracker75.ui.theme.AttendoColors

object GlassMotion {
    val BouncySpring = spring<Float>(
        dampingRatio = 0.62f,
        stiffness = 420f
    )
    val SnappySpring = spring<Float>(
        dampingRatio = 0.78f,
        stiffness = 560f
    )
    val FluidSpring = spring<Float>(
        dampingRatio = 0.86f,
        stiffness = 280f
    )
}

fun Modifier.physicsPressable(
    enabled: Boolean = true,
    scaleDown: Float = 0.965f,
    onClick: () -> Unit
): Modifier = composed {
    var pressed by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(
        targetValue = if (pressed) scaleDown else 1f,
        animationSpec = GlassMotion.BouncySpring,
        label = "physicsScale"
    )
    val haptic = LocalHapticFeedback.current

    this
        .graphicsLayer {
            scaleX = scale
            scaleY = scale
        }
        .pointerInput(enabled) {
            if (!enabled) return@pointerInput
            detectTapGestures(
                onPress = {
                    pressed = true
                    haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    tryAwaitRelease()
                    pressed = false
                },
                onTap = {
                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                    onClick()
                }
            )
        }
}

@Composable
fun AuroraBackdrop(modifier: Modifier = Modifier) {
    val infinite = rememberInfiniteTransition(label = "aurora")
    val drift by infinite.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(14000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "auroraDrift"
    )

    Canvas(modifier = modifier.fillMaxSize()) {
        drawRect(AttendoColors.ObsidianCanvas)
        val w = size.width
        val h = size.height

        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(
                    AttendoColors.Indigo.copy(alpha = 0.16f),
                    Color.Transparent
                ),
                center = Offset(w * (0.2f + 0.12f * drift), h * 0.12f),
                radius = w * 0.85f
            ),
            radius = w * 0.85f,
            center = Offset(w * (0.2f + 0.12f * drift), h * 0.12f)
        )

        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(
                    AttendoColors.Cyan.copy(alpha = 0.09f),
                    Color.Transparent
                ),
                center = Offset(w * (0.85f - 0.1f * drift), h * 0.45f),
                radius = w * 0.75f
            ),
            radius = w * 0.75f,
            center = Offset(w * (0.85f - 0.1f * drift), h * 0.45f)
        )
    }
}

@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    cornerRadius: Dp = 24.dp,
    accentColor: Color? = null,
    contentPadding: PaddingValues = PaddingValues(16.dp),
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit
) {
    val shape = RoundedCornerShape(cornerRadius)
    val bgBrush = Brush.verticalGradient(
        colors = listOf(
            accentColor?.copy(alpha = 0.14f) ?: AttendoColors.GlassTop,
            AttendoColors.GlassMid,
            AttendoColors.GlassBottom
        )
    )
    val borderBrush = Brush.linearGradient(
        colors = listOf(
            accentColor?.copy(alpha = 0.45f) ?: AttendoColors.GlassBorderTop,
            AttendoColors.GlassBorderBottom
        )
    )

    val baseModifier = modifier
        .then(
            if (onClick != null) Modifier.physicsPressable(onClick = onClick) else Modifier
        )
        .clip(shape)
        .background(bgBrush, shape)
        .border(0.85.dp, borderBrush, shape)
        .padding(contentPadding)

    Column(modifier = baseModifier, content = content)
}

@Composable
fun StaggeredEntrance(
    index: Int,
    content: @Composable () -> Unit
) {
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        kotlinx.coroutines.delay((index.coerceAtMost(8) * 32).toLong())
        visible = true
    }
    AnimatedVisibility(
        visible = visible,
        enter = fadeIn(tween(260)) + slideInVertically(
            animationSpec = spring(dampingRatio = 0.78f, stiffness = 360f),
            initialOffsetY = { it / 5 }
        )
    ) {
        content()
    }
}

@Composable
fun AnimatedLiquidRing(
    percent: Int,
    targetPercent: Int = 75,
    size: Dp = 84.dp,
    strokeWidth: Dp = 7.dp,
    label: String? = null
) {
    val clamped = percent.coerceIn(0, 100)
    val animProgress = remember { Animatable(0f) }
    LaunchedEffect(clamped) {
        animProgress.animateTo(
            targetValue = clamped / 100f,
            animationSpec = spring(dampingRatio = 0.72f, stiffness = 220f)
        )
    }

    val ringColor = when {
        clamped >= targetPercent -> AttendoColors.Emerald
        clamped >= targetPercent - 10 -> AttendoColors.Amber
        else -> AttendoColors.Rose
    }

    Box(
        modifier = Modifier.size(size),
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val stroke = strokeWidth.toPx()
            val inset = stroke / 2f
            val arcSize = Size(this.size.width - stroke, this.size.height - stroke)

            drawArc(
                color = Color(0x1FFFFFFF),
                startAngle = 0f,
                sweepAngle = 360f,
                useCenter = false,
                topLeft = Offset(inset, inset),
                size = arcSize,
                style = Stroke(width = stroke, cap = StrokeCap.Round)
            )

            drawArc(
                brush = Brush.sweepGradient(
                    colors = listOf(ringColor.copy(alpha = 0.65f), ringColor, AttendoColors.Cyan)
                ),
                startAngle = -90f,
                sweepAngle = 360f * animProgress.value,
                useCenter = false,
                topLeft = Offset(inset, inset),
                size = arcSize,
                style = Stroke(width = stroke, cap = StrokeCap.Round)
            )
        }

        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "${(animProgress.value * 100).toInt()}%",
                color = AttendoColors.TextPrimary,
                fontSize = if (size >= 80.dp) 18.sp else 13.sp,
                fontWeight = FontWeight.ExtraBold
            )
            if (label != null) {
                Text(
                    text = label,
                    color = AttendoColors.TextSecondary,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}

@Composable
fun GlassActionPill(
    text: String,
    selected: Boolean,
    activeColor: Color,
    icon: ImageVector? = null,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val shape = RoundedCornerShape(14.dp)
    val bg = if (selected) activeColor.copy(alpha = 0.24f) else Color(0x0DFFFFFF)
    val border = if (selected) activeColor.copy(alpha = 0.75f) else Color(0x1EFFFFFF)
    val fg = if (selected) Color.White else AttendoColors.TextSecondary

    Row(
        modifier = modifier
            .physicsPressable(scaleDown = 0.93f, onClick = onClick)
            .clip(shape)
            .background(bg, shape)
            .border(0.85.dp, border, shape)
            .padding(horizontal = 10.dp, vertical = 7.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (icon != null) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = fg,
                modifier = Modifier.size(14.dp)
            )
            Spacer(modifier = Modifier.width(4.dp))
        }
        Text(
            text = text,
            color = fg,
            fontSize = 11.sp,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
            maxLines = 1
        )
    }
}

@Composable
fun ShieldALogo(size: Dp = 64.dp) {
    Canvas(modifier = Modifier.size(size)) {
        val w = this.size.width
        val h = this.size.height

        val shield = Path().apply {
            moveTo(w * 0.5f, h * 0.05f)
            lineTo(w * 0.90f, h * 0.20f)
            lineTo(w * 0.84f, h * 0.62f)
            quadraticBezierTo(w * 0.75f, h * 0.85f, w * 0.5f, h * 0.96f)
            quadraticBezierTo(w * 0.25f, h * 0.85f, w * 0.16f, h * 0.62f)
            lineTo(w * 0.10f, h * 0.20f)
            close()
        }

        drawPath(
            path = shield,
            brush = Brush.linearGradient(
                colors = listOf(AttendoColors.Indigo, AttendoColors.Violet, AttendoColors.Cyan)
            )
        )
        drawPath(
            path = shield,
            color = Color(0x66FFFFFF),
            style = Stroke(width = w * 0.035f, join = StrokeJoin.Round)
        )

        // Classic 'A' glyph
        val letterA = Path().apply {
            moveTo(w * 0.50f, h * 0.26f)
            lineTo(w * 0.30f, h * 0.72f)
            lineTo(w * 0.39f, h * 0.72f)
            lineTo(w * 0.44f, h * 0.59f)
            lineTo(w * 0.56f, h * 0.59f)
            lineTo(w * 0.61f, h * 0.72f)
            lineTo(w * 0.70f, h * 0.72f)
            close()
        }
        drawPath(path = letterA, color = Color.White)
        drawLine(
            color = AttendoColors.Indigo,
            start = Offset(w * 0.45f, h * 0.52f),
            end = Offset(w * 0.55f, h * 0.52f),
            strokeWidth = w * 0.05f
        )
    }
}
