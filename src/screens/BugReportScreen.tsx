import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';
import { submitBugReport, BugCategory, BugSeverity } from '../services/BugReportService';
import { launchImageLibrary } from 'react-native-image-picker';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';

const CATEGORIES: { id: BugCategory; label: string; icon: string }[] = [
  { id: 'crash', label: 'Crash', icon: '💥' },
  { id: 'ui', label: 'UI Issue', icon: '🎨' },
  { id: 'data_loss', label: 'Data Loss', icon: '📉' },
  { id: 'performance', label: 'Performance', icon: '⚡' },
  { id: 'feature', label: 'Feature', icon: '💡' },
  { id: 'general', label: 'General', icon: '🔧' },
];

const SEVERITIES: { id: BugSeverity; label: string; icon: string }[] = [
  { id: 'critical', label: 'Critical', icon: '🔴' },
  { id: 'high', label: 'High', icon: '🟠' },
  { id: 'medium', label: 'Medium', icon: '🟡' },
  { id: 'low', label: 'Low', icon: '🟢' },
];

export default function BugReportScreen() {
  const navigation = useNavigation();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [category, setCategory] = useState<BugCategory>('general');
  const [severity, setSeverity] = useState<BugSeverity>('low');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePickImage = () => {
    try {
      launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, (response) => {
        if (response?.errorMessage) {
          console.warn('Image picker info:', response.errorMessage);
          return;
        }
        if (!response?.didCancel && response?.assets && response.assets.length > 0) {
          setImageUri(response.assets[0].uri || null);
        }
      });
    } catch (e: any) {
      console.warn('launchImageLibrary safely handled:', e);
    }
  };

  const handleGoBack = () => {
    try {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('MainTabs' as never);
      }
    } catch (e) {
      console.warn('Navigation goBack error:', e);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      try {
        Toast.show({
          type: 'error',
          text1: 'Validation Required',
          text2: 'Please fill in Title and Description.',
        });
      } catch (e) {
        console.warn('Toast show error:', e);
      }
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitBugReport({
        title: title.trim(),
        description: description.trim(),
        stepsToReproduce: stepsToReproduce.trim(),
        category,
        severity,
        imageUri,
      });
      
      try {
        Toast.show({
          type: 'success',
          text1: res.offline ? 'Bug Saved Locally!' : 'Bug Reported!',
          text2: res.offline ? 'Will sync with Cloud AI on reconnect.' : 'Sent to AI Agent for analysis.',
        });
      } catch (tErr) {
        console.warn('Toast error:', tErr);
      }

      handleGoBack();
    } catch (error: any) {
      console.warn('handleSubmit fallback catch:', error);
      handleGoBack();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <Text style={{ fontSize: 20, color: Colors.textPrimary }}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🐛 Report a Bug</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Category Picker */}
          <Text style={styles.sectionLabel}>Category</Text>
          <View style={styles.chipGrid}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.chip,
                  category === cat.id && styles.chipActive,
                ]}
                onPress={() => setCategory(cat.id)}
              >
                <Text style={styles.chipText}>{cat.icon} {cat.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Severity Picker */}
          <Text style={styles.sectionLabel}>Severity</Text>
          <View style={styles.chipGrid}>
            {SEVERITIES.map((sev) => (
              <TouchableOpacity
                key={sev.id}
                style={[
                  styles.chip,
                  severity === sev.id && styles.chipActive,
                ]}
                onPress={() => setSeverity(sev.id)}
              >
                <Text style={styles.chipText}>{sev.icon} {sev.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Title */}
          <Text style={styles.inputLabel}>Bug Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="Short summary (e.g., Timetable tab blank)"
            placeholderTextColor={Colors.textMuted}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />

          {/* Description */}
          <Text style={styles.inputLabel}>Detailed Description *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Explain what happened and what you expected to see..."
            placeholderTextColor={Colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          {/* Steps to Reproduce */}
          <Text style={styles.inputLabel}>Steps to Reproduce (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="1. Open app&#10;2. Tap Settings&#10;3. Tap Sync..."
            placeholderTextColor={Colors.textMuted}
            value={stepsToReproduce}
            onChangeText={setStepsToReproduce}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          {/* Screenshot Picker */}
          <Text style={styles.inputLabel}>Attach Screenshot (Optional)</Text>
          <TouchableOpacity style={styles.imagePicker} onPress={handlePickImage}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={{ fontSize: 24 }}>📷</Text>
                <Text style={styles.imagePlaceholderText}>Tap to select an image</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitButtonText}>🚀 Submit Bug Report</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  content: {
    padding: Spacing.screenPad,
    paddingBottom: Spacing.xl * 2,
  },
  sectionLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.sm,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  chip: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryLight,
  },
  chipText: {
    ...Typography.caption,
    color: Colors.textPrimary,
  },
  inputLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Typography.body1,
  },
  textArea: {
    minHeight: 90,
  },
  imagePicker: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  imagePlaceholder: {
    alignItems: 'center',
  },
  imagePlaceholderText: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    ...Typography.h3,
    color: '#FFF',
  },
});
