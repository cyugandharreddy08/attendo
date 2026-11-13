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
import StudentSearchScreen from '../screens/StudentSearchScreen';
import PublicProfileScreen from '../screens/PublicProfileScreen';
import PhoneAuthScreen from '../screens/PhoneAuthScreen';
import AnimatedCustomTabBar from '../components/AnimatedCustomTabBar';
import {RootStackParamList, BottomTabParamList} from '../types';

const Tab = createBottomTabNavigator<BottomTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function StatsStack() {
  const S = createNativeStackNavigator();
  return (
    <S.Navigator screenOptions={{headerShown: false, animation: 'slide_from_right'}}>
      <S.Screen name="SubjectList" component={SubjectListScreen} />
      <S.Screen name="SubjectDetail" component={SubjectDetailScreen} />
      <S.Screen name="Reports" component={ReportsScreen} />
    </S.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={props => <AnimatedCustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}>
      <Tab.Screen name="Timetable" component={TimetableScreen} />
      <Tab.Screen name="Todos" component={TodoListScreen} options={{title: 'To-Do'}} />
      <Tab.Screen name="Peers" component={StudentSearchScreen} options={{title: 'Campus'}} />
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
      <Stack.Screen
        name="PhoneAuth"
        component={PhoneAuthScreen}
        options={{animation: 'slide_from_bottom', presentation: 'modal'}}
      />
      <Stack.Screen
        name="StudentSearch"
        component={StudentSearchScreen}
        options={{animation: 'slide_from_right'}}
      />
      <Stack.Screen
        name="PublicProfile"
        component={PublicProfileScreen}
        options={{animation: 'slide_from_right'}}
      />
      <Stack.Screen
        name="CalendarHeatmap"
        component={CalendarHeatmapScreen}
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
    fontSize: 10,
    fontWeight: '600',
  },
  tabIconContainer: {
    width: 32,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  tabIconActive: {
    backgroundColor: Colors.primary + '22',
  },
  tabIconEmoji: {
    fontSize: 18,
  },
});
