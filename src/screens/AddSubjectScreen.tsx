import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Slider from '@react-native-community/slider';
import {RootStackParamList} from '../types';
import {createSubject, updateSubject} from '../db/queries/subjects';
import {Colors} from '../theme/colors';
import {Spacing} from '../theme/spacing';
import {Typography} from '../theme/typography';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'AddSubject'>;

const COLOR_OPTIONS = Colors.subjectColors.slice(0, 8);

export default function AddSubjectScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProps>();
  const existingSubject = route.params?.subject;

  const [name, setName] = useState(existingSubject?.name ?? '');
  const [selectedColor, setSelectedColor] = useState(existingSubject?.color ?? Colors.subjectColors[0]);
  const [targetPercent, setTargetPercent] = useState(existingSubject?.target_percent ?? 75);
  const [pastAttended, setPastAttended] = useState(String(existingSubject?.past_attended ?? 0));
  const [pastTotal, setPastTotal] = useState(String(existingSubject?.past_total ?? 0));
  const [isFrozen, setIsFrozen] = useState(existingSubject?.is_frozen === 1);
  const [credits, setCredits] = useState(existingSubject?.credits ?? 1);

  const [subjectType, setSubjectType] = useState<'theory' | 'lab'>(existingSubject?.subject_type ?? 'theory');

  const isEditing = !!existingSubject;

  const handleDecrementAttended = () => {
    const val = Math.max(0, (parseInt(pastAttended, 10) || 0) - 1);
    setPastAttended(String(val));
  };

  const handleIncrementAttended = () => {
    const val = (parseInt(pastAttended, 10) || 0) + 1;
    setPastAttended(String(val));
  };

  const handleDecrementTotal = () => {
    const val = Math.max(0, (parseInt(pastTotal, 10) || 0) - 1);
    setPastTotal(String(val));
  };

  const handleIncrementTotal = () => {
    const val = (parseInt(pastTotal, 10) || 0) + 1;
    setPastTotal(String(val));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a subject name.');
      return;
    }
    const attended = parseInt(pastAttended, 10) || 0;
    const total = parseInt(pastTotal, 10) || 0;

    if (attended > total) {
      Alert.alert('Invalid Attendance', 'Attended classes cannot exceed total classes.');
      return;
    }

    navigation.goBack();

    if (isEditing && existingSubject) {
      await updateSubject(
        existingSubject.id,
        name.trim(),
        selectedColor,
        targetPercent,
        subjectType,
        attended,
        total,
        isFrozen ? 1 : 0,
        credits,
      );
    } else {
      await createSubject(
        name.trim(),
        selectedColor,
        targetPercent,
        subjectType,
        attended,
        total,
        credits,
      );
    }
  };

  return (
    <ScrollView
      style={[styles.container, {paddingTop: insets.top}]}
      contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{isEditing ? 'Edit Subject' : 'New Subject'}</Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={styles.saveText}>Save</Text>
        </TouchableOpacity>
      </View>

      {/* Preview */}
      <View style={[styles.preview, {backgroundColor: selectedColor + '22', borderColor: selectedColor}]}>
        <View style={[styles.previewDot, {backgroundColor: selectedColor}]} />
        <View style={{flex: 1}}>
          <Text style={styles.previewName}>{name || 'Subject Name'}</Text>
          {isFrozen && <Text style={styles.previewFrozen}>❄️ Frozen (Leisure)</Text>}
        </View>
        <Text style={[styles.previewTarget, {color: selectedColor}]}>{targetPercent}%</Text>
      </View>

      {/* Name input */}
      <Text style={styles.label}>Subject Name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Mathematics"
        placeholderTextColor={Colors.textMuted}
        autoFocus={!isEditing}
        maxLength={50}
      />

      {/* Subject Type Selector */}
      <Text style={styles.label}>Subject Category</Text>
      <View style={styles.typeSelectorRow}>
        <TouchableOpacity
          style={[styles.typeOption, subjectType === 'theory' && {backgroundColor: Colors.primary + '33', borderColor: Colors.primary}]}
          onPress={() => setSubjectType('theory')}>
          <Text style={[styles.typeOptionText, subjectType === 'theory' && {color: Colors.primaryLight, fontWeight: '700'}]}>
            📚 Theory Class
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.typeOption, subjectType === 'lab' && {backgroundColor: Colors.present + '33', borderColor: Colors.present}]}
          onPress={() => setSubjectType('lab')}>
          <Text style={[styles.typeOptionText, subjectType === 'lab' && {color: Colors.present, fontWeight: '700'}]}>
            🧪 Lab / Practical
          </Text>
        </TouchableOpacity>
      </View>

      {/* Color picker */}
      <Text style={styles.label}>Color</Text>
      <View style={styles.colorRow}>
        {COLOR_OPTIONS.map(color => (
          <TouchableOpacity
            key={color}
            style={[
              styles.colorSwatch,
              {backgroundColor: color},
              selectedColor === color && styles.colorSwatchSelected,
            ]}
            onPress={() => setSelectedColor(color)}
          />
        ))}
      </View>

      {/* Target percent */}
      <Text style={styles.label}>Target Attendance: {targetPercent}%</Text>
      <Slider
        style={styles.slider}
        minimumValue={50}
        maximumValue={100}
        step={1}
        value={targetPercent}
        onValueChange={setTargetPercent}
        minimumTrackTintColor={selectedColor}
        maximumTrackTintColor={Colors.surface}
        thumbTintColor={selectedColor}
      />

      {/* Mid-semester initial history */}
      <View style={styles.sectionHeader}>
        <Text style={styles.label}>Mid-Semester Past Attendance</Text>
        <Text style={styles.sublabel}>Use ➖ / ➕ or type exact numbers to update past classes</Text>
      </View>
      <View style={styles.midSemRow}>
        <View style={{flex: 1}}>
          <Text style={styles.inputSubLabel}>Classes Attended</Text>
          <View style={styles.stepperContainer}>
            <TouchableOpacity style={styles.stepperBtn} onPress={handleDecrementAttended}>
              <Text style={styles.stepperText}>➖</Text>
            </TouchableOpacity>
            <TextInput
              style={[styles.input, {flex: 1, textAlign: 'center', marginHorizontal: 4}]}
              value={pastAttended}
              onChangeText={setPastAttended}
              placeholder="0"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
            />
            <TouchableOpacity style={styles.stepperBtn} onPress={handleIncrementAttended}>
              <Text style={styles.stepperText}>➕</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{width: 12}} />

        <View style={{flex: 1}}>
          <Text style={styles.inputSubLabel}>Total Classes Held</Text>
          <View style={styles.stepperContainer}>
            <TouchableOpacity style={styles.stepperBtn} onPress={handleDecrementTotal}>
              <Text style={styles.stepperText}>➖</Text>
            </TouchableOpacity>
            <TextInput
              style={[styles.input, {flex: 1, textAlign: 'center', marginHorizontal: 4}]}
              value={pastTotal}
              onChangeText={setPastTotal}
              placeholder="0"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
            />
            <TouchableOpacity style={styles.stepperBtn} onPress={handleIncrementTotal}>
              <Text style={styles.stepperText}>➕</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Freeze subject switch */}
      {isEditing && (
        <View style={styles.freezeRow}>
          <View style={{flex: 1}}>
            <Text style={styles.freezeTitle}>Freeze Subject ❄️</Text>
            <Text style={styles.freezeDesc}>No new classes will be scheduled. Marks as leisure.</Text>
          </View>
          <Switch
            value={isFrozen}
            onValueChange={setIsFrozen}
            trackColor={{false: Colors.surface, true: Colors.holiday + '88'}}
            thumbColor={isFrozen ? Colors.holiday : Colors.textMuted}
          />
        </View>
      )}

      <TouchableOpacity style={[styles.saveBtn, {backgroundColor: selectedColor}]} onPress={handleSave}>
        <Text style={styles.saveBtnText}>{isEditing ? 'Update Subject' : 'Create Subject'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.screenPad,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.card,
  },
  cancelText: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  title: {
    ...Typography.h3,
  },
  saveText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  preview: {
    margin: Spacing.screenPad,
    borderRadius: Spacing.cardRadiusLg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    gap: 12,
  },
  previewDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  previewName: {
    ...Typography.h3,
  },
  previewFrozen: {
    ...Typography.caption,
    color: Colors.holiday,
    marginTop: 2,
  },
  previewTarget: {
    ...Typography.h3,
    fontWeight: '700',
  },
  label: {
    ...Typography.label,
    marginHorizontal: Spacing.screenPad,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  sublabel: {
    ...Typography.caption,
    marginHorizontal: Spacing.screenPad,
    marginBottom: Spacing.sm,
    color: Colors.textMuted,
  },
  sectionHeader: {
    marginTop: 8,
  },
  inputSubLabel: {
    ...Typography.caption,
    marginLeft: Spacing.screenPad,
    marginBottom: 4,
  },
  midSemRow: {
    flexDirection: 'row',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.screenPad,
  },
  stepperBtn: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Spacing.cardRadius,
    width: 36,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: {
    fontSize: 14,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: Spacing.cardRadius,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: Spacing.screenPad,
    color: Colors.textPrimary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: Spacing.screenPad,
    marginBottom: Spacing.sm,
  },
  typeOption: {
    flex: 1,
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Spacing.cardRadius,
    paddingVertical: 12,
    alignItems: 'center',
  },
  typeOptionText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: Spacing.screenPad,
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorSwatchSelected: {
    borderColor: '#fff',
    transform: [{scale: 1.15}],
  },
  slider: {
    marginHorizontal: Spacing.screenPad,
    height: 40,
  },
  freezeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    marginHorizontal: Spacing.screenPad,
    marginTop: Spacing.lg,
    padding: Spacing.md,
    borderRadius: Spacing.cardRadius,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  freezeTitle: {
    ...Typography.h4,
    color: Colors.holiday,
  },
  freezeDesc: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  saveBtn: {
    margin: Spacing.screenPad,
    marginTop: Spacing.xl,
    borderRadius: Spacing.cardRadius,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
