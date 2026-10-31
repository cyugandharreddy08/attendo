import React, {useState, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {Colors} from '../theme/colors';
import {Spacing} from '../theme/spacing';
import {Typography} from '../theme/typography';
import {AttendanceActivityDay} from '../types';
import {
  subWeeks,
  addDays,
  startOfWeek,
  format,
  parseISO,
  isSameDay,
  isAfter,
} from 'date-fns';

interface HeatmapProps {
  activityMatrix: AttendanceActivityDay[];
  currentStreak?: number;
  longestStreak?: number;
  activeDaysCount?: number;
  weeksCount?: number; // default 20 weeks
}

const LEVEL_COLORS = [
  '#161928', // Level 0: No classes / absent
  '#14532D', // Level 1: 1 class
  '#16A34A', // Level 2: 2 classes
  '#22C55E', // Level 3: 3 classes
  '#4ADE80', // Level 4: 4+ classes
];

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function getConsistencyTier(streak: number, activeDays: number) {
  if (streak >= 30 || activeDays >= 60) return {title: '👑 Diamond Master', color: '#38BDF8'};
  if (streak >= 15 || activeDays >= 30) return {title: '⚡ Platinum Regular', color: '#A78BFA'};
  if (streak >= 7 || activeDays >= 14) return {title: '🔥 Gold Consistent', color: '#F59E0B'};
  if (streak >= 3 || activeDays >= 5) return {title: '🌱 Silver Rising', color: '#34D399'};
  return {title: '🎯 Regular Student', color: '#94A3B8'};
}

export default function LeetCodeAttendanceHeatmap({
  activityMatrix = [],
  currentStreak = 0,
  longestStreak = 0,
  activeDaysCount = 0,
  weeksCount = 20,
}: HeatmapProps) {
  const [selectedDay, setSelectedDay] = useState<{
    date: string;
    count: number;
    hours: number;
    level: number;
  } | null>(null);

  // Fast map lookup for date -> activity
  const dateMap = useMemo(() => {
    const map = new Map<string, AttendanceActivityDay>();
    activityMatrix.forEach(item => {
      map.set(item.date, item);
    });
    return map;
  }, [activityMatrix]);

  // Generate grid matrix: columns are weeks (Monday-Sunday)
  const weeks = useMemo(() => {
    const today = new Date();
    // Start of the current week (Monday)
    const currentWeekStart = startOfWeek(today, {weekStartsOn: 1});
    // Go back N weeks
    const startDate = subWeeks(currentWeekStart, weeksCount - 1);

    const weekList: Array<
      Array<{
        dateStr: string;
        date: Date;
        count: number;
        hours: number;
        level: number;
        isFuture: boolean;
      }>
    > = [];

    for (let w = 0; w < weeksCount; w++) {
      const weekStart = addDays(startDate, w * 7);
      const days = [];
      for (let d = 0; d < 7; d++) {
        const dayDate = addDays(weekStart, d);
        const dateStr = format(dayDate, 'yyyy-MM-dd');
        const isFuture = isAfter(dayDate, today);
        const act = dateMap.get(dateStr);

        days.push({
          dateStr,
          date: dayDate,
          count: isFuture ? 0 : act?.count || 0,
          hours: isFuture ? 0 : act?.hours || 0,
          level: isFuture ? 0 : act?.level || 0,
          isFuture,
        });
      }
      weekList.push(days);
    }

    return weekList;
  }, [dateMap, weeksCount]);

  const totalClassesAttended = useMemo(() => {
    return activityMatrix.reduce((sum, item) => sum + (item.count || 0), 0);
  }, [activityMatrix]);

  const calculatedActiveDays = useMemo(() => {
    if (activeDaysCount > 0) return activeDaysCount;
    return activityMatrix.filter(item => item.count > 0).length;
  }, [activityMatrix, activeDaysCount]);

  const tier = getConsistencyTier(currentStreak, calculatedActiveDays);

  return (
    <View style={styles.card}>
      {/* Header with Title and Streak Counters */}
      <View style={styles.header}>
        <View>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
            <Text style={styles.title}>Attendance Consistency</Text>
            <View style={[styles.tierBadge, {borderColor: tier.color + '55', backgroundColor: tier.color + '15'}]}>
              <Text style={[styles.tierText, {color: tier.color}]}>{tier.title}</Text>
            </View>
          </View>
          <Text style={styles.subtitle}>
            {totalClassesAttended} classes attended across {calculatedActiveDays} active days
          </Text>
        </View>
        <View style={styles.streakBadge}>
          <Text style={styles.streakIcon}>🔥</Text>
          <View>
            <Text style={styles.streakNum}>{currentStreak}</Text>
            <Text style={styles.streakLabel}>Day Streak</Text>
          </View>
        </View>
      </View>

      {/* Quick Stat Highlights */}
      <View style={styles.statsRow}>
        <View style={styles.miniStat}>
          <Text style={[styles.miniStatValue, {color: '#F59E0B'}]}>🔥 {currentStreak}d</Text>
          <Text style={styles.miniStatLabel}>Current Streak</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.miniStat}>
          <Text style={[styles.miniStatValue, {color: '#A78BFA'}]}>🏆 {longestStreak}d</Text>
          <Text style={styles.miniStatLabel}>Max Streak</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.miniStat}>
          <Text style={[styles.miniStatValue, {color: '#34D399'}]}>⚡ {calculatedActiveDays}</Text>
          <Text style={styles.miniStatLabel}>Active Days</Text>
        </View>
      </View>

      {/* LeetCode Activity Grid */}
      <View style={styles.gridContainer}>
        {/* Day of Week Labels (Mon - Sun) */}
        <View style={styles.dayLabelsColumn}>
          {DAY_LABELS.map((label, idx) => (
            <View key={idx} style={styles.dayLabelCell}>
              <Text style={styles.dayLabelText}>{idx % 2 === 0 ? label : ''}</Text>
            </View>
          ))}
        </View>

        {/* Scrollable Heatmap Weeks */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollWeeks}>
          {weeks.map((week, wIdx) => (
            <View key={wIdx} style={styles.weekColumn}>
              {week.map((day, dIdx) => {
                const cellBg = day.isFuture
                  ? '#0D0F18'
                  : LEVEL_COLORS[day.level] || LEVEL_COLORS[0];
                const isSelected = selectedDay?.date === day.dateStr;

                return (
                  <TouchableOpacity
                    key={dIdx}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (!day.isFuture) {
                        ReactNativeHapticFeedback.trigger('impactLight', {
                          enableVibrateFallback: true,
                          ignoreAndroidSystemSettings: false,
                        });
                        setSelectedDay({
                          date: day.dateStr,
                          count: day.count,
                          hours: day.hours,
                          level: day.level,
                        });
                      }
                    }}
                    style={[
                      styles.cell,
                      {backgroundColor: cellBg},
                      isSelected && styles.cellSelected,
                      day.isFuture && styles.cellFuture,
                    ]}
                  />
                );
              })}
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Selected Day Details Pill */}
      {selectedDay && (
        <View style={styles.tooltipCard}>
          <Text style={styles.tooltipDate}>{selectedDay.date}</Text>
          <Text style={styles.tooltipContent}>
            {selectedDay.count > 0
              ? `✅ Attended ${selectedDay.count} class${
                  selectedDay.count > 1 ? 'es' : ''
                } (${selectedDay.hours} hrs)`
              : '⭕ No classes attended on this date'}
          </Text>
        </View>
      )}

      {/* Legend */}
      <View style={styles.footerRow}>
        <Text style={styles.legendText}>Less</Text>
        <View style={styles.legendSquares}>
          {LEVEL_COLORS.map((c, i) => (
            <View key={i} style={[styles.legendBox, {backgroundColor: c}]} />
          ))}
        </View>
        <Text style={styles.legendText}>More</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginVertical: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.subtitle1,
    color: Colors.text,
    fontWeight: '700',
  },
  tierBadge: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  tierText: {
    fontSize: 10,
    fontWeight: '700',
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED22',
    borderWidth: 1,
    borderColor: '#7C3AED66',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 6,
  },
  streakIcon: {
    fontSize: 22,
  },
  streakNum: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F59E0B',
  },
  streakLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#1E1E2E88',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: Spacing.md,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  miniStat: {
    alignItems: 'center',
  },
  miniStatValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  miniStatLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 22,
    backgroundColor: Colors.border,
  },
  gridContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayLabelsColumn: {
    marginRight: 6,
    justifyContent: 'space-between',
  },
  dayLabelCell: {
    height: 14,
    justifyContent: 'center',
    marginBottom: 3,
  },
  dayLabelText: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  scrollWeeks: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  weekColumn: {
    marginRight: 3,
  },
  cell: {
    width: 13,
    height: 13,
    borderRadius: 3,
    marginBottom: 3,
  },
  cellFuture: {
    opacity: 0.35,
  },
  cellSelected: {
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    transform: [{scale: 1.15}],
  },
  tooltipCard: {
    backgroundColor: '#262A3B',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tooltipDate: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  tooltipContent: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '500',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: Spacing.sm,
    gap: 6,
  },
  legendText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  legendSquares: {
    flexDirection: 'row',
    gap: 3,
  },
  legendBox: {
    width: 11,
    height: 11,
    borderRadius: 2,
  },
});
