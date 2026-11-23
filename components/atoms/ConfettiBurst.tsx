import { View } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';

export type ConfettiSpec = {
  dx: number;
  dy: number;
  rotate: number;
  size: number;
  delay: number;
  color: string;
};

export function ConfettiParticle({
  spec,
  progress,
}: {
  spec: ConfettiSpec;
  progress: SharedValue<number>;
}) {
  const styles = useThemedStyles(createStyles);

  const style = useAnimatedStyle(() => {
    const master = progress.get();
    if (master <= spec.delay || master >= 1) {
      return {
        opacity: 0,
        transform: [
          { translateX: 0 },
          { translateY: 0 },
          { rotate: '0deg' },
          { scale: 1 },
        ],
      };
    }
    const p = (master - spec.delay) / (1 - spec.delay);
    const opacity = p < 0.12 ? p / 0.12 : p < 0.72 ? 1 : (1 - p) / 0.28;
    return {
      opacity,
      transform: [
        { translateX: spec.dx * p },
        { translateY: spec.dy * p + 34 * p * p },
        { rotate: `${spec.rotate * p}deg` },
        { scale: 1 - p * 0.35 },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.confettiDot,
        {
          pointerEvents: 'none',
          width: spec.size,
          height: spec.size * 0.65,
          backgroundColor: spec.color,
        },
        style,
      ]}
    />
  );
}

export function GoldConfettiBurst({
  progress,
}: {
  progress: SharedValue<number>;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const specs: ConfettiSpec[] = [
    { dx: -110, dy: -26, rotate: 220, size: 8, delay: 0.0, color: colors.accentPrimary },
    { dx: -82, dy: -46, rotate: -190, size: 7, delay: 0.04, color: colors.goldLight },
    { dx: -52, dy: -32, rotate: 160, size: 9, delay: 0.02, color: colors.accent },
    { dx: -24, dy: -52, rotate: -240, size: 7, delay: 0.06, color: colors.accentPrimary },
    { dx: 18, dy: -48, rotate: 200, size: 8, delay: 0.03, color: colors.accentPrimary },
    { dx: 48, dy: -34, rotate: -170, size: 9, delay: 0.01, color: colors.goldLight },
    { dx: 78, dy: -44, rotate: 230, size: 7, delay: 0.05, color: colors.accentPrimary },
    { dx: 108, dy: -24, rotate: -210, size: 8, delay: 0.025, color: colors.accent },
    { dx: -95, dy: 12, rotate: 180, size: 6, delay: 0.07, color: colors.goldLight },
    { dx: -40, dy: 16, rotate: -150, size: 7, delay: 0.08, color: colors.accentPrimary },
    { dx: 38, dy: 14, rotate: 195, size: 7, delay: 0.065, color: colors.accent },
    { dx: 92, dy: 10, rotate: -185, size: 6, delay: 0.075, color: colors.goldLight },
  ];

  return (
    <View style={[styles.confettiAnchor, { pointerEvents: 'none' }]}>
      {specs.map((spec, idx) => (
        <ConfettiParticle key={idx} spec={spec} progress={progress} />
      ))}
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  confettiAnchor: {
    position: 'absolute' as const,
    top: 90,
    left: '50%' as const,
    zIndex: 10,
  },
  confettiDot: {
    position: 'absolute' as const,
    borderRadius: theme.radius.xs,
  },
});
