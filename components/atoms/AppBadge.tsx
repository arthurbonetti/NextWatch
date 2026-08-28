import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from './AppText';

type AppBadgeProps = {
  label: string;
  color?: string;
  textColor?: string;
};

export function AppBadge({ label, color = '#dbeafe', textColor = '#0f172a' }: AppBadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <AppText tipo="legenda" peso="medio" style={[styles.text, { color: textColor }]}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  text: {
    color: '#1f2937',
  },
});
