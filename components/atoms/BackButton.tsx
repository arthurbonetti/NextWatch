import { Href, router } from 'expo-router';
import { useState } from 'react';
import { Animated, Platform, Pressable, StyleProp, ViewStyle } from 'react-native';

import { AppIcon } from '@/components/atoms/AppIcon';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';

type BackButtonProps = {
  onPress?: () => void;
  fallbackHref?: Href;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Animated back button with spring scale and leftward arrow nudge on press.
 */
export function BackButton({
  onPress,
  fallbackHref = '/(tabs)',
  accessibilityLabel = 'Voltar',
  style,
}: BackButtonProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [pressAnim] = useState(() => new Animated.Value(0));

  const animateTo = (toValue: number) => {
    Animated.spring(pressAnim, {
      toValue,
      useNativeDriver: Platform.OS !== 'web',
      speed: 36,
      bounciness: 6,
    }).start();
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(fallbackHref);
  };

  const buttonScale = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.91],
  });

  const arrowTranslateX = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -3.5],
  });

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={() => animateTo(1)}
      onPressOut={() => animateTo(0)}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}>
      <Animated.View style={[styles.button, style, { transform: [{ scale: buttonScale }] }]}>
        <Animated.View style={{ transform: [{ translateX: arrowTranslateX }] }}>
          <AppIcon name="arrow-back" size={22} color={colors.textPrimary} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const createStyles = (theme: Theme) => ({
  button: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bgSurface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
});
