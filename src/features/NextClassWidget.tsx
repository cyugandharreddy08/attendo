import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';

export const NextClassWidget = ({
  subjectName = 'Data Structures & Algorithms',
  startTime = '10:00 AM',
  room = 'Lab 302',
  onMarkPresent,
}: {
  subjectName?: string;
  startTime?: string;
  room?: string;
  onMarkPresent?: () => void;
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.badgeRow}>
        <View style={styles.liveBadge}>
          <Text style={styles.liveDot}>●</Text>
          <Text style={styles.liveText}>NEXT CLASS</Text>
        </View>
        <Text style={styles.timeText}>{startTime}</Text>
      </View>

      <Text style={styles.subjectTitle}>{subjectName}</Text>
      <Text style={styles.locationText}>📍 Room / Lab: {room}</Text>

      <TouchableOpacity style={styles.actionBtn} onPress={onMarkPresent}>
        <Text style={styles.actionBtnText}>⚡ 1-Tap Quick Mark Present</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: Spacing.md,
    marginVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: '#38BDF8',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  badgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  liveDot: { color: '#38BDF8', fontSize: 10 },
  liveText: { ...Typography.caption, color: '#38BDF8', fontWeight: 'bold', letterSpacing: 0.5 },
  timeText: { ...Typography.caption, color: Colors.textSecondary },
  subjectTitle: { ...Typography.h3, color: '#F8FAFC', marginVertical: 4 },
  locationText: { ...Typography.body2, color: Colors.textSecondary, marginBottom: Spacing.md },
  actionBtn: {
    backgroundColor: Colors.present,
    paddingVertical: Spacing.sm,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionBtnText: { ...Typography.button, color: '#FFF', fontWeight: 'bold' },
});
