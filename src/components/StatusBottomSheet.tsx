import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import {AttendanceStatus, LectureInstance} from '../types';
import {Colors, getStatusColor} from '../theme/colors';
import {Spacing} from '../theme/spacing';
import {Typography} from '../theme/typography';

interface StatusOption {
  status: AttendanceStatus;
  label: string;
  icon: string;
  description: string;
}

const STATUS_OPTIONS: StatusOption[] = [
  {status: 'present', label: 'Present', icon: '✓', description: 'I attended this class'},
  {status: 'absent', label: 'Absent', icon: '✗', description: 'I missed this class'},
  {status: 'holiday', label: 'Holiday', icon: '☀', description: 'Public/institute holiday (Not counted)'},
  {status: 'cancelled', label: 'Cancelled', icon: '⊘', description: 'Class was cancelled (Not counted)'},
  {status: 'shifted', label: 'Shifted', icon: '↷', description: 'Reschedule class to another date/time'},
];

interface Props {
  lecture: LectureInstance | null;
  onSelect: (status: AttendanceStatus) => void;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onUnshift?: () => void;
  onUnmark?: () => void;
  isVisible: boolean;
}

export default function StatusBottomSheet({lecture, onSelect, onClose, onEdit, onDelete, onUnshift, onUnmark, isVisible}: Props) {
  const [activeLecture, setActiveLecture] = useState<LectureInstance | null>(lecture);

  useEffect(() => {
    if (lecture) {
      setActiveLecture(lecture);
    }
  }, [lecture]);

  if (!isVisible || !activeLecture) {
    return null;
  }

  const isShifted = activeLecture.status === 'shifted' || (activeLecture.notes && activeLecture.notes.length > 0);

  return (
    <TouchableWithoutFeedback onPress={onClose}>
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={() => {}}>
          <View style={styles.sheetContainer}>
            <View style={styles.handle} />
            <Text style={styles.title}>{activeLecture?.subject?.name ?? 'Mark Attendance'}</Text>
            <Text style={styles.subtitle}>
              {activeLecture?.date} · {activeLecture?.start_time} – {activeLecture?.end_time} {activeLecture?.room ? `(${activeLecture.room})` : ''}
            </Text>

            {/* Shift Details Banner */}
            {isShifted && activeLecture.notes ? (
              <View style={styles.shiftBanner}>
                <Text style={styles.shiftBannerTitle}>🔄 Shift Details / History</Text>
                <Text style={styles.shiftBannerText}>{activeLecture.notes}</Text>
                {onUnshift && (
                  <TouchableOpacity style={styles.unshiftBtn} onPress={onUnshift}>
                    <Text style={styles.unshiftBtnText}>↩️ Revert / Unshift Class</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}

            {STATUS_OPTIONS.map(option => {
              const color = getStatusColor(option.status);
              const isSelected = activeLecture?.status === option.status;
              return (
                <TouchableOpacity
                  key={option.status}
                  style={[
                    styles.option,
                    isSelected && {backgroundColor: color + '22', borderColor: color},
                  ]}
                  onPress={() => {
                    onSelect(option.status);
                  }}
                  activeOpacity={0.7}>
                  <View style={[styles.iconContainer, {backgroundColor: color + '33'}]}>
                    <Text style={[styles.icon, {color}]}>{option.icon}</Text>
                  </View>
                  <View style={styles.optionText}>
                    <Text style={[styles.optionLabel, isSelected && {color}]}>
                      {option.label}
                    </Text>
                    <Text style={styles.optionDesc}>{option.description}</Text>
                  </View>
                  {isSelected && (
                    <View style={[styles.selectedDot, {backgroundColor: color}]} />
                  )}
                </TouchableOpacity>
              );
            })}

            {/* Management Actions: Unmark, Edit & Delete */}
            <View style={styles.actionRow}>
              {onUnmark && activeLecture.status !== null && (
                <TouchableOpacity style={styles.actionBtnUnmark} onPress={onUnmark}>
                  <Text style={styles.actionBtnUnmarkText}>⚪ Unmark</Text>
                </TouchableOpacity>
              )}
              {onEdit && (
                <TouchableOpacity style={styles.actionBtnEdit} onPress={onEdit}>
                  <Text style={styles.actionBtnEditText}>✏️ Edit</Text>
                </TouchableOpacity>
              )}
              {onDelete && (
                <TouchableOpacity style={styles.actionBtnDelete} onPress={onDelete}>
                  <Text style={styles.actionBtnDeleteText}>🗑️ Delete</Text>
                </TouchableOpacity>
              )}
            </View>
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
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: Spacing.cardRadius,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 8,
    backgroundColor: Colors.surface,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 16,
    fontWeight: '700',
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    ...Typography.h4,
    marginBottom: 1,
  },
  optionDesc: {
    ...Typography.caption,
  },
  selectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  actionBtnEdit: {
    flex: 1,
    backgroundColor: Colors.surface,
    paddingVertical: 10,
    borderRadius: Spacing.cardRadius,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionBtnEditText: {
    ...Typography.body2,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  actionBtnDelete: {
    flex: 1,
    backgroundColor: Colors.absent + '18',
    paddingVertical: 10,
    borderRadius: Spacing.cardRadius,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.absent + '44',
  },
  actionBtnDeleteText: {
    ...Typography.body2,
    color: Colors.absent,
    fontWeight: '600',
  },
  actionBtnUnmark: {
    flex: 1,
    backgroundColor: Colors.surface,
    paddingVertical: 10,
    borderRadius: Spacing.cardRadius,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  actionBtnUnmarkText: {
    ...Typography.body2,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  shiftBanner: {
    backgroundColor: '#3B82F622',
    borderColor: '#3B82F6',
    borderWidth: 1,
    borderRadius: Spacing.cardRadius,
    padding: 12,
    marginBottom: 12,
  },
  shiftBannerTitle: {
    ...Typography.body2,
    color: '#60A5FA',
    fontWeight: '700',
    marginBottom: 4,
  },
  shiftBannerText: {
    ...Typography.body2,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  unshiftBtn: {
    backgroundColor: '#3B82F6',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  unshiftBtnText: {
    ...Typography.caption,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
