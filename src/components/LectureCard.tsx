import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import {LectureInstance} from '../types';
import {Colors, getStatusColor} from '../theme/colors';
import {Spacing} from '../theme/spacing';
import {Typography} from '../theme/typography';

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
  absent: '✗',
  holiday: '☀',
  cancelled: '⊘',
  shifted: '↷',
};

export default function LectureCard({lecture, onPress, onLongPress}: Props) {
  const statusColor = getStatusColor(lecture.status);
  const subjectColor = lecture.subject?.color ?? Colors.primary;
  const isUnmarked = lecture.status === null;

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.75}
      style={styles.container}>
      {/* Left accent bar */}
      <View style={[styles.accent, {backgroundColor: subjectColor}]} />

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.subjectName} numberOfLines={1}>
            {lecture.subject?.name ?? 'Unknown'}
          </Text>
          {!isUnmarked && (
            <View style={[styles.badge, {backgroundColor: statusColor + '22'}]}>
              <Text style={[styles.badgeIcon, {color: statusColor}]}>
                {STATUS_ICONS[lecture.status!]}
              </Text>
              <Text style={[styles.badgeLabel, {color: statusColor}]}>
                {STATUS_LABELS[lecture.status!]}
              </Text>
            </View>
          )}
          {isUnmarked && (
            <View style={[styles.badge, {backgroundColor: Colors.surface}]}>
              <Text style={[styles.badgeLabel, {color: Colors.textMuted}]}>Tap to mark</Text>
            </View>
          )}
        </View>

        <View style={styles.bottomRow}>
          <Text style={styles.timeText}>
            {lecture.start_time} – {lecture.end_time}
          </Text>
          {lecture.room ? (
            <Text style={styles.roomText}>{lecture.room}</Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: Spacing.cardRadius,
    marginVertical: 4,
    marginHorizontal: Spacing.screenPad,
    overflow: 'hidden',
  },
  accent: {
    width: 4,
    borderTopLeftRadius: Spacing.cardRadius,
    borderBottomLeftRadius: Spacing.cardRadius,
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  subjectName: {
    ...Typography.h4,
    flex: 1,
    marginRight: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    gap: 4,
  },
  badgeIcon: {
    fontSize: 12,
    fontWeight: '700',
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeText: {
    ...Typography.body2,
    color: Colors.textSecondary,
  },
  roomText: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
});
