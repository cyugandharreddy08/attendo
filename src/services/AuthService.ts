import {
  supabaseRestRequest,
  loadAuthSession,
  saveAuthSession,
  clearAuthSession,
  AuthSession,
} from './SupabaseClient';
import { getSetting, setSetting, deleteSetting } from '../db/queries/settings';
import { getUserAttendanceActivityReport } from '../db/queries/lectureInstances';
import { CloudBackupService } from './CloudBackupService';
import { StudentProfile } from '../types';

const SETTING_PROFILE_KEY = 'auth_student_profile';

// Publicly exposable profile fields (explicit whitelist excluding phone, email, and device IDs)
export const PUBLIC_PROFILE_SELECT_FIELDS =
  'id,username,full_name,college,academic_year,branch,overall_percent,theory_percent,lab_percent,current_streak,longest_streak,active_days_count,activity_matrix,badges,is_public,updated_at';

/**
 * Validates and normalizes email addresses
 */
export function validateAndNormalizeEmail(input: string): { isValid: boolean; normalized: string; error?: string } {
  if (!input || typeof input !== 'string') {
    return { isValid: false, normalized: '', error: 'Email address is required.' };
  }
  const normalized = input.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalized)) {
    return {
      isValid: false,
      normalized: '',
      error: 'Please enter a valid email address (e.g., student@college.edu or name@gmail.com).',
    };
  }
  return { isValid: true, normalized };
}

/**
 * Validates and normalizes phone number to strict E.164 format (+[country_code][digits])
 */
export function validateAndNormalizePhone(input: string): { isValid: boolean; normalized: string; error?: string } {
  if (!input || typeof input !== 'string') {
    return { isValid: false, normalized: '', error: 'Phone number is required.' };
  }

  // Strip whitespace, dashes, parentheses
  let cleaned = input.trim().replace(/[\s\-\(\)]/g, '');

  // Default to +91 for 10-digit Indian numbers if no '+' prefix
  if (/^\d{10}$/.test(cleaned)) {
    cleaned = `+91${cleaned}`;
  } else if (/^0\d{10}$/.test(cleaned)) {
    cleaned = `+91${cleaned.substring(1)}`;
  } else if (!cleaned.startsWith('+') && /^\d{11,14}$/.test(cleaned)) {
    cleaned = `+${cleaned}`;
  }

  // Strict E.164 regex: + followed by 10 to 15 digits
  const e164Regex = /^\+[1-9]\d{9,14}$/;
  if (!e164Regex.test(cleaned)) {
    return {
      isValid: false,
      normalized: '',
      error: 'Please enter a valid international mobile number with country code (e.g., +91 9876543210).',
    };
  }

  return { isValid: true, normalized: cleaned };
}

// Backward-compatible alias
export function normalizePhoneNumber(input: string): string {
  const result = validateAndNormalizePhone(input);
  return result.normalized || input.trim();
}

/**
 * Validates and normalizes username (lowercase, letters, numbers, and single underscores, 3-24 chars)
 */
export function validateAndNormalizeUsername(input: string): { isValid: boolean; normalized: string; error?: string } {
  if (!input || typeof input !== 'string') {
    return { isValid: false, normalized: '', error: 'Username is required.' };
  }

  const normalized = input.trim().toLowerCase().replace(/^@/, '');

  if (normalized.length < 3) {
    return { isValid: false, normalized, error: 'Username must be at least 3 characters long.' };
  }
  if (normalized.length > 24) {
    return { isValid: false, normalized, error: 'Username cannot exceed 24 characters.' };
  }
  if (!/^[a-z0-9][a-z0-9_]*[a-z0-9]$/.test(normalized) && normalized.length > 1) {
    return {
      isValid: false,
      normalized,
      error: 'Username can only contain lowercase letters, numbers, and underscores, and cannot start or end with an underscore.',
    };
  }

  return { isValid: true, normalized };
}

export class AuthService {
  private static cachedProfile: StudentProfile | null = null;

  /**
   * Get currently authenticated session
   */
  static async getSession(): Promise<AuthSession | null> {
    return loadAuthSession();
  }

  /**
   * Check if a valid authenticated session exists
   */
  static async isAuthenticated(): Promise<boolean> {
    const session = await loadAuthSession();
    return !!(session && session.access_token && session.user_id);
  }

