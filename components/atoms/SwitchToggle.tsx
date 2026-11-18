import { useEffect } from 'react';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { THEME } from '@/constants/theme';
import { triggerSelectionHaptic } from '@/utils/haptics';

type SwitchVisualProps = {
  value: boolean;
};

type SwitchToggleProps = {
  value: boolean;
  onToggle: () => void;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
};

const THUMB_TRAVEL = 18;

/**
 * Parte visual do switch com transição suave global na UI thread,
 * respeitando a preferência de movimento reduzido do sistema.
 */
export function SwitchVisual({ value }: SwitchVisualProps) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.set(
      reducedMotion
        ? value
          ? 1
          : 0
        : withTiming(value ? 1 : 0, {
            duration: THEME.motion.switchDurationMs,
            easing: Easing.out(Easing.cubic),
          }),
    );
  }, [progress, reducedMotion, value]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.get(),
      [0, 1],
      [THEME.colors.handle, THEME.colors.navy],
    ),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.get() * THUMB_TRAVEL }],
    backgroundColor: interpolateColor(
      progress.get(),
      [0, 1],
      [THEME.colors.bgCard, THEME.colors.gold],
    ),
  }));

  return (
    <Animated.View style={[styles.track, trackStyle]}>
      <Animated.View style={[styles.thumb, thumbStyle]} />
    </Animated.View>
  );
}

/**
 * Switch global acessível com área mínima de toque e feedback tátil consistente.
 */
export function SwitchToggle({ value, onToggle, accessibilityLabel, style }: SwitchToggleProps) {
  return (
    <Pressable
      onPress={() => {
        triggerSelectionHaptic();
        onToggle();
      }}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.pressable, style, pressed && styles.pressed]}>
      <SwitchVisual value={value} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    minWidth: THEME.touchTarget.min,
    minHeight: THEME.touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.86,
  },
  track: {
    width: 44,
    height: 26,
    borderRadius: THEME.radius.full,
    padding: 3,
    justifyContent: 'center',
  },
  thumb: {
    width: 20,
    height: 20,
    borderRadius: THEME.radius.full,
  },
});
