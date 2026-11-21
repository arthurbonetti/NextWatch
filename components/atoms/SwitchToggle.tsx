import { useEffect } from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Theme, THEME } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';
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
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(createStyles);
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(value ? 1 : 0);

  const trackOffColor = colors.handle;
  const trackOnColor = isDark ? colors.accentPrimary : colors.navy;
  const thumbOffColor = isDark ? colors.textPrimary : colors.bgCard;
  const thumbOnColor = isDark ? colors.textOnAccent : colors.gold;

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
      [trackOffColor, trackOnColor],
    ),
  }), [trackOffColor, trackOnColor]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.get() * THUMB_TRAVEL }],
    backgroundColor: interpolateColor(
      progress.get(),
      [0, 1],
      [thumbOffColor, thumbOnColor],
    ),
  }), [thumbOffColor, thumbOnColor]);

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
  const styles = useThemedStyles(createStyles);

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

const createStyles = (theme: Theme) => ({
  pressable: {
    minWidth: theme.touchTarget.min,
    minHeight: theme.touchTarget.min,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  pressed: {
    opacity: 0.86,
  },
  track: {
    width: 44,
    height: 26,
    borderRadius: theme.radius.full,
    padding: 3,
    justifyContent: 'center' as const,
  },
  thumb: {
    width: 20,
    height: 20,
    borderRadius: theme.radius.full,
  },
});
