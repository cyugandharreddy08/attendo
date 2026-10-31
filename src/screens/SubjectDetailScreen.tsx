import React, {useState, useEffect, useCallback} from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import {format, parseISO, eachMonthOfInterval, startOfMonth, endOfMonth, eachDayOfInterval, getDay} from 'date-fns';
import {Colors} from '../theme/colors';
import {Spacing} from '../theme/spacing';
import {getSubjectById, toggleSubjectFreeze} from '../db/queries/subjects';
import {executeSql} from '../db/database';
import {getInstancesForSubject, getAttendanceStats, getSubjectStreak} from '../db/queries/lectureInstances';
import {Subject, LectureInstance, AttendanceStats} from '../types';
import CircularProgress from '../components/CircularProgress';
import { BunkCalculator } from '../features/BunkCalculator';

export default function SubjectDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const {subjectId, subjectName} = route.params;

  const [subject, setSubject] = useState<Subject | null>(null);
  const [instances, setInstances] = useState<LectureInstance[]>([]);
  const [streak, setStreak] = useState<number>(0);
  const [stats, setStats] = useState<AttendanceStats>({
    total: 0, attended: 0, absent: 0, holiday: 0, cancelled: 0,
    percent: 100, maxBunkable: 0, neededToTarget: 0, isInDangerZone: false, statusMessage: '',
  });
  const [expandedMonth, setExpandedMonth] = useState<string | null>(
    format(new Date(), 'yyyy-MM'),
  );

  const loadData = useCallback(async () => {
    try {
      const [subj, insts, strk] = await Promise.all([
        getSubjectById(subjectId),
        getInstancesForSubject(subjectId),
        getSubjectStreak(subjectId),
      ]);
      setSubject(subj);
      setInstances(insts);
      setStreak(strk);
      if (subj) {
        const s = await getAttendanceStats(subjectId, subj.target_percent);
        setStats(s);
      }
    } catch (e) {
      console.error('Failed to load subject detail:', e);
    }
  }, [subjectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleFreeze = async () => {
    if (!subject) return;
    await toggleSubjectFreeze(subject.id, subject.is_frozen);
    await loadData();
  };

  const handleToggleCategory = async () => {
    if (!subject) return;
    const newType = (subject.subject_type || 'theory') === 'theory' ? 'lab' : 'theory';
    await executeSql('UPDATE subjects SET subject_type = ? WHERE id = ?', [newType, subject.id]);
    await loadData();
    Alert.alert(
      'Category Updated',
      `"${subject.name}" is now marked as ${newType === 'lab' ? '🧪 Lab / Practical' : '📚 Theory Class'}.`,
    );
  };

  const subjectColor = subject?.color ?? Colors.primary;
  const isFrozen = subject?.is_frozen === 1;

  const instancesByDate: Record<string, LectureInstance[]> = {};
  instances.forEach(inst => {
    if (!instancesByDate[inst.date]) instancesByDate[inst.date] = [];
    instancesByDate[inst.date].push(inst);
  });

  const dates = instances.map(i => parseISO(i.date));
  const minDate = dates.length > 0 ? dates.reduce((a, b) => (a < b ? a : b)) : new Date();
  const maxDate = dates.length > 0 ? dates.reduce((a, b) => (a > b ? a : b)) : new Date();

  const months = eachMonthOfInterval({start: startOfMonth(minDate), end: startOfMonth(maxDate)}).reverse();

  const getDateStatusColor = (date: string): string => {
    const dayInsts = instancesByDate[date];
    if (!dayInsts || dayInsts.length === 0) return 'transparent';
    const hasAbsent = dayInsts.some(i => i.status === 'absent');
    const allPresent = dayInsts.every(i => i.status === 'present');
    const allHoliday = dayInsts.every(i => i.status === 'holiday');
    const allCancelled = dayInsts.every(i => i.status === 'cancelled');
    if (allPresent) return Colors.present;
    if (allHoliday) return Colors.holiday;
    if (allCancelled) return Colors.cancelled;
    if (hasAbsent) return Colors.absent;
    return Colors.textMuted;
  };

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹ Back</Text>
        </TouchableOpacity>

        <View style={{flexDirection: 'row', gap: 8}}>
          <TouchableOpacity onPress={handleToggleCategory} style={[styles.freezeBtn, {borderColor: subject?.subject_type === 'lab' ? Colors.present : Colors.primary}]}>
            <Text style={[styles.freezeBtnText, {color: subject?.subject_type === 'lab' ? Colors.present : Colors.primaryLight}]}>
              {subject?.subject_type === 'lab' ? '🧪 Lab' : '📚 Theory'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleToggleFreeze} style={styles.freezeBtn}>
            <Text style={styles.freezeBtnText}>{isFrozen ? '☀️ Unfreeze' : '❄️ Freeze'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('AddSubject', {subject})}
            style={styles.editBtn}>
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Subject title */}
        <View style={styles.titleRow}>
          <View style={[styles.titleBar, {backgroundColor: isFrozen ? Colors.textMuted : subjectColor}]} />
          <View style={{flex: 1}}>
            <View style={{flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6}}>
              <Text style={styles.subjectTitle}>{subjectName}</Text>
              {streak > 0 && !isFrozen && (
                <View style={styles.streakBadge}>
                  <Text style={styles.streakText}>🔥 {streak} Streak</Text>
                </View>
              )}
            </View>
            {isFrozen && <Text style={styles.frozenSubtext}>❄️ Subject Frozen (Leisure)</Text>}
          </View>
        </View>

        {/* Stats card */}
        <View style={styles.statsCard}>
          <View style={styles.statsLeft}>
            <CircularProgress
              percent={stats.percent}
              size={110}
              strokeWidth={12}
              showLabel={true}
            />
          </View>
          <View style={styles.statsRight}>
            <StatRow label="Attended" value={stats.attended} color={Colors.present} />
            <StatRow label="Absent" value={stats.absent} color={Colors.absent} />
            <StatRow label="Holiday" value={stats.holiday} color={Colors.holiday} />
            <StatRow label="Cancelled" value={stats.cancelled} color={Colors.cancelled} />
            <StatRow label="Total" value={stats.total} color={Colors.textSecondary} />
            {subject && subject.past_total > 0 && (
              <Text style={styles.pastText}>Includes {subject.past_attended}/{subject.past_total} past classes</Text>
            )}
          </View>
        </View>

        {/* Danger zone / bunk info */}
        {isFrozen ? (
          <View style={styles.frozenCard}>
            <Text style={styles.frozenIcon}>❄️</Text>
            <View style={styles.bunkContent}>
              <Text style={styles.frozenCardTitle}>Subject Frozen</Text>
              <Text style={styles.bunkText}>No new classes are generated for this subject.</Text>
            </View>
          </View>
        ) : stats.isInDangerZone ? (
          <View style={styles.dangerZone}>
            <Text style={styles.dangerIcon}>⚠️</Text>
            <View style={styles.dangerContent}>
              <Text style={styles.dangerTitle}>Below Target ({subject?.target_percent}%)!</Text>
              <Text style={styles.dangerText}>{stats.statusMessage}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.bunkCard}>
            <Text style={styles.bunkIcon}>🎉</Text>
            <View style={styles.bunkContent}>
              <Text style={styles.bunkTitle}>{stats.statusMessage}</Text>
              <Text style={styles.bunkText}>Target: {subject?.target_percent}%</Text>
            </View>
          </View>
        )}

        {/* Bunk Simulator */}
        {!isFrozen && (
          <BunkCalculator
            attended={stats.attended}
            total={stats.total}
            targetPercent={subject?.target_percent || 75}
          />
        )}

        {/* History calendar */}
        <Text style={styles.sectionTitle}>Attendance History</Text>
        {months.map(monthDate => {
          const monthKey = format(monthDate, 'yyyy-MM');
          const monthLabel = format(monthDate, 'MMMM yyyy');
          const isExpanded = expandedMonth === monthKey;
          const monthStart = startOfMonth(monthDate);
          const monthEnd = endOfMonth(monthDate);
          const daysInMonth = eachDayOfInterval({start: monthStart, end: monthEnd});
          const firstDayOfWeek = (getDay(monthStart) + 6) % 7; // Mon=0

          return (
            <View key={monthKey} style={styles.monthBlock}>
              <TouchableOpacity
                style={styles.monthHeader}
                onPress={() => setExpandedMonth(isExpanded ? null : monthKey)}>
                <Text style={styles.monthTitle}>{monthLabel}</Text>
                <Text style={styles.monthChevron}>{isExpanded ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {isExpanded && (
                <View style={styles.calendarGrid}>
                  {/* Day labels */}
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                    <View key={i} style={styles.calCell}>
                      <Text style={styles.calDayLabel}>{d}</Text>
                    </View>
                  ))}
                  {/* Empty cells for first week offset */}
                  {Array.from({length: firstDayOfWeek}).map((_, i) => (
                    <View key={`empty-${i}`} style={styles.calCell} />
                  ))}
                  {/* Day cells */}
                  {daysInMonth.map(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const color = getDateStatusColor(dateStr);
                    return (
                      <View key={dateStr} style={styles.calCell}>
                        <View
                          style={[
                            styles.calDot,
                            {backgroundColor: color !== 'transparent' ? color + '33' : 'transparent'},
                            color !== 'transparent' && {borderColor: color, borderWidth: 1},
                          ]}>
                          <Text
                            style={[
                              styles.calDateText,
                              {color: color !== 'transparent' ? color : Colors.textMuted},
                            ]}>
                            {format(day, 'd')}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
        <View style={{height: 100}} />
      </ScrollView>
    </View>
  );
}

function StatRow({label, value, color}: {label: string; value: number; color: string}) {
  return (
    <View style={statStyles.row}>
      <View style={[statStyles.dot, {backgroundColor: color}]} />
      <Text style={statStyles.label}>{label}</Text>
      <Text style={[statStyles.value, {color}]}>{value}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 8},
  dot: {width: 8, height: 8, borderRadius: 4},
  label: {flex: 1, fontSize: 13, color: Colors.textSecondary},
  value: {fontSize: 14, fontWeight: '700'},
});

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.screenPad, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
  },
  backBtn: {padding: 8},
  backBtnText: {fontSize: 17, color: Colors.primary, fontWeight: '600'},
  freezeBtn: {
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  freezeBtnText: {fontSize: 13, color: Colors.holiday, fontWeight: '600'},
  editBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  editBtnText: {fontSize: 14, color: Colors.textPrimary, fontWeight: '600'},
  titleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: Spacing.screenPad, marginBottom: Spacing.md,
  },
  titleBar: {width: 5, height: 32, borderRadius: 3},
  subjectTitle: {fontSize: 24, fontWeight: '800', color: Colors.textPrimary},
  frozenSubtext: {fontSize: 12, color: Colors.holiday, marginTop: 2},
  statsCard: {
    flexDirection: 'row', backgroundColor: Colors.card,
    marginHorizontal: Spacing.screenPad, borderRadius: Spacing.cardRadius,
    padding: Spacing.md, gap: 16, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  statsLeft: {alignItems: 'center', justifyContent: 'center'},
  statsRight: {flex: 1, justifyContent: 'center'},
  pastText: {fontSize: 11, color: Colors.textMuted, marginTop: 4, fontStyle: 'italic'},
  dangerZone: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.absent + '18', marginHorizontal: Spacing.screenPad,
    borderRadius: 12, padding: 14, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.absent + '44',
  },
  dangerIcon: {fontSize: 24},
  dangerContent: {flex: 1},
  dangerTitle: {fontSize: 15, fontWeight: '700', color: Colors.absent},
  dangerText: {fontSize: 13, color: Colors.textSecondary, marginTop: 2, lineHeight: 18},
  bunkCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.present + '18', marginHorizontal: Spacing.screenPad,
    borderRadius: 12, padding: 14, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.present + '44',
  },
  bunkIcon: {fontSize: 24},
  bunkContent: {flex: 1},
  bunkTitle: {fontSize: 15, fontWeight: '700', color: Colors.present},
  bunkText: {fontSize: 13, color: Colors.textSecondary, marginTop: 2},
  frozenCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.holiday + '18', marginHorizontal: Spacing.screenPad,
    borderRadius: 12, padding: 14, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.holiday + '44',
  },
  frozenIcon: {fontSize: 24},
  frozenCardTitle: {fontSize: 15, fontWeight: '700', color: Colors.holiday},
  sectionTitle: {
    fontSize: 18, fontWeight: '700', color: Colors.textPrimary,
    paddingHorizontal: Spacing.screenPad, marginTop: Spacing.md, marginBottom: Spacing.sm,
  },
  monthBlock: {
    marginHorizontal: Spacing.screenPad, marginBottom: 8,
    backgroundColor: Colors.card, borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.border,
  },
  monthHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 14,
  },
  monthTitle: {fontSize: 15, fontWeight: '700', color: Colors.textPrimary},
  monthChevron: {fontSize: 12, color: Colors.textMuted},
  calendarGrid: {
    flexDirection: 'row', flexWrap: 'wrap', padding: 8,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  calCell: {
    width: '14.28%', alignItems: 'center', paddingVertical: 3,
  },
  calDayLabel: {fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5},
  calDot: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  calDateText: {fontSize: 11, fontWeight: '600'},
  streakBadge: {
    backgroundColor: '#FF6B0022',
    borderColor: '#FF6B00',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  streakText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF8C00',
  },
});
