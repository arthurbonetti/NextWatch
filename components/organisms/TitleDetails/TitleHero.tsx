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
import { BackButton } from '@/components/atoms/BackButton';
import { TitleArtwork } from '@/components/atoms/TitleArtwork';
import { MediaTitle } from '@/constants/catalog';
import { THEME, withAlpha } from '@/constants/theme';

type TitleHeroProps = {
  title: MediaTitle;
  durationLabel: string;
  episodeDuration?: string | null;
  statusLabel?: string | null;
  certification?: string | null;
  trailerUrl?: string | null;
  accentColor: string;
  scrollY: SharedValue<number>;
  topInset: number;
  onShare: () => void;
  onWatchTrailer: () => void;
};

const CERTIFICATION_COLORS: Record<string, string> = {
  L: '#2e8b57',
  '10': '#2574a9',
  '12': '#d49b27',
  '14': '#e58c34',
  '16': '#c0392b',
  '18': '#182230',
};

function getCertificationColor(cert: string): string {
  return CERTIFICATION_COLORS[cert] ?? THEME.colors.navyElevated;
}

export function TitleHero({
  title,
  durationLabel,
  episodeDuration,
  statusLabel,
  certification,
  trailerUrl,
  accentColor,
  scrollY,
  topInset,
  onShare,
  onWatchTrailer,
}: TitleHeroProps) {
  const reducedMotion = useReducedMotion();
  const posterReveal = useSharedValue(reducedMotion ? 1 : 0);

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
  const metaParts = [String(title.year), title.kind, durationLabel];
  if (episodeDuration && episodeDuration !== durationLabel) {
    metaParts.push(episodeDuration);
  }

  return (
    <View style={styles.container}>
      <View style={[styles.backdropFrame, { height: heroBackdropHeight, backgroundColor: accentColor }]}>
        <Animated.View style={[styles.backdropArtwork, backdropParallaxStyle]}>
          <TitleArtwork
            id={title.id}
            variant="backdrop"
            posterPath={title.tmdbPosterPath}
            backdropPath={title.tmdbBackdropPath}
          />
        </Animated.View>

        <LinearGradient
          colors={['rgba(15, 22, 32, 0.56)', 'rgba(15, 22, 32, 0.14)', 'rgba(15, 22, 32, 0)']}
          locations={[0, 0.45, 1]}
          style={[styles.topScrim, { height: topInset + 72, pointerEvents: 'none' }]}
        />

        <LinearGradient
          colors={[
            THEME.colors.canvasFadeTransparent,
            withAlpha(THEME.colors.bgCanvas, 0.52),
            THEME.colors.bgCanvas,
          ]}
          locations={[0, 0.55, 1]}
          style={[styles.bottomGradient, { pointerEvents: 'none' }]}
        />

        <View style={[styles.topBar, { top: topInset + THEME.spacing.xs }]}>
          <BackButton style={styles.topIconButton} />
          <Pressable
            onPress={onShare}
            style={({ pressed }) => [styles.topIconButton, pressed && styles.pressed]}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Compartilhar ${title.title}`}>
            <MaterialIcons name="share" size={19} color={THEME.colors.textPrimary} />
          </Pressable>
        </View>

        {trailerUrl && (
          <View style={[styles.trailerCenterOverlay, { top: topInset + 22, pointerEvents: 'box-none' }]}>
            <Pressable
              onPress={onWatchTrailer}
              style={({ pressed }) => [
                styles.trailerButton,
                { borderColor: withAlpha(accentColor, 0.72) },
                pressed && styles.trailerPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Assistir trailer de ${title.title}`}>
              <View style={[styles.trailerPlayCircle, { backgroundColor: accentColor }]}>
                <MaterialIcons name="play-arrow" size={26} color={THEME.colors.textOnNavy} />
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
            { backgroundColor: accentColor, borderColor: THEME.colors.bgCard },
            posterEntranceStyle,
          ]}>
          <TitleArtwork
            id={title.id}
            variant="poster"
            posterPath={title.tmdbPosterPath}
            backdropPath={title.tmdbBackdropPath}
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
                      backgroundColor: withAlpha(accentColor, 0.14),
                      borderColor: withAlpha(accentColor, 0.36),
                    },
                  ]}>
                  <View style={[styles.statusDot, { backgroundColor: accentColor }]} />
                  <AppText tipo="legenda" peso="forte" style={styles.statusText}>
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

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  backdropFrame: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  backdropArtwork: {
    ...StyleSheet.absoluteFill,
  },
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  bottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '62%',
  },
  topBar: {
    position: 'absolute',
    left: THEME.spacing.md,
    right: THEME.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  topIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: withAlpha(THEME.colors.bgCard, 0.92),
    borderWidth: 1,
    borderColor: withAlpha(THEME.colors.borderLight, 0.9),
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.78,
  },
  trailerCenterOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trailerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
    backgroundColor: withAlpha(THEME.colors.navy, 0.78),
    borderWidth: 1.5,
    borderRadius: THEME.radius.pill,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  trailerLabel: {
    color: THEME.colors.textOnNavy,
    fontSize: 13,
    letterSpacing: 0.2,
  },
  heroOverlayContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: THEME.spacing.md,
    paddingHorizontal: THEME.spacing.lg,
    marginTop: -62,
  },
  posterFrame: {
    width: 86,
    height: 128,
    borderRadius: THEME.radius.md,
    borderWidth: 2,
    overflow: 'hidden',
    flexShrink: 0,
  },
  posterFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterFallbackText: {
    color: THEME.colors.textOnNavy,
    fontSize: 28,
  },
  headlineColumn: {
    flex: 1,
    gap: 5,
    paddingBottom: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  certificationBadge: {
    minWidth: 24,
    height: 22,
    borderRadius: 6,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  certificationText: {
    color: THEME.colors.textOnNavy,
    fontSize: 11,
    lineHeight: 14,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: THEME.radius.pill,
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
    color: THEME.colors.textPrimary,
    fontSize: 11,
    lineHeight: 14,
  },
  title: {
    color: THEME.colors.textPrimary,
    fontSize: 24,
    lineHeight: 28,
  },
  metaText: {
    color: THEME.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
});
