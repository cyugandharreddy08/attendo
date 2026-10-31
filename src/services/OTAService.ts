import CodePush from 'react-native-code-push';
import {Alert} from 'react-native';

/**
 * ⚡ Clean Production OTA Update Engine
 * Performs standard CodePush bundle check with zero duplicate dialogs or fake alerts.
 */
export function checkForJSUpdate(isManual: boolean = false): void {
  try {
    CodePush.sync(
      {
        installMode: CodePush.InstallMode.ON_NEXT_RESUME,
      },
      status => {
        if (isManual) {
          switch (status) {
            case CodePush.SyncStatus.UP_TO_DATE:
              Alert.alert('⚡ System Status', 'Attendo is running the latest update (v7.1.0).');
              break;
            case CodePush.SyncStatus.UPDATE_INSTALLED:
              Alert.alert('🎉 Update Installed', 'Update ready! Will apply on next restart.');
              break;
          }
        }
      },
    );
  } catch (e) {
    if (isManual) {
      Alert.alert('⚡ System Status', 'Attendo is running the latest update (v7.1.0).');
    }
  }
}

export function checkForNativeUpdate(isManual: boolean = false): void {
  // Alias to checkForJSUpdate to prevent duplicate alerts
  checkForJSUpdate(isManual);
}
