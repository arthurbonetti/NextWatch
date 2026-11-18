import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
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
import { THEME, withAlpha } from '@/constants/theme';
import {
  EpisodeSummary,
  fetchTvSeasonEpisodes,
  getCachedTvSeasonEpisodes,
  SeasonSummary,
} from '@/services/tmdb';
import { triggerSelectionHaptic, triggerSuccessHaptic } from '@/utils/haptics';

type SeriesSeasonsSectionProps = {
  titleId: string;
  seasons: SeasonSummary[];
  accentColor: string;
  totalWatchedEpisodes: number;
  isEpisodeWatched: (seasonNumber: number, episodeNumber: number) => boolean;
  getSeasonWatchedCount: (seasonNumber: number) => number;
  isSeasonCompleted: (seasonNumber: number, episodeCount: number) => boolean;
  onToggleEpisode: (seasonNumber: number, episodeNumber: number) => void;
  onToggleSeason: (seasonNumber: number, episodeCount: number, episodeNumbers?: number[]) => void;
};

type SeasonAccordionProps = {
  titleId: string;
  season: SeasonSummary;
  expanded: boolean;
  accentColor: string;
  watchedCount: number;
  completed: boolean;
  isEpisodeWatched: (seasonNumber: number, episodeNumber: number) => boolean;
  onToggleExpand: () => void;
  onToggleEpisode: (seasonNumber: number, episodeNumber: number) => void;
  onToggleSeason: (seasonNumber: number, episodeCount: number, episodeNumbers?: number[]) => void;
};

