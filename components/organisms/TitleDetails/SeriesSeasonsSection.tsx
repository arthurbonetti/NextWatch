import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useMemo } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/atoms/AppText';
import { CollapsibleSection } from '@/components/atoms/CollapsibleSection';
import { SkeletonBox } from '@/components/atoms/SkeletonBox';
import { Theme, THEME, withAlpha } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';
import type { EpisodeSummary, SeasonSummary } from '@/types/media';
import { triggerSelectionHaptic, triggerSuccessHaptic } from '@/utils/haptics';

type SeriesSeasonsSectionProps = {
  seasons: SeasonSummary[];
  accentColor: string;
  expandedSeason: number | null;
  episodesBySeason: Partial<Record<number, EpisodeSummary[]>>;
  loadingSeasonNumber: number | null;
  seasonEpisodesError?: string | null;
  onToggleExpandSeason: (seasonNumber: number) => void;
  onRetrySeasonEpisodes?: (seasonNumber: number) => void;
  totalWatchedEpisodes: number;
  isEpisodeWatched: (seasonNumber: number, episodeNumber: number) => boolean;
  getSeasonWatchedCount: (seasonNumber: number) => number;
  isSeasonCompleted: (seasonNumber: number, episodeCount: number) => boolean;
  onToggleEpisode: (seasonNumber: number, episodeNumber: number) => void;
  onToggleSeason: (seasonNumber: number, episodeCount: number, episodeNumbers?: number[]) => void;
};

type SeasonAccordionProps = {
  season: SeasonSummary;
  expanded: boolean;
  accentColor: string;
  watchedCount: number;
  completed: boolean;
  episodes: EpisodeSummary[] | undefined;
  loadingEpisodes: boolean;
  episodesError: string | null;
  isEpisodeWatched: (seasonNumber: number, episodeNumber: number) => boolean;
  onToggleExpand: () => void;
  onRetryEpisodes?: () => void;
  onToggleEpisode: (seasonNumber: number, episodeNumber: number) => void;
  onToggleSeason: (seasonNumber: number, episodeCount: number, episodeNumbers?: number[]) => void;
};

