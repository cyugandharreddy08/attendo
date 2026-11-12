import {Alert} from 'react-native';
import {checkLatestAppVersion} from './UpdateService';
import {triggerForceUpdateModal} from '../components/ForceUpdateModal';
import {APP_VERSION} from '../config/supabase';

/**
 * ⚡ Production Force Update & Release Engine
 * Automatically prompts or locks older versions with the download gatekeeper.
 */
export async function checkForJSUpdate(isManual: boolean = false): Promise<void> {
  try {
    const result = await checkLatestAppVersion();
    if (result.hasUpdate && result.version) {
      triggerForceUpdateModal(result.version);
      return;
    }

    if (isManual) {
      Alert.alert(
        '⚡ System Status: Up to Date',
        `Attendo is running the latest version (${APP_VERSION}). Would you like to test or preview the Force Update Gatekeeper interface?`,
        [
          {text: 'Close', style: 'cancel'},
          {
            text: 'Preview Force Update',
            onPress: () => {
              triggerForceUpdateModal();
            },
          },
        ]
      );
    }
  } catch (e) {
    if (isManual) {
      Alert.alert('⚡ System Status', `Attendo is running version ${APP_VERSION}.`);
    }
  }
}

export function checkForNativeUpdate(isManual: boolean = false): void {
  checkForJSUpdate(isManual);
}
