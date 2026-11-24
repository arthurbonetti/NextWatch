import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/atoms/AppIcon';
import { AppText } from '@/components/atoms/AppText';
import { BackButton } from '@/components/atoms/BackButton';
import { ExpandableText } from '@/components/atoms/ExpandableText';
import { RatingInfoSheet } from '@/components/organisms/RatingInfoSheet';
import { ScreenHeader } from '@/components/organisms/ScreenHeader';
import { CastCarousel } from '@/components/organisms/TitleDetails/CastCarousel';
import { MovieProgressSection } from '@/components/organisms/TitleDetails/MovieProgressSection';
import { SeriesSeasonsSection } from '@/components/organisms/TitleDetails/SeriesSeasonsSection';
import { SimilarTitlesCarousel } from '@/components/organisms/TitleDetails/SimilarTitlesCarousel';
import { StreamingAvailabilitySection } from '@/components/organisms/TitleDetails/StreamingAvailabilitySection';
import { TitleActionsFooter } from '@/components/organisms/TitleDetails/TitleActionsFooter';
import { TitleDetailsSkeleton } from '@/components/organisms/TitleDetails/TitleDetailsSkeleton';
import { TitleHero } from '@/components/organisms/TitleDetails/TitleHero';
import { TitleMetadataSection } from '@/components/organisms/TitleDetails/TitleMetadataSection';
import { Theme, THEME, withAlpha } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';
import { useTitleDetailsController } from '@/hooks/useTitleDetailsController';
import { PersonalRatingModal } from '@/components/organisms/PersonalRatingModal';

