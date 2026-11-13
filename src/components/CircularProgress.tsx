import React, {useEffect, useRef} from 'react';
import {View, Text, StyleSheet, Animated, Easing} from 'react-native';
import Svg, {Circle, Defs, LinearGradient, Stop} from 'react-native-svg';
import {Colors} from '../theme/colors';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface CircularProgressProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  backgroundColor?: string;
  showLabel?: boolean;
  centerText?: string;
  centerSubText?: string;
}

export default function CircularProgress({
  percent,
  size = 100,
  strokeWidth = 10,
  color = Colors.present,
  backgroundColor = 'rgba(255, 255, 255, 0.06)',
  showLabel = true,
  centerText,
  centerSubText,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPercent = Math.max(0, Math.min(100, percent));

  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: clampedPercent,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [clampedPercent, anim]);

  const strokeDashoffset = anim.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });

  const ringColor =
    clampedPercent >= 75
      ? '#22C55E'
      : clampedPercent >= 50
      ? '#F59E0B'
      : '#EF4444';

  const displayColor = color !== Colors.present ? color : ringColor;
  const gradientId = `grad_${size}_${displayColor.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <View style={[styles.container, {width: size, height: size}]}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={displayColor} stopOpacity="1" />
            <Stop offset="100%" stopColor="#A855F7" stopOpacity="0.85" />
          </LinearGradient>
        </Defs>

        {/* Background track ring */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Animated Progress ring */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>

      {showLabel && (
        <View style={styles.centerContent}>
          <Text style={[styles.percentText, {color: displayColor}]}>
            {centerText ?? `${clampedPercent}%`}
          </Text>
          {centerSubText ? (
            <Text style={styles.subText}>{centerSubText}</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  centerContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentText: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subText: {
    fontSize: 10,
    color: '#8E8EA8',
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
  },
});
