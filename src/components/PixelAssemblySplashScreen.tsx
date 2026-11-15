import React, {useEffect, useMemo, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
  StatusBar,
} from 'react-native';
import Svg, {
  Path,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import {Colors} from '../theme/colors';
import {Typography} from '../theme/typography';
import {Spacing} from '../theme/spacing';

const {width} = Dimensions.get('window');

// 11 Columns x 12 Rows Matrix defining the collegiate Attendo Shield & illuminated "A"
// 1 = active glowing 3D voxel, 0 = empty space
const SHIELD_PIXEL_MAP = [
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0], // Row 0: Top Crest rim
  [1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1], // Row 1: Outer corners + Top apex of "A"
  [1, 0, 0, 1, 1, 0, 1, 1, 0, 0, 1], // Row 2: Outer edge + "A" diagonal shoulders
  [1, 0, 1, 1, 0, 0, 0, 1, 1, 0, 1], // Row 3: Outer edge + "A" diagonal arms
  [1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1], // Row 4: Blazing horizontal crossbar of "A"
  [1, 0, 1, 1, 0, 0, 0, 1, 1, 0, 1], // Row 5: Outer edge + "A" lower legs
  [1, 0, 1, 1, 0, 0, 0, 1, 1, 0, 1], // Row 6: Outer edge + "A" feet
  [0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0], // Row 7: Shield curving inward + center pedestal
  [0, 0, 1, 0, 1, 1, 1, 0, 1, 0, 0], // Row 8: Shield curving inward + crest base
  [0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0], // Row 9: Shield lower convergence
  [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0], // Row 10: Shield near tip
  [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0], // Row 11: Single sharp apex diamond
];

const COLS = 11;
const ROWS = 12;
const VOXEL_SIZE = 15;
const VOXEL_GAP = 2;
const VOXEL_PITCH = VOXEL_SIZE + VOXEL_GAP;
const GRID_WIDTH = COLS * VOXEL_PITCH - VOXEL_GAP; // 185
const GRID_HEIGHT = ROWS * VOXEL_PITCH - VOXEL_GAP; // 202

interface VoxelData {
  id: number;
  r: number;
  c: number;
  color: string;
  glowColor: string;
  borderColor: string;
  isCore: boolean;
  delay: number;
  // Precomputed vortex spiral keyframes for native 60FPS driver
  inputRange: number[];
  translateXRange: number[];
  translateYRange: number[];
  scaleRange: number[];
  rotateZRange: string[];
  rotateXRange: string[];
  rotateYRange: string[];
  opacityRange: number[];
}

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