export default function TitleDetailsScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  const controller = useTitleDetailsController(id);

  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.set(event.contentOffset.y);
    },
  });

  const stickyHeaderBgStyle = useAnimatedStyle(() => ({
    opacity: reducedMotion
      ? scrollY.get() > 160
        ? 1
        : 0
      : interpolate(scrollY.get(), [135, 200], [0, 1], Extrapolation.CLAMP),
  }));

  const stickyTitleStyle = useAnimatedStyle(() => ({
    opacity: reducedMotion
      ? scrollY.get() > 180
        ? 1
        : 0
      : interpolate(scrollY.get(), [165, 215], [0, 1], Extrapolation.CLAMP),
  }));

  if (!controller.authReady) return null;
  if (controller.isPasswordRecovery) return <Redirect href="/(auth)/reset-password" />;
  if (!controller.user) return <Redirect href="/(auth)/login" />;

  const { title } = controller;

  if (!title) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScreenHeader title="Detalhes" showBack fallbackHref="/(tabs)/explore" />
        <View style={styles.notFound}>
          <MaterialIcons name="movie-filter" size={40} color={colors.accentLink} />
          <AppText tipo="subtitulo" peso="forte" style={styles.notFoundTitle}>
            {controller.catalogStatus === 'loading' ||
            !controller.storageReady ||
            controller.resolvingFallback
              ? 'Carregando título…'
              : 'Título não encontrado'}
          </AppText>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/explore'))}
            accessibilityRole="button">
            <AppText peso="forte" style={styles.link}>
              Voltar
            </AppText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 112 + Math.max(insets.bottom, THEME.spacing.md) },
        ]}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}>
        <TitleHero
          title={title}
          durationLabel={controller.safeDuration}
          episodeDuration={controller.richDetails?.episodeDuration}
          statusLabel={controller.richDetails?.statusLabel}
          certification={controller.richDetails?.certification}
          trailerUrl={controller.richDetails?.trailerUrl}
          scrollY={scrollY}
          topInset={insets.top}
          onWatchTrailer={controller.handleWatchTrailer}
        />

        <View style={styles.body}>
          <TitleMetadataSection
            title={title}
            metacritic={controller.metacritic}
            formattedVotes={controller.formattedVotes}
            onPressRating={controller.handleOpenRatingInfo}
            onPressGenre={controller.handlePressGenre}
          />

          <View style={styles.synopsisSection}>
            <AppText tipo="subtitulo" peso="forte" style={styles.sectionTitle}>
              Sinopse
            </AppText>

            <ExpandableText
              key={title.id}
              text={controller.synopsisText}
              expanded={controller.synopsisExpanded}
              onToggle={controller.handleToggleSynopsis}
              collapsedLines={4}
              fadeColor={colors.bgPrimary}
              textStyle={styles.synopsisText}
              expandAccessibilityLabel="Mostrar mais da sinopse"
              collapseAccessibilityLabel="Mostrar menos da sinopse"
              buttonStyle={styles.expandButton}
              buttonTextStyle={styles.expandButtonText}
              chevronColor={colors.accentLink}
              chevronSize={17}
            />
          </View>

          <StreamingAvailabilitySection
            services={controller.allServices}
            subscriptions={controller.subscriptions}
            onPressService={controller.handleOpenService}
          />

          {!controller.isSerialTitle && (
            <MovieProgressSection
              titleName={title.title}
              watched={controller.movieWatched}
              onToggleWatched={controller.handleToggleMovieWatched}
            />
          )}

          {controller.loadingRichDetails ? (
            <TitleDetailsSkeleton />
          ) : controller.richDetailsError ? (
            <View style={styles.richErrorCard}>
              <MaterialIcons name="error-outline" size={20} color={colors.accentLink} />
              <AppText tipo="legenda" style={styles.richErrorText}>
                {controller.richDetailsError}
              </AppText>
              <Pressable
                onPress={controller.handleRetryRichDetails}
                style={({ pressed }) => [styles.richRetryButton, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Tentar carregar detalhes novamente">
                <AppText tipo="legenda" peso="forte" style={styles.richRetryText}>
                  Tentar novamente
                </AppText>
              </Pressable>
            </View>
          ) : (
            <>
              {controller.isSerialTitle &&
                controller.richDetails &&
                controller.richDetails.seasons.length > 0 && (
                  <SeriesSeasonsSection
                    seasons={controller.richDetails.seasons}
                    expandedSeason={controller.expandedSeason}
                    episodesBySeason={controller.episodesBySeason}
                    loadingSeasonNumber={controller.loadingSeasonNumber}
                    seasonEpisodesError={controller.seasonEpisodesError}
                    onToggleExpandSeason={controller.handleToggleExpandSeason}
                    onRetrySeasonEpisodes={controller.handleRetrySeasonEpisodes}
                    totalWatchedEpisodes={controller.seriesProgress.totalWatchedEpisodes}
                    isEpisodeWatched={controller.seriesProgress.isEpisodeWatched}
                    getSeasonWatchedCount={controller.seriesProgress.getSeasonWatchedCount}
                    isSeasonCompleted={controller.seriesProgress.isSeasonCompleted}
                    onToggleEpisode={controller.handleToggleEpisode}
                    onToggleSeason={controller.handleToggleSeason}
                  />
                )}

              {controller.richDetails && controller.richDetails.cast.length > 0 && (
                <CastCarousel cast={controller.richDetails.cast} />
              )}

              <SimilarTitlesCarousel
                titles={controller.richDetails?.similarTitles ?? []}
                onSelectTitle={controller.handleSelectSimilar}
                onDrawSimilar={controller.handleDrawSimilar}
              />
            </>
          )}
        </View>
      </Animated.ScrollView>

      <View
        style={[
          styles.stickyTopOverlay,
          { paddingTop: insets.top + THEME.spacing.xs, pointerEvents: 'box-none' },
        ]}>
        <Animated.View
          style={[styles.stickyTopBg, stickyHeaderBgStyle, { pointerEvents: 'none' }]}
        />
        <View style={[styles.stickyTopRow, { pointerEvents: 'box-none' }]}>
          <BackButton style={styles.floatingTopIconBtn} />
          <Animated.View
            style={[styles.stickyTopTitleWrap, stickyTitleStyle, { pointerEvents: 'none' }]}>
            <AppText tipo="subtitulo" peso="forte" numberOfLines={1} style={styles.stickyTopTitle}>
              {title.title}
            </AppText>
          </Animated.View>
          <Pressable
            onPress={controller.handleShare}
            style={({ pressed }) => [styles.floatingTopIconBtn, pressed && styles.pressed]}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Compartilhar ${title.title}`}>
            <AppIcon name="share" size={19} color={colors.textPrimary} />
          </Pressable>
        </View>
      </View>

      <TitleActionsFooter
        titleId={title.id}
        saved={controller.saved}
        bottomInset={insets.bottom}
        streamingDrawerOpen={controller.streamingDrawerOpen}
        watchOptions={controller.watchOptions}
        hasMultipleWatchOptions={controller.hasMultipleWatchOptions}
        primaryWatchService={controller.primaryWatchService}
        onToggleSaved={controller.handleToggleSaved}
        onPrimaryWatchPress={controller.handlePrimaryWatchPress}
        onOpenService={controller.handleOpenService}
      />

      <RatingInfoSheet
        visible={controller.ratingInfoVisible}
        title={title}
        voteCount={controller.voteCount}
        onClose={controller.handleCloseRatingInfo}
      />

      <PersonalRatingModal
        visible={controller.personalRatingVisible}
        titleName={title.title}
        initialRating={controller.personalRating}
        onSave={controller.handleSavePersonalRating}
        onClose={controller.handleClosePersonalRating}
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) => ({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  stickyTopOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingBottom: theme.spacing.sm,
  },
  stickyTopBg: {
    ...StyleSheet.absoluteFill,
    backgroundColor: theme.colors.bgPrimary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  stickyTopRow: {
    width: '100%' as const,
    maxWidth: 640,
    alignSelf: 'center' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  floatingTopIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: withAlpha(theme.colors.bgSurface, 0.92),
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.borderSubtle, 0.9),
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  stickyTopTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  stickyTopTitle: {
    color: theme.colors.textPrimary,
    fontSize: 17,
    lineHeight: 22,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    width: '100%' as const,
    maxWidth: 640,
    alignSelf: 'center' as const,
  },
  body: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.lg,
  },
  synopsisSection: {
    gap: theme.spacing.xs,
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    marginBottom: 2,
  },
  synopsisText: {
    color: theme.colors.textStrongBody,
    fontSize: 15,
    lineHeight: 23,
  },
  expandButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    alignSelf: 'flex-start' as const,
    gap: 3,
    paddingVertical: 4,
    marginTop: theme.spacing.xs,
  },
  expandButtonText: {
    color: theme.colors.accentLink,
    fontSize: 13,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  notFound: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 14,
  },
  notFoundTitle: {
    color: theme.colors.textPrimary,
    textAlign: 'center' as const,
  },
  link: {
    color: theme.colors.accentLink,
    fontSize: 14,
  },
  richErrorCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    padding: theme.spacing.md,
  },
  richErrorText: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: 12.5,
  },
  richRetryButton: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.savedActiveBg,
    borderWidth: 1,
    borderColor: theme.colors.savedActiveBorder,
  },
  richRetryText: {
    color: theme.colors.savedActiveText,
    fontSize: 12,
  },
});
