import React, {useState, useEffect} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {Colors} from '../theme/colors';
import {Spacing} from '../theme/spacing';
import {Typography} from '../theme/typography';
import {executeSql, rowsToArray} from '../db/database';

interface RiskPattern {
  dayOfWeek: string;
  absentCount: number;
}

interface AtRiskSubject {
  name: string;
  percent: number;
  targetPercent: number;
  weeksUntilDanger: number;
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

    // 2. Identify subjects at risk within 2-4 weeks
    const subRes = await executeSql(`
      SELECT s.name, s.target_percent as targetPercent,
             SUM(CASE WHEN li.status = 'present' THEN 1 ELSE 0 END) as attended,
             SUM(CASE WHEN li.status = 'absent' THEN 1 ELSE 0 END) as absent
      FROM subjects s
      JOIN lecture_instances li ON s.id = li.subject_id
      WHERE li.status IS NOT NULL
      GROUP BY s.id
    `);
    const subRows = rowsToArray<any>(subRes);
    const risks: AtRiskSubject[] = [];

    subRows.forEach(r => {
      const total = r.attended + r.absent;
      if (total > 0) {
        const percent = Math.round((r.attended / total) * 100);
        const margin = percent - r.targetPercent;
        if (margin <= 5) {
          risks.push({
            name: r.name,
            percent,
            targetPercent: r.targetPercent,
            weeksUntilDanger: margin <= 0 ? 0 : Math.max(1, Math.ceil(margin / 2)),
          });
        }
      }
    });

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
                Current: {sub.percent}% | Target: {sub.targetPercent}%
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
