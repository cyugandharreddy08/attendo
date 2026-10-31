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
import {AuthService, normalizePhoneNumber} from '../services/AuthService';

const ACADEMIC_YEARS = [
  '1st Year',
  '2nd Year',
  '3rd Year',
  '4th Year',
  'Postgraduate / Other',
];

export default function PhoneAuthScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  // Steps: 'phone' | 'otp' | 'profile'
  const [step, setStep] = useState<'phone' | 'otp' | 'profile'>('phone');
  const [loading, setLoading] = useState(false);

  // Form states
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [college, setCollege] = useState('');
  const [academicYear, setAcademicYear] = useState('2nd Year');
  const [branch, setBranch] = useState('');
  const [demoHint, setDemoHint] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is already logged in
    AuthService.getCurrentUser().then(user => {
      if (user) {
        setPhone(user.phone);
        setUsername(user.username);
        setFullName(user.full_name);
        setCollege(user.college);
        setAcademicYear(user.academic_year || '2nd Year');
        setBranch(user.branch || '');
        setStep('profile');
      }
    });
  }, []);

  const handleSendOtp = async () => {
    if (!phone.trim()) {
      Alert.alert('Phone Required', 'Please enter your mobile phone number.');
      return;
    }

    setLoading(true);
    setDemoHint(null);
    try {
      const res = await AuthService.sendPhoneOtp(phone);
      setLoading(false);
      if (res.success) {
        if (res.isDemoMode) {
          setDemoHint(res.message);
        }
        setStep('otp');
      } else {
        Alert.alert('Error', res.message);
      }
    } catch (e: any) {
      setLoading(false);
      Alert.alert('Error', e?.message || 'Failed to send OTP');
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      Alert.alert('OTP Required', 'Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const res = await AuthService.verifyPhoneOtp(phone, otp);
      setLoading(false);

      if (res.success) {
        if (!res.isNewUser && res.profile) {
          Alert.alert('🎉 Welcome Back!', `Logged in as @${res.profile.username}`);
          if (route.params?.onSuccess) {
            route.params.onSuccess();
          }
          navigation.goBack();
        } else {
          // New user -> fill details
          setStep('profile');
        }
      } else {
        Alert.alert('Invalid OTP', res.message || 'Verification failed. Try again.');
      }
    } catch (e: any) {
      setLoading(false);
      Alert.alert('Error', e?.message || 'Verification error');
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
        phone,
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
          `Your student profile @${username} is now live and discoverable by classmates from ${college}!`,
          [
            {
              text: 'View Public Profile',
              onPress: () => {
                navigation.replace('PublicProfile', {profile: res.profile});
              },
            },
            {
              text: 'Done',
              onPress: () => {
                if (route.params?.onSuccess) route.params.onSuccess();
                navigation.goBack();
              },
            },
          ],
        );
      } else {
        Alert.alert('Setup Failed', res.message || 'Could not save profile.');
      }
    } catch (e: any) {
      setLoading(false);
      Alert.alert('Error', e?.message || 'Could not save profile.');
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
          <Text style={styles.title}>
            {step === 'profile' ? 'Student Profile Setup' : 'Connect Your Account'}
          </Text>
          <Text style={styles.subtitle}>
            {step === 'profile'
              ? 'Connect with classmates, showcase your LeetCode-style streak, and get discovered by your institute.'
              : 'Enter your mobile number to sign in or claim your public college attendance profile.'}
          </Text>
        </View>

        {/* STEP 1: Phone Input */}
        {step === 'phone' && (
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Mobile Phone Number</Text>
            <View style={styles.phoneInputRow}>
              <View style={styles.countryCodeBox}>
                <Text style={styles.countryCodeText}>🇮🇳 +91</Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                placeholder="9876543210"
                placeholderTextColor={Colors.textMuted}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                autoFocus
              />
            </View>
            <Text style={styles.hintText}>
              We will send a 6-digit verification code to verify your campus identity.
            </Text>

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleSendOtp}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Send Verification Code →</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 2: OTP Input */}
        {step === 'otp' && (
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Enter 6-Digit OTP</Text>
            <Text style={styles.subtext}>
              Sent to {normalizePhoneNumber(phone)}
            </Text>

            <TextInput
              style={styles.otpInput}
              placeholder="123456"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={setOtp}
              autoFocus
            />

            {demoHint && (
              <View style={styles.demoNotice}>
                <Text style={styles.demoNoticeText}>💡 {demoHint}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleVerifyOtp}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Verify & Continue →</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => setStep('phone')}>
              <Text style={styles.linkButtonText}>Change Phone Number</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 3: Profile Setup */}
        {step === 'profile' && (
          <View style={styles.card}>
            {/* Username */}
            <Text style={styles.fieldLabel}>Username</Text>
            <View style={styles.usernameRow}>
              <Text style={styles.usernamePrefix}>@</Text>
              <TextInput
                style={styles.usernameInput}
                placeholder="yugandhar_08"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                value={username}
                onChangeText={t => setUsername(t.replace(/[^a-zA-Z0-9_]/g, ''))}
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
            <Text style={styles.fieldLabel}>College / Institute Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. IIT Bombay / BITS Pilani / NIT Trichy / VIT"
              placeholderTextColor={Colors.textMuted}
              value={college}
              onChangeText={setCollege}
            />
            <Text style={styles.hintText}>
              Students from this institute can find you on the campus peer leaderboard.
            </Text>

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
            <Text style={styles.fieldLabel}>Branch / Major (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Computer Science & Engg"
              placeholderTextColor={Colors.textMuted}
              value={branch}
              onChangeText={setBranch}
            />

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
    backgroundColor: Colors.background,
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
    backgroundColor: '#1E1E2E',
    borderRadius: 8,
    marginBottom: Spacing.md,
  },
  backButtonText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    ...Typography.h2,
    color: Colors.text,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    ...Typography.body2,
    color: Colors.textMuted,
    lineHeight: 20,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  fieldLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 12,
  },
  phoneInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  countryCodeBox: {
    backgroundColor: '#1E1E2E',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countryCodeText: {
    color: Colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  phoneInput: {
    flex: 1,
    backgroundColor: '#1E1E2E',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  otpInput: {
    backgroundColor: '#1E1E2E',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: Colors.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 10,
    textAlign: 'center',
    marginVertical: 10,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E2E',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  usernamePrefix: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  usernameInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 6,
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#1E1E2E',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
  },
  hintText: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 6,
    fontSize: 11,
  },
  subtext: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 6,
  },
  chip: {
    backgroundColor: '#1E1E2E',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primary + '22',
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  chipTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  linkButton: {
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  linkButtonText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  demoNotice: {
    backgroundColor: '#F59E0B22',
    borderWidth: 1,
    borderColor: '#F59E0B66',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  demoNoticeText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '600',
  },
});
