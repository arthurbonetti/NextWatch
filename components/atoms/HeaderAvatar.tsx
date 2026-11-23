import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AppIcon } from '@/components/atoms/AppIcon';

import {
  HEADER_AVATAR_BORDER_WIDTH,
  HEADER_AVATAR_SIZE,
  UserAvatar,
} from '@/components/atoms/UserAvatar';
import { type AvatarPresetId, type AvatarType } from '@/constants/avatars';
import { useTheme } from '@/contexts/ThemeContext';

const INITIAL_SCALE = 0.8;
const VISIBILITY_THRESHOLD = 0.05;
const EDIT_BADGE_SIZE = 20;
const EDIT_BADGE_BORDER_WIDTH = 2;
const EDIT_BADGE_OFFSET = 2;
const EDIT_BADGE_ICON_SIZE = 12;

type HeaderAvatarProps = {
  name?: string | null;
  avatarType?: AvatarType;
  avatarPreset?: AvatarPresetId | null;
  avatarUrl?: string | null;
  scrollY: SharedValue<number>;
  triggerStart: SharedValue<number>;
  triggerEnd: SharedValue<number>;
  onPress: () => void;
  size?: number;
  accessibilityLabel?: string;
};

function computeRevealProgress(
  offsetY: number,
  start: number,
  end: number,
  reducedMotion: boolean,
): number {
  'worklet';
  if (end <= 0 || end <= start) return 0;
  if (reducedMotion) {
    return offsetY >= end ? 1 : 0;
  }
  return interpolate(offsetY, [start, end], [0, 1], Extrapolation.CLAMP);
}

/**
 * Mini avatar para o slot direito do ScreenHeader, revelado suavemente no scroll
 * quando o card principal do perfil sai da área visível, com selo visual de edição.
 */
export function HeaderAvatar({
  name,
  avatarType = 'initials',
  avatarPreset,
  avatarUrl,
  scrollY,
  triggerStart,
  triggerEnd,
  onPress,
  size = HEADER_AVATAR_SIZE,
  accessibilityLabel = 'Editar perfil',
}: HeaderAvatarProps) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const [isVisible, setIsVisible] = useState(false);

  const handleVisibilityChange = useCallback((nextVisible: boolean) => {
    setIsVisible((prev) => (prev === nextVisible ? prev : nextVisible));
  }, []);

  useAnimatedReaction(
    () =>
      computeRevealProgress(
        scrollY.get(),
        triggerStart.get(),
        triggerEnd.get(),
        reducedMotion,
      ) > VISIBILITY_THRESHOLD,
    (nextVisible, prevVisible) => {
      if (nextVisible !== prevVisible) {
        scheduleOnRN(handleVisibilityChange, nextVisible);
      }
    },
    [handleVisibilityChange, reducedMotion],
  );

  const animatedStyle = useAnimatedStyle(() => {
    const progress = computeRevealProgress(
      scrollY.get(),
      triggerStart.get(),
      triggerEnd.get(),
      reducedMotion,
    );
    const scale = reducedMotion
      ? 1
      : interpolate(progress, [0, 1], [INITIAL_SCALE, 1], Extrapolation.CLAMP);

    return {
      opacity: progress,
      transform: [{ scale }],
    };
  }, [reducedMotion]);

  return (
    <View
      style={[
        styles.slot,
        {
          width: size,
          height: size,
          pointerEvents: isVisible ? 'auto' : 'none',
        },
      ]}
      aria-hidden={!isVisible}
      accessibilityElementsHidden={!isVisible}
      importantForAccessibility={isVisible ? 'yes' : 'no-hide-descendants'}>
      <Animated.View style={[styles.animatedWrap, animatedStyle]}>
        <Pressable
          onPress={onPress}
          disabled={!isVisible}
          hitSlop={4}
          style={({ pressed }) => [
            styles.pressable,
            { width: size, height: size, borderRadius: size / 2 },
            pressed && styles.pressed,
          ]}
          accessible={isVisible}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}>
          <UserAvatar
            size={size}
            borderWidth={HEADER_AVATAR_BORDER_WIDTH}
            borderColor={colors.avatarBorder}
            name={name}
            avatarType={avatarType}
            avatarPreset={avatarPreset}
            avatarUrl={avatarUrl}
          />
          <View
            style={[
              styles.editBadge,
              {
                backgroundColor: colors.accentPrimary,
                borderColor: colors.bgPrimary,
                pointerEvents: 'none',
              },
            ]}
            accessible={false}
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants">
            <AppIcon
              name="edit"
              size={EDIT_BADGE_ICON_SIZE}
              color={colors.textOnAccent}
            />
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  animatedWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  pressable: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.95 }],
  },
  editBadge: {
    position: 'absolute',
    right: -EDIT_BADGE_OFFSET,
    bottom: -EDIT_BADGE_OFFSET,
    width: EDIT_BADGE_SIZE,
    height: EDIT_BADGE_SIZE,
    borderRadius: EDIT_BADGE_SIZE / 2,
    borderWidth: EDIT_BADGE_BORDER_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
