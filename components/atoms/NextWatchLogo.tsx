import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View } from 'react-native';

const LOGO_SOURCE = require('@/assets/images/nextwatch-logo.png');

type NextWatchLogoProps = {
  size?: number;
};

export function NextWatchLogo({ size = 38 }: NextWatchLogoProps) {
  const radius = Math.round(size * 0.28);

  return (
    <View
      style={[
        styles.frame,
        {
          width: size,
          height: size,
          borderRadius: radius,
        },
      ]}
      accessible={false}>
      <Image source={LOGO_SOURCE} style={styles.image} contentFit="cover" accessible={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    backgroundColor: '#182230',
    borderWidth: 1,
    borderColor: '#263442',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
