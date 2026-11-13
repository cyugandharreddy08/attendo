/**
 * Re-export modern enterprise OTA service for full backward compatibility across all screens.
 */
export {
  ModernOTAService,
  checkForJSUpdate,
  checkForNativeUpdate,
  computeRolloutBucket,
} from './ModernOTAService';

export type {
  OTAReleaseManifest,
  OTAStatus,
} from './ModernOTAService';
