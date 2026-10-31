import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';

export const VantablackNeonCard = ({ title, streak = 7 }: { title: string; streak?: number }) => {
  const glowColor = streak > 5 ? '#00FFCC' : streak > 2 ? '#FF007F' : Colors.primary;

  return (
    <View style={[styles.card, { shadowColor: glowColor, borderColor: glowColor }]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.streak}>🔥 Attendance Streak: {streak} Classes Active</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#040406',
    borderWidth: 2,
    borderRadius: 16,
    padding: Spacing.lg,
    margin: Spacing.md,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 15,
    elevation: 12,
  },
  title: { ...Typography.h2, color: Colors.textPrimary },
  streak: { ...Typography.body2, color: Colors.textSecondary, marginTop: Spacing.xs },
});
