import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';

type BookmarkIconProps = {
  saved: boolean;
  itemKey?: string;
  size?: number;
  color?: string;
  inactiveColor?: string;
  badgeColor?: string;
  badgeBorderColor?: string;
};

/**
 * Animated bookmark icon with a pop spring and a top-right check badge when saved.
 */
export function BookmarkIcon({
  saved,
  itemKey,
  size = 22,
  color = '#e58c34',
  inactiveColor,
  badgeColor = '#d77c29',
  badgeBorderColor = '#fff2d8',
}: BookmarkIconProps) {
  const [popScale] = useState(() => new Animated.Value(1));
  const [checkAnim] = useState(() => new Animated.Value(saved ? 1 : 0));
  const prevSavedRef = useRef(saved);
  const prevKeyRef = useRef(itemKey);

  useEffect(() => {
    if (prevKeyRef.current !== itemKey) {
      prevKeyRef.current = itemKey;
      prevSavedRef.current = saved;
      popScale.setValue(1);
      checkAnim.setValue(saved ? 1 : 0);
      return;
    }

    if (prevSavedRef.current === saved) return;
    prevSavedRef.current = saved;

    if (saved) {
      popScale.setValue(0.82);
      checkAnim.setValue(0);
      Animated.parallel([
        Animated.sequence([
          Animated.spring(popScale, {
            toValue: 1.24,
            speed: 40,
            bounciness: 12,
            useNativeDriver: true,
          }),
          Animated.spring(popScale, {
            toValue: 1,
            speed: 28,
            bounciness: 8,
            useNativeDriver: true,
          }),
        ]),
        Animated.spring(checkAnim, {
          toValue: 1,
          speed: 24,
          bounciness: 12,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.sequence([
          Animated.timing(popScale, {
            toValue: 0.85,
            duration: 90,
            useNativeDriver: true,
          }),
          Animated.spring(popScale, {
            toValue: 1,
            speed: 32,
            bounciness: 6,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(checkAnim, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [saved, itemKey, popScale, checkAnim]);

  const badgeSize = Math.max(12, Math.round(size * 0.56));
  const checkIconSize = Math.max(8, Math.round(badgeSize * 0.72));

  return (
    <Animated.View style={[styles.wrapper, { width: size + 2, height: size + 2, transform: [{ scale: popScale }] }]}>
      <MaterialIcons
        name={saved ? 'bookmark' : 'bookmark-border'}
        size={size}
        color={saved ? color : (inactiveColor ?? color)}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.badge,
          {
            width: badgeSize,
            height: badgeSize,
            borderRadius: Math.ceil(badgeSize / 2),
            backgroundColor: badgeColor,
            borderColor: badgeBorderColor,
            opacity: checkAnim,
            transform: [
              {
                scale: checkAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 1],
                }),
              },
            ],
          },
        ]}>
        <MaterialIcons name="check" size={checkIconSize} color="#fffdf8" />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -3,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
