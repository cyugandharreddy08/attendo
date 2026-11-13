import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Alert,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation, useIsFocused} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {format, addDays, startOfWeek, isToday} from 'date-fns';
import DayBulkActionSheet from '../components/DayBulkActionSheet';
import {
  getInstancesByDate,
  getInstancesForWeek,
  updateInstanceStatus,
  markEntireDayHoliday,
  markEntireDayStatus,
  shiftLectureInstance,
  unshiftLectureInstance,
  swapLectureInstances,
  deleteSingleInstance,
  getOverallAttendanceStats,
  getOverallStreak,
  getTheoryAndLabAttendanceStats,
  SplitAttendanceStats,
} from '../db/queries/lectureInstances';
import {deleteTimetableEntry, clearClassesForDay} from '../db/queries/timetable';
import {executeSql, rowsToArray} from '../db/database';
import {TimetableEntry, RootStackParamList, LectureInstance, AttendanceStatus} from '../types';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import Toast from 'react-native-toast-message';
import AnimatedPressable from '../components/AnimatedPressable';
import HeroDashboardCard from '../components/HeroDashboardCard';
import TimetableSplitStatsCard from '../components/TimetableSplitStatsCard';
import LectureCard from '../components/LectureCard';
import StatusBottomSheet from '../components/StatusBottomSheet';
import RescheduleBottomSheet from '../components/RescheduleBottomSheet';
import UndoToast from '../components/UndoToast';
import BunkSimulatorModal from '../components/BunkSimulatorModal';
import AchievementsModal from '../components/AchievementsModal';
import {Colors, getStatusColor} from '../theme/colors';
import {Spacing} from '../theme/spacing';
import {Typography} from '../theme/typography';

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FULL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function getWeekDates(today: Date) {
  const monday = startOfWeek(today, {weekStartsOn: 1});
  return Array.from({length: 7}, (_, i) => addDays(monday, i));
}

type NavProp = NativeStackNavigationProp<RootStackParamList>;

interface PeriodSlot {
  id: string; // e.g. "08:45-09:55"
  startTime: string;
  endTime: string;
  label: string;
}

