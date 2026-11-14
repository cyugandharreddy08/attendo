import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {checkForJSUpdate, checkForNativeUpdate} from '../services/OTAService';
import {Colors} from '../theme/colors';
import {Spacing} from '../theme/spacing';
import {Typography} from '../theme/typography';

import {clearEntireTimetable, clearAllData} from '../db/queries/timetable';
import {scheduleClassReminders} from '../services/NotificationService';

import Clipboard from '@react-native-clipboard/clipboard';
import {Linking} from 'react-native';

import {useNavigation, useIsFocused} from '@react-navigation/native';
import {AuthService} from '../services/AuthService';
import {StudentProfile} from '../types';
import AnimatedPressable from '../components/AnimatedPressable';
import {AccountSyncService} from '../services/AccountSyncService';

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

  const [syncKey, setSyncKey] = useState<string>('...');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState<boolean>(false);

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [reminderLead, setReminderLead] = useState(10);

  const loadAccountSyncInfo = useCallback(async () => {
    const key = await AccountSyncService.getOrGenerateSyncKey();
    setSyncKey(key);
    const lastTime = await AccountSyncService.getLastSyncTime();
    setLastSyncTime(lastTime);
  }, []);

  const loadUserProfile = useCallback(async () => {
    const user = await AuthService.getCurrentUser();
    setCurrentUser(user);
  }, []);

  useEffect(() => {
    if (isFocused) {
      loadAccountSyncInfo();
      loadUserProfile();
    }
  }, [isFocused, loadAccountSyncInfo, loadUserProfile]);

  const handleCopySecurityCode = () => {
    Clipboard.setString(syncKey);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  };

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

      {/* Account Security Code & Real-Time Cloud Sync Card */}
      <View style={styles.vaultCard}>
        <View style={styles.vaultCardHeader}>
          <View style={styles.vaultBadge}>
            <View style={styles.vaultBadgeDot} />
            <Text style={styles.vaultBadgeText}>Real-Time Cloud Sync Active</Text>
          </View>
          <Text style={styles.vaultHint}>Continuous • No Backups Needed</Text>
        </View>

        <Text style={styles.vaultLabel}>YOUR ACCOUNT SECURITY CODE</Text>

        <View style={styles.vaultCodeBox}>
          <Text style={styles.vaultCodeText} selectable>
            {syncKey}
          </Text>
          <TouchableOpacity
            style={[styles.vaultCopyBtn, keyCopied && styles.vaultCopyBtnActive]}
            onPress={handleCopySecurityCode}
            activeOpacity={0.7}>
            <Text style={styles.vaultCopyBtnText}>{keyCopied ? '✓' : '📋'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.vaultSubtext}>
          {lastSyncTime
            ? `🟢 Cloud vault synchronized at ${new Date(
                lastSyncTime,
              ).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}. All attendance & timetable edits save automatically.`
            : '🟢 Real-time sync engine is running. Every subject, class mark, and edit updates in the cloud automatically.'}
        </Text>

        <View style={styles.vaultActionsRow}>
          <AnimatedPressable
            style={styles.vaultSyncBtn}
            onPress={handleCopySecurityCode}
            hapticType="impactLight">
            <Text style={styles.vaultSyncBtnText}>{keyCopied ? '✓ Code Copied' : '📋 Copy Security Code'}</Text>
          </AnimatedPressable>

          <AnimatedPressable
            style={styles.vaultManageBtn}
            onPress={() => navigation.navigate('AccountSync')}
            hapticType="impactLight">
            <Text style={styles.vaultManageBtnText}>📱 Link / Switch Phone →</Text>
          </AnimatedPressable>
        </View>
      </View>

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
        <SettingsRow label="App Version" description="8.0.3 (Real-Time Physics & Cloud Sync Active)" />
        <SettingsRow label="Cloud Backend" description="Supabase + Gemini 2.0 Flash AI" />
        <SettingsRow label="DB Engine" description="SQLite 3 + Continuous Postgres Sync" />
      </SettingsSection>
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
  vaultCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: 'rgba(124, 58, 237, 0.4)',
    shadowColor: '#7C3AED',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
    marginBottom: Spacing.lg,
    marginHorizontal: Spacing.screenPad,
  },
  vaultCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  vaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  vaultBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  vaultBadgeText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  vaultHint: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  vaultLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 6,
  },
  vaultCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#07090E',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.4)',
    marginBottom: 10,
  },
  vaultCodeText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#A78BFA',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  vaultCopyBtn: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  vaultCopyBtnActive: {
    backgroundColor: '#059669',
  },
  vaultCopyBtnText: {
    fontSize: 14,
    color: '#F8FAFC',
    fontWeight: '700',
  },
  vaultSubtext: {
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 16,
    marginBottom: 12,
  },
  vaultActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  vaultSyncBtn: {
    flex: 1,
    backgroundColor: '#7C3AED',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vaultSyncBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  vaultManageBtn: {
    flex: 1.2,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vaultManageBtnText: {
    color: '#E2E8F0',
    fontWeight: '600',
    fontSize: 12,
  },
});
