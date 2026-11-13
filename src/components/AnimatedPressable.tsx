import React, {useRef} from 'react';
import {
  Animated,
  Pressable,
  StyleProp,
  ViewStyle,
  StyleSheet,
} from 'react-native';
import ReactNativeHapticFeedback, {
  HapticFeedbackTypes,
} from 'react-native-haptic-feedback';

export type HapticType =
  | 'selection'
  | 'impactLight'
  | 'impactMedium'
  | 'impactHeavy'
  | 'rigid'
  | 'soft'
  | 'notificationSuccess'
  | 'notificationWarning'
  | 'notificationError'
  | HapticFeedbackTypes;

interface AnimatedPressableProps {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  hapticType?: HapticType;
  disabled?: boolean;
  activeOpacity?: number;
  glowOnPress?: boolean;
  glowColor?: string;
}

export default function AnimatedPressable({
  children,
  onPress,
  onLongPress,
  style,
  scaleTo = 0.96,
  hapticType = 'impactLight' as HapticType,
  disabled = false,
  activeOpacity = 0.88,
}: AnimatedPressableProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled) return;
    if (hapticType) {
      try {
        ReactNativeHapticFeedback.trigger(hapticType as any, {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });
      } catch {
        // Fallback silently if not supported
      }
    }

    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: scaleTo,
        friction: 6,
        tension: 100,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: activeOpacity,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    if (disabled) return;
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Extract flex-related layout properties so Pressable container honors flexbox in row containers
  const flattened = StyleSheet.flatten(style) || {};
  const isFlex = flattened.flex !== undefined;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={isFlex ? {flex: flattened.flex} : undefined}>
      <Animated.View
        style={[
          style,
          {
            transform: [{scale: scaleAnim}],
            opacity: opacityAnim,
          },
        ]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
