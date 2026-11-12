import { supabaseRestRequest, getDeviceId } from './SupabaseClient';
import { APP_VERSION } from '../config/supabase';
import { Platform } from 'react-native';

export async function reportCrash(error: Error, screenName?: string): Promise<void> {
  try {
    const deviceId = getDeviceId();
    const { data: users } = await supabaseRestRequest<any[]>(`users?device_id=eq.${encodeURIComponent(deviceId)}`);
    const userId = users && users.length > 0 ? users[0].id : null;

    await supabaseRestRequest('crash_logs', {
      method: 'POST',
      body: {
        user_id: userId,
        error_message: error.message || 'Unknown Error',
        error_stack: (error.stack || '').substring(0, 5000),
        screen_name: screenName || 'Unknown Screen',
        app_version: APP_VERSION,
        device_info: {
          os: Platform.OS,
          version: Platform.Version,
          device_id: deviceId,
        },
      },
    });
  } catch (e) {
    console.warn('Crash report failed to send:', e);
  }
}

export function setupGlobalErrorHandler(): void {
  try {
    const globalHandler = (globalThis as any).ErrorUtils?.getGlobalHandler?.();
    (globalThis as any).ErrorUtils?.setGlobalHandler?.((error: Error, isFatal?: boolean) => {
      reportCrash(error, isFatal ? 'FATAL_ERROR' : 'JS_ERROR');
      if (globalHandler) {
        globalHandler(error, isFatal);
      }
    });
  } catch (e) {
    console.warn('setupGlobalErrorHandler warning:', e);
  }
}
