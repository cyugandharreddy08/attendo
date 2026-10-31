import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import {Colors} from '../theme/colors';
import {Spacing} from '../theme/spacing';
import {Typography} from '../theme/typography';
import {
  getUnlockedAchievements,
  AchievementBadge,
} from '../db/queries/achievements';

interface Props {
  isVisible: boolean;
  onClose: () => void;
}

export default function AchievementsModal({isVisible, onClose}: Props) {
  const [badges, setBadges] = useState<AchievementBadge[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (isVisible) {
      getUnlockedAchievements().then(b => {
        setBadges(b);
        if (b.some(item => item.isUnlocked)) {
          setShowConfetti(true);
        }
      });
    }
  }, [isVisible]);

  return (
    <Modal visible={isVisible} animationType="slide" transparent>
      <View style={styles.overlay}>
        {showConfetti && (
          <ConfettiCannon
            count={60}
            origin={{x: 200, y: 0}}
            fadeOut
            fallSpeed={3000}
          />
        )}
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>🏆 Academic Achievements</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.desc}>
            Unlock milestone badges by maintaining regular attendance streaks and target percentages!
          </Text>

          <ScrollView contentContainerStyle={styles.badgeGrid} showsVerticalScrollIndicator={false}>
            {badges.map(b => (
              <View
                key={b.id}
                style={[
                  styles.badgeCard,
                  !b.isUnlocked && styles.badgeLocked,
                ]}>
                <Text style={styles.badgeIcon}>{b.icon}</Text>
                <View style={{flex: 1}}>
                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                    <Text style={styles.badgeTitle}>{b.title}</Text>
                    {b.isUnlocked && (
                      <View style={styles.unlockedTag}>
                        <Text style={styles.unlockedTagText}>✓ Unlocked</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.badgeDesc}>{b.description}</Text>
                  <Text style={styles.progressText}>{b.progressText}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
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
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
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
  badgeGrid: {
    gap: 10,
    paddingBottom: 20,
  },
  badgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: Spacing.cardRadius,
    borderWidth: 1,
    borderColor: Colors.primary + '55',
    gap: 12,
  },
  badgeLocked: {
    opacity: 0.45,
    borderColor: Colors.border,
  },
  badgeIcon: {
    fontSize: 32,
  },
  badgeTitle: {
    ...Typography.h4,
    fontSize: 15,
  },
  badgeDesc: {
    ...Typography.body2,
    fontSize: 12,
    marginTop: 2,
  },
  progressText: {
    ...Typography.caption,
    marginTop: 4,
    color: Colors.primaryLight,
  },
  unlockedTag: {
    backgroundColor: Colors.present + '33',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  unlockedTagText: {
    color: Colors.present,
    fontSize: 10,
    fontWeight: '700',
  },
});
