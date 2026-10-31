import {LinkingOptions} from '@react-navigation/native';

export const linking: LinkingOptions<any> = {
  prefixes: ['tracker75://'],
  config: {
    screens: {
      MainTabs: {
        screens: {
          Timetable: 'timetable/today',
          Stats: 'stats',
          Calendar: 'calendar',
          Settings: 'settings',
        },
      },
      SubjectDetail: 'subject/:subjectId',
    },
  },
};
