import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { Animated, Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';

type BackButtonProps = {
  onPress: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Animated back button with spring scale and leftward arrow nudge on press.
 */
export function BackButton({
  onPress,
  accessibilityLabel = 'Voltar',
  style,
}: BackButtonProps) {
  const [pressAnim] = useState(() => new Animated.Value(0));

  const animateTo = (toValue: number) => {
    Animated.spring(pressAnim, {
      toValue,
      useNativeDriver: true,
      speed: 36,
      bounciness: 6,
    }).start();
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
      onPress={onPress}
      onPressIn={() => animateTo(1)}
      onPressOut={() => animateTo(0)}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}>
      <Animated.View style={[styles.button, style, { transform: [{ scale: buttonScale }] }]}>
        <Animated.View style={{ transform: [{ translateX: arrowTranslateX }] }}>
          <MaterialIcons name="arrow-back" size={22} color="#182230" />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e8e2d5',
    backgroundColor: '#fffdf8',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
