import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
  StatusBar,
} from 'react-native';
import {Colors} from '../theme/colors';
import {Typography} from '../theme/typography';
import {Spacing} from '../theme/spacing';

const {width} = Dimensions.get('window');

// 6x6 Matrix defining the Attendo Shield "A" Pixel Map
// 1 = active glowing pixel voxel, 0 = empty space
const SHIELD_PIXEL_MAP = [
  [0, 1, 1, 1, 1, 0], // Row 0: Top shield crest
  [1, 1, 0, 0, 1, 1], // Row 1: Upper shoulders
  [1, 1, 1, 1, 1, 1], // Row 2: "A" peak & upper cross
  [1, 1, 0, 0, 1, 1], // Row 3: "A" hollow center window
  [0, 1, 1, 1, 1, 0], // Row 4: "A" lower crossbar
  [0, 0, 1, 1, 0, 0], // Row 5: Shield apex point
];

interface PixelDef {
  id: number;
  r: number;
  c: number;
  startX: number;
  startY: number;
  startScale: number;
  startRotate: number;
  delay: number;
}

export interface OTAProgressInfo {
  status: 'checking' | 'downloading' | 'verifying' | 'ready' | 'none';
  percentage: number; // 0 - 100
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
  const [pixels, setPixels] = useState<PixelDef[]>([]);
  const animValues = useRef<Animated.Value[]>([]);
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const logoGlow = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(20)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Generate initial pixel coordinates scattered across pseudo-3D space
  useEffect(() => {
    const list: PixelDef[] = [];
    let counter = 0;

    for (let r = 0; r < SHIELD_PIXEL_MAP.length; r++) {
      for (let c = 0; c < SHIELD_PIXEL_MAP[r].length; c++) {
        if (SHIELD_PIXEL_MAP[r][c] === 1) {
          // Angle and distance to scatter outward in 3D
          const angle = Math.random() * Math.PI * 2;
          const dist = 120 + Math.random() * 180;
          list.push({
            id: counter,
            r,
            c,
            startX: Math.cos(angle) * dist,
            startY: Math.sin(angle) * dist - 30,
            startScale: 0.1 + Math.random() * 1.5,
            startRotate: (Math.random() - 0.5) * 360,
            delay: Math.random() * 350,
          });
          animValues.current[counter] = new Animated.Value(0);
          counter++;
        }
      }
    }
    setPixels(list);
  }, []);

