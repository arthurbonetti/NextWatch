import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  interpolateColor,
  SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/atoms/AppText';
import { BookmarkIcon } from '@/components/atoms/BookmarkIcon';
import { CollapsibleSection } from '@/components/atoms/CollapsibleSection';
import { ExpandableText } from '@/components/atoms/ExpandableText';
import { ServiceLogo, ServiceLogoList } from '@/components/atoms/ServiceLogo';
import { TitleArtwork } from '@/components/atoms/TitleArtwork';
import {
  formatAverageRating,
  getMetacriticScore,
  getTitleAverageRating,
  getTitleServices,
  MediaTitle,
} from '@/constants/catalog';
import { openStreamingService, Subscription } from '@/constants/subscriptions';
import { resolveTitleAccentColor, THEME, withAlpha } from '@/constants/theme';
import { formatCurrency } from '@/utils/format';
import { triggerSelectionHaptic, triggerSuccessHaptic } from '@/utils/haptics';

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

type ConfettiSpec = {
  dx: number;
  dy: number;
  rotate: number;
  size: number;
  delay: number;
  color: string;
};

function ConfettiParticle({
  spec,
  progress,
}: {
  spec: ConfettiSpec;
  progress: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const master = progress.get();
    if (master <= spec.delay || master >= 1) {
      return {
        opacity: 0,
        transform: [
          { translateX: 0 },
          { translateY: 0 },
          { rotate: '0deg' },
          { scale: 1 },
        ],
      };
    }
    const p = (master - spec.delay) / (1 - spec.delay);
    const opacity = p < 0.12 ? p / 0.12 : p < 0.72 ? 1 : (1 - p) / 0.28;
    return {
      opacity,
      transform: [
        { translateX: spec.dx * p },
        { translateY: spec.dy * p + 34 * p * p },
        { rotate: `${spec.rotate * p}deg` },
        { scale: 1 - p * 0.35 },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.confettiDot,
        {
          width: spec.size,
          height: spec.size * 0.65,
          backgroundColor: spec.color,
        },
        style,
      ]}
    />
  );
}

function GoldConfettiBurst({
  accentColor,
  progress,
}: {
  accentColor: string;
  progress: SharedValue<number>;
}) {
  const specs: ConfettiSpec[] = [
    { dx: -110, dy: -26, rotate: 220, size: 8, delay: 0.0, color: THEME.colors.gold },
    { dx: -82, dy: -46, rotate: -190, size: 7, delay: 0.04, color: THEME.colors.goldLight },
    { dx: -52, dy: -32, rotate: 160, size: 9, delay: 0.02, color: THEME.colors.accent },
    { dx: -24, dy: -52, rotate: -240, size: 7, delay: 0.06, color: THEME.colors.gold },
    { dx: 18, dy: -48, rotate: 200, size: 8, delay: 0.03, color: accentColor },
    { dx: 48, dy: -34, rotate: -170, size: 9, delay: 0.01, color: THEME.colors.goldLight },
    { dx: 78, dy: -44, rotate: 230, size: 7, delay: 0.05, color: THEME.colors.gold },
    { dx: 108, dy: -24, rotate: -210, size: 8, delay: 0.025, color: THEME.colors.accent },
    { dx: -95, dy: 12, rotate: 180, size: 6, delay: 0.07, color: THEME.colors.goldLight },
    { dx: -40, dy: 16, rotate: -150, size: 7, delay: 0.08, color: THEME.colors.gold },
    { dx: 38, dy: 14, rotate: 195, size: 7, delay: 0.065, color: THEME.colors.accent },
    { dx: 92, dy: 10, rotate: -185, size: 6, delay: 0.075, color: THEME.colors.goldLight },
  ];

  return (
    <View pointerEvents="none" style={styles.confettiAnchor}>
      {specs.map((spec, idx) => (
        <ConfettiParticle key={idx} spec={spec} progress={progress} />
      ))}
    </View>
  );
}

