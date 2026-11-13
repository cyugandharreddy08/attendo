import React, {useRef, useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {Colors} from '../theme/colors';

const TAB_ICONS: Record<string, {active: string; inactive: string; label: string}> = {
  Timetable: {active: '📅', inactive: '📅', label: 'Schedule'},
  Todos: {active: '📝', inactive: '📝', label: 'To-Do'},
  Peers: {active: '👥', inactive: '👥', label: 'Campus'},
  Stats: {active: '📊', inactive: '📊', label: 'Analytics'},
  Calendar: {active: '🗓️', inactive: '🗓️', label: 'Heatmap'},
  Settings: {active: '⚙️', inactive: '⚙️', label: 'Settings'},
};

export default function AnimatedCustomTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get('window').width;
  const tabWidth = (screenWidth - 28) / state.routes.length;

  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(translateX, {
      toValue: state.index * tabWidth,
      friction: 6,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [state.index, tabWidth, translateX]);

  return (
    <View style={[styles.wrapper, {paddingBottom: Math.max(insets.bottom - 4, 8)}]}>
      <View style={styles.dockContainer}>
        {/* Animated Sliding Pill Indicator */}
        <Animated.View
          style={[
            styles.activeIndicator,
            {
              width: tabWidth - 6,
              transform: [{translateX}],
            },
          ]}
        />

        {/* Tab Buttons */}
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const config = TAB_ICONS[route.name] || {
            active: '📌',
            inactive: '📌',
            label: route.name,
          };

          const scaleAnim = useRef(new Animated.Value(isFocused ? 1.15 : 1)).current;

          useEffect(() => {
            Animated.spring(scaleAnim, {
              toValue: isFocused ? 1.15 : 1,
              friction: 5,
              tension: 100,
              useNativeDriver: true,
            }).start();
          }, [isFocused, scaleAnim]);

          const onPress = () => {
            try {
              ReactNativeHapticFeedback.trigger('impactLight', {
                enableVibrateFallback: true,
                ignoreAndroidSystemSettings: false,
              });
            } catch {}

            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? {selected: true} : {}}
              onPress={onPress}
              activeOpacity={0.75}
              style={[styles.tabButton, {width: tabWidth}]}>
              <Animated.View
                style={[
                  styles.iconWrap,
                  {
                    transform: [{scale: scaleAnim}],
                  },
                ]}>
                <Text style={[styles.tabEmoji, isFocused && styles.tabEmojiFocused]}>
                  {config.active}
                </Text>
              </Animated.View>

              <Text
                style={[
                  styles.tabLabel,
                  isFocused ? styles.tabLabelFocused : styles.tabLabelInactive,
                ]}
                numberOfLines={1}>
                {config.label}
              </Text>

              {isFocused && <View style={styles.glowDot} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: 'transparent',
    paddingHorizontal: 14,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  dockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 16, 26, 0.94)',
    borderRadius: 24,
    paddingVertical: 6,
    paddingHorizontal: 3,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.28)',
    shadowColor: '#8B5CF6',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 20,
    overflow: 'hidden',
  },
  activeIndicator: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    left: 6,
    borderRadius: 18,
    backgroundColor: 'rgba(139, 92, 246, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.45)',
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    zIndex: 2,
  },
  iconWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabEmoji: {
    fontSize: 18,
  },
  tabEmojiFocused: {
    shadowColor: '#A855F7',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  tabLabelFocused: {
    color: '#E0E7FF',
    fontWeight: '700',
  },
  tabLabelInactive: {
    color: '#6B7280',
  },
  glowDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#A855F7',
    marginTop: 2,
    shadowColor: '#A855F7',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 1,
    shadowRadius: 4,
  },
});
