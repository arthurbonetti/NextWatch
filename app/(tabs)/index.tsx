import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/atoms/AppText';
import { FadeInBlock } from '@/components/atoms/FadeInBlock';
import { NextWatchLogo } from '@/components/atoms/NextWatchLogo';
import { ServiceLogo, ServiceLogoList } from '@/components/atoms/ServiceLogo';
import { SpinningIcon } from '@/components/atoms/SpinningIcon';
import { getArtworkUri, TitleArtwork } from '@/components/atoms/TitleArtwork';
import { UserAvatar } from '@/components/atoms/UserAvatar';
import { DrawFlowModal } from '@/components/organisms/DrawModal/DrawFlowModal';
import { TitleDetailsModal } from '@/components/organisms/TitleDetailsModal';
import {
  formatAverageRating,
  getTitleServices,
  MediaTitle,
} from '@/constants/catalog';
import { Theme, withAlpha } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';
import { useTitleQuickDetails } from '@/hooks/useCatalog';
import { useProfile } from '@/hooks/useProfile';
import { useRouletteFlow } from '@/hooks/useRouletteFlow';
import { formatCount, formatCurrency } from '@/utils/format';

export default function HomeScreen() {
  const { profile } = useProfile();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { drawGenre, drawKind, autoSpin, drawNonce } = useLocalSearchParams<{
    drawGenre?: string;
    drawKind?: string;
    autoSpin?: string;
    drawNonce?: string;
  }>();

  const roulette = useRouletteFlow({ drawGenre, drawKind, autoSpin, drawNonce });
  const {
    activeSubscriptions,
    activeServiceSet,
    availableTitles,
    eligibleTitles,
    featuredSample,
    catalogStatus,
    isFetchingCatalog,
    storageReady,
    refreshProgressIds,
    isTitleSaved,
    toggleSavedTitle,
  } = roulette;

  useFocusEffect(
    useCallback(() => {
      void refreshProgressIds();
    }, [refreshProgressIds]),
  );

  const [selectedTitle, setSelectedTitle] = useState<MediaTitle | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const isScrolled = event.nativeEvent.contentOffset.y > 6;
    setScrolled((prev) => (prev === isScrolled ? prev : isScrolled));
  }, []);

  const openDetails = (title: MediaTitle) => {
    setSelectedTitle(title);
    setDetailsVisible(true);
  };

  const { duration: selectedDuration, trailerUrl: selectedTrailerUrl } =
    useTitleQuickDetails(selectedTitle);
  const isSelectedSaved = selectedTitle ? isTitleSaved(selectedTitle.id) : false;
  const isInitialCatalogLoading =
    availableTitles.length === 0 &&
    (!storageReady ||
      (activeSubscriptions.length > 0 && (catalogStatus === 'loading' || isFetchingCatalog)));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={[styles.stickyTopbar, scrolled && styles.stickyTopbarScrolled]}>
        <View style={styles.topbar}>
          <View style={styles.brandRow}>
            <NextWatchLogo size={38} />
            <AppText tipo="subtitulo" peso="forte" style={styles.brandTitle}>NEXTWATCH</AppText>
          </View>
          <View style={styles.topbarActions}>
            <Pressable
              style={({ pressed }) => [styles.listsButton, pressed && styles.pressed]}
              onPress={() => router.push('/my-list')}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Abrir Minhas Listas">
              <MaterialIcons name="bookmark-border" size={28} color={colors.accentLink} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}
              onPress={() => router.push('/(tabs)/tab3')}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Abrir perfil">
              <UserAvatar
                size={44}
                name={profile?.name}
                avatarType={profile?.avatarType}
                avatarPreset={profile?.avatarPreset}
                avatarUrl={profile?.avatarUrl}
              />
            </Pressable>
          </View>
        </View>
        {scrolled && (
          <LinearGradient
            colors={[withAlpha(colors.bgPrimary, 0.9), withAlpha(colors.bgPrimary, 0)]}
            locations={[0, 1]}
            style={[styles.stickyEdgeScrim, { pointerEvents: 'none' }]}
          />
        )}
      </View>

      <ScrollView
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.container, { paddingBottom: Math.max(124, 108 + insets.bottom) }]}
        showsVerticalScrollIndicator={false}>

        <FadeInBlock delay={35}>
          <View style={[styles.statsRow, isFetchingCatalog && availableTitles.length > 0 && styles.statsRowSyncing]}>
            <Pressable
              style={({ pressed }) => [styles.statBlock, pressed && styles.pressed]}
              onPress={() => router.push('/subscriptions')}
              accessibilityRole="button">
              <AppText tipo="subtitulo" peso="forte" tabular style={styles.statNumber}>{formatCount(activeSubscriptions.length)}</AppText>
              <AppText tipo="legenda" peso="medio" style={styles.statLabel}>streamings ativos</AppText>
            </Pressable>
            <View style={styles.statDivider} />
            <Pressable
              style={({ pressed }) => [styles.statBlock, pressed && styles.pressed]}
              onPress={() => router.push('/(tabs)/tab2')}
              accessibilityRole="button">
              <AppText tipo="subtitulo" peso="forte" tabular style={styles.statNumber}>{formatCount(availableTitles.length)}</AppText>
              <AppText tipo="legenda" peso="medio" style={styles.statLabel}>no catálogo</AppText>
            </Pressable>
            <View style={styles.statDivider} />
            <View style={styles.statBlock}>
              <AppText tipo="subtitulo" peso="forte" tabular style={styles.statHighlight}>{formatCount(eligibleTitles.length)}</AppText>
              <AppText tipo="legenda" peso="medio" style={styles.statLabel}>nota 6,0+</AppText>
            </View>
          </View>
          {isFetchingCatalog && availableTitles.length > 0 && (
            <View style={styles.syncNotice}>
              <SpinningIcon name="autorenew" size={14} color={colors.accentLink} />
              <AppText tipo="legenda" peso="medio" style={styles.syncNoticeText}>
                Carregando mais títulos do catálogo…
              </AppText>
            </View>
          )}
        </FadeInBlock>

        <FadeInBlock delay={70}>
          <View style={styles.hero}>
            <View style={styles.heroGlow} />
            <View style={styles.heroCopy}>
              <View style={styles.pill}>
                <MaterialIcons name="casino" size={14} color={colors.accentPrimary} />
                <AppText tipo="legenda" peso="forte" style={styles.pillText}>ROLETA DE CURADORIA</AppText>
              </View>
              <AppText tipo="titulo" familia="editorial" peso="forte" style={styles.heroTitle}>Escolha o que assistir em segundos</AppText>
              <AppText tipo="legenda" style={styles.heroDescription}>
                {availableTitles.length > 0
                  ? `${formatCount(eligibleTitles.length)} obras com nota 6,0+ prontas para sortear nos seus streamings.`
                  : isInitialCatalogLoading
                    ? 'Carregando o catálogo dos seus streamings ativos…'
                    : 'Ative seus serviços em Assinaturas para liberar o sorteio personalizado.'}
              </AppText>
              <Pressable
                style={({ pressed }) => [
                  styles.drawButton,
                  (!storageReady || availableTitles.length === 0) && styles.drawButtonDisabled,
                  pressed && styles.pressed,
                ]}
                onPress={roulette.openDrawModal}
                disabled={!storageReady || availableTitles.length === 0}
                accessibilityRole="button">
                <AppText peso="forte" style={styles.drawButtonText}>{isInitialCatalogLoading ? 'Carregando catálogo…' : 'Sortear título'}</AppText>
                <MaterialIcons name="arrow-forward" size={18} color={colors.textOnAccent} />
              </Pressable>
            </View>
            {featuredSample && (
              <Pressable
                style={({ pressed }) => [styles.heroShowcase, pressed && styles.pressed]}
                onPress={() => openDetails(featuredSample)}
                accessibilityRole="button"
                accessibilityLabel={`Ver destaque ${featuredSample.title}`}>
                <View style={[styles.heroPosterFrame, { backgroundColor: featuredSample.color }]}>
                  <TitleArtwork
                    id={featuredSample.id}
                    variant="poster"
                    posterPath={featuredSample.tmdbPosterPath}
                    backdropPath={featuredSample.tmdbBackdropPath}
                    priority="high"
                    transition={0}
                  />
                  <LinearGradient
                    colors={['rgba(9, 15, 23, 0)', 'rgba(9, 15, 23, 0.34)', 'rgba(9, 15, 23, 0.78)']}
                    locations={[0, 0.5, 1]}
                    style={[styles.posterBottomGradient, { pointerEvents: 'none' }]}
                  />
                  <View style={styles.heroPosterBadge}>
                    <MaterialIcons name="star" size={11} color={colors.accentPrimary} />
                    <AppText tipo="legenda" peso="forte" tabular style={styles.heroPosterBadgeText}>
                      {formatAverageRating(featuredSample)}
                    </AppText>
                  </View>
                </View>
              </Pressable>
            )}
          </View>
        </FadeInBlock>

        <FadeInBlock delay={105}>
          <View style={styles.sectionHeader}>
            <View>
              <AppText tipo="subtitulo" peso="forte" style={styles.sectionTitle}>Seus streamings</AppText>
              <AppText tipo="legenda" style={styles.muted}>{activeSubscriptions.length} ativos no seu painel</AppText>
            </View>
            <Pressable
              style={({ pressed }) => [styles.sectionLinkBtn, pressed && styles.pressed]}
              onPress={() => router.push('/subscriptions')}
              accessibilityRole="button">
              <AppText tipo="legenda" peso="forte" style={styles.link}>Gerenciar</AppText>
              <MaterialIcons name="chevron-right" size={18} color={colors.accentLink} />
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.serviceList}>
            {activeSubscriptions.map((subscription) => (
              <Pressable
                style={({ pressed }) => [styles.serviceCard, pressed && styles.pressed]}
                key={subscription.id}
                onPress={() => router.push('/subscriptions')}
                accessibilityRole="button">
                <ServiceLogo name={subscription.provider} size={39} />
                <View style={styles.serviceCopy}>
                  <AppText peso="forte" style={styles.serviceName} numberOfLines={1}>{subscription.provider}</AppText>
                  <AppText tipo="legenda" tabular style={styles.servicePrice}>{formatCurrency(subscription.monthlyPrice)}/mês</AppText>
                </View>
              </Pressable>
            ))}
            {activeSubscriptions.length === 0 && (
              <Pressable
                style={({ pressed }) => [styles.emptyServiceCard, pressed && styles.pressed]}
                onPress={() => router.push('/subscriptions')}
                accessibilityRole="button">
                <MaterialIcons name="add-circle-outline" size={20} color={colors.accentLink} />
                <AppText tipo="legenda" peso="forte" style={styles.link}>Ativar primeiro streaming</AppText>
              </Pressable>
            )}
          </ScrollView>
        </FadeInBlock>

        <FadeInBlock delay={140}>
          <View style={styles.sectionHeader}>
            <View>
              <AppText tipo="subtitulo" peso="forte" style={styles.sectionTitle}>Para assistir hoje</AppText>
              <AppText tipo="legenda" style={styles.muted}>Curadoria disponível nas suas contas</AppText>
            </View>
            <Pressable
              style={({ pressed }) => [styles.sectionLinkBtn, pressed && styles.pressed]}
              onPress={() => router.push('/(tabs)/tab2')}
              accessibilityRole="button">
              <AppText tipo="legenda" peso="forte" style={styles.link}>Explorar catálogo</AppText>
              <MaterialIcons name="chevron-right" size={18} color={colors.accentLink} />
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.titleList}>
            {availableTitles.slice(0, 8).map((title, index) => {
              const hasArtwork = getArtworkUri(title.id, 'poster', {
                posterPath: title.tmdbPosterPath,
                backdropPath: title.tmdbBackdropPath,
              }) !== null;
              const titleActiveServices = getTitleServices(title).filter((service) =>
                activeServiceSet.has(service),
              );
              const badgeServices = titleActiveServices.length > 0 ? titleActiveServices : getTitleServices(title);
              return (
                <Pressable
                  style={({ pressed }) => [styles.titleCard, pressed && styles.pressed]}
                  key={title.id}
                  onPress={() => openDetails(title)}
                  accessibilityRole="button">
                  <View style={[styles.poster, { backgroundColor: title.color }]}>
                    <TitleArtwork
                      id={title.id}
                      variant="poster"
                      posterPath={title.tmdbPosterPath}
                      backdropPath={title.tmdbBackdropPath}
                      priority={index < 2 ? 'high' : 'normal'}
                      transition={index < 2 ? 0 : 200}
                    />
                    {!hasArtwork && <MaterialIcons name={title.icon} size={34} color={colors.textOnNavy} />}
                    {hasArtwork && (
                      <LinearGradient
                        colors={['rgba(9, 15, 23, 0)', 'rgba(9, 15, 23, 0.34)', 'rgba(9, 15, 23, 0.78)']}
                        locations={[0, 0.5, 1]}
                        style={[styles.posterBottomGradient, { pointerEvents: 'none' }]}
                      />
                    )}
                    {badgeServices.length > 0 && (
                      <View style={styles.posterServicesCorner}>
                        <ServiceLogoList
                          services={badgeServices}
                          size={20}
                          maxVisible={2}
                          overflowSize={20}
                          gap={3}
                          overflowGap={3}
                        />
                      </View>
                    )}
                    <View style={[styles.posterRating, hasArtwork && styles.posterRatingCorner]}>
                      <MaterialIcons name="star" size={12} color={colors.accentPrimary} />
                      <AppText tipo="legenda" peso="forte" tabular style={styles.posterRatingText}>{formatAverageRating(title)}</AppText>
                    </View>
                    {!hasArtwork && <AppText tipo="legenda" peso="forte" style={styles.posterLabel}>{title.title.toUpperCase()}</AppText>}
                  </View>
                  <AppText peso="forte" style={styles.titleName} numberOfLines={1}>{title.title}</AppText>
                  <AppText tipo="legenda" tabular style={styles.muted}>{title.kind} · {title.year}</AppText>
                </Pressable>
              );
            })}
            {availableTitles.length === 0 && (
              isInitialCatalogLoading ? (
                <View style={styles.emptyTitlesCard}>
                  <SpinningIcon name="autorenew" size={22} color={colors.accentLink} />
                  <AppText tipo="legenda" peso="forte" style={styles.link}>
                    Carregando títulos dos seus streamings…
                  </AppText>
                </View>
              ) : (
                <Pressable
                  style={({ pressed }) => [styles.emptyTitlesCard, pressed && styles.pressed]}
                  onPress={() => router.push('/subscriptions')}
                  accessibilityRole="button">
                  <MaterialIcons name="subscriptions" size={22} color={colors.accentLink} />
                  <AppText tipo="legenda" peso="forte" style={styles.link}>Adicione uma assinatura para ver os títulos</AppText>
                </Pressable>
              )
            )}
          </ScrollView>
        </FadeInBlock>
      </ScrollView>

      <DrawFlowModal
        visible={roulette.drawModalVisible}
        phase={roulette.phase}
        spinSession={roulette.spinSession}
        incompleteConfirmVisible={roulette.incompleteConfirmVisible}
        activeSubscriptions={roulette.activeSubscriptions}
        availableGenres={roulette.availableGenres}
        hasAnyAvailableTitle={roulette.availableTitles.length > 0}
        eligibleTitles={roulette.drawCandidates}
        watchedCount={roulette.watchedCount}
        filters={roulette.filters}
        enabledServices={roulette.enabledServices}
        winnerDuration={roulette.winnerDuration}
        winnerTrailerUrl={roulette.winnerTrailerUrl}
        isWinnerSaved={roulette.isWinnerSaved}
        onClose={roulette.handleClose}
        onDismissFromSheet={roulette.dismissFromSheet}
        onSelectKind={roulette.setKind}
        onToggleGenre={roulette.toggleGenre}
        onClearGenres={roulette.clearGenres}
        onToggleService={roulette.toggleService}
        onToggleHideWatched={roulette.setHideWatched}
        onResetFilters={roulette.resetFilters}
        onDrawPress={roulette.handleDrawPress}
        onConfirmIncompleteDraw={roulette.confirmIncompleteDraw}
        onCancelIncompleteDraw={roulette.cancelIncompleteDraw}
        onRouletteDone={roulette.handleRouletteDone}
        onDrawAnother={roulette.handleDrawAnother}
        onWatchWinner={roulette.handleWatchWinner}
        onMarkWinnerWatched={roulette.handleMarkWinnerWatched}
        onToggleWinnerSaved={roulette.handleToggleWinnerSaved}
      />

      <TitleDetailsModal
        title={selectedTitle}
        visible={detailsVisible}
        activeSubscriptions={activeSubscriptions}
        duration={selectedDuration}
        trailerUrl={selectedTrailerUrl}
        saved={isSelectedSaved}
        eyebrow="PARA ASSISTIR HOJE"
        onClose={() => setDetailsVisible(false)}
        onWatch={() => setDetailsVisible(false)}
        onToggleSave={() => {
          if (selectedTitle) toggleSavedTitle(selectedTitle);
        }}
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) => ({
  safeArea: { flex: 1, backgroundColor: theme.colors.bgPrimary },
  stickyTopbar: {
    position: 'relative' as const,
    zIndex: 10,
    backgroundColor: theme.colors.bgPrimary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.transparent,
  },
  stickyTopbarScrolled: {
    borderBottomColor: theme.colors.borderSubtle,
  },
  stickyEdgeScrim: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: -11,
    height: 10,
  },
  container: { width: '100%' as const, maxWidth: 640, alignSelf: 'center' as const, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 32 },
  topbar: { width: '100%' as const, maxWidth: 640, alignSelf: 'center' as const, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10 },
  brandRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 11 },
  brandTitle: { color: theme.colors.textPrimary, fontSize: 17, lineHeight: 22, letterSpacing: 2.1 },
  topbarActions: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  listsButton: { minWidth: 44, minHeight: 44, alignItems: 'center' as const, justifyContent: 'center' as const },
  avatarButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center' as const, justifyContent: 'center' as const },
  pressed: { opacity: 0.86, transform: [{ scale: 0.98 }] },
  statsRow: { flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: theme.colors.bgSurface, borderRadius: 18, borderWidth: 1, borderColor: theme.colors.borderSubtle, paddingVertical: 15, paddingHorizontal: 10, marginBottom: 22 },
  statsRowSyncing: { marginBottom: 10 },
  syncNotice: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 6, marginBottom: 18 },
  syncNoticeText: { color: theme.colors.textSecondary, fontSize: 12.5, lineHeight: 17 },
  statBlock: { flex: 1, alignItems: 'center' as const, paddingHorizontal: 6 },
  statNumber: { color: theme.colors.textPrimary, fontSize: 21, lineHeight: 25, letterSpacing: -0.3, marginBottom: 4 },
  statHighlight: { color: theme.colors.accentLink, fontSize: 21, lineHeight: 25, letterSpacing: -0.3, marginBottom: 4 },
  statLabel: { color: theme.colors.textSecondary, fontSize: 12.5, lineHeight: 17, textAlign: 'center' as const },
  statDivider: { width: 1, height: 34, backgroundColor: theme.colors.borderSubtle },
  muted: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 18 },
  hero: { minHeight: 206, overflow: 'hidden' as const, borderRadius: 22, backgroundColor: theme.colors.heroBg, borderWidth: 1, borderColor: theme.colors.heroBorder, flexDirection: 'row' as const, alignItems: 'center' as const, marginBottom: 28 },
  heroGlow: { position: 'absolute' as const, width: 210, height: 210, borderRadius: 105, right: -44, top: -36, backgroundColor: theme.colors.heroGlow },
  heroCopy: { flex: 1, paddingVertical: 18, paddingLeft: 18, paddingRight: 10, zIndex: 1 },
  pill: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, marginBottom: 10 },
  pillText: { color: theme.colors.accentPrimary, letterSpacing: 1.3 },
  heroTitle: { color: theme.colors.textOnNavy, fontSize: 19, lineHeight: 25, letterSpacing: -0.3, marginBottom: 7 },
  heroDescription: { color: theme.colors.textOnNavyMuted, maxWidth: 240, fontSize: 13, lineHeight: 19, marginBottom: 16 },
  drawButton: { alignSelf: 'flex-start' as const, minHeight: 44, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, borderRadius: 12, backgroundColor: theme.colors.accentPrimary, paddingHorizontal: 16, paddingVertical: 11 },
  drawButtonDisabled: { opacity: 0.55 },
  drawButtonText: { color: theme.colors.textOnAccent, fontSize: 14 },
  heroShowcase: { paddingRight: 16, paddingVertical: 18, zIndex: 1 },
  heroPosterFrame: { width: 90, height: 134, borderRadius: 14, borderWidth: 1.5, borderColor: theme.colors.cardBorderOverlay, overflow: 'hidden' as const, justifyContent: 'flex-end' as const, padding: 7 },
  heroPosterBadge: { alignSelf: 'flex-start' as const, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 3, backgroundColor: withAlpha(theme.colors.heroBg, 0.86), borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.14)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  heroPosterBadgeText: { color: theme.colors.textOnNavy, fontSize: 10 },
  posterBottomGradient: { position: 'absolute' as const, left: 0, right: 0, bottom: 0, height: '44%' as const },
  sectionHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, marginBottom: 13 },
  sectionTitle: { color: theme.colors.textPrimary, fontSize: 19, lineHeight: 24 },
  sectionLinkBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 2, paddingVertical: 6, paddingLeft: 8 },
  link: { color: theme.colors.accentLink, fontSize: 14, lineHeight: 19 },
  serviceList: { gap: 10, paddingBottom: 27 },
  serviceCard: { width: 178, height: 70, padding: 11, borderRadius: 16, backgroundColor: theme.colors.bgSurface, borderWidth: 1, borderColor: theme.colors.borderSubtle, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  emptyServiceCard: { minWidth: 200, height: 70, paddingHorizontal: 16, borderRadius: 16, backgroundColor: theme.colors.bgSurface, borderWidth: 1, borderColor: theme.colors.borderSubtle, borderStyle: 'dashed' as const, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 9 },
  serviceCopy: { flex: 1 },
  serviceName: { color: theme.colors.textPrimary, fontSize: 14, lineHeight: 19, marginBottom: 1 },
  servicePrice: { color: theme.colors.textSecondary, fontSize: 12.5, lineHeight: 17 },
  titleList: { gap: 13, paddingBottom: 28 },
  emptyTitlesCard: { minHeight: 118, width: 260, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 9, padding: 14, borderRadius: 16, backgroundColor: theme.colors.bgSurface, borderWidth: 1, borderColor: theme.colors.borderSubtle },
  titleCard: { width: 136 },
  poster: { height: 176, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.borderSubtle, justifyContent: 'center' as const, alignItems: 'center' as const, gap: 10, padding: 11, marginBottom: 9, overflow: 'hidden' as const },
  posterRating: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 2, backgroundColor: withAlpha(theme.colors.heroBg, 0.86), borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.14)', borderRadius: 9, paddingHorizontal: 6, paddingVertical: 3 },
  posterRatingCorner: { position: 'absolute' as const, bottom: 8, left: 8 },
  posterServicesCorner: { position: 'absolute' as const, top: 8, right: 8, backgroundColor: withAlpha(theme.colors.heroBg, 0.78), borderRadius: 9, padding: 3 },
  posterRatingText: { color: theme.colors.textOnNavy, fontSize: 10 },
  posterLabel: { color: theme.colors.textOnNavy, textAlign: 'center' as const, letterSpacing: 0.8 },
  titleName: { color: theme.colors.textPrimary, fontSize: 13, lineHeight: 18 },
});
