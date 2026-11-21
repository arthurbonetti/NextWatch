import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ComponentProps } from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';

import { AppText } from '@/components/atoms/AppText';
import { SpinningIcon } from '@/components/atoms/SpinningIcon';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

type EmptyStateCardProps = {
  icon: MaterialIconName;
  spinIcon?: boolean;
  title: string;
  description: string;
  actionLabel?: string;
  actionIcon?: MaterialIconName;
  onAction?: () => void;
  iconColor?: string;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function EmptyStateCard({
  icon,
  spinIcon = false,
  title,
  description,
  actionLabel,
  actionIcon,
  onAction,
  iconColor,
  compact = false,
  style,
}: EmptyStateCardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const iconSize = compact ? 22 : 26;
  const resolvedIconColor = iconColor ?? colors.accentLink;

  return (
    <View style={[styles.card, compact && styles.cardCompact, style]}>
      <View style={[styles.iconBox, compact && styles.iconBoxCompact]}>
        {spinIcon ? (
          <SpinningIcon name={icon} size={iconSize} color={resolvedIconColor} />
        ) : (
          <MaterialIcons name={icon} size={iconSize} color={resolvedIconColor} />
        )}
      </View>
      <AppText tipo={compact ? 'texto' : 'subtitulo'} peso="forte" style={[styles.title, compact && styles.titleCompact]}>
        {title}
      </AppText>
      <AppText tipo="legenda" style={[styles.description, compact && styles.descriptionCompact]}>
        {description}
      </AppText>
      {actionLabel && onAction && (
        <Pressable
          style={({ pressed }) => [styles.actionButton, compact && styles.actionButtonCompact, pressed && styles.pressed]}
          onPress={onAction}
          accessibilityRole="button">
          {actionIcon && <MaterialIcons name={actionIcon} size={18} color={colors.textOnAccent} />}
          <AppText peso="forte" tipo={compact ? 'legenda' : 'texto'} style={styles.actionText}>
            {actionLabel}
          </AppText>
        </Pressable>
      )}
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  card: {
    alignItems: 'center' as const,
    paddingHorizontal: 26,
    paddingVertical: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bgSurface,
  },
  cardCompact: { paddingHorizontal: 20, paddingVertical: 24 },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: theme.colors.bgSurfaceAlt,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 12,
  },
  iconBoxCompact: { width: 44, height: 44, borderRadius: 14, marginBottom: 10 },
  title: { color: theme.colors.textPrimary, fontSize: 17, lineHeight: 22, textAlign: 'center' as const },
  titleCompact: { fontSize: 15, lineHeight: 20, marginBottom: 2 },
  description: { color: theme.colors.textSecondary, textAlign: 'center' as const, fontSize: 13, lineHeight: 19, marginTop: 6 },
  descriptionCompact: { lineHeight: 18, marginTop: 2 },
  actionButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    borderRadius: 13,
    paddingHorizontal: 18,
    paddingVertical: 11,
    backgroundColor: theme.colors.accentPrimary,
    marginTop: 16,
  },
  actionButtonCompact: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 9, marginTop: 12 },
  actionText: { color: theme.colors.textOnAccent, fontSize: 13 },
});
