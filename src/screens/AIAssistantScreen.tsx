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
import AttendoVectorLogo from '../components/AttendoVectorLogo';
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

interface MarkdownBlock {
  type: 'paragraph' | 'table' | 'heading' | 'callout' | 'bullet';
  level?: number;
  text?: string;
  headers?: string[];
  rows?: string[][];
}

function parseMarkdownBlocks(text: string): MarkdownBlock[] {
  const lines = text.split('\n');
  const blocks: MarkdownBlock[] = [];
  let currentTable: {type: 'table'; headers: string[]; rows: string[][]} | null = null;
  let currentParagraph: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      blocks.push({
        type: 'paragraph',
        text: currentParagraph.join('\n'),
      });
      currentParagraph = [];
    }
  };

  const flushTable = () => {
    if (currentTable) {
      blocks.push(currentTable);
      currentTable = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    const isTableRow = line.startsWith('|') && line.endsWith('|') && line.length > 2;
    const isTableSeparator = isTableRow && /^\|[-:\s|]+\|$/.test(line);

    if (isTableRow) {
      flushParagraph();
      const cells = line.split('|').slice(1, -1).map(c => c.trim());

      if (!currentTable) {
        const nextLine = lines[i + 1]?.trim() || '';
        if (nextLine.startsWith('|') && /^\|[-:\s|]+\|$/.test(nextLine)) {
          currentTable = {
            type: 'table',
            headers: cells,
            rows: [],
          };
          i++; // skip separator line
          continue;
        }
      } else {
        if (!isTableSeparator) {
          currentTable.rows.push(cells);
        }
        continue;
      }
    } else {
      flushTable();
    }

    if (!isTableRow) {
      if (line.startsWith('### ')) {
        flushParagraph();
        blocks.push({type: 'heading', level: 3, text: line.replace('### ', '')});
      } else if (line.startsWith('## ')) {
        flushParagraph();
        blocks.push({type: 'heading', level: 2, text: line.replace('## ', '')});
      } else if (line.startsWith('# ')) {
        flushParagraph();
        blocks.push({type: 'heading', level: 1, text: line.replace('# ', '')});
      } else if (
        line.startsWith('> ') ||
        line.startsWith('⚠️') ||
        line.startsWith('🚨') ||
        line.startsWith('💡') ||
        line.startsWith('🌴')
      ) {
        flushParagraph();
        blocks.push({type: 'callout', text: line.replace(/^>\s*/, '')});
      } else if (line.startsWith('• ') || line.startsWith('- ') || line.startsWith('* ')) {
        flushParagraph();
        blocks.push({type: 'bullet', text: line.replace(/^([•\-\*]\s+)/, '')});
      } else if (line === '') {
        flushParagraph();
      } else {
        currentParagraph.push(rawLine);
      }
    }
  }

  flushTable();
  flushParagraph();
  return blocks;
}

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

  // Helper to render bold markdown (**text**), percentages, and arrows neatly
  const renderInlineFormatted = (raw: string, isUser: boolean, isCallout: boolean = false) => {
    const parts = raw.split(/(\*\*.*?\*\*)/g);
    return parts.map((p, pIdx) => {
      if (p.startsWith('**') && p.endsWith('**')) {
        const boldContent = p.slice(2, -2);
        return (
          <Text
            key={pIdx}
            style={[
              styles.boldText,
              isUser ? {color: '#FFFFFF'} : {color: '#F4F4FF'},
              isCallout && {color: '#FFFFFF', fontWeight: 'bold'},
            ]}>
            {boldContent}
          </Text>
        );
      }
      return <Text key={pIdx}>{p}</Text>;
    });
  };

  // Render a Rich Table with column styling, chips, and neon accents
  const renderTableBlock = (headers: string[] = [], rows: string[][] = [], key: string) => {
    if (headers.length === 0 && rows.length === 0) return null;

    const isWide = headers.length > 3;

    const renderTableContent = () => (
      <View style={styles.tableCard}>
        {/* Table Header Row */}
        <View style={styles.tableHeaderRow}>
          {headers.map((h, hIdx) => {
            const hLower = h.toLowerCase();
            let flexVal = 1;
            if (hLower.includes('sub')) flexVal = 1.6;
            else if (hLower.includes('time') || hLower.includes('hour')) flexVal = 1.3;
            else if (hLower.includes('stat') || hLower.includes('room')) flexVal = 0.9;

            return (
              <View
                key={hIdx}
                style={[
                  styles.tableHeaderCell,
                  !isWide && {flex: flexVal},
                  isWide && {width: 110},
                ]}>
                <Text style={styles.tableHeaderText}>{h.toUpperCase()}</Text>
              </View>
            );
          })}
        </View>

        {/* Table Data Rows */}
        {rows.map((row, rIdx) => {
          const isOdd = rIdx % 2 === 1;
          return (
            <View
              key={rIdx}
              style={[
                styles.tableDataRow,
                isOdd && styles.tableDataRowOdd,
                rIdx === rows.length - 1 && {borderBottomWidth: 0},
              ]}>
              {row.map((cell, cIdx) => {
                const headerName = (headers[cIdx] || '').toLowerCase();
                let flexVal = 1;
                if (headerName.includes('sub')) flexVal = 1.6;
                else if (headerName.includes('time') || headerName.includes('hour')) flexVal = 1.3;
                else if (headerName.includes('stat') || headerName.includes('room')) flexVal = 0.9;

                const isSubject = headerName.includes('sub');
                const isTime = headerName.includes('time') || headerName.includes('hour');
                const isRoom = headerName.includes('room');
                const isStatus =
                  headerName.includes('stat') ||
                  cell.includes('🟢') ||
                  cell.includes('🔴') ||
                  cell.toLowerCase().includes('safe') ||
                  cell.toLowerCase().includes('danger') ||
                  cell.toLowerCase().includes('regular');

                const isCritical =
                  cell.toLowerCase().includes('danger') ||
                  cell.toLowerCase().includes('critical') ||
                  cell.includes('🔴') ||
                  cell.toLowerCase().includes('at risk');
                const isSafe =
                  cell.toLowerCase().includes('safe') ||
                  cell.includes('🟢') ||
                  cell.toLowerCase().includes('regular');

                return (
                  <View
                    key={cIdx}
                    style={[
                      styles.tableDataCell,
                      !isWide && {flex: flexVal},
                      isWide && {width: 110},
                    ]}>
                    {isStatus ? (
                      <View
                        style={[
                          styles.tableStatusChip,
                          isCritical && styles.tableStatusChipCritical,
                          isSafe && styles.tableStatusChipSafe,
                        ]}>
                        <Text
                          style={[
                            styles.tableStatusText,
                            isCritical && {color: Colors.absent},
                            isSafe && {color: Colors.present},
                          ]}>
                          {cell}
                        </Text>
                      </View>
                    ) : isRoom ? (
                      <View style={styles.tableRoomChip}>
                        <Text style={styles.tableRoomText}>📍 {cell.replace('📍', '').trim()}</Text>
                      </View>
                    ) : (
                      <View style={isSubject ? styles.subjectCellWrapper : null}>
                        {isSubject && <View style={styles.subjectDot} />}
                        <Text
                          style={[
                            styles.tableCellText,
                            isSubject && styles.tableCellSubjectText,
                            isTime && styles.tableCellTimeText,
                          ]}
                          numberOfLines={2}>
                          {renderInlineFormatted(cell, false)}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })}
      </View>
    );

    if (isWide) {
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} key={key} style={styles.tableScroll}>
          {renderTableContent()}
        </ScrollView>
      );
    }
    return <View key={key}>{renderTableContent()}</View>;
  };

  // Render full message parsed into structured blocks
  const renderMessageBlocks = (content: string, isUser: boolean) => {
    if (isUser) {
      return (
        <Text style={[styles.messageText, styles.userMessageText]}>
          {renderInlineFormatted(content, true)}
        </Text>
      );
    }

    const blocks = parseMarkdownBlocks(content);

    return blocks.map((block, idx) => {
      const blockKey = `blk_${idx}`;

      if (block.type === 'table') {
        return renderTableBlock(block.headers, block.rows, blockKey);
      }

      if (block.type === 'heading') {
        const isH2 = block.level === 2;
        return (
          <View
            key={blockKey}
            style={[styles.headingWrapper, isH2 && styles.heading2Wrapper]}>
            <View style={styles.headingAccentPill} />
            <Text style={[styles.headingText, isH2 && styles.heading2Text]}>
              {block.text}
            </Text>
          </View>
        );
      }

      if (block.type === 'callout') {
        const text = block.text || '';
        const isDanger =
          text.includes('⚠️') ||
          text.toLowerCase().includes('danger') ||
          text.toLowerCase().includes('detention') ||
          text.toLowerCase().includes('critical');
        const isSafe =
          text.includes('🌴') ||
          text.toLowerCase().includes('safe') ||
          text.toLowerCase().includes('congrat');

        return (
          <View
            key={blockKey}
            style={[
              styles.calloutCard,
              isDanger && styles.calloutDanger,
              isSafe && styles.calloutSafe,
            ]}>
            <Text
              style={[
                styles.calloutText,
                isDanger && styles.calloutTextDanger,
                isSafe && styles.calloutTextSafe,
              ]}>
              {renderInlineFormatted(text, false, true)}
            </Text>
          </View>
        );
      }

      if (block.type === 'bullet') {
        return (
          <View key={blockKey} style={styles.bulletRow}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>
              {renderInlineFormatted(block.text || '', false)}
            </Text>
          </View>
        );
      }

      // Paragraph
      return (
        <Text key={blockKey} style={[styles.messageText, styles.assistantMessageText]}>
          {renderInlineFormatted(block.text || '', false)}
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
            <AttendoVectorLogo size={24} variant="floating" style={{marginRight: 6}} />
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
                {renderMessageBlocks(msg.content, isUser)}
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
                Proxy is calculating schedule & attendance impact...
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
    padding: Spacing.md,
    borderRadius: 18,
  },
  userBubble: {
    maxWidth: '82%',
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    maxWidth: '94%',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    ...Typography.body2,
    lineHeight: 22,
    marginVertical: 2,
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

  // Table Card Styles
  tableScroll: {
    marginVertical: 6,
  },
  tableCard: {
    backgroundColor: '#12121E',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#26263B',
    overflow: 'hidden',
    marginVertical: 6,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(139, 92, 246, 0.18)',
    borderBottomWidth: 1,
    borderBottomColor: '#363652',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tableHeaderCell: {
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  tableHeaderText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#C4B5FD',
    letterSpacing: 0.8,
  },
  tableDataRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
    paddingVertical: 9,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  tableDataRowOdd: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  tableDataCell: {
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  tableCellText: {
    fontSize: 12,
    color: Colors.textPrimary,
    lineHeight: 16,
  },
  tableCellSubjectText: {
    fontWeight: '700',
    color: '#F4F4FF',
  },
  tableCellTimeText: {
    color: '#A0A0C0',
    fontSize: 11,
  },
  subjectCellWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subjectDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primaryLight,
  },
  tableStatusChip: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
    alignSelf: 'flex-start',
  },
  tableStatusChipSafe: {
    borderColor: 'rgba(34, 197, 94, 0.4)',
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  tableStatusChipCritical: {
    borderColor: 'rgba(239, 68, 68, 0.4)',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  tableStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  tableRoomChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.3)',
    alignSelf: 'flex-start',
  },
  tableRoomText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#93C5FD',
  },

  // Headings
  headingWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  heading2Wrapper: {
    marginTop: 12,
    marginBottom: 6,
  },
  headingAccentPill: {
    width: 3,
    height: 14,
    borderRadius: 1.5,
    backgroundColor: Colors.primaryLight,
  },
  headingText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#C4B5FD',
  },
  heading2Text: {
    fontSize: 15,
    fontWeight: '800',
    color: '#EDE9FE',
  },

  // Callouts
  calloutCard: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    padding: 10,
    borderRadius: 8,
    marginVertical: 6,
  },
  calloutDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderLeftColor: Colors.absent,
  },
  calloutSafe: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderLeftColor: Colors.present,
  },
  calloutText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#DDD6FE',
  },
  calloutTextDanger: {
    color: '#FCA5A5',
  },
  calloutTextSafe: {
    color: '#86EFAC',
  },

  // Bullets
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 2,
    paddingLeft: 4,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.primaryLight,
    marginTop: 8,
    marginRight: 8,
  },
  bulletText: {
    flex: 1,
    ...Typography.body2,
    color: Colors.textPrimary,
    lineHeight: 20,
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
