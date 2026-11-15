import React from 'react';
import {
  View,
  Image,
  StyleSheet,
  StyleProp,
  ViewStyle,
  ImageStyle,
} from 'react-native';

export interface AttendoVectorLogoProps {
  size?: number;
  variant?: 'full' | 'floating' | 'badge' | 'transparent';
  colorScheme?: 'dark' | 'light';
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
}

export const AttendoVectorLogo: React.FC<AttendoVectorLogoProps> = ({
  size = 64,
  variant = 'floating',
  style,
  imageStyle,
}) => {
  // Select authentic brand logo asset matching the visual concept
  let source = require('../assets/attendo_floating_emblem.png');
  if (variant === 'transparent') {
    source = require('../assets/attendo_logo_transparent.png');
  } else if (variant === 'badge' || variant === 'full') {
    source = require('../assets/attendo_brand_logo.png');
  }

  return (
    <View style={[{width: size, height: size, alignItems: 'center', justifyContent: 'center'}, style]}>
      <Image
        source={source}
        style={[
          {
            width: size,
            height: size,
            resizeMode: 'contain',
          },
          imageStyle,
        ]}
      />
    </View>
  );
};

export default AttendoVectorLogo;
