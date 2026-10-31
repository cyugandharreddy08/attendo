import {executeSql, rowsToArray} from '../database';
import {getOverallStreak, getOverallAttendanceStats} from './lectureInstances';

export interface AchievementBadge {
  id: string;
  title: string;
  description: string;
  icon: string;
  isUnlocked: boolean;
  unlockedAt?: string;
  progressText: string;
}

export async function getUnlockedAchievements(): Promise<AchievementBadge[]> {
  const [streak, overallStats] = await Promise.all([
    getOverallStreak(),
    getOverallAttendanceStats(75),
  ]);

  const totalClassesRes = await executeSql(
    "SELECT COUNT(*) as count FROM lecture_instances WHERE status = 'present'",
  );
  const totalAttendedCount = rowsToArray<{count: number}>(totalClassesRes)[0]?.count || 0;

  const badges: AchievementBadge[] = [
    {
      id: 'streak_3',
      title: 'Hatching Flame',
      description: 'Maintain a 3-class attendance streak',
      icon: '🐣',
      isUnlocked: streak >= 3,
      progressText: `${Math.min(streak, 3)} / 3 classes`,
    },
    {
      id: 'streak_7',
      title: 'On Fire 7',
      description: 'Maintain a 7-class attendance streak',
      icon: '🔥',
      isUnlocked: streak >= 7,
      progressText: `${Math.min(streak, 7)} / 7 classes`,
    },
    {
      id: 'streak_15',
      title: 'Ironclad Regular',
      description: 'Maintain a 15-class attendance streak',
      icon: '⚡',
      isUnlocked: streak >= 15,
      progressText: `${Math.min(streak, 15)} / 15 classes`,
    },
    {
      id: 'overall_80',
      title: 'Scholar 80%',
      description: 'Maintain overall attendance >= 80%',
      icon: '🎯',
      isUnlocked: overallStats.totalPercent >= 80 && overallStats.totalClasses > 0,
      progressText: `${overallStats.totalPercent}% / 80%`,
    },
    {
      id: 'overall_90',
      title: 'Ironclad 90%',
      description: 'Maintain overall attendance >= 90%',
      icon: '🏆',
      isUnlocked: overallStats.totalPercent >= 90 && overallStats.totalClasses > 0,
      progressText: `${overallStats.totalPercent}% / 90%`,
    },
    {
      id: 'classes_50',
      title: 'Century Half',
      description: 'Attend 50 total classes',
      icon: '🛡️',
      isUnlocked: totalAttendedCount >= 50,
      progressText: `${Math.min(totalAttendedCount, 50)} / 50 attended`,
    },
  ];

  return badges;
}
