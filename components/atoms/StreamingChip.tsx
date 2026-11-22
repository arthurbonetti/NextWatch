import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect } from 'react';
import { AccessibilityRole, Pressable } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/atoms/AppText';
import { ServiceLogo } from '@/components/atoms/ServiceLogo';
import { Theme, THEME } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';
import { triggerSelectionHaptic } from '@/utils/haptics';

type StreamingChipProps = {
  provider: string;
  selected: boolean;
  onPress: () => void;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
};

/**
 * Chip padronizado para seleção de serviços de streaming, compartilhado
 * entre a bottom sheet da Roleta e os Filtros do Catálogo.
 */
export function StreamingChip({
  provider,
  selected,
  onPress,
  accessibilityRole = 'checkbox',
  accessibilityLabel,
}: StreamingChipProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const progress = useSharedValue(selected ? 1 : 0);

  const unselectedBg = colors.chipBg;
  const selectedBg = colors.chipSelectedBg;
  const unselectedBorder = colors.chipBorder;
  const selectedBorder = colors.chipSelectedBorder;

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
      [unselectedBg, selectedBg],
    ),
    borderColor: interpolateColor(
      progress.get(),
      [0, 1],
      [unselectedBorder, selectedBorder],
    ),
  }), [unselectedBg, selectedBg, unselectedBorder, selectedBorder]);

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
      accessibilityLabel={accessibilityLabel ?? provider}
      accessibilityState={
        accessibilityRole === 'checkbox'
          ? { checked: selected, selected }
          : { selected }
      }
      style={styles.pressable}>
      <Animated.View style={[styles.chip, containerAnimatedStyle]}>
        <ServiceLogo name={provider} size={22} />
        <AppText
          tipo="legenda"
          peso="forte"
          numberOfLines={1}
          style={[styles.label, selected ? styles.labelSelected : styles.labelUnselected]}>
          {provider}
        </AppText>
        {selected && (
          <MaterialIcons name="check-circle" size={16} color={colors.chipSelectedIcon} />
        )}
      </Animated.View>
    </Pressable>
  );
}

const createStyles = (theme: Theme) => ({
  pressable: {
    flexShrink: 0,
  },
  chip: {
    minHeight: theme.touchTarget.min,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: theme.spacing.md,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  label: {
    fontSize: theme.fontSizes.bodySm,
    lineHeight: theme.lineHeights.bodySm,
  },
  labelUnselected: {
    color: theme.colors.chipText,
  },
  labelSelected: {
    color: theme.colors.chipSelectedText,
  },
});
