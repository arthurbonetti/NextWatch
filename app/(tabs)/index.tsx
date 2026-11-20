import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/atoms/AppText';
import { FadeInBlock } from '@/components/atoms/FadeInBlock';
import { NextWatchLogo } from '@/components/atoms/NextWatchLogo';
import { ServiceLogo, ServiceLogoList } from '@/components/atoms/ServiceLogo';
import { getArtworkUri, TitleArtwork } from '@/components/atoms/TitleArtwork';
import { DrawFlowModal } from '@/components/organisms/DrawModal/DrawFlowModal';
import { TitleDetailsModal } from '@/components/organisms/TitleDetailsModal';
import {
  formatAverageRating,
  getTitleServices,
  MediaTitle,
} from '@/constants/catalog';
import { useAuth } from '@/contexts/AuthContext';
import { useRouletteFlow } from '@/hooks/useRouletteFlow';
import {
  fetchTitleDuration,
  fetchTitleTrailerUrl,
  getCachedTitleDuration,
  getCachedTitleTrailerUrl,
} from '@/services/tmdb';
import { formatCount, formatCurrency } from '@/utils/format';

export default function HomeScreen() {
  const { user } = useAuth();
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
  const [selectedDetails, setSelectedDetails] = useState<{
    id: string;
    duration: string;
    trailerUrl: string | null;
  }>({ id: '', duration: '', trailerUrl: null });

  useEffect(() => {
    if (!selectedTitle) return;
    let active = true;

    void Promise.all([
      fetchTitleDuration(selectedTitle),
      fetchTitleTrailerUrl(selectedTitle),
    ]).then(([resolvedDuration, resolvedTrailer]) => {
      if (!active) return;
      setSelectedDetails({
        id: selectedTitle.id,
        duration: resolvedDuration || selectedTitle.duration,
        trailerUrl: resolvedTrailer,
      });
    });

    return () => {
      active = false;
    };
  }, [selectedTitle]);

  const openDetails = (title: MediaTitle) => {
    setSelectedTitle(title);
    setDetailsVisible(true);
  };

  const selectedDuration = selectedTitle
    ? selectedDetails.id === selectedTitle.id
      ? selectedDetails.duration
      : getCachedTitleDuration(selectedTitle)
    : undefined;
  const selectedTrailerUrl = selectedTitle
    ? selectedDetails.id === selectedTitle.id
      ? selectedDetails.trailerUrl
      : getCachedTitleTrailerUrl(selectedTitle)
    : null;
  const isSelectedSaved = selectedTitle ? isTitleSaved(selectedTitle.id) : false;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: Math.max(108, 92 + insets.bottom) }]} showsVerticalScrollIndicator={false}>
        <FadeInBlock delay={0}>
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
                <MaterialIcons name="bookmark-border" size={28} color="#a3520d" />
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
                onPress={() => router.push('/(tabs)/tab3')}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Abrir perfil">
                <AppText peso="forte" style={styles.avatarText}>{user?.name.charAt(0).toLocaleUpperCase() ?? 'N'}</AppText>
              </Pressable>
            </View>
          </View>
        </FadeInBlock>

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
              <MaterialIcons name="autorenew" size={14} color="#d77c29" />
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
                <MaterialIcons name="casino" size={14} color="#f3b43f" />
                <AppText tipo="legenda" peso="forte" style={styles.pillText}>ROLETA DE CURADORIA</AppText>
              </View>
              <AppText tipo="titulo" familia="editorial" peso="forte" style={styles.heroTitle}>Escolha o que assistir em segundos</AppText>
              <AppText tipo="legenda" style={styles.heroDescription}>
                {availableTitles.length > 0
                  ? `${formatCount(eligibleTitles.length)} obras com nota 6,0+ prontas para sortear nos seus streamings.`
                  : 'Ative seus serviços em Assinaturas para liberar o sorteio personalizado.'}
              </AppText>
              <Pressable
                style={({ pressed }) => [
                  styles.drawButton,
                  (!storageReady || catalogStatus === 'loading' || availableTitles.length === 0) && styles.drawButtonDisabled,
                  pressed && styles.pressed,
                ]}
                onPress={roulette.openDrawModal}
                disabled={!storageReady || catalogStatus === 'loading' || availableTitles.length === 0}
                accessibilityRole="button">
                <AppText peso="forte" style={styles.drawButtonText}>{catalogStatus === 'loading' ? 'Carregando catálogo…' : 'Sortear título'}</AppText>
                <MaterialIcons name="arrow-forward" size={18} color="#182230" />
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
                  />
                  <View style={styles.heroPosterBadge}>
                    <MaterialIcons name="star" size={11} color="#f3b43f" />
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
              <MaterialIcons name="chevron-right" size={18} color="#a3520d" />
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
                <MaterialIcons name="add-circle-outline" size={20} color="#a3520d" />
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
              <MaterialIcons name="chevron-right" size={18} color="#a3520d" />
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.titleList}>
            {availableTitles.slice(0, 8).map((title) => {
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
                    <TitleArtwork id={title.id} variant="poster" posterPath={title.tmdbPosterPath} backdropPath={title.tmdbBackdropPath} />
                    {!hasArtwork && <MaterialIcons name={title.icon} size={34} color="rgba(255,255,255,0.9)" />}
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
                      <MaterialIcons name="star" size={12} color="#f3b43f" />
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
              <Pressable
                style={({ pressed }) => [styles.emptyTitlesCard, pressed && styles.pressed]}
                onPress={() => router.push('/subscriptions')}
                accessibilityRole="button">
                <MaterialIcons name="subscriptions" size={22} color="#a3520d" />
                <AppText tipo="legenda" peso="forte" style={styles.link}>Adicione uma assinatura para ver os títulos</AppText>
              </Pressable>
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

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f5f0' },
  container: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  brandTitle: { color: '#182230', fontSize: 17, lineHeight: 22, letterSpacing: 2.1 },
  topbarActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  listsButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#182230', borderWidth: 2, borderColor: '#e8e2d5' },
  avatarText: { color: '#f3b43f', fontSize: 17 },
  pressed: { opacity: 0.86, transform: [{ scale: 0.98 }] },
  statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffdf8', borderRadius: 18, borderWidth: 1, borderColor: '#e8e2d5', paddingVertical: 15, paddingHorizontal: 10, marginBottom: 22 },
  statsRowSyncing: { marginBottom: 10 },
  syncNotice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 18 },
  syncNoticeText: { color: '#6b5943', fontSize: 12.5, lineHeight: 17 },
  statBlock: { flex: 1, alignItems: 'center', paddingHorizontal: 6 },
  statNumber: { color: '#182230', fontSize: 21, lineHeight: 25, letterSpacing: -0.3, marginBottom: 4 },
  statHighlight: { color: '#a3520d', fontSize: 21, lineHeight: 25, letterSpacing: -0.3, marginBottom: 4 },
  statLabel: { color: '#5e5c57', fontSize: 12.5, lineHeight: 17, textAlign: 'center' },
  statDivider: { width: 1, height: 34, backgroundColor: '#e8e2d5' },
  muted: { color: '#5e5c57', fontSize: 13, lineHeight: 18 },
  hero: { minHeight: 206, overflow: 'hidden', borderRadius: 22, backgroundColor: '#182230', borderWidth: 1, borderColor: '#263442', flexDirection: 'row', alignItems: 'center', marginBottom: 28 },
  heroGlow: { position: 'absolute', width: 210, height: 210, borderRadius: 105, right: -44, top: -36, backgroundColor: '#223246' },
  heroCopy: { flex: 1, paddingVertical: 18, paddingLeft: 18, paddingRight: 10, zIndex: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  pillText: { color: '#f3b43f', letterSpacing: 1.3 },
  heroTitle: { color: '#fffdf8', fontSize: 19, lineHeight: 25, letterSpacing: -0.3, marginBottom: 7 },
  heroDescription: { color: '#bdc6ce', maxWidth: 240, fontSize: 13, lineHeight: 19, marginBottom: 16 },
  drawButton: { alignSelf: 'flex-start', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, backgroundColor: '#f3b43f', paddingHorizontal: 16, paddingVertical: 11 },
  drawButtonDisabled: { opacity: 0.55 },
  drawButtonText: { color: '#182230', fontSize: 14 },
  heroShowcase: { paddingRight: 16, paddingVertical: 18, zIndex: 1 },
  heroPosterFrame: { width: 90, height: 134, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255,253,248,0.22)', overflow: 'hidden', justifyContent: 'flex-end', padding: 7 },
  heroPosterBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(24,34,48,0.88)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  heroPosterBadgeText: { color: '#fffdf8', fontSize: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  sectionTitle: { color: '#182230', fontSize: 19, lineHeight: 24 },
  sectionLinkBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 6, paddingLeft: 8 },
  link: { color: '#a3520d', fontSize: 14, lineHeight: 19 },
  serviceList: { gap: 10, paddingBottom: 27 },
  serviceCard: { width: 178, height: 70, padding: 11, borderRadius: 16, backgroundColor: '#fffdf8', borderWidth: 1, borderColor: '#e8e2d5', flexDirection: 'row', alignItems: 'center', gap: 10 },
  emptyServiceCard: { minWidth: 200, height: 70, paddingHorizontal: 16, borderRadius: 16, backgroundColor: '#fffdf8', borderWidth: 1, borderColor: '#ded8cd', borderStyle: 'dashed', flexDirection: 'row', alignItems: 'center', gap: 9 },
  serviceCopy: { flex: 1 },
  serviceName: { color: '#182230', fontSize: 14, lineHeight: 19, marginBottom: 1 },
  servicePrice: { color: '#5e5c57', fontSize: 12.5, lineHeight: 17 },
  titleList: { gap: 13, paddingBottom: 28 },
  emptyTitlesCard: { minHeight: 118, width: 260, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, padding: 14, borderRadius: 16, backgroundColor: '#fffdf8', borderWidth: 1, borderColor: '#e8e2d5' },
  titleCard: { width: 136 },
  poster: { height: 176, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(24,34,48,0.08)', justifyContent: 'center', alignItems: 'center', gap: 10, padding: 11, marginBottom: 9, overflow: 'hidden' },
  posterRating: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(20,28,38,0.72)', borderRadius: 9, paddingHorizontal: 6, paddingVertical: 3 },
  posterRatingCorner: { position: 'absolute', bottom: 8, left: 8 },
  posterServicesCorner: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(20,28,38,0.74)', borderRadius: 9, padding: 3 },
  posterRatingText: { color: '#fffdf8', fontSize: 10 },
  posterLabel: { color: 'rgba(255,255,255,0.95)', textAlign: 'center', letterSpacing: 0.8 },
  titleName: { color: '#182230', fontSize: 13, lineHeight: 18 },
});