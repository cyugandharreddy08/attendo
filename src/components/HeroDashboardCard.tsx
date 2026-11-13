import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {Colors} from '../theme/colors';
import {Spacing} from '../theme/spacing';
import {Typography} from '../theme/typography';
import AnimatedPressable from './AnimatedPressable';

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

  const handlePress = () => {
    ReactNativeHapticFeedback.trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
    if (onPressStats) onPressStats();
  };

  return (
    <AnimatedPressable
      scaleTo={0.98}
      glowOnPress={true}
      glowColor={statusColor}
      style={[
        styles.card,
        {borderColor: statusColor + '55'},
      ]}
      onPress={handlePress}>
      <View style={styles.topRow}>
        <View style={styles.badgeContainer}>
          <View style={[styles.statusDot, {backgroundColor: statusColor}]} />
          <Text style={[styles.statusText, {color: statusColor}]}>
            {!hasClasses
              ? '📅 Schedule Ready'
              : isInDanger
              ? '⚠️ Below 75% Target'
              : '🎯 75%+ Safe Haven'}
          </Text>
        </View>
        <View style={styles.streakBadge}>
          <Text style={styles.streakBadgeText}>🔥 {streakCount}d Streak</Text>
        </View>
      </View>

      <View style={styles.metricRow}>
        <View>
          <Text style={[styles.percentText, {color: statusColor}]}>
            {hasClasses ? `${totalPercent}%` : '--%'}
          </Text>
          <Text style={styles.percentLabel}>Overall Attendance</Text>
        </View>

        <View style={styles.divider} />

        <View style={{flex: 1, alignItems: 'flex-end'}}>
          <View style={[styles.bunkPill, maxBunkable > 0 && styles.bunkPillSafe]}>
            <Text style={[styles.bunkPillText, maxBunkable > 0 && styles.bunkPillTextSafe]}>
              {!hasClasses
                ? '+ Add class to calculate'
                : maxBunkable > 0
                ? `✨ Can bunk ${maxBunkable} hr${maxBunkable > 1 ? 's' : ''}`
                : '⛔ Don\'t miss next class'}
            </Text>
          </View>
          <Text style={styles.bunkSubtext}>Target: 75% Minimum</Text>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0C0E1A',
    borderRadius: 18,
    padding: Spacing.md,
    marginHorizontal: Spacing.screenPad,
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
    borderWidth: 1,
    shadowColor: Colors.primary,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
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
    backgroundColor: '#161928',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#242A42',
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
    backgroundColor: '#F59E0B18',
    borderWidth: 1,
    borderColor: '#F59E0B44',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  streakBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F59E0B',
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  percentText: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
  },
  percentLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: -2,
    fontWeight: '600',
  },
  divider: {
    width: 1,
    height: 38,
    backgroundColor: '#1E2338',
    marginHorizontal: 16,
  },
  bunkPill: {
    backgroundColor: '#1E1E2E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bunkPillSafe: {
    backgroundColor: '#10B98118',
    borderColor: '#10B98144',
  },
  bunkPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  bunkPillTextSafe: {
    color: '#34D399',
  },
  bunkSubtext: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 4,
    fontWeight: '500',
  },
});
