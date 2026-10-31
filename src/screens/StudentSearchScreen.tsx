import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation, useRoute, useIsFocused} from '@react-navigation/native';
import {Colors} from '../theme/colors';
import {Spacing} from '../theme/spacing';
import {Typography} from '../theme/typography';
import {StudentProfile} from '../types';
import {AuthService} from '../services/AuthService';

const YEAR_FILTERS = ['All', '1st Year', '2nd Year', '3rd Year', '4th Year'];

export default function StudentSearchScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const isFocused = useIsFocused();

  const [currentUser, setCurrentUser] = useState<StudentProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCollege, setSelectedCollege] = useState<string>(
    route.params?.initialCollege || '',
  );
  const [selectedYear, setSelectedYear] = useState<string>('All');
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Load current user profile on focus
  useEffect(() => {
    if (isFocused) {
      AuthService.getCurrentUser().then(u => {
        setCurrentUser(u);
        if (!selectedCollege && u?.college && !route.params?.initialCollege) {
          setSelectedCollege(u.college);
        }
      });
    }
  }, [isFocused]);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const results = await AuthService.searchStudents({
        college: selectedCollege,
        search: searchQuery,
        academicYear: selectedYear,
      });
      setStudents(results);
    } catch (e) {
      console.warn('Fetch students error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCollege, searchQuery, selectedYear]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStudents();
  };

  const renderStudentItem = ({item, index}: {item: StudentProfile; index: number}) => {
    const isSafe = item.overall_percent >= 75;
    const isCurrentUser = currentUser?.id === item.id || currentUser?.username === item.username;
    const initials = item.full_name
      .split(' ')
      .map(p => p[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

    let rankBadge = `#${index + 1}`;
    let isPodium = false;
    let podiumColor = Colors.border;
    if (index === 0) {
      rankBadge = '🥇';
      isPodium = true;
      podiumColor = '#F59E0B';
    } else if (index === 1) {
      rankBadge = '🥈';
      isPodium = true;
      podiumColor = '#94A3B8';
    } else if (index === 2) {
      rankBadge = '🥉';
      isPodium = true;
      podiumColor = '#D97706';
    }

    return (
      <TouchableOpacity
        style={[
          styles.studentCard,
          isCurrentUser && styles.currentUserCard,
          isPodium && {borderColor: podiumColor + '55'},
        ]}
        activeOpacity={0.7}
        onPress={() => {
          ReactNativeHapticFeedback.trigger('impactLight', {
            enableVibrateFallback: true,
            ignoreAndroidSystemSettings: false,
          });
          navigation.navigate('PublicProfile', {profile: item});
        }}>
        {/* Rank / Podium Badge */}
        <View style={styles.rankBox}>
          <Text style={[styles.rankText, isPodium && {fontSize: 18}]}>{rankBadge}</Text>
        </View>

        {/* Avatar with gradient accent */}
        <View style={[styles.avatar, isPodium && {borderWidth: 2, borderColor: podiumColor}]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        {/* Student Info */}
        <View style={styles.infoCol}>
          <View style={styles.nameRow}>
            <Text style={styles.studentName} numberOfLines={1}>
              {item.full_name}
            </Text>
            {isCurrentUser && <Text style={styles.youBadge}>YOU</Text>}
          </View>
          <Text style={styles.usernameText}>@{item.username}</Text>
          <Text style={styles.collegeText} numberOfLines={1}>
            🏛️ {item.college} • {item.academic_year}
          </Text>

          {/* Mini Attendance Progress Track */}
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressBar,
                {
                  width: `${Math.min(item.overall_percent, 100)}%`,
                  backgroundColor: isSafe ? Colors.present : Colors.absent,
                },
              ]}
            />
          </View>
        </View>

        {/* Stats Column */}
        <View style={styles.statsCol}>
          <View style={[styles.percentBadge, {borderColor: isSafe ? Colors.present : Colors.absent}]}>
            <Text
              style={[
                styles.percentText,
                {color: isSafe ? Colors.present : Colors.absent},
              ]}>
              {item.overall_percent}%
            </Text>
          </View>
          <View style={styles.streakRow}>
            <Text style={styles.streakText}>🔥 {item.current_streak}d</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Campus Directory</Text>
            <Text style={styles.headerSubtitle}>
              Find classmates, discover peer attendance & streaks
            </Text>
          </View>
          {currentUser ? (
            <TouchableOpacity
              style={styles.myProfileBtn}
              onPress={() => navigation.navigate('PublicProfile', {profile: currentUser})}>
              <Text style={styles.myProfileBtnText}>My Profile</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.joinBtn}
              onPress={() => navigation.navigate('PhoneAuth')}>
              <Text style={styles.joinBtnText}>Join Campus</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by student name, @username, or college..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.clearSearch}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filter Quick Chips */}
        <View style={styles.filterRow}>
          {currentUser?.college && (
            <TouchableOpacity
              style={[
                styles.collegeChip,
                selectedCollege === currentUser.college && styles.filterChipActive,
              ]}
              onPress={() => {
                setSelectedCollege(
                  selectedCollege === currentUser.college ? '' : currentUser.college,
                );
              }}>
              <Text
                style={[
                  styles.filterChipText,
                  selectedCollege === currentUser.college && styles.filterChipTextActive,
                ]}>
                🏛️ My College ({currentUser.college.split(' ')[0]})
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.collegeChip,
              !selectedCollege && styles.filterChipActive,
            ]}
            onPress={() => setSelectedCollege('')}>
            <Text
              style={[
                styles.filterChipText,
                !selectedCollege && styles.filterChipTextActive,
              ]}>
              All Institutes
            </Text>
          </TouchableOpacity>
        </View>

        {/* Academic Year Filter */}
        <View style={styles.yearRow}>
          {YEAR_FILTERS.map(yr => (
            <TouchableOpacity
              key={yr}
              style={[
                styles.yearChip,
                selectedYear === yr && styles.yearChipActive,
              ]}
              onPress={() => setSelectedYear(yr)}>
              <Text
                style={[
                  styles.yearChipText,
                  selectedYear === yr && styles.yearChipTextActive,
                ]}>
                {yr}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Student List */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Searching students...</Text>
        </View>
      ) : (
        <FlatList
          data={students}
          keyExtractor={item => item.id || item.phone}
          renderItem={renderStudentItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🎓</Text>
              <Text style={styles.emptyTitle}>No Students Found</Text>
              <Text style={styles.emptySubtitle}>
                {selectedCollege
                  ? `Be the first student from ${selectedCollege} to publish your attendance profile!`
                  : 'Try searching with a different name or college.'}
              </Text>
              {!currentUser && (
                <TouchableOpacity
                  style={styles.emptyActionBtn}
                  onPress={() => navigation.navigate('PhoneAuth')}>
                  <Text style={styles.emptyActionBtnText}>Set Up Your Profile</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
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
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.text,
    fontWeight: '800',
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  myProfileBtn: {
    backgroundColor: '#7C3AED22',
    borderWidth: 1,
    borderColor: '#7C3AED66',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  myProfileBtnText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  joinBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  joinBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E2E',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: Spacing.sm,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 14,
  },
  clearSearch: {
    color: Colors.textMuted,
    fontSize: 14,
    paddingHorizontal: 6,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  collegeChip: {
    backgroundColor: '#1E1E2E',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary + '22',
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  yearRow: {
    flexDirection: 'row',
    gap: 6,
  },
  yearChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#151824',
  },
  yearChipActive: {
    backgroundColor: '#7C3AED44',
  },
  yearChipText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  yearChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    padding: Spacing.screenPad,
    paddingBottom: 40,
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  currentUserCard: {
    borderColor: Colors.primary,
    backgroundColor: '#7C3AED11',
  },
  rankBox: {
    width: 24,
    alignItems: 'center',
    marginRight: 6,
  },
  rankText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  infoCol: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  studentName: {
    ...Typography.subtitle1,
    color: Colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  youBadge: {
    backgroundColor: Colors.primary,
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  usernameText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
    marginBottom: 2,
  },
  collegeText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#1E1E2E',
    borderRadius: 2,
    overflow: 'hidden',
    width: '90%',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  statsCol: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  percentBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#1E1E2E',
    marginBottom: 4,
  },
  percentText: {
    fontSize: 13,
    fontWeight: '800',
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakText: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '700',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: 14,
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    ...Typography.h3,
    color: Colors.text,
    fontWeight: '700',
  },
  emptySubtitle: {
    ...Typography.body2,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
  },
  emptyActionBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
