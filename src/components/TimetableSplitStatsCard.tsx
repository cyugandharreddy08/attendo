import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {SplitAttendanceStats} from '../db/queries/lectureInstances';
import {Colors} from '../theme/colors';
import {Spacing} from '../theme/spacing';
import {Typography} from '../theme/typography';

interface Props {
  splitStats: SplitAttendanceStats | null;
  streakCount: number;
  onPress?: () => void;
  onTheoryPress?: () => void;
  onLabPress?: () => void;
}

export default function TimetableSplitStatsCard({
  splitStats,
  streakCount,
  onPress,
  onTheoryPress,
  onLabPress,
}: Props) {
  const triggerHaptic = () => {
    ReactNativeHapticFeedback.trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
  };

  const handleCardPress = () => {
    triggerHaptic();
    if (onPress) onPress();
  };

  const handleTheoryPress = () => {
    triggerHaptic();
    if (onTheoryPress) onTheoryPress();
    else if (onPress) onPress();
  };

  const handleLabPress = () => {
    triggerHaptic();
    if (onLabPress) onLabPress();
    else if (onPress) onPress();
  };

  const overallPercent = splitStats?.overallPercent ?? 0;
  const hasOverallData = (splitStats?.totalHeldHours ?? 0) > 0;
  const overallColor = !hasOverallData
    ? '#94A3B8'
    : overallPercent >= 75
    ? '#10B981'
    : '#EF4444';

  const theory = splitStats?.theory;
  const hasTheoryData = (theory?.heldHours ?? 0) > 0;
  const theoryColor = !hasTheoryData
    ? '#94A3B8'
    : theory?.percent! >= 75
    ? '#00F2FE'
    : '#F43F5E';

  const lab = splitStats?.lab;
  const hasLabData = (lab?.heldHours ?? 0) > 0;
  const labColor = !hasLabData
    ? '#94A3B8'
    : lab?.percent! >= 75
    ? '#A78BFA'
    : '#F43F5E';

  return (
    <View style={styles.container}>
      {/* Top HUD status bar */}
      <TouchableOpacity
        style={styles.topHudBar}
        onPress={handleCardPress}
        activeOpacity={0.85}>
        <View style={styles.overallPill}>
          <View style={[styles.statusDot, {backgroundColor: overallColor}]} />
          <Text style={styles.overallLabel}>OVERALL</Text>
          <Text style={[styles.overallValue, {color: overallColor}]}>
            {hasOverallData ? `${overallPercent}%` : '--%'}
          </Text>
        </View>

        <View style={styles.streakBadge}>
          <Text style={styles.streakText}>🔥 {streakCount}d Streak</Text>
        </View>

        <View style={styles.targetPill}>
          <Text style={styles.targetText}>🎯 75% Target</Text>
        </View>
      </TouchableOpacity>

      {/* Dual Split Cards: Theory vs Lab */}
      <View style={styles.cardsRow}>
        {/* Theory Card */}
        <TouchableOpacity
          style={[
            styles.splitCard,
            {borderColor: theoryColor + '33'},
          ]}
          onPress={handleTheoryPress}
          activeOpacity={0.88}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconWrap}>
              <Text style={styles.cardIcon}>📚</Text>
            </View>
            <Text style={styles.cardCategoryTitle}>THEORY</Text>
          </View>

          <Text style={[styles.cardPercent, {color: theoryColor}]}>
            {hasTheoryData ? `${theory?.percent}%` : '--%'}
          </Text>

          <Text style={styles.cardHours}>
            {hasTheoryData
              ? `${theory?.attendedHours}h / ${theory?.heldHours}h attended`
              : 'No theory hours yet'}
          </Text>

          {/* Mini Progress Bar */}
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressBar,
                {
                  width: `${Math.min(100, theory?.percent ?? 0)}%`,
                  backgroundColor: theoryColor,
                },
              ]}
            />
          </View>

          {/* Bunk / Safe buffer pill */}
          <View style={[styles.bunkPill, {backgroundColor: theoryColor + '18'}]}>
            <Text style={[styles.bunkPillText, {color: theoryColor}]} numberOfLines={1}>
              {!hasTheoryData
                ? 'Ready for classes'
                : (theory?.maxBunkableHours ?? 0) > 0
                ? `✨ Can bunk ${theory?.maxBunkableHours}h`
                : (theory?.neededHours ?? 0) > 0
                ? `⚠️ Attend ${theory?.neededHours}h`
                : '🛡️ Don\'t miss next'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Lab Card */}
        <TouchableOpacity
          style={[
            styles.splitCard,
            {borderColor: labColor + '33'},
          ]}
          onPress={handleLabPress}
          activeOpacity={0.88}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconWrap, {backgroundColor: '#8B5CF620'}]}>
              <Text style={styles.cardIcon}>🧪</Text>
            </View>
            <Text style={[styles.cardCategoryTitle, {color: '#C4B5FD'}]}>LABS</Text>
          </View>

          <Text style={[styles.cardPercent, {color: labColor}]}>
            {hasLabData ? `${lab?.percent}%` : '--%'}
          </Text>

          <Text style={styles.cardHours}>
            {hasLabData
              ? `${lab?.attendedHours}h / ${lab?.heldHours}h practical`
              : 'No lab hours yet'}
          </Text>

          {/* Mini Progress Bar */}
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressBar,
                {
                  width: `${Math.min(100, lab?.percent ?? 0)}%`,
                  backgroundColor: labColor,
                },
              ]}
            />
          </View>

          {/* Bunk / Safe buffer pill */}
          <View style={[styles.bunkPill, {backgroundColor: labColor + '18'}]}>
            <Text style={[styles.bunkPillText, {color: labColor}]} numberOfLines={1}>
              {!hasLabData
                ? 'Ready for labs'
                : (lab?.maxBunkableHours ?? 0) > 0
                ? `✨ Can bunk ${lab?.maxBunkableHours}h`
                : (lab?.neededHours ?? 0) > 0
                ? `⚠️ Attend ${lab?.neededHours}h`
                : '🛡️ Don\'t miss lab'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.screenPad,
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  topHudBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0E111E',
    borderWidth: 1,
    borderColor: '#1E2438',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  overallPill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  overallLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginRight: 6,
  },
  overallValue: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  streakBadge: {
    backgroundColor: '#F59E0B18',
    borderWidth: 1,
    borderColor: '#F59E0B44',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  streakText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F59E0B',
  },
  targetPill: {
    backgroundColor: '#1E2438',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  targetText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  splitCard: {
    flex: 1,
    backgroundColor: '#0C0E1A',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1.2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#00F2FE18',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  cardIcon: {
    fontSize: 12,
  },
  cardCategoryTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7DD3FC',
    letterSpacing: 0.8,
  },
  cardPercent: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
  },
  cardHours: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 2,
    marginBottom: 8,
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#1E2438',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  bunkPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
  },
  bunkPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
