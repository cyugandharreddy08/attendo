import React, {useState, useCallback, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import Clipboard from '@react-native-clipboard/clipboard';
import Toast from 'react-native-toast-message';
import {Colors} from '../theme/colors';
import {Spacing} from '../theme/spacing';
import {Typography} from '../theme/typography';
import {AITimetableEntry} from '../types';
import {bulkInsertFromAI} from '../db/queries/timetable';
import {getAllSubjects} from '../db/queries/subjects';

const VALID_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIME_REGEX = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

export function generateAIPrompt(existingSubjects: string[] = []): string {
  const subjectListStr = existingSubjects.length > 0
    ? `\n- Existing Subject Names in App: ${existingSubjects.join(', ')}. Reuse these exact names whenever possible.`
    : '';

  return `Extract the weekly class timetable from this image and output ONLY valid JSON, with NO explanation or markdown code fences, in this exact format:

{
  "timetable": [
    {
      "subject": "Exact Subject Name",
      "type": "theory",
      "day": "Monday",
      "start_time": "08:55",
      "end_time": "10:35",
      "room": "Room number or blank"
    }
  ]
}

CRITICAL RULES:
1. Subject Type ("type"): Set to "lab" for practicals, laboratories, workshops, or 2-3 hour hands-on lab sessions. Set to "theory" for standard lectures or tutorials.
2. Day Format: Must be full day name (Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday).
3. Time Format: Must be 24-hour HH:MM format (e.g. 08:55, 14:00).
4. 2-Hour / Double Period / Lab Classes: If a class/lab lasts 2 hours or spans 2 periods (e.g. 08:55 to 10:35), output a SINGLE object with start_time "08:55" and end_time "10:35". Do NOT split into two 1-hour entries!
5. 1-Hour Classes: Output a single entry for the 1-hour period.${subjectListStr}
6. Ignore break, lunch, or free periods.
7. Output ONLY raw valid JSON text.`;
}

function parseAIResponse(text: string): AITimetableEntry[] {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed.timetable)) {
    throw new Error('Invalid JSON structure: expected { timetable: [...] }');
  }
  return parsed.timetable;
}

function validateEntries(entries: AITimetableEntry[]): {valid: AITimetableEntry[]; errors: string[]} {
  const valid: AITimetableEntry[] = [];
  const errors: string[] = [];

  entries.forEach((entry, idx) => {
    const errs: string[] = [];
    if (!entry.subject?.trim()) errs.push('missing subject name');
    if (!VALID_DAYS.includes(entry.day)) errs.push(`invalid day "${entry.day}"`);
    if (!TIME_REGEX.test(entry.start_time)) errs.push(`invalid start_time "${entry.start_time}"`);
    if (!TIME_REGEX.test(entry.end_time)) errs.push(`invalid end_time "${entry.end_time}"`);

    if (errs.length > 0) {
      errors.push(`Class #${idx + 1} (${entry.subject ?? 'Unknown'}): ${errs.join(', ')}`);
    } else {
      valid.push(entry);
    }
  });

  return {valid, errors};
}

