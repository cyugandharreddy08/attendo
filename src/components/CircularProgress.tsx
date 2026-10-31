import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import Svg, {Circle, Defs, LinearGradient, Stop} from 'react-native-svg';
import {Colors} from '../theme/colors';

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
  backgroundColor = Colors.surface,
  showLabel = true,
  centerText,
  centerSubText,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPercent = Math.max(0, Math.min(100, percent));
  const strokeDashoffset = circumference - (clampedPercent / 100) * circumference;

  const ringColor =
    clampedPercent >= 75
      ? Colors.present
      : clampedPercent >= 50
      ? Colors.cancelled
      : Colors.absent;

  const displayColor = color !== Colors.present ? color : ringColor;

  return (
    <View style={[styles.container, {width: size, height: size}]}>
      <Svg width={size} height={size}>
        {/* Background ring */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress ring */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={displayColor}
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
    fontSize: 18,
    fontWeight: '700',
  },
  subText: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '500',
    marginTop: 1,
  },
});
