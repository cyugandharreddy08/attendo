import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
  Clipboard,
  Platform,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {Colors} from '../theme/colors';
import {Spacing} from '../theme/spacing';
import {Typography} from '../theme/typography';
import AnimatedPressable from '../components/AnimatedPressable';
import {
  AccountSyncService,
  normalizeSecurityCode,
} from '../services/AccountSyncService';

export default function AccountSyncScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [syncKey, setSyncKey] = useState<string>('LOADING...');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [inputCode, setInputCode] = useState<string>('');
  const [restoring, setRestoring] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    loadKeyAndStatus();
  }, []);

  const loadKeyAndStatus = async () => {
    const key = await AccountSyncService.getOrGenerateSyncKey();
    setSyncKey(key);
    const syncTime = await AccountSyncService.getLastSyncTime();
    setLastSync(syncTime);
  };

  const triggerHaptic = (type: any = 'impactLight') => {
    try {
      ReactNativeHapticFeedback.trigger(type, {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    } catch {}
  };

  const handleCopyCode = () => {
    triggerHaptic('impactMedium');
    Clipboard.setString(syncKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShareCode = async () => {
    triggerHaptic('impactLight');
    try {
      await Share.share({
        title: 'Attendo Account Security Code',
        message: `Here is my Attendo Account Security Code: ${syncKey}\nUse this in the Attendo app to restore my attendance history, subjects, and timetable!`,
      });
    } catch {}
  };



  const handleRestoreFromCode = async () => {
    const cleaned = normalizeSecurityCode(inputCode);
    if (!cleaned || cleaned.length < 8) {
      Alert.alert('Invalid Code', 'Please enter a valid 12-character Security Code (e.g. ATND-XXXX-XXXX).');
      return;
    }

    Alert.alert(
      'Restore Account Data',
      `Restoring will load all subjects, timetable classes, and attendance history saved under "${cleaned}".\n\nChoose how to proceed:`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Merge with Current',
          onPress: () => performRestore(cleaned, 'merge'),
        },
        {
          text: 'Replace Everything',
          style: 'destructive',
          onPress: () => performRestore(cleaned, 'replace'),
        },
      ],
    );
  };

  const performRestore = async (code: string, mode: 'merge' | 'replace') => {
    triggerHaptic('impactHeavy');
    setRestoring(true);
    const res = await AccountSyncService.restoreFromCloud(code, mode);
    setRestoring(false);

    if (res.success) {
      triggerHaptic('notificationSuccess');
      await loadKeyAndStatus();
      Alert.alert(
        '🎉 Restore Successful!',
        `Loaded ${res.subjectsCount} subjects & ${res.classesCount} attendance records from Security Code ${code}!`,
        [{text: 'Awesome', onPress: () => navigation.goBack()}],
      );
    } else {
      triggerHaptic('notificationError');
      Alert.alert('Restore Failed', res.message);
    }
  };

  const formatLastSync = (timestamp: string | null) => {
    if (!timestamp) return 'Never backed up';
    try {
      const date = new Date(timestamp);
      return `Last synced ${date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
      })} at ${date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`;
    } catch {
      return 'Recently synced';
    }
  };

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      {/* Top Header */}
      <View style={styles.header}>
        <AnimatedPressable
          style={styles.backButton}
          onPress={() => {
            triggerHaptic('impactLight');
            navigation.goBack();
          }}>
          <Text style={styles.backButtonText}>←</Text>
        </AnimatedPressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Account Security Code</Text>
          <Text style={styles.headerSubtitle}>Zero Passwords • Instant Device Sync</Text>
        </View>
        <View style={{width: 40}} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, {paddingBottom: insets.bottom + 32}]}
        showsVerticalScrollIndicator={false}>
        {/* HERO CARD: SECURITY CODE */}
        <View style={styles.heroCard}>
          <View style={styles.badgeRow}>
            <View style={styles.statusPill}>
              <View style={styles.statusDot} />
              <Text style={styles.statusPillText}>Real-Time Sync Active</Text>
            </View>
            <Text style={styles.heroCardHint}>
              {lastSync ? formatLastSync(lastSync) : 'Automatic Cloud Storage'}
            </Text>
          </View>

          <Text style={styles.heroCardLabel}>YOUR ACCOUNT SECURITY CODE</Text>

          <View style={styles.codeContainer}>
            <Text style={styles.codeText} selectable>
              {syncKey}
            </Text>
          </View>

          {/* Quick Action Buttons */}
          <View style={styles.actionRow}>
            <AnimatedPressable
              style={[styles.primaryActionBtn, copied && styles.copiedActionBtn]}
              onPress={handleCopyCode}
              hapticType="impactMedium">
              <Text style={styles.actionBtnIcon}>{copied ? '✓' : '📋'}</Text>
              <Text style={styles.primaryActionBtnText}>
                {copied ? 'Copied to Clipboard!' : 'Copy Code'}
              </Text>
            </AnimatedPressable>

            <AnimatedPressable
              style={styles.secondaryActionBtn}
              onPress={handleShareCode}
              hapticType="impactLight">
              <Text style={styles.actionBtnIcon}>📤</Text>
              <Text style={styles.secondaryActionBtnText}>Share</Text>
            </AnimatedPressable>
          </View>

          <Text style={styles.heroNote}>
            🔒 Every time you update attendance, add a subject, or change a class, your changes are
            automatically saved in your private cloud vault. Whenever you get a new phone or reinstall,
            enter this code to instantly restore your data.
          </Text>
        </View>

        {/* RESTORE ANOTHER DEVICE CARD */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconCircle, {backgroundColor: 'rgba(56, 189, 248, 0.15)'}]}>
              <Text style={{fontSize: 20}}>📱</Text>
            </View>
            <View style={{flex: 1, marginLeft: 12}}>
              <Text style={styles.sectionTitle}>Restore on Another Device</Text>
              <Text style={styles.sectionSubtitle}>
                Enter a code from your previous phone to download all your data
              </Text>
            </View>
          </View>

          <View style={styles.inputWrap}>
            <TextInput
              style={styles.inputField}
              placeholder="e.g. ATND-8K9L-M3QP"
              placeholderTextColor="#64748B"
              value={inputCode}
              onChangeText={val => setInputCode(val.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={14}
            />
          </View>

          <AnimatedPressable
            style={[
              styles.restoreBtn,
              (!inputCode.trim() || restoring) && styles.disabledRestoreBtn,
            ]}
            onPress={handleRestoreFromCode}
            disabled={!inputCode.trim() || restoring}
            hapticType="impactHeavy">
            {restoring ? (
              <ActivityIndicator color="#0B0F19" size="small" />
            ) : (
              <>
                <Text style={styles.restoreBtnIcon}>📥</Text>
                <Text style={styles.restoreBtnText}>Restore Account Data</Text>
              </>
            )}
          </AnimatedPressable>
        </View>

        {/* FAQ ACCORDION / PRIVACY NOTE */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>🛡️ Frictionless & 100% Private</Text>
          <Text style={styles.infoBody}>
            • No phone numbers or emails required.{'\n'}
            • No OTP delays or verification spam.{'\n'}
            • Your timetable, target %, and attendance history are stored in a dedicated cloud vault
            bound exclusively to your 12-character Security Code.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07090E',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 22,
    color: '#F8FAFC',
    lineHeight: 26,
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '500',
  },
  scrollContent: {
    padding: 20,
  },
  heroCard: {
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(124, 58, 237, 0.4)',
    shadowColor: '#7C3AED',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
    marginBottom: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  statusPillText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  heroCardHint: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  heroCardLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  codeContainer: {
    backgroundColor: '#07090E',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.5)',
    marginBottom: 18,
  },
  codeText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#A78BFA',
    letterSpacing: 3,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  primaryActionBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#7C3AED',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  copiedActionBtn: {
    backgroundColor: '#059669',
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  secondaryActionBtnText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  actionBtnIcon: {
    fontSize: 16,
  },
  heroNote: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 18,
    fontWeight: '400',
  },
  sectionCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  syncNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 14,
  },
  syncNowIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  syncNowBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  inputWrap: {
    backgroundColor: '#07090E',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 14,
  },
  inputField: {
    fontSize: 16,
    color: '#F8FAFC',
    fontWeight: '700',
    letterSpacing: 1.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    padding: 0,
  },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#38BDF8',
    paddingVertical: 14,
    borderRadius: 14,
  },
  disabledRestoreBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.25)',
  },
  restoreBtnIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  restoreBtnText: {
    color: '#07090E',
    fontSize: 14,
    fontWeight: '800',
  },
  infoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E2E8F0',
    marginBottom: 8,
  },
  infoBody: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 20,
  },
});
