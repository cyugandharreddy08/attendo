import React, {useState, useEffect} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ScrollView} from 'react-native';
import {Colors} from '../theme/colors';
import {Spacing} from '../theme/spacing';
import {Typography} from '../theme/typography';
import {getAllSubjects} from '../db/queries/subjects';
import {getAttendanceStats} from '../db/queries/lectureInstances';
import {simulateAttendanceOutcome} from '../services/AttendanceEngine';
import {Subject, AttendanceStats} from '../types';

interface SimulatedSubject {
  subject: Subject;
  stats: AttendanceStats;
  extraBunks: number;
  extraAttended: number;
}

export default function CampusDayTwin() {
  const [items, setItems] = useState<SimulatedSubject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | 'all'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const subs = await getAllSubjects();
      const list: SimulatedSubject[] = [];
      for (const s of subs) {
        const stats = await getAttendanceStats(s.id, s.target_percent);
        list.push({
          subject: s,
          stats,
          extraBunks: 0,
          extraAttended: 0,
        });
      }
      setItems(list);
    } finally {
      setLoading(false);
    }
  };

  const adjustBunks = (subjectId: number | 'all', delta: number) => {
    setItems(prev =>
      prev.map(item => {
        if (subjectId === 'all' || item.subject.id === subjectId) {
          return {
            ...item,
            extraBunks: Math.max(0, item.extraBunks + delta),
          };
        }
        return item;
      })
    );
  };

  const adjustAttended = (subjectId: number | 'all', delta: number) => {
    setItems(prev =>
      prev.map(item => {
        if (subjectId === 'all' || item.subject.id === subjectId) {
          return {
            ...item,
            extraAttended: Math.max(0, item.extraAttended + delta),
          };
        }
        return item;
      })
    );
  };

  const resetSimulation = () => {
    setItems(prev => prev.map(item => ({...item, extraBunks: 0, extraAttended: 0})));
  };

  if (loading) return null;

  const currentSelectionItem = selectedSubjectId === 'all'
    ? null
    : items.find(i => i.subject.id === selectedSubjectId);

  const activeBunks = currentSelectionItem ? currentSelectionItem.extraBunks : (items[0]?.extraBunks ?? 0);
  const activeAttended = currentSelectionItem ? currentSelectionItem.extraAttended : (items[0]?.extraAttended ?? 0);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.title}>🔮 Campus Day Twin</Text>
          <TouchableOpacity onPress={resetSimulation} style={styles.resetBtn}>
            <Text style={styles.resetBtnText}>Reset</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>Independent Subject & Semester Attendance Simulator</Text>
      </View>

      {/* Subject Filter Pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        <TouchableOpacity
          style={[styles.filterPill, selectedSubjectId === 'all' && styles.filterPillActive]}
          onPress={() => setSelectedSubjectId('all')}>
          <Text style={[styles.filterPillText, selectedSubjectId === 'all' && styles.filterPillTextActive]}>
            All Subjects
          </Text>
        </TouchableOpacity>
        {items.map(i => (
          <TouchableOpacity
            key={i.subject.id}
            style={[styles.filterPill, selectedSubjectId === i.subject.id && styles.filterPillActive]}
            onPress={() => setSelectedSubjectId(i.subject.id)}>
            <View style={[styles.pillDot, {backgroundColor: i.subject.color}]} />
            <Text style={[styles.filterPillText, selectedSubjectId === i.subject.id && styles.filterPillTextActive]}>
              {i.subject.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Simulator Controls */}
      <View style={styles.controlsRow}>
        <View style={styles.controlBox}>
          <Text style={styles.controlLabel}>
            Planned Absences {selectedSubjectId !== 'all' ? `(${currentSelectionItem?.subject.name})` : '(All)'}
          </Text>
          <View style={styles.counterRow}>
            <TouchableOpacity style={styles.counterBtn} onPress={() => adjustBunks(selectedSubjectId, -1)}>
              <Text style={styles.counterBtnText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.counterVal}>{activeBunks} hrs</Text>
            <TouchableOpacity style={styles.counterBtn} onPress={() => adjustBunks(selectedSubjectId, 1)}>
              <Text style={styles.counterBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.controlBox}>
          <Text style={styles.controlLabel}>
            Extra Attended {selectedSubjectId !== 'all' ? `(${currentSelectionItem?.subject.name})` : '(All)'}
          </Text>
          <View style={styles.counterRow}>
            <TouchableOpacity style={styles.counterBtn} onPress={() => adjustAttended(selectedSubjectId, -1)}>
              <Text style={styles.counterBtnText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.counterVal}>{activeAttended} hrs</Text>
            <TouchableOpacity style={styles.counterBtn} onPress={() => adjustAttended(selectedSubjectId, 1)}>
              <Text style={styles.counterBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Results */}
      {items
        .filter(item => selectedSubjectId === 'all' || item.subject.id === selectedSubjectId)
        .map(item => {
          const sim = simulateAttendanceOutcome({
            currentAttendedHours: item.stats.attended,
            currentConductedHours: item.stats.total,
            additionalAttendedHours: item.extraAttended,
            additionalMissedHours: item.extraBunks,
            targetPercent: item.subject.target_percent || 75,
          });

          const diff = sim.diffPercent;

          return (
            <View key={item.subject.id} style={styles.resultRow}>
              <View style={{flex: 1}}>
                <Text style={styles.subjectName}>{item.subject.name}</Text>
                <Text style={styles.simDetailsText}>
                  {sim.statusMessage}
                </Text>
              </View>
              <View style={styles.percentGroup}>
                <Text style={styles.currentPercent}>{item.stats.percent}%</Text>
                <Text style={styles.arrow}>➔</Text>
                <Text style={[
                  styles.simPercent,
                  sim.projectedPercent >= item.subject.target_percent ? {color: Colors.present} : {color: Colors.absent}
                ]}>
                  {sim.projectedPercent}%
                </Text>
                <Text style={[styles.diffText, diff >= 0 ? {color: Colors.present} : {color: Colors.absent}]}>
                  ({diff >= 0 ? `+${diff}%` : `${diff}%`})
                </Text>
              </View>
            </View>
          );
        })}

      <View style={styles.disclaimerContainer}>
        <Text style={styles.disclaimerText}>
          ℹ️ Hypothetical what-if simulation calculated independently per subject. Does not alter your recorded attendance history.
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
    marginBottom: Spacing.sm,
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
  resetBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  resetBtnText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  subtitle: {
    ...Typography.body2,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  filterScroll: {
    marginBottom: Spacing.md,
  },
  filterContent: {
    gap: 6,
    paddingVertical: 4,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  filterPillActive: {
    backgroundColor: '#38BDF822',
    borderColor: '#38BDF8',
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  filterPillText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: '#38BDF8',
    fontWeight: '700',
  },
  controlsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  controlBox: {
    flex: 1,
    backgroundColor: Colors.surface,
    padding: Spacing.sm,
    borderRadius: Spacing.cardRadius,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  controlLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: 4,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counterBtn: {
    backgroundColor: Colors.primary + '33',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnText: {
    color: Colors.primaryLight,
    fontWeight: '700',
    fontSize: 16,
  },
  counterVal: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  subjectName: {
    ...Typography.body1,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  simDetailsText: {
    fontSize: 11,
    color: Colors.textMuted || '#64748B',
    marginTop: 2,
  },
  percentGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  currentPercent: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  arrow: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  simPercent: {
    fontSize: 14,
    fontWeight: '700',
  },
  diffText: {
    fontSize: 11,
    fontWeight: '700',
  },
  disclaimerContainer: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  disclaimerText: {
    fontSize: 10,
    color: Colors.textMuted || '#64748B',
    lineHeight: 14,
  },
});
