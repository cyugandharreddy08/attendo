import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Slider from '@react-native-community/slider';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';

export const BunkCalculator = ({ attended = 15, total = 20, targetPercent = 75 }) => {
  const [bunksPlanned, setBunksPlanned] = useState(1);

  const newAttended = attended;
  const newTotal = total + bunksPlanned;
  const newPercent = newTotal > 0 ? Math.round((newAttended / newTotal) * 100) : 100;
  const isSafe = newPercent >= targetPercent;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎲 Tactical Bunk Simulator</Text>
      <Text style={styles.subtitle}>Test how many upcoming classes you can miss safely</Text>

      <View style={styles.resultBox}>
        <Text style={styles.resultLabel}>Classes to Skip:</Text>
        <Text style={styles.resultValue}>{bunksPlanned} {bunksPlanned === 1 ? 'Class' : 'Classes'}</Text>
      </View>

      <Slider
        style={styles.slider}
        minimumValue={1}
        maximumValue={10}
        step={1}
        value={bunksPlanned}
        onValueChange={setBunksPlanned}
        minimumTrackTintColor={isSafe ? Colors.present : Colors.absent}
        maximumTrackTintColor={Colors.border}
        thumbTintColor={isSafe ? Colors.present : Colors.absent}
      />

      <View style={[styles.statusCard, { borderColor: isSafe ? Colors.present : Colors.absent }]}>
        <Text style={[styles.statusPercent, { color: isSafe ? Colors.present : Colors.absent }]}>
          {newPercent}% Projected Attendance
        </Text>
        <Text style={styles.statusText}>
          {isSafe 
            ? `✅ Safe! You will remain above your ${targetPercent}% target threshold.` 
            : `⚠️ Warning! This bunk will drop you below your ${targetPercent}% target!`}
        </Text>
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
  title: { ...Typography.h3, color: Colors.textPrimary },
  subtitle: { ...Typography.caption, color: Colors.textSecondary, marginBottom: Spacing.md },
  resultBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  resultLabel: { ...Typography.body2, color: Colors.textSecondary },
  resultValue: { ...Typography.h3, color: Colors.primaryLight },
  slider: { width: '100%', height: 40 },
  statusCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 12,
    marginTop: Spacing.xs,
    borderWidth: 1,
  },
  statusPercent: { ...Typography.h2, fontWeight: 'bold' },
  statusText: { ...Typography.body2, color: Colors.textPrimary, marginTop: 4 },
});
