package com.tracker75.ui.screens

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tracker75.ui.components.ClassicShieldLogo
import com.tracker75.ui.components.cyberGridBackground
import com.tracker75.ui.theme.CyberColors
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun CyberSplashScreen(onFinished: () -> Unit) {
    val pulseRadius = remember { Animatable(0.2f) }
    val shieldScale = remember { Animatable(0.15f) }
    val shieldAlpha = remember { Animatable(0f) }
    val shieldTilt = remember { Animatable(-18f) }
    val textSlide = remember { Animatable(32f) }
    val textAlpha = remember { Animatable(0f) }
    val bootProgress = remember { Animatable(0f) }

    val infinite = rememberInfiniteTransition(label = "cyberOrbit")
    val outerAngle by infinite.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(4200, easing = LinearEasing)),
        label = "outerRing"
    )
    val innerAngle by infinite.animateFloat(
        initialValue = 360f,
        targetValue = 0f,
        animationSpec = infiniteRepeatable(tween(2800, easing = LinearEasing)),
        label = "innerRing"
    )

    LaunchedEffect(Unit) {
        launch {
            pulseRadius.animateTo(1.25f, tween(650, easing = FastOutSlowInEasing))
        }
        delay(120)
        launch {
            shieldAlpha.animateTo(1f, tween(380))
        }
        launch {
            shieldScale.animateTo(1f, spring(dampingRatio = 0.55f, stiffness = 220f))
        }
        launch {
            shieldTilt.animateTo(0f, spring(dampingRatio = 0.65f, stiffness = 180f))
        }
        delay(260)
        launch {
            textAlpha.animateTo(1f, tween(420))
        }
        launch {
            textSlide.animateTo(0f, spring(dampingRatio = 0.72f, stiffness = 240f))
        }
        bootProgress.animateTo(1f, tween(850, easing = FastOutSlowInEasing))
        delay(300)
        onFinished()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .cyberGridBackground(),
        contentAlignment = Alignment.Center
    ) {
        // Ambient radial violet/cyan aura + dual counter-rotating cyber rings
        Canvas(modifier = Modifier.size(280.dp)) {
            val center = Offset(size.width / 2f, size.height / 2f)
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(
                        CyberColors.ElectricViolet.copy(alpha = 0.35f),
                        CyberColors.NeonCyan.copy(alpha = 0.12f),
                        Color.Transparent
                    ),
                    center = center,
                    radius = (size.minDimension / 2f) * pulseRadius.value
                ),
                radius = (size.minDimension / 2f) * pulseRadius.value,
                center = center
            )

            rotate(outerAngle, pivot = center) {
                drawCircle(
                    color = CyberColors.NeonCyan.copy(alpha = 0.55f),
                    radius = 104.dp.toPx(),
                    center = center,
                    style = Stroke(
                        width = 2.dp.toPx(),
                        pathEffect = PathEffect.dashPathEffect(floatArrayOf(18f, 12f), 0f)
                    )
                )
            }

            rotate(innerAngle, pivot = center) {
                drawCircle(
                    color = CyberColors.ElectricViolet.copy(alpha = 0.65f),
                    radius = 78.dp.toPx(),
                    center = center,
                    style = Stroke(
                        width = 1.5.dp.toPx(),
                        pathEffect = PathEffect.dashPathEffect(floatArrayOf(10f, 14f), 0f)
                    )
                )
            }
        }

        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            // Classic 7.0.0 Shield Emblem with new 3D spring reveal
            Box(
                modifier = Modifier.graphicsLayer {
                    scaleX = shieldScale.value
                    scaleY = shieldScale.value
                    alpha = shieldAlpha.value
                    rotationZ = shieldTilt.value
                }
            ) {
                ClassicShieldLogo(
                    size = 104.dp,
                    cornerRadius = 30.dp,
                    fontSize = 54
                )
            }

            Spacer(modifier = Modifier.height(28.dp))

            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.graphicsLayer {
                    translationY = textSlide.value
                    alpha = textAlpha.value
                }
            ) {
                Text(
                    text = "ATTENDO",
                    color = CyberColors.TextPrimary,
                    fontSize = 36.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 5.sp
                )
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = "RUST ENGINE • 75% ATTENDANCE SHIELD",
                    color = CyberColors.NeonCyan,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 2.sp
                )
            }
        }

        // Bottom Native Rust Engine Status Pill
        Box(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(horizontal = 28.dp, vertical = 44.dp)
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(CyberColors.GlassCard.copy(alpha = 0.92f))
                .border(1.dp, CyberColors.CyberBorder, RoundedCornerShape(16.dp))
                .padding(16.dp)
        ) {
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "⚡ NATIVE RUST CORE",
                        color = CyberColors.VioletBright,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = 1.2.sp
                    )
                    Text(
                        text = "v9.1.0",
                        color = CyberColors.NeonCyan,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
                Spacer(modifier = Modifier.height(8.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(5.dp)
                        .clip(RoundedCornerShape(3.dp))
                        .background(CyberColors.ObsidianBg)
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(bootProgress.value)
                            .fillMaxHeight()
                            .clip(RoundedCornerShape(3.dp))
                            .background(
                                Brush.horizontalGradient(
                                    listOf(CyberColors.ElectricViolet, CyberColors.NeonCyan)
                                )
                            )
                    )
                }
            }
        }
    }
}
