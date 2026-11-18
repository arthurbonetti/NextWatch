import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ComponentProps } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { AppText } from '@/components/atoms/AppText';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

type EmptyStateCardProps = {
  icon: MaterialIconName;
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
  title,
  description,
  actionLabel,
  actionIcon,
  onAction,
  iconColor = '#a3520d',
  compact = false,
  style,
}: EmptyStateCardProps) {
  return (
    <View style={[styles.card, compact && styles.cardCompact, style]}>
      <View style={[styles.iconBox, compact && styles.iconBoxCompact]}>
        <MaterialIcons name={icon} size={compact ? 22 : 26} color={iconColor} />
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
          {actionIcon && <MaterialIcons name={actionIcon} size={18} color="#182230" />}
          <AppText peso="forte" tipo={compact ? 'legenda' : 'texto'} style={styles.actionText}>
            {actionLabel}
          </AppText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  card: {
    alignItems: 'center',
    paddingHorizontal: 26,
    paddingVertical: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e8e2d5',
    backgroundColor: '#fffdf8',
  },
  cardCompact: { paddingHorizontal: 20, paddingVertical: 24 },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#f1e8d7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  iconBoxCompact: { width: 44, height: 44, borderRadius: 14, marginBottom: 10 },
  title: { color: '#182230', fontSize: 17, lineHeight: 22, textAlign: 'center' },
  titleCompact: { fontSize: 15, lineHeight: 20, marginBottom: 2 },
  description: { color: '#5e5c57', textAlign: 'center', fontSize: 13, lineHeight: 19, marginTop: 6 },
  descriptionCompact: { lineHeight: 18, marginTop: 2 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 13,
    paddingHorizontal: 18,
    paddingVertical: 11,
    backgroundColor: '#f3b43f',
    marginTop: 16,
  },
  actionButtonCompact: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 9, marginTop: 12 },
  actionText: { color: '#182230', fontSize: 13 },
});
