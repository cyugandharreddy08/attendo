import {AppRegistry} from 'react-native';
import CodePush from 'react-native-code-push';
import App from './App';
import {name as appName} from './app.json';

const codePushOptions = {
  checkFrequency: CodePush.CheckFrequency.ON_APP_RESUME,
  updateDialog: {
    appendReleaseDescription: true,
    title: 'Update Available',
  },
  installMode: CodePush.InstallMode.ON_NEXT_RESUME,
};

const CodePushApp = CodePush(codePushOptions)(App);

AppRegistry.registerComponent(appName, () => CodePushApp);
