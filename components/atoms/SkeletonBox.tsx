import { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { THEME } from '@/constants/theme';

type SkeletonBoxProps = {
  width?: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

export function SkeletonBox({
  width = '100%',
  height,
  borderRadius = THEME.radius.sm,
  style,
}: SkeletonBoxProps) {
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      pulse.set(0);
      return;
    }
    pulse.set(
      withRepeat(
        withTiming(1, { duration: 850, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      ),
    );
  }, [pulse, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      pulse.get(),
      [0, 1],
      [THEME.colors.skeletonBase, THEME.colors.skeletonHighlight],
    ),
  }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius },
        animatedStyle,
        style,
      ]}
    />
  );
}
