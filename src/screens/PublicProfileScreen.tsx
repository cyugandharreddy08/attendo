import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import {Colors} from '../theme/colors';
import {Spacing} from '../theme/spacing';
import {Typography} from '../theme/typography';
import {StudentProfile} from '../types';
import {AuthService} from '../services/AuthService';
import LeetCodeAttendanceHeatmap from '../components/LeetCodeAttendanceHeatmap';

export default function PublicProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const [profile, setProfile] = useState<StudentProfile | null>(
    route.params?.profile || null,
  );
  const [currentUser, setCurrentUser] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(!profile);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    // Load current user
    AuthService.getCurrentUser().then(u => {
      setCurrentUser(u);
      if (!profile && !route.params?.username) {
        setProfile(u);
        setLoading(false);
      }
    });

    // If username is provided, fetch from Supabase
    if (route.params?.username) {
      setLoading(true);
      AuthService.getStudentByUsername(route.params.username).then(p => {
        setProfile(p);
        setLoading(false);
      });
    }
  }, [route.params?.username]);

  const isOwnProfile =
    currentUser && profile && (currentUser.id === profile.id || currentUser.username === profile.username);

  const handleShare = async () => {
    if (!profile) return;
    try {
      await Share.share({
        title: `${profile.full_name}'s Attendance Streak`,
        message: `🔥 Check out @${profile.username}'s Attendance Streak on Attendo! Overall: ${profile.overall_percent}% | Current Streak: ${profile.current_streak} days | College: ${profile.college} (${profile.academic_year}). Download Attendo: https://github.com/cyugandharreddy08/attendo`,
      });
    } catch (e) {
      // dismissed
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    const res = await AuthService.syncAttendanceProfile();
    setSyncing(false);
    if (res.success) {
      Alert.alert('✅ Synced', res.message);
      const updated = await AuthService.getCurrentUser();
      setProfile(updated);
    } else {
      Alert.alert('Sync Notice', res.message);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, {paddingTop: insets.top}]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading student profile...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.centerContainer, {paddingTop: insets.top}]}>
        <Text style={styles.notFoundEmoji}>🔍</Text>
        <Text style={styles.notFoundTitle}>Profile Not Found</Text>
        <Text style={styles.notFoundSubtitle}>
          This student profile does not exist or has not been set up yet.
        </Text>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('PhoneAuth')}>
          <Text style={styles.actionBtnText}>Claim Your Student Profile</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const initials = profile.full_name
    .split(' ')
    .map(p => p[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const isSafe = profile.overall_percent >= 75;

  return (
    <ScrollView
      style={[styles.container, {paddingTop: insets.top}]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      {/* Navigation Header */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.navBack}>
          <Text style={styles.navBackText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.navActions}>
          {isOwnProfile && (
            <TouchableOpacity
              onPress={handleSyncNow}
              style={[styles.syncBtn, syncing && {opacity: 0.6}]}
              disabled={syncing}>
              <Text style={styles.syncBtnText}>{syncing ? 'Syncing...' : '🔄 Sync'}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
            <Text style={styles.shareBtnText}>Share 🔗</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Profile Card Header */}
      <View style={styles.profileHeaderCard}>
        <View style={styles.avatarRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
          <View style={styles.headerInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.fullName}>{profile.full_name}</Text>
              <Text style={styles.verifiedBadge}>✓</Text>
            </View>
            <Text style={styles.username}>@{profile.username}</Text>
            <View style={styles.badgeRow}>
              <View style={styles.instituteBadge}>
                <Text style={styles.instituteText}>🏛️ {profile.college}</Text>
              </View>
              <View style={styles.yearBadge}>
                <Text style={styles.yearText}>🎓 {profile.academic_year}</Text>
              </View>
            </View>
            {profile.branch ? (
              <Text style={styles.branchText}>📚 {profile.branch}</Text>
            ) : null}
          </View>
        </View>
      </View>

      {/* Key Metrics Grid */}
      <View style={styles.metricsGrid}>
        {/* Overall Attendance */}
        <View style={[styles.metricCard, {borderColor: isSafe ? Colors.present : Colors.absent}]}>
          <Text style={styles.metricLabel}>Overall Attendance</Text>
          <Text
            style={[
              styles.metricValue,
              {color: isSafe ? Colors.present : Colors.absent},
            ]}>
            {profile.overall_percent}%
          </Text>
          <Text style={styles.metricSub}>
            {profile.total_attended_hours}/{profile.total_held_hours} Hours
          </Text>
        </View>

        {/* Current Streak */}
        <View style={[styles.metricCard, {borderColor: '#F59E0B'}]}>
          <Text style={styles.metricLabel}>Current Streak</Text>
          <Text style={[styles.metricValue, {color: '#F59E0B'}]}>
            🔥 {profile.current_streak}
          </Text>
          <Text style={styles.metricSub}>Consecutive Days</Text>
        </View>

        {/* Theory Classes */}
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>📚 Theory Attendance</Text>
          <Text
            style={[
              styles.metricValue,
              {color: profile.theory_percent >= 75 ? Colors.present : Colors.absent},
            ]}>
            {profile.theory_percent}%
          </Text>
          <Text style={styles.metricSub}>Lecture Classes</Text>
        </View>

        {/* Lab Practicals */}
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>🧪 Lab Practicals</Text>
          <Text
            style={[
              styles.metricValue,
              {color: profile.lab_percent >= 75 ? Colors.present : Colors.absent},
            ]}>
            {profile.lab_percent}%
          </Text>
          <Text style={styles.metricSub}>Hands-on Labs</Text>
        </View>
      </View>

      {/* LeetCode-Style Attendance Consistency Heatmap */}
      <LeetCodeAttendanceHeatmap
        activityMatrix={profile.activity_matrix || []}
        currentStreak={profile.current_streak}
        longestStreak={profile.longest_streak}
        activeDaysCount={profile.active_days_count}
      />

      {/* Unlocked Campus Badges */}
      {profile.badges && profile.badges.length > 0 && (
        <View style={styles.badgesSection}>
          <Text style={styles.sectionTitle}>Unlocked Achievements</Text>
          <View style={styles.badgeChipsContainer}>
            {profile.badges.map((b, idx) => (
              <View key={idx} style={styles.achievementChip}>
                <Text style={styles.achievementText}>{b}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Action Footer */}
      <View style={styles.footerRow}>
        <TouchableOpacity
          style={styles.searchPeersBtn}
          onPress={() =>
            navigation.navigate('StudentSearch', {initialCollege: profile.college})
          }>
          <Text style={styles.searchPeersBtnText}>
            🔍 View More Students from {profile.college}
          </Text>
        </TouchableOpacity>

        {isOwnProfile && (
          <View style={styles.cloudBackupCard}>
            <Text style={styles.cloudBackupTitle}>☁️ Cloud Attendance Vault</Text>
            <Text style={styles.cloudBackupSubtitle}>
              Your subjects, timetable, and attendance history are linked to {profile.phone}.
            </Text>
            <View style={styles.cloudActionRow}>
              <TouchableOpacity
                style={styles.cloudActionBtn}
                onPress={async () => {
                  const res = await AuthService.backupNow();
                  Alert.alert(res.success ? '🚀 Cloud Backup' : 'Backup Alert', res.message);
                }}>
                <Text style={styles.cloudActionBtnText}>⬆️ Backup Now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cloudActionBtn, {backgroundColor: '#1E2438', borderColor: '#334155'}]}
                onPress={async () => {
                  Alert.alert(
                    'Restore from Cloud',
                    'Restore your saved timetable and attendance history from cloud?',
                    [
                      {text: 'Cancel', style: 'cancel'},
                      {
                        text: 'Restore',
                        onPress: async () => {
                          const res = await AuthService.restoreNow();
                          Alert.alert(res.success ? '✅ Cloud Restored' : 'Restore Alert', res.message);
                        },
                      },
                    ]
                  );
                }}>
                <Text style={[styles.cloudActionBtnText, {color: '#CBD5E1'}]}>⬇️ Restore</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {isOwnProfile && (
          <TouchableOpacity
            style={styles.editProfileBtn}
            onPress={() => navigation.navigate('PhoneAuth')}>
            <Text style={styles.editProfileBtnText}>✏️ Edit Profile Info</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.screenPad,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.background,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: 14,
    marginTop: 12,
  },
  notFoundEmoji: {
    fontSize: 44,
    marginBottom: 10,
  },
  notFoundTitle: {
    ...Typography.h3,
    color: Colors.text,
    fontWeight: '700',
  },
  notFoundSubtitle: {
    ...Typography.body2,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
  },
  actionBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  navBack: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#1E1E2E',
    borderRadius: 8,
  },
  navBackText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  navActions: {
    flexDirection: 'row',
    gap: 8,
  },
  syncBtn: {
    backgroundColor: '#1E1E2E',
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  syncBtnText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  shareBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  shareBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  profileHeaderCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF33',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  headerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fullName: {
    ...Typography.subtitle1,
    color: Colors.text,
    fontWeight: '800',
    fontSize: 18,
  },
  verifiedBadge: {
    fontSize: 14,
    color: '#38BDF8',
    fontWeight: '900',
  },
  username: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '700',
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  instituteBadge: {
    backgroundColor: '#1E1E2E',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  instituteText: {
    fontSize: 11,
    color: Colors.text,
    fontWeight: '600',
  },
  yearBadge: {
    backgroundColor: '#7C3AED22',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#7C3AED66',
  },
  yearText: {
    fontSize: 11,
    color: '#A78BFA',
    fontWeight: '600',
  },
  branchText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: Spacing.md,
  },
  metricCard: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  metricLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  metricSub: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  badgesSection: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginVertical: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.subtitle1,
    color: Colors.text,
    fontWeight: '700',
    marginBottom: 10,
  },
  badgeChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  achievementChip: {
    backgroundColor: '#1E1E2E',
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  achievementText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  footerRow: {
    gap: 10,
    marginTop: Spacing.md,
  },
  searchPeersBtn: {
    backgroundColor: '#1E1E2E',
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  searchPeersBtnText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  editProfileBtn: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  editProfileBtnText: {
    color: Colors.textMuted,
    fontWeight: '600',
    fontSize: 13,
  },
  cloudBackupCard: {
    backgroundColor: '#0C0E1A',
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1.2,
    borderColor: '#00F2FE33',
    marginVertical: 4,
  },
  cloudBackupTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#00F2FE',
    marginBottom: 4,
  },
  cloudBackupSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 12,
    lineHeight: 16,
  },
  cloudActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cloudActionBtn: {
    flex: 1,
    backgroundColor: '#00F2FE18',
    borderWidth: 1,
    borderColor: '#00F2FE66',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cloudActionBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#00F2FE',
  },
});
