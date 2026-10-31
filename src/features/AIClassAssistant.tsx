import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';

export const AIClassAssistant = ({ missedClasses }: { missedClasses: any[] }) => {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🤖 AI Class Assistant</Text>
      <Text style={styles.subtitle}>Automatic summary of what was missed when bunking</Text>
      {(!missedClasses || missedClasses.length === 0) ? (
        <View style={styles.card}>
          <Text style={styles.className}>✨ Perfect Attendance Record!</Text>
          <Text style={styles.summary}>No missed classes requiring AI synthesis today.</Text>
        </View>
      ) : (
        missedClasses.map((cls, idx) => (
          <View key={idx} style={styles.card}>
            <Text style={styles.className}>{cls.name || 'Subject'}</Text>
            <Text style={styles.summary}>Topic: {cls.aiSummary || 'Lecture notes auto-generated'}</Text>
            <Text style={styles.action}>Action Required: {cls.pendingAssignments || 'Review slide deck'}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.md, backgroundColor: Colors.background },
  title: { ...Typography.h2, color: Colors.textPrimary },
  subtitle: { ...Typography.body2, color: Colors.textSecondary, marginBottom: Spacing.md },
  card: { backgroundColor: Colors.card, padding: Spacing.md, borderRadius: 16, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  className: { ...Typography.h3, color: Colors.primaryLight },
  summary: { ...Typography.body2, color: Colors.textPrimary, marginTop: 8 },
  action: { ...Typography.caption, color: Colors.absent, marginTop: 8, fontWeight: 'bold' }
});
