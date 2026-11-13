import React, {useEffect, useState, Component, ErrorInfo, ReactNode} from 'react';
import {
  StatusBar,
  StyleSheet,
  View,
  Text,
  Animated,
  TouchableOpacity,
  Easing,
} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {NavigationContainer} from '@react-navigation/native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {BottomSheetModalProvider} from '@gorhom/bottom-sheet';
import Toast from 'react-native-toast-message';
import AppNavigator from './src/navigation/AppNavigator';
import {linking} from './src/navigation/linking';
import {initDatabase} from './src/db/database';
import {generateTodayInstances} from './src/db/queries/lectureInstances';
import {scheduleEndOfDayNudge, scheduleClassReminders} from './src/services/NotificationService';
import {ModernOTAService, checkForJSUpdate, checkForNativeUpdate} from './src/services/OTAService';
import ForceUpdateModal from './src/components/ForceUpdateModal';
import {Colors} from './src/theme/colors';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {hasError: true, error};
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  public handleRestart = () => {
    this.setState({hasError: false, error: null});
  };

  public render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#05050A" />
          <View style={styles.errorCard}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>ATTENDO</Text>
            <Text style={styles.errorMessage}>
              An unexpected issue occurred. Tap below to reload your timetable cleanly.
            </Text>
            <TouchableOpacity style={styles.reloadBtn} onPress={this.handleRestart}>
              <Text style={styles.reloadBtnText}>Reload App</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

function App(): React.JSX.Element {
  const [isAppReady, setIsAppReady] = useState(false);

  // Cinematic Multi-Phase Animation Values
  const [ringRotate] = useState(new Animated.Value(0));
  const [pulseScale] = useState(new Animated.Value(0.4));
  const [logoScale] = useState(new Animated.Value(0.1));
  const [logoOpacity] = useState(new Animated.Value(0));
  const [titleTranslateY] = useState(new Animated.Value(30));
  const [titleOpacity] = useState(new Animated.Value(0));
  const [splashFade] = useState(new Animated.Value(1));

  useEffect(() => {
    // 1. Cyber Ring Continuous Rotation
    Animated.loop(
      Animated.timing(ringRotate, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();

    // 2. Multi-Phase Portal & Emblem Reveal Sequence
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
      // Phase 3: Title Slide Up
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
      ]),
    ]).start();

    const boot = async () => {
      try {
        await initDatabase();
        await generateTodayInstances();
        await scheduleEndOfDayNudge();
        await scheduleClassReminders(10);
        // Enterprise OTA Boot Confirmation & Check
        ModernOTAService.confirmBoot();
        checkForJSUpdate();
        checkForNativeUpdate();
      } catch (e) {
        console.error('Boot error:', e);
      } finally {
        setTimeout(() => {
          Animated.timing(splashFade, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }).start(() => setIsAppReady(true));
        }, 1800);
      }
    };
    boot();
  }, []);

  const spin = ringRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (!isAppReady) {
    return (
      <Animated.View style={[styles.splashContainer, {opacity: splashFade}]}>
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
          <Text style={styles.splashSubtitle}>75% Attendance & Task Shield</Text>
        </Animated.View>
      </Animated.View>
    );
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <StatusBar
            barStyle="light-content"
            backgroundColor={Colors.background}
            translucent={false}
          />
          <NavigationContainer linking={linking} theme={{
            dark: true,
            colors: {
              primary: Colors.primary,
              background: Colors.background,
              card: Colors.card,
              text: Colors.textPrimary,
              border: Colors.border,
              notification: Colors.present,
            },
          }}>
            <BottomSheetModalProvider>
              <AppNavigator />
            </BottomSheetModalProvider>
          </NavigationContainer>
          <ForceUpdateModal />
          <Toast />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
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
  errorContainer: {
    flex: 1,
    backgroundColor: '#05050A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorCard: {
    backgroundColor: '#13131A',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A3D',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F0F0FF',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#8888AA',
    textAlign: 'center',
    marginBottom: 20,
  },
  reloadBtn: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  reloadBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});

export default App;
