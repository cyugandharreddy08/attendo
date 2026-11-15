import React from 'react';
import {View, Text, StyleSheet, ScrollView} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {Colors} from '../theme/colors';
import {Spacing} from '../theme/spacing';
import {Typography} from '../theme/typography';
import AnimatedPressable from '../components/AnimatedPressable';

export const AIClassAssistant = ({missedClasses}: {missedClasses?: any[]}) => {
  const navigation = useNavigation<any>();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.heroBanner}>
        <Text style={styles.heroBadge}>✨ ATTENDO COPILOT</Text>
        <Text style={styles.title}>Proxy AI Wingman</Text>
        <Text style={styles.subtitle}>
          Your 24/7 attendance planner. Ask to shift classes into leisure hours, simulate bunk consequences, or project future attendance.
        </Text>
        <AnimatedPressable
          physics="snappy"
          glowOnPress={true}
          glowColor={Colors.primary}
          style={styles.chatLaunchBtn}
          onPress={() => navigation.navigate('AIAssistant')}>
          <Text style={styles.chatLaunchText}>💬 Open Proxy AI Chat →</Text>
        </AnimatedPressable>
      </View>

      <Text style={[styles.sectionTitle, {marginTop: Spacing.md}]}>Missed Classes Summary</Text>
      {!missedClasses || missedClasses.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.className}>✨ No Missed Classes Today</Text>
          <Text style={styles.summary}>
            Your schedule is clean! Tap above to plan ahead or discuss upcoming lectures with Proxy.
          </Text>
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
  container: {
    flex: 1,
    padding: Spacing.md,
    backgroundColor: Colors.background,
  },
  heroBanner: {
    backgroundColor: Colors.card,
    padding: Spacing.lg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: Spacing.md,
  },
  heroBadge: {
    ...Typography.caption,
    color: Colors.primaryLight,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: {
    ...Typography.h2,
    color: Colors.textPrimary,
  },
  subtitle: {
    ...Typography.body2,
    color: Colors.textSecondary,
    marginVertical: Spacing.sm,
    lineHeight: 20,
  },
  chatLaunchBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  chatLaunchText: {
    ...Typography.body2,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  sectionTitle: {
    ...Typography.label,
    marginBottom: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.card,
    padding: Spacing.md,
    borderRadius: 16,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  className: {
    ...Typography.h3,
    color: Colors.primaryLight,
  },
  summary: {
    ...Typography.body2,
    color: Colors.textPrimary,
    marginTop: 8,
  },
  action: {
    ...Typography.caption,
    color: Colors.absent,
    marginTop: 8,
    fontWeight: 'bold',
  },
});
