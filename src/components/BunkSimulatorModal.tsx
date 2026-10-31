import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {format, addDays} from 'date-fns';
import {Colors} from '../theme/colors';
import {Spacing} from '../theme/spacing';
import {Typography} from '../theme/typography';
import {
  simulateDateRangeBunk,
  BunkSimulationResult,
} from '../db/queries/bunkPredictor';

interface Props {
  isVisible: boolean;
  onClose: () => void;
}

export default function BunkSimulatorModal({isVisible, onClose}: Props) {
  const [startDate, setStartDate] = useState(new Date());
  const [daysCount, setDaysCount] = useState(3);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BunkSimulationResult | null>(null);

  const handleSimulate = async () => {
    setLoading(true);
    try {
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(addDays(startDate, daysCount - 1), 'yyyy-MM-dd');
      const res = await simulateDateRangeBunk(startStr, endStr);
      setResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={isVisible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>🤖 AI Leave & Bunk Simulator</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.desc}>
            Simulate taking upcoming leave to see projected attendance impact per subject BEFORE taking leave!
          </Text>

          <View style={styles.daysRow}>
            <Text style={styles.label}>Leave Duration:</Text>
            <View style={styles.chipRow}>
              {[1, 2, 3, 5, 7].map(num => (
                <TouchableOpacity
                  key={num}
                  style={[
                    styles.chip,
                    daysCount === num && styles.chipActive,
                  ]}
                  onPress={() => {
                    setDaysCount(num);
                    setResult(null);
                  }}>
                  <Text
                    style={[
                      styles.chipText,
                      daysCount === num && styles.chipTextActive,
                    ]}>
                    {num} Day{num > 1 ? 's' : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity style={styles.simulateBtn} onPress={handleSimulate}>
            <Text style={styles.simulateBtnText}>
              {loading ? 'Simulating Impact...' : '🔮 Run Impact Simulation'}
            </Text>
          </TouchableOpacity>

          {loading && <ActivityIndicator color={Colors.primary} style={{marginVertical: 20}} />}

          {result && (
            <ScrollView style={styles.resultContainer} showsVerticalScrollIndicator={false}>
              <View
                style={[
                  styles.statusBanner,
                  {
                    backgroundColor:
                      result.recommendation === 'SAFE'
                        ? Colors.present + '22'
                        : result.recommendation === 'WARNING'
                        ? Colors.cancelled + '22'
                        : Colors.absent + '22',
                    borderColor:
                      result.recommendation === 'SAFE'
                        ? Colors.present
                        : result.recommendation === 'WARNING'
                        ? Colors.cancelled
                        : Colors.absent,
                  },
                ]}>
                <Text
                  style={[
                    styles.statusText,
                    {
                      color:
                        result.recommendation === 'SAFE'
                          ? Colors.present
                          : result.recommendation === 'WARNING'
                          ? Colors.cancelled
                          : Colors.absent,
                    },
                  ]}>
                  {result.summaryMessage}
                </Text>
              </View>

              <View style={styles.metricGrid}>
                <View style={styles.metricBox}>
                  <Text style={styles.metricVal}>{result.overallCurrentPercent}%</Text>
                  <Text style={styles.metricSub}>Current</Text>
                </View>
                <View style={styles.metricBox}>
                  <Text
                    style={[
                      styles.metricVal,
                      {
                        color:
                          result.overallProjectedPercent >= 75
                            ? Colors.present
                            : Colors.absent,
                      },
                    ]}>
                    {result.overallProjectedPercent}%
                  </Text>
                  <Text style={styles.metricSub}>Projected</Text>
                </View>
                <View style={styles.metricBox}>
                  <Text style={styles.metricVal}>{result.totalBunkedClasses}</Text>
                  <Text style={styles.metricSub}>Classes Missed</Text>
                </View>
              </View>

              <Text style={styles.subHeader}>Subject Breakdown:</Text>
              {result.subjects.map(sub => (
                <View key={sub.subjectId} style={styles.subRow}>
                  <View style={[styles.dot, {backgroundColor: sub.subjectColor}]} />
                  <View style={{flex: 1}}>
                    <Text style={styles.subName}>{sub.subjectName}</Text>
                    <Text style={styles.subSub}>
                      Misses {sub.bunkedClassesCount} class{sub.bunkedClassesCount > 1 ? 'es' : ''}
                    </Text>
                  </View>
                  <View style={{alignItems: 'flex-end'}}>
                    <Text
                      style={[
                        styles.subPercent,
                        {color: sub.isSafe ? Colors.textPrimary : Colors.absent},
                      ]}>
                      {sub.currentPercent}% ➔ {sub.projectedPercent}%
                    </Text>
                    <Text style={{fontSize: 10, color: sub.isSafe ? Colors.present : Colors.absent}}>
                      {sub.isSafe ? '✓ Safe' : '⚠️ Danger'}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: Spacing.cardRadiusLg,
    borderTopRightRadius: Spacing.cardRadiusLg,
    padding: Spacing.lg,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    ...Typography.h3,
  },
  closeBtn: {
    color: Colors.textSecondary,
    fontSize: 20,
    fontWeight: '700',
  },
  desc: {
    ...Typography.body2,
    marginBottom: Spacing.md,
  },
  daysRow: {
    marginBottom: Spacing.md,
  },
  label: {
    ...Typography.caption,
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFF',
  },
  simulateBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: Spacing.cardRadius,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  simulateBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  },
  resultContainer: {
    maxHeight: 350,
  },
  statusBanner: {
    padding: Spacing.md,
    borderRadius: Spacing.cardRadius,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  statusText: {
    fontWeight: '700',
    fontSize: 14,
    textAlign: 'center',
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.md,
  },
  metricBox: {
    flex: 1,
    backgroundColor: Colors.surface,
    padding: 10,
    borderRadius: Spacing.cardRadius,
    alignItems: 'center',
  },
  metricVal: {
    ...Typography.h3,
  },
  metricSub: {
    ...Typography.caption,
    fontSize: 10,
  },
  subHeader: {
    ...Typography.label,
    marginBottom: 8,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 10,
    borderRadius: Spacing.cardRadius,
    marginBottom: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  subName: {
    ...Typography.body1,
    fontSize: 13,
  },
  subSub: {
    ...Typography.caption,
    fontSize: 11,
  },
  subPercent: {
    fontWeight: '700',
    fontSize: 13,
  },
});
