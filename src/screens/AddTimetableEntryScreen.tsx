import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList, Subject} from '../types';
import {getAllSubjects} from '../db/queries/subjects';
import {createTimetableEntry, updateTimetableEntry} from '../db/queries/timetable';
import {Colors} from '../theme/colors';
import {Spacing} from '../theme/spacing';
import {Typography} from '../theme/typography';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'AddTimetableEntry'>;

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function AddTimetableEntryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProps>();
  const existingEntry = route.params?.entry;
  const presetSubjectId = route.params?.subjectId;

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(
    existingEntry?.subject_id ?? presetSubjectId ?? null,
  );
  const [selectedDay, setSelectedDay] = useState(existingEntry?.day_of_week ?? 'Monday');
  const [startTime, setStartTime] = useState(existingEntry?.start_time ?? '09:00');
  const [endTime, setEndTime] = useState(existingEntry?.end_time ?? '10:00');
  const [room, setRoom] = useState(existingEntry?.room ?? '');
  const isEditing = !!existingEntry;

  useEffect(() => {
    getAllSubjects().then(setSubjects);
  }, []);

  const handleSave = async () => {
    if (!selectedSubjectId) {
      Alert.alert('Select a subject first');
      return;
    }
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      Alert.alert('Invalid Time', 'Please enter valid times in 24-hour HH:MM format (e.g. 09:30, 14:15).');
      return;
    }

    const [sH, sM] = startTime.split(':').map(Number);
    const [eH, eM] = endTime.split(':').map(Number);
    if ((eH * 60 + eM) <= (sH * 60 + sM)) {
      Alert.alert('Invalid Time Range', 'Class end time must be after the start time.');
      return;
    }
    if (isEditing && existingEntry) {
      await updateTimetableEntry(existingEntry.id, selectedDay, startTime, endTime, room);
    } else {
      await createTimetableEntry(selectedSubjectId, selectedDay, startTime, endTime, room);
    }
    navigation.goBack();
  };

  return (
    <ScrollView
      style={[styles.container, {paddingTop: insets.top}]}
      contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{isEditing ? 'Edit Class' : 'Add Class'}</Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={styles.saveText}>Save</Text>
        </TouchableOpacity>
      </View>

      {/* Subject picker */}
      <Text style={styles.label}>Subject</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        <View style={styles.chipRow}>
          {subjects.map(sub => (
            <TouchableOpacity
              key={sub.id}
              style={[
                styles.chip,
                {borderColor: sub.color},
                selectedSubjectId === sub.id && {backgroundColor: sub.color + '33'},
              ]}
              onPress={() => setSelectedSubjectId(sub.id)}>
              <View style={[styles.chipDot, {backgroundColor: sub.color}]} />
              <Text style={[
                styles.chipText,
                selectedSubjectId === sub.id && {color: sub.color},
              ]}>
                {sub.name}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[styles.chip, {borderColor: Colors.primary, backgroundColor: Colors.primary + '22'}]}
            onPress={() => navigation.navigate('AddSubject', {})}>
            <Text style={[styles.chipText, {color: Colors.primaryLight, fontWeight: '700'}]}>
              + New Subject
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Day picker */}
      <Text style={styles.label}>Day</Text>
      <View style={styles.dayGrid}>
        {DAYS.map(day => (
          <TouchableOpacity
            key={day}
            style={[
              styles.dayChip,
              selectedDay === day && styles.dayChipSelected,
            ]}
            onPress={() => setSelectedDay(day)}>
            <Text style={[
              styles.dayChipText,
              selectedDay === day && styles.dayChipTextSelected,
            ]}>
              {day.slice(0, 3)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Time inputs */}
      <View style={styles.timeRow}>
        <View style={styles.timeField}>
          <Text style={styles.label}>Start Time</Text>
          <TextInput
            style={styles.input}
            value={startTime}
            onChangeText={setStartTime}
            placeholder="09:00"
            placeholderTextColor={Colors.textMuted}
            keyboardType="numbers-and-punctuation"
          />
        </View>
        <View style={styles.timeField}>
          <Text style={styles.label}>End Time</Text>
          <TextInput
            style={styles.input}
            value={endTime}
            onChangeText={setEndTime}
            placeholder="10:00"
            placeholderTextColor={Colors.textMuted}
            keyboardType="numbers-and-punctuation"
          />
        </View>
      </View>

      {/* Room */}
      <Text style={styles.label}>Room (optional)</Text>
      <TextInput
        style={styles.input}
        value={room}
        onChangeText={setRoom}
        placeholder="e.g. Room 201"
        placeholderTextColor={Colors.textMuted}
      />

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
        <Text style={styles.saveBtnText}>{isEditing ? 'Update Class' : 'Add Class'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.screenPad,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.card,
  },
  cancelText: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  title: {
    ...Typography.h3,
  },
  saveText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  label: {
    ...Typography.label,
    marginHorizontal: Spacing.screenPad,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  chipScroll: {
    paddingHorizontal: Spacing.screenPad,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: Spacing.screenPad,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: Colors.surface,
    gap: 6,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipText: {
    ...Typography.body2,
    color: Colors.textSecondary,
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: Spacing.screenPad,
  },
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '22',
  },
  dayChipText: {
    ...Typography.body2,
  },
  dayChipTextSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 0,
  },
  timeField: {
    flex: 1,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: Spacing.cardRadius,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: Spacing.screenPad,
    color: Colors.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  saveBtn: {
    margin: Spacing.screenPad,
    marginTop: Spacing.xl,
    backgroundColor: Colors.primary,
    borderRadius: Spacing.cardRadius,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
