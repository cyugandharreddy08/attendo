import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
} from 'react-native';
import {AttendanceStatus, LectureInstance} from '../types';
import {Colors, getStatusColor} from '../theme/colors';
import {Spacing} from '../theme/spacing';
import {Typography} from '../theme/typography';
import AnimatedPressable from './AnimatedPressable';

interface StatusOption {
  status: AttendanceStatus;
  label: string;
  icon: string;
  description: string;
}

const STATUS_OPTIONS: StatusOption[] = [
  {status: 'present', label: 'Present', icon: '✓', description: 'I attended this class'},
  {status: 'absent', label: 'Absent', icon: '✕', description: 'I missed this class'},
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

const SCREEN_HEIGHT = Dimensions.get('window').height;

export default function StatusBottomSheet({
  lecture,
  onSelect,
  onClose,
  onEdit,
  onDelete,
  onUnshift,
  onUnmark,
  isVisible,
}: Props) {
  const [activeLecture, setActiveLecture] = useState<LectureInstance | null>(lecture);
  const [renderModal, setRenderModal] = useState<boolean>(isVisible);

  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (lecture) {
      setActiveLecture(lecture);
    }
  }, [lecture]);

  useEffect(() => {
    if (isVisible) {
      setRenderModal(true);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          friction: 7,
          tension: 75,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setRenderModal(false);
      });
    }
  }, [isVisible, backdropOpacity, translateY]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const handleSelectStatus = (status: AttendanceStatus) => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onSelect(status);
    });
  };

  if (!renderModal || !activeLecture) {
    return null;
  }

  const isShifted =
    activeLecture.status === 'shifted' ||
    (activeLecture.notes && activeLecture.notes.length > 0);

  return (
    <View style={styles.overlayWrapper}>
      {/* Animated Backdrop */}
      <TouchableWithoutFeedback onPress={handleClose}>
        <Animated.View style={[styles.backdrop, {opacity: backdropOpacity}]} />
      </TouchableWithoutFeedback>

      {/* Physics-Driven Bottom Sheet */}
      <Animated.View
        style={[
          styles.sheetContainer,
          {
            transform: [{translateY}],
          },
        ]}>
        <View style={styles.handle} />

        <View style={styles.titleRow}>
          <View style={{flex: 1}}>
            <Text style={styles.title} numberOfLines={1}>
              {activeLecture?.subject?.name ?? 'Mark Attendance'}
            </Text>
            <Text style={styles.subtitle}>
              📅 {activeLecture?.date} • ⏱️ {activeLecture?.start_time} – {activeLecture?.end_time}
              {activeLecture?.room ? ` (📍 ${activeLecture.room})` : ''}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleClose}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

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

        {/* Status Option Grid with Spring Physics */}
        <View style={styles.optionsList}>
          {STATUS_OPTIONS.map(option => {
            const color = getStatusColor(option.status);
            const isSelected = activeLecture?.status === option.status;
            return (
              <AnimatedPressable
                key={option.status}
                physics="bouncy"
                scaleTo={0.96}
                translateYOnPress={2}
                hapticType="impactMedium"
                style={[
                  styles.option,
                  isSelected && {
                    backgroundColor: color + '22',
                    borderColor: color,
                    borderWidth: 1.5,
                  },
                ]}
                onPress={() => handleSelectStatus(option.status)}>
                <View
                  style={[
                    styles.iconContainer,
                    {backgroundColor: color + (isSelected ? '44' : '22')},
                  ]}>
                  <Text style={[styles.icon, {color}]}>{option.icon}</Text>
                </View>
                <View style={styles.optionText}>
                  <View style={styles.optionHeader}>
                    <Text style={[styles.optionLabel, isSelected && {color, fontWeight: '800'}]}>
                      {option.label}
                    </Text>
                    {isSelected && (
                      <View style={[styles.activePill, {backgroundColor: color}]}>
                        <Text style={styles.activePillText}>MARKED</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.optionDesc}>{option.description}</Text>
                </View>
              </AnimatedPressable>
            );
          })}
        </View>

        {/* Management Actions: Unmark, Edit & Delete */}
        <View style={styles.actionRow}>
          {onUnmark && activeLecture.status !== null && (
            <AnimatedPressable
              physics="tactile"
              scaleTo={0.94}
              style={styles.actionBtnUnmark}
              onPress={onUnmark}>
              <Text style={styles.actionBtnUnmarkText}>⚪ Clear Mark</Text>
            </AnimatedPressable>
          )}
          {onEdit && (
            <AnimatedPressable
              physics="tactile"
              scaleTo={0.94}
              style={styles.actionBtnEdit}
              onPress={onEdit}>
              <Text style={styles.actionBtnEditText}>✏️ Edit Class</Text>
            </AnimatedPressable>
          )}
          {onDelete && (
            <AnimatedPressable
              physics="tactile"
              scaleTo={0.94}
              style={styles.actionBtnDelete}
              onPress={onDelete}>
              <Text style={styles.actionBtnDeleteText}>🗑️ Delete</Text>
            </AnimatedPressable>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayWrapper: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  sheetContainer: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: Spacing.screenPad,
    paddingTop: 12,
    paddingBottom: 32,
    borderTopWidth: 1.5,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -6},
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 28,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  closeBtnText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
  },
  optionsList: {
    gap: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 18,
    fontWeight: '800',
  },
  optionText: {
    flex: 1,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  activePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activePillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  optionDesc: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  actionBtnEdit: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionBtnEditText: {
    fontSize: 12,
    color: '#E2E8F0',
    fontWeight: '600',
  },
  actionBtnDelete: {
    flex: 1,
    backgroundColor: Colors.absent + '18',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.absent + '44',
  },
  actionBtnDeleteText: {
    fontSize: 12,
    color: Colors.absent,
    fontWeight: '700',
  },
  actionBtnUnmark: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  actionBtnUnmarkText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  shiftBanner: {
    backgroundColor: '#3B82F622',
    borderColor: '#3B82F6',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  shiftBannerTitle: {
    fontSize: 13,
    color: '#60A5FA',
    fontWeight: '700',
    marginBottom: 4,
  },
  shiftBannerText: {
    fontSize: 12,
    color: '#F1F5F9',
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
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
