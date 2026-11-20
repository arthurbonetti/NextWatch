import { useEffect, useState } from 'react';
import { StyleProp, StyleSheet, TextStyle, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/atoms/AppText';
import { TextWeight } from '@/constants/typography';
import { formatCount } from '@/utils/format';

type AnimatedRollingNumberProps = {
  value: number;
  style?: StyleProp<TextStyle>;
  peso?: TextWeight;
};

const ROLL_DISTANCE = 14;
const ROLL_DURATION_MS = 240;

/**
 * Exibe um número formatado (tabular-nums) com transição vertical suave na UI thread
 * sempre que o valor muda.
 */
export function AnimatedRollingNumber({ value, style, peso = 'forte' }: AnimatedRollingNumberProps) {
  const reducedMotion = useReducedMotion();
  const [tracked, setTracked] = useState<{ current: number; previous: number | null; direction: 1 | -1 }>({
    current: value,
    previous: null,
    direction: 1,
  });

  if (tracked.current !== value) {
    setTracked({
      current: value,
      previous: tracked.current,
      direction: value >= tracked.current ? 1 : -1,
    });
  }

  const progress = useSharedValue(1);
  const direction = tracked.direction;
  const hasPrevious = tracked.previous !== null;

  useEffect(() => {
    if (reducedMotion || !hasPrevious) {
      progress.set(1);
      return;
    }
    progress.set(0);
    progress.set(
      withTiming(1, {
        duration: ROLL_DURATION_MS,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [hasPrevious, progress, reducedMotion, value]);

  const incomingStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [
      {
        translateY: interpolate(progress.get(), [0, 1], [ROLL_DISTANCE * direction, 0]),
      },
    ],
  }));

  const outgoingStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.get(),
    transform: [
      {
        translateY: interpolate(progress.get(), [0, 1], [0, -ROLL_DISTANCE * direction]),
      },
    ],
  }));

  if (reducedMotion) {
    return (
      <AppText peso={peso} tabular style={style}>
        {formatCount(value)}
      </AppText>
    );
  }

  return (
    <View style={styles.container}>
      {tracked.previous !== null && (
        <Animated.View style={[styles.outgoing, outgoingStyle, { pointerEvents: 'none' }]}>
          <AppText peso={peso} tabular style={style}>
            {formatCount(tracked.previous)}
          </AppText>
        </Animated.View>
      )}
      <Animated.View style={incomingStyle}>
        <AppText peso={peso} tabular style={style}>
          {formatCount(tracked.current)}
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  outgoing: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
