import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {format} from 'date-fns';
import {LectureInstance} from '../types';
import {Colors, getStatusColor} from '../theme/colors';
import {Spacing} from '../theme/spacing';
import {Typography} from '../theme/typography';
import {calculateDurationHours} from '../db/queries/lectureInstances';

interface Props {
  lecture: LectureInstance;
  onPress: () => void;
  onLongPress?: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  present: 'Present',
  absent: 'Absent',
  holiday: 'Holiday',
  cancelled: 'Cancelled',
  shifted: 'Shifted',
};

const STATUS_ICONS: Record<string, string> = {
  present: '✓',
  absent: '✕',
  holiday: '☀',
  cancelled: '⊘',
  shifted: '↷',
};

function isClassLiveNow(dateStr: string, startTime: string, endTime: string): boolean {
  try {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    if (dateStr !== todayStr) return false;
    const now = new Date();
    const [sH, sM] = startTime.split(':').map(Number);
    const [eH, eM] = endTime.split(':').map(Number);
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const startMins = sH * 60 + (sM || 0);
    const endMins = eH * 60 + (eM || 0);
    return nowMins >= startMins && nowMins <= endMins;
  } catch {
    return false;
  }
}

export default function LectureCard({lecture, onPress, onLongPress}: Props) {
  const statusColor = getStatusColor(lecture.status);
  const subjectColor = lecture.subject?.color ?? Colors.primary;
  const isUnmarked = lecture.status === null;
  const isLab = lecture.subject?.subject_type === 'lab';
  const durationHours = calculateDurationHours(lecture.start_time, lecture.end_time);
  const isLive = isClassLiveNow(lecture.date, lecture.start_time, lecture.end_time);

  const handlePress = () => {
    ReactNativeHapticFeedback.trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
    onPress();
  };

  const handleLongPress = () => {
    if (onLongPress) {
      ReactNativeHapticFeedback.trigger('impactMedium', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
      onLongPress();
    }
  };

  // Status-based dynamic glow border
  let cardBorderColor = Colors.border;
  if (isLive) {
    cardBorderColor = '#EC489988';
  } else if (lecture.status === 'present') {
    cardBorderColor = Colors.present + '55';
  } else if (lecture.status === 'absent') {
    cardBorderColor = Colors.absent + '55';
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      onLongPress={handleLongPress}
      activeOpacity={0.7}
      style={[
        styles.container,
        {borderColor: cardBorderColor},
        isLive && styles.liveContainer,
      ]}>
      {/* Sleek Vertical Accent Pill */}
      <View
        style={[
          styles.accent,
          {backgroundColor: subjectColor},
          isLive && {backgroundColor: '#EC4899'},
        ]}
      />

      <View style={styles.content}>
        {/* Top Row: Subject Name + Badges */}
        <View style={styles.topRow}>
          <View style={styles.subjectTitleContainer}>
            <Text style={styles.subjectName} numberOfLines={1}>
              {lecture.subject?.name ?? 'Unknown'}
            </Text>
            {isLive && (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE NOW</Text>
              </View>
            )}
          </View>

          {/* Status Badge */}
          {!isUnmarked ? (
            <View style={[styles.badge, {backgroundColor: statusColor + '18', borderColor: statusColor + '55'}]}>
              <Text style={[styles.badgeIcon, {color: statusColor}]}>
                {STATUS_ICONS[lecture.status!]}
              </Text>
              <Text style={[styles.badgeLabel, {color: statusColor}]}>
                {STATUS_LABELS[lecture.status!]}
              </Text>
            </View>
          ) : (
            <View style={styles.unmarkedBadge}>
              <Text style={styles.unmarkedBadgeText}>Tap to Mark</Text>
            </View>
          )}
        </View>

        {/* Middle Row: Duration & Type Badges */}
        <View style={styles.metadataRow}>
          <View style={[styles.typePill, isLab ? styles.labPill : styles.theoryPill]}>
            <Text style={[styles.typePillText, isLab ? styles.labPillText : styles.theoryPillText]}>
              {isLab ? '🧪 Lab' : '📚 Theory'} • {durationHours}h
            </Text>
          </View>

          {lecture.room ? (
            <View style={styles.roomPill}>
              <Text style={styles.roomPillText}>📍 {lecture.room}</Text>
            </View>
          ) : null}

          {lecture.is_override === 1 && (
            <View style={styles.overridePill}>
              <Text style={styles.overridePillText}>⚡ Shifted</Text>
            </View>
          )}
        </View>

        {/* Bottom Row: Time Interval & Notes */}
        <View style={styles.bottomRow}>
          <Text style={styles.timeText}>
            ⏱️ {lecture.start_time} – {lecture.end_time}
          </Text>
          {lecture.notes ? (
            <Text style={styles.notesText} numberOfLines={1}>
              📝 {lecture.notes}
            </Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#0E101A',
    borderRadius: 16,
    marginVertical: 5,
    marginHorizontal: Spacing.screenPad,
    borderWidth: 1,
    overflow: 'hidden',
  },
  liveContainer: {
    backgroundColor: '#160F1F',
  },
  accent: {
    width: 5,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  subjectTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 8,
  },
  subjectName: {
    ...Typography.subtitle1,
    color: Colors.textPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EC489922',
    borderWidth: 1,
    borderColor: '#EC489988',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EC4899',
  },
  liveText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#EC4899',
    letterSpacing: 0.5,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  badgeIcon: {
    fontSize: 12,
    fontWeight: '800',
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  unmarkedBadge: {
    backgroundColor: '#1E1E2E',
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  unmarkedBadgeText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  typePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  typePillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  theoryPill: {
    backgroundColor: '#7C3AED15',
    borderColor: '#7C3AED44',
  },
  theoryPillText: {
    color: '#A78BFA',
    fontSize: 11,
    fontWeight: '600',
  },
  labPill: {
    backgroundColor: '#10B98115',
    borderColor: '#10B98144',
  },
  labPillText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '600',
  },
  roomPill: {
    backgroundColor: '#1E1E2E',
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roomPillText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '500',
  },
  overridePill: {
    backgroundColor: '#F59E0B18',
    borderColor: '#F59E0B55',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  overridePillText: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '700',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  notesText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontStyle: 'italic',
    maxWidth: '45%',
  },
});