export default function TimetableScreen() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const navigation = useNavigation<NavProp>();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [lectures, setLectures] = useState<LectureInstance[]>([]);
  const [weekLectures, setWeekLectures] = useState<LectureInstance[]>([]);
  const [activeLecture, setActiveLecture] = useState<LectureInstance | null>(null);
  const [shiftLecture, setShiftLecture] = useState<LectureInstance | null>(null);
  const [swapSource, setSwapSource] = useState<LectureInstance | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [shiftSheetVisible, setShiftSheetVisible] = useState(false);
  const [bulkSheetVisible, setBulkSheetVisible] = useState(false);
  const [bulkDate, setBulkDate] = useState<Date>(new Date());
  const [bunkModalVisible, setBunkModalVisible] = useState(false);
  const [achievementsModalVisible, setAchievementsModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [undoData, setUndoData] = useState<{lecture: LectureInstance; prevStatus: AttendanceStatus | null} | null>(null);
  const weekDates = getWeekDates(selectedDate);

  const [streakCount, setStreakCount] = useState(0);
  const [splitStats, setSplitStats] = useState<SplitAttendanceStats | null>(null);

  const [overallStats, setOverallStats] = useState({
    totalPercent: 0,
    totalClasses: 0,
    maxBunkable: 0,
    isInDanger: false,
  });

  const loadLectures = useCallback(async () => {
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const [dayData, weekData, overall, streak, split] = await Promise.all([
        getInstancesByDate(dateStr),
        getInstancesForWeek(selectedDate),
        getOverallAttendanceStats(75),
        getOverallStreak(),
        getTheoryAndLabAttendanceStats(75),
      ]);
      setLectures(dayData ?? []);
      setWeekLectures(weekData ?? []);
      setOverallStats(overall);
      setStreakCount(streak);
      setSplitStats(split);
    } catch (e) {
      console.error('Error loading lectures:', e);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (isFocused) {
      loadLectures();
    }
  }, [isFocused, loadLectures]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadLectures();
    setRefreshing(false);
  }, [loadLectures]);

  // Dynamically extract NON-OVERLAPPING Atomic Period Slots (e.g. P1: 08:55-09:45, P2: 09:45-10:35)
  const periodSlots = useMemo<PeriodSlot[]>(() => {
    const rawTimes = new Set<string>();

    weekLectures.forEach(l => {
      if (l.start_time) rawTimes.add(l.start_time);
      if (l.end_time) rawTimes.add(l.end_time);
    });

    const sortedTimes = Array.from(rawTimes).sort();

    const slots: PeriodSlot[] = [];
    if (sortedTimes.length >= 2) {
      for (let i = 0; i < sortedTimes.length - 1; i++) {
        const start = sortedTimes[i];
        const end = sortedTimes[i + 1];
        const coversAnyClass = weekLectures.some(
          l => l.start_time <= start && l.end_time >= end,
        );
        if (coversAnyClass) {
          slots.push({
            id: `${start}-${end}`,
            startTime: start,
            endTime: end,
            label: `P${slots.length + 1}`,
          });
        }
      }
    }

    // Fallback to default slots ONLY if no classes exist in the entire week
    if (slots.length === 0) {
      const defaults = [
        {startTime: '09:00', endTime: '10:00'},
        {startTime: '10:00', endTime: '11:00'},
        {startTime: '11:15', endTime: '12:15'},
        {startTime: '13:15', endTime: '14:15'},
        {startTime: '14:15', endTime: '15:15'},
      ];
      return defaults.map((d, idx) => ({
        id: `${d.startTime}-${d.endTime}`,
        startTime: d.startTime,
        endTime: d.endTime,
        label: `P${idx + 1}`,
      }));
    }

    return slots;
  }, [weekLectures]);

  const handleCardPress = (lecture: LectureInstance) => {
    if (swapSource) {
      if (swapSource.id === lecture.id) {
        setSwapSource(null);
        return;
      }
      Alert.alert(
        'Swap Classes',
        `Swap "${swapSource.subject?.name ?? 'Class'}" (${swapSource.date}) with "${lecture.subject?.name ?? 'Class'}" (${lecture.date})?`,
        [
          {text: 'Cancel', style: 'cancel', onPress: () => setSwapSource(null)},
          {
            text: 'Swap',
            onPress: async () => {
              await swapLectureInstances(swapSource.id, lecture.id);
              setSwapSource(null);
              await loadLectures();
              Alert.alert('🔄 Classes Swapped!', `Interchanged "${swapSource.subject?.name ?? 'Class'}" and "${lecture.subject?.name ?? 'Class'}"`);
            },
          },
        ],
      );
      return;
    }
    setActiveLecture(lecture);
    setSheetVisible(true);
  };

  const handleGridSlotPress = async (dayDateStr: string, slot: PeriodSlot) => {
    if (swapSource) {
      await shiftLectureInstance(
        swapSource.id,
        dayDateStr,
        slot.startTime,
        slot.endTime,
        'Moved to empty slot',
      );
      setSwapSource(null);
      await loadLectures();
      Alert.alert('Class Moved!', `Shifted to ${dayDateStr} (${slot.startTime} – ${slot.endTime})`);
    } else {
      navigation.navigate('AddTimetableEntry', {});
    }
  };

  const handleLongPress = (lecture: LectureInstance) => {
    setSwapSource(lecture);
    Alert.alert(
      'Interchange / Shift Mode',
      `Selected "${lecture.subject?.name ?? 'Class'}". Tap any slot in the grid to SWAP or MOVE it!`,
      [{text: 'OK'}],
    );
  };

  const handleStatusSelect = async (status: AttendanceStatus) => {
    if (!activeLecture) return;
    if (status === 'shifted') {
      setSheetVisible(false);
      setShiftLecture(activeLecture);
      setShiftSheetVisible(true);
      return;
    }
    const prevStatus = activeLecture.status;
    setSheetVisible(false);
    await updateInstanceStatus(activeLecture.id, status, prevStatus);
    setActiveLecture(null);
    setUndoData({lecture: activeLecture, prevStatus});
    await loadLectures();
  };

  const handleUnmarkActiveLecture = async () => {
    if (!activeLecture) return;
    setSheetVisible(false);
    await updateInstanceStatus(activeLecture.id, null as any, activeLecture.status);
    setActiveLecture(null);
    Toast.show({
      type: 'info',
      text1: 'Status Unmarked',
      text2: 'Class attendance status has been reset to unmarked.',
    });
    await loadLectures();
  };

  const handleConfirmShift = async (newDate: string, newStartTime: string, newEndTime: string, reason: string, isPermanent: boolean = false) => {
    if (!shiftLecture) return;
    await shiftLectureInstance(shiftLecture.id, newDate, newStartTime, newEndTime, reason, isPermanent);
    setShiftSheetVisible(false);
    setShiftLecture(null);
    await loadLectures();
    Alert.alert(
      isPermanent ? '🔄 Permanent Shift Applied!' : '📅 One-Time Shift Applied!',
      `Moved to ${newDate} at ${newStartTime}${isPermanent ? ' (Weekly schedule updated)' : ''}`,
    );
  };

  const openBulkSheetForDate = (date: Date) => {
    setBulkDate(date);
    setBulkSheetVisible(true);
  };

  const handleBulkMark = async (status: AttendanceStatus, reason: string = '') => {
    const dateStr = format(bulkDate, 'yyyy-MM-dd');
    if (status === 'holiday') {
      await markEntireDayHoliday(dateStr, reason);
    } else {
      await markEntireDayStatus(dateStr, status, reason);
    }
    await loadLectures();
  };

  const handleUndo = async () => {
    if (!undoData) return;
    await updateInstanceStatus(undoData.lecture.id, undoData.prevStatus as AttendanceStatus);
    setUndoData(null);
    await loadLectures();
  };

  const handleEditActiveLecture = async () => {
    if (!activeLecture) return;
    const current = activeLecture;
    setSheetVisible(false);
    setActiveLecture(null);

    if (current.original_timetable_id) {
      const entryRes = await executeSql('SELECT * FROM timetable WHERE id = ?', [current.original_timetable_id]);
      const rows = rowsToArray<TimetableEntry>(entryRes);
      if (rows.length > 0) {
        navigation.navigate('AddTimetableEntry', {entry: rows[0]});
        return;
      }
    }

    navigation.navigate('AddTimetableEntry', {
      entry: {
        id: current.original_timetable_id ?? 0,
        subject_id: current.subject_id,
        day_of_week: current.day_of_week,
        start_time: current.start_time,
        end_time: current.end_time,
        room: current.room ?? '',
      },
    });
  };

  const handleDeleteActiveLecture = async () => {
    if (!activeLecture) return;
    const current = activeLecture;
    Alert.alert(
      'Delete Class',
      `Delete "${current.subject?.name ?? 'Class'}" on ${current.day_of_week} (${current.start_time} - ${current.end_time})?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSheetVisible(false);
            setActiveLecture(null);
            await deleteSingleInstance(current.id);
            await loadLectures();
          },
        },
      ],
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <TouchableOpacity onPress={() => openBulkSheetForDate(selectedDate)}>
          <Text style={styles.brandTitle}>ATTENDO <Text style={styles.v3Badge}>v8.0</Text></Text>
          <Text style={styles.monthLabel}>{format(selectedDate, 'EEEE, MMMM d, yyyy')} ⚙️</Text>
        </TouchableOpacity>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.headerActionsScroll}>
          <AnimatedPressable
            scaleTo={0.92}
            hapticType="impactLight"
            style={[styles.viewToggleBtn, viewMode === 'grid' && styles.viewToggleBtnActive]}
            onPress={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}>
            <Text style={styles.viewToggleText}>{viewMode === 'list' ? '🗺️ Grid' : '📱 List'}</Text>
          </AnimatedPressable>
          <AnimatedPressable
            scaleTo={0.92}
            hapticType="impactLight"
            style={[styles.holidayBtn, {borderColor: '#F59E0B66', backgroundColor: '#F59E0B15'}]}
            onPress={() => navigation.navigate('PublicProfile', {})}>
            <Text style={[styles.holidayBtnText, {color: '#F59E0B'}]}>🔥 {streakCount}d Streak</Text>
          </AnimatedPressable>
          <AnimatedPressable
            scaleTo={0.92}
            hapticType="impactLight"
            style={styles.holidayBtn}
            onPress={() => setBunkModalVisible(true)}>
            <Text style={styles.holidayBtnText}>🔮 Predict</Text>
          </AnimatedPressable>
          <AnimatedPressable
            scaleTo={0.92}
            hapticType="impactLight"
            style={styles.holidayBtn}
            onPress={() => setAchievementsModalVisible(true)}>
            <Text style={styles.holidayBtnText}>🏆 Badges</Text>
          </AnimatedPressable>
          <AnimatedPressable
            scaleTo={0.92}
            hapticType="impactLight"
            style={styles.holidayBtn}
            onPress={() => openBulkSheetForDate(selectedDate)}>
            <Text style={styles.holidayBtnText}>🌴 Holiday</Text>
          </AnimatedPressable>
          <AnimatedPressable
            scaleTo={0.92}
            glowOnPress={true}
            glowColor={Colors.primary}
            hapticType="impactMedium"
            style={styles.addBtn}
            onPress={() => navigation.navigate('AddTimetableEntry', {})}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </AnimatedPressable>
        </ScrollView>
      </View>

      {swapSource && (
        <View style={styles.swapBanner}>
          <Text style={styles.swapBannerText}>
            🔄 Selected "{swapSource.subject?.name ?? 'Class'}". Tap any target slot to SWAP / MOVE!
          </Text>
          <TouchableOpacity onPress={() => setSwapSource(null)}>
            <Text style={styles.swapCancel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Split Theory & Lab Attendance HUD Card */}
      <TimetableSplitStatsCard
        splitStats={splitStats}
        streakCount={streakCount}
        onPress={() => navigation.navigate('MainTabs' as any, {screen: 'Stats'})}
        onTheoryPress={() => navigation.navigate('MainTabs' as any, {screen: 'Stats'})}
        onLabPress={() => navigation.navigate('MainTabs' as any, {screen: 'Stats'})}
      />

      {/* Week Day Selector Strip */}
      <View style={styles.weekStrip}>
        {weekDates.map((date, i) => {
          const isSelected = format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
          const isTodayDate = isToday(date);
          return (
            <AnimatedPressable
              key={i}
              scaleTo={0.92}
              hapticType="selection"
              glowOnPress={true}
              glowColor="#A855F7"
              style={[
                styles.dayCell,
                isSelected && styles.dayCellSelected,
              ]}
              onPress={() => {
                setSelectedDate(date);
              }}>
              <Text style={[styles.dayName, isSelected && styles.dayNameSelected]}>
                {DAYS_OF_WEEK[i]}
              </Text>
              <Text style={[
                styles.dayNum,
                isSelected && styles.dayNumSelected,
                isTodayDate && !isSelected && styles.dayNumToday,
              ]}>
                {format(date, 'd')}
              </Text>
            </AnimatedPressable>
          );
        })}
      </View>
    </View>
  );

  /* v3.0 Advanced Dynamic Period Matrix Grid View */
  const renderFullGridView = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.gridContainer}>
        {/* Header Row (Time Labels) */}
        <View style={styles.gridHeaderRow}>
          <View style={styles.dayLabelCellHeader}>
            <Text style={styles.gridHeaderDayText}>DAY</Text>
          </View>
          {periodSlots.map(slot => (
            <View key={slot.id} style={styles.gridTimeHeaderCell}>
              <Text style={styles.gridPeriodLabel}>{slot.label}</Text>
              <Text style={styles.gridTimeRangeText}>
                {slot.startTime}–{slot.endTime}
              </Text>
            </View>
          ))}
        </View>

        {/* Vertical Days Rows */}
        {FULL_DAYS.map((fullDay, dayIdx) => {
          const dayDateStr = format(weekDates[dayIdx], 'yyyy-MM-dd');
          const isTodayRow = isToday(weekDates[dayIdx]);

          return (
            <View key={fullDay} style={[styles.gridRow, isTodayRow && styles.gridRowToday]}>
              {/* Day Vertical Label Cell */}
              <TouchableOpacity
                style={styles.dayLabelCell}
                onPress={() => openBulkSheetForDate(weekDates[dayIdx])}>
                <Text style={[styles.dayLabelText, isTodayRow && {color: Colors.primaryLight}]}>
                  {DAYS_OF_WEEK[dayIdx]}
                </Text>
                <Text style={styles.dayLabelDate}>{format(weekDates[dayIdx], 'd MMM')}</Text>
              </TouchableOpacity>

              {/* Period Slot Columns */}
              {periodSlots.map(slot => {
                const cellInsts = weekLectures.filter(l => {
                  if (l.date !== dayDateStr) return false;
                  // Class covers this atomic time slot
                  return l.start_time <= slot.startTime && l.end_time >= slot.endTime;
                });

                return (
                  <View key={slot.id} style={styles.gridCell}>
                    {cellInsts.length === 0 ? (
                      <TouchableOpacity
                        style={styles.gridEmptyCell}
                        onPress={() => handleGridSlotPress(dayDateStr, slot)}
                        activeOpacity={0.6}>
                        <Text style={styles.gridPlus}>+</Text>
                      </TouchableOpacity>
                    ) : (
                      cellInsts.map(inst => {
                        const statusColor = getStatusColor(inst.status);
                        const isSelectedSwap = swapSource?.id === inst.id;
                        const subjectColor = inst.subject?.color ?? Colors.primary;
                        const isStartSlot = inst.start_time === slot.startTime;
                        const isMultiPeriod = inst.start_time < slot.startTime || inst.end_time > slot.endTime;

                        return (
                          <TouchableOpacity
                            key={inst.id}
                            style={[
                              styles.gridCard,
                              {backgroundColor: subjectColor + '22', borderColor: subjectColor},
                              isSelectedSwap && styles.gridCardSelectedSwap,
                            ]}
                            onPress={() => handleCardPress(inst)}
                            onLongPress={() => handleLongPress(inst)}
                            activeOpacity={0.8}>
                            <View style={[styles.gridCardAccent, {backgroundColor: subjectColor}]} />
                            <View style={{flex: 1, paddingLeft: 4}}>
                              <Text style={styles.gridSubjectName} numberOfLines={1}>
                                {isStartSlot ? (inst.subject?.name ?? 'Subject') : `↳ ${inst.subject?.name ?? 'Subject'}`}
                              </Text>
                              <Text style={styles.gridTimeText}>
                                {inst.start_time}–{inst.end_time}
                              </Text>
                              {isMultiPeriod && (
                                <Text style={{color: Colors.primaryLight, fontSize: 9, fontWeight: '700'}}>
                                  {isStartSlot ? '⚡ 2-Period' : '↳ Cont.'}
                                </Text>
                              )}
                            </View>
                            {inst.status && (
                              <View style={[styles.gridStatusBadge, {backgroundColor: statusColor}]}>
                                <Text style={styles.gridStatusBadgeText}>
                                  {inst.status === 'present' ? '✓' : inst.status === 'absent' ? '✗' : inst.status === 'holiday' ? '☀' : '⊘'}
                                </Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </View>
                );
              })}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );

  const handleClearDayClasses = async () => {
    const dayName = format(bulkDate, 'EEEE');
    Alert.alert(
      'Clear Day Classes',
      `Delete all scheduled classes for ${dayName}?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await clearClassesForDay(dayName);
            await loadLectures();
          },
        },
      ],
    );
  };

  const handleUnshiftActiveLecture = async () => {
    if (!activeLecture) return;
    try {
      await unshiftLectureInstance(activeLecture.id);
      setSheetVisible(false);
      setActiveLecture(null);
      Toast.show({
        type: 'success',
        text1: 'Shift Reverted',
        text2: 'Class has been unshifted back to its original slot.',
      });
      await loadLectures();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      {viewMode === 'grid' ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
            />
          }>
          {renderHeader()}
          {renderFullGridView()}
        </ScrollView>
      ) : (
        <FlatList
          ListHeaderComponent={renderHeader}
          data={lectures}
          keyExtractor={item => String(item.id)}
          renderItem={({item}) => (
            <LectureCard
              lecture={item}
              onPress={() => handleCardPress(item)}
              onLongPress={() => handleLongPress(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No classes scheduled for {format(selectedDate, 'EEEE')}</Text>
              <Text style={styles.emptySubtext}>Enjoy your free day or tap + Add to schedule a class!</Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
            />
          }
          contentContainerStyle={styles.list}
        />
      )}

      <StatusBottomSheet
        lecture={activeLecture}
        isVisible={sheetVisible}
        onSelect={handleStatusSelect}
        onEdit={handleEditActiveLecture}
        onDelete={handleDeleteActiveLecture}
        onUnshift={handleUnshiftActiveLecture}
        onUnmark={handleUnmarkActiveLecture}
        onClose={() => {
          setSheetVisible(false);
          setActiveLecture(null);
        }}
      />

      <RescheduleBottomSheet
        lecture={shiftLecture}
        isVisible={shiftSheetVisible}
        onConfirm={handleConfirmShift}
        onClose={() => {
          setShiftSheetVisible(false);
          setShiftLecture(null);
        }}
      />

      <DayBulkActionSheet
        dateStr={format(bulkDate, 'EEEE, MMMM d, yyyy')}
        isVisible={bulkSheetVisible}
        onClose={() => setBulkSheetVisible(false)}
        onMarkAll={handleBulkMark}
        onClearDayClasses={handleClearDayClasses}
      />

      <BunkSimulatorModal
        isVisible={bunkModalVisible}
        onClose={() => setBunkModalVisible(false)}
      />

      <AchievementsModal
        isVisible={achievementsModalVisible}
        onClose={() => setAchievementsModalVisible(false)}
      />

      {undoData && (
        <UndoToast
          message={`Marked as ${undoData.prevStatus ?? 'unmarked'}`}
          onUndo={handleUndo}
          onDismiss={() => setUndoData(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#06060A',
  },
  header: {
    backgroundColor: Colors.card,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.screenPad,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  v3Badge: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primaryLight,
    backgroundColor: Colors.primary + '33',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  monthLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  headerActionsScroll: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    paddingRight: Spacing.screenPad,
  },
  viewToggleBtn: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  viewToggleBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '22',
  },
  viewToggleText: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  holidayBtn: {
    backgroundColor: Colors.holiday + '22',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.holiday + '44',
  },
  holidayBtnText: {
    color: Colors.holiday,
    fontSize: 12,
    fontWeight: '600',
  },
  addBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  swapBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.primary + '33',
    paddingHorizontal: Spacing.screenPad,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    marginHorizontal: Spacing.screenPad,
    borderRadius: 8,
    marginTop: 4,
  },
  swapBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
  },
  swapCancel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.absent,
    marginLeft: 8,
  },
  weekStrip: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#090B14',
    borderRadius: 16,
    marginHorizontal: Spacing.screenPad,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: '#191D2C',
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 12,
  },
  dayCellSelected: {
    backgroundColor: '#7C3AED',
    shadowColor: '#7C3AED',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  dayName: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  dayNameSelected: {
    color: '#fff',
  },
  dayNum: {
    ...Typography.h4,
    marginTop: 2,
  },
  dayNumSelected: {
    color: '#fff',
  },
  dayNumToday: {
    color: Colors.primary,
  },
  list: {
    paddingBottom: 100,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyText: {
    ...Typography.h4,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  emptySubtext: {
    ...Typography.body2,
    marginTop: 8,
    textAlign: 'center',
    color: Colors.textMuted,
  },

  /* Dynamic Period Matrix Grid View Styles */
  gridScrollView: {
    flex: 1,
  },
  gridContainer: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginHorizontal: 8,
    marginVertical: 12,
  },
  gridHeaderRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'center',
  },
  dayLabelCellHeader: {
    width: 90,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    marginRight: 4,
  },
  gridHeaderDayText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  gridTimeHeaderCell: {
    width: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: 6,
    borderRadius: 8,
    marginHorizontal: 2,
  },
  gridPeriodLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primaryLight,
  },
  gridTimeRangeText: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },
  gridRow: {
    flexDirection: 'row',
    marginBottom: 6,
    alignItems: 'center',
  },
  gridRowToday: {
    backgroundColor: Colors.primary + '10',
    borderRadius: 8,
  },
  dayLabelCell: {
    width: 90,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    marginRight: 4,
    justifyContent: 'center',
  },
  dayLabelText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  dayLabelDate: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  gridCell: {
    width: 100,
    height: 56,
    marginHorizontal: 2,
    justifyContent: 'center',
  },
  gridEmptyCell: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface + '33',
  },
  gridPlus: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  gridCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  gridCardAccent: {
    width: 3,
    height: '100%',
    borderRadius: 2,
  },
  gridCardSelectedSwap: {
    borderColor: '#EC4899',
    borderWidth: 2,
    backgroundColor: '#EC489944',
  },
  gridSubjectName: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  gridTimeText: {
    fontSize: 9,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  gridStatusBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridStatusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFF',
  },
});
