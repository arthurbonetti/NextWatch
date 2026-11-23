import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AppIcon } from '@/components/atoms/AppIcon';
import { AppText } from '@/components/atoms/AppText';
import { BookmarkIcon } from '@/components/atoms/BookmarkIcon';
import { CollapsibleSection } from '@/components/atoms/CollapsibleSection';
import { GoldConfettiBurst } from '@/components/atoms/ConfettiBurst';
import { ExpandableText } from '@/components/atoms/ExpandableText';
import { ServiceLogo, ServiceLogoList } from '@/components/atoms/ServiceLogo';
import { TitleArtwork } from '@/components/atoms/TitleArtwork';
import {
  formatAverageRating,
  getMetacriticScore,
  getTitleServices,
} from '@/constants/catalog';
import { Theme, THEME } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';
import type { MediaTitle } from '@/types/media';
import type { Subscription } from '@/types/subscription';
import { triggerSelectionHaptic, triggerSuccessHaptic } from '@/utils/haptics';
import { openStreamingService } from '@/utils/linking';
import { buildDrawReason } from '@/utils/roulette';

type TitleDetailCardProps = {
  title: MediaTitle;
  duration?: string;
  trailerUrl?: string | null;
  saved: boolean;
  eyebrow?: string;
  activeSubscriptions: Subscription[];
  enabledServices?: string[];
  showWhyReason?: boolean;
  showConfetti?: boolean;
  onClose: () => void;
  onWatch: () => void;
  onToggleSave: () => void;
  onMarkWatched?: () => void;
  onSaveChange?: (saved: boolean) => void;
  onDrawAnother?: () => void;
};

let hasShownSessionConfetti = false;

/**
 * Card compartilhado para exibição de detalhes em modais ("Sorteado para você" e "Para assistir hoje"),
 * com backdrop em gradiente, pôster sobreposto, trailer e ações principais.
 */
