import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import {setupBackgroundHandler} from './src/services/NotificationService';

// Initialize Notifee background event listener
setupBackgroundHandler();

AppRegistry.registerComponent(appName, () => App);
