import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';

export const AttendanceHedge = ({ xpBalance = 650, onUseInsurance }: { xpBalance?: number, onUseInsurance?: () => void }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🛡️ Attendance Hedge (XP Insurance)</Text>
      <Text style={styles.balance}>Current XP Balance: {xpBalance} XP</Text>
      <Text style={styles.info}>Use 500 XP to insure one missed class and protect your 75% attendance threshold.</Text>
      <TouchableOpacity 
        style={[styles.button, xpBalance < 500 && styles.disabled]} 
        disabled={xpBalance < 500}
        onPress={onUseInsurance}
      >
        <Text style={styles.buttonText}>Claim Insurance Policy (500 XP)</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: Spacing.md, backgroundColor: Colors.card, borderRadius: 16, margin: Spacing.md, borderWidth: 1, borderColor: '#EAB308' },
  title: { ...Typography.h3, color: '#EAB308', fontWeight: 'bold' },
  balance: { ...Typography.body1, color: Colors.textPrimary, marginVertical: Spacing.xs },
  info: { ...Typography.caption, color: Colors.textSecondary, marginBottom: Spacing.md },
  button: { backgroundColor: '#EAB308', padding: Spacing.md, borderRadius: 12, alignItems: 'center' },
  disabled: { backgroundColor: Colors.surface },
  buttonText: { color: '#000', fontWeight: 'bold', fontSize: 14 }
});
