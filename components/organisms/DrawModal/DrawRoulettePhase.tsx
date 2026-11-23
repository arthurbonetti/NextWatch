import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '@/components/atoms/AppText';
import { getArtworkUri, TitleArtwork } from '@/components/atoms/TitleArtwork';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';
import type { MediaTitle } from '@/types/media';
import { formatCount } from '@/utils/format';
import { triggerLightImpactHaptic, triggerSuccessHaptic } from '@/utils/haptics';
import { shuffleArray } from '@/utils/shuffle';

type DrawRoulettePhaseProps = {
  winner: MediaTitle;
  candidates: MediaTitle[];
  eligibleCount: number;
  spinKey: number;
  onFinish: () => void;
  onSkip: () => void;
};

const POSTER_WIDTH = 112;
const POSTER_HEIGHT = 164;
const POSTER_GAP = 14;
const STEP = POSTER_WIDTH + POSTER_GAP;
const REEL_LENGTH = 20;
const TARGET_INDEX = 16;
const SPIN_DURATION_MS = 1650;
const DRAMATIC_PAUSE_MS = 150;
const HAPTIC_THROTTLE_MS = 70;

type ReelPosterItemProps = {
  title: MediaTitle;
  index: number;
  scrollX: SharedValue<number>;
};

const ReelPosterItem = memo(function ReelPosterItem({ title, index, scrollX }: ReelPosterItemProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const animatedStyle = useAnimatedStyle(() => {
    const distance = Math.abs(scrollX.get() / STEP - index);
    const scale = interpolate(distance, [0, 1, 2.2], [1.02, 0.91, 0.84], Extrapolation.CLAMP);
    const opacity = interpolate(distance, [0, 1, 2.5], [1, 0.72, 0.4], Extrapolation.CLAMP);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  return (
    <Animated.View style={[styles.posterCard, { backgroundColor: title.color }, animatedStyle]}>
      <TitleArtwork
        id={title.id}
        variant="poster"
        posterPath={title.tmdbPosterPath}
        backdropPath={title.tmdbBackdropPath}
        fallback={
          <View style={styles.posterFallback}>
            <MaterialIcons name={title.icon} size={32} color={colors.textOnNavy} />
            <AppText tipo="legenda" peso="forte" numberOfLines={2} style={styles.posterFallbackText}>
              {title.title}
            </AppText>
          </View>
        }
      />
    </Animated.View>
  );
});

function buildReelItems(
  winner: MediaTitle,
  candidates: readonly MediaTitle[],
  spinKey: number,
): MediaTitle[] {
  const decoysPool = candidates.filter((item) => item.id !== winner.id);
  const basePool = decoysPool.length > 0 ? decoysPool : [winner];
  const shuffledPool = shuffleArray(basePool);
  const rotationOffset = spinKey % shuffledPool.length;

  const items: MediaTitle[] = [];
  for (let i = 0; i < REEL_LENGTH; i++) {
    if (i === TARGET_INDEX) {
      items.push(winner);
    } else {
      items.push(shuffledPool[(i + rotationOffset) % shuffledPool.length]!);
    }
  }
  return items;
}

/**
 * Tela 2 do fluxo de sorteio: roleta horizontal de pôsteres (slot machine)
 * rodando a 60fps na UI thread, com desaceleração cúbica, pausa dramática e haptics.
 */
export function DrawRoulettePhase({
  winner,
  candidates,
  eligibleCount,
  spinKey,
  onFinish,
  onSkip,
}: DrawRoulettePhaseProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const reducedMotion = useReducedMotion();
  const [viewportWidth, setViewportWidth] = useState(320);
  const scrollX = useSharedValue(0);
  const lockHighlight = useSharedValue(0);
  const lastHapticAtRef = useRef(0);
  const finishedRef = useRef(false);

  const goldColor = colors.accentPrimary;
  const goldLightColor = colors.goldLight;

  const reelItems = useMemo(
    () => buildReelItems(winner, candidates, spinKey),
    [candidates, spinKey, winner],
  );

  const backgroundUri = getArtworkUri(winner.id, 'poster', {
    posterPath: winner.tmdbPosterPath,
    backdropPath: winner.tmdbBackdropPath,
  });

  const handleViewportLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    if (nextWidth > 0 && nextWidth !== viewportWidth) {
      setViewportWidth(nextWidth);
    }
  };

  const handleTickHaptic = useCallback(() => {
    if (finishedRef.current) return;
    const now = Date.now();
    if (now - lastHapticAtRef.current < HAPTIC_THROTTLE_MS) return;
    lastHapticAtRef.current = now;
    triggerLightImpactHaptic();
  }, []);

  const handleWheelStopped = useCallback(() => {
    if (finishedRef.current) return;
    triggerSuccessHaptic();
  }, []);

  const handleRevealAfterPause = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish();
  }, [onFinish]);

  useAnimatedReaction(
    () => Math.round(scrollX.get() / STEP),
    (currentIndex, previousIndex) => {
      if (previousIndex !== null && currentIndex !== previousIndex && currentIndex > 0) {
        scheduleOnRN(handleTickHaptic);
      }
    },
    [handleTickHaptic],
  );

  useEffect(() => {
    finishedRef.current = false;

    if (reducedMotion) {
      finishedRef.current = true;
      onFinish();
      return;
    }

    scrollX.set(0);
    lockHighlight.set(0);
    lastHapticAtRef.current = 0;

    const targetX = TARGET_INDEX * STEP;
    scrollX.set(
      withTiming(
        targetX,
        {
          duration: SPIN_DURATION_MS,
          easing: Easing.out(Easing.cubic),
        },
        (finished) => {
          if (!finished) return;
          scheduleOnRN(handleWheelStopped);
          lockHighlight.set(
            withSequence(
              withTiming(1, { duration: 110, easing: Easing.out(Easing.cubic) }),
              withDelay(
                DRAMATIC_PAUSE_MS,
                withTiming(1, { duration: 1 }, (pauseFinished) => {
                  if (pauseFinished) {
                    scheduleOnRN(handleRevealAfterPause);
                  }
                }),
              ),
            ),
          );
        },
      ),
    );

    return () => {
      cancelAnimation(scrollX);
      cancelAnimation(lockHighlight);
    };
  }, [
    handleRevealAfterPause,
    handleWheelStopped,
    lockHighlight,
    onFinish,
    reducedMotion,
    scrollX,
    spinKey,
    winner.id,
  ]);

  const handleSkipPress = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    cancelAnimation(scrollX);
    cancelAnimation(lockHighlight);
    onSkip();
  };

  const centerOffset = (viewportWidth - POSTER_WIDTH) / 2;

  const stripAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: centerOffset - scrollX.get() }],
  }), [centerOffset]);

  const frameAnimatedStyle = useAnimatedStyle(() => {
    const highlight = lockHighlight.get();
    return {
      transform: [{ scale: 1 + highlight * 0.02 }],
      borderColor: highlight > 0.2 ? goldColor : goldLightColor,
    };
  }, [goldColor, goldLightColor]);

  return (
    <Pressable
      style={styles.root}
      onPress={handleSkipPress}
      accessibilityRole="button"
      accessibilityLabel="Sorteando título. Toque na tela para pular para o resultado.">
      <View style={[styles.backgroundLayer, { backgroundColor: winner.color }]}>
        {backgroundUri && (
          <Image
            source={{ uri: backgroundUri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            accessible={false}
          />
        )}
        <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.backgroundScrim]} />
      </View>

      <View style={styles.content}>
        <View style={styles.topText}>
          <View style={styles.eyebrowPill}>
            <MaterialIcons name="casino" size={14} color={colors.accentPrimary} />
            <AppText tipo="legenda" peso="forte" style={styles.eyebrow}>
              A SORTE ESTÁ LANÇADA
            </AppText>
          </View>
          <AppText tipo="subtitulo" familia="editorial" peso="forte" style={styles.headline}>
            Girando a roleta…
          </AppText>
        </View>

        <View style={styles.reelViewport} onLayout={handleViewportLayout}>
          <View style={[styles.pointerTop, { pointerEvents: 'none' }]}>
            <MaterialIcons name="arrow-drop-down" size={26} color={colors.accentPrimary} />
          </View>

          <Animated.View style={[styles.strip, stripAnimatedStyle]}>
            {reelItems.map((item, index) => (
              <ReelPosterItem key={`${item.id}-${index}`} title={item} index={index} scrollX={scrollX} />
            ))}
          </Animated.View>

          <Animated.View style={[styles.centerFrame, frameAnimatedStyle, { pointerEvents: 'none' }]} />

          <View style={[styles.pointerBottom, { pointerEvents: 'none' }]}>
            <MaterialIcons name="arrow-drop-up" size={26} color={colors.accentPrimary} />
          </View>
        </View>

        <View style={styles.bottomCopy}>
          <AppText tipo="legenda" peso="semiforte" tabular style={styles.supportText}>
            Escolhendo entre {formatCount(eligibleCount)} {eligibleCount === 1 ? 'título' : 'títulos'}…
          </AppText>
          <View style={styles.skipRow}>
            <MaterialIcons name="touch-app" size={14} color={colors.textOnNavyMuted} />
            <AppText tipo="legenda" style={styles.skipHint}>
              Toque para revelar agora
            </AppText>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const createStyles = (theme: Theme) => ({
  root: {
    borderRadius: theme.radius.card,
    overflow: 'hidden' as const,
    backgroundColor: theme.colors.heroBg,
    borderWidth: 1,
    borderColor: theme.colors.heroBorder,
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFill,
  },
  backgroundScrim: {
    backgroundColor: theme.colors.backdropDark,
    opacity: 0.72,
  },
  content: {
    paddingVertical: theme.spacing.s28,
    alignItems: 'center' as const,
    gap: theme.spacing.s22,
  },
  topText: {
    alignItems: 'center' as const,
    paddingHorizontal: theme.spacing.s20,
    gap: theme.spacing.sm,
  },
  eyebrowPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.cardOverlaySubtle,
    borderWidth: 1,
    borderColor: theme.colors.cardBorderOverlay,
  },
  eyebrow: {
    color: theme.colors.accentPrimary,
    letterSpacing: 1.4,
  },
  headline: {
    color: theme.colors.textOnNavy,
    fontSize: theme.fontSizes.title,
    lineHeight: theme.lineHeights.title,
    textAlign: 'center' as const,
  },
  reelViewport: {
    width: '100%' as const,
    height: POSTER_HEIGHT + theme.spacing.s32,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
  },
  strip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: POSTER_GAP,
  },
  posterCard: {
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    borderRadius: theme.radius.lg,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: theme.colors.cardBorderOverlay,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  posterFallback: {
    padding: theme.spacing.base,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: theme.spacing.sm,
  },
  posterFallbackText: {
    color: theme.colors.textOnNavy,
    textAlign: 'center' as const,
    fontSize: theme.fontSizes.sm,
    lineHeight: theme.lineHeights.sm,
  },
  centerFrame: {
    position: 'absolute' as const,
    alignSelf: 'center' as const,
    width: POSTER_WIDTH + theme.spacing.md,
    height: POSTER_HEIGHT + theme.spacing.md,
    borderRadius: theme.radius.xl,
    borderWidth: 2.5,
  },
  pointerTop: {
    position: 'absolute' as const,
    top: -theme.spacing.xs,
    alignSelf: 'center' as const,
    zIndex: 3,
  },
  pointerBottom: {
    position: 'absolute' as const,
    bottom: -theme.spacing.xs,
    alignSelf: 'center' as const,
    zIndex: 3,
  },
  bottomCopy: {
    alignItems: 'center' as const,
    paddingHorizontal: theme.spacing.s20,
    gap: theme.spacing.xs,
  },
  supportText: {
    color: theme.colors.textOnNavy,
    fontSize: theme.fontSizes.bodyMd,
    lineHeight: theme.lineHeights.bodyMd,
  },
  skipRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xxs,
  },
  skipHint: {
    color: theme.colors.textOnNavyMuted,
    fontSize: theme.fontSizes.caption,
  },
});
