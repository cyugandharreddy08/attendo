import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import {Colors, getStatusColor} from '../theme/colors';
import {Spacing} from '../theme/spacing';
import {LectureInstance} from '../types';

interface DayDetailSheetProps {
  date: string;
  instances: LectureInstance[];
  isVisible: boolean;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  present: 'Present ✅',
  absent: 'Absent ❌',
  holiday: 'Holiday 🏖️',
  cancelled: 'Cancelled 🚫',
  shifted: 'Shifted ↷',
};

export default function DayDetailSheet({
  date,
  instances,
  isVisible,
  onClose,
}: DayDetailSheetProps) {
  if (!isVisible) return null;

  return (
    <TouchableWithoutFeedback onPress={onClose}>
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={() => {}}>
          <View style={styles.sheetContainer}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={styles.dateText}>{date}</Text>
              <Text style={styles.countText}>{instances.length} class{instances.length !== 1 ? 'es' : ''}</Text>
            </View>

            <FlatList
              data={instances}
              keyExtractor={item => String(item.id)}
              renderItem={({item}) => (
                <View style={styles.row}>
                  <View
                    style={[
                      styles.statusDot,
                      {backgroundColor: getStatusColor(item.status)},
                    ]}
                  />
                  <View style={[styles.subjectBar, {backgroundColor: item.subject?.color ?? Colors.primary}]} />
                  <View style={styles.rowContent}>
                    <Text style={styles.subjectName}>{item.subject?.name ?? 'Unknown'}</Text>
                    <Text style={styles.time}>
                      {item.start_time} – {item.end_time}
                      {item.room ? ` · ${item.room}` : ''}
                    </Text>
                  </View>
                  <Text style={[styles.statusLabel, {color: getStatusColor(item.status)}]}>
                    {item.status ? STATUS_LABELS[item.status] : 'Unmarked'}
                  </Text>
                </View>
              )}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <Text style={styles.empty}>No classes on this day</Text>
              }
            />

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.screenPad,
    paddingTop: 12,
    paddingBottom: 24,
    maxHeight: '75%',
    borderTopWidth: 1,
    borderColor: Colors.border,
    elevation: 24,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  countText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  listContent: {
    paddingVertical: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  subjectBar: {
    width: 3,
    height: 36,
    borderRadius: 2,
  },
  rowContent: {
    flex: 1,
  },
  subjectName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  time: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  empty: {
    textAlign: 'center',
    color: Colors.textMuted,
    paddingVertical: Spacing.lg,
    fontSize: 14,
  },
  closeBtn: {
    marginTop: 12,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeBtnText: {
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});
