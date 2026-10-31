import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableWithoutFeedback,
} from 'react-native';
import {format, addDays} from 'date-fns';
import {LectureInstance} from '../types';
import {Colors} from '../theme/colors';
import {Spacing} from '../theme/spacing';
import {Typography} from '../theme/typography';

interface Props {
  lecture: LectureInstance | null;
  onConfirm: (newDate: string, newStartTime: string, newEndTime: string, reason: string, isPermanent: boolean) => void;
  onClose: () => void;
  isVisible: boolean;
}

export default function RescheduleBottomSheet({lecture, onConfirm, onClose, isVisible}: Props) {
  const [targetDate, setTargetDate] = useState(lecture?.date ?? format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState(lecture?.start_time ?? '09:00');
  const [endTime, setEndTime] = useState(lecture?.end_time ?? '10:00');
  const [reason, setReason] = useState('');
  const [isPermanent, setIsPermanent] = useState(false);

  useEffect(() => {
    if (lecture) {
      setTargetDate(lecture.date);
      setStartTime(lecture.start_time);
      setEndTime(lecture.end_time);
    }
  }, [lecture]);

  if (!isVisible || !lecture) {
    return null;
  }

  const handleConfirm = () => {
    onConfirm(targetDate, startTime, endTime, reason, isPermanent);
    onClose();
  };

  const quickDates = [
    {label: 'Today', date: format(new Date(), 'yyyy-MM-dd')},
    {label: 'Tomorrow', date: format(addDays(new Date(), 1), 'yyyy-MM-dd')},
    {label: '+2 Days', date: format(addDays(new Date(), 2), 'yyyy-MM-dd')},
  ];

  return (
    <TouchableWithoutFeedback onPress={onClose}>
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={() => {}}>
          <View style={styles.sheetContainer}>
            <View style={styles.handle} />
            <Text style={styles.title}>Shift / Reschedule Class</Text>
            <Text style={styles.subtitle}>
              {lecture.subject?.name} · Originally {lecture.date} ({lecture.start_time})
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionLabel}>Target Date (YYYY-MM-DD)</Text>
              <View style={styles.quickRow}>
                {quickDates.map(item => (
                  <TouchableOpacity
                    key={item.date}
                    style={[
                      styles.quickChip,
                      targetDate === item.date && styles.quickChipSelected,
                    ]}
                    onPress={() => setTargetDate(item.date)}>
                    <Text
                      style={[
                        styles.quickChipText,
                        targetDate === item.date && styles.quickChipTextSelected,
                      ]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.input}
                value={targetDate}
                onChangeText={setTargetDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textMuted}
              />

              <View style={styles.timeRow}>
                <View style={{flex: 1}}>
                  <Text style={styles.sectionLabel}>New Start Time</Text>
                  <TextInput
                    style={styles.input}
                    value={startTime}
                    onChangeText={setStartTime}
                    placeholder="09:00"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
                <View style={{width: 12}} />
                <View style={{flex: 1}}>
                  <Text style={styles.sectionLabel}>New End Time</Text>
                  <TextInput
                    style={styles.input}
                    value={endTime}
                    onChangeText={setEndTime}
                    placeholder="10:00"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
              </View>

              <Text style={styles.sectionLabel}>Shift Scope / Frequency</Text>
              <View style={styles.quickRow}>
                <TouchableOpacity
                  style={[styles.quickChip, !isPermanent && styles.quickChipSelected]}
                  onPress={() => setIsPermanent(false)}>
                  <Text style={[styles.quickChipText, !isPermanent && styles.quickChipTextSelected]}>
                    📅 One-Time (This Date)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickChip, isPermanent && styles.quickChipSelected]}
                  onPress={() => setIsPermanent(true)}>
                  <Text style={[styles.quickChipText, isPermanent && styles.quickChipTextSelected]}>
                    🔄 Permanent (Weekly)
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
                <Text style={styles.confirmButtonText}>Confirm Shift</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.screenPad,
    paddingTop: 12,
    paddingBottom: 28,
    maxHeight: '85%',
    borderTopWidth: 1,
    borderColor: Colors.border,
    elevation: 24,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    ...Typography.h3,
    marginBottom: 2,
  },
  subtitle: {
    ...Typography.body2,
    marginBottom: Spacing.md,
  },
  sectionLabel: {
    ...Typography.label,
    marginBottom: Spacing.xs,
    marginTop: Spacing.sm,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '22',
  },
  quickChipText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  quickChipTextSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  timeRow: {
    flexDirection: 'row',
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Spacing.cardRadius,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputMultiline: {
    height: 64,
    textAlignVertical: 'top',
  },
  confirmButton: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: Spacing.cardRadius,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmButtonText: {
    ...Typography.h4,
    color: '#fff',
  },
  cancelButton: {
    marginTop: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...Typography.body2,
    color: Colors.textMuted,
  },
});
