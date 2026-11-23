import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet } from 'react-native';

import { AppIcon } from '@/components/atoms/AppIcon';
import { useTheme } from '@/contexts/ThemeContext';

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
  color,
  inactiveColor,
  badgeColor,
  badgeBorderColor,
}: BookmarkIconProps) {
  const { colors } = useTheme();
  const resolvedColor = color ?? colors.savedActiveIcon;
  const resolvedInactiveColor = inactiveColor ?? resolvedColor;
  const resolvedBadgeColor = badgeColor ?? colors.accentPrimary;
  const resolvedBadgeBorderColor = badgeBorderColor ?? colors.savedActiveBg;

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

    const useNativeDriver = Platform.OS !== 'web';

    if (saved) {
      popScale.setValue(0.82);
      checkAnim.setValue(0);
      Animated.parallel([
        Animated.sequence([
          Animated.spring(popScale, {
            toValue: 1.24,
            speed: 40,
            bounciness: 12,
            useNativeDriver,
          }),
          Animated.spring(popScale, {
            toValue: 1,
            speed: 28,
            bounciness: 8,
            useNativeDriver,
          }),
        ]),
        Animated.spring(checkAnim, {
          toValue: 1,
          speed: 24,
          bounciness: 12,
          useNativeDriver,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.sequence([
          Animated.timing(popScale, {
            toValue: 0.85,
            duration: 90,
            useNativeDriver,
          }),
          Animated.spring(popScale, {
            toValue: 1,
            speed: 32,
            bounciness: 6,
            useNativeDriver,
          }),
        ]),
        Animated.timing(checkAnim, {
          toValue: 0,
          duration: 120,
          useNativeDriver,
        }),
      ]).start();
    }
  }, [saved, itemKey, popScale, checkAnim]);

  const badgeSize = Math.max(12, Math.round(size * 0.56));
  const checkIconSize = Math.max(8, Math.round(badgeSize * 0.72));

  return (
    <Animated.View style={[styles.wrapper, { width: size + 2, height: size + 2, transform: [{ scale: popScale }] }]}>
      <AppIcon
        name={saved ? 'bookmark' : 'bookmark-border'}
        size={size}
        color={saved ? resolvedColor : resolvedInactiveColor}
      />
      <Animated.View
        style={[
          styles.badge,
          { pointerEvents: 'none' },
          {
            width: badgeSize,
            height: badgeSize,
            borderRadius: Math.ceil(badgeSize / 2),
            backgroundColor: resolvedBadgeColor,
            borderColor: resolvedBadgeBorderColor,
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
        <AppIcon name="check" size={checkIconSize} color={colors.textOnAccent} />
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
