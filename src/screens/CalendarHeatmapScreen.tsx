import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, addDays, isSameMonth} from 'date-fns';
import {getAllInstancesByMonth} from '../db/queries/lectureInstances';
import {getAllSubjects} from '../db/queries/subjects';
import {LectureInstance, Subject} from '../types';
import {Colors, getStatusColor} from '../theme/colors';
import {Spacing} from '../theme/spacing';
import {Typography} from '../theme/typography';
import DayDetailSheet from '../components/DayDetailSheet';

export default function CalendarHeatmapScreen() {
  const insets = useSafeAreaInsets();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [instanceMap, setInstanceMap] = useState<Record<string, LectureInstance[]>>({});
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  const loadData = useCallback(async () => {
    const monthStr = format(currentMonth, 'yyyy-MM');
    const instances = await getAllInstancesByMonth(monthStr);
    const subs = await getAllSubjects();
    setSubjects(subs);
    const map: Record<string, LectureInstance[]> = {};
    for (const inst of instances) {
      if (!map[inst.date]) map[inst.date] = [];
      map[inst.date].push(inst);
    }
    setInstanceMap(map);
  }, [currentMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getDayColor = (dateStr: string): string => {
    const dayInsts = instanceMap[dateStr];
    if (!dayInsts || dayInsts.length === 0) return Colors.heatmapNoClass;
    const hasAbsent = dayInsts.some(i => i.status === 'absent');
    const allPresent = dayInsts.every(i => i.status === 'present');
    const allHoliday = dayInsts.every(i => i.status === 'holiday');
    const allCancelled = dayInsts.every(i => i.status === 'cancelled');
    if (allPresent) return Colors.heatmapPresent;
    if (allHoliday) return Colors.heatmapHoliday;
    if (allCancelled) return Colors.heatmapCancelled;
    if (hasAbsent) return Colors.heatmapAbsent;
    return Colors.surface;
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({start: monthStart, end: monthEnd});

  // Pad start
  const startPadding = (monthStart.getDay() + 6) % 7; // Monday start
  const paddedDays: (Date | null)[] = [
    ...Array(startPadding).fill(null),
    ...days,
  ];

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      {/* Month navigation */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
          <Text style={styles.navBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{format(currentMonth, 'MMMM yyyy')}</Text>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
          <Text style={styles.navBtnText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Day labels */}
      <View style={styles.dayLabels}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <Text key={i} style={styles.dayLabel}>{d}</Text>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Calendar grid */}
        <View style={styles.grid}>
          {paddedDays.map((day, i) => {
            if (!day) return <View key={`pad-${i}`} style={styles.cell} />;
            const dateStr = format(day, 'yyyy-MM-dd');
            const color = getDayColor(dateStr);
            const hasData = instanceMap[dateStr]?.length > 0;
            return (
              <TouchableOpacity
                key={dateStr}
                style={[styles.cell, hasData && {backgroundColor: color + '44'}]}
                onPress={() => {
                  setSelectedDate(dateStr);
                  setSheetVisible(true);
                }}>
                <View style={[styles.dot, hasData && {backgroundColor: color}]} />
                <Text style={styles.cellDate}>{format(day, 'd')}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          {[
            {color: Colors.heatmapPresent, label: 'All Present'},
            {color: Colors.heatmapAbsent, label: 'Has Absent'},
            {color: Colors.heatmapHoliday, label: 'Holiday'},
            {color: Colors.heatmapCancelled, label: 'Cancelled'},
            {color: Colors.heatmapNoClass, label: 'No Class'},
          ].map(item => (
            <View key={item.label} style={styles.legendItem}>
              <View style={[styles.legendDot, {backgroundColor: item.color}]} />
              <Text style={styles.legendText}>{item.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {sheetVisible && selectedDate && (
        <DayDetailSheet
          date={selectedDate}
          instances={instanceMap[selectedDate] ?? []}
          isVisible={sheetVisible}
          onClose={() => setSheetVisible(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screenPad,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.card,
  },
  navBtn: {
    padding: 8,
  },
  navBtnText: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '300',
  },
  monthTitle: {
    ...Typography.h2,
  },
  dayLabels: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.screenPad,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  dayLabel: {
    flex: 1,
    textAlign: 'center',
    ...Typography.label,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.screenPad,
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'transparent',
    marginBottom: 2,
  },
  cellDate: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: Spacing.screenPad,
    paddingVertical: Spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    ...Typography.caption,
  },
});
