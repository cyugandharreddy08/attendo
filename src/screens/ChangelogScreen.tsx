import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';
import { fetchChangelogs, Changelog } from '../services/UpdateService';
import { useNavigation } from '@react-navigation/native';

const ENTRY_TYPE_MAP: Record<string, { label: string; icon: string; color: string }> = {
  fix: { label: 'Fix', icon: '🐛', color: '#22C55E' },
  feature: { label: 'Feature', icon: '✨', color: '#A855F7' },
  improvement: { label: 'Improvement', icon: '⚡', color: '#EAB308' },
};

const ChangelogCard = ({ changelog }: { changelog: Changelog }) => {
  const dateStr = changelog.published_at
    ? new Date(changelog.published_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Recent';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.versionBadge}>
          <Text style={styles.versionText}>{changelog.version_name || 'v7.0.0'}</Text>
        </View>
        <Text style={styles.date}>{dateStr}</Text>
      </View>

      <View style={styles.entriesContainer}>
        {(changelog.entries || []).map((entry, index) => {
          const typeInfo = ENTRY_TYPE_MAP[entry.type] || { label: 'Other', icon: '🔹', color: Colors.textMuted };
          return (
            <View key={index} style={styles.entryRow}>
              <View style={[styles.entryTypeBadge, { backgroundColor: `${typeInfo.color}15`, borderColor: `${typeInfo.color}40` }]}>
                <Text style={styles.entryTypeText}>{typeInfo.icon} {typeInfo.label}</Text>
              </View>
              <Text style={styles.entryDescription}>{entry.text}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

export default function ChangelogScreen() {
  const navigation = useNavigation();
  const [changelogs, setChangelogs] = useState<Changelog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const data = await fetchChangelogs();
      const defaultEntry: Changelog = {
        id: 'ota-710',
        version_name: 'v7.1.0 (OTA Release)',
        published_at: new Date().toISOString(),
        entries: [
          { type: 'feature', text: '⏱️ Duration-Weighted Hours: 1 hr class = 1 hr, 2 hr class = 2 hrs (Attendance % = Total Attended Hrs / Total Held Hrs)' },
          { type: 'feature', text: '🧪 AI Lab vs Theory Separation: Automatic AI classification & 1-tap category switcher' },
          { type: 'feature', text: '🤖 Attendance Autopilot: Predictive class bunk buffer & mandatory attendance recommendations' },
          { type: 'feature', text: '🔮 Campus Day Twin: Full-semester what-if attendance simulator' },
          { type: 'feature', text: '🏃 Smart Catch-Up Coach: Recovery task cards for missed classes & 1-tap note requests' },
          { type: 'feature', text: '📡 Attendance Risk Radar: Habitual missed day pattern detection & 2–4 week forecast' },
          { type: 'feature', text: '⚡ Recovery Planner: Exact date-by-date target attendance recovery roadmap' },
          { type: 'feature', text: '⚡ NextClass Widget: Smart next class countdown & 1-tap quick attendance marking' },
          { type: 'fix', text: '🛡️ Permanent Identity: Fixed random device ID reset across app restarts' },
          { type: 'fix', text: '⏰ Time Validation: Enforced 24h format (00:00 - 23:59) and end > start check' },
          { type: 'fix', text: '📅 Attendance Reconciliation: Adding/editing classes updates instances dynamically' },
          { type: 'fix', text: '👻 Clean Rescheduling: Unshifting removes shifted target copies properly' },
        ],
      };
      setChangelogs([defaultEntry, ...(data || [])]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={{ fontSize: 20, color: Colors.textPrimary }}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🚀 What's New</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={changelogs}
          keyExtractor={(item) => item.id || Math.random().toString()}
          renderItem={({ item }) => <ChangelogCard changelog={item} />}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>🚀 Attendo v7.0.0 Cloud Platform</Text>
              <Text style={[styles.entryDescription, { textAlign: 'center', marginTop: 8 }]}>
                - Cloud Sync with Supabase Database{'\n'}
                - In-app AI Bug Reporter with Gemini 2.0 Flash{'\n'}
                - Automated Crash Telemetry{'\n'}
                - Host Approval Pipeline for Updates{'\n'}
                - Glassmorphic Supreme Dark UI
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screenPad,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: Spacing.screenPad,
    paddingBottom: Spacing.xl * 2,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  versionBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: 20,
  },
  versionText: {
    ...Typography.subtitle2,
    color: Colors.textPrimary,
    fontWeight: 'bold',
  },
  date: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  entriesContainer: {
    marginTop: Spacing.xs,
    gap: Spacing.md,
  },
  entryRow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },
  entryTypeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  entryTypeText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  entryDescription: {
    ...Typography.body2,
    color: Colors.textSecondary,
    lineHeight: 22,
    paddingLeft: 4,
  },
  emptyContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xl,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyText: {
    ...Typography.h3,
    color: Colors.primaryLight,
  },
});
