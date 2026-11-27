package com.tracker75.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowBack
import androidx.compose.material.icons.rounded.ArrowUpward
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tracker75.ui.components.CyberBentoCard
import com.tracker75.ui.components.StatusPill
import com.tracker75.ui.components.cyberGridBackground
import com.tracker75.ui.theme.CyberColors
import com.tracker75.viewmodel.AttendoViewModel
import com.tracker75.viewmodel.ChatMsg

private val QUICK_PROMPTS = listOf(
    "🌴 Can I bunk tomorrow?",
    "📊 What is my current attendance status?",
    "⚠️ Which subjects are in the danger zone?",
    "📅 Classes run till Dec 20, how many can I skip?",
    "🔄 Shift tomorrow's class to Thursday leisure hour"
)

@Composable
fun ProxyAIScreen(
    vm: AttendoViewModel,
    onBack: (() -> Unit)? = null
) {
    val messages by vm.chatMessages.collectAsState()
    val loading by vm.aiLoading.collectAsState()
    var input by remember { mutableStateOf("") }
    val listState = rememberLazyListState()

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.size - 1)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .cyberGridBackground()
    ) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(CyberColors.GlassCard)
                .border(1.dp, CyberColors.CyberBorder)
                .padding(horizontal = 12.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (onBack != null) {
                IconButton(onClick = onBack) {
                    Icon(Icons.Rounded.ArrowBack, "Back", tint = CyberColors.TextPrimary)
                }
            }
            Text("🤖", fontSize = 22.sp)
            Spacer(Modifier.width(10.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Proxy AI", color = CyberColors.TextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Black)
                    Spacer(Modifier.width(8.dp))
                    StatusPill("RUST ENGINE", CyberColors.NeonCyan)
                }
                Text("24/7 Attendance Wingman • Live Tool Execution", color = CyberColors.TextSecondary, fontSize = 11.sp)
            }
        }

        // Chat Stream
        LazyColumn(
            state = listState,
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(messages, key = { it.id }) { msg ->
                ChatBubble(msg)
            }
            if (loading) {
                item {
                    CyberBentoCard(borderColor = CyberColors.NeonCyan.copy(alpha = 0.4f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = CyberColors.NeonCyan)
                            Spacer(Modifier.width(10.dp))
                            Text("Proxy is analyzing your timetable & attendance...", color = CyberColors.TextSecondary, fontSize = 12.sp)
                        }
                    }
                }
            }
        }

        // Quick Prompt Chips
        LazyRow(
            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(QUICK_PROMPTS) { prompt ->
                Box(
                    modifier = Modifier
                        .clip(CircleShape)
                        .background(CyberColors.GlassSurface)
                        .border(1.dp, CyberColors.CyberBorder, CircleShape)
                        .clickable { vm.sendAiChat(prompt) }
                        .padding(horizontal = 12.dp, vertical = 7.dp)
                ) {
                    Text(prompt, color = CyberColors.TextPrimary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }

        // Input Bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(CyberColors.GlassCard)
                .padding(start = 12.dp, end = 12.dp, top = 8.dp, bottom = 96.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value = input,
                onValueChange = { input = it },
                placeholder = { Text("Ask Proxy anything...", color = CyberColors.TextMuted, fontSize = 13.sp) },
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(16.dp),
                maxLines = 3
            )
            Spacer(Modifier.width(8.dp))
            IconButton(
                onClick = {
                    val q = input
                    input = ""
                    vm.sendAiChat(q)
                },
                enabled = input.isNotBlank() && !loading,
                modifier = Modifier
                    .size(46.dp)
                    .clip(CircleShape)
                    .background(if (input.isNotBlank() && !loading) CyberColors.ElectricViolet else CyberColors.GlassSurface)
            ) {
                Icon(Icons.Rounded.ArrowUpward, "Send", tint = Color.White)
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
        if (isUser) {
            Box(
                modifier = Modifier
                    .widthIn(max = 290.dp)
                    .clip(RoundedCornerShape(18.dp, 18.dp, 4.dp, 18.dp))
                    .background(CyberColors.ElectricViolet)
                    .padding(horizontal = 14.dp, vertical = 10.dp)
            ) {
                Text(msg.content, color = Color.White, fontSize = 14.sp)
            }
        } else {
            CyberBentoCard(
                modifier = Modifier.fillMaxWidth(0.95f),
                borderColor = CyberColors.NeonCyan.copy(alpha = 0.35f)
            ) {
                RichMarkdownRenderer(msg.content)

                msg.actionCard?.let { card ->
                    Spacer(Modifier.height(10.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(CyberColors.ObsidianBg)
                            .border(1.dp, CyberColors.ElectricViolet.copy(alpha = 0.6f), RoundedCornerShape(12.dp))
                            .padding(10.dp)
                    ) {
                        Column {
                            Text("⚡ ${card.optString("title")}", color = CyberColors.NeonCyan, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold)
                            Text(card.optString("description"), color = CyberColors.TextSecondary, fontSize = 11.sp)
                        }
                    }
                }
            }
        }
    }
}

/**
 * Clean native Markdown Table, Heading, Callout & Bullet renderer for mobile readability.
 */
@Composable
private fun RichMarkdownRenderer(markdown: String) {
    val lines = markdown.split("\n")
    var i = 0
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        while (i < lines.size) {
            val line = lines[i].trim()
            if (line.startsWith("|") && i + 1 < lines.size && lines[i + 1].trim().startsWith("|")) {
                // Parse Markdown Table cleanly
                val tableRows = mutableListOf<List<String>>()
                while (i < lines.size && lines[i].trim().startsWith("|")) {
                    val rowLine = lines[i].trim()
                    if (!rowLine.replace("|", "").replace("-", "").replace(":", "").isBlank()) {
                        val cells = rowLine.trim('|').split('|').map { it.trim().replace("**", "") }
                        tableRows.add(cells)
                    }
                    i++
                }
                if (tableRows.isNotEmpty()) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(CyberColors.ObsidianBg)
                            .border(1.dp, CyberColors.CyberBorder, RoundedCornerShape(10.dp))
                    ) {
                        tableRows.forEachIndexed { rIdx, row ->
                            val isHeader = rIdx == 0
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(if (isHeader) CyberColors.ElectricViolet.copy(alpha = 0.22f) else Color.Transparent)
                                    .padding(horizontal = 8.dp, vertical = 6.dp)
                            ) {
                                row.forEach { cell ->
                                    Text(
                                        text = cell,
                                        color = if (isHeader) CyberColors.NeonCyan else CyberColors.TextPrimary,
                                        fontSize = 11.sp,
                                        fontWeight = if (isHeader) FontWeight.ExtraBold else FontWeight.Normal,
                                        modifier = Modifier.weight(1f)
                                    )
                                }
                            }
                        }
                    }
                }
                continue
            } else if (line.startsWith("### ")) {
                Text(
                    text = line.removePrefix("### ").replace("**", ""),
                    color = CyberColors.NeonCyan,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.ExtraBold
                )
            } else if (line.startsWith("> ")) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(CyberColors.Cancelled.copy(alpha = 0.12f))
                        .border(1.dp, CyberColors.Cancelled.copy(alpha = 0.45f), RoundedCornerShape(8.dp))
                        .padding(8.dp)
                ) {
                    Text(
                        text = line.removePrefix("> ").replace("**", ""),
                        color = CyberColors.TextPrimary,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            } else if (line.isNotEmpty()) {
                Text(
                    text = line.replace("**", ""),
                    color = CyberColors.TextPrimary,
                    fontSize = 13.sp,
                    lineHeight = 18.sp
                )
            }
            i++
        }
    }
}
