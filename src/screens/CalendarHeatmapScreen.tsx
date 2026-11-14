import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isToday,
} from 'date-fns';
import {
  getAllInstancesByMonth,
  updateInstanceStatus,
  markEntireDayStatus,
  markEntireDayHoliday,
  getUserAttendanceActivityReport,
  calculateDurationHours,
} from '../db/queries/lectureInstances';
import {getAllSubjects} from '../db/queries/subjects';
import {LectureInstance, Subject, AttendanceStatus, AttendanceActivityDay} from '../types';
import {Colors, getStatusColor} from '../theme/colors';
import LeetCodeAttendanceHeatmap from '../components/LeetCodeAttendanceHeatmap';
import AnimatedPressable from '../components/AnimatedPressable';

const STATUS_ICONS: Record<string, string> = {
  present: '✓',
  absent: '✕',
  holiday: '🏖️',
  cancelled: '⊘',
  shifted: '↷',
};

export default function CalendarHeatmapScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'month' | 'annual'>('month');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [instanceMap, setInstanceMap] = useState<Record<string, LectureInstance[]>>({});
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  // LeetCode Activity Matrix State
  const [activityReport, setActivityReport] = useState<{
    activityMatrix: AttendanceActivityDay[];
    currentStreak: number;
    longestStreak: number;
    activeDaysCount: number;
  }>({
    activityMatrix: [],
    currentStreak: 0,
    longestStreak: 0,
    activeDaysCount: 0,
  });

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

    try {
      const report = await getUserAttendanceActivityReport();
      setActivityReport(report);
    } catch (e) {
      // Activity report fallback
    }
  }, [currentMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute month summary statistics
  const monthStats = useMemo(() => {
    let attendedHours = 0;
    let totalHeldHours = 0;
    let presentDays = 0;
    let absentDays = 0;
    let holidayDays = 0;

    Object.entries(instanceMap).forEach(([_, insts]) => {
      let dayHasPresent = false;
      let dayHasAbsent = false;
      let dayHasHoliday = false;

      insts.forEach(inst => {
        const hrs = calculateDurationHours(inst.start_time, inst.end_time);
        if (inst.status === 'present') {
          attendedHours += hrs;
          totalHeldHours += hrs;
          dayHasPresent = true;
        } else if (inst.status === 'absent') {
          totalHeldHours += hrs;
          dayHasAbsent = true;
        } else if (inst.status === 'holiday') {
          dayHasHoliday = true;
        }
      });

      if (dayHasPresent) presentDays++;
      if (dayHasAbsent) absentDays++;
      if (dayHasHoliday) holidayDays++;
    });

    const percent = totalHeldHours > 0 ? (attendedHours / totalHeldHours) * 100 : 100;
    return {
      attendedHours: Number(attendedHours.toFixed(1)),
      totalHeldHours: Number(totalHeldHours.toFixed(1)),
      percent: Math.round(percent * 10) / 10,
      presentDays,
      absentDays,
      holidayDays,
    };
  }, [instanceMap]);

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
    return Colors.surfaceElevated;
  };

  const handleUpdateStatus = async (instId: number, newStatus: AttendanceStatus) => {
    try {
      ReactNativeHapticFeedback.trigger('impactMedium', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
      await updateInstanceStatus(instId, newStatus);
      await loadData();
    } catch (e) {
      console.warn('Status update error:', e);
    }
  };

  const handleMarkAllDay = async (status: AttendanceStatus) => {
    try {
      ReactNativeHapticFeedback.trigger('notificationSuccess', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
      if (status === 'holiday') {
        await markEntireDayHoliday(selectedDate, 'Marked from Calendar');
      } else {
        await markEntireDayStatus(selectedDate, status, 'Marked from Calendar');
      }
      await loadData();
    } catch (e) {
      console.warn('Mark all day error:', e);
    }
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({start: monthStart, end: monthEnd});
  const startPadding = (monthStart.getDay() + 6) % 7; // Monday start
  const paddedDays: (Date | null)[] = [...Array(startPadding).fill(null), ...days];

  const selectedDayInstances = instanceMap[selectedDate] || [];

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      {/* Top Header & View Switcher */}
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.screenTitle}>Attendance Pulse</Text>
          <Text style={styles.screenSubtitle}>Interactive Matrix & Streak Radar</Text>
        </View>

        {/* View Toggle Pill */}
        <View style={styles.tabSwitchContainer}>
          <TouchableOpacity
            style={[styles.tabSwitchBtn, activeTab === 'month' && styles.tabSwitchActive]}
            onPress={() => {
              ReactNativeHapticFeedback.trigger('impactLight');
              setActiveTab('month');
            }}>
            <Text style={[styles.tabSwitchText, activeTab === 'month' && styles.tabSwitchTextActive]}>
              📅 Month
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabSwitchBtn, activeTab === 'annual' && styles.tabSwitchActive]}
            onPress={() => {
              ReactNativeHapticFeedback.trigger('impactLight');
              setActiveTab('annual');
            }}>
            <Text style={[styles.tabSwitchText, activeTab === 'annual' && styles.tabSwitchTextActive]}>
              🔥 Streak
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {activeTab === 'month' ? (
          <>
            {/* Monthly Performance Hologram Card */}
            <View style={styles.monthSummaryCard}>
              <View style={styles.summaryLeft}>
                <Text style={styles.summaryMonth}>{format(currentMonth, 'MMMM yyyy')}</Text>
                <View style={styles.metricRow}>
                  <Text style={styles.summaryPercent}>{monthStats.percent}%</Text>
                  <View style={[styles.statusBadge, {backgroundColor: monthStats.percent >= 75 ? '#22C55E22' : '#EF444422'}]}>
                    <Text style={[styles.statusBadgeText, {color: monthStats.percent >= 75 ? '#22C55E' : '#EF4444'}]}>
                      {monthStats.percent >= 75 ? '🎯 On Track' : '⚠️ Need Recovery'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.summarySub}>
                  {monthStats.attendedHours}h attended of {monthStats.totalHeldHours}h held
                </Text>
              </View>

              <View style={styles.summaryStatsCol}>
                <View style={styles.miniStat}>
                  <Text style={[styles.miniStatNum, {color: Colors.present}]}>{monthStats.presentDays}</Text>
                  <Text style={styles.miniStatLabel}>Present Days</Text>
                </View>
                <View style={styles.miniStat}>
                  <Text style={[styles.miniStatNum, {color: Colors.absent}]}>{monthStats.absentDays}</Text>
                  <Text style={styles.miniStatLabel}>Absences</Text>
                </View>
              </View>
            </View>

            {/* Calendar Controls & Month Navigator */}
            <View style={styles.calendarNavRow}>
              <TouchableOpacity
                style={styles.navArrowBtn}
                onPress={() => {
                  ReactNativeHapticFeedback.trigger('impactLight');
                  setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
                }}>
                <Text style={styles.navArrowText}>‹</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.todayChip}
                onPress={() => {
                  ReactNativeHapticFeedback.trigger('impactLight');
                  const now = new Date();
                  setCurrentMonth(now);
                  setSelectedDate(format(now, 'yyyy-MM-dd'));
                }}>
                <Text style={styles.todayChipText}>🎯 Jump to Today</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.navArrowBtn}
                onPress={() => {
                  ReactNativeHapticFeedback.trigger('impactLight');
                  setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
                }}>
                <Text style={styles.navArrowText}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Day Labels */}
            <View style={styles.dayLabelsRow}>
              {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((d, i) => (
                <Text key={i} style={styles.dayLabelText}>{d}</Text>
              ))}
            </View>

            {/* Calendar Matrix Grid */}
            <View style={styles.calendarGrid}>
              {paddedDays.map((day, i) => {
                if (!day) return <View key={`pad-${i}`} style={styles.dayCellEmpty} />;

                const dateStr = format(day, 'yyyy-MM-dd');
                const isSelected = selectedDate === dateStr;
                const isCurrentToday = isToday(day);
                const color = getDayColor(dateStr);
                const dayClasses = instanceMap[dateStr] || [];
                const hasClasses = dayClasses.length > 0;

                return (
                  <AnimatedPressable
                    key={dateStr}
                    physics="bouncy"
                    scaleTo={0.88}
                    translateYOnPress={1.5}
                    hapticType="impactLight"
                    onPress={() => {
                      setSelectedDate(dateStr);
                    }}
                    style={[
                      styles.dayCell,
                      isSelected && styles.dayCellSelected,
                      isCurrentToday && !isSelected && styles.dayCellToday,
                      hasClasses && {backgroundColor: color + '22'},
                    ]}>
                    <Text style={[
                      styles.dayCellDateNumber,
                      isSelected && styles.dayCellDateSelected,
                      isCurrentToday && styles.dayCellDateToday,
                    ]}>
                      {format(day, 'd')}
                    </Text>

                    {/* Class Activity Status Bar/Dot */}
                    {hasClasses ? (
                      <View style={[styles.dayStatusPill, {backgroundColor: color}]}>
                        <Text style={styles.dayStatusCount}>{dayClasses.length}</Text>
                      </View>
                    ) : (
                      <View style={styles.emptyDot} />
                    )}
                  </AnimatedPressable>
                );
              })}
            </View>

            {/* Color Legend */}
            <View style={styles.legendContainer}>
              {[
                {color: Colors.heatmapPresent, label: 'All Present'},
                {color: Colors.heatmapAbsent, label: 'Has Absent'},
                {color: Colors.heatmapHoliday, label: 'Holiday'},
                {color: Colors.heatmapCancelled, label: 'Cancelled'},
                {color: Colors.heatmapNoClass, label: 'Free Day'},
              ].map(item => (
                <View key={item.label} style={styles.legendItem}>
                  <View style={[styles.legendDot, {backgroundColor: item.color}]} />
                  <Text style={styles.legendLabel}>{item.label}</Text>
                </View>
              ))}
            </View>

            {/* Interactive Day Inspector Card */}
            <View style={styles.inspectorCard}>
              <View style={styles.inspectorHeader}>
                <View>
                  <Text style={styles.inspectorTitle}>
                    {format(new Date(selectedDate), 'EEEE, d MMMM')}
                  </Text>
                  <Text style={styles.inspectorSubtitle}>
                    {selectedDayInstances.length} Class{selectedDayInstances.length !== 1 ? 'es' : ''} Scheduled
                  </Text>
                </View>

                {/* Bulk Actions for Selected Day with Spring Physics */}
                {selectedDayInstances.length > 0 && (
                  <View style={styles.bulkActionRow}>
                    <AnimatedPressable
                      physics="snappy"
                      scaleTo={0.92}
                      translateYOnPress={1.5}
                      style={styles.bulkBtnPresent}
                      onPress={() => handleMarkAllDay('present')}>
                      <Text style={styles.bulkBtnText}>All ✓</Text>
                    </AnimatedPressable>
                    <AnimatedPressable
                      physics="snappy"
                      scaleTo={0.92}
                      translateYOnPress={1.5}
                      style={styles.bulkBtnHoliday}
                      onPress={() => handleMarkAllDay('holiday')}>
                      <Text style={styles.bulkBtnText}>Holiday 🏖️</Text>
                    </AnimatedPressable>
                  </View>
                )}
              </View>

              {/* Class Instances for Selected Date */}
              {selectedDayInstances.length === 0 ? (
                <View style={styles.emptyDayWrap}>
                  <Text style={styles.emptyDayIcon}>☕</Text>
                  <Text style={styles.emptyDayTitle}>No Classes Scheduled</Text>
                  <Text style={styles.emptyDaySub}>Enjoy your free time or revise upcoming topics.</Text>
                </View>
              ) : (
                selectedDayInstances.map(cls => {
                  const subjectColor = cls.subject?.color || Colors.primary;
                  const isLab = cls.subject?.subject_type === 'lab';
                  const duration = calculateDurationHours(cls.start_time, cls.end_time);

                  return (
                    <View key={cls.id} style={styles.classItemCard}>
                      <View style={[styles.classColorStrip, {backgroundColor: subjectColor}]} />
                      <View style={styles.classItemContent}>
                        <View style={styles.classItemTop}>
                          <Text style={styles.classSubjectName} numberOfLines={1}>
                            {cls.subject?.name || 'Class'}
                          </Text>
                          <View style={[styles.classTypeBadge, {backgroundColor: isLab ? '#0891B222' : '#8B5CF622'}]}>
                            <Text style={[styles.classTypeBadgeText, {color: isLab ? '#06B6D4' : '#A78BFA'}]}>
                              {isLab ? '🧪 Lab' : '📚 Theory'} • {duration}h
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.classTimeText}>
                          ⏱️ {cls.start_time} – {cls.end_time} {cls.room ? `• 📍 ${cls.room}` : ''}
                        </Text>

                        {/* Interactive 1-Tap Attendance Buttons with Physics */}
                        <View style={styles.statusButtonsRow}>
                          {(['present', 'absent', 'holiday', 'cancelled'] as AttendanceStatus[]).map(statusKey => {
                            const isSelected = cls.status === statusKey;
                            const statusColor = getStatusColor(statusKey);
                            return (
                              <AnimatedPressable
                                key={statusKey}
                                physics="bouncy"
                                scaleTo={0.92}
                                translateYOnPress={1.5}
                                style={[
                                  styles.quickStatusBtn,
                                  isSelected && {backgroundColor: statusColor, borderColor: statusColor},
                                ]}
                                onPress={() => handleUpdateStatus(cls.id, statusKey)}>
                                <Text style={[
                                  styles.quickStatusBtnText,
                                  isSelected && {color: '#FFFFFF', fontWeight: '800'},
                                ]}>
                                  {STATUS_ICONS[statusKey]} {statusKey.charAt(0).toUpperCase() + statusKey.slice(1)}
                                </Text>
                              </AnimatedPressable>
                            );
                          })}
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </>
        ) : (
          /* Annual LeetCode Streak Heatmap */
          <View style={styles.annualSection}>
            <LeetCodeAttendanceHeatmap
              activityMatrix={activityReport.activityMatrix}
              currentStreak={activityReport.currentStreak}
              longestStreak={activityReport.longestStreak}
              activeDaysCount={activityReport.activeDaysCount}
              weeksCount={20}
            />
          </View>
        )}
        <View style={{height: 100}} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05050A',
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A28',
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#F4F4FF',
    letterSpacing: 0.5,
  },
  screenSubtitle: {
    fontSize: 12,
    color: '#8B5CF6',
    fontWeight: '600',
    marginTop: 2,
  },
  tabSwitchContainer: {
    flexDirection: 'row',
    backgroundColor: '#12121E',
    borderRadius: 20,
    padding: 3,
    borderWidth: 1,
    borderColor: '#26263B',
  },
  tabSwitchBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tabSwitchActive: {
    backgroundColor: '#8B5CF6',
  },
  tabSwitchText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8EA8',
  },
  tabSwitchTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  monthSummaryCard: {
    flexDirection: 'row',
    backgroundColor: '#0F0F1A',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
    shadowColor: '#8B5CF6',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
    marginBottom: 14,
  },
  summaryLeft: {
    flex: 1,
  },
  summaryMonth: {
    fontSize: 13,
    color: '#8B5CF6',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  summaryPercent: {
    fontSize: 32,
    fontWeight: '900',
    color: '#F4F4FF',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  summarySub: {
    fontSize: 12,
    color: '#9494B8',
    marginTop: 4,
  },
  summaryStatsCol: {
    justifyContent: 'center',
    gap: 8,
    borderLeftWidth: 1,
    borderLeftColor: '#202035',
    paddingLeft: 14,
  },
  miniStat: {
    alignItems: 'center',
  },
  miniStatNum: {
    fontSize: 18,
    fontWeight: '900',
  },
  miniStatLabel: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
  },
  calendarNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  navArrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#151522',
    borderWidth: 1,
    borderColor: '#2A2A3E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrowText: {
    color: '#F4F4FF',
    fontSize: 22,
    fontWeight: '300',
  },
  todayChip: {
    backgroundColor: '#1E1B2E',
    borderWidth: 1,
    borderColor: '#8B5CF6',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  todayChipText: {
    color: '#E0E7FF',
    fontSize: 12,
    fontWeight: '700',
  },
  dayLabelsRow: {
    flexDirection: 'row',
    paddingBottom: 6,
  },
  dayLabelText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#0D0D16',
    borderRadius: 18,
    padding: 6,
    borderWidth: 1,
    borderColor: '#1E1E2E',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    marginVertical: 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayCellEmpty: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
  },
  dayCellSelected: {
    borderColor: '#A855F7',
    backgroundColor: '#1F1735',
    transform: [{scale: 1.08}],
    shadowColor: '#A855F7',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 8,
  },
  dayCellToday: {
    borderColor: '#38BDF8',
  },
  dayCellDateNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B8B8D0',
  },
  dayCellDateSelected: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  dayCellDateToday: {
    color: '#38BDF8',
    fontWeight: '800',
  },
  dayStatusPill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    marginTop: 2,
    minWidth: 14,
    alignItems: 'center',
  },
  dayStatusCount: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  emptyDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'transparent',
    marginTop: 2,
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 11,
    color: '#8E8EA8',
    fontWeight: '600',
  },
  inspectorCard: {
    backgroundColor: '#0F0F1A',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#26263C',
    marginTop: 6,
  },
  inspectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E2E',
    marginBottom: 12,
  },
  inspectorTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F4F4FF',
  },
  inspectorSubtitle: {
    fontSize: 12,
    color: '#8B5CF6',
    fontWeight: '600',
    marginTop: 2,
  },
  bulkActionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  bulkBtnPresent: {
    backgroundColor: '#22C55E22',
    borderWidth: 1,
    borderColor: '#22C55E66',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bulkBtnHoliday: {
    backgroundColor: '#3B82F622',
    borderWidth: 1,
    borderColor: '#3B82F666',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bulkBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F4F4FF',
  },
  emptyDayWrap: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyDayIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyDayTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F4F4FF',
  },
  emptyDaySub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  classItemCard: {
    flexDirection: 'row',
    backgroundColor: '#141422',
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#222238',
  },
  classColorStrip: {
    width: 5,
  },
  classItemContent: {
    flex: 1,
    padding: 12,
  },
  classItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  classSubjectName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F4F4FF',
    flex: 1,
  },
  classTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  classTypeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  classTimeText: {
    fontSize: 12,
    color: '#9494B8',
    marginTop: 4,
  },
  statusButtonsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  quickStatusBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2E2E48',
    backgroundColor: '#181828',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickStatusBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B8B8D0',
  },
  annualSection: {
    paddingTop: 4,
  },
});
