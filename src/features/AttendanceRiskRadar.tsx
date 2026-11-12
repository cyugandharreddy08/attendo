import React, {useState, useEffect} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {Colors} from '../theme/colors';
import {Spacing} from '../theme/spacing';
import {Typography} from '../theme/typography';
import {executeSql, rowsToArray} from '../db/database';
import {getAllSubjects} from '../db/queries/subjects';
import {getAttendanceStats} from '../db/queries/lectureInstances';

interface RiskPattern {
  dayOfWeek: string;
  absentCount: number;
}

interface AtRiskSubject {
  name: string;
  percent: number;
  targetPercent: number;
  weeksUntilDanger: number;
  neededHours: number;
  bunksLeft: number;
}

export default function AttendanceRiskRadar() {
  const [mostMissedDay, setMostMissedDay] = useState<RiskPattern | null>(null);
  const [atRiskSubjects, setAtRiskSubjects] = useState<AtRiskSubject[]>([]);

  useEffect(() => {
    analyzeRiskPatterns();
  }, []);

  const analyzeRiskPatterns = async () => {
    // 1. Find most missed day of the week
    const dayRes = await executeSql(`
      SELECT day_of_week as dayOfWeek, COUNT(*) as absentCount
      FROM lecture_instances
      WHERE status = 'absent'
      GROUP BY day_of_week
      ORDER BY absentCount DESC
      LIMIT 1
    `);
    const dayRows = rowsToArray<RiskPattern>(dayRes);
    if (dayRows.length > 0 && dayRows[0].absentCount > 0) {
      setMostMissedDay(dayRows[0]);
    }

    // 2. Identify subjects at risk using centralized attendance stats
    const subjects = await getAllSubjects();
    const risks: AtRiskSubject[] = [];

    for (const s of subjects) {
      const stats = await getAttendanceStats(s.id, s.target_percent);
      const target = s.target_percent || 75;

      if (stats.total > 0) {
        const margin = stats.percent - target;
        if (margin <= 5 || stats.isInDangerZone) {
          risks.push({
            name: s.name,
            percent: stats.percent,
            targetPercent: target,
            weeksUntilDanger: margin <= 0 ? 0 : Math.max(1, Math.ceil(margin / 2)),
            neededHours: stats.neededToTarget,
            bunksLeft: stats.maxBunkable,
          });
        }
      }
    }

    setAtRiskSubjects(risks);
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>📡 Attendance Risk Radar</Text>
        <Text style={styles.subtitle}>Pattern detection & 2–4 week predictive risk warnings</Text>
      </View>

      {mostMissedDay && (
        <View style={styles.patternBox}>
          <Text style={styles.patternTitle}>⚠️ Pattern Detected:</Text>
          <Text style={styles.patternText}>
            You miss <Text style={{fontWeight: '700', color: Colors.absent}}>{mostMissedDay.dayOfWeek}</Text> classes most frequently ({mostMissedDay.absentCount} total absences).
          </Text>
        </View>
      )}

      {atRiskSubjects.length > 0 ? (
        atRiskSubjects.map(sub => (
          <View key={sub.name} style={styles.riskRow}>
            <View style={{flex: 1}}>
              <Text style={styles.subName}>{sub.name}</Text>
              <Text style={styles.subDetail}>
                Current: {sub.percent}% | Target: {sub.targetPercent}% {sub.bunksLeft > 0 ? `| Buffer: ${sub.bunksLeft}h` : `| Recover: +${sub.neededHours}h`}
              </Text>
            </View>
            <View style={styles.warningTag}>
              <Text style={styles.warningTagText}>
                {sub.weeksUntilDanger === 0 ? '🚨 IN DANGER' : `⚠️ Risk in ~${sub.weeksUntilDanger} wks`}
              </Text>
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.cleanText}>✅ All subjects are currently safe from falling below target!</Text>
      )}

      <View style={styles.disclaimerContainer}>
        <Text style={styles.disclaimerText}>
          ℹ️ Risk warnings analyze past absence patterns and duration-weighted metrics to alert you before you breach eligibility.
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
  disclaimerContainer: {
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
  },
  disclaimerText: {
    fontSize: 10,
    color: Colors.textMuted || '#64748B',
    lineHeight: 14,
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
  patternBox: {
    backgroundColor: Colors.absent + '15',
    borderColor: Colors.absent + '44',
    borderWidth: 1,
    borderRadius: Spacing.cardRadius,
    padding: Spacing.sm + 4,
    marginBottom: Spacing.md,
  },
  patternTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.absent,
    marginBottom: 2,
  },
  patternText: {
    fontSize: 12,
    color: Colors.textPrimary,
  },
  riskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    padding: Spacing.sm + 4,
    borderRadius: Spacing.cardRadius,
    marginBottom: Spacing.sm,
  },
  subName: {
    ...Typography.h4,
    color: Colors.textPrimary,
  },
  subDetail: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  warningTag: {
    backgroundColor: Colors.absent + '22',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  warningTagText: {
    color: Colors.absent,
    fontWeight: '700',
    fontSize: 11,
  },
  cleanText: {
    ...Typography.body2,
    color: Colors.present,
    fontWeight: '600',
  },
});
