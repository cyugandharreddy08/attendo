const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const config = {
  maxWorkers: 2,
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
