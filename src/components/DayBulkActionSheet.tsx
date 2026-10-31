import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import {AttendanceStatus} from '../types';
import {Colors} from '../theme/colors';
import {Spacing} from '../theme/spacing';
import {Typography} from '../theme/typography';

interface Props {
  dateStr: string;
  isVisible: boolean;
  onClose: () => void;
  onMarkAll: (status: AttendanceStatus, reason?: string) => void;
  onClearDayClasses?: () => void;
}

export default function DayBulkActionSheet({
  dateStr,
  isVisible,
  onClose,
  onMarkAll,
  onClearDayClasses,
}: Props) {
  const [holidayReason, setHolidayReason] = useState('');
  const [showHolidayInput, setShowHolidayInput] = useState(false);

  if (!isVisible) return null;

  const handleHolidaySubmit = () => {
    onMarkAll('holiday', holidayReason.trim());
    setHolidayReason('');
    setShowHolidayInput(false);
    onClose();
  };

  return (
    <TouchableWithoutFeedback onPress={onClose}>
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={() => {}}>
          <View style={styles.sheetContainer}>
            <View style={styles.handle} />
            <Text style={styles.title}>Day Attendance Options</Text>
            <Text style={styles.subtitle}>{dateStr}</Text>

            {!showHolidayInput ? (
              <>
                <TouchableOpacity
                  style={[styles.optionCard, {borderColor: Colors.present}]}
                  onPress={() => {
                    onMarkAll('present');
                    onClose();
                  }}>
                  <Text style={styles.optionIcon}>✓</Text>
                  <View style={styles.optionTextContainer}>
                    <Text style={[styles.optionTitle, {color: Colors.present}]}>
                      Mark All Present
                    </Text>
                    <Text style={styles.optionDesc}>
                      Set all classes today as Present
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.optionCard, {borderColor: Colors.absent}]}
                  onPress={() => {
                    onMarkAll('absent');
                    onClose();
                  }}>
                  <Text style={styles.optionIcon}>✗</Text>
                  <View style={styles.optionTextContainer}>
                    <Text style={[styles.optionTitle, {color: Colors.absent}]}>
                      Mark All Absent
                    </Text>
                    <Text style={styles.optionDesc}>
                      Set all classes today as Absent
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.optionCard, {borderColor: Colors.holiday}]}
                  onPress={() => setShowHolidayInput(true)}>
                  <Text style={styles.optionIcon}>☀</Text>
                  <View style={styles.optionTextContainer}>
                    <Text style={[styles.optionTitle, {color: Colors.holiday}]}>
                      Mark Day as Holiday
                    </Text>
                    <Text style={styles.optionDesc}>
                      Institute / festival holiday (Add optional reason)
                    </Text>
                  </View>
                </TouchableOpacity>

                {onClearDayClasses && (
                  <TouchableOpacity
                    style={[styles.optionCard, {borderColor: Colors.absent + '88', backgroundColor: Colors.absent + '11'}]}
                    onPress={() => {
                      onClearDayClasses();
                      onClose();
                    }}>
                    <Text style={styles.optionIcon}>🗑️</Text>
                    <View style={styles.optionTextContainer}>
                      <Text style={[styles.optionTitle, {color: Colors.absent}]}>
                        Clear Classes on This Day
                      </Text>
                      <Text style={styles.optionDesc}>
                        Delete all scheduled classes on this day
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <View style={styles.holidayInputSection}>
                <Text style={styles.inputLabel}>Holiday Reason (Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Diwali, College Fest, Heavy Rain..."
                  placeholderTextColor={Colors.textMuted}
                  value={holidayReason}
                  onChangeText={setHolidayReason}
                  autoFocus
                />
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setShowHolidayInput(false)}>
                    <Text style={styles.cancelButtonText}>Back</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={handleHolidaySubmit}>
                    <Text style={styles.confirmButtonText}>Confirm Holiday</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Cancel</Text>
            </TouchableOpacity>
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
    zIndex: 99999,
  },
  sheetContainer: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: Spacing.cardRadiusLg,
    borderTopRightRadius: Spacing.cardRadiusLg,
    padding: Spacing.screenPad,
    paddingBottom: Spacing.xl,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  subtitle: {
    ...Typography.body2,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Spacing.cardRadius,
    padding: Spacing.cardPad,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  optionIcon: {
    fontSize: 22,
    marginRight: Spacing.md,
    color: Colors.textPrimary,
    width: 28,
    textAlign: 'center',
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    ...Typography.h4,
    marginBottom: 2,
  },
  optionDesc: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  holidayInputSection: {
    marginVertical: Spacing.sm,
  },
  inputLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderRadius: Spacing.cardRadius,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
    padding: Spacing.md,
    fontSize: 15,
    marginBottom: Spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Spacing.cardRadius,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...Typography.body1,
    color: Colors.textSecondary,
  },
  confirmButton: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: Spacing.cardRadius,
    backgroundColor: Colors.holiday,
    alignItems: 'center',
  },
  confirmButtonText: {
    ...Typography.body1,
    fontWeight: '700',
    color: '#000',
  },
  closeBtn: {
    marginTop: Spacing.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeBtnText: {
    ...Typography.body1,
    color: Colors.textMuted,
  },
});
