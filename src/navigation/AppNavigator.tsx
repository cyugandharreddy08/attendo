import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {Colors} from '../theme/colors';
import {Spacing} from '../theme/spacing';
import TimetableScreen from '../screens/TimetableScreen';
import SubjectListScreen from '../screens/SubjectListScreen';
import SubjectDetailScreen from '../screens/SubjectDetailScreen';
import CalendarHeatmapScreen from '../screens/CalendarHeatmapScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AddSubjectScreen from '../screens/AddSubjectScreen';
import AddTimetableEntryScreen from '../screens/AddTimetableEntryScreen';
import TimetableScanScreen from '../screens/TimetableScanScreen';
import ReportsScreen from '../screens/ReportsScreen';
import TodoListScreen from '../screens/TodoListScreen';
import BugReportScreen from '../screens/BugReportScreen';
import MyBugsScreen from '../screens/MyBugsScreen';
import ChangelogScreen from '../screens/ChangelogScreen';
import {RootStackParamList, BottomTabParamList} from '../types';

const Tab = createBottomTabNavigator<BottomTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const tabIcons: Record<string, string> = {
  Timetable: '📅',
  Todos: '📝',
  Stats: '📊',
  Calendar: '🗓️',
  Settings: '⚙️',
};

function TabBarIcon({name, focused}: {name: string; focused: boolean}) {
  return (
    <View style={[styles.tabIconContainer, focused && styles.tabIconActive]}>
      <Text style={styles.tabIconEmoji}>{tabIcons[name]}</Text>
    </View>
  );
}

function StatsStack() {
  const S = createNativeStackNavigator();
  return (
    <S.Navigator screenOptions={{headerShown: false}}>
      <S.Screen name="SubjectList" component={SubjectListScreen} />
      <S.Screen name="SubjectDetail" component={SubjectDetailScreen} />
      <S.Screen name="Reports" component={ReportsScreen} />
    </S.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarIcon: ({focused}) => (
          <TabBarIcon name={route.name} focused={focused} />
        ),
      })}>
      <Tab.Screen name="Timetable" component={TimetableScreen} />
      <Tab.Screen name="Todos" component={TodoListScreen} options={{title: 'To-Do'}} />
      <Tab.Screen name="Stats" component={StatsStack} />
      <Tab.Screen name="Calendar" component={CalendarHeatmapScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen
        name="SubjectDetail"
        component={SubjectDetailScreen}
        options={{animation: 'slide_from_right'}}
      />
      <Stack.Screen
        name="AddSubject"
        component={AddSubjectScreen}
        options={{animation: 'slide_from_bottom', presentation: 'modal'}}
      />
      <Stack.Screen
        name="AddTimetableEntry"
        component={AddTimetableEntryScreen}
        options={{animation: 'slide_from_bottom', presentation: 'modal'}}
      />
      <Stack.Screen
        name="TimetableScan"
        component={TimetableScanScreen}
        options={{animation: 'slide_from_right'}}
      />
      <Stack.Screen
        name="BugReport"
        component={BugReportScreen}
        options={{animation: 'slide_from_bottom', presentation: 'modal'}}
      />
      <Stack.Screen
        name="MyBugs"
        component={MyBugsScreen}
        options={{animation: 'slide_from_right'}}
      />
      <Stack.Screen
        name="Changelog"
        component={ChangelogScreen}
        options={{animation: 'slide_from_right'}}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.card,
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    height: 64,
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  tabIconContainer: {
    width: 36,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  tabIconActive: {
    backgroundColor: Colors.primary + '22',
  },
  tabIconEmoji: {
    fontSize: 20,
  },
});
