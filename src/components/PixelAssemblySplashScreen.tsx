import React, {useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
  StatusBar,
} from 'react-native';
import {Spacing} from '../theme/spacing';

const {width} = Dimensions.get('window');

export interface OTAProgressInfo {
  status: 'checking' | 'downloading' | 'verifying' | 'ready' | 'none';
  percentage: number;
  message: string;
  version?: string;
  bytesReceived?: number;
  totalBytes?: number;
}

interface Props {
  progressInfo?: OTAProgressInfo;
  onAnimationComplete?: () => void;
}

export default function PixelAssemblySplashScreen({progressInfo, onAnimationComplete}: Props) {
  // 7.0.0 Multi-Phase Cinematic Animation Values
  const ringRotate = useRef(new Animated.Value(0)).current;
  const pulseScale = useRef(new Animated.Value(0.4)).current;
  const logoScale = useRef(new Animated.Value(0.1)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(30)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const otaSectionOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Cyber Ring Continuous Rotation (3000ms loop)
    const spinAnim = Animated.loop(
      Animated.timing(ringRotate, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    spinAnim.start();

    // 2. Multi-Phase Portal & Emblem Reveal Sequence (7.0.0 Classic)
    Animated.sequence([
      // Phase 1: Electric Pulse Expand
      Animated.timing(pulseScale, {
        toValue: 1.2,
        duration: 500,
        useNativeDriver: true,
      }),
      // Phase 2: Logo Spring Zoom & Fade
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      // Phase 3: Title Slide Up & OTA HUD Fade In
      Animated.parallel([
        Animated.timing(titleTranslateY, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(otaSectionOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      // Allow animation to settle cleanly before notifying parent
      setTimeout(() => {
        onAnimationComplete?.();
      }, 500);
    });

    return () => {
      spinAnim.stop();
    };
  }, [
    logoOpacity,
    logoScale,
    onAnimationComplete,
    otaSectionOpacity,
    pulseScale,
    ringRotate,
    titleOpacity,
    titleTranslateY,
  ]);

  const spin = ringRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const isUpdating =
    progressInfo?.status === 'downloading' ||
    progressInfo?.status === 'verifying';

  return (
    <View style={styles.splashContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#05050A" />

      {/* Ambient Pulsing Glow Circle */}
      <Animated.View
        style={[
          styles.glowCircle,
          {transform: [{scale: pulseScale}]},
        ]}
      />

      {/* Rotating Cyber Ring */}
      <Animated.View
        style={[
          styles.cyberRing,
          {transform: [{rotate: spin}]},
        ]}
      />

      {/* 3D Shield Emblem Logo */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: logoOpacity,
            transform: [{scale: logoScale}],
          },
        ]}>
        <View style={styles.shieldBadge}>
          <Text style={styles.shieldText}>A</Text>
        </View>
      </Animated.View>

      {/* ATTENDO Title Slide Up */}
      <Animated.View
        style={[
          styles.titleContainer,
          {
            opacity: titleOpacity,
            transform: [{translateY: titleTranslateY}],
          },
        ]}>
        <Text style={styles.splashTitle}>ATTENDO</Text>
        <Text style={styles.splashSubtitle}>75% ATTENDANCE & TASK SHIELD</Text>
      </Animated.View>

      {/* OTA Live Progress & Update HUD */}
      <Animated.View style={[styles.otaSection, {opacity: otaSectionOpacity}]}>
        <View style={styles.otaHeaderRow}>
          <Text style={styles.otaStatusBadge}>
            {progressInfo?.status === 'downloading'
              ? '⚡ DOWNLOADING UPDATE'
              : progressInfo?.status === 'verifying'
              ? '🛡️ VERIFYING ASSETS'
              : progressInfo?.status === 'ready'
              ? '✨ UPDATE READY'
              : '🚀 INITIALIZING ATTENDO'}
          </Text>
          {isUpdating && progressInfo?.percentage !== undefined && (
            <Text style={styles.otaPercentage}>{Math.round(progressInfo.percentage)}%</Text>
          )}
        </View>

        {/* 7.0.0 Electric Purple Progress Bar Track */}
        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: isUpdating && progressInfo?.percentage !== undefined
                  ? `${Math.max(8, progressInfo.percentage)}%`
                  : '100%',
              },
            ]}
          />
        </View>

        <Text style={styles.otaMessage} numberOfLines={1}>
          {progressInfo?.message || 'Syncing your schedule and attendance records...'}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: '#05050A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowCircle: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(139, 92, 246, 0.25)',
  },
  cyberRing: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 2,
    borderColor: 'rgba(6, 182, 212, 0.5)',
    borderStyle: 'dashed',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  shieldBadge: {
    width: 100,
    height: 100,
    borderRadius: 30,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 15,
    borderWidth: 2,
    borderColor: '#06B6D4',
  },
  shieldText: {
    fontSize: 54,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  titleContainer: {
    alignItems: 'center',
  },
  splashTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: '#F0F0FF',
    letterSpacing: 4,
  },
  splashSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8B5CF6',
    letterSpacing: 1.5,
    marginTop: 6,
    textTransform: 'uppercase',
  },
  otaSection: {
    position: 'absolute',
    bottom: 45,
    width: width - 56,
    backgroundColor: 'rgba(16, 16, 26, 0.92)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.35)',
  },
  otaHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  otaStatusBadge: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#A855F7',
  },
  otaPercentage: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#F0F0FF',
  },
  progressBarTrack: {
    width: '100%',
    height: 6,
    backgroundColor: '#05050A',
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#8B5CF6',
    borderRadius: 3,
    shadowColor: '#A855F7',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  otaMessage: {
    fontSize: 11,
    color: '#9494B8',
    marginTop: 8,
    textAlign: 'center',
  },
});
