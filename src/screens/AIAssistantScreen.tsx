import React, {useState, useRef, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Colors} from '../theme/colors';
import {Spacing} from '../theme/spacing';
import {Typography} from '../theme/typography';
import AnimatedPressable from '../components/AnimatedPressable';
import {sendChatMessageToProxy, ChatMessage} from '../services/GroqAIService';
import {AIActionCardData} from '../services/AIToolRegistry';
import {getActiveAIApiKey, setActiveAIApiKey, getActiveAIModel, setActiveAIModel, AI_MODELS} from '../config/aiConfig';

const QUICK_PROMPTS = [
  '🌴 Can I bunk tomorrow?',
  '📅 Classes run till Dec 20, how many can I skip?',
  '🔄 Shift tomorrow’s class to Thursday leisure hour',
  '📊 What is my current attendance status?',
  '⚠️ Which subjects are in the danger zone?',
];

export default function AIAssistantScreen({navigation}: any) {
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome_1',
      role: 'assistant',
      content:
        "👋 Hey! I'm **Proxy**, your attendance wingman.\n\nI can calculate your safe bunks, analyze consequences of missing classes, reschedule timetable slots into leisure hours, or project how many classes you can skip before semester exams.\n\nWhat are you planning today?",
      timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}),
    },
  ]);

  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [customKey, setCustomKey] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>(AI_MODELS.REASONING_120B);

  useEffect(() => {
    (async () => {
      const key = await getActiveAIApiKey();
      setCustomKey(key);
      const model = await getActiveAIModel();
      setSelectedModel(model);
    })();
  }, []);

  const handleSend = async (overridePrompt?: string) => {
    const textToSend = (overridePrompt || inputText).trim();
    if (!textToSend || loading) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}),
    };

    const updated = [...messages, userMsg];
    setMessages(updated);
    setInputText('');
    setLoading(true);

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({animated: true});
    }, 100);

    try {
      const res = await sendChatMessageToProxy(textToSend, updated);
      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: res.content,
        actionCard: res.actionCard,
        timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `ai_err_${Date.now()}`,
        role: 'assistant',
        content: '⚠️ Something went wrong processing your request. Please try again.',
        timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({animated: true});
      }, 150);
    }
  };

  const saveSettings = async () => {
    await setActiveAIApiKey(customKey.trim());
    await setActiveAIModel(selectedModel);
    setSettingsModalVisible(false);
    Alert.alert('Settings Saved', 'Proxy AI configuration updated successfully!');
  };

  const renderActionCard = (card: AIActionCardData) => {
    const isDanger = card.type === 'consequence_warning' && card.title.includes('Danger');
    const isSafe = card.type === 'consequence_warning' && !card.title.includes('Danger');

    return (
      <View
        style={[
          styles.actionCard,
          isDanger && styles.actionCardDanger,
          isSafe && styles.actionCardSafe,
        ]}>
        <Text style={[styles.cardTitle, isDanger && {color: Colors.absent}]}>
          {card.title}
        </Text>
        <Text style={styles.cardDesc}>{card.description}</Text>
        {card.details?.subject && (
          <View style={styles.cardDetailRow}>
            <Text style={styles.cardDetailLabel}>Subject:</Text>
            <Text style={styles.cardDetailValue}>{card.details.subject}</Text>
          </View>
        )}
        {card.details?.from && (
          <View style={styles.cardDetailRow}>
            <Text style={styles.cardDetailLabel}>Original:</Text>
            <Text style={styles.cardDetailValue}>{card.details.from}</Text>
          </View>
        )}
        {card.details?.to && (
          <View style={styles.cardDetailRow}>
            <Text style={styles.cardDetailLabel}>Moved To:</Text>
            <Text style={[styles.cardDetailValue, {color: Colors.primaryLight}]}>
              {card.details.to}
            </Text>
          </View>
        )}
        {card.details?.impact && (
          <View style={styles.cardDetailRow}>
            <Text style={styles.cardDetailLabel}>Impact:</Text>
            <Text style={[styles.cardDetailValue, {color: isDanger ? Colors.absent : Colors.present}]}>
              {card.details.impact}
            </Text>
          </View>
        )}
      </View>
    );
  };

  // Helper to render bold markdown (**text**) and lists neatly
  const renderFormattedText = (raw: string, isUser: boolean) => {
    const lines = raw.split('\n');
    return lines.map((line, lIdx) => {
      // Split line by bold segments
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <Text
          key={lIdx}
          style={[
            styles.messageText,
            isUser ? styles.userMessageText : styles.assistantMessageText,
            line.trim() === '' && {height: 6},
          ]}>
          {parts.map((p, pIdx) => {
            if (p.startsWith('**') && p.endsWith('**')) {
              return (
                <Text key={pIdx} style={styles.boldText}>
                  {p.slice(2, -2)}
                </Text>
              );
            }
            return <Text key={pIdx}>{p}</Text>;
          })}
        </Text>
      );
    });
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, {paddingTop: insets.top}]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Top Header */}
      <View style={styles.header}>
        <AnimatedPressable
          physics="snappy"
          onPress={() => navigation.goBack()}
          style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </AnimatedPressable>
        <View style={styles.headerCenter}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>Proxy AI</Text>
            <View style={styles.onlineDot} />
          </View>
          <Text style={styles.headerSubtitle}>
            Attendance Wingman · GPT-OSS 120B
          </Text>
        </View>
        <AnimatedPressable
          physics="gentle"
          onPress={() => setSettingsModalVisible(true)}
          style={styles.settingsIconBtn}>
          <Text style={styles.settingsIconText}>⚙️</Text>
        </AnimatedPressable>
      </View>

      {/* Chat Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messageList}
        contentContainerStyle={styles.messageContent}
        showsVerticalScrollIndicator={false}>
        {messages.map(msg => {
          const isUser = msg.role === 'user';
          return (
            <View
              key={msg.id}
              style={[
                styles.bubbleWrapper,
                isUser ? styles.userBubbleWrapper : styles.aiBubbleWrapper,
              ]}>
              {!isUser && (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>🤖</Text>
                </View>
              )}
              <View
                style={[
                  styles.bubble,
                  isUser ? styles.userBubble : styles.aiBubble,
                ]}>
                {renderFormattedText(msg.content, isUser)}
                {msg.actionCard && renderActionCard(msg.actionCard)}
                <Text
                  style={[
                    styles.timeText,
                    isUser ? styles.userTimeText : styles.aiTimeText,
                  ]}>
                  {msg.timestamp}
                </Text>
              </View>
            </View>
          );
        })}

        {loading && (
          <View style={styles.loadingBubbleWrapper}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>🤖</Text>
            </View>
            <View style={[styles.bubble, styles.aiBubble, styles.loadingBubble]}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.loadingText}>
                Proxy is checking your schedule & calculations...
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Quick Prompt Carousel */}
      <View style={styles.quickPromptSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickPromptScroll}>
          {QUICK_PROMPTS.map((prompt, idx) => (
            <AnimatedPressable
              key={idx}
              physics="bouncy"
              scaleTo={0.92}
              style={styles.quickPromptChip}
              onPress={() => handleSend(prompt)}>
              <Text style={styles.quickPromptText}>{prompt}</Text>
            </AnimatedPressable>
          ))}
        </ScrollView>
      </View>

      {/* Input Bar */}
      <View style={[styles.inputBar, {paddingBottom: Math.max(insets.bottom, Spacing.sm)}]}>
        <TextInput
          style={styles.input}
          placeholder="Ask Proxy anything..."
          placeholderTextColor={Colors.textMuted}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
        />
        <AnimatedPressable
          physics="snappy"
          scaleTo={0.88}
          glowOnPress={true}
          glowColor={Colors.primary}
          style={[styles.sendBtn, (!inputText.trim() || loading) && styles.sendBtnDisabled]}
          onPress={() => handleSend()}>
          <Text style={styles.sendBtnText}>↑</Text>
        </AnimatedPressable>
      </View>

      {/* Settings Modal */}
      <Modal
        visible={settingsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSettingsModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>⚙️ Proxy AI Configuration</Text>
            <Text style={styles.modalSub}>
              Attendo connects via Groq's high-speed inference engine.
            </Text>

            <Text style={styles.label}>Groq API Key</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="gsk_..."
              placeholderTextColor={Colors.textMuted}
              value={customKey}
              onChangeText={setCustomKey}
              secureTextEntry
              autoCapitalize="none"
            />
            <Text style={styles.inputHint}>
              Free Groq key included. You can replace with your own for unlimited quota.
            </Text>

            <Text style={[styles.label, {marginTop: Spacing.md}]}>AI Model</Text>
            <View style={styles.modelRow}>
              {[
                {label: 'GPT-OSS 120B (Reasoning)', val: AI_MODELS.REASONING_120B},
                {label: 'GPT-OSS 20B (Fast)', val: AI_MODELS.FAST_20B},
              ].map(m => (
                <AnimatedPressable
                  key={m.val}
                  physics="gentle"
                  style={[
                    styles.modelChip,
                    selectedModel === m.val && styles.modelChipActive,
                  ]}
                  onPress={() => setSelectedModel(m.val)}>
                  <Text
                    style={[
                      styles.modelChipText,
                      selectedModel === m.val && styles.modelChipTextActive,
                    ]}>
                    {m.label}
                  </Text>
                </AnimatedPressable>
              ))}
            </View>

            <View style={styles.modalActionRow}>
              <AnimatedPressable
                physics="gentle"
                style={styles.modalCancelBtn}
                onPress={() => setSettingsModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </AnimatedPressable>
              <AnimatedPressable
                physics="snappy"
                style={styles.modalSaveBtn}
                onPress={saveSettings}>
                <Text style={styles.modalSaveText}>Save Settings</Text>
              </AnimatedPressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
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
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  backBtnText: {
    fontSize: 24,
    color: Colors.textPrimary,
    lineHeight: 28,
  },
  headerCenter: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.present,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Colors.primaryLight,
  },
  settingsIconBtn: {
    padding: 6,
  },
  settingsIconText: {
    fontSize: 20,
  },
  messageList: {
    flex: 1,
  },
  messageContent: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  bubbleWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  userBubbleWrapper: {
    justifyContent: 'flex-end',
  },
  aiBubbleWrapper: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarText: {
    fontSize: 16,
  },
  bubble: {
    maxWidth: '82%',
    padding: Spacing.md,
    borderRadius: 18,
  },
  userBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    ...Typography.body2,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  assistantMessageText: {
    color: Colors.textPrimary,
  },
  boldText: {
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  timeText: {
    fontSize: 10,
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  userTimeText: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  aiTimeText: {
    color: Colors.textMuted,
  },
  loadingBubbleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  loadingText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  quickPromptSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.card,
  },
  quickPromptScroll: {
    paddingHorizontal: Spacing.md,
    gap: 8,
  },
  quickPromptChip: {
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  quickPromptText: {
    ...Typography.caption,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    backgroundColor: Colors.card,
    gap: Spacing.xs,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    backgroundColor: Colors.surface,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    ...Typography.body2,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  actionCard: {
    marginTop: 10,
    padding: 12,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  actionCardDanger: {
    borderColor: Colors.absent,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  actionCardSafe: {
    borderColor: Colors.present,
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
  },
  cardTitle: {
    ...Typography.body2,
    fontWeight: '700',
    color: Colors.primaryLight,
    marginBottom: 4,
  },
  cardDesc: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  cardDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  cardDetailLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  cardDetailValue: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalCard: {
    width: '100%',
    backgroundColor: Colors.card,
    padding: Spacing.lg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  modalSub: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  label: {
    ...Typography.body2,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputHint: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
  },
  modelRow: {
    gap: 8,
    marginTop: 6,
  },
  modelChip: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modelChipActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
  },
  modelChipText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  modelChipTextActive: {
    color: Colors.primaryLight,
    fontWeight: 'bold',
  },
  modalActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalCancelText: {
    ...Typography.body2,
    color: Colors.textSecondary,
  },
  modalSaveBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  modalSaveText: {
    ...Typography.body2,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
