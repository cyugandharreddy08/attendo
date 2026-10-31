import {StyleSheet} from 'react-native';
import {Colors} from './colors';

export const Typography = StyleSheet.create({
  h1: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  h4: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  subtitle1: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  body1: {
    fontSize: 15,
    fontWeight: '400',
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  body2: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  caption: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textMuted,
    letterSpacing: 0.3,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  mono: {
    fontSize: 13,
    fontFamily: 'monospace',
    color: Colors.textPrimary,
  },
  subtitle2: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  button: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});
