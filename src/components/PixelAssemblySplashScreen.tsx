import React, {useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
  StatusBar,
  Image,
} from 'react-native';
import {Colors} from '../theme/colors';
import {Typography} from '../theme/typography';
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
  // Animation drivers
  const pulseScale = useRef(new Animated.Value(0.1)).current;
  const pulseOpacity = useRef(new Animated.Value(1)).current;

  const dialSpin = useRef(new Animated.Value(0)).current;
  const dialOpacity = useRef(new Animated.Value(0)).current;

  const logoScale = useRef(new Animated.Value(0.65)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;

  const sweepTranslate = useRef(new Animated.Value(-150)).current;
  const sweepOpacity = useRef(new Animated.Value(0)).current;

  const shockwaveScale = useRef(new Animated.Value(0.8)).current;
  const shockwaveOpacity = useRef(new Animated.Value(0)).current;

  const titleTranslateY = useRef(new Animated.Value(25)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;

  const otaSectionOpacity = useRef(new Animated.Value(0)).current;

  // Run the sequence
  useEffect(() => {
    // Continuous dial spin loop
    const spinAnim = Animated.loop(
      Animated.timing(dialSpin, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    spinAnim.start();

    // Stage 1: Singularity Pulse (0 - 600ms)
    Animated.parallel([
      Animated.timing(pulseScale, {
        toValue: 2.8,
        duration: 750,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(pulseOpacity, {
        toValue: 0,
        duration: 750,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(dialOpacity, {
        toValue: 1,
        duration: 800,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Stage 2: Logo Spring Assembly (400ms - 1300ms)
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1.0,
        friction: 6,
        tension: 50,
        delay: 350,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 700,
        delay: 350,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    // Stage 3: Electric Laser Sweep & Shockwave (1100ms - 1700ms)
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(sweepTranslate, {
          toValue: 180,
          duration: 650,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(sweepOpacity, {toValue: 0.9, duration: 250, useNativeDriver: true}),
          Animated.timing(sweepOpacity, {toValue: 0, duration: 400, useNativeDriver: true}),
        ]),
        Animated.timing(shockwaveScale, {
          toValue: 1.6,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(shockwaveOpacity, {toValue: 0.7, duration: 200, useNativeDriver: true}),
          Animated.timing(shockwaveOpacity, {toValue: 0, duration: 500, useNativeDriver: true}),
        ]),
      ]).start();
    }, 1050);

    // Stage 4: Brand Reveal & OTA HUD (1500ms+)
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(titleTranslateY, {
          toValue: 0,
          duration: 550,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 550,
          useNativeDriver: true,
        }),
        Animated.timing(otaSectionOpacity, {
          toValue: 1,
          duration: 450,
          delay: 150,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Safe callback trigger when animation is fully settled
        setTimeout(() => {
          onAnimationComplete?.();
        }, 600);
      });
    }, 1450);

    return () => {
      spinAnim.stop();
    };
  }, [
    dialOpacity,
    dialSpin,
    logoOpacity,
    logoScale,
    onAnimationComplete,
    otaSectionOpacity,
    pulseOpacity,
    pulseScale,
    shockwaveOpacity,
    shockwaveScale,
    sweepOpacity,
    sweepTranslate,
    titleOpacity,
    titleTranslateY,
  ]);

  const spinInterpolation = dialSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const isUpdating =
    progressInfo?.status === 'downloading' ||
    progressInfo?.status === 'verifying';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#040814" />

      {/* Atmospheric Radial Nebula Background */}
      <View style={styles.nebulaGlow} />

      {/* Center Stage: Singularity & Logo */}
      <View style={styles.centerStage}>
        {/* Phase 1: Expanding Cosmic Pulse Wave */}
        <Animated.View
          style={[
            styles.pulseWave,
            {
              transform: [{scale: pulseScale}],
              opacity: pulseOpacity,
            },
          ]}
        />

        {/* Phase 2: Orbiting Dial Glow Ring */}
        <Animated.View
          style={[
            styles.orbitalRing,
            {
              opacity: dialOpacity,
              transform: [{rotate: spinInterpolation}],
            },
          ]}
        >
          {/* Orbiting Satellite Particle */}
          <View style={styles.satelliteParticle} />
          <View style={styles.satelliteParticleOpposite} />
        </Animated.View>

        {/* Phase 3: Shockwave Ring */}
        <Animated.View
          style={[
            styles.shockwaveRing,
            {
              transform: [{scale: shockwaveScale}],
              opacity: shockwaveOpacity,
            },
          ]}
        />

        {/* Master Brand Logo (Floating Authentic Artwork) */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: logoOpacity,
              transform: [{scale: logoScale}],
            },
          ]}
        >
          <Image
            source={require('../assets/attendo_floating_emblem.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />

          {/* Electric Cyan Light Sweep Flare */}
          <Animated.View
            style={[
              styles.lightSweep,
              {
                opacity: sweepOpacity,
                transform: [{translateX: sweepTranslate}, {rotate: '25deg'}],
              },
            ]}
          />
        </Animated.View>
      </View>

      {/* Brand Subtitle / Mission */}
      <Animated.View
        style={[
          styles.brandDetails,
          {
            opacity: titleOpacity,
            transform: [{translateY: titleTranslateY}],
          },
        ]}
      >
        <Text style={styles.brandBadge}>75% ATTENDANCE & CLASS SHIELD</Text>
        <Text style={styles.brandMotto}>Smart College Attendance & Timetable Planner</Text>
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

        {/* Sleek Neon Azure Progress Bar */}
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
  container: {
    flex: 1,
    backgroundColor: '#040814',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nebulaGlow: {
    position: 'absolute',
    width: width * 1.3,
    height: width * 1.3,
    borderRadius: (width * 1.3) / 2,
    backgroundColor: 'rgba(0, 163, 255, 0.05)',
  },
  centerStage: {
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseWave: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: '#00A3FF',
    backgroundColor: 'rgba(0, 163, 255, 0.15)',
  },
  orbitalRing: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    borderStyle: 'dashed',
  },
  satelliteParticle: {
    position: 'absolute',
    top: 15,
    right: 35,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00A3FF',
    shadowColor: '#38BDF8',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 4,
  },
  satelliteParticleOpposite: {
    position: 'absolute',
    bottom: 25,
    left: 45,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#38BDF8',
    opacity: 0.6,
  },
  shockwaveRing: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 2,
    borderColor: '#38BDF8',
  },
  logoContainer: {
    width: 240,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: 230,
    height: 230,
  },
  lightSweep: {
    position: 'absolute',
    top: -50,
    width: 24,
    height: 340,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    shadowColor: '#00E5FF',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 1,
    shadowRadius: 16,
  },
  brandDetails: {
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  brandBadge: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.5,
    color: '#38BDF8',
    textTransform: 'uppercase',
  },
  brandMotto: {
    fontSize: 12,
    color: '#93C5FD',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  otaSection: {
    position: 'absolute',
    bottom: 45,
    width: width - 56,
    backgroundColor: 'rgba(10, 21, 42, 0.85)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(30, 59, 110, 0.8)',
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
    color: '#38BDF8',
  },
  otaPercentage: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#F0F9FF',
  },
  progressBarTrack: {
    width: '100%',
    height: 6,
    backgroundColor: '#040814',
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1E3B6E',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#00A3FF',
    borderRadius: 3,
    shadowColor: '#38BDF8',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  otaMessage: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 8,
    textAlign: 'center',
  },
});
