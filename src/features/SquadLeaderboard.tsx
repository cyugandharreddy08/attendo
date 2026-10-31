import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';

export const SquadLeaderboard = ({ userStreak = 7 }: { userStreak?: number }) => {
  let rankTitle = '🥇 Bunk Master Legend';
  let rankBadge = '👑';
  if (userStreak < 3) {
    rankTitle = '🥉 Danger Zone Survivor';
    rankBadge = '⚡';
  } else if (userStreak < 7) {
    rankTitle = '🥈 Regular Scholar';
    rankBadge = '🌟';
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🏆 Squad Attendance Leaderboard</Text>
      <View style={styles.rankCard}>
        <Text style={styles.badgeText}>{rankBadge}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.rankTitle}>{rankTitle}</Text>
          <Text style={styles.rankSub}>Active Attendance Streak: {userStreak} Classes</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.md,
    marginVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: { ...Typography.h3, color: Colors.textPrimary, marginBottom: Spacing.xs },
  rankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 14,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  badgeText: { fontSize: 32 },
  rankTitle: { ...Typography.h3, color: Colors.primaryLight },
  rankSub: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
});