function SeasonAccordion({
  season,
  expanded,
  accentColor,
  watchedCount,
  completed,
  episodes,
  loadingEpisodes,
  episodesError,
  isEpisodeWatched,
  onToggleExpand,
  onRetryEpisodes,
  onToggleEpisode,
  onToggleSeason,
}: SeasonAccordionProps) {
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(createStyles);
  const reducedMotion = useReducedMotion();

  const chevronRotation = useSharedValue(expanded ? 180 : 0);

  useEffect(() => {
    chevronRotation.set(
      reducedMotion
        ? expanded
          ? 180
          : 0
        : withTiming(expanded ? 180 : 0, {
            duration: 240,
            easing: Easing.bezier(0.22, 1, 0.36, 1),
          }),
    );
  }, [chevronRotation, expanded, reducedMotion]);

  const chevronAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.get()}deg` }],
  }));

  const fallbackEpisodeNumbers = useMemo(
    () => Array.from({ length: Math.max(0, season.episodeCount) }, (_, idx) => idx + 1),
    [season.episodeCount],
  );

  const handleToggleSeason = () => {
    if (completed) {
      triggerSelectionHaptic();
    } else {
      triggerSuccessHaptic();
    }
    const knownEpisodeNumbers =
      episodes && episodes.length > 0 ? episodes.map((ep) => ep.episodeNumber) : undefined;
    onToggleSeason(season.seasonNumber, season.episodeCount, knownEpisodeNumbers);
  };

  const seasonLabel =
    season.name && season.name.trim().length > 0
      ? season.name
      : `Temporada ${season.seasonNumber}`;
  const clampedWatched = Math.min(watchedCount, season.episodeCount);
  const ratingText =
    typeof season.voteAverage === 'number' && season.voteAverage > 0
      ? season.voteAverage.toFixed(1).replace('.', ',')
      : null;

  return (
    <View
      style={[
        styles.seasonCard,
        completed && { borderColor: withAlpha(colors.successText, 0.42) },
      ]}>
      <View style={styles.seasonHeader}>
        <Pressable
          onPress={() => {
            triggerSelectionHaptic();
            onToggleExpand();
          }}
          style={({ pressed }) => [styles.seasonToggleArea, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${seasonLabel}, ${season.episodeCount} episódios`}>
          <Animated.View style={chevronAnimatedStyle}>
            <MaterialIcons name="expand-more" size={20} color={colors.textSecondary} />
          </Animated.View>
          <View style={styles.seasonInfo}>
            <View style={styles.seasonTitleRow}>
              <AppText tipo="texto" peso="forte" style={styles.seasonTitle} numberOfLines={1}>
                {seasonLabel}
              </AppText>
              {ratingText && (
                <View style={styles.seasonRatingPill}>
                  <MaterialIcons name="star" size={11} color={colors.accentPrimary} />
                  <AppText tipo="legenda" peso="forte" style={styles.seasonRatingText}>
                    {ratingText}
                  </AppText>
                </View>
              )}
            </View>
            <AppText tipo="legenda" style={styles.seasonMeta}>
              {season.episodeCount} {season.episodeCount === 1 ? 'episódio' : 'episódios'} ·{' '}
              {clampedWatched}/{season.episodeCount} assistidos
            </AppText>
          </View>
        </Pressable>

        <Pressable
          onPress={handleToggleSeason}
          style={({ pressed }) => [
            styles.seasonMarkBtn,
            completed
              ? styles.seasonMarkBtnDone
              : {
                  backgroundColor: withAlpha(accentColor, isDark ? 0.18 : 0.14),
                  borderColor: withAlpha(accentColor, 0.35),
                },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityState={{ checked: completed }}
          accessibilityLabel={
            completed
              ? `Desmarcar ${seasonLabel} como assistida`
              : `Marcar ${seasonLabel} como assistida`
          }>
          <MaterialIcons
            name={completed ? 'check-circle' : 'radio-button-unchecked'}
            size={15}
            color={completed ? colors.successText : colors.textPrimary}
          />
          <AppText
            tipo="legenda"
            peso="forte"
            style={[styles.seasonMarkText, completed && styles.seasonMarkTextDone]}>
            {completed ? 'Assistida' : 'Marcar'}
          </AppText>
        </Pressable>
      </View>

      <CollapsibleSection
        expanded={expanded}
        slideOffset={-6}
        openDuration={250}
        closeDuration={200}>
        <View style={styles.episodesList}>
          {loadingEpisodes ? (
            <View style={styles.episodesSkeleton}>
              <SkeletonBox width="100%" height={36} borderRadius={THEME.radius.sm} />
              <SkeletonBox width="100%" height={36} borderRadius={THEME.radius.sm} />
              <SkeletonBox width="85%" height={36} borderRadius={THEME.radius.sm} />
            </View>
          ) : episodesError && (!episodes || episodes.length === 0) ? (
            <View style={styles.episodesErrorBox}>
              <AppText tipo="legenda" style={styles.episodesErrorText}>
                {episodesError}
              </AppText>
              {onRetryEpisodes && (
                <Pressable
                  onPress={() => {
                    triggerSelectionHaptic();
                    onRetryEpisodes();
                  }}
                  style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Tentar carregar episódios da ${seasonLabel} novamente`}>
                  <MaterialIcons name="refresh" size={14} color={colors.savedActiveText} />
                  <AppText tipo="legenda" peso="forte" style={styles.retryButtonText}>
                    Tentar novamente
                  </AppText>
                </Pressable>
              )}
            </View>
          ) : episodes && episodes.length > 0 ? (
            <Animated.View
              entering={reducedMotion ? undefined : FadeIn.duration(200)}
              style={styles.episodesItems}>
              {episodes.map((ep) => {
                const watched = isEpisodeWatched(season.seasonNumber, ep.episodeNumber);
                const epRating =
                  typeof ep.voteAverage === 'number' && ep.voteAverage > 0
                    ? ep.voteAverage.toFixed(1).replace('.', ',')
                    : null;
                return (
                  <Pressable
                    key={ep.episodeNumber}
                    onPress={() => {
                      triggerSelectionHaptic();
                      onToggleEpisode(season.seasonNumber, ep.episodeNumber);
                    }}
                    style={({ pressed }) => [
                      styles.episodeRow,
                      watched && styles.episodeRowWatched,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: watched }}
                    accessibilityLabel={`Episódio ${ep.episodeNumber}: ${ep.name}`}>
                    <MaterialIcons
                      name={watched ? 'check-circle' : 'radio-button-unchecked'}
                      size={19}
                      color={watched ? colors.successText : colors.textMuted}
                    />
                    <View style={styles.episodeTextCol}>
                      <AppText
                        tipo="legenda"
                        peso="forte"
                        style={[styles.episodeName, watched && styles.episodeNameWatched]}
                        numberOfLines={1}>
                        {ep.episodeNumber}. {ep.name}
                      </AppText>
                      {(ep.runtime || epRating) && (
                        <AppText tipo="legenda" style={styles.episodeSub}>
                          {[
                            ep.runtime ? `${ep.runtime}min` : null,
                            epRating ? `★ ${epRating}` : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </AppText>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </Animated.View>
          ) : (
            <Animated.View
              entering={reducedMotion ? undefined : FadeIn.duration(200)}
              style={styles.fallbackEpisodesWrap}>
              {fallbackEpisodeNumbers.map((epNum) => {
                const watched = isEpisodeWatched(season.seasonNumber, epNum);
                return (
                  <Pressable
                    key={epNum}
                    onPress={() => {
                      triggerSelectionHaptic();
                      onToggleEpisode(season.seasonNumber, epNum);
                    }}
                    style={({ pressed }) => [
                      styles.fallbackEpisodePill,
                      watched && styles.fallbackEpisodePillWatched,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: watched }}
                    accessibilityLabel={`Episódio ${epNum}`}>
                    <AppText
                      tipo="legenda"
                      peso="forte"
                      style={[
                        styles.fallbackEpisodeText,
                        watched && styles.fallbackEpisodeTextWatched,
                      ]}>
                      Ep. {epNum}
                    </AppText>
                  </Pressable>
                );
              })}
            </Animated.View>
          )}
        </View>
      </CollapsibleSection>
    </View>
  );
}

export function SeriesSeasonsSection({
  seasons,
  accentColor,
  expandedSeason,
  episodesBySeason,
  loadingSeasonNumber,
  seasonEpisodesError = null,
  onToggleExpandSeason,
  onRetrySeasonEpisodes,
  totalWatchedEpisodes,
  isEpisodeWatched,
  getSeasonWatchedCount,
  isSeasonCompleted,
  onToggleEpisode,
  onToggleSeason,
}: SeriesSeasonsSectionProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const reducedMotion = useReducedMotion();

  const totalEpisodes = useMemo(
    () => seasons.reduce((acc, item) => acc + Math.max(0, item.episodeCount), 0),
    [seasons],
  );
  const clampedWatchedTotal = Math.min(totalWatchedEpisodes, totalEpisodes);
  const progressRatio = totalEpisodes > 0 ? Math.min(1, clampedWatchedTotal / totalEpisodes) : 0;
  const progressPercent = Math.round(progressRatio * 100);

  const barProgress = useSharedValue(progressRatio);
  useEffect(() => {
    if (reducedMotion) {
      barProgress.set(progressRatio);
      return;
    }
    barProgress.set(
      withTiming(progressRatio, { duration: 260, easing: Easing.out(Easing.cubic) }),
    );
  }, [barProgress, progressRatio, reducedMotion]);

  const barFillStyle = useAnimatedStyle(() => ({
    width: `${Math.round(barProgress.get() * 1000) / 10}%`,
  }));

  if (seasons.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <AppText tipo="subtitulo" peso="forte" style={styles.sectionTitle}>
          Temporadas e progresso
        </AppText>
        <AppText tipo="legenda" peso="forte" style={styles.progressSummaryText}>
          {clampedWatchedTotal}/{totalEpisodes} ep. ({progressPercent}%)
        </AppText>
      </View>

      <View style={styles.progressCard}>
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                backgroundColor:
                  progressPercent === 100 ? colors.successText : accentColor,
              },
              barFillStyle,
            ]}
          />
        </View>
        <AppText tipo="legenda" style={styles.progressHint}>
          {clampedWatchedTotal === 0
            ? 'Marque os episódios ou temporadas conforme for assistindo.'
            : progressPercent === 100
              ? 'Você concluiu todos os episódios disponíveis!'
              : `Faltam ${totalEpisodes - clampedWatchedTotal} ${totalEpisodes - clampedWatchedTotal === 1 ? 'episódio' : 'episódios'} para concluir.`}
        </AppText>
      </View>

      <View style={styles.seasonsList}>
        {seasons.map((season) => {
          const isExpanded = expandedSeason === season.seasonNumber;
          return (
            <SeasonAccordion
              key={season.seasonNumber}
              season={season}
              expanded={isExpanded}
              accentColor={accentColor}
              watchedCount={getSeasonWatchedCount(season.seasonNumber)}
              completed={isSeasonCompleted(season.seasonNumber, season.episodeCount)}
              episodes={episodesBySeason[season.seasonNumber]}
              loadingEpisodes={isExpanded && loadingSeasonNumber === season.seasonNumber}
              episodesError={isExpanded ? seasonEpisodesError : null}
              isEpisodeWatched={isEpisodeWatched}
              onToggleExpand={() => onToggleExpandSeason(season.seasonNumber)}
              onRetryEpisodes={
                onRetrySeasonEpisodes
                  ? () => onRetrySeasonEpisodes(season.seasonNumber)
                  : undefined
              }
              onToggleEpisode={onToggleEpisode}
              onToggleSeason={onToggleSeason}
            />
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  section: {
    gap: theme.spacing.sm,
  },
  headerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
  },
  progressSummaryText: {
    color: theme.colors.textSecondary,
    fontSize: 12.5,
  },
  progressCard: {
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    padding: theme.spacing.md,
    gap: 8,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.bgSurfaceAlt,
    overflow: 'hidden' as const,
  },
  progressFill: {
    height: '100%' as const,
    borderRadius: 4,
  },
  progressHint: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  seasonsList: {
    gap: theme.spacing.sm,
  },
  seasonCard: {
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    overflow: 'hidden' as const,
  },
  seasonHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
  },
  seasonToggleArea: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  seasonInfo: {
    flex: 1,
    gap: 2,
  },
  seasonTitleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  seasonTitle: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    flexShrink: 1,
  },
  seasonRatingPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
    backgroundColor: theme.colors.heroBg,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  seasonRatingText: {
    color: theme.colors.textOnNavy,
    fontSize: 10.5,
  },
  seasonMeta: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  seasonMarkBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  seasonMarkBtnDone: {
    backgroundColor: theme.colors.bgSuccess,
    borderColor: theme.colors.borderSuccess,
  },
  seasonMarkText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
  },
  seasonMarkTextDone: {
    color: theme.colors.successText,
  },
  pressed: {
    opacity: 0.74,
  },
  episodesList: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: 6,
    backgroundColor: theme.colors.bgSurfaceAlt,
  },
  episodesItems: {
    gap: 6,
  },
  episodesSkeleton: {
    gap: 6,
  },
  episodesErrorBox: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 10,
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  episodesErrorText: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  retryButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.savedActiveBg,
    borderWidth: 1,
    borderColor: theme.colors.savedActiveBorder,
  },
  retryButtonText: {
    color: theme.colors.savedActiveText,
    fontSize: 11.5,
  },
  episodeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  episodeRowWatched: {
    backgroundColor: theme.isDark
      ? theme.colors.bgSuccess
      : withAlpha(theme.colors.bgSuccess, 0.55),
    borderColor: theme.colors.borderSuccess,
  },
  episodeTextCol: {
    flex: 1,
    gap: 1,
  },
  episodeName: {
    color: theme.colors.textPrimary,
    fontSize: 13,
  },
  episodeNameWatched: {
    color: theme.colors.successText,
  },
  episodeSub: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
  fallbackEpisodesWrap: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 6,
  },
  fallbackEpisodePill: {
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bgSurface,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  fallbackEpisodePillWatched: {
    backgroundColor: theme.colors.bgSuccess,
    borderColor: theme.colors.borderSuccess,
  },
  fallbackEpisodeText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
  },
  fallbackEpisodeTextWatched: {
    color: theme.colors.successText,
  },
});
