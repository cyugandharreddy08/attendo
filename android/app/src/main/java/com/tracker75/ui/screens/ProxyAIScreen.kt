package com.tracker75.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Send
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.Bolt
import androidx.compose.material.icons.rounded.RestoreFromTrash
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tracker75.ui.components.GlassActionPill
import com.tracker75.ui.components.GlassCard
import com.tracker75.ui.components.physicsPressable
import com.tracker75.ui.theme.AttendoColors
import com.tracker75.viewmodel.AttendoViewModel
import com.tracker75.viewmodel.ChatMsg

@Composable
fun ProxyAIScreen(vm: AttendoViewModel) {
    val messages by vm.chatMessages.collectAsState()
    val aiLoading by vm.aiLoading.collectAsState()
    var prompt by remember { mutableStateOf("") }
    val listState = rememberLazyListState()

    val quickPrompts = listOf(
        "What is my attendance?",
        "Recover deleted class",
        "Mark all classes present today",
        "What if I bunk tomorrow?",
        "Show recovery vault",
        "When am I free today?"
    )

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.size - 1)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(bottom = 86.dp)
    ) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(
                            Brush.linearGradient(listOf(AttendoColors.Indigo, AttendoColors.Cyan))
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Rounded.AutoAwesome,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(20.dp)
                    )
                }
                Spacer(modifier = Modifier.width(10.dp))
                Column {
                    Text(
                        "Attendo Copilot",
                        color = AttendoColors.TextPrimary,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.ExtraBold
                    )
                    Text(
                        "Pure Rust Transformer • 100% Offline",
                        color = AttendoColors.Emerald,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }

        // Quick Prompt Chips
        LazyRow(
            contentPadding = PaddingValues(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(quickPrompts) { qp ->
                GlassActionPill(
                    text = qp,
                    selected = false,
                    activeColor = AttendoColors.Cyan,
                    icon = if (qp.contains("Recover")) Icons.Rounded.RestoreFromTrash else Icons.Rounded.Bolt,
                    onClick = { vm.sendAiChat(qp) }
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Chat List
        LazyColumn(
            state = listState,
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(messages, key = { it.id }) { msg ->
                ChatBubble(msg)
            }
            if (aiLoading) {
                item {
                    GlassCard(
                        cornerRadius = 18.dp,
                        accentColor = AttendoColors.Indigo,
                        contentPadding = PaddingValues(12.dp)
                    ) {
                        Text(
                            "Thinking on-device...",
                            color = AttendoColors.Cyan,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }
        }

        // Floating Glass Input Bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp)
                .clip(RoundedCornerShape(24.dp))
                .background(Color(0x22FFFFFF))
                .border(0.85.dp, AttendoColors.GlassBorderTop, RoundedCornerShape(24.dp))
                .padding(horizontal = 14.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            TextField(
                value = prompt,
                onValueChange = { prompt = it },
                placeholder = {
                    Text(
                        "Ask Attendo Copilot — control anything or recover data...",
                        color = AttendoColors.TextMuted,
                        fontSize = 13.sp
                    )
                },
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = Color.Transparent,
                    unfocusedContainerColor = Color.Transparent,
                    focusedIndicatorColor = Color.Transparent,
                    unfocusedIndicatorColor = Color.Transparent,
                    focusedTextColor = AttendoColors.TextPrimary,
                    unfocusedTextColor = AttendoColors.TextPrimary
                ),
                modifier = Modifier.weight(1f),
                maxLines = 3
            )
            Box(
                modifier = Modifier
                    .size(42.dp)
                    .physicsPressable(scaleDown = 0.88f) {
                        if (prompt.isNotBlank()) {
                            vm.sendAiChat(prompt)
                            prompt = ""
                        }
                    }
                    .clip(CircleShape)
                    .background(
                        Brush.linearGradient(listOf(AttendoColors.Indigo, AttendoColors.Cyan))
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    Icons.AutoMirrored.Rounded.Send,
                    contentDescription = "Send",
                    tint = Color.White,
                    modifier = Modifier.size(18.dp)
                )
            }
        }
    }
}

@Composable
private fun ChatBubble(msg: ChatMsg) {
    val isUser = msg.role == "user"
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = if (isUser) Alignment.End else Alignment.Start
    ) {
        GlassCard(
            cornerRadius = 20.dp,
            accentColor = if (isUser) AttendoColors.Indigo else null,
            contentPadding = PaddingValues(14.dp),
            modifier = Modifier.widthIn(max = 330.dp)
        ) {
            Text(
                text = msg.content.replace("**", "").replace("### ", ""),
                color = AttendoColors.TextPrimary,
                fontSize = 13.sp,
                lineHeight = 19.sp
            )

            msg.actionCard?.let { card ->
                Spacer(modifier = Modifier.height(10.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(AttendoColors.Emerald.copy(alpha = 0.16f))
                        .border(0.8.dp, AttendoColors.Emerald.copy(alpha = 0.5f), RoundedCornerShape(14.dp))
                        .padding(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Rounded.Bolt,
                        contentDescription = null,
                        tint = AttendoColors.Emerald,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Column {
                        Text(
                            card.optString("title"),
                            color = AttendoColors.TextPrimary,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            card.optString("description"),
                            color = AttendoColors.TextSecondary,
                            fontSize = 11.sp
                        )
                    }
                }
            }
        }
    }
}
