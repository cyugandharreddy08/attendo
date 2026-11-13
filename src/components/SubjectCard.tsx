import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {Colors} from '../theme/colors';
import {Spacing} from '../theme/spacing';
import {Subject, AttendanceStats} from '../types';
import CircularProgress from './CircularProgress';
import AnimatedPressable from './AnimatedPressable';

interface SubjectCardProps {
  subject: Subject;
  stats: AttendanceStats;
  streak?: number;
  onPress: () => void;
}

export default function SubjectCard({subject, stats, streak = 0, onPress}: SubjectCardProps) {
  const color = subject.color;
  const isFrozen = subject.is_frozen === 1;
  const isLab = subject.subject_type === 'lab';

  return (
    <AnimatedPressable
      scaleTo={0.97}
      glowOnPress={true}
      glowColor={color}
      style={[
        styles.card,
        isFrozen && styles.cardFrozen,
        {borderColor: color + '33'},
      ]}
      onPress={onPress}>
      {/* Left accent bar */}
      <View style={[styles.accentBar, {backgroundColor: isFrozen ? Colors.textMuted : color}]} />
      <View style={styles.content}>
        <View style={styles.top}>
          <View style={styles.info}>
            <View style={styles.titleRow}>
              <Text style={styles.name} numberOfLines={1}>
                {subject.name}
              </Text>
              <View style={[styles.typeBadge, {backgroundColor: isLab ? '#0891B222' : '#8B5CF622'}]}>
                <Text style={[styles.typeBadgeText, {color: isLab ? '#06B6D4' : '#A78BFA'}]}>
                  {isLab ? '🧪 Lab' : '📚 Theory'}
                </Text>
              </View>
              {streak > 0 && !isFrozen && (
                <View style={styles.streakBadge}>
                  <Text style={styles.streakText}>🔥 {streak}</Text>
                </View>
              )}
              {isFrozen && (
                <View style={styles.frozenBadge}>
                  <Text style={styles.frozenText}>❄️ Frozen</Text>
                </View>
              )}
            </View>

            <Text style={styles.stats}>
              {stats.attended}/{stats.total} classes attended
            </Text>

            {stats.isInDangerZone && !isFrozen && (
              <View style={styles.dangerBadge}>
                <Text style={styles.dangerText}>⚠️ Below Target ({subject.target_percent}%)</Text>
              </View>
            )}
          </View>

          <CircularProgress
            percent={stats.percent}
            size={64}
            strokeWidth={6}
            showLabel={true}
          />
        </View>

        <View style={styles.bunkInfo}>
          <Text style={[styles.bunkText, stats.isInDangerZone && {color: Colors.absent}]}>
            {isFrozen ? 'Subject Frozen (Leisure)' : stats.statusMessage}
          </Text>
          <Text style={styles.targetText}>
            Target: {subject.target_percent}%
          </Text>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: Spacing.cardRadius,
    marginHorizontal: Spacing.screenPad,
    marginVertical: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardFrozen: {
    opacity: 0.65,
    backgroundColor: Colors.surface,
  },
  accentBar: {
    width: 4,
    borderRadius: 0,
  },
  content: {
    flex: 1,
    padding: Spacing.cardPad,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  info: {
    flex: 1,
    marginRight: 12,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  frozenBadge: {
    backgroundColor: Colors.holiday + '22',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  frozenText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.holiday,
  },
  streakBadge: {
    backgroundColor: '#F9731622',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  streakText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#F97316',
  },
  stats: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  dangerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.absent + '22',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.absent + '44',
  },
  dangerText: {
    fontSize: 11,
    color: Colors.absent,
    fontWeight: '600',
  },
  bunkInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  bunkText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.present,
    flex: 1,
    marginRight: 8,
  },
  targetText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
});
