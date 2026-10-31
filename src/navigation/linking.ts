import {LinkingOptions} from '@react-navigation/native';

export const linking: LinkingOptions<any> = {
  prefixes: ['tracker75://'],
  config: {
    screens: {
      MainTabs: {
        screens: {
          Timetable: 'timetable/today',
          Peers: 'peers',
          Stats: 'stats',
          Calendar: 'calendar',
          Settings: 'settings',
        },
      },
      SubjectDetail: 'subject/:subjectId',
      PublicProfile: 'u/:username',
      PhoneAuth: 'auth',
    },
  },
};
