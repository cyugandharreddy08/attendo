import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
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

import {useNavigation, useIsFocused} from '@react-navigation/native';
import {AuthService} from '../services/AuthService';
import {StudentProfile} from '../types';

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
  const isFocused = useIsFocused();

  const [currentUser, setCurrentUser] = useState<StudentProfile | null>(null);
  const [syncingProfile, setSyncingProfile] = useState(false);

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [reminderLead, setReminderLead] = useState(10);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');

  const loadUserProfile = useCallback(async () => {
    const user = await AuthService.getCurrentUser();
    setCurrentUser(user);
  }, []);

  useEffect(() => {
    if (isFocused) {
      loadUserProfile();
    }
  }, [isFocused, loadUserProfile]);

  const handleSyncProfile = async () => {
    setSyncingProfile(true);
    const res = await AuthService.syncAttendanceProfile();
    setSyncingProfile(false);
    if (res.success) {
      Alert.alert('Attendance Synced', res.message);
      loadUserProfile();
    } else {
      Alert.alert('Sync Notice', res.message);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Switch Account / Logout',
      'Are you sure you want to sign out from your campus profile on this device?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await AuthService.logout();
            setCurrentUser(null);
            Alert.alert('Signed Out', 'You have been disconnected from your public profile.');
          },
        },
      ],
    );
  };

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

      {/* Campus Identity & Public Profile Card */}
      {currentUser ? (
        <View style={styles.profileCard}>
          <View style={styles.profileCardHeader}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>
                {currentUser.full_name.substring(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={{flex: 1}}>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                <Text style={styles.profileName}>{currentUser.full_name}</Text>
                <Text style={styles.profileBadge}>✓ Student</Text>
              </View>
              <Text style={styles.profileUsername}>@{currentUser.username}</Text>
              <Text style={styles.profileCollege} numberOfLines={1}>
                🏛️ {currentUser.college} • {currentUser.academic_year}
              </Text>
            </View>
          </View>

          <View style={styles.profileStatsRow}>
            <View style={styles.profileStatItem}>
              <Text style={styles.profileStatVal}>{currentUser.overall_percent}%</Text>
              <Text style={styles.profileStatLbl}>Attendance</Text>
            </View>
            <View style={styles.profileStatDivider} />
            <View style={styles.profileStatItem}>
              <Text style={[styles.profileStatVal, {color: '#F59E0B'}]}>
                🔥 {currentUser.current_streak}d
              </Text>
              <Text style={styles.profileStatLbl}>Streak</Text>
            </View>
            <View style={styles.profileStatDivider} />
            <View style={styles.profileStatItem}>
              <Text style={styles.profileStatVal}>{currentUser.theory_percent}%</Text>
              <Text style={styles.profileStatLbl}>Theory</Text>
            </View>
            <View style={styles.profileStatDivider} />
            <View style={styles.profileStatItem}>
              <Text style={styles.profileStatVal}>{currentUser.lab_percent}%</Text>
              <Text style={styles.profileStatLbl}>Labs</Text>
            </View>
          </View>

          <View style={styles.profileActionsRow}>
            <TouchableOpacity
              style={styles.profileSyncBtn}
              onPress={handleSyncProfile}
              disabled={syncingProfile}>
              {syncingProfile ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.profileSyncBtnText}>🔄 Sync Cloud Stats</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.profileViewBtn}
              onPress={() => navigation.navigate('PublicProfile', {profile: currentUser})}>
              <Text style={styles.profileViewBtnText}>View Public Profile 🔗</Text>
            </TouchableOpacity>
          </View>

          <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 10}}>
            <TouchableOpacity
              onPress={() => navigation.navigate('StudentSearch', {initialCollege: currentUser.college})}>
              <Text style={styles.profileSecondaryLink}>🔍 Campus Directory</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout}>
              <Text style={[styles.profileSecondaryLink, {color: '#EF4444'}]}>
                Switch / Sign Out
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.loginBannerCard}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6}}>
            <Text style={{fontSize: 24}}>🎓</Text>
            <Text style={styles.loginBannerTitle}>Join Campus Community</Text>
          </View>
          <Text style={styles.loginBannerSubtitle}>
            Connect your mobile number, claim your @username, showcase your LeetCode attendance streak, and get discovered by classmates from your institute!
          </Text>
          <TouchableOpacity
            style={styles.loginBannerBtn}
            onPress={() => navigation.navigate('PhoneAuth')}>
            <Text style={styles.loginBannerBtnText}>Connect Phone & Profile →</Text>
          </TouchableOpacity>
        </View>
      )}

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
  profileCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#7C3AED55',
    marginBottom: Spacing.lg,
  },
  profileCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 18,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  profileBadge: {
    fontSize: 10,
    backgroundColor: '#38BDF822',
    color: '#38BDF8',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    fontWeight: '700',
  },
  profileUsername: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
  profileCollege: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  profileStatsRow: {
    flexDirection: 'row',
    backgroundColor: '#1E1E2E88',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 12,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  profileStatItem: {
    alignItems: 'center',
  },
  profileStatVal: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  profileStatLbl: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },
  profileStatDivider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.border,
  },
  profileActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  profileSyncBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileSyncBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  profileViewBtn: {
    flex: 1,
    backgroundColor: '#1E1E2E',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileViewBtnText: {
    color: Colors.text,
    fontWeight: '600',
    fontSize: 12,
  },
  profileSecondaryLink: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
  loginBannerCard: {
    backgroundColor: '#7C3AED18',
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#7C3AED44',
    marginBottom: Spacing.lg,
  },
  loginBannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  loginBannerSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
    marginBottom: 12,
  },
  loginBannerBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  loginBannerBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