  /**
   * Get currently logged-in user profile from local storage if session is valid
   */
  static async getCurrentUser(): Promise<StudentProfile | null> {
    const isAuth = await this.isAuthenticated();
    if (!isAuth) {
      this.cachedProfile = null;
      return null;
    }

    if (this.cachedProfile) return this.cachedProfile;

    const raw = await getSetting(SETTING_PROFILE_KEY);
    if (!raw) return null;

    try {
      this.cachedProfile = JSON.parse(raw) as StudentProfile;
      return this.cachedProfile;
    } catch {
      return null;
    }
  }

  /**
   * Save user profile locally
   */
  static async saveLocalProfile(profile: StudentProfile): Promise<void> {
    this.cachedProfile = profile;
    await setSetting(SETTING_PROFILE_KEY, JSON.stringify(profile));
  }

  /**
   * Sign out current user from Supabase and invalidate local session
   */
  static async logout(): Promise<void> {
    this.cachedProfile = null;

    try {
      // Invalidate remote session on Supabase
      await supabaseRestRequest('auth/v1/logout', {
        method: 'POST',
      });
    } catch (e) {
      console.warn('Remote logout notification failed:', e);
    }

    await clearAuthSession();
    await deleteSetting(SETTING_PROFILE_KEY);
  }

  /**
   * Request 6-digit verification code sent directly to student email via Supabase Auth
   */
  static async sendEmailOtp(rawEmail: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const { isValid, normalized: email, error: validationError } = validateAndNormalizeEmail(rawEmail);
    if (!isValid) {
      return { success: false, message: validationError || 'Invalid email format.' };
    }

    try {
      const { error, status } = await supabaseRestRequest<any>('auth/v1/otp', {
        method: 'POST',
        body: {
          email,
        },
      });

      if (error) {
        return {
          success: false,
          message: error || `Failed to send verification email (HTTP ${status}). Please try again.`,
        };
      }

      return {
        success: true,
        message: `6-digit verification code sent to ${email}. Please check your inbox and spam folder.`,
      };
    } catch (e: any) {
      return {
        success: false,
        message: e?.message || 'Network error while contacting authentication server.',
      };
    }
  }

