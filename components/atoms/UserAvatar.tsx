import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { AppText } from '@/components/atoms/AppText';
import {
  type AvatarPresetId,
  type AvatarType,
  getAvatarPresetById,
} from '@/constants/avatars';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';

export const HEADER_AVATAR_SIZE = 44;
export const HEADER_AVATAR_BORDER_WIDTH = 2;

type UserAvatarProps = {
  name?: string | null;
  avatarType?: AvatarType;
  avatarPreset?: AvatarPresetId | null;
  avatarUrl?: string | null;
  size?: number;
  borderWidth?: number;
  borderColor?: string;
  style?: StyleProp<ViewStyle>;
};

export function UserAvatar({
  name,
  avatarType = 'initials',
  avatarPreset,
  avatarUrl,
  size = HEADER_AVATAR_SIZE,
  borderWidth = HEADER_AVATAR_BORDER_WIDTH,
  borderColor,
  style,
}: UserAvatarProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const initial = name?.trim().charAt(0).toLocaleUpperCase() || '?';
  const preset = avatarType === 'preset' ? getAvatarPresetById(avatarPreset) : null;
  const showCustomImage =
    avatarType === 'custom' && Boolean(avatarUrl) && failedUrl !== avatarUrl;

  const fontSize = Math.max(13, Math.round(size * 0.38));
  const lineHeight = Math.round(fontSize * 1.18);

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth,
          borderColor: borderColor ?? colors.avatarBorder,
        },
        style,
      ]}
      accessible={false}>
      {showCustomImage ? (
        <Image
          source={{ uri: avatarUrl! }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={150}
          onError={() => setFailedUrl(avatarUrl ?? null)}
          accessible={false}
        />
      ) : preset ? (
        <Image
          source={preset.source}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={150}
          accessible={false}
        />
      ) : (
        <AppText peso="forte" style={[styles.initialText, { fontSize, lineHeight }]}>
          {initial}
        </AppText>
      )}
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  container: {
    backgroundColor: theme.colors.avatarBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
  },
  initialText: {
    color: theme.colors.avatarText,
    textAlign: 'center' as const,
  },
});
