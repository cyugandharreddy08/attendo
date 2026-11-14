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

export type PhysicsProfile = 'bouncy' | 'snappy' | 'gentle' | 'rigid' | 'tactile';

const PHYSICS_CONFIG: Record<
  PhysicsProfile,
  {
    pressIn: {friction: number; tension: number};
    pressOut: {friction: number; tension: number};
  }
> = {
  bouncy: {
    pressIn: {friction: 6, tension: 160},
    pressOut: {friction: 4.2, tension: 120},
  },
  snappy: {
    pressIn: {friction: 8, tension: 280},
    pressOut: {friction: 5.5, tension: 220},
  },
  gentle: {
    pressIn: {friction: 8, tension: 100},
    pressOut: {friction: 6, tension: 80},
  },
  rigid: {
    pressIn: {friction: 12, tension: 340},
    pressOut: {friction: 9, tension: 260},
  },
  tactile: {
    pressIn: {friction: 10, tension: 300},
    pressOut: {friction: 7, tension: 240},
  },
};

interface AnimatedPressableProps {
  children?: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  hapticType?: HapticType;
  disabled?: boolean;
  activeOpacity?: number;
  glowOnPress?: boolean;
  glowColor?: string;
  physics?: PhysicsProfile;
  translateYOnPress?: number;
}

export default function AnimatedPressable({
  children,
  onPress,
  onLongPress,
  style,
  scaleTo = 0.96,
  hapticType = 'impactLight' as HapticType,
  disabled = false,
  activeOpacity = 0.92,
  physics = 'bouncy',
  translateYOnPress = 1.5,
}: AnimatedPressableProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const currentPhysics = PHYSICS_CONFIG[physics] || PHYSICS_CONFIG.bouncy;

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
        friction: currentPhysics.pressIn.friction,
        tension: currentPhysics.pressIn.tension,
        useNativeDriver: true,
      }),
      Animated.spring(translateYAnim, {
        toValue: translateYOnPress,
        friction: currentPhysics.pressIn.friction,
        tension: currentPhysics.pressIn.tension,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: activeOpacity,
        duration: 90,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    if (disabled) return;
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: currentPhysics.pressOut.friction,
        tension: currentPhysics.pressOut.tension,
        useNativeDriver: true,
      }),
      Animated.spring(translateYAnim, {
        toValue: 0,
        friction: currentPhysics.pressOut.friction,
        tension: currentPhysics.pressOut.tension,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 140,
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
            transform: [
              {scale: scaleAnim},
              {translateY: translateYAnim},
            ],
            opacity: opacityAnim,
          },
        ]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