  /**
   * Verify email OTP with real Supabase Auth and establish an authenticated session.
   */
  static async verifyEmailOtp(
    rawEmail: string,
    rawOtpToken: string,
  ): Promise<{
    success: boolean;
    isNewUser: boolean;
    profile?: StudentProfile;
    session?: AuthSession;
    message: string;
  }> {
    const { isValid, normalized: email, error: emailErr } = validateAndNormalizeEmail(rawEmail);
    if (!isValid) {
      return { success: false, isNewUser: false, message: emailErr || 'Invalid email address.' };
    }

    const token = rawOtpToken.trim();
    if (!/^\d{6}$/.test(token)) {
      return { success: false, isNewUser: false, message: 'Please enter the exact 6-digit numeric verification code.' };
    }

    try {
      const { data, error, status } = await supabaseRestRequest<{
        access_token: string;
        token_type: string;
        expires_in: number;
        refresh_token: string;
        user: { id: string; email?: string; phone?: string };
      }>('auth/v1/verify', {
        method: 'POST',
        body: {
          type: 'email',
          email,
          token,
        },
      });

      if (error || !data || !data.access_token || !data.user?.id) {
        return {
          success: false,
          isNewUser: false,
          message: error || 'Incorrect or expired verification code. Please check your email and try again.',
        };
      }

      // Secure authenticated session persistence
      const session: AuthSession = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + (data.expires_in || 3600) * 1000,
        user_id: data.user.id,
        email: data.user.email || email,
        phone: data.user.phone || '',
      };
      await saveAuthSession(session);

      // Fetch user profile from Supabase for this authenticated user_id
      const { data: profiles, error: profileErr } = await supabaseRestRequest<StudentProfile[]>(
        `profiles?user_id=eq.${encodeURIComponent(session.user_id)}&select=*`,
        { requiresAuth: true }
      );

      if (!profileErr && profiles && profiles.length > 0) {
        const found = profiles[0];
        await this.saveLocalProfile(found);

        // Auto-restore subjects and timetable data from cloud
        CloudBackupService.restoreUserDataFromCloud(session.user_id).catch(err => {
          console.warn('Auto cloud restore on login notice:', err);
        });

        // Sync local stats to cloud
        this.syncAttendanceProfile().catch(() => {});

        return {
          success: true,
          isNewUser: false,
          profile: found,
          session,
          message: `Welcome back, @${found.username}!`,
        };
      }

      // New student registration required
      return {
        success: true,
        isNewUser: true,
        session,
        message: 'Email verified! Please set up your student profile.',
      };
    } catch (e: any) {
      return {
        success: false,
        isNewUser: false,
        message: e?.message || 'Verification failed due to a network interruption.',
      };
    }
  }

  /**
   * Request real SMS OTP via Supabase Auth
   */
  static async sendPhoneOtp(rawPhone: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const { isValid, normalized: phone, error: validationError } = validateAndNormalizePhone(rawPhone);
    if (!isValid) {
      return { success: false, message: validationError || 'Invalid phone number format.' };
    }

    try {
      const { error, status } = await supabaseRestRequest<any>('auth/v1/otp', {
        method: 'POST',
        body: {
          phone,
          create_user: true,
        },
      });

      if (error) {
        return {
          success: false,
          message: error || `Failed to send verification SMS (HTTP ${status}). Check SMS provider configuration.`,
        };
      }

      return {
        success: true,
        message: `Official verification code sent via SMS to ${phone}.`,
      };
    } catch (e: any) {
      return {
        success: false,
        message: e?.message || 'Network error while contacting authentication server.',
      };
    }
  }

  /**
   * Verify phone OTP with real Supabase Auth and establish an authenticated session.
   * Rejects any fake, hardcoded, or demo OTPs in production.
   */
  static async verifyPhoneOtp(
    rawPhone: string,
    rawOtpToken: string,
  ): Promise<{
    success: boolean;
    isNewUser: boolean;
    profile?: StudentProfile;
    session?: AuthSession;
    message: string;
  }> {
    const { isValid, normalized: phone, error: phoneErr } = validateAndNormalizePhone(rawPhone);
    if (!isValid) {
      return { success: false, isNewUser: false, message: phoneErr || 'Invalid phone number.' };
    }

    const token = rawOtpToken.trim();
    if (!/^\d{6}$/.test(token)) {
      return { success: false, isNewUser: false, message: 'Please enter the exact 6-digit numeric verification code.' };
    }

    try {
      // Real Supabase phone OTP verification
      const { data, error, status } = await supabaseRestRequest<{
        access_token: string;
        token_type: string;
        expires_in: number;
        refresh_token: string;
        user: { id: string; phone?: string; email?: string };
      }>('auth/v1/verify', {
        method: 'POST',
        body: {
          type: 'sms',
          phone,
          token,
        },
      });

      if (error || !data || !data.access_token || !data.user?.id) {
        return {
          success: false,
          isNewUser: false,
          message: error || 'Incorrect or expired verification code. Please check your SMS and try again.',
        };
      }

      // Secure authenticated session persistence
      const session: AuthSession = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + (data.expires_in || 3600) * 1000,
        user_id: data.user.id,
        phone: data.user.phone || phone,
      };
      await saveAuthSession(session);

      // Fetch user profile from Supabase for this authenticated user_id
      const { data: profiles, error: profileErr } = await supabaseRestRequest<StudentProfile[]>(
        `profiles?user_id=eq.${encodeURIComponent(session.user_id)}&select=*`,
        { requiresAuth: true }
      );

      if (!profileErr && profiles && profiles.length > 0) {
        const found = profiles[0];
        await this.saveLocalProfile(found);

        // Auto-restore subjects and timetable data from cloud
        CloudBackupService.restoreUserDataFromCloud(session.user_id).catch(err => {
          console.warn('Auto cloud restore on login notice:', err);
        });

        // Sync local stats to cloud
        this.syncAttendanceProfile().catch(() => {});

        return {
          success: true,
          isNewUser: false,
          profile: found,
          session,
          message: `Welcome back, @${found.username}!`,
        };
      }

      // New user registration required
      return {
        success: true,
        isNewUser: true,
        session,
        message: 'Phone verified! Please set up your student profile.',
      };
    } catch (e: any) {
      return {
        success: false,
        isNewUser: false,
        message: e?.message || 'Verification failed due to a network interruption.',
      };
    }
  }

  /**
   * Check if a username is available. Fails closed on network or database errors.
   */
  static async checkUsernameAvailable(rawUsername: string): Promise<{ available: boolean; error?: string }> {
    const { isValid, normalized: username, error: validationErr } = validateAndNormalizeUsername(rawUsername);
    if (!isValid) {
      return { available: false, error: validationErr };
    }

    try {
      const { data, error } = await supabaseRestRequest<Array<{ id: string }>>(
        `profiles?username=eq.${encodeURIComponent(username)}&select=id&limit=1`
      );

      if (error) {
        // Fail closed: Never treat database or network errors as username availability!
        return { available: false, error: 'Could not verify username availability with the server. Please check your internet connection.' };
      }

      if (data && data.length > 0) {
        const session = await loadAuthSession();
        // If current authenticated user owns this profile, consider it valid for them
        if (session && data[0].id === session.user_id) {
          return { available: true };
        }
        return { available: false, error: `@${username} is already taken by another student.` };
      }

      return { available: true };
    } catch (e: any) {
      return { available: false, error: e?.message || 'Network error while checking username availability.' };
    }
  }

  /**
   * Register or update student profile for the authenticated user ID.
   * Default visibility is private (`is_public = false`) unless explicitly opted-in.
   */
  static async createOrUpdateProfile(input: {
    username: string;
    fullName: string;
    college: string;
    academicYear: string;
    branch?: string;
    isPublic?: boolean;
  }): Promise<{ success: boolean; profile?: StudentProfile; message: string }> {
    const session = await loadAuthSession();
    if (!session || !session.user_id) {
      return { success: false, message: 'Authentication required. Please verify your phone number first.' };
    }

    const { isValid: userValid, normalized: username, error: userErr } = validateAndNormalizeUsername(input.username);
    if (!userValid) {
      return { success: false, message: userErr || 'Invalid username.' };
    }

    const fullName = input.fullName.trim();
    if (!fullName || fullName.length < 2) {
      return { success: false, message: 'Please enter your real full name.' };
    }

    const college = input.college.trim();
    if (!college) {
      return { success: false, message: 'Please select or enter your college / institute.' };
    }

    const academicYear = input.academicYear.trim();
    const branch = input.branch?.trim() || '';

    // Verify username availability
    const availCheck = await this.checkUsernameAvailable(username);
    if (!availCheck.available) {
      return { success: false, message: availCheck.error || 'Username is unavailable.' };
    }

    // Compute local attendance activity report for leaderboard and streak badges
    const localReport = await getUserAttendanceActivityReport();

    const profileData: StudentProfile = {
      id: session.user_id,
      email: session.email || '',
      phone: session.phone || '',
      username,
      full_name: fullName,
      college,
      academic_year: academicYear,
      branch,
      overall_percent: localReport.overallPercent,
      theory_percent: localReport.theoryPercent,
      lab_percent: localReport.labPercent,
      current_streak: localReport.currentStreak,
      longest_streak: localReport.longestStreak,
      total_attended_hours: localReport.totalAttendedHours,
      total_held_hours: localReport.totalHeldHours,
      active_days_count: localReport.activeDaysCount,
      activity_matrix: localReport.activityMatrix,
      badges: localReport.badges,
      is_public: input.isPublic ?? false, // Private by default per security audit!
      updated_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabaseRestRequest<StudentProfile[]>('profiles', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
        body: {
          ...profileData,
          user_id: session.user_id, // Hardened relation bound to auth.uid()
        },
        requiresAuth: true,
      });

      if (error) {
        return { success: false, message: `Could not save profile to server: ${error}` };
      }

      const saved = (data && data[0]) ? data[0] : profileData;
      await this.saveLocalProfile(saved);

      // Perform cloud backup on profile update
      CloudBackupService.uploadBackupToCloud(session.user_id).catch(err => {
        console.warn('Initial cloud backup notice:', err);
      });

      return {
        success: true,
        profile: saved,
        message: `Profile @${username} saved successfully! ${input.isPublic ? '(Public Leaderboard Enabled)' : '(Private Mode)'}`,
      };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Failed to save profile due to server communication error.' };
    }
  }

  /**
   * Sync local attendance numbers & streaks to cloud for authenticated user
   */
  static async syncAttendanceProfile(): Promise<{ success: boolean; message: string }> {
    const session = await loadAuthSession();
    const current = await this.getCurrentUser();
    if (!session || !current) {
      return { success: false, message: 'Please log in to sync attendance.' };
    }

    try {
      const localReport = await getUserAttendanceActivityReport();

      const updatedData = {
        overall_percent: localReport.overallPercent,
        theory_percent: localReport.theoryPercent,
        lab_percent: localReport.labPercent,
        current_streak: localReport.currentStreak,
        longest_streak: localReport.longestStreak,
        total_attended_hours: localReport.totalAttendedHours,
        total_held_hours: localReport.totalHeldHours,
        active_days_count: localReport.activeDaysCount,
        activity_matrix: localReport.activityMatrix,
        badges: localReport.badges,
        updated_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),
      };

      const fullProfile: StudentProfile = {
        ...current,
        ...updatedData,
      };

      await this.saveLocalProfile(fullProfile);

      // Patch remote profile verifying user_id = auth.uid()
      const { error } = await supabaseRestRequest(`profiles?user_id=eq.${encodeURIComponent(session.user_id)}`, {
        method: 'PATCH',
        body: updatedData,
        requiresAuth: true,
      });

      if (error) {
        return { success: false, message: `Server sync failed: ${error}` };
      }

      // Also trigger cloud backup
      CloudBackupService.uploadBackupToCloud(session.user_id).catch(() => {});

      return {
        success: true,
        message: `Synced! ${localReport.currentStreak} day streak 🔥 (${localReport.overallPercent}% attendance)`,
      };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Sync failed due to network error.' };
    }
  }

  /**
   * Explicitly backup local database to user's authenticated cloud account
   */
  static async backupNow(): Promise<{ success: boolean; message: string }> {
    const session = await loadAuthSession();
    if (!session?.user_id) {
      return { success: false, message: 'Please log in with phone verification first.' };
    }
    return CloudBackupService.uploadBackupToCloud(session.user_id);
  }

  /**
   * Explicitly restore user's database from cloud
   */
  static async restoreNow(mode: 'merge' | 'replace' = 'merge'): Promise<{ success: boolean; message: string }> {
    const session = await loadAuthSession();
    if (!session?.user_id) {
      return { success: false, message: 'Please log in with phone verification first.' };
    }
    const res = await CloudBackupService.restoreUserDataFromCloud(session.user_id, mode);
    return { success: res.success, message: res.message };
  }

  /**
   * Search public student profiles with sanitized whitelist projection.
   * NEVER exposes phone numbers or private accounts.
   */
  static async searchStudents(params: {
    college?: string;
    search?: string;
    academicYear?: string;
    limit?: number;
  }): Promise<StudentProfile[]> {
    try {
      const limit = Math.min(params.limit || 50, 100);
      let queryParams: string[] = [
        'is_public=eq.true', // Strictly public profiles only!
        `select=${PUBLIC_PROFILE_SELECT_FIELDS}`, // Sanitized field whitelist
        'order=current_streak.desc,overall_percent.desc',
        `limit=${limit}`,
      ];

      if (params.college && params.college.trim()) {
        const encoded = encodeURIComponent(`*${params.college.trim()}*`);
        queryParams.push(`college=ilike.${encoded}`);
      }

      if (params.search && params.search.trim()) {
        const term = encodeURIComponent(`*${params.search.trim()}*`);
        queryParams.push(`or=(username.ilike.${term},full_name.ilike.${term},college.ilike.${term})`);
      }

      if (params.academicYear && params.academicYear !== 'All') {
        const encoded = encodeURIComponent(params.academicYear.trim());
        queryParams.push(`academic_year=eq.${encoded}`);
      }

      const queryString = queryParams.join('&');
      const { data, error } = await supabaseRestRequest<StudentProfile[]>(`profiles?${queryString}`);

      if (error || !data) {
        return [];
      }

      return data;
    } catch (e) {
      return [];
    }
  }

  /**
   * Get single public profile by username with sanitized projection
   */
  static async getStudentByUsername(username: string): Promise<StudentProfile | null> {
    try {
      const clean = username.trim().toLowerCase().replace(/^@/, '');
      const { data, error } = await supabaseRestRequest<StudentProfile[]>(
        `profiles?username=eq.${encodeURIComponent(clean)}&is_public=eq.true&select=${PUBLIC_PROFILE_SELECT_FIELDS}&limit=1`
      );
      if (error || !data || data.length === 0) return null;
      return data[0];
    } catch {
      return null;
    }
  }

  /**
   * Complete GDPR/privacy compliant account and cloud data deletion
   */
  static async deleteAccountAndData(): Promise<{ success: boolean; message: string }> {
    const session = await loadAuthSession();
    if (!session?.user_id) {
      return { success: false, message: 'Not logged in.' };
    }

    try {
      // 1. Delete cloud backups
      await supabaseRestRequest(`user_cloud_backups?user_id=eq.${encodeURIComponent(session.user_id)}`, {
        method: 'DELETE',
        requiresAuth: true,
      });

      // 2. Delete public profile
      await supabaseRestRequest(`profiles?user_id=eq.${encodeURIComponent(session.user_id)}`, {
        method: 'DELETE',
        requiresAuth: true,
      });

      // 3. Clear local credentials
      await this.logout();

      return { success: true, message: 'Your student account and all cloud backup records have been permanently deleted.' };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Failed to complete cloud account deletion.' };
    }
  }
}