export function TitleDetailCard({
  title,
  duration,
  trailerUrl = null,
  saved,
  eyebrow = 'PARA ASSISTIR HOJE',
  activeSubscriptions,
  enabledServices,
  showWhyReason = false,
  showConfetti = false,
  onClose,
  onWatch,
  onToggleSave,
  onMarkWatched,
  onSaveChange,
  onDrawAnother,
}: TitleDetailCardProps) {
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(createStyles);
  const reducedMotion = useReducedMotion();

  const [prevTitleId, setPrevTitleId] = useState(title.id);
  const [expanded, setExpanded] = useState(false);
  const [showRatingInfo, setShowRatingInfo] = useState(false);
  const [showAllProviders, setShowAllProviders] = useState(false);
  const [streamingDrawerOpen, setStreamingDrawerOpen] = useState(false);
  const [markedWatched, setMarkedWatched] = useState(false);
  const [scrollLayoutHeight, setScrollLayoutHeight] = useState(0);
  const [scrollContentHeight, setScrollContentHeight] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  if (prevTitleId !== title.id) {
    setPrevTitleId(title.id);
    setExpanded(false);
    setShowRatingInfo(false);
    setShowAllProviders(false);
    setStreamingDrawerOpen(false);
    setMarkedWatched(false);
  }

  const displayDuration = duration || title.duration;
  const uniqueTitleServices = Array.from(new Set(getTitleServices(title)));
  const enabledSet = enabledServices ? new Set(enabledServices) : null;
  const matchedSubscriptions = activeSubscriptions.filter((sub) =>
    uniqueTitleServices.includes(sub.provider),
  );
  const orderedUserSubscriptions = enabledSet
    ? [
        ...matchedSubscriptions.filter((sub) => enabledSet.has(sub.provider)),
        ...matchedSubscriptions.filter((sub) => !enabledSet.has(sub.provider)),
      ]
    : matchedSubscriptions;

  const watchOptions: { provider: string; monthlyPrice: number | null }[] =
    orderedUserSubscriptions.length > 0
      ? orderedUserSubscriptions.map((sub) => ({
          provider: sub.provider,
          monthlyPrice: sub.monthlyPrice,
        }))
      : uniqueTitleServices.map((provider) => ({
          provider,
          monthlyPrice: null,
        }));

  const hasMultipleWatchOptions = watchOptions.length > 1;
  const primaryProvider = watchOptions[0]?.provider ?? 'Netflix';

  const metacritic = getMetacriticScore(title);
  const averageRating = formatAverageRating(title);
  const ratingSourceName = title.ratingSource ?? 'IMDb';
  const reasonText = buildDrawReason(title);

  const confettiProgress = useSharedValue(1);
  const posterScale = useSharedValue(reducedMotion ? 1 : 0.94);
  const ratingGlow = useSharedValue(0);
  const saveProgress = useSharedValue(saved ? 1 : 0);
  const diceRotation = useSharedValue(0);
  const drawerChevronRotation = useSharedValue(0);

  const ratingBaseBorder = colors.heroBorder;
  const ratingGlowBorder = colors.accentPrimary;
  const saveInactiveBg = colors.bgSurfaceAlt;
  const saveActiveBg = isDark ? colors.savedActiveBg : colors.navy;
  const saveInactiveBorder = colors.borderSubtle;
  const saveActiveBorder = isDark ? colors.savedActiveBorder : colors.navy;

  useEffect(() => {
    if (reducedMotion) {
      posterScale.set(1);
      ratingGlow.set(0);
      confettiProgress.set(1);
      return;
    }

    posterScale.set(0.94);
    posterScale.set(withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) }));

    ratingGlow.set(
      withSequence(
        withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 360, easing: Easing.inOut(Easing.ease) }),
      ),
    );

    if (showConfetti && !hasShownSessionConfetti) {
      hasShownSessionConfetti = true;
      confettiProgress.set(0);
      confettiProgress.set(withTiming(1, { duration: 960, easing: Easing.out(Easing.cubic) }));
    }
  }, [confettiProgress, posterScale, ratingGlow, reducedMotion, showConfetti, title.id]);

  useEffect(() => {
    saveProgress.set(
      reducedMotion
        ? saved
          ? 1
          : 0
        : withTiming(saved ? 1 : 0, { duration: 150 }),
    );
  }, [reducedMotion, saveProgress, saved]);

  useEffect(() => {
    drawerChevronRotation.set(
      reducedMotion
        ? streamingDrawerOpen
          ? 90
          : 0
        : withTiming(streamingDrawerOpen ? 90 : 0, {
            duration: 240,
            easing: Easing.bezier(0.22, 1, 0.36, 1),
          }),
    );
  }, [drawerChevronRotation, reducedMotion, streamingDrawerOpen]);

  const posterAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: posterScale.get() }],
  }));

  const ratingAnimatedStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      ratingGlow.get(),
      [0, 1],
      [ratingBaseBorder, ratingGlowBorder],
    ),
  }), [ratingBaseBorder, ratingGlowBorder]);

  const saveAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      saveProgress.get(),
      [0, 1],
      [saveInactiveBg, saveActiveBg],
    ),
    borderColor: interpolateColor(
      saveProgress.get(),
      [0, 1],
      [saveInactiveBorder, saveActiveBorder],
    ),
  }), [saveInactiveBg, saveActiveBg, saveInactiveBorder, saveActiveBorder]);

  const diceAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${diceRotation.get()}deg` }],
  }));

  const drawerChevronAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${drawerChevronRotation.get()}deg` }],
  }));

  const handleDrawerOpenEnd = useCallback(() => {
    scrollViewRef.current?.scrollToEnd({ animated: !reducedMotion });
  }, [reducedMotion]);

  const handleSavePress = () => {
    const nextSaved = !saved;
    triggerSelectionHaptic();
    onToggleSave();
    onSaveChange?.(nextSaved);
  };

  const handleOpenProvider = (providerName: string) => {
    triggerSuccessHaptic();
    void openStreamingService(providerName, title.title);
    onWatch();
  };

  const handlePrimaryWatchPress = () => {
    if (hasMultipleWatchOptions) {
      const nextOpen = !streamingDrawerOpen;
      triggerSelectionHaptic();
      setStreamingDrawerOpen(nextOpen);
      return;
    }
    handleOpenProvider(primaryProvider);
  };

  const handleMarkWatchedPress = () => {
    if (!onMarkWatched || markedWatched) return;
    triggerSuccessHaptic();
    setMarkedWatched(true);
    onMarkWatched();
  };

  const handleDrawAnotherPress = () => {
    if (!onDrawAnother) return;
    triggerSelectionHaptic();
    if (!reducedMotion) {
      diceRotation.set((prev) =>
        withTiming(prev + 360, {
          duration: 320,
          easing: Easing.out(Easing.cubic),
        }),
      );
    }
    onDrawAnother();
  };

  const handleOpenTrailer = () => {
    if (!trailerUrl) return;
    triggerSelectionHaptic();
    void Linking.openURL(trailerUrl).catch(() => {});
  };

  const handleScrollLayout = (event: LayoutChangeEvent) => {
    setScrollLayoutHeight(event.nativeEvent.layout.height);
  };

  const handleContentSizeChange = (_width: number, height: number) => {
    setScrollContentHeight(height);
  };

  const isOverflowing =
    scrollLayoutHeight > 0 && scrollContentHeight > scrollLayoutHeight + THEME.spacing.xs;
  const scrollEnabled = expanded || showRatingInfo || streamingDrawerOpen || isOverflowing;

  return (
    <View style={styles.card}>
      {showConfetti && <GoldConfettiBurst progress={confettiProgress} />}

      <Pressable
        style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Fechar detalhes">
        <AppIcon name="close" size={21} color={colors.textOnNavy} />
      </Pressable>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        scrollEnabled={scrollEnabled}
        onLayout={handleScrollLayout}
        onContentSizeChange={handleContentSizeChange}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.backdropContainer, { backgroundColor: title.color }]}>
          <TitleArtwork
            id={title.id}
            variant="backdrop"
            posterPath={title.tmdbPosterPath}
            backdropPath={title.tmdbBackdropPath}
            fallback={
              <View style={styles.backdropFallback}>
                <AppIcon name={title.icon} size={48} color={colors.textOnNavy} />
              </View>
            }
          />
          <LinearGradient
            colors={[colors.cardFadeTransparent, colors.cardFadeMid, colors.bgSurface]}
            locations={[0.15, 0.72, 1]}
            style={styles.backdropGradient}
          />
        </View>

        <View style={styles.bodyPadding}>
          <View style={styles.headerOverlapRow}>
            <Animated.View
              style={[
                styles.posterOverlap,
                { backgroundColor: title.color, borderColor: colors.bgSurface },
                posterAnimatedStyle,
              ]}>
              <TitleArtwork
                id={title.id}
                variant="poster"
                posterPath={title.tmdbPosterPath}
                backdropPath={title.tmdbBackdropPath}
                fallback={<AppIcon name={title.icon} size={30} color={colors.textOnNavy} />}
              />
            </Animated.View>

            <View style={styles.headerCopy}>
              <AppText tipo="legenda" peso="forte" style={[styles.eyebrow, { color: colors.accentLink }]}>
                {eyebrow}
              </AppText>
              <AppText tipo="titulo" familia="editorial" peso="forte" style={styles.title} numberOfLines={3}>
                {title.title}
              </AppText>
              <AppText tipo="legenda" tabular style={styles.meta}>
                {title.year || 'Ano não informado'} · {title.kind}
                {displayDuration ? ` · ${displayDuration}` : ''}
              </AppText>
            </View>
          </View>

          {showWhyReason && (
            <View
              style={[
                styles.reasonPill,
                {
                  backgroundColor: colors.badgeAccentBg,
                  borderColor: colors.badgeAccentBorder,
                },
              ]}>
              <View style={[styles.reasonDot, { backgroundColor: isDark ? colors.accentPrimary : colors.accentLink }]} />
              <AppText tipo="legenda" peso="semiforte" style={styles.reasonText}>
                {reasonText}
              </AppText>
            </View>
          )}

          <View style={styles.ratingRow}>
            <Pressable
              onPress={() => {
                triggerSelectionHaptic();
                setShowRatingInfo((prev) => !prev);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Nota do público ${title.imdbRating} de 10 no ${ratingSourceName}. Toque para entender.`}>
              <Animated.View style={[styles.ratingBadge, ratingAnimatedStyle]}>
                <MaterialIcons name="star" size={16} color={colors.accentPrimary} />
                <AppText peso="forte" tabular style={styles.ratingValue}>
                  {title.imdbRating}
                </AppText>
                <AppText peso="forte" style={styles.ratingSource}>
                  {ratingSourceName}
                </AppText>
              </Animated.View>
            </Pressable>

            {metacritic !== null && (
              <Pressable
                style={({ pressed }) => [
                  styles.metacriticBadge,
                  metacritic >= 61 ? styles.mcGreen : metacritic >= 40 ? styles.mcYellow : styles.mcRed,
                  pressed && styles.pressed,
                ]}
                onPress={() => {
                  triggerSelectionHaptic();
                  setShowRatingInfo((prev) => !prev);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Nota ${metacritic} de 100 no Metacritic`}>
                <AppText peso="forte" tabular style={styles.metacriticScore}>
                  {metacritic}
                </AppText>
                <AppText peso="forte" style={styles.metacriticLabel}>
                  MC
                </AppText>
              </Pressable>
            )}

            {trailerUrl && (
              <Pressable
                style={({ pressed }) => [styles.trailerButton, pressed && styles.pressed]}
                onPress={handleOpenTrailer}
                accessibilityRole="button"
                accessibilityLabel="Ver trailer no YouTube">
                <MaterialIcons name="play-circle-outline" size={17} color={colors.savedActiveText} />
                <AppText tipo="legenda" peso="forte" style={styles.trailerButtonText}>
                  Ver trailer
                </AppText>
              </Pressable>
            )}

            {orderedUserSubscriptions.length === 0 && (
              <View style={styles.providerLogosRight}>
                <ServiceLogoList
                  services={uniqueTitleServices}
                  size={30}
                  maxVisible={2}
                  overflowSize={28}
                  overflowExpanded={showAllProviders}
                  onPressOverflow={() => {
                    triggerSelectionHaptic();
                    setShowAllProviders((prev) => !prev);
                  }}
                />
              </View>
            )}
          </View>

          <CollapsibleSection
            key={`rating-${title.id}`}
            expanded={showRatingInfo}
            slideOffset={-6}
            openDuration={230}
            closeDuration={180}
            contentContainerStyle={styles.ratingTooltipSpacer}>
            <View style={styles.ratingTooltip}>
              <View style={styles.ratingTooltipHeader}>
                <AppText tipo="legenda" peso="forte" style={styles.ratingTooltipTitle}>
                  Fontes das avaliações
                </AppText>
                <Pressable
                  onPress={() => {
                    triggerSelectionHaptic();
                    setShowRatingInfo(false);
                  }}
                  style={styles.tooltipCloseButton}
                  accessibilityRole="button"
                  accessibilityLabel="Fechar explicação das notas">
                  <AppIcon name="close" size={16} color={colors.textSubtle} />
                </Pressable>
              </View>
              <AppText tipo="legenda" style={styles.ratingTooltipText}>
                {`• ${ratingSourceName}: nota do público de 0 a 10.`}
              </AppText>
              {metacritic !== null && (
                <AppText tipo="legenda" style={styles.ratingTooltipText}>
                  • MC (Metacritic): nota da crítica especializada de 0 a 100.
                </AppText>
              )}
              <AppText tipo="legenda" style={styles.ratingTooltipText}>
                {`• ★ ${averageRating}: média exibida nas listas e filtros.`}
              </AppText>
            </View>
          </CollapsibleSection>

          <CollapsibleSection
            key={`providers-${title.id}`}
            expanded={
              orderedUserSubscriptions.length === 0 && showAllProviders && uniqueTitleServices.length > 2
            }
            slideOffset={-6}
            openDuration={220}
            closeDuration={170}
            contentContainerStyle={styles.allProvidersSpacer}>
            <View style={styles.allProvidersRow}>
              {uniqueTitleServices.map((serviceName) => (
                <View key={serviceName} style={styles.providerPill}>
                  <ServiceLogo name={serviceName} size={18} />
                  <AppText tipo="legenda" peso="forte" style={styles.providerPillText}>
                    {serviceName}
                  </AppText>
                </View>
              ))}
            </View>
          </CollapsibleSection>

          <AppText peso="medio" style={styles.genres}>
            {title.genres.join(' · ')}
          </AppText>

          <View>
            <AppText tipo="subtitulo" peso="forte" style={styles.sectionTitle}>
              Sinopse
            </AppText>
            <ExpandableText
              key={title.id}
              text={title.synopsis}
              expanded={expanded}
              onToggle={() => {
                triggerSelectionHaptic();
                setExpanded((prev) => !prev);
              }}
              collapsedLines={4}
              fadeColor={colors.bgSurface}
              textStyle={styles.synopsis}
              staticBottomSpacing={THEME.spacing.xxl}
              buttonStyle={styles.expandButton}
              buttonTextStyle={styles.expandButtonText}
              chevronColor={colors.accentLink}
            />
          </View>

          <View style={styles.actionsBlock}>
            <View>
              <View style={styles.primaryActionsRow}>
                <Pressable
                  onPress={handleSavePress}
                  accessibilityRole="button"
                  accessibilityLabel={saved ? 'Remover da minha lista' : 'Salvar na minha lista'}
                  accessibilityState={{ selected: saved }}>
                  <Animated.View style={[styles.saveButton, saveAnimatedStyle]}>
                    <BookmarkIcon
                      saved={saved}
                      itemKey={title.id}
                      size={22}
                      color={colors.savedActiveIcon}
                      inactiveColor={isDark ? colors.textPrimary : colors.navy}
                      badgeColor={colors.accentPrimary}
                      badgeBorderColor={isDark ? colors.savedActiveBg : colors.navy}
                    />
                  </Animated.View>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.primaryCta, pressed && styles.pressed]}
                  onPress={handlePrimaryWatchPress}
                  accessibilityRole="button"
                  accessibilityState={hasMultipleWatchOptions ? { expanded: streamingDrawerOpen } : undefined}
                  accessibilityLabel={
                    hasMultipleWatchOptions
                      ? orderedUserSubscriptions.length > 1
                        ? 'Assistir em um dos seus streamings'
                        : 'Escolher onde assistir'
                      : `Assistir no ${primaryProvider}`
                  }>
                  {!hasMultipleWatchOptions && <ServiceLogo name={primaryProvider} size={22} />}
                  <AppText
                    peso="forte"
                    numberOfLines={2}
                    style={[
                      styles.primaryCtaText,
                      hasMultipleWatchOptions && styles.primaryCtaMultiText,
                    ]}>
                    {hasMultipleWatchOptions
                      ? orderedUserSubscriptions.length > 1
                        ? 'Assistir em um dos seus streamings'
                        : 'Escolha onde assistir'
                      : `Assistir no ${primaryProvider}`}
                  </AppText>
                  {hasMultipleWatchOptions ? (
                    <Animated.View style={drawerChevronAnimatedStyle}>
                      <MaterialIcons name="chevron-right" size={21} color={colors.textOnAccent} />
                    </Animated.View>
                  ) : (
                    <MaterialIcons name="open-in-new" size={18} color={colors.textOnAccent} />
                  )}
                </Pressable>
              </View>

              <CollapsibleSection
                key={`drawer-${title.id}`}
                expanded={hasMultipleWatchOptions && streamingDrawerOpen}
                slideOffset={-8}
                openDuration={260}
                closeDuration={200}
                contentContainerStyle={styles.streamingDrawerSpacer}
                onOpenEnd={handleDrawerOpenEnd}>
                <View style={styles.streamingDrawer}>
                  <AppText tipo="legenda" peso="forte" style={styles.streamingDrawerLabel}>
                    Escolha qual app abrir:
                  </AppText>
                  <View style={styles.streamingDrawerList}>
                    {watchOptions.map((option, index) => (
                      <Animated.View
                        key={option.provider}
                        entering={
                          reducedMotion
                            ? undefined
                            : FadeIn.delay(Math.min(index, 4) * 35).duration(180)
                        }>
                        <Pressable
                          style={({ pressed }) => [styles.streamingOptionRow, pressed && styles.pressed]}
                          onPress={() => handleOpenProvider(option.provider)}
                          accessibilityRole="button"
                          accessibilityLabel={`Abrir no ${option.provider}`}>
                          <ServiceLogo name={option.provider} size={28} />
                          <View style={styles.streamingOptionCopy}>
                            <AppText tipo="legenda" peso="forte" style={styles.streamingOptionName}>
                              Abrir no {option.provider}
                            </AppText>
                            {option.monthlyPrice !== null && (
                              <AppText tipo="legenda" style={styles.streamingOptionMeta}>
                                Incluído na sua assinatura
                              </AppText>
                            )}
                          </View>
                          <MaterialIcons name="open-in-new" size={18} color={colors.accentLink} />
                        </Pressable>
                      </Animated.View>
                    ))}
                  </View>
                </View>
              </CollapsibleSection>
            </View>

            {(onMarkWatched || onDrawAnother) && (
              <View style={styles.secondaryActionsRow}>
                {onMarkWatched && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.secondaryActionButton,
                      markedWatched && styles.watchedConfirmedButton,
                      pressed && !markedWatched && styles.pressed,
                    ]}
                    onPress={handleMarkWatchedPress}
                    disabled={markedWatched}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: markedWatched }}>
                    <MaterialIcons
                      name={markedWatched ? 'check-circle' : 'visibility'}
                      size={17}
                      color={markedWatched ? colors.successText : colors.textPrimary}
                    />
                    <AppText
                      tipo="legenda"
                      peso="forte"
                      numberOfLines={1}
                      style={[styles.secondaryActionText, markedWatched && styles.watchedConfirmedText]}>
                      {markedWatched ? 'Assistido' : 'Marcar como assistido'}
                    </AppText>
                  </Pressable>
                )}

                {onDrawAnother && (
                  <Pressable
                    style={({ pressed }) => [styles.redrawButton, pressed && styles.pressed]}
                    onPress={handleDrawAnotherPress}
                    accessibilityRole="button"
                    accessibilityLabel="Sortear outro título">
                    <Animated.View style={diceAnimatedStyle}>
                      <MaterialIcons name="casino" size={18} color={colors.savedActiveText} />
                    </Animated.View>
                    <AppText tipo="legenda" peso="forte" style={styles.redrawText}>
                      Sortear outro
                    </AppText>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  card: {
    width: '100%' as const,
    maxHeight: '100%' as const,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bgSurface,
    overflow: 'hidden' as const,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  backdropContainer: {
    height: 156,
    overflow: 'hidden' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  backdropFallback: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  backdropGradient: {
    ...StyleSheet.absoluteFill,
  },
  closeButton: {
    position: 'absolute' as const,
    top: theme.spacing.md,
    right: theme.spacing.md,
    zIndex: 5,
    width: theme.touchTarget.min,
    height: theme.touchTarget.min,
    borderRadius: theme.radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.colors.closeOverlay,
  },
  scrollView: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: theme.spacing.s20,
  },
  bodyPadding: {
    paddingHorizontal: theme.spacing.s18,
  },
  headerOverlapRow: {
    zIndex: 2,
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    gap: theme.spacing.xl,
    marginTop: -(theme.spacing.s32 + theme.spacing.xxl),
    marginBottom: theme.spacing.lg,
  },
  posterOverlap: {
    width: 84,
    height: 122,
    borderRadius: theme.radius.md,
    borderWidth: 2.5,
    overflow: 'hidden' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  headerCopy: {
    flex: 1,
    paddingTop: theme.spacing.s32 + theme.spacing.s20,
  },
  eyebrow: {
    letterSpacing: 1.3,
    marginBottom: theme.spacing.xs,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSizes.title,
    lineHeight: theme.lineHeights.title,
    letterSpacing: -0.4,
    marginBottom: theme.spacing.xs,
  },
  meta: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSizes.bodySm,
    lineHeight: theme.lineHeights.bodySm,
  },
  reasonPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    marginBottom: theme.spacing.lg,
  },
  reasonDot: {
    width: theme.spacing.md,
    height: theme.spacing.md,
    borderRadius: theme.radius.full,
  },
  reasonText: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.fontSizes.bodySm,
    lineHeight: theme.lineHeights.bodySm,
  },
  ratingRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  ratingBadge: {
    minHeight: theme.touchTarget.min - theme.spacing.xs,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.base,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.heroBg,
    borderWidth: 1.5,
  },
  ratingValue: {
    color: theme.colors.textOnNavy,
    fontSize: theme.fontSizes.body,
    lineHeight: theme.lineHeights.bodySm,
  },
  ratingSource: {
    color: theme.colors.accentPrimary,
    fontSize: theme.fontSizes.xs,
    lineHeight: theme.lineHeights.xs,
    letterSpacing: 0.4,
  },
  metacriticBadge: {
    minHeight: theme.touchTarget.min - theme.spacing.xs,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
  },
  mcGreen: { backgroundColor: theme.colors.mcGreen },
  mcYellow: { backgroundColor: theme.colors.mcYellow },
  mcRed: { backgroundColor: theme.colors.mcRed },
  metacriticScore: {
    color: theme.colors.textOnNavy,
    fontSize: theme.fontSizes.body,
    lineHeight: theme.lineHeights.bodySm,
  },
  metacriticLabel: {
    color: theme.colors.textOnNavy,
    fontSize: theme.fontSizes.xs,
    lineHeight: theme.lineHeights.xs,
  },
  trailerButton: {
    minHeight: theme.touchTarget.min,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.savedActiveBg,
    borderWidth: 1,
    borderColor: theme.colors.savedActiveBorder,
  },
  trailerButtonText: {
    color: theme.colors.savedActiveText,
    fontSize: theme.fontSizes.bodySm,
  },
  providerLogosRight: {
    marginLeft: 'auto' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  ratingTooltipSpacer: {
    paddingBottom: theme.spacing.lg,
  },
  ratingTooltip: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bgSurfaceAlt,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.base,
    gap: theme.spacing.xs,
  },
  ratingTooltipHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: theme.spacing.xxs,
  },
  ratingTooltipTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSizes.caption,
  },
  tooltipCloseButton: {
    minWidth: theme.touchTarget.min,
    minHeight: theme.touchTarget.min,
    alignItems: 'flex-end' as const,
    justifyContent: 'center' as const,
  },
  ratingTooltipText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSizes.caption,
    lineHeight: theme.lineHeights.caption,
  },
  allProvidersSpacer: {
    paddingBottom: theme.spacing.lg,
  },
  allProvidersRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
  },
  providerPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.bgSurfaceAlt,
  },
  providerPillText: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSizes.sm,
  },
  genres: {
    color: theme.colors.textWarm,
    fontSize: theme.fontSizes.bodySm,
    lineHeight: theme.lineHeights.bodySm,
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSizes.sub,
    lineHeight: theme.lineHeights.sub,
    marginBottom: theme.spacing.sm,
  },
  synopsis: {
    color: theme.colors.textStrongBody,
    fontSize: theme.fontSizes.body,
    lineHeight: theme.lineHeights.sub,
  },
  expandButton: {
    minHeight: theme.touchTarget.min,
    alignSelf: 'flex-start' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  expandButtonText: {
    color: theme.colors.accentLink,
    fontSize: theme.fontSizes.bodySm,
  },
  actionsBlock: {
    gap: theme.spacing.base,
    paddingTop: theme.spacing.xs,
  },
  primaryActionsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.base,
  },
  saveButton: {
    width: theme.touchTarget.button,
    height: theme.touchTarget.button,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  primaryCta: {
    flex: 1,
    minHeight: theme.touchTarget.button,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.accentPrimary,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  primaryCtaText: {
    color: theme.colors.textOnAccent,
    fontSize: theme.fontSizes.body,
    flexShrink: 1,
  },
  primaryCtaMultiText: {
    fontSize: theme.fontSizes.bodyMd,
    lineHeight: theme.lineHeights.bodySm,
    textAlign: 'center' as const,
  },
  streamingDrawerSpacer: {
    paddingTop: theme.spacing.base,
  },
  streamingDrawer: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bgSurfaceAlt,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  streamingDrawerLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSizes.caption,
    paddingHorizontal: theme.spacing.xs,
  },
  streamingDrawerList: {
    gap: theme.spacing.sm,
  },
  streamingOptionRow: {
    minHeight: theme.touchTarget.min + theme.spacing.xs,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.base,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bgSurface,
  },
  streamingOptionCopy: {
    flex: 1,
  },
  streamingOptionName: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSizes.bodyMd,
    lineHeight: theme.lineHeights.bodySm,
  },
  streamingOptionMeta: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.caption,
    lineHeight: theme.lineHeights.caption,
  },
  secondaryActionsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.base,
  },
  secondaryActionButton: {
    flex: 1,
    minHeight: theme.touchTarget.min,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bgSurfaceAlt,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  watchedConfirmedButton: {
    backgroundColor: theme.colors.bgSuccess,
    borderColor: theme.colors.borderSuccess,
  },
  secondaryActionText: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSizes.bodySm,
  },
  watchedConfirmedText: {
    color: theme.colors.successText,
  },
  redrawButton: {
    minHeight: theme.touchTarget.min,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.savedActiveBorder,
    backgroundColor: theme.colors.savedActiveBg,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
  },
  redrawText: {
    color: theme.colors.savedActiveText,
    fontSize: theme.fontSizes.bodySm,
  },
});
