import React, {useEffect, useState, Component, ErrorInfo, ReactNode, useRef} from 'react';
import {
  StatusBar,
  StyleSheet,
  View,
  Text,
  Animated,
  TouchableOpacity,
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
import {ModernOTAService} from './src/services/OTAService';
import {initAccountSyncEngine} from './src/services/AccountSyncService';
import ForceUpdateModal from './src/components/ForceUpdateModal';
import PixelAssemblySplashScreen, {OTAProgressInfo} from './src/components/PixelAssemblySplashScreen';
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
  const [animDone, setAnimDone] = useState(false);
  const [bootDone, setBootDone] = useState(false);
  const [otaProgress, setOtaProgress] = useState<OTAProgressInfo | undefined>(undefined);
  const splashFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let isMounted = true;

    const boot = async () => {
      try {
        await initDatabase();
        initAccountSyncEngine();
        await generateTodayInstances();
        await scheduleEndOfDayNudge();
        await scheduleClassReminders(10);
        // Enterprise OTA Boot Confirmation & Check
        ModernOTAService.confirmBoot();
        ModernOTAService.checkForUpdates({
          onProgress: (info) => {
            if (isMounted) {
              setOtaProgress(info);
            }
          },
        }).catch(e => console.warn('OTA boot check error:', e));
      } catch (e) {
        console.error('Boot error:', e);
      } finally {
        if (isMounted) {
          setBootDone(true);
        }
      }
    };

    boot();

    // Safety timeout in case network or database stalls
    const timeout = setTimeout(() => {
      if (isMounted) {
        setBootDone(true);
      }
    }, 4500);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (animDone && bootDone) {
      // If OTA update is currently actively downloading or verifying, hold to show progress
      if (otaProgress?.status === 'downloading' || otaProgress?.status === 'verifying') {
        return;
      }

      Animated.timing(splashFade, {
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      }).start(() => setIsAppReady(true));
    }
  }, [animDone, bootDone, otaProgress?.status, splashFade]);

  if (!isAppReady) {
    return (
      <Animated.View style={[styles.root, {opacity: splashFade}]}>
        <StatusBar barStyle="light-content" backgroundColor="#05050A" />
        <PixelAssemblySplashScreen
          progressInfo={otaProgress}
          onAnimationComplete={() => setAnimDone(true)}
        />
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
