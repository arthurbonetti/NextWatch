import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ComponentProps, useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

type SpinningIconProps = {
  name: MaterialIconName;
  size: number;
  color: string;
  spinning?: boolean;
  duration?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Renders a MaterialIcon that rotates continuously while `spinning` is true,
 * respecting the user's reduced-motion preference.
 */
export function SpinningIcon({
  name,
  size,
  color,
  spinning = true,
  duration = 950,
  style,
}: SpinningIconProps) {
  const reducedMotion = useReducedMotion();
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (!spinning || reducedMotion) {
      cancelAnimation(rotation);
      rotation.set(0);
      return;
    }

    rotation.set(0);
    rotation.set(
      withRepeat(
        withTiming(360, { duration, easing: Easing.linear }),
        -1,
        false,
      ),
    );

    return () => {
      cancelAnimation(rotation);
    };
  }, [duration, reducedMotion, rotation, spinning]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.get()}deg` }],
  }));

  return (
    <Animated.View
      style={[
        { width: size, height: size, alignItems: 'center', justifyContent: 'center' },
        animatedStyle,
        style,
      ]}>
      <MaterialIcons name={name} size={size} color={color} />
    </Animated.View>
  );
}
