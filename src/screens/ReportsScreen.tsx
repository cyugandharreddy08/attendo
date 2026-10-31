import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useIsFocused} from '@react-navigation/native';
import {Subject, AttendanceStats} from '../types';
import {getAllSubjects} from '../db/queries/subjects';
import {getAttendanceStats} from '../db/queries/lectureInstances';
import CircularProgress from '../components/CircularProgress';
import {Colors} from '../theme/colors';
import {Spacing} from '../theme/spacing';
import {Typography} from '../theme/typography';
import { SemesterAutopsy } from '../features/SemesterAutopsy';
import { ExcuseGenerator } from '../features/ExcuseGenerator';
import { SquadLeaderboard } from '../features/SquadLeaderboard';
import { ClassModeTimer } from '../features/ClassModeTimer';
import { RecoveryPlanner } from '../features/RecoveryPlanner';
import { NextClassWidget } from '../features/NextClassWidget';

import AttendanceAutopilot from '../features/AttendanceAutopilot';
import CampusDayTwin from '../features/CampusDayTwin';
import SmartCatchUpCoach from '../features/SmartCatchUpCoach';
import AttendanceRiskRadar from '../features/AttendanceRiskRadar';

interface SubjectReport {
  subject: Subject;
  stats: AttendanceStats;
}

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [reports, setReports] = useState<SubjectReport[]>([]);
  const [overall, setOverall] = useState<AttendanceStats | null>(null);

  const loadData = useCallback(async () => {
    const subjects = await getAllSubjects();
    const reps: SubjectReport[] = [];
    let totalTotal = 0, totalAttended = 0;
    for (const sub of subjects) {
      const stats = await getAttendanceStats(sub.id, sub.target_percent);
      reps.push({subject: sub, stats});
      totalTotal += stats.total;
      totalAttended += stats.attended;
    }
    setReports(reps);
    const overallPercent = totalTotal > 0 ? Math.round((totalAttended / totalTotal) * 100) : 0;
    setOverall({
      total: totalTotal,
      attended: totalAttended,
      absent: totalTotal - totalAttended,
      holiday: 0,
      cancelled: 0,
      percent: overallPercent,
      maxBunkable: 0,
      neededToTarget: 0,
      isInDangerZone: overallPercent < 75,
      statusMessage: overallPercent >= 75 ? 'Overall on target!' : 'Overall below 75% target',
    });
  }, []);

  useEffect(() => {
    if (isFocused) loadData();
  }, [isFocused, loadData]);

  const theoryReports = reports.filter(r => (r.subject.subject_type || 'theory') === 'theory');
  const labReports = reports.filter(r => r.subject.subject_type === 'lab');

  return (
    <ScrollView
      style={[styles.container, {paddingTop: insets.top}]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>

      {/* Overall summary */}
      {overall && (
        <View style={styles.overallCard}>
          <Text style={styles.overallTitle}>Overall Attendance (Hours-Based)</Text>
          <CircularProgress
            percent={overall.percent}
            size={130}
            strokeWidth={12}
            color={overall.isInDangerZone ? Colors.absent : Colors.present}
          />
          <View style={styles.overallStats}>
            <StatPill label="Total Hrs" value={overall.total} />
            <StatPill label="Attended" value={overall.attended} color={Colors.present} />
            <StatPill label="Absent" value={overall.absent} color={Colors.absent} />
          </View>
        </View>
      )}

      {/* Theory vs Lab Category Breakdown */}
      {reports.length > 0 && (
        <View style={styles.categoryRow}>
          {(() => {
            const tAttended = theoryReports.reduce((sum, r) => sum + r.stats.attended, 0);
            const tTotal = theoryReports.reduce((sum, r) => sum + r.stats.total, 0);
            const tPercent = tTotal > 0 ? Math.round((tAttended / tTotal) * 100) : 0;

            const lAttended = labReports.reduce((sum, r) => sum + r.stats.attended, 0);
            const lTotal = labReports.reduce((sum, r) => sum + r.stats.total, 0);
            const lPercent = lTotal > 0 ? Math.round((lAttended / lTotal) * 100) : 0;

            return (
              <>
                <View style={[styles.categoryBox, {borderColor: Colors.primary}]}>
                  <Text style={styles.categoryTitle}>📚 Theory Classes</Text>
                  <Text style={[styles.categoryPercent, {color: tPercent >= 75 ? Colors.present : Colors.absent}]}>
                    {tPercent}%
                  </Text>
                  <Text style={styles.categorySub}>{tAttended}/{tTotal} Hours</Text>
                </View>

                <View style={[styles.categoryBox, {borderColor: Colors.present}]}>
                  <Text style={styles.categoryTitle}>🧪 Lab Practicals</Text>
                  <Text style={[styles.categoryPercent, {color: lPercent >= 75 ? Colors.present : Colors.absent}]}>
                    {lPercent}%
                  </Text>
                  <Text style={styles.categorySub}>{lAttended}/{lTotal} Hours</Text>
                </View>
              </>
            );
          })()}
        </View>
      )}

      {/* Intelligence & Predictive Feature Suite */}
      <View style={{ paddingHorizontal: Spacing.screenPad }}>
        <NextClassWidget />
        <AttendanceAutopilot />
        <AttendanceRiskRadar />
        <CampusDayTwin />
        <SmartCatchUpCoach />
        <RecoveryPlanner attended={overall?.attended} total={overall?.total} targetPercent={75} />
        <SemesterAutopsy overallPercent={overall?.percent || 80} />
        <SquadLeaderboard userStreak={7} />
        <ClassModeTimer />
        <ExcuseGenerator />
      </View>

      {/* Theory Subjects Section */}
      {theoryReports.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>📚 Theory Subjects</Text>
          {theoryReports.map(({subject, stats}) => (
            <RenderSubjectCard key={subject.id} subject={subject} stats={stats} />
          ))}
        </>
      )}

      {/* Lab Subjects Section */}
      {labReports.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>🧪 Lab / Practical Subjects</Text>
          {labReports.map(({subject, stats}) => (
            <RenderSubjectCard key={subject.id} subject={subject} stats={stats} />
          ))}
        </>
      )}
    </ScrollView>
  );
}

