import React, {useState, useEffect} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Share} from 'react-native';
import {Colors} from '../theme/colors';
import {Spacing} from '../theme/spacing';
import {Typography} from '../theme/typography';
import {executeSql, rowsToArray} from '../db/database';
import {LectureInstance} from '../types';

export default function SmartCatchUpCoach() {
  const [absentLectures, setAbsentLectures] = useState<LectureInstance[]>([]);

  useEffect(() => {
    loadAbsentLectures();
  }, []);

  const loadAbsentLectures = async () => {
    const res = await executeSql(`
      SELECT li.*, s.name as subject_name, s.color as subject_color
      FROM lecture_instances li
      LEFT JOIN subjects s ON li.subject_id = s.id
      WHERE li.status = 'absent'
      ORDER BY li.date DESC
      LIMIT 3
    `);
    setAbsentLectures(rowsToArray<any>(res).map(r => ({
      ...r,
      subject: { id: r.subject_id, name: r.subject_name, color: r.subject_color, target_percent: 75 }
    })));
  };

  const handleShareNoteRequest = async (lecture: LectureInstance) => {
    try {
      await Share.share({
        message: `Hey! I missed ${lecture.subject?.name || 'class'} on ${lecture.date} (${lecture.start_time} - ${lecture.end_time}). Could you please share the class notes and assignment details with me? Thanks!`,
      });
    } catch (e) {}
  };

  if (absentLectures.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>🏃 Smart Catch-Up Coach</Text>
        <Text style={styles.subtitle}>Recovery tasks for recently missed classes</Text>
      </View>

      {absentLectures.map(lecture => (
        <View key={lecture.id} style={styles.itemBox}>
          <View style={styles.itemHeader}>
            <Text style={styles.subjectName}>{lecture.subject?.name || 'Class'}</Text>
            <Text style={styles.dateBadge}>{lecture.date}</Text>
          </View>

          <Text style={styles.checklistTitle}>Action Items:</Text>
          <Text style={styles.checklistItem}>• Get lecture slides & notes for {lecture.date}</Text>
          <Text style={styles.checklistItem}>• Schedule 45-min study block before next session</Text>
          <Text style={styles.checklistItem}>• Check LMS for newly assigned homework</Text>

          <TouchableOpacity
            style={styles.requestBtn}
            onPress={() => handleShareNoteRequest(lecture)}>
            <Text style={styles.requestBtnText}>📱 Ask Classmate for Notes</Text>
          </TouchableOpacity>
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
  itemBox: {
    backgroundColor: Colors.surface,
    borderRadius: Spacing.cardRadius,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  subjectName: {
    ...Typography.h4,
    color: Colors.absent,
  },
  dateBadge: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  checklistTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  checklistItem: {
    fontSize: 12,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  requestBtn: {
    backgroundColor: Colors.primary + '33',
    paddingVertical: 8,
    borderRadius: Spacing.cardRadius,
    alignItems: 'center',
    marginTop: 8,
  },
  requestBtnText: {
    color: Colors.primaryLight,
    fontWeight: '700',
    fontSize: 12,
  },
});
