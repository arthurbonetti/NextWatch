import * as Haptics from 'expo-haptics';
import type { BottomTabBarButtonProps } from 'expo-router/js-tabs';
import { PlatformPressable } from 'expo-router/react-navigation';
import type { ComponentProps } from 'react';

export function HapticTab(props: BottomTabBarButtonProps) {
  const pressableProps = props as ComponentProps<typeof PlatformPressable>;

  return (
    <PlatformPressable
      {...pressableProps}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          // Add a soft haptic feedback when pressing down on the tabs.
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}
    />
  );
}
