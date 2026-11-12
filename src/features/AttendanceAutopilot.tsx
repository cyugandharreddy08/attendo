import React, {useState, useEffect} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ScrollView} from 'react-native';
import {Colors} from '../theme/colors';
import {Spacing} from '../theme/spacing';
import {Typography} from '../theme/typography';
import {getAllSubjects} from '../db/queries/subjects';
import {getAttendanceStats, getAllInstances} from '../db/queries/lectureInstances';
import {executeSql, rowsToArray} from '../db/database';
import {computeAttendanceMetrics, simulateAttendanceOutcome} from '../services/AttendanceEngine';
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
      const results: AutopilotRecommendation[] = [];

      for (const sub of subjects) {
        const stats = await getAttendanceStats(sub.id, sub.target_percent);
        const targetPercent = sub.target_percent || 75;

        // Query actual weekly timetable frequency
        const ttCountRes = await executeSql(
          'SELECT COUNT(*) as weeklyCount FROM timetable WHERE subject_id = ?',
          [sub.id],
        );
        const ttRows = rowsToArray<{weeklyCount: number}>(ttCountRes);
        const weeklyFrequency = ttRows[0]?.weeklyCount ?? 0;

        // Dynamic projection: remaining weeks in academic term (default 8) * weekly frequency
        const estimatedRemainingWeeks = 8;
        const remainingEst = weeklyFrequency > 0
          ? weeklyFrequency * estimatedRemainingWeeks
          : 12;

        const currentConducted = stats.total;
        const currentAttended = stats.attended;

        // Total projected classes at term end
        const projectedConducted = currentConducted + remainingEst;
        const targetRatio = targetPercent / 100;
        const requiredTotalAttended = Math.ceil(projectedConducted * targetRatio);
        
        const neededFromRemaining = Math.max(0, requiredTotalAttended - currentAttended);
        const safeBunks = Math.max(0, remainingEst - neededFromRemaining);

        let status: 'safe' | 'warning' | 'danger' = 'safe';
        let advice = `You can safely miss up to ${safeBunks} classes across remaining weeks.`;

        if (stats.percent < targetPercent) {
          status = 'danger';
          const consecutiveNeeded = stats.neededToTarget || Math.ceil((targetRatio * currentConducted - currentAttended) / (1 - targetRatio));
          advice = `Critical: Attend next ${consecutiveNeeded} classes consecutively to recover back to ${targetPercent}%!`;
        } else if (safeBunks <= 1) {
          status = 'warning';
          advice = `Borderline buffer. Attend upcoming classes to prevent falling below ${targetPercent}%.`;
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
        <View style={styles.headerTitleRow}>
          <Text style={styles.title}>🤖 Attendance Autopilot</Text>
          <View style={styles.aiBadge}>
            <Text style={styles.aiBadgeText}>AI ENGINE</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>Predictive Class Planning & Dynamic Semester Projections</Text>
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
              <Text style={styles.metaText}>🟢 Safe Bunks: {item.safeBunkCount} hrs</Text>
              <Text style={styles.metaText}>🔴 Required: {item.mandatoryAttendCount} hrs</Text>
              <Text style={styles.metaText}>📅 Sched: ~{item.remainingClassesEstimated} left</Text>
            </View>
          </View>
        </View>
      ))}

      <View style={styles.disclaimerContainer}>
        <Text style={styles.disclaimerText}>
          ℹ️ Mathematical projection calculated using your weekly timetable frequency and attendance rules. Not a guaranteed outcome.
        </Text>
      </View>
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  aiBadge: {
    backgroundColor: '#38BDF820',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#38BDF840',
  },
  aiBadgeText: {
    color: '#38BDF8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
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
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
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
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: 4,
  },
  metaText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  disclaimerContainer: {
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  disclaimerText: {
    fontSize: 10,
    color: Colors.textMuted || '#64748B',
    lineHeight: 14,
  },
});