  // Run 3D Pixel Assembly Convergence Sequence
  useEffect(() => {
    if (pixels.length === 0) return;

    // 1. Staggered converging springs for all pixels
    const convergeAnimations = pixels.map(p =>
      Animated.sequence([
        Animated.delay(p.delay),
        Animated.spring(animValues.current[p.id], {
          toValue: 1,
          friction: 6,
          tension: 45,
          useNativeDriver: true,
        }),
      ])
    );

    Animated.parallel(convergeAnimations).start(() => {
      // 2. Convergence shockwave: entire assembled shield pulses with glowing neon aura
      Animated.parallel([
        Animated.sequence([
          Animated.timing(logoScale, {
            toValue: 1.12,
            duration: 250,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.spring(logoScale, {
            toValue: 1,
            friction: 4,
            tension: 50,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(logoGlow, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.parallel([
          Animated.timing(titleOpacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(titleTranslateY, {
            toValue: 0,
            duration: 400,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        if (onAnimationComplete) {
          onAnimationComplete();
        }
      });
    });
  }, [pixels, logoScale, logoGlow, titleOpacity, titleTranslateY, onAnimationComplete]);

  // Animate progress bar smoothly whenever progressInfo changes
  useEffect(() => {
    const target = progressInfo?.percentage ?? 100;
    Animated.timing(progressAnim, {
      toValue: target,
      duration: 350,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [progressInfo?.percentage, progressAnim]);

  const PIXEL_SIZE = 22;
  const GRID_WIDTH = 6 * PIXEL_SIZE;
  const GRID_HEIGHT = 6 * PIXEL_SIZE;

  const progressBarWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const glowOpacity = logoGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.8],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#05050A" />

      {/* Ambient Radial Gradient Background */}
      <Animated.View style={[styles.ambientGlow, {opacity: glowOpacity}]} />

      {/* 3D Assembled Pixel Shield Logo */}
      <Animated.View
        style={[
          styles.logoAssemblyContainer,
          {
            width: GRID_WIDTH,
            height: GRID_HEIGHT,
            transform: [{scale: logoScale}],
          },
        ]}>
        {pixels.map(p => {
          const progress = animValues.current[p.id];
          if (!progress) return null;

          const translateX = progress.interpolate({
            inputRange: [0, 1],
            outputRange: [p.startX, 0],
          });
          const translateY = progress.interpolate({
            inputRange: [0, 1],
            outputRange: [p.startY, 0],
          });
          const scale = progress.interpolate({
            inputRange: [0, 1],
            outputRange: [p.startScale, 1],
          });
          const rotate = progress.interpolate({
            inputRange: [0, 1],
            outputRange: [`${p.startRotate}deg`, '0deg'],
          });
          const opacity = progress.interpolate({
            inputRange: [0, 0.2, 1],
            outputRange: [0, 0.6, 1],
          });

          // Palette gradient mapping across rows
          const rowColors = [
            '#A855F7', // top light purple
            '#9333EA', // purple
            '#7C3AED', // violet
            '#8B5CF6', // neon primary
            '#C026D3', // fuchsia
            '#DB2777', // pink base
          ];
          const pixelColor = rowColors[p.r] || Colors.primary;

          return (
            <Animated.View
              key={p.id}
              style={[
                styles.pixelVoxel,
                {
                  left: p.c * PIXEL_SIZE,
                  top: p.r * PIXEL_SIZE,
                  width: PIXEL_SIZE - 2,
                  height: PIXEL_SIZE - 2,
                  backgroundColor: pixelColor,
                  opacity,
                  transform: [
                    {translateX},
                    {translateY},
                    {scale},
                    {rotateZ: rotate},
                  ],
                },
              ]}>
              {/* Pseudo-3D Bevel Highlight */}
              <View style={styles.voxelHighlight} />
            </Animated.View>
          );
        })}
      </Animated.View>

      {/* Attendo Brand Titles */}
      <Animated.View
        style={[
          styles.titleContainer,
          {
            opacity: titleOpacity,
            transform: [{translateY: titleTranslateY}],
          },
        ]}>
        <Text style={styles.brandTitle}>ATTENDO</Text>
        <Text style={styles.brandSubtitle}>75% Attendance & Task Shield</Text>
      </Animated.View>

      {/* Dynamic OTA Update & Loading Progress Bar Section */}
      <Animated.View style={[styles.otaSection, {opacity: titleOpacity}]}>
        <View style={styles.otaHeaderRow}>
          <Text style={styles.otaStatusBadge}>
            {progressInfo?.status === 'downloading'
              ? '⚡ DOWNLOADING OTA UPDATE'
              : progressInfo?.status === 'verifying'
              ? '🔐 VERIFYING RSA SIGNATURE'
              : progressInfo?.status === 'ready'
              ? '🚀 ACTIVATING UPDATE'
              : '⚡ STARTING ATTENDO'}
          </Text>
          <Text style={styles.otaPercentage}>
            {progressInfo?.percentage != null ? `${Math.round(progressInfo.percentage)}%` : '100%'}
          </Text>
        </View>

        {/* Glowing Progress Track */}
        <View style={styles.progressBarTrack}>
          <Animated.View style={[styles.progressBarFill, {width: progressBarWidth}]} />
        </View>

        <Text style={styles.otaMessage}>
          {progressInfo?.message || 'Synchronizing database and local schedules...'}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05050A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ambientGlow: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#8B5CF6',
    top: '32%',
    transform: [{scale: 1.6}],
    shadowColor: '#8B5CF6',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.9,
    shadowRadius: 60,
    elevation: 20,
    opacity: 0.3,
  },
  logoAssemblyContainer: {
    position: 'relative',
    marginBottom: Spacing.xl,
    shadowColor: '#A855F7',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.8,
    shadowRadius: 25,
    elevation: 15,
  },
  pixelVoxel: {
    position: 'absolute',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#8B5CF6',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.7,
    shadowRadius: 6,
    elevation: 4,
    overflow: 'hidden',
  },
  voxelHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  brandTitle: {
    ...Typography.h1,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 6,
    color: '#FFFFFF',
    textShadowColor: 'rgba(139, 92, 246, 0.8)',
    textShadowOffset: {width: 0, height: 2},
    textShadowRadius: 15,
  },
  brandSubtitle: {
    ...Typography.body2,
    color: '#9494B8',
    letterSpacing: 1.5,
    marginTop: 4,
  },
  otaSection: {
    position: 'absolute',
    bottom: 50,
    width: width - 64,
    alignItems: 'center',
  },
  otaHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 6,
  },
  otaStatusBadge: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#C4B5FD',
  },
  otaPercentage: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#F4F4FF',
  },
  progressBarTrack: {
    width: '100%',
    height: 6,
    backgroundColor: '#161626',
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2D2D46',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#8B5CF6',
    borderRadius: 3,
    shadowColor: '#A855F7',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  otaMessage: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
});
