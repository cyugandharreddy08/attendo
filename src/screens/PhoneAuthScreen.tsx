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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import {Colors} from '../theme/colors';
import {Spacing} from '../theme/spacing';
import {Typography} from '../theme/typography';
import {AuthService, validateAndNormalizeEmail} from '../services/AuthService';
import {
  searchColleges,
  searchBranches,
  CollegeInfo,
  BranchInfo,
} from '../data/indianCollegesAndBranches';

const ACADEMIC_YEARS = [
  '1st Year',
  '2nd Year',
  '3rd Year',
  '4th Year',
  '5th Year / Dual Degree',
  'Postgraduate / Other',
];

const COMMON_DOMAINS = [
  '@gmail.com',
  '@outlook.com',
  '@ac.in',
  '@edu.in',
];

export default function PhoneAuthScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  // Steps: 'email' | 'otp' | 'profile'
  const [step, setStep] = useState<'email' | 'otp' | 'profile'>('email');
  const [loading, setLoading] = useState(false);

  // Form states
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [college, setCollege] = useState('');
  const [academicYear, setAcademicYear] = useState('2nd Year');
  const [branch, setBranch] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Auto-complete suggestions
  const [collegeSuggestions, setCollegeSuggestions] = useState<CollegeInfo[]>([]);
  const [branchSuggestions, setBranchSuggestions] = useState<BranchInfo[]>([]);
  const [showCollegeSuggestions, setShowCollegeSuggestions] = useState(false);
  const [showBranchSuggestions, setShowBranchSuggestions] = useState(false);

  // Username validation state
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<{ available?: boolean; message?: string }>({});

  useEffect(() => {
    // Check if user is already logged in
    AuthService.getCurrentUser().then(user => {
      if (user) {
        if (user.email) setEmail(user.email);
        setUsername(user.username);
        setFullName(user.full_name);
        setCollege(user.college);
        setAcademicYear(user.academic_year || '2nd Year');
        setBranch(user.branch || '');
        setStep('profile');
      }
    });
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleAppendDomain = (domain: string) => {
    if (!email.includes('@')) {
      setEmail(prev => `${prev.trim()}${domain}`);
    } else {
      const prefix = email.split('@')[0];
      setEmail(`${prefix}${domain}`);
    }
  };

  const handleCollegeTextChange = (text: string) => {
    setCollege(text);
    if (text.trim().length >= 1) {
      setCollegeSuggestions(searchColleges(text, 5));
      setShowCollegeSuggestions(true);
    } else {
      setCollegeSuggestions([]);
      setShowCollegeSuggestions(false);
    }
  };

  const handleSelectCollege = (col: CollegeInfo) => {
    setCollege(col.name);
    setShowCollegeSuggestions(false);
  };

  const handleBranchTextChange = (text: string) => {
    setBranch(text);
    if (text.trim().length >= 1) {
      setBranchSuggestions(searchBranches(text, 5));
      setShowBranchSuggestions(true);
    } else {
      setBranchSuggestions([]);
      setShowBranchSuggestions(false);
    }
  };

  const handleSelectBranch = (b: BranchInfo) => {
    setBranch(b.name);
    setShowBranchSuggestions(false);
  };

  const handleSendOtp = async () => {
    const { isValid, normalized, error } = validateAndNormalizeEmail(email);
    if (!isValid) {
      Alert.alert('Invalid Email', error || 'Please enter a valid student email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await AuthService.sendEmailOtp(normalized);
      setLoading(false);
      if (res.success) {
        setEmail(normalized);
        setResendCooldown(30);
        setStep('otp');
      } else {
        Alert.alert('Unable to Send Code', res.message);
      }
    } catch (e: any) {
      setLoading(false);
      Alert.alert('Error', e?.message || 'Failed to send verification email.');
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      Alert.alert('Code Required', 'Please enter the 6-digit security code sent to your email.');
      return;
    }

    setLoading(true);
    try {
      const res = await AuthService.verifyEmailOtp(email, otp);
      setLoading(false);

      if (res.success) {
        if (!res.isNewUser && res.profile) {
          Alert.alert('🎉 Welcome Back!', `Logged in as @${res.profile.username}`);
          if (route.params?.onSuccess) {
            route.params.onSuccess();
          }
          navigation.goBack();
        } else {
          // New student registration
          setStep('profile');
        }
      } else {
        Alert.alert('Invalid Code', res.message || 'Verification failed. Please check your email code.');
      }
    } catch (e: any) {
      setLoading(false);
      Alert.alert('Error', e?.message || 'Verification error occurred.');
    }
  };

  const checkUsernameLive = async (name: string) => {
    if (name.length < 3) {
      setUsernameStatus({ available: false, message: 'Minimum 3 characters' });
      return;
    }
    setUsernameChecking(true);
    const res = await AuthService.checkUsernameAvailable(name);
    setUsernameChecking(false);
    if (res.available) {
      setUsernameStatus({ available: true, message: 'Username is available!' });
    } else {
      setUsernameStatus({ available: false, message: res.error || 'Username unavailable' });
    }
  };

  const handleSaveProfile = async () => {
    if (!username.trim()) {
      Alert.alert('Username Required', 'Please choose a unique @username.');
      return;
    }
    if (!fullName.trim()) {
      Alert.alert('Name Required', 'Please enter your full name.');
      return;
    }
    if (!college.trim()) {
      Alert.alert('College Required', 'Please enter your college or institute name.');
      return;
    }

    setLoading(true);
    try {
      const res = await AuthService.createOrUpdateProfile({
        username,
        fullName,
        college,
        academicYear,
        branch,
      });
      setLoading(false);

      if (res.success) {
        Alert.alert(
          '🚀 Profile Connected!',
          `Your student profile @${username} is now verified and connected to your email ${email}!`,
          [
            {
              text: 'View Public Profile',
              onPress: () => {
                navigation.replace('PublicProfile', {profile: res.profile});
              },
            },
            {
              text: 'Launch Attendo',
              onPress: () => {
                if (route.params?.onSuccess) route.params.onSuccess();
                navigation.goBack();
              },
            },
          ],
        );
      } else {
        Alert.alert('Setup Failed', res.message || 'Could not save student profile.');
      }
    } catch (e: any) {
      setLoading(false);
      Alert.alert('Error', e?.message || 'Could not save student profile.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={{flex: 1, backgroundColor: Colors.background}}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={[styles.container, {paddingTop: insets.top}]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.badgeRow}>
            <View style={styles.portalBadge}>
              <Text style={styles.portalBadgeText}>🎓 STUDENT PORTAL</Text>
            </View>
            <View style={styles.supabaseBadge}>
              <Text style={styles.supabaseBadgeText}>SUPABASE VERIFIED</Text>
            </View>
          </View>

          <Text style={styles.title}>
            {step === 'profile' ? 'Setup Student Profile' : 'Student Email Sign-In'}
          </Text>
          <Text style={styles.subtitle}>
            {step === 'profile'
              ? 'Connect with classmates, showcase your LeetCode-style streak, and sync attendance to cloud.'
              : 'Sign in with your university mail or personal email. Receive an official 6-digit verification code.'}
          </Text>
        </View>

        {/* STEP 1: Email Input */}
        {step === 'email' && (
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Student Email Address</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.inputIcon}>✉️</Text>
              <TextInput
                style={styles.textInput}
                placeholder="student@college.edu or name@gmail.com"
                placeholderTextColor={Colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                autoFocus
              />
            </View>

            {/* Quick Domain Suggestion Chips */}
            <View style={styles.domainChipsRow}>
              {COMMON_DOMAINS.map(dom => (
                <TouchableOpacity
                  key={dom}
                  style={styles.domainChip}
                  onPress={() => handleAppendDomain(dom)}>
                  <Text style={styles.domainChipText}>{dom}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.hintText}>
              We will email you a 6-digit security code. No passwords required, 100% free and instant.
            </Text>

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleSendOtp}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Send Security Code →</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 2: OTP Verification */}
        {step === 'otp' && (
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Enter 6-Digit Code</Text>
            <Text style={styles.subtext}>
              A 6-digit code was sent to <Text style={{color: Colors.primary, fontWeight: '700'}}>{email}</Text>
            </Text>

            <TextInput
              style={styles.otpInput}
              placeholder="000000"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={setOtp}
              autoFocus
            />

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleVerifyOtp}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Verify & Proceed →</Text>
              )}
            </TouchableOpacity>

            <View style={styles.otpActionsRow}>
              <TouchableOpacity
                onPress={handleSendOtp}
                disabled={resendCooldown > 0 || loading}
                style={styles.resendBtn}>
                <Text style={[styles.resendBtnText, resendCooldown > 0 && {color: Colors.textMuted}]}>
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Code'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setStep('email')}
                style={styles.changeEmailBtn}>
                <Text style={styles.changeEmailBtnText}>Change Email</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* STEP 3: Student Profile Setup */}
        {step === 'profile' && (
          <View style={styles.card}>
            {/* Username */}
            <View style={styles.labelWithStatus}>
              <Text style={styles.fieldLabel}>Choose @Username</Text>
              {usernameChecking ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : usernameStatus.message ? (
                <Text style={[styles.statusMsg, usernameStatus.available ? styles.statusSafe : styles.statusDanger]}>
                  {usernameStatus.message}
                </Text>
              ) : null}
            </View>
            <View style={styles.usernameRow}>
              <Text style={styles.usernamePrefix}>@</Text>
              <TextInput
                style={styles.usernameInput}
                placeholder="yugandhar_08"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                value={username}
                onChangeText={t => {
                  const cleaned = t.replace(/[^a-zA-Z0-9_]/g, '');
                  setUsername(cleaned);
                  if (cleaned.length >= 3) {
                    checkUsernameLive(cleaned);
                  }
                }}
              />
            </View>

            {/* Full Name */}
            <Text style={styles.fieldLabel}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Yugandhar Reddy"
              placeholderTextColor={Colors.textMuted}
              value={fullName}
              onChangeText={setFullName}
            />

            {/* College / Institute */}
            <Text style={styles.fieldLabel}>College / Institute Name (300+ Verified)</Text>
            <TextInput
              style={styles.input}
              placeholder="Search IIT, NIT, BITS, VIT, IIIT, State Uni..."
              placeholderTextColor={Colors.textMuted}
              value={college}
              onChangeText={handleCollegeTextChange}
            />

            {/* Quick College Suggestion Dropdown */}
            {showCollegeSuggestions && collegeSuggestions.length > 0 && (
              <View style={styles.suggestionBox}>
                {collegeSuggestions.map((item, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.suggestionRow}
                    onPress={() => handleSelectCollege(item)}>
                    <Text style={styles.suggestionBadge}>[{item.shortCode}]</Text>
                    <View style={{flex: 1}}>
                      <Text style={styles.suggestionName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.suggestionSub}>{item.city}, {item.state} • {item.category}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Popular quick tags */}
            <View style={styles.quickTagsRow}>
              {['IIT Bombay', 'BITS Pilani', 'NIT Trichy', 'VIT Vellore', 'JNTUH', 'DTU'].map(quickCol => (
                <TouchableOpacity
                  key={quickCol}
                  style={styles.quickTag}
                  onPress={() => setCollege(quickCol)}>
                  <Text style={styles.quickTagText}>{quickCol}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Academic Year */}
            <Text style={styles.fieldLabel}>Academic Year</Text>
            <View style={styles.chipGrid}>
              {ACADEMIC_YEARS.map(yr => (
                <TouchableOpacity
                  key={yr}
                  style={[
                    styles.chip,
                    academicYear === yr && styles.chipActive,
                  ]}
                  onPress={() => setAcademicYear(yr)}>
                  <Text
                    style={[
                      styles.chipText,
                      academicYear === yr && styles.chipTextActive,
                    ]}>
                    {yr}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Branch / Major */}
            <Text style={styles.fieldLabel}>B.Tech Branch / Engineering Major</Text>
            <TextInput
              style={styles.input}
              placeholder="Search CSE, AI/ML, Data Science, ECE, EEE..."
              placeholderTextColor={Colors.textMuted}
              value={branch}
              onChangeText={handleBranchTextChange}
            />

            {/* Quick Branch Suggestion Dropdown */}
            {showBranchSuggestions && branchSuggestions.length > 0 && (
              <View style={styles.suggestionBox}>
                {branchSuggestions.map((item, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.suggestionRow}
                    onPress={() => handleSelectBranch(item)}>
                    <Text style={[styles.suggestionBadge, {backgroundColor: '#8B5CF625', color: '#A78BFA'}]}>
                      {item.code}
                    </Text>
                    <View style={{flex: 1}}>
                      <Text style={styles.suggestionName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.suggestionSub}>{item.category}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Popular branch tags */}
            <View style={styles.quickTagsRow}>
              {['CSE Core', 'CSE (AI & ML)', 'Data Science', 'ECE', 'EEE', 'Mechanical'].map(quickBr => (
                <TouchableOpacity
                  key={quickBr}
                  style={[styles.quickTag, {borderColor: '#8B5CF644'}]}
                  onPress={() => setBranch(quickBr)}>
                  <Text style={[styles.quickTagText, {color: '#C4B5FD'}]}>{quickBr}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleSaveProfile}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Save & Sync Attendance 🚀</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07090E',
  },
  content: {
    padding: Spacing.screenPad,
    paddingBottom: 40,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: Spacing.md,
  },
  backButtonText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '700',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  portalBadge: {
    backgroundColor: '#38BDF81A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#38BDF844',
  },
  portalBadgeText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  supabaseBadge: {
    backgroundColor: '#10B9811A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#10B98144',
  },
  supabaseBadgeText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  title: {
    ...Typography.h2,
    color: '#F8FAFC',
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    ...Typography.body2,
    color: '#94A3B8',
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  fieldLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 12,
  },
  labelWithStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusMsg: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusSafe: {
    color: '#10B981',
  },
  statusDanger: {
    color: '#EF4444',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#07090E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    paddingVertical: 12,
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '500',
  },
  domainChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  domainChip: {
    backgroundColor: '#1E293B80',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  domainChipText: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '600',
  },
  otpInput: {
    backgroundColor: '#07090E',
    borderWidth: 1,
    borderColor: '#38BDF844',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: '#38BDF8',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 10,
    textAlign: 'center',
    marginVertical: 10,
  },
  otpActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  resendBtn: {
    paddingVertical: 6,
  },
  resendBtnText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
  changeEmailBtn: {
    paddingVertical: 6,
  },
  changeEmailBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#07090E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  usernamePrefix: {
    fontSize: 16,
    fontWeight: '700',
    color: '#38BDF8',
  },
  usernameInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 6,
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#07090E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F8FAFC',
    fontSize: 15,
  },
  hintText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 6,
    lineHeight: 16,
  },
  subtext: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 8,
    lineHeight: 18,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 6,
  },
  chip: {
    backgroundColor: '#07090E',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  chipActive: {
    backgroundColor: '#38BDF822',
    borderColor: '#38BDF8',
  },
  chipText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#38BDF8',
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: '#38BDF8',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
    shadowColor: '#38BDF8',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#07090E',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.4,
  },
  suggestionBox: {
    backgroundColor: '#07090E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    marginTop: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  suggestionBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38BDF8',
    backgroundColor: '#38BDF818',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 10,
  },
  suggestionName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  suggestionSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  quickTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
    marginBottom: 4,
  },
  quickTag: {
    backgroundColor: '#07090E',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  quickTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#38BDF8',
  },
});
