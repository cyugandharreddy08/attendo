import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';

export const SemesterAutopsy = ({ overallPercent = 82 }: { overallPercent?: number }) => {
  let gradeLetter = 'A+';
  let gradeColor = Colors.present;
  let summaryText = 'Outstanding! You maintain full eligibility for top honours.';

  if (overallPercent < 75) {
    gradeLetter = 'F / De-barred';
    gradeColor = Colors.absent;
    summaryText = 'CRITICAL: Below 75%! You risk hall ticket rejection unless attendance improves immediately.';
  } else if (overallPercent < 80) {
    gradeLetter = 'B';
    gradeColor = Colors.cancelled;
    summaryText = 'Borderline safe. A few missed classes could put you in the danger zone.';
  } else if (overallPercent < 90) {
    gradeLetter = 'A';
    gradeColor = Colors.primaryLight;
    summaryText = 'Great record! You have a healthy cushion above the 75% target.';
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📊 Semester Autopsy & Grade Forecast</Text>
      <View style={styles.row}>
        <View style={styles.gradeBox}>
          <Text style={[styles.gradeText, { color: gradeColor }]}>{gradeLetter}</Text>
          <Text style={styles.gradeSub}>Projected Grade</Text>
        </View>
        <View style={styles.infoBox}>
          <Text style={styles.percentText}>{overallPercent}% Attendance</Text>
          <Text style={styles.summaryText}>{summaryText}</Text>
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
  title: { ...Typography.h3, color: Colors.textPrimary, marginBottom: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  gradeBox: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 14,
    alignItems: 'center',
    minWidth: 90,
  },
  gradeText: { fontSize: 26, fontWeight: '900' },
  gradeSub: { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },
  infoBox: { flex: 1 },
  percentText: { ...Typography.h3, color: Colors.textPrimary },
  summaryText: { ...Typography.caption, color: Colors.textSecondary, marginTop: 4, lineHeight: 18 },
});
