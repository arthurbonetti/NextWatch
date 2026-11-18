import { useFocusEffect } from 'expo-router';
import { ReactNode, useCallback, useState } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';

type FadeInBlockProps = {
  children: ReactNode;
  delay?: number;
  duration?: number;
  offsetY?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Animates a subtle fade and upward slide whenever the parent screen gains focus.
 */
export function FadeInBlock({
  children,
  delay = 0,
  duration = 220,
  offsetY = 10,
  style,
}: FadeInBlockProps) {
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(offsetY));

  useFocusEffect(
    useCallback(() => {
      opacity.setValue(0);
      translateY.setValue(offsetY);

      const animation = Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration,
          delay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration,
          delay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);

      animation.start();

      return () => {
        animation.stop();
      };
    }, [delay, duration, offsetY, opacity, translateY]),
  );

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}
