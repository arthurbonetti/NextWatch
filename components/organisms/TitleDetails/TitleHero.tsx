import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/atoms/AppText';
import { TitleArtwork } from '@/components/atoms/TitleArtwork';
import { MediaTitle } from '@/constants/catalog';
import { Theme, withAlpha } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';

type TitleHeroProps = {
  title: MediaTitle;
  durationLabel: string;
  episodeDuration?: string | null;
  statusLabel?: string | null;
  certification?: string | null;
  trailerUrl?: string | null;
  scrollY: SharedValue<number>;
  topInset: number;
  onWatchTrailer: () => void;
};

function isActiveSeriesStatus(label: string): boolean {
  return label === 'Em exibição';
}

const CERTIFICATION_COLORS: Record<string, string> = {
  L: '#2e8b57',
  '10': '#2574a9',
  '12': '#d49b27',
  '14': '#e58c34',
  '16': '#c0392b',
  '18': '#182230',
};

export function TitleHero({
  title,
  durationLabel,
  episodeDuration,
  statusLabel,
  certification,
  trailerUrl,
  scrollY,
  topInset,
  onWatchTrailer,
}: TitleHeroProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const reducedMotion = useReducedMotion();
  const posterReveal = useSharedValue(reducedMotion ? 1 : 0);

  const getCertificationColor = (cert: string): string => {
    return CERTIFICATION_COLORS[cert] ?? colors.heroBg;
  };

  useEffect(() => {
    if (reducedMotion) {
      posterReveal.set(1);
      return;
    }
    posterReveal.set(0);
    posterReveal.set(
      withTiming(1, {
        duration: 320,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [posterReveal, reducedMotion, title.id]);

  const backdropParallaxStyle = useAnimatedStyle(() => {
    if (reducedMotion) {
      return {};
    }
    const y = scrollY.get();
    const translateY = interpolate(y, [-120, 0, 260], [-34, 0, 64], Extrapolation.CLAMP);
    const scale = interpolate(y, [-120, 0, 260], [1.14, 1, 1.03], Extrapolation.CLAMP);
    return {
      transform: [{ translateY }, { scale }],
    };
  });

  const posterEntranceStyle = useAnimatedStyle(() => {
    const progress = posterReveal.get();
    return {
      opacity: progress,
      transform: [
        { translateY: (1 - progress) * 10 },
        { scale: 0.94 + progress * 0.06 },
      ],
    };
  });

  const heroBackdropHeight = 256 + topInset;
  const posterBgColor = title.color || colors.heroBg;
  const statusIsActive = statusLabel ? isActiveSeriesStatus(statusLabel) : false;
  const metaParts = [String(title.year), title.kind, durationLabel];
  if (episodeDuration && episodeDuration !== durationLabel) {
    metaParts.push(episodeDuration);
  }

  return (
    <View style={styles.container}>
      <View style={[styles.backdropFrame, { height: heroBackdropHeight, backgroundColor: posterBgColor }]}>
        <Animated.View style={[styles.backdropArtwork, backdropParallaxStyle]}>
          <TitleArtwork
            id={title.id}
            variant="backdrop"
            posterPath={title.tmdbPosterPath}
            backdropPath={title.tmdbBackdropPath}
            priority="high"
            transition={0}
          />
        </Animated.View>

        <LinearGradient
          colors={['rgba(15, 22, 32, 0.56)', 'rgba(15, 22, 32, 0.14)', 'rgba(15, 22, 32, 0)']}
          locations={[0, 0.45, 1]}
          style={[styles.topScrim, { height: topInset + 72, pointerEvents: 'none' }]}
        />

        <LinearGradient
          colors={[
            colors.canvasFadeTransparent,
            withAlpha(colors.bgPrimary, 0.58),
            colors.bgPrimary,
          ]}
          locations={[0, 0.55, 1]}
          style={[styles.bottomGradient, { pointerEvents: 'none' }]}
        />

        {trailerUrl && (
          <View style={[styles.trailerCenterOverlay, { top: topInset + 22, pointerEvents: 'box-none' }]}>
            <Pressable
              onPress={onWatchTrailer}
              style={({ pressed }) => [
                styles.trailerButton,
                { borderColor: withAlpha(colors.accentPrimary, 0.82) },
                pressed && styles.trailerPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Assistir trailer de ${title.title}`}>
              <View style={[styles.trailerPlayCircle, { backgroundColor: colors.accentPrimary }]}>
                <MaterialIcons
                  name="play-arrow"
                  size={26}
                  color={colors.textOnAccent}
                />
              </View>
              <AppText tipo="legenda" peso="forte" style={styles.trailerLabel}>
                Trailer
              </AppText>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.heroOverlayContent}>
        <Animated.View
          sharedTransitionTag={`title-poster-${title.id}`}
          style={[
            styles.posterFrame,
            { backgroundColor: posterBgColor, borderColor: colors.bgSurface },
            posterEntranceStyle,
          ]}>
          <TitleArtwork
            id={title.id}
            variant="poster"
            posterPath={title.tmdbPosterPath}
            backdropPath={title.tmdbBackdropPath}
            priority="high"
            transition={0}
            fallback={
              <View style={styles.posterFallback}>
                <AppText tipo="titulo" peso="forte" style={styles.posterFallbackText}>
                  {title.title.slice(0, 1).toUpperCase()}
                </AppText>
              </View>
            }
          />
        </Animated.View>

        <View style={styles.headlineColumn}>
          {(certification || statusLabel) && (
            <View style={styles.statusRow}>
              {certification && (
                <View
                  style={[
                    styles.certificationBadge,
                    { backgroundColor: getCertificationColor(certification) },
                  ]}>
                  <AppText tipo="legenda" peso="forte" style={styles.certificationText}>
                    {certification}
                  </AppText>
                </View>
              )}
              {statusLabel && (
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: statusIsActive ? colors.badgeSuccessBg : colors.badgeNeutralBg,
                      borderColor: statusIsActive ? colors.badgeSuccessBorder : colors.badgeNeutralBorder,
                    },
                  ]}>
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor: statusIsActive
                          ? colors.badgeSuccessText
                          : colors.badgeNeutralDot,
                      },
                    ]}
                  />
                  <AppText
                    tipo="legenda"
                    peso="forte"
                    style={[
                      styles.statusText,
                      {
                        color: statusIsActive
                          ? colors.badgeSuccessText
                          : colors.badgeNeutralText,
                      },
                    ]}>
                    {statusLabel}
                  </AppText>
                </View>
              )}
            </View>
          )}

          <AppText tipo="titulo" peso="forte" style={styles.title} numberOfLines={3}>
            {title.title}
          </AppText>

          <AppText tipo="legenda" peso="medio" style={styles.metaText}>
            {metaParts.join(' · ')}
          </AppText>
        </View>
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  container: {
    width: '100%' as const,
  },
  backdropFrame: {
    width: '100%' as const,
    overflow: 'hidden' as const,
    position: 'relative' as const,
  },
  backdropArtwork: {
    ...StyleSheet.absoluteFill,
  },
  topScrim: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
  },
  bottomGradient: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
    height: '62%' as const,
  },
  trailerCenterOverlay: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 44,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  trailerButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
    backgroundColor: withAlpha(theme.colors.heroBg, 0.78),
    borderWidth: 1.5,
    borderRadius: theme.radius.pill,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 14,
  },
  trailerPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.97 }],
  },
  trailerPlayCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  trailerLabel: {
    color: theme.colors.textOnNavy,
    fontSize: 13,
    letterSpacing: 0.2,
  },
  heroOverlayContent: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    marginTop: -62,
  },
  posterFrame: {
    width: 86,
    height: 128,
    borderRadius: theme.radius.md,
    borderWidth: 2,
    overflow: 'hidden' as const,
    flexShrink: 0,
  },
  posterFallback: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  posterFallbackText: {
    color: theme.colors.textOnNavy,
    fontSize: 28,
  },
  headlineColumn: {
    flex: 1,
    gap: 5,
    paddingBottom: 2,
  },
  statusRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flexWrap: 'wrap' as const,
    gap: 6,
  },
  certificationBadge: {
    minWidth: 24,
    height: 22,
    borderRadius: 6,
    paddingHorizontal: 6,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  certificationText: {
    color: theme.colors.textOnNavy,
    fontSize: 11,
    lineHeight: 14,
  },
  statusBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    lineHeight: 14,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    lineHeight: 28,
  },
  metaText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
});
