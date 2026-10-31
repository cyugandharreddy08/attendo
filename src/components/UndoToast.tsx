import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import Toast from 'react-native-toast-message';
import {Colors} from '../theme/colors';
import {AttendanceStatus} from '../types';

interface UndoToastProps {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
}

const STATUS_ICONS: Record<string, string> = {
  present: '✅',
  absent: '❌',
  holiday: '🏖️',
  cancelled: '🚫',
  shifted: '↷',
};

export default function UndoToast({message, onUndo, onDismiss}: UndoToastProps) {
  return (
    <View style={styles.toastContainer}>
      <Text style={styles.toastTitle} numberOfLines={1}>{message}</Text>
      <TouchableOpacity style={styles.undoBtn} onPress={onUndo}>
        <Text style={styles.undoText}>UNDO</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss}>
        <Text style={styles.dismissText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

export function showUndoToast(
  status: AttendanceStatus,
  onUndo: () => void,
): void {
  Toast.show({
    type: 'undo',
    text1: `${STATUS_ICONS[status] ?? '📌'} Marked ${status}`,
    text2: 'Tap Undo to revert',
    visibilityTime: 5000,
    position: 'bottom',
    bottomOffset: 80,
    props: {onUndo},
  });
}

export const toastConfig = {
  undo: ({text1, text2, props}: any) => (
    <TouchableOpacity
      style={styles.toastContainer}
      onPress={props?.onUndo}
      activeOpacity={0.9}>
      <Text style={styles.toastTitle}>{text1}</Text>
      <Text style={styles.undoText}>UNDO</Text>
    </TouchableOpacity>
  ),
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    zIndex: 10000,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E2C',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    gap: 12,
    shadowColor: Colors.primary,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
  toastTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  undoBtn: {
    backgroundColor: Colors.primary + '33',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  undoText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primaryLight,
    letterSpacing: 0.5,
  },
  dismissBtn: {
    padding: 4,
  },
  dismissText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
});