function RenderSubjectCard({subject, stats}: {subject: Subject; stats: AttendanceStats}) {
  return (
    <View style={styles.subjectReport}>
      <View style={styles.subjectHeader}>
        <View style={[styles.subjectDot, {backgroundColor: subject.color}]} />
        <Text style={styles.subjectName}>{subject.name}</Text>
        <Text style={[styles.subjectPercent, {
          color: stats.isInDangerZone ? Colors.absent : Colors.present,
        }]}>
          {stats.percent}%
        </Text>
      </View>
      <View style={styles.progressBarBg}>
        <View
          style={[
            styles.progressBarFill,
            {
              width: `${stats.percent}%`,
              backgroundColor: stats.isInDangerZone ? Colors.absent : subject.color,
            },
          ]}
        />
      </View>
      <View style={styles.subjectStats}>
        <Text style={styles.subjectStat}>{stats.attended}/{stats.total} hrs attended</Text>
        {stats.statusMessage ? (
          <Text style={[styles.subjectStat, {color: stats.isInDangerZone ? Colors.absent : Colors.present}]}>
            {stats.statusMessage}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function StatPill({label, value, color}: {label: string; value: number; color?: string}) {
  return (
    <View style={styles.statPill}>
      <Text style={[styles.statPillValue, color ? {color} : {}]}>{value}</Text>
      <Text style={styles.statPillLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 100,
  },
  overallCard: {
    backgroundColor: Colors.card,
    margin: Spacing.screenPad,
    borderRadius: Spacing.cardRadiusLg,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  overallTitle: {
    ...Typography.h2,
    marginBottom: Spacing.lg,
  },
  overallStats: {
    flexDirection: 'row',
    gap: 16,
    marginTop: Spacing.lg,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: Spacing.screenPad,
    marginBottom: Spacing.lg,
  },
  categoryBox: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Spacing.cardRadius,
    padding: Spacing.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  categoryTitle: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  categoryPercent: {
    ...Typography.h2,
    fontWeight: '700',
    marginVertical: 2,
  },
  categorySub: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  statPill: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Spacing.cardRadius,
    minWidth: 70,
  },
  statPillValue: {
    ...Typography.h2,
  },
  statPillLabel: {
    ...Typography.caption,
    marginTop: 2,
  },
  sectionTitle: {
    ...Typography.h3,
    marginHorizontal: Spacing.screenPad,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  subjectReport: {
    backgroundColor: Colors.card,
    borderRadius: Spacing.cardRadius,
    marginHorizontal: Spacing.screenPad,
    marginBottom: 10,
    padding: Spacing.md,
  },
  subjectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  subjectDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  subjectName: {
    ...Typography.h4,
    flex: 1,
  },
  subjectPercent: {
    ...Typography.h3,
    fontWeight: '700',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: Colors.surface,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  subjectStats: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  subjectStat: {
    ...Typography.caption,
  },
});