function SeasonAccordion({
  titleId,
  season,
  expanded,
  accentColor,
  watchedCount,
  completed,
  isEpisodeWatched,
  onToggleExpand,
  onToggleEpisode,
  onToggleSeason,
}: SeasonAccordionProps) {
  const reducedMotion = useReducedMotion();
  const [loadedKey, setLoadedKey] = useState<string>('');
  const [fetchedEpisodes, setFetchedEpisodes] = useState<EpisodeSummary[]>([]);
  const requestKey = `${titleId}:${season.seasonNumber}`;
  const cachedEpisodes = expanded ? getCachedTvSeasonEpisodes(titleId, season.seasonNumber) : null;
  const episodes = cachedEpisodes ?? (loadedKey === requestKey ? fetchedEpisodes : null);
  const loadingEpisodes = expanded && episodes === null;

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

  useEffect(() => {
    if (!expanded) return;
    const cached = getCachedTvSeasonEpisodes(titleId, season.seasonNumber);
    if (cached) return;

    let cancelled = false;
    void fetchTvSeasonEpisodes(titleId, season.seasonNumber)
      .then((list) => {
        if (cancelled) return;
        setFetchedEpisodes(list);
        setLoadedKey(requestKey);
      })
      .catch(() => {
        if (cancelled) return;
        setFetchedEpisodes([]);
        setLoadedKey(requestKey);
      });

    return () => {
      cancelled = true;
    };
  }, [expanded, requestKey, season.seasonNumber, titleId]);

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
        completed && { borderColor: withAlpha(THEME.colors.successText, 0.42) },
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
            <MaterialIcons name="expand-more" size={20} color={THEME.colors.textSecondary} />
          </Animated.View>
          <View style={styles.seasonInfo}>
            <View style={styles.seasonTitleRow}>
              <AppText tipo="texto" peso="forte" style={styles.seasonTitle} numberOfLines={1}>
                {seasonLabel}
              </AppText>
              {ratingText && (
                <View style={styles.seasonRatingPill}>
                  <MaterialIcons name="star" size={11} color={THEME.colors.gold} />
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
                  backgroundColor: withAlpha(accentColor, 0.14),
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
            color={completed ? THEME.colors.successText : THEME.colors.textPrimary}
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
                      color={watched ? THEME.colors.successText : THEME.colors.textMuted}
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
  titleId,
  seasons,
  accentColor,
  totalWatchedEpisodes,
  isEpisodeWatched,
  getSeasonWatchedCount,
  isSeasonCompleted,
  onToggleEpisode,
  onToggleSeason,
}: SeriesSeasonsSectionProps) {
  const reducedMotion = useReducedMotion();
  const [expandedSeason, setExpandedSeason] = useState<number | null>(
    seasons.length === 1 ? seasons[0].seasonNumber : null,
  );

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
                  progressPercent === 100 ? THEME.colors.successText : accentColor,
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
              titleId={titleId}
              season={season}
              expanded={isExpanded}
              accentColor={accentColor}
              watchedCount={getSeasonWatchedCount(season.seasonNumber)}
              completed={isSeasonCompleted(season.seasonNumber, season.episodeCount)}
              isEpisodeWatched={isEpisodeWatched}
              onToggleExpand={() =>
                setExpandedSeason((prev) =>
                  prev === season.seasonNumber ? null : season.seasonNumber,
                )
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

const styles = StyleSheet.create({
  section: {
    gap: THEME.spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: THEME.spacing.sm,
  },
  sectionTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 16,
  },
  progressSummaryText: {
    color: THEME.colors.textSecondary,
    fontSize: 12.5,
  },
  progressCard: {
    backgroundColor: THEME.colors.bgCard,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    padding: THEME.spacing.md,
    gap: 8,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.colors.bgSubtle,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressHint: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  seasonsList: {
    gap: THEME.spacing.sm,
  },
  seasonCard: {
    backgroundColor: THEME.colors.bgCard,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    overflow: 'hidden',
  },
  seasonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: THEME.spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: THEME.spacing.md,
  },
  seasonToggleArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  seasonInfo: {
    flex: 1,
    gap: 2,
  },
  seasonTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  seasonTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 14,
    flexShrink: 1,
  },
  seasonRatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: THEME.colors.navy,
    borderRadius: THEME.radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  seasonRatingText: {
    color: THEME.colors.textOnNavy,
    fontSize: 10.5,
  },
  seasonMeta: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
  },
  seasonMarkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: THEME.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  seasonMarkBtnDone: {
    backgroundColor: THEME.colors.bgSuccess,
    borderColor: THEME.colors.borderSuccess,
  },
  seasonMarkText: {
    color: THEME.colors.textPrimary,
    fontSize: 12,
  },
  seasonMarkTextDone: {
    color: THEME.colors.successText,
  },
  pressed: {
    opacity: 0.74,
  },
  episodesList: {
    borderTopWidth: 1,
    borderTopColor: THEME.colors.borderLight,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    gap: 6,
    backgroundColor: THEME.colors.bgSubtle,
  },
  episodesItems: {
    gap: 6,
  },
  episodesSkeleton: {
    gap: 6,
  },
  episodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: THEME.colors.bgCard,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  episodeRowWatched: {
    backgroundColor: withAlpha(THEME.colors.bgSuccess, 0.55),
    borderColor: THEME.colors.borderSuccess,
  },
  episodeTextCol: {
    flex: 1,
    gap: 1,
  },
  episodeName: {
    color: THEME.colors.textPrimary,
    fontSize: 13,
  },
  episodeNameWatched: {
    color: THEME.colors.successText,
  },
  episodeSub: {
    color: THEME.colors.textMuted,
    fontSize: 11,
  },
  fallbackEpisodesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  fallbackEpisodePill: {
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    backgroundColor: THEME.colors.bgCard,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  fallbackEpisodePillWatched: {
    backgroundColor: THEME.colors.bgSuccess,
    borderColor: THEME.colors.borderSuccess,
  },
  fallbackEpisodeText: {
    color: THEME.colors.textPrimary,
    fontSize: 12,
  },
  fallbackEpisodeTextWatched: {
    color: THEME.colors.successText,
  },
});
