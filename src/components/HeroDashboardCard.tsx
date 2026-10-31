import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {Colors} from '../theme/colors';
import {Spacing} from '../theme/spacing';
import {Typography} from '../theme/typography';

interface Props {
  totalPercent: number;
  totalClasses?: number;
  streakCount: number;
  maxBunkable: number;
  isInDanger: boolean;
  onPressStats?: () => void;
}

export default function HeroDashboardCard({
  totalPercent,
  totalClasses = 0,
  streakCount,
  maxBunkable,
  isInDanger,
  onPressStats,
}: Props) {
  const hasClasses = totalClasses > 0;
  const statusColor = !hasClasses
    ? Colors.textSecondary
    : isInDanger
    ? Colors.absent
    : Colors.present;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {borderColor: statusColor + '44'},
      ]}
      onPress={onPressStats}
      activeOpacity={0.85}>
      <View style={styles.topRow}>
        <View style={styles.badgeContainer}>
          <View style={[styles.statusDot, {backgroundColor: statusColor}]} />
          <Text style={[styles.statusText, {color: statusColor}]}>
            {!hasClasses
              ? '📅 No Classes Recorded'
              : isInDanger
              ? '⚠️ Danger Zone'
              : '🎯 Target On Track'}
          </Text>
        </View>
        <Text style={styles.streakBadge}>🔥 {streakCount} Streak</Text>
      </View>

      <View style={styles.metricRow}>
        <View>
          <Text style={styles.percentText}>
            {hasClasses ? `${totalPercent}%` : '--%'}
          </Text>
          <Text style={styles.percentLabel}>Overall Attendance</Text>
        </View>

        <View style={styles.divider} />

        <View style={{flex: 1, alignItems: 'flex-end'}}>
          <View style={styles.bunkPill}>
            <Text style={styles.bunkPillText}>
              {!hasClasses
                ? '+ Add class to calculate'
                : maxBunkable > 0
                ? `✨ Can bunk ${maxBunkable} more`
                : '⛔ Cannot bunk any'}
            </Text>
          </View>
          <Text style={styles.bunkSubtext}>Target: 75% Min</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Spacing.cardRadiusLg,
    padding: Spacing.md,
    marginHorizontal: Spacing.screenPad,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    borderWidth: 1,
    shadowColor: Colors.primary,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  streakBadge: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFB800',
    backgroundColor: '#FFB80018',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  percentText: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  percentLabel: {
    ...Typography.caption,
    marginTop: -2,
  },
  divider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },
  bunkPill: {
    backgroundColor: Colors.primary + '22',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.primary + '44',
  },
  bunkPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryLight,
  },
  bunkSubtext: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 4,
  },
});
