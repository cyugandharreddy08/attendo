import React, {useState, useEffect, useCallback} from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useIsFocused, useNavigation} from '@react-navigation/native';
import {Colors} from '../theme/colors';
import {Spacing} from '../theme/spacing';
import {getAllSubjects, deleteSubject} from '../db/queries/subjects';
import {getAttendanceStats, getAllSubjectStreaks} from '../db/queries/lectureInstances';
import {Subject, AttendanceStats} from '../types';
import SubjectCard from '../components/SubjectCard';

interface SubjectWithStats {
  subject: Subject;
  stats: AttendanceStats;
  streak: number;
}

export default function SubjectListScreen() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const navigation = useNavigation<any>();
  const [subjectsWithStats, setSubjectsWithStats] = useState<SubjectWithStats[]>([]);
  const [filter, setFilter] = useState<'all' | 'theory' | 'lab'>('all');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [subjects, streakMap] = await Promise.all([
        getAllSubjects(),
        getAllSubjectStreaks(),
      ]);
      const withStats = await Promise.all(
        subjects.map(async subject => ({
          subject,
          stats: await getAttendanceStats(subject.id, subject.target_percent),
          streak: streakMap[subject.id] ?? 0,
        })),
      );
      setSubjectsWithStats(withStats);
    } catch (e) {
      console.error('Failed to load subjects:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isFocused) loadData();
  }, [isFocused, loadData]);

  const filteredItems = subjectsWithStats.filter(item => {
    if (filter === 'all') return true;
    const type = item.subject.subject_type || 'theory';
    return type === filter;
  });

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Subjects</Text>
          <Text style={styles.subtitle}>{subjectsWithStats.length} total subjects</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.reportsBtn}
            onPress={() => navigation.navigate('Reports')}>
            <Text style={styles.reportsBtnText}>📊 Reports</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate('AddSubject')}>
            <Text style={styles.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Segmented Pills */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterPill, filter === 'all' && styles.filterPillActive]}
          onPress={() => setFilter('all')}>
          <Text style={[styles.filterPillText, filter === 'all' && styles.filterPillTextActive]}>
            All ({subjectsWithStats.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterPill, filter === 'theory' && styles.filterPillActive]}
          onPress={() => setFilter('theory')}>
          <Text style={[styles.filterPillText, filter === 'theory' && styles.filterPillTextActive]}>
            📚 Theory ({subjectsWithStats.filter(s => (s.subject.subject_type || 'theory') === 'theory').length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterPill, filter === 'lab' && styles.filterPillActive]}
          onPress={() => setFilter('lab')}>
          <Text style={[styles.filterPillText, filter === 'lab' && styles.filterPillTextActive]}>
            🧪 Labs ({subjectsWithStats.filter(s => s.subject.subject_type === 'lab').length})
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredItems}
        keyExtractor={item => String(item.subject.id)}
        renderItem={({item}) => (
          <SubjectCard
            subject={item.subject}
            stats={item.stats}
            streak={item.streak}
            onPress={() =>
              navigation.navigate('SubjectDetail', {
                subjectId: item.subject.id,
                subjectName: item.subject.name,
              })
            }
          />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📚</Text>
              <Text style={styles.emptyTitle}>No subjects in this category</Text>
              <Text style={styles.emptySubtitle}>Tap + to add a subject or scan your timetable</Text>
              <TouchableOpacity
                style={styles.scanBtn}
                onPress={() => navigation.navigate('TimetableScan')}>
                <Text style={styles.scanBtnText}>📷 Scan Timetable</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.screenPad,
    paddingTop: Spacing.md, paddingBottom: Spacing.sm,
  },
  title: {fontSize: 26, fontWeight: '700', color: Colors.textPrimary},
  subtitle: {fontSize: 13, color: Colors.textSecondary, marginTop: 2},
  headerActions: {flexDirection: 'row', gap: 8, alignItems: 'center'},
  reportsBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  reportsBtnText: {fontSize: 13, color: Colors.textPrimary, fontWeight: '600'},
  addBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  addBtnText: {fontSize: 24, color: '#fff', fontWeight: '300', lineHeight: 28},
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: Spacing.screenPad,
    marginBottom: Spacing.sm,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterPillActive: {
    backgroundColor: Colors.primary + '33',
    borderColor: Colors.primary,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterPillTextActive: {
    color: Colors.primaryLight,
    fontWeight: '700',
  },
  listContent: {paddingTop: Spacing.sm, paddingBottom: 100},
  empty: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 32},
  emptyIcon: {fontSize: 52, marginBottom: 16},
  emptyTitle: {fontSize: 20, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center'},
  emptySubtitle: {fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20},
  scanBtn: {
    marginTop: 20, paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 12, backgroundColor: Colors.primary,
  },
  scanBtnText: {fontSize: 15, color: '#fff', fontWeight: '700'},
});