export default function PixelAssemblySplashScreen({
  progressInfo,
  onAnimationComplete,
}: Props) {
  // Center of matrix for relative orbital math
  const cx = (GRID_WIDTH - VOXEL_SIZE) / 2;
  const cy = (GRID_HEIGHT - VOXEL_SIZE) / 2;

  // Build the 64-voxel dataset with pseudo-3D attributes and cosmic vortex trajectories
  const voxels: VoxelData[] = useMemo(() => {
    const list: VoxelData[] = [];
    let id = 0;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (SHIELD_PIXEL_MAP[r][c] === 1) {
          const targetX = c * VOXEL_PITCH;
          const targetY = r * VOXEL_PITCH;
          const relX = targetX - cx;
          const relY = targetY - cy;
          const distFromCenter = Math.sqrt(relX * relX + relY * relY);
          const targetTheta = Math.atan2(relY, relX);

          // Categorize voxel role & electric palette
          const isTopCrest = r === 0;
          const isCrossbar = r === 4 && c >= 2 && c <= 8;
          const isApex = r === 11 && c === 5;
          const isInnerA =
            (r === 1 && c >= 4 && c <= 6) ||
            (r === 2 && (c === 3 || c === 4 || c === 6 || c === 7)) ||
            (r === 3 && (c === 2 || c === 3 || c === 7 || c === 8)) ||
            isCrossbar ||
            ((r === 5 || r === 6) && (c === 2 || c === 3 || c === 7 || c === 8));

          let color = '#8B5CF6';
          let glowColor = '#A855F7';
          let borderColor = 'rgba(168, 85, 247, 0.8)';
          let isCore = false;

          if (isTopCrest) {
            color = c % 2 === 0 ? '#06B6D4' : '#38BDF8';
            glowColor = '#00F0FF';
            borderColor = 'rgba(0, 240, 255, 0.9)';
            isCore = true;
          } else if (isCrossbar) {
            color = c === 5 ? '#FFFFFF' : '#F43F5E';
            glowColor = '#F43F5E';
            borderColor = 'rgba(255, 255, 255, 0.95)';
            isCore = true;
          } else if (isApex) {
            color = '#00F0FF';
            glowColor = '#00F0FF';
            borderColor = '#FFFFFF';
            isCore = true;
          } else if (isInnerA) {
            color = r <= 2 ? '#C084FC' : '#A855F7';
            glowColor = '#C084FC';
            borderColor = 'rgba(255, 255, 255, 0.7)';
            isCore = true;
          } else {
            // Shield outer border gradient from Sky Blue down to Magenta
            const borderColors = [
              '#06B6D4', // 0
              '#38BDF8', // 1
              '#60A5FA', // 2
              '#818CF8', // 3
              '#8B5CF6', // 4
              '#A855F7', // 5
              '#C026D3', // 6
              '#D946EF', // 7
              '#EC4899', // 8
              '#A855F7', // 9
              '#8B5CF6', // 10
              '#00F0FF', // 11
            ];
            color = borderColors[r] || Colors.primary;
            glowColor = '#A855F7';
            borderColor = 'rgba(192, 132, 252, 0.6)';
          }

          // Cosmic vortex physics parameters
          const outerRadius = 190 + distFromCenter * 1.45 + (id % 5) * 18;
          const spiralTurns = 1.7 + ((id * 3) % 4) * 0.3;
          const angleOffset = spiralTurns * 2 * Math.PI;

          // Keyframed orbital path from deep space to exact target slot
          const steps = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
          const translateXRange: number[] = [];
          const translateYRange: number[] = [];

          steps.forEach(t => {
            if (t === 1) {
              translateXRange.push(0);
              translateYRange.push(0);
            } else {
              const r_t = outerRadius * Math.pow(1 - t, 1.35);
              const theta_t = targetTheta - angleOffset * Math.pow(1 - t, 0.88);
              translateXRange.push(Math.round(r_t * Math.cos(theta_t) * 10) / 10);
              translateYRange.push(Math.round(r_t * Math.sin(theta_t) * 10) / 10);
            }
          });

          // Staggered gravitational delay: outer crest & walls first, electric "A" core slams in last
          let delay = 0;
          if (isInnerA) {
            delay = 280 + (((c - 2) * 25 + r * 20) % 290);
          } else {
            delay = ((c * 18 + r * 16) % 260);
          }

          list.push({
            id,
            r,
            c,
            color,
            glowColor,
            borderColor,
            isCore,
            delay,
            inputRange: steps,
            translateXRange,
            translateYRange,
            scaleRange: [0.15, 0.7, 1.32, 1.18, 1.06, 1.0],
            rotateZRange: [
              `${Math.round(spiralTurns * 360)}deg`,
              `${Math.round(spiralTurns * 260)}deg`,
              `${Math.round(spiralTurns * 160)}deg`,
              '75deg',
              '20deg',
              '0deg',
            ],
            rotateXRange: ['65deg', '48deg', '32deg', '18deg', '8deg', '0deg'],
            rotateYRange: ['55deg', '40deg', '25deg', '14deg', '6deg', '0deg'],
            opacityRange: [0, 0.75, 0.95, 1, 1, 1],
          });

          id++;
        }
      }
    }
    return list;
  }, [cx, cy]);

  // Master Animation Hooks
  const voxelAnims = useRef<Animated.Value[]>(
    voxels.map(() => new Animated.Value(0)),
  ).current;

  // Staged Reveal Animators
  const logoImpactScale = useRef(new Animated.Value(0.92)).current;
  const logoIdleBreath = useRef(new Animated.Value(1)).current;
  const emblemOpacity = useRef(new Animated.Value(0)).current;
  const shockwave1 = useRef(new Animated.Value(0)).current;
  const shockwave2 = useRef(new Animated.Value(0)).current;
  const laserSweepAnim = useRef(new Animated.Value(0)).current;
  const ambientGlowAnim = useRef(new Animated.Value(0)).current;

  // Stage 4 Brand & HUD Animators
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(24)).current;
  const hudOpacity = useRef(new Animated.Value(0)).current;
  const pulseLedAnim = useRef(new Animated.Value(0.4)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Run the Cinematic 4-Stage Experience
  useEffect(() => {
    let isMounted = true;
    let breathLoop: Animated.CompositeAnimation | null = null;
    let ledLoop: Animated.CompositeAnimation | null = null;

    // Stage 1 & 2: Staggered Cosmic Voxel Vortex Swirl & Spring Snap
    const convergenceAnimations = voxels.map(v =>
      Animated.sequence([
        Animated.delay(v.delay),
        Animated.spring(voxelAnims[v.id], {
          toValue: 1,
          tension: 60,
          friction: 6,
          useNativeDriver: true,
        }),
      ]),
    );

    // Continuous LED heartbeat
    ledLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseLedAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulseLedAnim, {
          toValue: 0.35,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    ledLoop.start();

    // Trigger Convergence
    Animated.parallel(convergenceAnimations).start(() => {
      if (!isMounted) return;

      // Stage 3: Core Fusion Shockwave, Neon Laser Sweep & Shield Emblem Lock
      Animated.parallel([
        // Recoil Impact Pulse
        Animated.sequence([
          Animated.timing(logoImpactScale, {
            toValue: 1.15,
            duration: 160,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.spring(logoImpactScale, {
            toValue: 1,
            tension: 70,
            friction: 5,
            useNativeDriver: true,
          }),
        ]),
        // Shockwave 1 (Violet energy blast)
        Animated.timing(shockwave1, {
          toValue: 1,
          duration: 620,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        // Shockwave 2 (Cyan pulse blast, staggered)
        Animated.sequence([
          Animated.delay(80),
          Animated.timing(shockwave2, {
            toValue: 1,
            duration: 650,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        // Neon Laser Light Sweep
        Animated.timing(laserSweepAnim, {
          toValue: 1,
          duration: 520,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
        // Shield Emblem Fusion Resolve
        Animated.timing(emblemOpacity, {
          toValue: 1,
          duration: 440,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        // Ambient Neon Nebula Rise
        Animated.timing(ambientGlowAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (!isMounted) return;

        // Stage 4: Brand Reveal & OTA HUD Entrance
        Animated.parallel([
          Animated.timing(titleOpacity, {
            toValue: 1,
            duration: 380,
            useNativeDriver: true,
          }),
          Animated.spring(titleTranslateY, {
            toValue: 0,
            tension: 55,
            friction: 6,
            useNativeDriver: true,
          }),
          Animated.timing(hudOpacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start(() => {
          if (!isMounted) return;

          // Start idle ambient breathing aura
          breathLoop = Animated.loop(
            Animated.sequence([
              Animated.timing(logoIdleBreath, {
                toValue: 1.035,
                duration: 1900,
                easing: Easing.inOut(Easing.sin),
                useNativeDriver: true,
              }),
              Animated.timing(logoIdleBreath, {
                toValue: 1.0,
                duration: 1900,
                easing: Easing.inOut(Easing.sin),
                useNativeDriver: true,
              }),
            ]),
          );
          breathLoop.start();

          // Signal completion to coordinator
          if (onAnimationComplete) {
            onAnimationComplete();
          }
        });
      });
    });

    return () => {
      isMounted = false;
      if (breathLoop) breathLoop.stop();
      if (ledLoop) ledLoop.stop();
    };
  }, [
    voxels,
    voxelAnims,
    logoImpactScale,
    logoIdleBreath,
    emblemOpacity,
    shockwave1,
    shockwave2,
    laserSweepAnim,
    ambientGlowAnim,
    titleOpacity,
    titleTranslateY,
    hudOpacity,
    pulseLedAnim,
    onAnimationComplete,
  ]);

  // Animate OTA Progress smoothly
  useEffect(() => {
    const target = progressInfo?.percentage ?? 100;
    Animated.timing(progressAnim, {
      toValue: target,
      duration: 320,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [progressInfo?.percentage, progressAnim]);

  // Interpolations
  const progressBarWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const laserSweepTranslateX = laserSweepAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-240, 240],
  });

  const laserSweepOpacity = laserSweepAnim.interpolate({
    inputRange: [0, 0.15, 0.85, 1],
    outputRange: [0, 1, 0.9, 0],
  });

  const shockwave1Scale = shockwave1.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 2.7],
  });
  const shockwave1Opacity = shockwave1.interpolate({
    inputRange: [0, 0.1, 1],
    outputRange: [0, 0.95, 0],
  });

  const shockwave2Scale = shockwave2.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 3.3],
  });
  const shockwave2Opacity = shockwave2.interpolate({
    inputRange: [0, 0.1, 1],
    outputRange: [0, 0.85, 0],
  });

  const ambientGlowOpacity = ambientGlowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15, 0.75],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#05050A" />

      {/* Cosmic Nebula Glow */}
      <Animated.View
        style={[
          styles.ambientNebula,
          {
            opacity: ambientGlowOpacity,
            transform: [{scale: logoIdleBreath}],
          },
        ]}
      />

      {/* Dual Radial Energy Shockwave Rings */}
      <Animated.View
        style={[
          styles.shockwaveRing,
          {
            borderColor: '#8B5CF6',
            shadowColor: '#8B5CF6',
            opacity: shockwave1Opacity,
            transform: [{scale: shockwave1Scale}],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.shockwaveRing,
          {
            borderColor: '#00F0FF',
            shadowColor: '#00F0FF',
            opacity: shockwave2Opacity,
            transform: [{scale: shockwave2Scale}],
          },
        ]}
      />

      {/* Main Shield & Voxel Assembly Rig */}
      <Animated.View
        style={[
          styles.logoAssemblyContainer,
          {
            width: GRID_WIDTH,
            height: GRID_HEIGHT,
            transform: [{scale: logoImpactScale}],
          },
        ]}>
        <Animated.View
          style={[
            styles.logoSubContainer,
            {
              width: GRID_WIDTH,
              height: GRID_HEIGHT,
              transform: [{scale: logoIdleBreath}],
            },
          ]}>
          {/* Assembling 3D Voxels */}
          {voxels.map(v => {
            const anim = voxelAnims[v.id];
            if (!anim) return null;

            const translateX = anim.interpolate({
              inputRange: v.inputRange,
              outputRange: v.translateXRange,
            });
            const translateY = anim.interpolate({
              inputRange: v.inputRange,
              outputRange: v.translateYRange,
            });
            const scale = anim.interpolate({
              inputRange: v.inputRange,
              outputRange: v.scaleRange,
            });
            const rotateZ = anim.interpolate({
              inputRange: v.inputRange,
              outputRange: v.rotateZRange,
            });
            const rotateX = anim.interpolate({
              inputRange: v.inputRange,
              outputRange: v.rotateXRange,
            });
            const rotateY = anim.interpolate({
              inputRange: v.inputRange,
              outputRange: v.rotateYRange,
            });
            const opacity = anim.interpolate({
              inputRange: v.inputRange,
              outputRange: v.opacityRange,
            });

            return (
              <Animated.View
                key={v.id}
                style={[
                  styles.voxelWrapper,
                  {
                    left: v.c * VOXEL_PITCH,
                    top: v.r * VOXEL_PITCH,
                    width: VOXEL_SIZE,
                    height: VOXEL_SIZE,
                    opacity,
                    transform: [
                      {perspective: 600},
                      {translateX},
                      {translateY},
                      {scale},
                      {rotateZ},
                      {rotateX},
                      {rotateY},
                    ],
                  },
                ]}>
                <View
                  style={[
                    styles.voxelBody,
                    {
                      backgroundColor: v.color,
                      borderColor: v.borderColor,
                      shadowColor: v.glowColor,
                    },
                  ]}>
                  {/* Beveled Top-Light Reflection */}
                  <View style={styles.voxelTopHighlight} />
                  {/* Beveled Left-Light Reflection */}
                  <View style={styles.voxelLeftHighlight} />
                  {/* Specular Core Pip for Key Center Voxels */}
                  {v.isCore && <View style={styles.voxelCoreSpec} />}
                  {/* Bottom Bevel Shadow */}
                  <View style={styles.voxelBottomShadow} />
                </View>
              </Animated.View>
            );
          })}

          {/* Polished High-Tech Attendo Shield Emblem (Fuses in Stage 3) */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.emblemOverlay,
              {
                width: GRID_WIDTH,
                height: GRID_HEIGHT,
                opacity: emblemOpacity,
              },
            ]}>
            <Svg width={GRID_WIDTH} height={GRID_HEIGHT} viewBox="0 0 185 202">
              <Defs>
                <SvgGradient id="shieldBg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#1E1035" stopOpacity="0.88" />
                  <Stop offset="60%" stopColor="#0F0C20" stopOpacity="0.92" />
                  <Stop offset="100%" stopColor="#080714" stopOpacity="0.95" />
                </SvgGradient>

                <SvgGradient id="neonRim" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#00F0FF" />
                  <Stop offset="30%" stopColor="#818CF8" />
                  <Stop offset="70%" stopColor="#C084FC" />
                  <Stop offset="100%" stopColor="#EC4899" />
                </SvgGradient>

                <SvgGradient id="aCore" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor="#FFFFFF" />
                  <Stop offset="25%" stopColor="#F472B6" />
                  <Stop offset="65%" stopColor="#A855F7" />
                  <Stop offset="100%" stopColor="#7C3AED" />
                </SvgGradient>
              </Defs>

              {/* Outer Collegiate Shield Crest Body */}
              <Path
                d="M 17 2 L 168 2 Q 183 2 183 17 L 183 100 Q 183 154 92.5 198 Q 2 154 2 100 L 2 17 Q 2 2 17 2 Z"
                fill="url(#shieldBg)"
                stroke="url(#neonRim)"
                strokeWidth="2.5"
              />

              {/* Inner High-Tech Energy Tracing */}
              <Path
                d="M 22 8 L 163 8 Q 175 8 175 20 L 175 96 Q 175 145 92.5 188 Q 10 145 10 96 L 10 20 Q 10 8 22 8 Z"
                fill="none"
                stroke="#00F0FF"
                strokeWidth="1"
                strokeOpacity="0.45"
                strokeDasharray="4 3"
              />

              {/* Bold Illuminated Attendo "A" */}
              <Path
                d="M 80 20 L 105 20 L 144 112 L 123 112 L 112 87 L 73 87 L 62 112 L 41 112 L 80 20 Z M 92.5 38 L 105 72 L 80 72 Z"
                fill="url(#aCore)"
                fillRule="evenodd"
                stroke="#FFFFFF"
                strokeWidth="1.2"
                strokeOpacity="0.9"
              />

              {/* Blazing Cyan Laser Power Crossbar */}
              <Path
                d="M 68 80 L 117 80"
                stroke="#00F0FF"
                strokeWidth="3.5"
                strokeLinecap="round"
              />

              {/* Subtle Holographic 75% Watermark Aura */}
              <SvgText
                x="92.5"
                y="148"
                fill="#00F0FF"
                fontSize="15"
                fontWeight="900"
                letterSpacing="2.5"
                textAnchor="middle">
                75%
              </SvgText>
              <SvgText
                x="92.5"
                y="162"
                fill="#C084FC"
                fontSize="7.5"
                fontWeight="800"
                letterSpacing="2"
                textAnchor="middle">
                ATTENDO SHIELD
              </SvgText>
            </Svg>
          </Animated.View>

          {/* Neon Laser Light Sweep (Stage 3) */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.laserSweepMask,
              {
                width: GRID_WIDTH,
                height: GRID_HEIGHT,
              },
            ]}>
            <Animated.View
              style={[
                styles.laserBeam,
                {
                  opacity: laserSweepOpacity,
                  transform: [
                    {rotateZ: '26deg'},
                    {translateX: laserSweepTranslateX},
                  ],
                },
              ]}>
              <View style={styles.laserBeamCore} />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </Animated.View>

      {/* Stage 4: Attendo Brand Typography Reveal */}
      <Animated.View
        style={[
          styles.titleContainer,
          {
            opacity: titleOpacity,
            transform: [{translateY: titleTranslateY}],
          },
        ]}>
        <View style={styles.badgeRow}>
          <View style={styles.badgeLine} />
          <Text style={styles.badgeText}>AUTHENTIC SMART SHIELD</Text>
          <View style={styles.badgeLine} />
        </View>

        <Text style={styles.brandTitle}>ATTENDO</Text>

        <View style={styles.subtitleRow}>
          <View style={styles.subIconDot} />
          <Text style={styles.brandSubtitle}>75% Attendance & Task Shield</Text>
          <View style={styles.subIconDot} />
        </View>
      </Animated.View>

      {/* Stage 4: Sleek Futuristic OTA Progress HUD */}
      <Animated.View style={[styles.otaSection, {opacity: hudOpacity}]}>
        <View style={styles.otaHeaderRow}>
          <View style={styles.otaStatusGroup}>
            <Animated.View
              style={[
                styles.otaPulseLed,
                {
                  opacity: pulseLedAnim,
                  backgroundColor:
                    progressInfo?.status === 'downloading'
                      ? '#F59E0B'
                      : progressInfo?.status === 'ready'
                      ? '#22C55E'
                      : '#00F0FF',
                },
              ]}
            />
            <Text style={styles.otaStatusBadge}>
              {progressInfo?.status === 'downloading'
                ? '⚡ DOWNLOADING OTA UPDATE'
                : progressInfo?.status === 'verifying'
                ? '🔐 VERIFYING RSA SIGNATURE'
                : progressInfo?.status === 'ready'
                ? '🚀 ACTIVATING UPDATE'
                : '⚡ INITIALIZING ATTENDO ENGINE'}
            </Text>
          </View>

          <Text style={styles.otaPercentage}>
            {progressInfo?.percentage != null
              ? `${Math.round(progressInfo.percentage)}%`
              : '100%'}
          </Text>
        </View>

        {/* Dual-Glow Progress Bar Track */}
        <View style={styles.progressBarTrack}>
          <Animated.View
            style={[styles.progressBarFill, {width: progressBarWidth}]}
          />
        </View>

        {/* Dynamic Telemetry / Status Message */}
        <Text style={styles.otaMessage} numberOfLines={1}>
          {progressInfo?.message ||
            'Synchronizing timetable, attendance buffers & local storage...'}
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
  ambientNebula: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#8B5CF6',
    top: '28%',
    shadowColor: '#8B5CF6',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.9,
    shadowRadius: 80,
    elevation: 25,
  },
  shockwaveRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2.5,
    top: '34%',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 15,
  },
  logoAssemblyContainer: {
    position: 'relative',
    marginBottom: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#A855F7',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.85,
    shadowRadius: 30,
    elevation: 20,
  },
  logoSubContainer: {
    position: 'relative',
  },
  voxelWrapper: {
    position: 'absolute',
  },
  voxelBody: {
    flex: 1,
    borderRadius: 3.5,
    borderWidth: 1,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.85,
    shadowRadius: 6,
    elevation: 5,
    overflow: 'hidden',
  },
  voxelTopHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  voxelLeftHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
  },
  voxelBottomShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  voxelCoreSpec: {
    position: 'absolute',
    top: '30%',
    left: '30%',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    opacity: 0.95,
  },
  emblemOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    shadowColor: '#8B5CF6',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.9,
    shadowRadius: 20,
    elevation: 15,
  },
  laserSweepMask: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
    borderRadius: 16,
  },
  laserBeam: {
    position: 'absolute',
    top: -50,
    left: GRID_WIDTH / 2 - 16,
    width: 32,
    height: GRID_HEIGHT + 100,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  laserBeamCore: {
    width: 4,
    height: '100%',
    backgroundColor: '#FFFFFF',
    shadowColor: '#00F0FF',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 10,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  badgeLine: {
    width: 20,
    height: 1,
    backgroundColor: 'rgba(139, 92, 246, 0.4)',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#A78BFA',
    letterSpacing: 2.5,
    marginHorizontal: 8,
  },
  brandTitle: {
    ...Typography.h1,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 7,
    color: '#FFFFFF',
    textShadowColor: 'rgba(139, 92, 246, 0.9)',
    textShadowOffset: {width: 0, height: 2},
    textShadowRadius: 18,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  subIconDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#00F0FF',
    marginHorizontal: 8,
    shadowColor: '#00F0FF',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  brandSubtitle: {
    ...Typography.body2,
    color: '#C4B5FD',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.8,
  },
  otaSection: {
    position: 'absolute',
    bottom: 46,
    width: width - 60,
    alignItems: 'center',
  },
  otaHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 7,
  },
  otaStatusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  otaPulseLed: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 7,
    shadowColor: '#00F0FF',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 1,
    shadowRadius: 5,
    elevation: 3,
  },
  otaStatusBadge: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#E0E7FF',
  },
  otaPercentage: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#00F0FF',
    fontVariant: ['tabular-nums'],
  },
  progressBarTrack: {
    width: '100%',
    height: 6,
    backgroundColor: '#0F0F1A',
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#232338',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#8B5CF6',
    borderRadius: 3,
    shadowColor: '#00F0FF',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 5,
  },
  otaMessage: {
    fontSize: 10.5,
    color: '#71717A',
    marginTop: 8,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
});
