import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';

export const RecoveryPlanner = ({
  attended = 12,
  total = 20,
  targetPercent = 75,
}: {
  attended?: number;
  total?: number;
  targetPercent?: number;
}) => {
  const currentPercent = total > 0 ? Math.round((attended / total) * 100) : 100;
  
  // Calculate consecutive classes needed:
  // (attended + X) / (total + X) >= targetPercent / 100
  // attended + X >= 0.75 * total + 0.75 * X
  // 0.25 * X >= 0.75 * total - attended
  // X >= (0.75 * total - attended) / 0.25
  const needed = Math.max(
    0,
    Math.ceil((targetPercent * total - 100 * attended) / (100 - targetPercent))
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📈 Attendance Recovery Roadmap</Text>
      <Text style={styles.subtitle}>Step-by-step target recovery calculator</Text>

      {needed === 0 ? (
        <View style={styles.cardSuccess}>
          <Text style={styles.successIcon}>🎉</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.successTitle}>Target Reached! ({currentPercent}%)</Text>
            <Text style={styles.successSub}>You are currently maintaining your target threshold.</Text>
          </View>
        </View>
      ) : (
        <View style={styles.cardWarning}>
          <Text style={styles.neededNumber}>+{needed}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.warningTitle}>Consecutive Classes Required</Text>
            <Text style={styles.warningSub}>
              Attend your next <Text style={{ fontWeight: 'bold', color: Colors.textPrimary }}>{needed} classes</Text> in a row without missing to recover back to {targetPercent}%.
            </Text>
          </View>
        </View>
      )}
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
  cardSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    gap: Spacing.md,
  },
  successIcon: { fontSize: 28 },
  successTitle: { ...Typography.h4, color: Colors.present, fontWeight: 'bold' },
  successSub: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  cardWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    gap: Spacing.md,
  },
  neededNumber: { fontSize: 32, fontWeight: '900', color: Colors.absent },
  warningTitle: { ...Typography.h4, color: Colors.absent, fontWeight: 'bold' },
  warningSub: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2, lineHeight: 18 },
});
