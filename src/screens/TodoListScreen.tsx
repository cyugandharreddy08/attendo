import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useIsFocused} from '@react-navigation/native';
import {format} from 'date-fns';
import Toast from 'react-native-toast-message';
import {TodoItem, PriorityLevel, Subject} from '../types';
import {getAllTodos, createTodo, toggleTodoCompleted, deleteTodo} from '../db/queries/todos';
import {getAllSubjects} from '../db/queries/subjects';
import {scheduleTaskAlarm} from '../services/NotificationService';
import {Colors} from '../theme/colors';
import {Spacing} from '../theme/spacing';
import {Typography} from '../theme/typography';

type FilterTab = 'all' | 'pending' | 'completed' | 'high';

export default function TodoListScreen() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [modalVisible, setModalVisible] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dueTime, setDueTime] = useState('18:00');
  const [priority, setPriority] = useState<PriorityLevel>('medium');
  const [alarmMinutes, setAlarmMinutes] = useState(15);
  const [notes, setNotes] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [todoList, subjList] = await Promise.all([
        getAllTodos(),
        getAllSubjects(),
      ]);
      setTodos(todoList);
      setSubjects(subjList);
    } catch (e) {
      console.error('Failed to load todos:', e);
    }
  }, []);

  useEffect(() => {
    if (isFocused) {
      loadData();
    }
  }, [isFocused, loadData]);

  const handleCreateTask = async () => {
    if (!title.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Title Required',
        text2: 'Please enter a task title',
      });
      return;
    }

    try {
      const id = await createTodo(
        title,
        dueDate,
        dueTime,
        priority,
        selectedSubjectId,
        alarmMinutes,
        notes,
      );

      // Schedule Alarm
      if (alarmMinutes > 0) {
        await scheduleTaskAlarm({
          id,
          title,
          subject_id: selectedSubjectId,
          due_date: dueDate,
          due_time: dueTime,
          priority,
          is_completed: 0,
          alarm_minutes_before: alarmMinutes,
          notes,
          created_at: new Date().toISOString(),
        });
      }

      Toast.show({
        type: 'success',
        text1: 'Task Added',
        text2: 'Reminder scheduled cleanly!',
      });

      setModalVisible(false);
      setTitle('');
      setNotes('');
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggle = async (item: TodoItem) => {
    try {
      await toggleTodoCompleted(item.id, item.is_completed);
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert('Delete Task', 'Are you sure you want to remove this task?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTodo(id);
          await loadData();
        },
      },
    ]);
  };

  const filteredTodos = todos.filter(t => {
    if (filter === 'pending') return t.is_completed === 0;
    if (filter === 'completed') return t.is_completed === 1;
    if (filter === 'high') return t.priority === 'high';
    return true;
  });

  const completedCount = todos.filter(t => t.is_completed === 1).length;
  const totalCount = todos.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const getPriorityBadge = (p: PriorityLevel) => {
    switch (p) {
      case 'high':
        return {label: '🔴 High', color: Colors.absent};
      case 'medium':
        return {label: '🟡 Med', color: Colors.cancelled};
      case 'low':
        return {label: '🟢 Low', color: Colors.present};
    }
  };

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      {/* Header Summary */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={Typography.h2}>To-Do & Tasks</Text>
            <Text style={styles.subtitle}>Assignments, Exams & Reminders</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setModalVisible(true)}>
            <Text style={styles.addBtnText}>+ New Task</Text>
          </TouchableOpacity>
        </View>

        {/* Progress Card */}
        <View style={styles.progressCard}>
          <View style={styles.progressTop}>
            <Text style={styles.progressText}>
              {completedCount} of {totalCount} Completed ({progressPercent}%)
            </Text>
            <Text style={styles.streakText}>🎯 Keep going!</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, {width: `${progressPercent}%`}]} />
          </View>
        </View>

        {/* Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {(['all', 'pending', 'completed', 'high'] as FilterTab[]).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.filterChip, filter === tab && styles.filterChipActive]}
              onPress={() => setFilter(tab)}>
              <Text style={[styles.filterChipText, filter === tab && styles.filterChipTextActive]}>
                {tab === 'all' && '📋 All'}
                {tab === 'pending' && '⏳ Pending'}
                {tab === 'completed' && '✅ Done'}
                {tab === 'high' && '🔥 High Priority'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Task List */}
      <FlatList
        data={filteredTodos}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({item}) => {
          const priorityInfo = getPriorityBadge(item.priority);
          return (
            <TouchableOpacity
              style={[
                styles.taskCard,
                item.is_completed === 1 && styles.taskCardCompleted,
              ]}
              onPress={() => handleToggle(item)}
              activeOpacity={0.8}>
              <TouchableOpacity
                style={[
                  styles.checkbox,
                  item.is_completed === 1 && styles.checkboxChecked,
                ]}
                onPress={() => handleToggle(item)}>
                {item.is_completed === 1 && <Text style={styles.checkMark}>✓</Text>}
              </TouchableOpacity>

              <View style={{flex: 1}}>
                <Text
                  style={[
                    styles.taskTitle,
                    item.is_completed === 1 && styles.taskTitleCompleted,
                  ]}>
                  {item.title}
                </Text>

                <View style={styles.badgeRow}>
                  {item.subject && (
                    <View style={[styles.subjectTag, {backgroundColor: item.subject.color + '22', borderColor: item.subject.color}]}>
                      <Text style={[styles.subjectTagText, {color: item.subject.color}]}>
                        {item.subject.name}
                      </Text>
                    </View>
                  )}
                  <View style={[styles.priorityTag, {borderColor: priorityInfo.color + '66'}]}>
                    <Text style={[styles.priorityText, {color: priorityInfo.color}]}>
                      {priorityInfo.label}
                    </Text>
                  </View>
                  <Text style={styles.dueDateText}>
                    📅 {item.due_date} {item.due_time ? `at ${item.due_time}` : ''}
                  </Text>
                </View>
              </View>

              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
                <Text style={styles.deleteBtnText}>🗑️</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No tasks found</Text>
            <Text style={styles.emptySubtext}>Tap "+ New Task" above to add your first assignment or reminder!</Text>
          </View>
        }
      />

      {/* Add Task Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={Typography.h3}>Create New Task</Text>

            <TextInput
              style={styles.input}
              placeholder="Task title (e.g. Submit Lab Record)"
              placeholderTextColor={Colors.textMuted}
              value={title}
              onChangeText={setTitle}
            />

            <Text style={styles.label}>Select Subject (Optional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 12}}>
              <TouchableOpacity
                style={[styles.subjectChip, selectedSubjectId === null && styles.subjectChipActive]}
                onPress={() => setSelectedSubjectId(null)}>
                <Text style={styles.subjectChipText}>General</Text>
              </TouchableOpacity>
              {subjects.map(s => (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.subjectChip,
                    {borderColor: s.color},
                    selectedSubjectId === s.id && {backgroundColor: s.color + '44'},
                  ]}
                  onPress={() => setSelectedSubjectId(s.id)}>
                  <Text style={[styles.subjectChipText, {color: s.color}]}>{s.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Priority Level</Text>
            <View style={styles.rowBtnGroup}>
              {(['low', 'medium', 'high'] as PriorityLevel[]).map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.groupBtn, priority === p && styles.groupBtnActive]}
                  onPress={() => setPriority(p)}>
                  <Text style={styles.groupBtnText}>
                    {p === 'low' && '🟢 Low'}
                    {p === 'medium' && '🟡 Medium'}
                    {p === 'high' && '🔴 High'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Due Date & Time</Text>
            <View style={{flexDirection: 'row', gap: 10, marginBottom: 12}}>
              <TextInput
                style={[styles.input, {flex: 1, marginBottom: 0}]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textMuted}
                value={dueDate}
                onChangeText={setDueDate}
              />
              <TextInput
                style={[styles.input, {width: 100, marginBottom: 0}]}
                placeholder="HH:MM"
                placeholderTextColor={Colors.textMuted}
                value={dueTime}
                onChangeText={setDueTime}
              />
            </View>

            <Text style={styles.label}>Alarm Reminder</Text>
            <View style={styles.rowBtnGroup}>
              {[15, 30, 60, 0].map(mins => (
                <TouchableOpacity
                  key={mins}
                  style={[styles.groupBtn, alarmMinutes === mins && styles.groupBtnActive]}
                  onPress={() => setAlarmMinutes(mins)}>
                  <Text style={styles.groupBtnText}>
                    {mins === 0 ? 'Off' : `${mins}m before`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{flexDirection: 'row', gap: 10, marginTop: 16}}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleCreateTask}>
                <Text style={styles.modalSaveText}>Save Task</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.screenPad,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  subtitle: {
    ...Typography.body2,
    color: Colors.textSecondary,
  },
  addBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: {
    ...Typography.body2,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  progressCard: {
    backgroundColor: Colors.card,
    borderRadius: Spacing.cardRadius,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  progressTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressText: {
    ...Typography.caption,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  streakText: {
    ...Typography.caption,
    color: Colors.primaryLight,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: Colors.surface,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.present,
  },
  filterRow: {
    flexDirection: 'row',
  },
  filterChip: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary + '33',
    borderColor: Colors.primary,
  },
  filterChipText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.primaryLight,
    fontWeight: '700',
  },
  list: {
    padding: Spacing.screenPad,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Spacing.cardRadius,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  taskCardCompleted: {
    opacity: 0.5,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
  },
  checkMark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  taskTitle: {
    ...Typography.body1,
    fontWeight: '600',
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: Colors.textMuted,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  subjectTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  subjectTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  priorityTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700',
  },
  dueDateText: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  deleteBtn: {
    padding: 6,
  },
  deleteBtnText: {
    fontSize: 16,
  },
  empty: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    ...Typography.h4,
    color: Colors.textSecondary,
  },
  emptySubtext: {
    ...Typography.caption,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: Spacing.screenPad,
  },
  modalContainer: {
    backgroundColor: Colors.card,
    borderRadius: Spacing.cardRadiusLg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 12,
    marginBottom: 12,
  },
  label: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  subjectChip: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  subjectChipActive: {
    backgroundColor: Colors.primary + '33',
    borderColor: Colors.primary,
  },
  subjectChipText: {
    ...Typography.caption,
    color: Colors.textPrimary,
  },
  rowBtnGroup: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  groupBtn: {
    flex: 1,
    backgroundColor: Colors.surface,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  groupBtnActive: {
    backgroundColor: Colors.primary + '33',
    borderColor: Colors.primary,
  },
  groupBtnText: {
    ...Typography.caption,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: Colors.surface,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelText: {
    ...Typography.body2,
    color: Colors.textSecondary,
  },
  modalSaveBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalSaveText: {
    ...Typography.body2,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
