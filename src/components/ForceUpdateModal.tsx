import React, {useState, useEffect} from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
  BackHandler,
  ScrollView,
} from 'react-native';
import RNBlobUtil from 'react-native-blob-util';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {checkLatestAppVersion, AppVersion} from '../services/UpdateService';
import {APP_VERSION, APP_VERSION_CODE} from '../config/supabase';
import {Colors} from '../theme/colors';
import {Spacing} from '../theme/spacing';

let globalTriggerForceUpdate: ((version?: AppVersion) => void) | null = null;

export function triggerForceUpdateModal(customVersion?: AppVersion) {
  if (globalTriggerForceUpdate) {
    globalTriggerForceUpdate(customVersion);
  }
}

export default function ForceUpdateModal() {
  const [visible, setVisible] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<AppVersion | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [downloadedMB, setDownloadedMB] = useState('0.0');
  const [totalMB, setTotalMB] = useState('31.4');
  const [downloadTask, setDownloadTask] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Register global trigger
    globalTriggerForceUpdate = (customVersion?: AppVersion) => {
      const v = customVersion || {
        version_name: '8.0.0',
        version_code: 800,
        release_notes: '🚀 Major v8.0.0 Release:\n• Real Phone OTP Authentication & Profile Hub\n• Timetable Theory vs Lab Split Attendance\n• 300+ Indian Engineering Colleges & Branches\n• Fix period glitches across days\n• Multi-device cloud sync with login',
        apk_url: 'https://github.com/cyugandharreddy08/attendo/releases/download/v8.0.0/Attendo_v8.0.0.apk',
        apk_size_bytes: 31431064,
        is_mandatory: true,
      };
      setUpdateInfo(v);
      const pkgMB = (v.apk_size_bytes / (1024 * 1024)).toFixed(1);
      setTotalMB(pkgMB);
      setVisible(true);
    };

    return () => {
      globalTriggerForceUpdate = null;
    };
  }, []);

  useEffect(() => {
    // Prevent hardware back button from dismissing modal on Android
    const onBackPress = () => {
      if (visible) {
        return true; // Block back button
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress
    );
    return () => backHandler.remove();
  }, [visible]);

  const handleStartDownload = async () => {
    if (!updateInfo?.apk_url) return;

    ReactNativeHapticFeedback.trigger('impactMedium', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });

    setDownloading(true);
    setErrorMessage(null);
    setProgressPercent(0);

    const {dirs} = RNBlobUtil.fs;
    const downloadDir = dirs.DownloadDir || dirs.CacheDir;
    const filename = `Attendo_v${updateInfo.version_name}.apk`;
    const targetPath = `${downloadDir}/${filename}`;

    try {
      // Remove any existing partial file
      const exists = await RNBlobUtil.fs.exists(targetPath);
      if (exists) {
        await RNBlobUtil.fs.unlink(targetPath);
      }

      const task = RNBlobUtil.config({
        path: targetPath,
        addAndroidDownloads: {
          useDownloadManager: false,
          notification: true,
          title: `Attendo v${updateInfo.version_name}`,
          description: 'Downloading Attendo update...',
          mime: 'application/vnd.android.package-archive',
          mediaScannable: true,
        },
      }).fetch('GET', updateInfo.apk_url);

      setDownloadTask(task);

      task.progress((received: any, total: any) => {
        const recNum = Number(received) || 0;
        const totNum = Number(total) > 0 ? Number(total) : updateInfo.apk_size_bytes || 32900000;
        const currentMB = (recNum / (1024 * 1024)).toFixed(1);
        const maxMB = (totNum / (1024 * 1024)).toFixed(1);
        const pct = Math.min(100, Math.round((recNum / totNum) * 100));

        setDownloadedMB(currentMB);
        setTotalMB(maxMB);
        setProgressPercent(pct);
      });

      const res = await task;
      setDownloading(false);
      setProgressPercent(100);

      // Trigger Android Package Installer Intent
      if (Platform.OS === 'android') {
        ReactNativeHapticFeedback.trigger('notificationSuccess', {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });

        try {
          await RNBlobUtil.android.actionViewIntent(
            res.path(),
            'application/vnd.android.package-archive'
          );
        } catch (intentErr) {
          console.warn('ActionViewIntent failed, trying browser fallback:', intentErr);
          Linking.openURL(updateInfo.apk_url);
        }
      }
    } catch (err: any) {
      setDownloading(false);
      console.warn('APK Download error:', err);
      setErrorMessage(
        err?.message || 'Download interrupted. Please tap Open in Browser.'
      );
    }
  };

  const handleBrowserFallback = () => {
    if (updateInfo?.apk_url) {
      Linking.openURL(updateInfo.apk_url);
    }
  };

  if (!visible || !updateInfo) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header Glow Icon */}
          <View style={styles.iconCircle}>
            <Text style={styles.iconEmoji}>🚀</Text>
          </View>

          <Text style={styles.mandatoryBadge}>MANDATORY UPDATE</Text>
          <Text style={styles.title}>Attendo v{updateInfo.version_name}</Text>
          <Text style={styles.subtitle}>
            A critical update is required to continue using Attendo.
          </Text>

          {/* Version & Size Specs */}
          <View style={styles.specsRow}>
            <View style={styles.specBox}>
              <Text style={styles.specLabel}>CURRENT</Text>
              <Text style={styles.specValue}>v{APP_VERSION}</Text>
            </View>
            <Text style={styles.specArrow}>➔</Text>
            <View style={styles.specBox}>
              <Text style={styles.specLabel}>TARGET</Text>
              <Text style={[styles.specValue, {color: '#00F2FE'}]}>
                v{updateInfo.version_name}
              </Text>
            </View>
            <View style={styles.specBox}>
              <Text style={styles.specLabel}>PACKAGE SIZE</Text>
              <Text style={[styles.specValue, {color: '#F59E0B'}]}>
                {totalMB} MB
              </Text>
            </View>
          </View>

          {/* Release Notes Preview */}
          <View style={styles.notesContainer}>
            <Text style={styles.notesTitle}>What's New in v{updateInfo.version_name}:</Text>
            <ScrollView style={styles.notesScroll} nestedScrollEnabled>
              <Text style={styles.notesText}>
                {updateInfo.release_notes ||
                  '• Real Phone OTP Authentication & Profile Hub\n• Timetable Theory vs Lab Split Attendance\n• All 300+ Indian Engineering Colleges & Branches\n• Fix period glitches across days\n• Multi-device cloud sync with login'}
              </Text>
            </ScrollView>
          </View>

          {/* Download Progress Bar */}
          {downloading && (
            <View style={styles.progressContainer}>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressStatusText}>
                  Downloading update ({downloadedMB} MB / {totalMB} MB)
                </Text>
                <Text style={styles.progressPercentText}>{progressPercent}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressBar,
                    {width: `${progressPercent}%`},
                  ]}
                />
              </View>
            </View>
          )}

          {errorMessage && (
            <Text style={styles.errorText}>{errorMessage}</Text>
          )}

          {/* Action Buttons */}
          <TouchableOpacity
            style={[styles.primaryBtn, downloading && styles.btnDisabled]}
            disabled={downloading}
            onPress={handleStartDownload}
            activeOpacity={0.85}>
            {downloading ? (
              <View style={styles.downloadingBtnRow}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.btnText}>Downloading APK ({progressPercent}%)...</Text>
              </View>
            ) : (
              <Text style={styles.btnText}>
                {progressPercent === 100 ? 'Install APK Now ⚡' : `Download & Update (${totalMB} MB) 🚀`}
              </Text>
            )}
          </TouchableOpacity>

          {/* Browser Download Fallback */}
          <TouchableOpacity
            style={styles.fallbackBtn}
            onPress={handleBrowserFallback}>
            <Text style={styles.fallbackText}>
              Can't install? Download directly from Browser ↗
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 15, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#0E111E',
    borderWidth: 1.5,
    borderColor: '#242A42',
    borderRadius: 24,
    padding: Spacing.lg,
    alignItems: 'center',
    shadowColor: '#00F2FE',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#00F2FE18',
    borderWidth: 1.5,
    borderColor: '#00F2FE66',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  iconEmoji: {
    fontSize: 32,
  },
  mandatoryBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#EF4444',
    backgroundColor: '#EF444418',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    letterSpacing: 1,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  specsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    backgroundColor: '#161928',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#242A42',
    marginBottom: 16,
  },
  specBox: {
    alignItems: 'center',
  },
  specLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  specValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F4F4FF',
  },
  specArrow: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '700',
  },
  notesContainer: {
    width: '100%',
    backgroundColor: '#121422',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E2438',
    marginBottom: 16,
  },
  notesTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#CBD5E1',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  notesScroll: {
    maxHeight: 90,
  },
  notesText: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 18,
  },
  progressContainer: {
    width: '100%',
    marginBottom: 16,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressStatusText: {
    fontSize: 11,
    color: '#7DD3FC',
    fontWeight: '600',
  },
  progressPercentText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#00F2FE',
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#1E2438',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#00F2FE',
    borderRadius: 3,
  },
  errorText: {
    fontSize: 12,
    color: '#F43F5E',
    textAlign: 'center',
    marginBottom: 10,
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: '#00F2FE',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00F2FE',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  btnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#05070F',
    letterSpacing: 0.3,
  },
  downloadingBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fallbackBtn: {
    marginTop: 12,
    paddingVertical: 6,
  },
  fallbackText: {
    fontSize: 12,
    color: '#94A3B8',
    textDecorationLine: 'underline',
  },
});
