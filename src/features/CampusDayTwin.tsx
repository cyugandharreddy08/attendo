import React, {useState, useEffect} from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {Colors} from '../theme/colors';
import {Spacing} from '../theme/spacing';
import {Typography} from '../theme/typography';
import {getAllSubjects} from '../db/queries/subjects';
import {getAttendanceStats} from '../db/queries/lectureInstances';
import {Subject, AttendanceStats} from '../types';

interface SimulatedSubject {
  subject: Subject;
  stats: AttendanceStats;
  simAttended: number;
  simTotal: number;
}

export default function CampusDayTwin() {
  const [items, setItems] = useState<SimulatedSubject[]>([]);
  const [extraBunks, setExtraBunks] = useState(0);
  const [extraAttended, setExtraAttended] = useState(0);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const subs = await getAllSubjects();
    const list: SimulatedSubject[] = [];
    for (const s of subs) {
      const stats = await getAttendanceStats(s.id, s.target_percent);
      list.push({
        subject: s,
        stats,
        simAttended: stats.attended,
        simTotal: stats.total,
      });
    }
    setItems(list);
  };

  const adjustBunks = (delta: number) => {
    setExtraBunks(prev => Math.max(0, prev + delta));
  };

  const adjustAttended = (delta: number) => {
    setExtraAttended(prev => Math.max(0, prev + delta));
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>🔮 Campus Day Twin (Semester Simulator)</Text>
        <Text style={styles.subtitle}>Simulate future absences & extra classes to see impact</Text>
      </View>

      {/* Simulator Controls */}
      <View style={styles.controlsRow}>
        <View style={styles.controlBox}>
          <Text style={styles.controlLabel}>Planned Absences</Text>
          <View style={styles.counterRow}>
            <TouchableOpacity style={styles.counterBtn} onPress={() => adjustBunks(-1)}>
              <Text style={styles.counterBtnText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.counterVal}>{extraBunks} classes</Text>
            <TouchableOpacity style={styles.counterBtn} onPress={() => adjustBunks(1)}>
              <Text style={styles.counterBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.controlBox}>
          <Text style={styles.controlLabel}>Extra Classes Attended</Text>
          <View style={styles.counterRow}>
            <TouchableOpacity style={styles.counterBtn} onPress={() => adjustAttended(-1)}>
              <Text style={styles.counterBtnText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.counterVal}>{extraAttended} classes</Text>
            <TouchableOpacity style={styles.counterBtn} onPress={() => adjustAttended(1)}>
              <Text style={styles.counterBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Results */}
      {items.map(item => {
        const newAttended = item.stats.attended + extraAttended;
        const newTotal = item.stats.total + extraAttended + extraBunks;
        const newPercent = newTotal > 0 ? Math.round((newAttended / newTotal) * 100) : 0;
        const diff = newPercent - item.stats.percent;

        return (
          <View key={item.subject.id} style={styles.resultRow}>
            <Text style={styles.subjectName}>{item.subject.name}</Text>
            <View style={styles.percentGroup}>
              <Text style={styles.currentPercent}>{item.stats.percent}%</Text>
              <Text style={styles.arrow}>➔</Text>
              <Text style={[
                styles.simPercent,
                newPercent >= item.subject.target_percent ? {color: Colors.present} : {color: Colors.absent}
              ]}>
                {newPercent}%
              </Text>
              <Text style={[styles.diffText, diff >= 0 ? {color: Colors.present} : {color: Colors.absent}]}>
                ({diff >= 0 ? `+${diff}%` : `${diff}%`})
              </Text>
            </View>
          </View>
        );
      })}
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
  },
  controlLabel: {
    fontSize: 11,
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
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  subjectName: {
    ...Typography.body1,
    fontWeight: '600',
    color: Colors.textPrimary,
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
});
