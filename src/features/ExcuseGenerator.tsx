import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';

const REASONS = [
  { id: 'medical', title: '🏥 Medical / Unwell', text: 'Dear Professor, I am unwell today and unable to attend the lecture. I will catch up on the notes promptly. Thank you for your understanding.' },
  { id: 'family', title: '🏠 Urgent Family Matter', text: 'Dear Professor, due to an urgent family situation, I will be unable to attend today\'s class. I will request class notes from a classmate.' },
  { id: 'event', title: '🏆 College Event / Contest', text: 'Dear Professor, I am representing our institution in an official event today and request leave for the scheduled class session. Thank you.' },
];

export const ExcuseGenerator = () => {
  const [selectedIdx, setSelectedIdx] = useState(0);

  const handleCopy = () => {
    Clipboard.setString(REASONS[selectedIdx].text);
    Alert.alert('Copied to Clipboard! 📋', 'Excuse email text copied. You can now paste it directly into your mail app.');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>✉️ One-Tap Professor Excuse Generator</Text>
      <Text style={styles.subtitle}>Instantly format polite email excuses for absences</Text>

      <View style={styles.chipRow}>
        {REASONS.map((r, i) => (
          <TouchableOpacity
            key={r.id}
            style={[styles.chip, selectedIdx === i && styles.chipActive]}
            onPress={() => setSelectedIdx(i)}
          >
            <Text style={[styles.chipText, selectedIdx === i && { color: '#FFF' }]}>{r.title}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.textCard}>
        <Text style={styles.excuseText}>{REASONS[selectedIdx].text}</Text>
      </View>

      <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
        <Text style={styles.copyBtnText}>📋 Copy Email Text</Text>
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.sm },
  chip: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryLight,
  },
  chipText: { ...Typography.caption, color: Colors.textSecondary },
  textCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  excuseText: { ...Typography.body2, color: Colors.textPrimary, fontStyle: 'italic', lineHeight: 20 },
  copyBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm,
    borderRadius: 12,
    alignItems: 'center',
  },
  copyBtnText: { ...Typography.button, color: '#FFF', fontWeight: 'bold' },
});
