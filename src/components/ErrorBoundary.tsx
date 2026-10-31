import React, {Component, ErrorInfo, ReactNode} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, ScrollView} from 'react-native';
import {reportCrash} from '../services/CrashReportService';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {hasError: false, error: null, errorInfo: null};
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {hasError: true, error};
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({errorInfo});
    // Send crash report to Supabase
    reportCrash(error, errorInfo.componentStack?.substring(0, 200) ?? 'ErrorBoundary');
  }

  handleRestart = () => {
    this.setState({hasError: false, error: null, errorInfo: null});
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <Text style={styles.emoji}>💥</Text>
            <Text style={styles.title}>Oops! Something went wrong</Text>
            <Text style={styles.subtitle}>
              The error has been automatically reported to our team.
            </Text>
            
            <ScrollView style={styles.errorBox} horizontal={false}>
              <Text style={styles.errorText}>
                {this.state.error?.message ?? 'Unknown error'}
              </Text>
            </ScrollView>
            
            <TouchableOpacity style={styles.button} onPress={this.handleRestart}>
              <Text style={styles.buttonText}>🔄 Try Again</Text>
            </TouchableOpacity>
            
            <Text style={styles.footer}>
              If this keeps happening, go to Settings → Report Bug
            </Text>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05050A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#101018',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    width: '100%',
    maxWidth: 400,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F4F4FF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#9494B8',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  errorBox: {
    backgroundColor: '#1a0a0a',
    borderRadius: 12,
    padding: 12,
    maxHeight: 120,
    width: '100%',
    marginBottom: 24,
  },
  errorText: {
    fontSize: 11,
    color: '#EF4444',
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 16,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    fontSize: 12,
    color: '#5C5C7A',
    textAlign: 'center',
  },
});
