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
  Image,
} from 'react-native';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';
import { fetchMyBugReports, BugReport, BugCategory, BugSeverity } from '../services/BugReportService';
import { useNavigation } from '@react-navigation/native';

const CATEGORY_MAP: Record<string, { label: string; icon: string }> = {
  crash: { label: 'Crash', icon: '💥' },
  ui: { label: 'UI Issue', icon: '🎨' },
  data_loss: { label: 'Data Loss', icon: '📉' },
  performance: { label: 'Performance', icon: '⚡' },
  feature: { label: 'Feature', icon: '💡' },
  general: { label: 'General', icon: '🔧' },
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#EAB308',
  low: '#22C55E',
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  new: { label: 'New', color: '#3B82F6' },
  ai_reviewed: { label: 'AI Reviewed', color: '#A855F7' },
  confirmed: { label: 'Confirmed', color: '#EAB308' },
  in_progress: { label: 'In Progress', color: '#F97316' },
  fixed: { label: 'Fixed', color: '#22C55E' },
  duplicate: { label: 'Duplicate', color: '#9CA3AF' },
  wont_fix: { label: 'Won\'t Fix', color: '#EF4444' },
};

const BugCard = ({ bug }: { bug: BugReport }) => {
  const [expanded, setExpanded] = useState(false);

  const categoryKey = String(bug?.category || 'general').toLowerCase();
  const severityKey = String(bug?.severity || 'low').toLowerCase();
  const statusKey = String(bug?.status || 'new').toLowerCase();

  const categoryInfo = CATEGORY_MAP[categoryKey] || { label: bug?.category || 'General', icon: '🔧' };
  const severityColor = SEVERITY_COLORS[severityKey] || '#22C55E';
  const statusInfo = STATUS_MAP[statusKey] || { label: bug?.status || 'New', color: '#3B82F6' };

  let dateStr = 'Recent';
  try {
    if (bug?.created_at) {
      dateStr = new Date(bug.created_at).toLocaleDateString();
    }
  } catch (e) {
    dateStr = 'Recent';
  }

  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.85}
    >
      <View style={styles.cardHeader}>
        <View style={styles.titleRow}>
          <View style={[styles.severityDot, { backgroundColor: severityColor }]} />
          <Text style={styles.title} numberOfLines={expanded ? 0 : 1}>
            {bug?.title || 'Bug Report'}
          </Text>
        </View>
        <Text style={styles.date}>{dateStr}</Text>
      </View>
      
      <View style={styles.badgesRow}>
        <View style={styles.categoryBadge}>
          <Text style={styles.badgeText}>{categoryInfo.icon} {categoryInfo.label}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${statusInfo.color}22`, borderColor: statusInfo.color }]}>
          <Text style={[styles.badgeText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
        </View>
        <Text style={{ color: Colors.textMuted, fontSize: 12, marginLeft: 'auto', alignSelf: 'center' }}>
          {expanded ? '▲ Hide Details' : '▼ Details'}
        </Text>
      </View>

      {/* Expanded Details */}
      {expanded ? (
        <View style={styles.detailsContainer}>
          {bug?.description ? (
            <View style={styles.detailSection}>
              <Text style={styles.detailTitle}>Description:</Text>
              <Text style={styles.detailText}>{bug.description}</Text>
            </View>
          ) : null}

          {bug?.steps_to_reproduce ? (
            <View style={styles.detailSection}>
              <Text style={styles.detailTitle}>Steps to Reproduce:</Text>
              <Text style={styles.detailText}>{bug.steps_to_reproduce}</Text>
            </View>
          ) : null}

          {bug?.screenshot_url ? (
            <View style={styles.detailSection}>
              <Text style={styles.detailTitle}>Screenshot:</Text>
              <Image source={{ uri: bug.screenshot_url }} style={styles.screenshotImage} resizeMode="cover" />
            </View>
          ) : null}

          {bug?.ai_summary ? (
            <View style={styles.aiSummaryContainer}>
              <View style={styles.aiSummaryHeader}>
                <Text style={{ fontSize: 14 }}>✨</Text>
                <Text style={styles.aiSummaryTitle}>AI Agent Analysis</Text>
              </View>
              <Text style={styles.aiSummaryText}>{bug.ai_summary}</Text>

              {bug?.ai_root_cause ? (
                <Text style={[styles.aiSummaryText, { marginTop: 4, fontStyle: 'italic' }]}>
                  💡 Root Cause: {bug.ai_root_cause}
                </Text>
              ) : null}

              {bug?.ai_fix_suggestion ? (
                <Text style={[styles.aiSummaryText, { marginTop: 4, fontWeight: '600', color: Colors.present }]}>
                  🛠️ Suggested Fix: {bug.ai_fix_suggestion}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </TouchableOpacity>
  );
};

export default function MyBugsScreen() {
  const navigation = useNavigation();
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const data = await fetchMyBugReports();
      setReports(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn('loadData failed:', e);
      setReports([]);
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
        <Text style={styles.headerTitle}>📋 My Bug Reports</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item, index) => (item && item.id) ? String(item.id) : String(index)}
          renderItem={({ item }) => <BugCard bug={item} />}
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
              <Text style={styles.emptyText}>🐛 No bug reports submitted yet</Text>
              <Text style={[styles.aiSummaryText, { textAlign: 'center', marginTop: 8 }]}>
                Report any issues directly from Settings → Report a Bug. Our AI agent runs every 6 hours to confirm and fix bugs!
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
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  severityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Spacing.sm,
  },
  title: {
    ...Typography.h3,
    color: Colors.textPrimary,
    flex: 1,
  },
  date: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  categoryBadge: {
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  detailsContainer: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.sm,
  },
  detailSection: {
    gap: 2,
  },
  detailTitle: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  detailText: {
    ...Typography.body2,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  screenshotImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginTop: 4,
    backgroundColor: Colors.card,
  },
  aiSummaryContainer: {
    backgroundColor: 'rgba(168, 85, 247, 0.08)',
    borderRadius: 10,
    padding: Spacing.sm,
    marginTop: Spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.25)',
  },
  aiSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  aiSummaryTitle: {
    ...Typography.subtitle2,
    color: Colors.primaryLight,
    marginLeft: Spacing.xs,
    fontWeight: 'bold',
  },
  aiSummaryText: {
    ...Typography.body2,
    color: Colors.textSecondary,
    lineHeight: 20,
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
