import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';

export const ClassModeTimer = () => {
  const [isActive, setIsActive] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🤫 Class Focus Mode (DND)</Text>
      <Text style={styles.subtitle}>Silence phone & track focus during ongoing lectures</Text>

      <TouchableOpacity
        style={[styles.toggleBtn, isActive && styles.toggleBtnActive]}
        onPress={() => setIsActive(!isActive)}
      >
        <Text style={styles.toggleText}>
          {isActive ? '🌙 Class Focus Active (Silent)' : '⚡ Activate Class Focus Mode'}
        </Text>
      </TouchableOpacity>
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
  subtitle: { ...Typography.caption, color: Colors.textSecondary, marginBottom: Spacing.sm },
  toggleBtn: {
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toggleBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryLight,
  },
  toggleText: { ...Typography.button, color: Colors.textPrimary, fontWeight: 'bold' },
});
