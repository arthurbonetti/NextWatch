import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { memo } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppIcon, type MaterialIconName } from '@/components/atoms/AppIcon';
import { AppText } from '@/components/atoms/AppText';
import { BookmarkIcon } from '@/components/atoms/BookmarkIcon';
import { ServiceLogoList } from '@/components/atoms/ServiceLogo';
import { TitleArtwork } from '@/components/atoms/TitleArtwork';
import { formatAverageRating, getTitleServices } from '@/constants/catalog';
import type { MediaTitle } from '@/types/media';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';

type MediaTitleCardProps = {
  title: MediaTitle;
  duration?: string;
  onOpen: () => void;
  actionIcon: MaterialIconName;
  actionLabel: string;
  onAction: () => void;
  actionButtonStyle?: StyleProp<ViewStyle>;
  actionIconColor?: string;
  imagePriority?: 'low' | 'normal' | 'high';
};

export const MediaTitleCard = memo(function MediaTitleCard({
  title,
  duration,
  onOpen,
  actionIcon,
  actionLabel,
  onAction,
  actionButtonStyle,
  actionIconColor,
  imagePriority = 'normal',
}: MediaTitleCardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const resolvedActionIconColor = actionIconColor ?? colors.textSecondary;
  const displayDuration = duration || title.duration;
  const averageRating = formatAverageRating(title);

  return (
    <View style={styles.resultCard}>
      <Pressable
        style={({ pressed }) => [styles.poster, { backgroundColor: title.color }, pressed && styles.pressed]}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Abrir ${title.title}`}>
        <Animated.View sharedTransitionTag={`title-poster-${title.id}`} style={StyleSheet.absoluteFill}>
          <TitleArtwork
            id={title.id}
            variant="poster"
            posterPath={title.tmdbPosterPath}
            backdropPath={title.tmdbBackdropPath}
            priority={imagePriority}
            transition={imagePriority === 'high' ? 0 : 200}
            fallback={<AppIcon name={title.icon} size={25} color={colors.textOnNavy} />}
          />
        </Animated.View>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.resultCopy, pressed && styles.pressed]}
        onPress={onOpen}
        accessibilityRole="button">
        <AppText peso="forte" style={styles.resultTitle} numberOfLines={2}>
          {title.title}
        </AppText>
        <AppText tipo="legenda" tabular style={styles.resultMeta}>
          {title.year || 'Ano não informado'} · {title.kind}{displayDuration ? ` · ${displayDuration}` : ''}
        </AppText>
        <AppText tipo="legenda" style={styles.resultGenres} numberOfLines={1}>
          {title.genres.slice(0, 2).join(' · ')}
        </AppText>
        <View style={styles.serviceLine}>
          <ServiceLogoList services={getTitleServices(title)} size={20} maxVisible={3} gap={5} overflowGap={4} />
          {averageRating !== '—' && (
            <View style={styles.ratingBadge} accessibilityLabel={`Nota ${averageRating} de 10`}>
              <MaterialIcons name="star" size={12} color={colors.accentPrimary} />
              <AppText tipo="legenda" peso="forte" tabular style={styles.scoreMeta}>
                {averageRating}
              </AppText>
            </View>
          )}
        </View>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.actionButton, actionButtonStyle, pressed && styles.pressed]}
        onPress={onAction}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}>
        {actionIcon === 'bookmark' || actionIcon === 'bookmark-add' ? (
          <BookmarkIcon
            saved={actionIcon === 'bookmark'}
            itemKey={title.id}
            size={18}
            color={resolvedActionIconColor}
          />
        ) : (
          <AppIcon name={actionIcon} size={18} color={resolvedActionIconColor} />
        )}
      </Pressable>
    </View>
  );
});

const createStyles = (theme: Theme) => ({
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  resultCard: {
    minHeight: 110,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bgSurface,
    marginBottom: 10,
  },
  poster: {
    width: 72,
    height: 92,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 7,
    overflow: 'hidden' as const,
  },
  resultCopy: { flex: 1, paddingHorizontal: 12, paddingVertical: 4 },
  resultTitle: { color: theme.colors.textPrimary, fontSize: 14.5, lineHeight: 19, marginBottom: 3 },
  resultMeta: { color: theme.colors.textSecondary, fontSize: 12.5, lineHeight: 17 },
  resultGenres: { color: theme.colors.textSecondary, fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  serviceLine: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, marginTop: 8 },
  ratingBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: theme.colors.heroBg,
  },
  scoreMeta: { color: theme.colors.textOnNavy, fontSize: 11, lineHeight: 14 },
  actionButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.colors.bgSurfaceAlt,
  },
});
