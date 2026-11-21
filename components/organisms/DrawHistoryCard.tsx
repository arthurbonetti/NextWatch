import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ComponentProps, memo, useMemo } from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/atoms/AppText';
import { TitleArtwork } from '@/components/atoms/TitleArtwork';
import { MediaTitle } from '@/constants/catalog';
import { Theme, ThemeColors } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';
import { type DrawAction, type DrawHistoryEntry } from '@/types/drawHistory';
import { formatShortDateTime } from '@/utils/format';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

function getActionMeta(
  colors: ThemeColors,
): Record<DrawAction, { label: string; icon: MaterialIconName; bg: string; color: string }> {
  return {
    assistiu: { label: 'Assistiu', icon: 'check-circle', bg: colors.bgSuccess, color: colors.successText },
    salvou: { label: 'Salvou', icon: 'bookmark', bg: colors.savedActiveBg, color: colors.savedActiveIcon },
    'sorteou outro': { label: 'Sorteou outro', icon: 'casino', bg: colors.bgWarning, color: colors.accentLink },
    ignorou: { label: 'Ignorou', icon: 'close', bg: colors.bgSurfaceAlt, color: colors.textSecondary },
  };
}

type DrawHistoryCardProps = {
  entry: DrawHistoryEntry;
  resolvedTitle?: MediaTitle;
  onPress?: () => void;
};

/** Card compacto para exibir um sorteio do histórico com sua ação e data. */
export const DrawHistoryCard = memo(function DrawHistoryCard({
  entry,
  resolvedTitle,
  onPress,
}: DrawHistoryCardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const actionMetaMap = useMemo(() => getActionMeta(colors), [colors]);

  const displayTitle = resolvedTitle?.title ?? entry.title ?? entry.tmdbId;
  const displayKind = resolvedTitle?.kind ?? entry.kind;
  const posterPath = resolvedTitle?.tmdbPosterPath ?? entry.tmdbPosterPath;
  const backdropPath = resolvedTitle?.tmdbBackdropPath;
  const cardColor = resolvedTitle?.color ?? entry.color ?? colors.navyMuted;
  const actionMeta = actionMetaMap[entry.acao];

  return (
    <Pressable
      disabled={!onPress}
      style={({ pressed }) => [styles.card, onPress && pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${displayTitle}, ${actionMeta.label}`}>
      <Animated.View
        sharedTransitionTag={`title-poster-${entry.tmdbId}`}
        style={[styles.poster, { backgroundColor: cardColor }]}>
        <TitleArtwork
          id={entry.tmdbId}
          variant="poster"
          posterPath={posterPath}
          backdropPath={backdropPath}
          fallback={<MaterialIcons name={resolvedTitle?.icon ?? 'movie'} size={18} color={colors.textOnNavy} />}
        />
      </Animated.View>
      <View style={styles.copy}>
        <AppText peso="forte" style={styles.title} numberOfLines={1}>
          {displayTitle}
        </AppText>
        <AppText tipo="legenda" tabular style={styles.meta} numberOfLines={1}>
          {displayKind ? `${displayKind} · ` : ''}
          {formatShortDateTime(entry.sorteadoEm)}
        </AppText>
      </View>
      <View style={[styles.actionBadge, { backgroundColor: actionMeta.bg }]}>
        <MaterialIcons name={actionMeta.icon} size={13} color={actionMeta.color} />
        <AppText tipo="legenda" peso="forte" style={[styles.actionBadgeText, { color: actionMeta.color }]}>
          {actionMeta.label}
        </AppText>
      </View>
    </Pressable>
  );
});

const createStyles = (theme: Theme) => ({
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  card: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 11,
    padding: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bgSurface,
  },
  poster: {
    width: 38,
    height: 50,
    borderRadius: 9,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
  },
  copy: { flex: 1 },
  title: { color: theme.colors.textPrimary, fontSize: 14, lineHeight: 19, marginBottom: 2 },
  meta: { color: theme.colors.textSecondary, fontSize: 12.5, lineHeight: 17 },
  actionBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  actionBadgeText: { fontSize: 11.5 },
});
