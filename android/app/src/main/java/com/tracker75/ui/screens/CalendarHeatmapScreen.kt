package com.tracker75.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.ChevronLeft
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tracker75.ui.components.GlassCard
import com.tracker75.ui.components.physicsPressable
import com.tracker75.ui.theme.AttendoColors
import com.tracker75.viewmodel.AttendoViewModel
import org.json.JSONArray
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun CalendarHeatmapScreen(
    vm: AttendoViewModel,
    onBack: () -> Unit
) {
    val snapshot by vm.snapshot.collectAsState()
    val selectedDate by vm.selectedDate.collectAsState()
    val heatmap = snapshot.optJSONObject("heatmap")
    val daysArr = heatmap?.optJSONArray("days") ?: JSONArray()
    val dayClasses = snapshot.optJSONArray("dayClasses") ?: JSONArray()

    val activityMap = remember(daysArr) {
        val m = mutableMapOf<String, Int>()
        for (i in 0 until daysArr.length()) {
            val d = daysArr.getJSONObject(i)
            m[d.optString("date")] = d.optInt("level", 0)
        }
        m
    }

    var monthOffset by remember { mutableStateOf(0) }
    val cal = remember(monthOffset) {
        Calendar.getInstance().apply {
            set(Calendar.DAY_OF_MONTH, 1)
            add(Calendar.MONTH, monthOffset)
        }
    }
    val monthTitle = remember(monthOffset) {
        SimpleDateFormat("MMMM yyyy", Locale.US).format(cal.time)
    }
    val daysInMonth = cal.getActualMaximum(Calendar.DAY_OF_MONTH)
    val firstWeekdayOffset = (cal.get(Calendar.DAY_OF_WEEK) - Calendar.MONDAY + 7) % 7
    val isoFmt = remember { SimpleDateFormat("yyyy-MM-dd", Locale.US) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = "Back", tint = AttendoColors.TextPrimary)
                }
                Text(
                    "Monthly Calendar",
                    color = AttendoColors.TextPrimary,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.ExtraBold
                )
            }
        }

        // Spacious Monthly Calendar Card
        item {
            GlassCard(accentColor = AttendoColors.Indigo) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(onClick = { monthOffset-- }) {
                        Icon(Icons.Rounded.ChevronLeft, contentDescription = "Prev", tint = AttendoColors.TextPrimary)
                    }
                    Text(
                        monthTitle,
                        color = AttendoColors.TextPrimary,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold
                    )
                    IconButton(onClick = { monthOffset++ }) {
                        Icon(Icons.Rounded.ChevronRight, contentDescription = "Next", tint = AttendoColors.TextPrimary)
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                Row(modifier = Modifier.fillMaxWidth()) {
                    listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun").forEach { d ->
                        Text(
                            text = d,
                            color = AttendoColors.TextMuted,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                val totalCells = firstWeekdayOffset + daysInMonth
                val rows = (totalCells + 6) / 7
                for (r in 0 until rows) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        for (c in 0 until 7) {
                            val cellIdx = r * 7 + c
                            val dayNum = cellIdx - firstWeekdayOffset + 1
                            if (dayNum in 1..daysInMonth) {
                                val cellCal = (cal.clone() as Calendar).apply {
                                    set(Calendar.DAY_OF_MONTH, dayNum)
                                }
                                val iso = isoFmt.format(cellCal.time)
                                val level = activityMap[iso] ?: 0
                                val isSelected = iso == selectedDate
                                val dotColor = when {
                                    level >= 3 -> AttendoColors.Emerald
                                    level >= 1 -> AttendoColors.Cyan
                                    else -> Color.Transparent
                                }

                                Column(
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(48.dp)
                                        .physicsPressable(scaleDown = 0.90f) { vm.selectDate(iso) }
                                        .clip(RoundedCornerShape(14.dp))
                                        .background(
                                            if (isSelected) AttendoColors.Indigo.copy(alpha = 0.35f)
                                            else Color(0x0DFFFFFF)
                                        )
                                        .border(
                                            0.9.dp,
                                            if (isSelected) AttendoColors.IndigoLight else Color(0x16FFFFFF),
                                            RoundedCornerShape(14.dp)
                                        ),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.Center
                                ) {
                                    Text(
                                        text = dayNum.toString(),
                                        color = AttendoColors.TextPrimary,
                                        fontSize = 14.sp,
                                        fontWeight = if (isSelected) FontWeight.ExtraBold else FontWeight.SemiBold
                                    )
                                    if (dotColor != Color.Transparent) {
                                        Spacer(modifier = Modifier.height(3.dp))
                                        Box(
                                            modifier = Modifier
                                                .size(6.dp)
                                                .clip(CircleShape)
                                                .background(dotColor)
                                        )
                                    }
                                }
                            } else {
                                Spacer(modifier = Modifier.weight(1f).height(48.dp))
                            }
                        }
                    }
                }
            }
        }

        item {
            Text(
                "Classes on $selectedDate",
                color = AttendoColors.TextPrimary,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold
            )
        }

        val dayList = (0 until dayClasses.length()).map { dayClasses.getJSONObject(it) }
        if (dayList.isEmpty()) {
            item {
                GlassCard {
                    Text("No classes on this date.", color = AttendoColors.TextSecondary, fontSize = 13.sp)
                }
            }
        } else {
            items(dayList) { cls ->
                GlassCard {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(cls.optString("subject_name"), color = AttendoColors.TextPrimary, fontWeight = FontWeight.Bold)
                            Text("${cls.optString("start_time")} – ${cls.optString("end_time")}", color = AttendoColors.TextSecondary, fontSize = 12.sp)
                        }
                        Text(
                            cls.optString("status", "unmarked").uppercase(),
                            color = AttendoColors.Cyan,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}
