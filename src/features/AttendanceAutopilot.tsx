import React, {useState, useEffect} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ScrollView} from 'react-native';
import {Colors} from '../theme/colors';
import {Spacing} from '../theme/spacing';
import {Typography} from '../theme/typography';
import {getAllSubjects} from '../db/queries/subjects';
import {getAttendanceStats, getAllInstances} from '../db/queries/lectureInstances';
import {Subject, AttendanceStats} from '../types';

interface AutopilotRecommendation {
  subject: Subject;
  stats: AttendanceStats;
  remainingClassesEstimated: number;
  safeBunkCount: number;
  mandatoryAttendCount: number;
  status: 'safe' | 'warning' | 'danger';
  advice: string;
}

export default function AttendanceAutopilot() {
  const [recommendations, setRecommendations] = useState<AutopilotRecommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAutopilotData();
  }, []);

  const loadAutopilotData = async () => {
    try {
      const subjects = await getAllSubjects();
      const allInsts = await getAllInstances();
      const results: AutopilotRecommendation[] = [];

      for (const sub of subjects) {
        const stats = await getAttendanceStats(sub.id, sub.target_percent);
        const subInsts = allInsts.filter(i => i.subject_id === sub.id);
        const totalHeld = stats.attended + stats.absent;
        
        // Estimate 30 remaining classes per semester average
        const remainingEst = Math.max(5, 30 - totalHeld);
        const targetDecimal = (sub.target_percent || 75) / 100;
        
        // Total projected classes at semester end = totalHeld + remainingEst
        const projectedTotal = totalHeld + remainingEst;
        const requiredAttendedTotal = Math.ceil(projectedTotal * targetDecimal);
        
        const neededFromRemaining = Math.max(0, requiredAttendedTotal - stats.attended);
        const safeBunks = Math.max(0, remainingEst - neededFromRemaining);

        let status: 'safe' | 'warning' | 'danger' = 'safe';
        let advice = `You can safely skip up to ${safeBunks} classes.`;

        if (stats.percent < sub.target_percent) {
          status = 'danger';
          advice = `MUST ATTEND next ${neededFromRemaining} classes consecutively to recover!`;
        } else if (safeBunks <= 1) {
          status = 'warning';
          advice = `Borderline! Attend all remaining classes to stay safe.`;
        }

        results.push({
          subject: sub,
          stats,
          remainingClassesEstimated: remainingEst,
          safeBunkCount: safeBunks,
          mandatoryAttendCount: neededFromRemaining,
          status,
          advice,
        });
      }

      setRecommendations(results);
    } catch (e) {
      console.error('Autopilot load error:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>🤖 Attendance Autopilot</Text>
        <Text style={styles.subtitle}>Predictive Class Bunk & Attendance Guide</Text>
      </View>

      {recommendations.map(item => (
        <View key={item.subject.id} style={styles.row}>
          <View style={[styles.colorDot, {backgroundColor: item.subject.color}]} />
          <View style={{flex: 1}}>
            <View style={styles.subjectHeader}>
              <Text style={styles.subjectName}>{item.subject.name}</Text>
              <Text style={[
                styles.badge,
                item.status === 'danger' ? styles.badgeDanger :
                item.status === 'warning' ? styles.badgeWarning : styles.badgeSafe
              ]}>
                {item.stats.percent}% (Target {item.subject.target_percent}%)
              </Text>
            </View>
            <Text style={styles.adviceText}>{item.advice}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>🟢 Safe Bunks Left: {item.safeBunkCount}</Text>
              <Text style={styles.metaText}>🔴 Must Attend: {item.mandatoryAttendCount}</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Spacing.cardRadiusLg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  subtitle: {
    ...Typography.body2,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    borderRadius: Spacing.cardRadius,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  subjectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  subjectName: {
    ...Typography.h4,
    color: Colors.textPrimary,
  },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  badgeSafe: {
    backgroundColor: Colors.present + '22',
    color: Colors.present,
  },
  badgeWarning: {
    backgroundColor: Colors.cancelled + '22',
    color: Colors.cancelled,
  },
  badgeDanger: {
    backgroundColor: Colors.absent + '22',
    color: Colors.absent,
  },
  adviceText: {
    ...Typography.body2,
    color: Colors.textPrimary,
    fontWeight: '500',
    marginVertical: 4,
  },
  metaRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: 4,
  },
  metaText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});