export default function TimetableScanScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [existingSubjects, setExistingSubjects] = useState<string[]>([]);
  const [pasteText, setPasteText] = useState('');
  const [parsedEntries, setParsedEntries] = useState<AITimetableEntry[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [step, setStep] = useState<'import' | 'preview' | 'done'>('import');
  const [inserting, setInserting] = useState(false);

  useEffect(() => {
    getAllSubjects().then(subs => {
      setExistingSubjects(subs.map(s => s.name));
    }).catch(e => console.error(e));
  }, []);

  const handleCopyPromptAndOpenChatGPT = useCallback(() => {
    const prompt = generateAIPrompt(existingSubjects);
    Clipboard.setString(prompt);

    Toast.show({
      type: 'success',
      text1: 'Prompt Copied!',
      text2: 'Paste prompt in ChatGPT & upload your timetable photo!',
    });

    Linking.openURL('chatgpt://').catch(() =>
      Linking.openURL('https://chatgpt.com').catch(() =>
        Linking.openURL('https://play.google.com/store/apps/details?id=com.openai.chatgpt'),
      ),
    );
  }, [existingSubjects]);

  const handleParseJSON = useCallback(() => {
    if (!pasteText.trim()) {
      Alert.alert('Empty Input', 'Please paste the JSON code response from ChatGPT first.');
      return;
    }

    try {
      const raw = parseAIResponse(pasteText);
      const {valid, errors} = validateEntries(raw);

      if (valid.length === 0) {
        Alert.alert('No Valid Classes', 'Could not parse any valid class entries from the text.');
        return;
      }

      setParsedEntries(valid);
      setParseErrors(errors);
      setCheckedIds(new Set(valid.map((_, i) => i)));
      setStep('preview');
    } catch (e: any) {
      Alert.alert(
        'JSON Format Error',
        `Failed to parse response: ${e.message}\n\nMake sure you copied the full JSON output from ChatGPT.`,
      );
    }
  }, [pasteText]);

  const toggleEntry = useCallback((idx: number) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const handleConfirmImport = useCallback(async () => {
    const toInsert = parsedEntries.filter((_, i) => checkedIds.has(i));
    if (toInsert.length === 0) {
      Alert.alert('Selection Empty', 'Please select at least one class to import.');
      return;
    }

    setInserting(true);
    try {
      await bulkInsertFromAI(toInsert);
      setStep('done');
      Toast.show({
        type: 'success',
        text1: 'Timetable Imported!',
        text2: `Successfully added ${toInsert.length} classes to your schedule.`,
      });
    } catch (e: any) {
      Alert.alert('Import Error', `Failed to save timetable: ${e.message}`);
    } finally {
      setInserting(false);
    }
  }, [parsedEntries, checkedIds]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, {paddingTop: insets.top + 8}]}
      keyboardShouldPersistTaps="handled">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Timetable Import</Text>
        <View style={{width: 60}} />
      </View>

      {/* Import Form Step */}
      {step === 'import' && (
        <>
          {/* Guide Card */}
          <View style={styles.guideCard}>
            <Text style={styles.guideTitle}>🚀 How to Import Timetable via ChatGPT:</Text>
            <Text style={styles.guideStep}>1. Tap <Text style={styles.highlight}>Copy Prompt & Open ChatGPT</Text> below.</Text>
            <Text style={styles.guideStep}>2. In ChatGPT, upload your timetable photo & paste prompt.</Text>
            <Text style={styles.guideStep}>3. Copy ChatGPT's JSON output & paste it in the box below!</Text>
          </View>

          {/* Action Button: Copy & Launch ChatGPT */}
          <TouchableOpacity
            style={styles.launchBtn}
            onPress={handleCopyPromptAndOpenChatGPT}
            activeOpacity={0.85}>
            <Text style={styles.launchBtnText}>⚡ 1. Copy Prompt & Open ChatGPT App</Text>
          </TouchableOpacity>

          {/* Paste JSON Box */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Paste ChatGPT JSON Response</Text>
            <TextInput
              style={styles.pasteInput}
              placeholder='Paste JSON output here... e.g. { "timetable": [...] }'
              placeholderTextColor='#555570'
              value={pasteText}
              onChangeText={setPasteText}
              multiline
              numberOfLines={9}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={styles.parseBtn}
              onPress={handleParseJSON}
              activeOpacity={0.85}>
              <Text style={styles.parseBtnText}>Parse & Preview Timetable →</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Preview Confirmation Step */}
      {step === 'preview' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            3. Confirm Classes ({checkedIds.size}/{parsedEntries.length} selected)
          </Text>

          {parseErrors.length > 0 && (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>⚠️ {parseErrors.length} entries skipped:</Text>
              {parseErrors.map((e, i) => (
                <Text key={i} style={styles.errorText}>• {e}</Text>
              ))}
            </View>
          )}

          {parsedEntries.map((entry, idx) => {
            const isChecked = checkedIds.has(idx);
            return (
              <TouchableOpacity
                key={idx}
                style={[styles.entryRow, !isChecked && styles.entryRowUnchecked]}
                onPress={() => toggleEntry(idx)}
                activeOpacity={0.8}>
                <Text style={styles.entryCheck}>{isChecked ? '☑' : '☐'}</Text>
                <View style={styles.entryInfo}>
                  <Text style={styles.entrySubject}>{entry.subject}</Text>
                  <Text style={styles.entryDetails}>
                    {entry.day} · {entry.start_time}–{entry.end_time}
                    {entry.room ? ` · Room ${entry.room}` : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}

          <View style={styles.btnRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setStep('import')}>
              <Text style={styles.cancelBtnText}>Back</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.confirmBtn, inserting && {opacity: 0.5}]}
              disabled={inserting}
              onPress={handleConfirmImport}>
              <Text style={styles.confirmBtnText}>
                {inserting ? 'Importing...' : `Import ${checkedIds.size} Classes`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Done Confirmation Step */}
      {step === 'done' && (
        <View style={styles.doneContainer}>
          <Text style={styles.doneIcon}>🎉</Text>
          <Text style={styles.doneTitle}>Timetable Imported!</Text>
          <Text style={styles.doneSub}>Your schedule and subjects have been saved cleanly.</Text>
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => navigation.goBack()}>
            <Text style={styles.doneBtnText}>Return to Timetable</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.screenPad,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backBtn: {
    paddingVertical: 6,
    paddingRight: 12,
  },
  backText: {
    ...Typography.body1,
    color: Colors.primaryLight,
    fontWeight: '600',
  },
  headerTitle: {
    ...Typography.h3,
  },
  guideCard: {
    backgroundColor: Colors.card,
    borderRadius: Spacing.cardRadius,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  guideTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  guideStep: {
    ...Typography.body2,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  highlight: {
    color: Colors.primaryLight,
    fontWeight: '700',
  },
  launchBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Spacing.cardRadius,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  launchBtnText: {
    ...Typography.body1,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    ...Typography.h4,
    marginBottom: 10,
  },
  pasteInput: {
    backgroundColor: Colors.surface,
    borderRadius: Spacing.cardRadius,
    padding: 14,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: 13,
    fontFamily: 'monospace',
    minHeight: 140,
    marginBottom: 12,
  },
  parseBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Spacing.cardRadius,
    paddingVertical: 14,
    alignItems: 'center',
  },
  parseBtnText: {
    ...Typography.body1,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Spacing.cardRadius,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  entryRowUnchecked: {
    opacity: 0.4,
  },
  entryCheck: {
    fontSize: 20,
    color: Colors.primaryLight,
    marginRight: 12,
  },
  entryInfo: {
    flex: 1,
  },
  entrySubject: {
    ...Typography.body1,
    fontWeight: '600',
  },
  entryDetails: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  errorBox: {
    backgroundColor: Colors.absent + '22',
    borderColor: Colors.absent,
    borderWidth: 1,
    borderRadius: Spacing.cardRadius,
    padding: 12,
    marginBottom: 12,
  },
  errorTitle: {
    ...Typography.caption,
    color: Colors.absent,
    fontWeight: '700',
    marginBottom: 4,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.textPrimary,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Spacing.cardRadius,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText: {
    ...Typography.body1,
    color: Colors.textSecondary,
  },
  confirmBtn: {
    flex: 2,
    backgroundColor: Colors.present,
    borderRadius: Spacing.cardRadius,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmBtnText: {
    ...Typography.body1,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  doneContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  doneIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  doneTitle: {
    ...Typography.h2,
    marginBottom: 8,
  },
  doneSub: {
    ...Typography.body2,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  doneBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Spacing.cardRadius,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  doneBtnText: {
    ...Typography.body1,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
