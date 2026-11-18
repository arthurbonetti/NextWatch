import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect } from 'react';
import { AccessibilityRole, Pressable, StyleSheet } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/atoms/AppText';
import { MaterialIconName } from '@/constants/catalog';
import { THEME } from '@/constants/theme';
import { triggerSelectionHaptic } from '@/utils/haptics';

type AnimatedFilterChipProps = {
  label: string;
  icon: MaterialIconName;
  selected: boolean;
  onPress: () => void;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
};

/**
 * Chip de filtro com área mínima de 44px, ícone, resposta sutil ao toque na UI thread,
 * transição suave de cor na seleção e feedback tátil.
 */
export function AnimatedFilterChip({
  label,
  icon,
  selected,
  onPress,
  accessibilityRole = 'button',
  accessibilityLabel,
}: AnimatedFilterChipProps) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const progress = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    progress.set(
      reducedMotion
        ? selected
          ? 1
          : 0
        : withTiming(selected ? 1 : 0, { duration: THEME.motion.chipColorDurationMs }),
    );
  }, [progress, reducedMotion, selected]);

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
    backgroundColor: interpolateColor(
      progress.get(),
      [0, 1],
      [THEME.colors.bgCard, THEME.colors.navy],
    ),
    borderColor: interpolateColor(
      progress.get(),
      [0, 1],
      [THEME.colors.borderMedium, THEME.colors.navy],
    ),
  }));

  const handlePressIn = () => {
    if (reducedMotion) return;
    scale.set(withTiming(0.97, { duration: THEME.motion.pressDurationMs }));
  };

  const handlePressOut = () => {
    if (reducedMotion) return;
    scale.set(withTiming(1, { duration: THEME.motion.pressDurationMs }));
  };

  const handlePress = () => {
    triggerSelectionHaptic();
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={
        accessibilityRole === 'checkbox'
          ? { checked: selected, selected }
          : { selected }
      }
      style={styles.pressable}>
      <Animated.View style={[styles.chip, containerAnimatedStyle]}>
        <MaterialIcons
          name={icon}
          size={16}
          color={selected ? THEME.colors.gold : THEME.colors.textWarm}
        />
        <AppText
          tipo="legenda"
          peso="forte"
          numberOfLines={1}
          style={[styles.label, selected ? styles.labelSelected : styles.labelUnselected]}>
          {label}
        </AppText>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    flexShrink: 0,
  },
  chip: {
    minHeight: THEME.touchTarget.min,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: THEME.spacing.sm,
    borderRadius: THEME.radius.pill,
    borderWidth: 1,
    paddingHorizontal: THEME.spacing.xl,
    paddingVertical: THEME.spacing.base,
  },
  label: {
    fontSize: THEME.fontSizes.bodySm,
    lineHeight: THEME.lineHeights.bodySm,
  },
  labelUnselected: {
    color: THEME.colors.textSecondary,
  },
  labelSelected: {
    color: THEME.colors.textOnNavy,
  },
});
