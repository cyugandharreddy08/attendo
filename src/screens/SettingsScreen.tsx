import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {checkForJSUpdate, checkForNativeUpdate} from '../services/OTAService';
import {Colors} from '../theme/colors';
import {Spacing} from '../theme/spacing';
import {Typography} from '../theme/typography';

import {clearEntireTimetable, clearAllData} from '../db/queries/timetable';
import {scheduleClassReminders} from '../services/NotificationService';

import Clipboard from '@react-native-clipboard/clipboard';
import {Linking, Modal, TextInput} from 'react-native';
import {exportDataToJSON, importDataFromJSON} from '../db/queries/backup';

import {useNavigation} from '@react-navigation/native';

const REMINDER_OPTIONS = [
  {label: '10 mins', value: 10},
  {label: '20 mins', value: 20},
  {label: '15 mins', value: 15},
  {label: '5 mins', value: 5},
  {label: 'Off', value: 0},
];

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [reminderLead, setReminderLead] = useState(10);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');

  const handleExportBackup = async () => {
    try {
      const json = await exportDataToJSON();
      Clipboard.setString(json);
      Alert.alert(
        '💾 Backup Exported!',
        'Your full timetable, subjects & attendance history JSON has been copied to your clipboard! Save it anywhere for safety.',
      );
    } catch (e) {
      Alert.alert('Export Failed', String(e));
    }
  };

  const handleImportBackup = () => {
    setImportModalVisible(true);
  };

  const handleConfirmImport = async () => {
    if (!importJsonText.trim()) {
      Alert.alert('Input Required', 'Please paste your backup JSON code.');
      return;
    }
    try {
      await importDataFromJSON(importJsonText.trim());
      setImportModalVisible(false);
      setImportJsonText('');
      Alert.alert('🎉 Restore Complete!', 'All old subjects, timetable & attendance history have been restored successfully!');
    } catch (e) {
      Alert.alert('Restore Failed', 'Invalid backup JSON string. Please check the code and try again.');
    }
  };

  const handleGoogleCalendarSync = () => {
    const url = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=Attendo+Class+Schedule&details=Exported+from+Attendo+App';
    Linking.openURL(url).catch(() => {
      Alert.alert('Calendar', 'Could not open Google Calendar.');
    });
  };

  const handleCheckUpdate = () => {
    checkForJSUpdate(true);
  };

  const handleSetReminderLead = async (mins: number) => {
    setReminderLead(mins);
    await scheduleClassReminders(mins);
    if (mins > 0) {
      Alert.alert('Reminders Updated', `You will be notified ${mins} minutes before each class!`);
    }
  };

  const handleClearTimetable = () => {
    Alert.alert(
      'Clear Entire Timetable',
      'Are you sure you want to delete ALL timetable classes? Subjects will remain intact.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Clear Timetable',
          style: 'destructive',
          onPress: async () => {
            await clearEntireTimetable();
            Alert.alert('Timetable Cleared', 'All scheduled classes have been removed.');
          },
        },
      ],
    );
  };

  const handleFullReset = () => {
    Alert.alert(
      '💥 Full Factory Reset',
      'Are you sure you want to delete ALL subjects, timetable classes, and history? This cannot be undone.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Reset Everything',
          style: 'destructive',
          onPress: async () => {
            await clearAllData();
            Alert.alert('App Reset Complete', 'All subjects and timetable data have been wiped clean.');
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={[styles.container, {paddingTop: insets.top}]}
      contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Settings</Text>

      <SettingsSection title="Class Start Notifications">
        <SettingsRow
          label="Class Reminders"
          description="Notify me before each upcoming class starts"
          right={
            <View style={{flexDirection: 'row', gap: 4, flexWrap: 'wrap', maxWidth: 180}}>
              {REMINDER_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.actionBtn,
                    reminderLead === opt.value && {backgroundColor: Colors.primary, borderColor: Colors.primary},
                  ]}
                  onPress={() => handleSetReminderLead(opt.value)}>
                  <Text
                    style={[
                      styles.actionBtnText,
                      reminderLead === opt.value && {color: '#FFF'},
                    ]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          }
        />
      </SettingsSection>

      <SettingsSection title="Timetable & Data Management">
        <SettingsRow
          label="Clear Timetable Only"
          description="Delete scheduled classes (Keep subjects)"
          right={
            <TouchableOpacity
              style={[styles.actionBtn, {backgroundColor: Colors.cancelled + '22', borderColor: Colors.cancelled}]}
              onPress={handleClearTimetable}>
              <Text style={[styles.actionBtnText, {color: Colors.cancelled}]}>Clear Timetable</Text>
            </TouchableOpacity>
          }
        />
        <SettingsRow
          label="Full App Reset"
          description="Wipe all subjects, classes & attendance history"
          right={
            <TouchableOpacity
              style={[styles.actionBtn, {backgroundColor: Colors.absent + '22', borderColor: Colors.absent}]}
              onPress={handleFullReset}>
              <Text style={[styles.actionBtnText, {color: Colors.absent}]}>Reset All</Text>
            </TouchableOpacity>
          }
        />
      </SettingsSection>

      <SettingsSection title="Notifications">
        <SettingsRow
          label="End-of-day nudge"
          description="Remind me to mark attendance at 9PM"
          right={
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{false: Colors.surface, true: Colors.primary}}
              thumbColor="#fff"
            />
          }
        />
      </SettingsSection>

      <SettingsSection title="Backup & Restore (JSON)">
        <SettingsRow
          label="Export Full Backup (JSON)"
          description="Copy subjects, timetable & attendance data to clipboard"
          right={
            <TouchableOpacity
              style={[styles.actionBtn, {backgroundColor: Colors.primary}]}
              onPress={handleExportBackup}>
              <Text style={styles.actionBtnText}>💾 Export</Text>
            </TouchableOpacity>
          }
        />
        <SettingsRow
          label="Import / Restore Backup"
          description="Paste JSON code to restore data + timetable instantly"
          right={
            <TouchableOpacity
              style={[styles.actionBtn, {backgroundColor: Colors.shifted}]}
              onPress={handleImportBackup}>
              <Text style={styles.actionBtnText}>📥 Restore</Text>
            </TouchableOpacity>
          }
        />
      </SettingsSection>

      <SettingsSection title="Calendar Integration">
        <SettingsRow
          label="Sync with Google Calendar"
          description="Schedule class reminders directly in Google Calendar"
          right={
            <TouchableOpacity
              style={[styles.actionBtn, {backgroundColor: Colors.holiday}]}
              onPress={handleGoogleCalendarSync}>
              <Text style={styles.actionBtnText}>📅 Sync</Text>
            </TouchableOpacity>
          }
        />
      </SettingsSection>

      <SettingsSection title="Updates">
        <SettingsRow
          label="Check for JS Update"
          description="Pull latest features over-the-air"
          right={
            <TouchableOpacity style={styles.actionBtn} onPress={handleCheckUpdate}>
              <Text style={styles.actionBtnText}>Check</Text>
            </TouchableOpacity>
          }
        />
      </SettingsSection>

      <SettingsSection title="Cloud Platform & Support">
        <SettingsRow
          label="🐛 Report a Bug"
          description="Submit bugs directly to our cloud AI agent"
          right={
            <TouchableOpacity
              style={[styles.actionBtn, {backgroundColor: Colors.absent}]}
              onPress={() => navigation.navigate('BugReport')}>
              <Text style={styles.actionBtnText}>Report Bug</Text>
            </TouchableOpacity>
          }
        />
        <SettingsRow
          label="📋 My Reported Bugs"
          description="Track AI analysis & fix status of your reports"
          right={
            <TouchableOpacity
              style={[styles.actionBtn, {backgroundColor: Colors.primary}]}
              onPress={() => navigation.navigate('MyBugs')}>
              <Text style={styles.actionBtnText}>My Bugs</Text>
            </TouchableOpacity>
          }
        />
        <SettingsRow
          label="🚀 What's New (Changelog)"
          description="View recent updates and bug fixes"
          right={
            <TouchableOpacity
              style={[styles.actionBtn, {backgroundColor: Colors.present}]}
              onPress={() => navigation.navigate('Changelog')}>
              <Text style={styles.actionBtnText}>Changelog</Text>
            </TouchableOpacity>
          }
        />
      </SettingsSection>

      <SettingsSection title="About">
        <SettingsRow label="App Version" description="7.1.0 (Attendo Cloud OTA Active)" />
        <SettingsRow label="Cloud Backend" description="Supabase + Gemini 2.0 Flash AI" />
        <SettingsRow label="DB Engine" description="SQLite 3 + Postgres Cloud Sync" />
      </SettingsSection>

      <Modal visible={importModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>📥 Restore Backup (JSON)</Text>
            <Text style={styles.modalSubtitle}>Paste your exported Attendo JSON backup code below:</Text>
            <TextInput
              style={styles.modalInput}
              multiline
              numberOfLines={8}
              value={importJsonText}
              onChangeText={setImportJsonText}
              placeholder="Paste JSON backup code here..."
              placeholderTextColor={Colors.textMuted}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, {backgroundColor: Colors.surface}]}
                onPress={() => setImportModalVisible(false)}>
                <Text style={{color: Colors.textSecondary, fontWeight: '600'}}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, {backgroundColor: Colors.primary}]}
                onPress={handleConfirmImport}>
                <Text style={{color: '#FFF', fontWeight: '700'}}>Restore Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function SettingsSection({title, children}: {title: string; children: React.ReactNode}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

function SettingsRow({
  label,
  description,
  right,
}: {
  label: string;
  description?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {description && <Text style={styles.rowDesc}>{description}</Text>}
      </View>
      {right}
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
  pageTitle: {
    ...Typography.h1,
    paddingHorizontal: Spacing.screenPad,
    paddingVertical: Spacing.md,
  },
  section: {
    marginHorizontal: Spacing.screenPad,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.label,
    marginBottom: Spacing.sm,
  },
  sectionContent: {
    backgroundColor: Colors.card,
    borderRadius: Spacing.cardRadiusLg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    ...Typography.body1,
  },
  rowDesc: {
    ...Typography.body2,
    marginTop: 2,
  },
  actionBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: Spacing.screenPad,
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderRadius: Spacing.cardRadiusLg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalTitle: {
    ...Typography.h2,
    marginBottom: Spacing.xs,
  },
  modalSubtitle: {
    ...Typography.body2,
    marginBottom: Spacing.md,
  },
  modalInput: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Spacing.cardRadius,
    padding: Spacing.md,
    color: Colors.textPrimary,
    fontFamily: 'monospace',
    fontSize: 12,
    textAlignVertical: 'top',
    height: 160,
    marginBottom: Spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
  },
  modalBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Spacing.cardRadius,
  },
});
