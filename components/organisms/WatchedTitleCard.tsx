import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/atoms/AppText';
import { TitleArtwork } from '@/components/atoms/TitleArtwork';
import { isSerialTitle } from '@/constants/catalog';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';
import { useTitleTotalEpisodes } from '@/hooks/useCatalog';
import type { DrawHistoryEntry } from '@/types/drawHistory';
import type { MediaTitle } from '@/types/media';
import {
  countWatchedSeriesEpisodes,
  SeriesProgressMap,
  summarizeWatchedProgress,
} from '@/utils/watchedProgress';

export type WatchedTitleCardProps = {
  id: string;
  title?: MediaTitle;
  drawEntry?: DrawHistoryEntry;
  progressMap?: SeriesProgressMap;
  onOpen: (id: string) => void;
};

/** Card de obra assistida ou em andamento com badges de conclusão e barra de progresso. */
export const WatchedTitleCard = memo(function WatchedTitleCard({
  id,
  title,
  drawEntry,
  progressMap,
  onOpen,
}: WatchedTitleCardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const isSerial = title
    ? isSerialTitle(title)
    : drawEntry?.kind === 'Série' ||
      (drawEntry?.kind === 'Anime' && !id.startsWith('tmdb-movie-')) ||
      id.startsWith('tmdb-tv-');

  const totalEpisodes = useTitleTotalEpisodes(title, isSerial);

  const summary = summarizeWatchedProgress({ isSerial, progressMap, totalEpisodes });
  const watchedEpisodesCount = countWatchedSeriesEpisodes(progressMap);
  const isFromRoulette = Boolean(drawEntry && drawEntry.acao === 'assistiu');
  const displayTitle = title?.title ?? drawEntry?.title ?? 'Carregando obra…';
  const displayKind = title?.kind ?? drawEntry?.kind;
  const displayMeta = title
    ? `${title.year || 'Ano não informado'} · ${title.kind}`
    : (displayKind ?? '');
  const posterPath = title?.tmdbPosterPath ?? drawEntry?.tmdbPosterPath;
  const backdropPath = title?.tmdbBackdropPath;
  const cardColor = title?.color ?? drawEntry?.color ?? colors.navyMuted;

  const completedLabel =
    isSerial && watchedEpisodesCount > 0
      ? `${totalEpisodes && totalEpisodes > 0 ? totalEpisodes : watchedEpisodesCount} ep.`
      : 'Assistido';
  const showRouletteTag = isFromRoulette && (!isSerial || watchedEpisodesCount === 0);

  return (
    <Pressable
      style={({ pressed }) => [styles.watchedCard, pressed && styles.pressed]}
      onPress={() => onOpen(id)}
      accessibilityRole="button"
      accessibilityLabel={`Abrir detalhes de ${displayTitle}, ${summary.completed ? completedLabel : summary.label}${!summary.completed && summary.percent !== null ? `, ${summary.percent}%` : ''}`}>
      <View style={[styles.watchedPoster, { backgroundColor: cardColor }]}>
        <Animated.View sharedTransitionTag={`title-poster-${id}`} style={StyleSheet.absoluteFill}>
          <TitleArtwork
            id={id}
            variant="poster"
            posterPath={posterPath}
            backdropPath={backdropPath}
            fallback={
              <MaterialIcons
                name={title?.icon ?? (isSerial ? 'live-tv' : 'movie')}
                size={22}
                color={colors.textOnNavy}
              />
            }
          />
        </Animated.View>
      </View>

      <View style={styles.watchedCopy}>
        <AppText peso="forte" style={styles.watchedTitle} numberOfLines={2}>
          {displayTitle}
        </AppText>
        {Boolean(displayMeta) && (
          <AppText tipo="legenda" tabular style={styles.watchedMeta} numberOfLines={1}>
            {displayMeta}
          </AppText>
        )}

        {summary.completed ? (
          <View style={styles.completedBadgesRow}>
            <View style={styles.completedBadge}>
              <MaterialIcons name="check" size={13} color={colors.badgeSuccessText} />
              <AppText tipo="legenda" peso="forte" tabular style={styles.completedBadgeText}>
                {completedLabel}
              </AppText>
            </View>
            {showRouletteTag && (
              <View style={styles.rouletteBadge}>
                <MaterialIcons name="casino" size={12} color={colors.badgeAccentText} />
                <AppText tipo="legenda" peso="forte" style={styles.rouletteBadgeText}>
                  Roleta
                </AppText>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.progressBlock}>
            <View style={styles.progressHeader}>
              <View style={styles.progressLabelRow}>
                <MaterialIcons
                  name="play-circle-outline"
                  size={14}
                  color={colors.accentLink}
                />
                <AppText
                  tipo="legenda"
                  peso="semiforte"
                  tabular
                  numberOfLines={1}
                  style={styles.progressLabel}>
                  {summary.label}
                </AppText>
              </View>
              {summary.percent !== null && (
                <AppText
                  tipo="legenda"
                  peso="forte"
                  tabular
                  style={styles.progressPercent}>
                  {summary.percent}%
                </AppText>
              )}
            </View>

            {summary.percent !== null && (
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${summary.percent}%`,
                      backgroundColor: colors.accentPrimary,
                    },
                  ]}
                />
              </View>
            )}
          </View>
        )}
      </View>

      <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
    </Pressable>
  );
});

const createStyles = (theme: Theme) => ({
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  watchedCard: {
    minHeight: 104,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bgSurface,
    marginBottom: 10,
    gap: 12,
  },
  watchedPoster: {
    width: 64,
    height: 86,
    borderRadius: 11,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
  },
  watchedCopy: { flex: 1, paddingVertical: 2 },
  watchedTitle: {
    color: theme.colors.textPrimary,
    fontSize: 14.5,
    lineHeight: 19,
    marginBottom: 2,
  },
  watchedMeta: { color: theme.colors.textSecondary, fontSize: 12.5, lineHeight: 17 },
  completedBadgesRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginTop: 8,
  },
  completedBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.badgeSuccessBorder,
    backgroundColor: theme.colors.badgeSuccessBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  completedBadgeText: {
    color: theme.colors.badgeSuccessText,
    fontSize: 11.5,
  },
  rouletteBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.badgeAccentBorder,
    backgroundColor: theme.colors.badgeAccentBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  rouletteBadgeText: {
    color: theme.colors.badgeAccentText,
    fontSize: 11.5,
  },
  progressBlock: { marginTop: 9, gap: 5 },
  progressHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 8,
  },
  progressLabelRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5, flex: 1 },
  progressLabel: { color: theme.colors.textSecondary, fontSize: 12 },
  progressPercent: { color: theme.colors.textPrimary, fontSize: 12 },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.bgSurfaceAlt,
    overflow: 'hidden' as const,
  },
  progressFill: { height: '100%' as const, borderRadius: 3 },
});
