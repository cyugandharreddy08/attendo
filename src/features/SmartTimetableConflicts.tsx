import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';

export const SmartTimetableConflicts = ({ conflicts = [] }: { conflicts?: any[] }) => {
  const sampleConflicts = conflicts.length > 0 ? conflicts : [
    { event1: 'Data Structures Lab', event2: 'DBMS Quiz', time: 'Mon 10:00 AM' },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>⚠️ Schedule Conflicts Detected</Text>
      {sampleConflicts.map((c, i) => (
        <View key={i} style={styles.conflictItem}>
          <Text style={styles.conflictText}>{c.event1} overlaps with {c.event2}</Text>
          <Text style={styles.timeText}>{c.time}</Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    padding: Spacing.md,
    borderRadius: 16,
    marginVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  title: { ...Typography.h4, color: Colors.absent, marginBottom: Spacing.xs },
  conflictItem: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.absent,
    paddingLeft: Spacing.sm,
    marginTop: Spacing.xs,
  },
  conflictText: { ...Typography.body2, color: Colors.textPrimary },
  timeText: { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },
});