function formatProviderPossessive(providerName: string): string {
  return providerName === 'Netflix' ? `na sua ${providerName}` : `no seu ${providerName}`;
}

function buildDrawReason(title: MediaTitle, primaryProvider: string | null): string {
  const avg = getTitleAverageRating(title);
  const genre = title.genres.find((item) => item !== 'Outros');
  const providerSuffix = primaryProvider ? ` ${formatProviderPossessive(primaryProvider)}` : '';

  if (genre === 'Documentário' && title.kind === 'Filme') {
    const quality = avg >= 8.2 ? 'aclamado' : 'bem avaliado';
    return `Documentário ${quality}${providerSuffix}`;
  }

  const isFeminine = title.kind === 'Série';
  const quality = avg >= 8.2
    ? isFeminine
      ? 'aclamada'
      : 'aclamado'
    : isFeminine
      ? 'bem avaliada'
      : 'bem avaliado';

  if (genre) {
    return `${title.kind} de ${genre} ${quality}${providerSuffix}`;
  }
  return `${title.kind} ${quality}${providerSuffix}`;
}

/**
 * Card compartilhado para exibição de detalhes em modais ("Sorteado para você" e "Para assistir hoje"),
 * com backdrop em gradiente, pôster sobreposto, trailer, valor da assinatura e ações.
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
  const accentColor = resolveTitleAccentColor(title.color);
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
  const matchedSubscription = orderedUserSubscriptions[0] ?? null;
  const primaryProvider = watchOptions[0]?.provider ?? 'Netflix';

  const metacritic = getMetacriticScore(title);
  const averageRating = formatAverageRating(title);
  const ratingSourceName = title.ratingSource ?? 'IMDb';
  const reasonText = buildDrawReason(title, matchedSubscription?.provider ?? uniqueTitleServices[0] ?? null);

  const confettiProgress = useSharedValue(1);
  const posterScale = useSharedValue(reducedMotion ? 1 : 0.94);
  const ratingGlow = useSharedValue(0);
  const saveProgress = useSharedValue(saved ? 1 : 0);
  const diceRotation = useSharedValue(0);
  const drawerChevronRotation = useSharedValue(0);

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
      [THEME.colors.navy, THEME.colors.gold],
    ),
  }));

  const saveAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      saveProgress.get(),
      [0, 1],
      [THEME.colors.bgSubtle, THEME.colors.navy],
    ),
    borderColor: interpolateColor(
      saveProgress.get(),
      [0, 1],
      [THEME.colors.borderLight, THEME.colors.navy],
    ),
  }));

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
      {showConfetti && <GoldConfettiBurst accentColor={accentColor} progress={confettiProgress} />}

      <Pressable
        style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Fechar detalhes">
        <MaterialIcons name="close" size={21} color={THEME.colors.textOnNavy} />
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
                <MaterialIcons name={title.icon} size={48} color={THEME.colors.textOnNavy} />
              </View>
            }
          />
          <LinearGradient
            colors={[THEME.colors.cardFadeTransparent, THEME.colors.cardFadeMid, THEME.colors.bgCard]}
            locations={[0.15, 0.72, 1]}
            style={styles.backdropGradient}
          />
        </View>

        <View style={styles.bodyPadding}>
          <View style={styles.headerOverlapRow}>
            <Animated.View
              style={[
                styles.posterOverlap,
                { backgroundColor: title.color, borderColor: THEME.colors.bgCard },
                posterAnimatedStyle,
              ]}>
              <TitleArtwork
                id={title.id}
                variant="poster"
                posterPath={title.tmdbPosterPath}
                backdropPath={title.tmdbBackdropPath}
                fallback={<MaterialIcons name={title.icon} size={30} color={THEME.colors.textOnNavy} />}
              />
            </Animated.View>

            <View style={styles.headerCopy}>
              <AppText tipo="legenda" peso="forte" style={[styles.eyebrow, { color: accentColor }]}>
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
                  backgroundColor: withAlpha(accentColor, 0.1),
                  borderColor: withAlpha(accentColor, 0.28),
                },
              ]}>
              <View style={[styles.reasonDot, { backgroundColor: accentColor }]} />
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
                <MaterialIcons name="star" size={16} color={THEME.colors.gold} />
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
                <MaterialIcons name="play-circle-outline" size={17} color={THEME.colors.accentText} />
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
                  <MaterialIcons name="close" size={16} color={THEME.colors.textSubtle} />
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

          {orderedUserSubscriptions.length > 1 ? (
            <View style={styles.subscriptionBanner}>
              <ServiceLogoList
                services={orderedUserSubscriptions.map((sub) => sub.provider)}
                size={22}
                maxVisible={3}
                gap={4}
              />
              <AppText tipo="legenda" peso="semiforte" style={styles.subscriptionBannerText}>
                Incluído em {orderedUserSubscriptions.length} dos seus streamings
              </AppText>
            </View>
          ) : matchedSubscription ? (
            <View style={styles.subscriptionBanner}>
              <ServiceLogo name={matchedSubscription.provider} size={24} />
              <AppText tipo="legenda" peso="semiforte" tabular style={styles.subscriptionBannerText}>
                Incluído no seu {matchedSubscription.provider} · {formatCurrency(matchedSubscription.monthlyPrice)}/mês
              </AppText>
            </View>
          ) : null}

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
              fadeColor={THEME.colors.bgCard}
              textStyle={styles.synopsis}
              staticBottomSpacing={THEME.spacing.xxl}
              buttonStyle={styles.expandButton}
              buttonTextStyle={styles.expandButtonText}
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
                      color={THEME.colors.gold}
                      inactiveColor={THEME.colors.navy}
                      badgeBorderColor={THEME.colors.navy}
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
                      <MaterialIcons name="chevron-right" size={21} color={THEME.colors.navy} />
                    </Animated.View>
                  ) : (
                    <MaterialIcons name="open-in-new" size={18} color={THEME.colors.navy} />
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
                              <AppText tipo="legenda" tabular style={styles.streamingOptionMeta}>
                                Incluído · {formatCurrency(option.monthlyPrice)}/mês
                              </AppText>
                            )}
                          </View>
                          <MaterialIcons name="open-in-new" size={18} color={THEME.colors.accentText} />
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
                      color={markedWatched ? THEME.colors.successText : THEME.colors.textPrimary}
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
                      <MaterialIcons name="casino" size={18} color={THEME.colors.accentText} />
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

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxHeight: '100%',
    borderRadius: THEME.radius.card,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    backgroundColor: THEME.colors.bgCard,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  confettiAnchor: {
    position: 'absolute',
    top: 90,
    left: '50%',
    zIndex: 10,
  },
  confettiDot: {
    position: 'absolute',
    borderRadius: THEME.radius.xs,
  },
  backdropContainer: {
    height: 156,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdropFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdropGradient: {
    ...StyleSheet.absoluteFill,
  },
  closeButton: {
    position: 'absolute',
    top: THEME.spacing.md,
    right: THEME.spacing.md,
    zIndex: 5,
    width: THEME.touchTarget.min,
    height: THEME.touchTarget.min,
    borderRadius: THEME.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.closeOverlay,
  },
  scrollView: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: THEME.spacing.s20,
  },
  bodyPadding: {
    paddingHorizontal: THEME.spacing.s18,
  },
  headerOverlapRow: {
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: THEME.spacing.xl,
    marginTop: -(THEME.spacing.s32 + THEME.spacing.xxl),
    marginBottom: THEME.spacing.lg,
  },
  posterOverlap: {
    width: 84,
    height: 122,
    borderRadius: THEME.radius.md,
    borderWidth: 2.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    paddingTop: THEME.spacing.s32 + THEME.spacing.s20,
  },
  eyebrow: {
    letterSpacing: 1.3,
    marginBottom: THEME.spacing.xs,
  },
  title: {
    color: THEME.colors.textPrimary,
    fontSize: THEME.fontSizes.title,
    lineHeight: THEME.lineHeights.title,
    letterSpacing: -0.4,
    marginBottom: THEME.spacing.xs,
  },
  meta: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.fontSizes.bodySm,
    lineHeight: THEME.lineHeights.bodySm,
  },
  reasonPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.md,
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.md,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    marginBottom: THEME.spacing.lg,
  },
  reasonDot: {
    width: THEME.spacing.md,
    height: THEME.spacing.md,
    borderRadius: THEME.radius.full,
  },
  reasonText: {
    flex: 1,
    color: THEME.colors.textPrimary,
    fontSize: THEME.fontSizes.bodySm,
    lineHeight: THEME.lineHeights.bodySm,
  },
  ratingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: THEME.spacing.md,
    marginBottom: THEME.spacing.lg,
  },
  ratingBadge: {
    minHeight: THEME.touchTarget.min - THEME.spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: THEME.spacing.xs,
    paddingHorizontal: THEME.spacing.base,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.navy,
    borderWidth: 1.5,
  },
  ratingValue: {
    color: THEME.colors.textOnNavy,
    fontSize: THEME.fontSizes.body,
    lineHeight: THEME.lineHeights.bodySm,
  },
  ratingSource: {
    color: THEME.colors.gold,
    fontSize: THEME.fontSizes.xs,
    lineHeight: THEME.lineHeights.xs,
    letterSpacing: 0.4,
  },
  metacriticBadge: {
    minHeight: THEME.touchTarget.min - THEME.spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: THEME.spacing.xs,
    paddingHorizontal: THEME.spacing.md,
    borderRadius: THEME.radius.md,
  },
  mcGreen: { backgroundColor: THEME.colors.mcGreen },
  mcYellow: { backgroundColor: THEME.colors.mcYellow },
  mcRed: { backgroundColor: THEME.colors.mcRed },
  metacriticScore: {
    color: THEME.colors.textOnNavy,
    fontSize: THEME.fontSizes.body,
    lineHeight: THEME.lineHeights.bodySm,
  },
  metacriticLabel: {
    color: THEME.colors.textOnNavy,
    fontSize: THEME.fontSizes.xs,
    lineHeight: THEME.lineHeights.xs,
  },
  trailerButton: {
    minHeight: THEME.touchTarget.min,
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
    paddingHorizontal: THEME.spacing.lg,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.bgHighlight,
    borderWidth: 1,
    borderColor: THEME.colors.borderWarm,
  },
  trailerButtonText: {
    color: THEME.colors.accentText,
    fontSize: THEME.fontSizes.bodySm,
  },
  providerLogosRight: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingTooltipSpacer: {
    paddingBottom: THEME.spacing.lg,
  },
  ratingTooltip: {
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    backgroundColor: THEME.colors.bgSubtle,
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.base,
    gap: THEME.spacing.xs,
  },
  ratingTooltipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: THEME.spacing.xxs,
  },
  ratingTooltipTitle: {
    color: THEME.colors.textPrimary,
    fontSize: THEME.fontSizes.caption,
  },
  tooltipCloseButton: {
    minWidth: THEME.touchTarget.min,
    minHeight: THEME.touchTarget.min,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  ratingTooltipText: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.fontSizes.caption,
    lineHeight: THEME.lineHeights.caption,
  },
  allProvidersSpacer: {
    paddingBottom: THEME.spacing.lg,
  },
  allProvidersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: THEME.spacing.sm,
  },
  providerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.xs,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.bgSubtle,
  },
  providerPillText: {
    color: THEME.colors.textPrimary,
    fontSize: THEME.fontSizes.sm,
  },
  subscriptionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.base,
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.base,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.bgWarm,
    borderWidth: 1,
    borderColor: THEME.colors.borderWarm,
    marginBottom: THEME.spacing.lg,
  },
  subscriptionBannerText: {
    flex: 1,
    color: THEME.colors.textPrimary,
    fontSize: THEME.fontSizes.bodySm,
    lineHeight: THEME.lineHeights.bodySm,
  },
  genres: {
    color: THEME.colors.textWarm,
    fontSize: THEME.fontSizes.bodySm,
    lineHeight: THEME.lineHeights.bodySm,
    marginBottom: THEME.spacing.lg,
  },
  sectionTitle: {
    color: THEME.colors.textPrimary,
    fontSize: THEME.fontSizes.sub,
    lineHeight: THEME.lineHeights.sub,
    marginBottom: THEME.spacing.sm,
  },
  synopsis: {
    color: THEME.colors.textBody,
    fontSize: THEME.fontSizes.body,
    lineHeight: THEME.lineHeights.sub,
  },
  expandButton: {
    minHeight: THEME.touchTarget.min,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.xs,
    marginTop: THEME.spacing.xs,
    marginBottom: THEME.spacing.md,
  },
  expandButtonText: {
    color: THEME.colors.accentText,
    fontSize: THEME.fontSizes.bodySm,
  },
  actionsBlock: {
    gap: THEME.spacing.base,
    paddingTop: THEME.spacing.xs,
  },
  primaryActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.base,
  },
  saveButton: {
    width: THEME.touchTarget.button,
    height: THEME.touchTarget.button,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCta: {
    flex: 1,
    minHeight: THEME.touchTarget.button,
    borderRadius: THEME.radius.lg,
    backgroundColor: THEME.colors.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: THEME.spacing.md,
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.sm,
  },
  primaryCtaText: {
    color: THEME.colors.navy,
    fontSize: THEME.fontSizes.body,
    flexShrink: 1,
  },
  primaryCtaMultiText: {
    fontSize: THEME.fontSizes.bodyMd,
    lineHeight: THEME.lineHeights.bodySm,
    textAlign: 'center',
  },
  streamingDrawerSpacer: {
    paddingTop: THEME.spacing.base,
  },
  streamingDrawer: {
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.borderWarm,
    backgroundColor: THEME.colors.bgSubtle,
    padding: THEME.spacing.md,
    gap: THEME.spacing.md,
  },
  streamingDrawerLabel: {
    color: THEME.colors.textWarm,
    fontSize: THEME.fontSizes.caption,
    paddingHorizontal: THEME.spacing.xs,
  },
  streamingDrawerList: {
    gap: THEME.spacing.sm,
  },
  streamingOptionRow: {
    minHeight: THEME.touchTarget.min + THEME.spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.base,
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.md,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    backgroundColor: THEME.colors.bgCard,
  },
  streamingOptionCopy: {
    flex: 1,
  },
  streamingOptionName: {
    color: THEME.colors.textPrimary,
    fontSize: THEME.fontSizes.bodyMd,
    lineHeight: THEME.lineHeights.bodySm,
  },
  streamingOptionMeta: {
    color: THEME.colors.textMuted,
    fontSize: THEME.fontSizes.caption,
    lineHeight: THEME.lineHeights.caption,
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.base,
  },
  secondaryActionButton: {
    flex: 1,
    minHeight: THEME.touchTarget.min,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.borderMedium,
    backgroundColor: THEME.colors.bgSubtle,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: THEME.spacing.sm,
    paddingHorizontal: THEME.spacing.lg,
  },
  watchedConfirmedButton: {
    backgroundColor: THEME.colors.bgSuccess,
    borderColor: THEME.colors.borderSuccess,
  },
  secondaryActionText: {
    color: THEME.colors.textPrimary,
    fontSize: THEME.fontSizes.bodySm,
  },
  watchedConfirmedText: {
    color: THEME.colors.successText,
  },
  redrawButton: {
    minHeight: THEME.touchTarget.min,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.borderWarm,
    backgroundColor: THEME.colors.bgHighlight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: THEME.spacing.sm,
    paddingHorizontal: THEME.spacing.xl,
  },
  redrawText: {
    color: THEME.colors.accentText,
    fontSize: THEME.fontSizes.bodySm,
  },
});
