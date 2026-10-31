import notifee, {
  TriggerType,
  RepeatFrequency,
  TimestampTrigger,
  AndroidImportance,
  AndroidCategory,
  EventType,
} from '@notifee/react-native';
import {format} from 'date-fns';
import {TodoItem} from '../types';
import {getUnmarkedTodayCount, getInstancesForDate} from '../db/queries/lectureInstances';

const CHANNEL_ID = 'attendance_nudge';
const CLASS_CHANNEL_ID = 'class_reminders';
const NOTIFICATION_ID = 'end_of_day_nudge';

async function createChannel(): Promise<void> {
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Attendance Nudge',
    importance: AndroidImportance.HIGH,
    vibration: true,
  });
}

async function createClassChannel(): Promise<void> {
  await notifee.createChannel({
    id: CLASS_CHANNEL_ID,
    name: 'Class Start Reminders',
    importance: AndroidImportance.HIGH,
    vibration: true,
  });
}

export async function scheduleClassReminders(leadMinutes: number = 10): Promise<void> {
  try {
    if (leadMinutes <= 0) return;
    await createClassChannel();

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const todayClasses = await getInstancesForDate(todayStr);
    const now = new Date();

    for (const cls of todayClasses) {
      if (!cls.start_time || cls.status === 'holiday' || cls.status === 'cancelled') continue;

      const [h, m] = cls.start_time.split(':').map(Number);
      const classStart = new Date();
      classStart.setHours(h, m, 0, 0);

      const triggerDate = new Date(classStart.getTime() - leadMinutes * 60 * 1000);

      if (triggerDate > now) {
        const notifId = `class_reminder_${cls.id}`;
        await notifee.cancelNotification(notifId);

        const timestampTrigger: TimestampTrigger = {
          type: TriggerType.TIMESTAMP,
          timestamp: triggerDate.getTime(),
        };

        await notifee.createTriggerNotification(
          {
            id: notifId,
            title: `⏰ ${cls.subject?.name ?? 'Class'} in ${leadMinutes} Mins!`,
            body: `${cls.start_time}–${cls.end_time} ${cls.room ? `(${cls.room})` : ''}`,
            android: {
              channelId: CLASS_CHANNEL_ID,
              importance: AndroidImportance.HIGH,
              category: AndroidCategory.REMINDER,
              pressAction: {
                id: 'open_timetable',
                launchActivity: 'default',
              },
            },
          },
          timestampTrigger,
        );
      }
    }
  } catch (e) {
    console.error('Failed to schedule class reminders:', e);
  }
}

export async function scheduleEndOfDayNudge(hour: number = 20, minute: number = 0): Promise<void> {
  try {
    await createChannel();

    // Cancel any existing
    await notifee.cancelNotification(NOTIFICATION_ID);

    const now = new Date();
    const trigger = new Date();
    trigger.setHours(hour, minute, 0, 0);

    // If the time today has already passed, schedule for tomorrow
    if (trigger <= now) {
      trigger.setDate(trigger.getDate() + 1);
    }

    const timestampTrigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: trigger.getTime(),
      repeatFrequency: RepeatFrequency.DAILY,
    };

    // We use a trigger notification; the actual content is dynamic.
    // We intercept it via a background handler before display.
    await notifee.createTriggerNotification(
      {
        id: NOTIFICATION_ID,
        title: 'Attendance Tracker',
        body: 'Checking your classes...',
        android: {
          channelId: CHANNEL_ID,
          importance: AndroidImportance.HIGH,
          category: AndroidCategory.REMINDER,
          pressAction: {
            id: 'open_timetable',
            launchActivity: 'default',
          },
          showTimestamp: true,
        },
        data: {
          deepLink: 'tracker75://timetable/today',
        },
      },
      timestampTrigger,
    );
  } catch (e) {
    console.error('Failed to schedule notification:', e);
  }
}

export async function fireNudgeIfNeeded(): Promise<void> {
  try {
    const unmarkedCount = await getUnmarkedTodayCount();
    if (unmarkedCount === 0) {
      return;
    }

    await createChannel();
    await notifee.displayNotification({
      id: 'nudge_now',
      title: 'Attendance Tracker 📚',
      body: `${unmarkedCount} class${unmarkedCount > 1 ? 'es' : ''} unmarked today — tap to fill in`,
      android: {
        channelId: CHANNEL_ID,
        importance: AndroidImportance.HIGH,
        category: AndroidCategory.REMINDER,
        pressAction: {
          id: 'open_timetable',
          launchActivity: 'default',
        },
        smallIcon: 'ic_launcher',
        showTimestamp: true,
      },
      data: {
        deepLink: 'tracker75://timetable/today',
      },
    });
  } catch (e) {
    console.error('Failed to fire nudge:', e);
  }
}

export async function cancelNudge(): Promise<void> {
  await notifee.cancelNotification(NOTIFICATION_ID);
}

export async function requestNotificationPermission(): Promise<boolean> {
  const settings = await notifee.requestPermission();
  return settings.authorizationStatus >= 1;
}

const TODO_CHANNEL_ID = 'todo_alarms';

async function createTodoChannel(): Promise<void> {
  await notifee.createChannel({
    id: TODO_CHANNEL_ID,
    name: 'Task & Assignment Reminders',
    importance: AndroidImportance.HIGH,
    vibration: true,
  });
}

export async function scheduleTaskAlarm(task: TodoItem): Promise<void> {
  try {
    if (!task.due_date) return;
    await createTodoChannel();

    const dueStr = `${task.due_date}T${task.due_time || '09:00'}:00`;
    const dueDate = new Date(dueStr);
    const triggerTime = dueDate.getTime() - (task.alarm_minutes_before || 0) * 60 * 1000;

    if (triggerTime > Date.now()) {
      const notifId = `task_alarm_${task.id}`;
      await notifee.cancelNotification(notifId);

      const timestampTrigger: TimestampTrigger = {
        type: TriggerType.TIMESTAMP,
        timestamp: triggerTime,
      };

      await notifee.createTriggerNotification(
        {
          id: notifId,
          title: `📌 Task Reminder: ${task.title}`,
          body: `Due today at ${task.due_time || '09:00'} ${task.notes ? `(${task.notes})` : ''}`,
          android: {
            channelId: TODO_CHANNEL_ID,
            importance: AndroidImportance.HIGH,
            category: AndroidCategory.REMINDER,
            pressAction: {
              id: 'open_todos',
              launchActivity: 'default',
            },
          },
        },
        timestampTrigger,
      );
    }
  } catch (e) {
    console.error('Failed to schedule task alarm:', e);
  }
}

// Background event handler — register in index.js if needed
export function setupBackgroundHandler(): void {
  notifee.onBackgroundEvent(async ({type, detail}) => {
    if (type === EventType.PRESS) {
      console.log('Notification pressed (background):', detail.notification?.data);
    }
  });
}
