import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/atoms/AppText';
import { NextWatchLogo } from '@/components/atoms/NextWatchLogo';
import { ServiceLogo } from '@/components/atoms/ServiceLogo';
import { getArtworkUri, TitleArtwork } from '@/components/atoms/TitleArtwork';
import { TitleDetailsModal } from '@/components/organisms/TitleDetailsModal';
import { formatAverageRating, GENRES, getTitleAverageRating, getTitleServices, MediaKind, MediaTitle } from '@/constants/catalog';
import { useAuth } from '@/contexts/AuthContext';
import { useCatalog } from '@/contexts/CatalogContext';
import { useSubscriptions } from '@/contexts/SubscriptionsContext';
import { fetchTitleDuration } from '@/services/tmdb';
import { quickSortByRandom } from '@/utils/quickSort';

type KindFilter = 'Todos' | MediaKind;
const MIN_DRAW_RATING = 6.0;
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const countFormat = new Intl.NumberFormat('pt-BR');

export default function HomeScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { titles, status: catalogStatus, isFetchingCatalog } = useCatalog();
  const { subscriptions, storageReady } = useSubscriptions();
  const [kind, setKind] = useState<KindFilter>('Todos');
  const [genre, setGenre] = useState('Todos os gêneros');
  const [filterVisible, setFilterVisible] = useState(false);
  const [incompleteCatalogConfirmVisible, setIncompleteCatalogConfirmVisible] = useState(false);
  const [selectedTitle, setSelectedTitle] = useState<MediaTitle | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [drawError, setDrawError] = useState<string | null>(null);
  const [lastDrawnId, setLastDrawnId] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [rouletteTitle, setRouletteTitle] = useState<MediaTitle | null>(null);
  const [rouletteRotation] = useState(() => new Animated.Value(0));
  const [rouletteScale] = useState(() => new Animated.Value(1));
  const [heroOpacity] = useState(() => new Animated.Value(0));
  const [heroTranslateY] = useState(() => new Animated.Value(12));
  const rouletteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawLock = useRef(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroOpacity, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(heroTranslateY, {
        toValue: 0,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    return () => {
      if (rouletteTimer.current) clearTimeout(rouletteTimer.current);
    };
  }, [heroOpacity, heroTranslateY]);

  const activeServiceNames = useMemo(() => new Set(subscriptions.filter((subscription) => subscription.active).map((subscription) => subscription.provider)), [subscriptions]);
  const availableTitles = useMemo(() => titles.filter((title) =>
    getTitleServices(title).some((service) => activeServiceNames.has(service))
  ), [activeServiceNames, titles]);
  const availableGenres = useMemo(() => Array.from(new Set([...GENRES, ...titles.flatMap((title) => title.genres)])), [titles]);
  const eligibleTitles = useMemo(() => availableTitles.filter((title) => {
    const rating = getTitleAverageRating(title);
    const ratingMatches = rating >= MIN_DRAW_RATING;
    const kindMatches = kind === 'Todos' || title.kind === kind;
    const genreMatches = genre === 'Todos os gêneros' || title.genres.includes(genre);
    return ratingMatches && kindMatches && genreMatches;
  }), [availableTitles, genre, kind]);
  const activeSubscriptions = useMemo(() => subscriptions.filter((subscription) => subscription.active), [subscriptions]);

  const openDetails = (title: MediaTitle) => {
    void fetchTitleDuration(title);
    setSelectedTitle(title);
    setDetailsVisible(true);
  };

  const drawTitle = () => {
    if (drawLock.current || eligibleTitles.length === 0) return;
    drawLock.current = true;
    setDrawError(null);

    const drawCandidates = eligibleTitles;
    const candidates = drawCandidates.length > 1
      ? drawCandidates.filter((title) => title.id !== lastDrawnId)
      : drawCandidates;
    const result = quickSortByRandom(candidates)[0];
    if (!result) {
      drawLock.current = false;
      return;
    }

    void fetchTitleDuration(result);

    setFilterVisible(false);
    setSpinning(true);
    setRouletteTitle(quickSortByRandom(drawCandidates)[0] ?? result);
    rouletteRotation.setValue(0);
    rouletteScale.setValue(1);
    Animated.parallel([
      Animated.timing(rouletteRotation, {
        toValue: 1,
        duration: 1050,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(rouletteScale, { toValue: 1.08, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(rouletteScale, { toValue: 1, duration: 850, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();

    setLastDrawnId(result.id);
    let previewIndex = 0;
    const previewCount = 5;
    const advanceRoulette = () => {
      previewIndex += 1;
      if (previewIndex < previewCount) {
        const preview = quickSortByRandom(drawCandidates)[0];
        if (preview) setRouletteTitle(preview);
        rouletteTimer.current = setTimeout(advanceRoulette, 100 + previewIndex * 40);
        return;
      }

      setRouletteTitle(result);
      rouletteTimer.current = setTimeout(() => {
        setSpinning(false);
        setFilterVisible(false);
        drawLock.current = false;
        openDetails(result);
      }, 220);
    };

    rouletteTimer.current = setTimeout(advanceRoulette, 100);
  };

  const handleDrawPress = () => {
    if (drawLock.current || eligibleTitles.length === 0) return;
    if (isFetchingCatalog) {
      setIncompleteCatalogConfirmVisible(true);
      return;
    }
    drawTitle();
  };

  const closeFilterModal = () => {
    setIncompleteCatalogConfirmVisible(false);
    setFilterVisible(false);
  };

  const featuredSample = eligibleTitles[0] ?? availableTitles[0] ?? titles[0] ?? null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}>
          <View style={styles.brandRow}>
            <NextWatchLogo size={38} />
            <AppText tipo="subtitulo" peso="forte" style={styles.brandTitle}>NEXTWATCH</AppText>
          </View>
          <Pressable
            style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
            onPress={() => router.push('/(tabs)/tab3')}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Abrir perfil">
            <AppText peso="forte" style={styles.avatarText}>{user?.name.charAt(0).toLocaleUpperCase() ?? 'N'}</AppText>
          </Pressable>
        </View>

        <View style={[styles.statsRow, isFetchingCatalog && availableTitles.length > 0 && styles.statsRowSyncing]}>
          <Pressable
            style={({ pressed }) => [styles.statBlock, pressed && styles.pressed]}
            onPress={() => router.push('/subscriptions')}
            accessibilityRole="button">
            <AppText tipo="subtitulo" peso="forte" tabular style={styles.statNumber}>{countFormat.format(activeSubscriptions.length)}</AppText>
            <AppText tipo="legenda" peso="medio" style={styles.statLabel}>streamings ativos</AppText>
          </Pressable>
          <View style={styles.statDivider} />
          <Pressable
            style={({ pressed }) => [styles.statBlock, pressed && styles.pressed]}
            onPress={() => router.push('/(tabs)/tab2')}
            accessibilityRole="button">
            <AppText tipo="subtitulo" peso="forte" tabular style={styles.statNumber}>{countFormat.format(availableTitles.length)}</AppText>
            <AppText tipo="legenda" peso="medio" style={styles.statLabel}>no catálogo</AppText>
          </Pressable>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}>
            <AppText tipo="subtitulo" peso="forte" tabular style={styles.statHighlight}>{countFormat.format(eligibleTitles.length)}</AppText>
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

        <Animated.View
          style={[
            styles.hero,
            {
              opacity: heroOpacity,
              transform: [{ translateY: heroTranslateY }],
            },
          ]}>
          <View style={styles.heroGlow} />
          <View style={styles.heroCopy}>
            <View style={styles.pill}>
              <MaterialIcons name="casino" size={14} color="#f3b43f" />
              <AppText tipo="legenda" peso="forte" style={styles.pillText}>ROLETA DE CURADORIA</AppText>
            </View>
            <AppText tipo="titulo" familia="editorial" peso="forte" style={styles.heroTitle}>Escolha o que assistir em segundos</AppText>
            <AppText tipo="legenda" style={styles.heroDescription}>
              {availableTitles.length > 0
                ? `${countFormat.format(eligibleTitles.length)} obras com nota 6,0+ prontas para sortear nos seus streamings.`
                : 'Ative seus serviços em Assinaturas para liberar o sorteio personalizado.'}
            </AppText>
            <Pressable
              style={({ pressed }) => [
                styles.drawButton,
                (!storageReady || catalogStatus === 'loading' || availableTitles.length === 0) && styles.drawButtonDisabled,
                pressed && styles.pressed,
              ]}
              onPress={() => { setDrawError(null); setFilterVisible(true); }}
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
        </Animated.View>

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
            <MaterialIcons name="chevron-right" size={16} color="#d77c29" />
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
                <AppText tipo="legenda" tabular style={styles.servicePrice}>{currency.format(subscription.monthlyPrice)}/mês</AppText>
              </View>
            </Pressable>
          ))}
          {activeSubscriptions.length === 0 && (
            <Pressable
              style={({ pressed }) => [styles.emptyServiceCard, pressed && styles.pressed]}
              onPress={() => router.push('/subscriptions')}
              accessibilityRole="button">
              <MaterialIcons name="add-circle-outline" size={20} color="#d77c29" />
              <AppText tipo="legenda" peso="forte" style={styles.link}>Ativar primeiro streaming</AppText>
            </Pressable>
          )}
        </ScrollView>

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
            <MaterialIcons name="chevron-right" size={16} color="#d77c29" />
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.titleList}>
          {availableTitles.slice(0, 8).map((title) => {
            const hasArtwork = getArtworkUri(title.id, 'poster', {
              posterPath: title.tmdbPosterPath,
              backdropPath: title.tmdbBackdropPath,
            }) !== null;
            return (
              <Pressable
                style={({ pressed }) => [styles.titleCard, pressed && styles.pressed]}
                key={title.id}
                onPress={() => openDetails(title)}
                accessibilityRole="button">
                <View style={[styles.poster, { backgroundColor: title.color }]}>
                  <TitleArtwork id={title.id} variant="poster" posterPath={title.tmdbPosterPath} backdropPath={title.tmdbBackdropPath} />
                  {!hasArtwork && <MaterialIcons name={title.icon} size={34} color="rgba(255,255,255,0.9)" />}
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
              <MaterialIcons name="subscriptions" size={22} color="#d77c29" />
              <AppText tipo="legenda" peso="forte" style={styles.link}>Adicione uma assinatura para ver os títulos</AppText>
            </Pressable>
          )}
        </ScrollView>
      </ScrollView>

      <Modal visible={spinning} transparent animationType="fade" onRequestClose={() => {}} statusBarTranslucent>
        <View style={styles.rouletteBackdrop}>
          <View style={styles.rouletteCard}>
            <AppText tipo="legenda" peso="forte" style={styles.rouletteEyebrow}>A SORTE ESTÁ LANÇADA</AppText>
            <Animated.View
              style={[
                styles.rouletteWheel,
                {
                  transform: [
                    { rotate: rouletteRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '1080deg'] }) },
                    { scale: rouletteScale },
                  ],
                },
              ]}>
              <View style={styles.wheelRing} />
              <View style={[styles.wheelDot, styles.wheelDotTop]} />
              <View style={[styles.wheelDot, styles.wheelDotRight]} />
              <View style={[styles.wheelDot, styles.wheelDotBottom]} />
              <View style={[styles.wheelDot, styles.wheelDotLeft]} />
              <View style={styles.wheelCenter}><MaterialIcons name="casino" size={37} color="#182230" /></View>
            </Animated.View>
            <AppText tipo="legenda" tabular style={styles.rouletteCaption}>Escolhendo entre {countFormat.format(eligibleTitles.length)} títulos…</AppText>
            <View style={styles.roulettePreview}>
              <View style={[styles.previewPoster, { backgroundColor: rouletteTitle?.color ?? '#263b50' }]}>
                {rouletteTitle && <TitleArtwork id={rouletteTitle.id} variant="poster" posterPath={rouletteTitle.tmdbPosterPath} backdropPath={rouletteTitle.tmdbBackdropPath} />}
                {rouletteTitle && !getArtworkUri(rouletteTitle.id, 'poster', { posterPath: rouletteTitle.tmdbPosterPath, backdropPath: rouletteTitle.tmdbBackdropPath }) && <MaterialIcons name={rouletteTitle.icon} size={24} color="#fffdf8" />}
              </View>
              <View style={styles.previewCopy}>
                <AppText tipo="legenda" peso="forte" tabular style={styles.previewType}>{rouletteTitle ? `${rouletteTitle.kind.toUpperCase()} · ${rouletteTitle.year}` : 'SORTEANDO'}</AppText>
                <AppText peso="forte" style={styles.previewTitle} numberOfLines={1}>{rouletteTitle?.title ?? 'Surpresa a caminho…'}</AppText>
              </View>
              {rouletteTitle && <View style={styles.previewRating}><MaterialIcons name="star" size={13} color="#f3b43f" /><AppText tipo="legenda" peso="forte" tabular style={styles.previewRatingText}>{formatAverageRating(rouletteTitle)}</AppText></View>}
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={filterVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (incompleteCatalogConfirmVisible) {
            setIncompleteCatalogConfirmVisible(false);
            return;
          }
          closeFilterModal();
        }}
        statusBarTranslucent>
        <View style={styles.filterBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeFilterModal} accessibilityLabel="Fechar filtros" />
          <View style={[styles.filterCard, { paddingBottom: Math.max(32, insets.bottom + 18) }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.filterHeader}>
              <View><AppText tipo="legenda" peso="forte" style={styles.modalEyebrow}>SORTEIO</AppText><AppText tipo="subtitulo" familia="editorial" peso="forte" style={styles.modalTitle}>O que combina com você?</AppText></View>
              <Pressable
                onPress={closeFilterModal}
                hitSlop={8}
                style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Fechar">
                <MaterialIcons name="close" size={21} color="#182230" />
              </Pressable>
            </View>
            <AppText tipo="legenda" style={styles.modalDescription}>
              {availableTitles.length > 0
                ? 'Apenas obras com média 6,0+ (entre TMDB e Metacritic ÷ 10) entram na roleta.'
                : 'Você ainda não tem títulos nos serviços ativos. Adicione ou ative uma assinatura para sortear.'}
            </AppText>
            <AppText tipo="legenda" peso="forte" style={styles.filterLabel}>TIPO</AppText>
            <View style={styles.chipRow}>
              {(['Todos', 'Filme', 'Série', 'Anime'] as KindFilter[]).map((item) => (
                <Pressable
                  key={item}
                  onPress={() => setKind(item)}
                  style={({ pressed }) => [styles.chip, kind === item && styles.chipSelected, pressed && styles.pressed]}>
                  <AppText tipo="legenda" peso="forte" numberOfLines={1} style={kind === item ? styles.chipTextSelected : styles.chipText}>
                    {item === 'Todos' ? 'Tanto faz' : item === 'Filme' ? 'Filmes' : item === 'Série' ? 'Séries' : 'Animes'}
                  </AppText>
                </Pressable>
              ))}
            </View>
            <AppText tipo="legenda" peso="forte" style={styles.filterLabel}>GÊNERO</AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScrollRow}>
              {['Todos os gêneros', ...availableGenres].map((item) => (
                <Pressable
                  key={item}
                  onPress={() => setGenre(item)}
                  style={({ pressed }) => [styles.chip, genre === item && styles.chipSelected, pressed && styles.pressed]}>
                  <AppText tipo="legenda" peso="forte" numberOfLines={1} style={genre === item ? styles.chipTextSelected : styles.chipText}>
                    {item === 'Todos os gêneros' ? 'Tanto faz' : item}
                  </AppText>
                </Pressable>
              ))}
            </ScrollView>
            <AppText tipo="legenda" tabular style={styles.resultCount}>
              {`${countFormat.format(eligibleTitles.length)} ${eligibleTitles.length === 1 ? 'título com média 6,0+ disponível' : 'títulos com média 6,0+ disponíveis'}`}
            </AppText>
            {drawError && <AppText tipo="legenda" style={styles.drawError}>{drawError}</AppText>}
            <Pressable
              style={({ pressed }) => [
                styles.confirmButton,
                eligibleTitles.length === 0 && styles.disabledButton,
                pressed && eligibleTitles.length > 0 && styles.pressed,
              ]}
              onPress={handleDrawPress}
              disabled={eligibleTitles.length === 0}
              accessibilityRole="button">
              <AppText peso="forte" style={styles.confirmButtonText}>Sortear meu próximo título</AppText>
              <MaterialIcons name="auto-awesome" size={19} color="#182230" />
            </Pressable>
          </View>
        </View>
        {incompleteCatalogConfirmVisible && (
          <View style={styles.confirmBackdrop}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setIncompleteCatalogConfirmVisible(false)}
              accessibilityLabel="Fechar aviso de carregamento"
            />
            <View style={styles.confirmCard}>
              <View style={styles.confirmIconBadge}>
                <MaterialIcons name="hourglass-top" size={24} color="#d77c29" />
              </View>
              <AppText tipo="legenda" peso="forte" style={styles.confirmEyebrow}>CATÁLOGO EM CARREGAMENTO</AppText>
              <AppText tipo="subtitulo" familia="editorial" peso="forte" style={styles.confirmTitle}>Títulos ainda carregando</AppText>
              <AppText tipo="legenda" style={styles.confirmMessage}>
                Nem todos os títulos foram carregados ainda. Deseja sortear apenas com os disponíveis?
              </AppText>
              <View style={styles.confirmActions}>
                <Pressable
                  style={({ pressed }) => [styles.confirmProceedButton, pressed && styles.pressed]}
                  onPress={() => {
                    setIncompleteCatalogConfirmVisible(false);
                    drawTitle();
                  }}
                  accessibilityRole="button">
                  <MaterialIcons name="auto-awesome" size={18} color="#182230" />
                  <AppText peso="forte" style={styles.confirmProceedText} numberOfLines={1}>Sortear mesmo assim</AppText>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.confirmCancelButton, pressed && styles.pressed]}
                  onPress={() => setIncompleteCatalogConfirmVisible(false)}
                  accessibilityRole="button">
                  <AppText peso="forte" style={styles.confirmCancelText}>Cancelar</AppText>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </Modal>

      <TitleDetailsModal
        title={selectedTitle}
        visible={detailsVisible}
        onClose={() => setDetailsVisible(false)}
        onDrawAnother={
          eligibleTitles.length > 1
            ? () => {
                setDetailsVisible(false);
                drawTitle();
              }
            : undefined
        }
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
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#182230', borderWidth: 2, borderColor: '#e8e2d5' },
  avatarText: { color: '#f3b43f', fontSize: 17 },
  pressed: { opacity: 0.86, transform: [{ scale: 0.98 }] },
  statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffdf8', borderRadius: 18, borderWidth: 1, borderColor: '#e8e2d5', paddingVertical: 15, paddingHorizontal: 10, marginBottom: 22 },
  statsRowSyncing: { marginBottom: 10 },
  syncNotice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 18 },
  syncNoticeText: { color: '#8d7a61', fontSize: 12, lineHeight: 16 },
  statBlock: { flex: 1, alignItems: 'center', paddingHorizontal: 6 },
  statNumber: { color: '#182230', fontSize: 21, lineHeight: 25, letterSpacing: -0.3, marginBottom: 4 },
  statHighlight: { color: '#d77c29', fontSize: 21, lineHeight: 25, letterSpacing: -0.3, marginBottom: 4 },
  statLabel: { color: '#7b7b78', fontSize: 11.5, lineHeight: 15, textAlign: 'center' },
  statDivider: { width: 1, height: 34, backgroundColor: '#e8e2d5' },
  muted: { color: '#7b7b78' },
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
  link: { color: '#d77c29' },
  serviceList: { gap: 10, paddingBottom: 27 },
  serviceCard: { width: 178, height: 70, padding: 11, borderRadius: 16, backgroundColor: '#fffdf8', borderWidth: 1, borderColor: '#e8e2d5', flexDirection: 'row', alignItems: 'center', gap: 10 },
  emptyServiceCard: { minWidth: 200, height: 70, paddingHorizontal: 16, borderRadius: 16, backgroundColor: '#fffdf8', borderWidth: 1, borderColor: '#ded8cd', borderStyle: 'dashed', flexDirection: 'row', alignItems: 'center', gap: 9 },
  serviceCopy: { flex: 1 },
  serviceName: { color: '#182230', fontSize: 14, lineHeight: 19, marginBottom: 1 },
  servicePrice: { color: '#8c8a84', fontSize: 11.5, lineHeight: 15 },
  titleList: { gap: 13, paddingBottom: 28 },
  emptyTitlesCard: { minHeight: 118, width: 260, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, padding: 14, borderRadius: 16, backgroundColor: '#fffdf8', borderWidth: 1, borderColor: '#e8e2d5' },
  titleCard: { width: 136 },
  poster: { height: 176, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(24,34,48,0.08)', justifyContent: 'center', alignItems: 'center', gap: 10, padding: 11, marginBottom: 9, overflow: 'hidden' },
  posterRating: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(20,28,38,0.72)', borderRadius: 9, paddingHorizontal: 6, paddingVertical: 3 },
  posterRatingCorner: { position: 'absolute', bottom: 8, left: 8 },
  posterRatingText: { color: '#fffdf8', fontSize: 10 },
  posterLabel: { color: 'rgba(255,255,255,0.95)', textAlign: 'center', letterSpacing: 0.8 },
  titleName: { color: '#182230', fontSize: 13, lineHeight: 18 },
  filterBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(24,34,48,0.58)' },
  filterCard: { backgroundColor: '#fffdf8', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 23, paddingTop: 12, paddingBottom: 32 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#d8d3c9', alignSelf: 'center', marginBottom: 14 },
  filterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  modalEyebrow: { color: '#e58c34', letterSpacing: 1.3, marginBottom: 6 },
  modalTitle: { color: '#182230', fontSize: 22, lineHeight: 27, letterSpacing: -0.35, maxWidth: 280 },
  closeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f1eee7', alignItems: 'center', justifyContent: 'center' },
  modalDescription: { color: '#7b7b78', fontSize: 13, lineHeight: 19, marginTop: 8, marginBottom: 19 },
  filterLabel: { color: '#7b7b78', letterSpacing: 1, marginBottom: 9 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 15 },
  chipScrollRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 15 },
  chip: { flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 18, borderWidth: 1, borderColor: '#ded8cd', paddingHorizontal: 13, paddingVertical: 8, backgroundColor: '#fffdf8' },
  chipSelected: { backgroundColor: '#182230', borderColor: '#182230' },
  chipText: { color: '#6c6b67' },
  chipTextSelected: { color: '#fffdf8' },
  resultCount: { color: '#7b7b78', textAlign: 'center', marginBottom: 10 },
  drawError: { color: '#c0392b', textAlign: 'center', marginBottom: 12 },
  confirmButton: { minHeight: 52, borderRadius: 14, backgroundColor: '#f3b43f', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  disabledButton: { opacity: 0.5 },
  confirmButtonText: { color: '#182230' },
  confirmBackdrop: { ...StyleSheet.absoluteFill, padding: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(9,15,23,0.72)' },
  confirmCard: { width: '100%', maxWidth: 360, alignItems: 'center', borderRadius: 24, paddingHorizontal: 22, paddingTop: 24, paddingBottom: 20, backgroundColor: '#fffdf8', borderWidth: 1, borderColor: '#e8e2d5' },
  confirmIconBadge: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#f6ebd4', borderWidth: 1, borderColor: '#ebd9b3', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  confirmEyebrow: { color: '#e58c34', letterSpacing: 1.3, textAlign: 'center', marginBottom: 6 },
  confirmTitle: { color: '#182230', fontSize: 21, lineHeight: 26, letterSpacing: -0.35, textAlign: 'center', marginBottom: 8 },
  confirmMessage: { color: '#687078', fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 22 },
  confirmActions: { width: '100%', gap: 10 },
  confirmProceedButton: { width: '100%', minHeight: 48, borderRadius: 14, backgroundColor: '#f3b43f', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  confirmProceedText: { color: '#182230', fontSize: 14, textAlign: 'center' },
  confirmCancelButton: { width: '100%', minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: '#ded8cd', backgroundColor: '#f7f5f0', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  confirmCancelText: { color: '#182230', fontSize: 14, textAlign: 'center' },
  rouletteBackdrop: { flex: 1, padding: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(9,15,23,0.82)' },
  rouletteCard: { width: '100%', maxWidth: 380, alignItems: 'center', borderRadius: 26, paddingHorizontal: 22, paddingTop: 27, paddingBottom: 23, backgroundColor: '#fffdf8' },
  rouletteEyebrow: { color: '#d77c29', letterSpacing: 1.5, marginBottom: 19 },
  rouletteWheel: { width: 144, height: 144, alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  wheelRing: { ...StyleSheet.absoluteFill, borderRadius: 72, borderWidth: 10, borderColor: '#f3b43f', borderRightColor: '#d77c29', borderBottomColor: '#182230', borderLeftColor: '#e58c34' },
  wheelCenter: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1e8d7' },
  wheelDot: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: '#fffdf8', borderWidth: 3, borderColor: '#d77c29' },
  wheelDotTop: { top: 1, left: 66 },
  wheelDotRight: { right: 1, top: 66, borderColor: '#182230' },
  wheelDotBottom: { bottom: 1, left: 66, borderColor: '#e58c34' },
  wheelDotLeft: { left: 1, top: 66, borderColor: '#f3b43f' },
  rouletteCaption: { color: '#7b7b78', marginBottom: 19 },
  roulettePreview: { width: '100%', minHeight: 68, flexDirection: 'row', alignItems: 'center', padding: 9, borderRadius: 16, backgroundColor: '#f1eee7' },
  previewPoster: { width: 48, height: 50, borderRadius: 11, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  previewCopy: { flex: 1, paddingHorizontal: 11 },
  previewType: { color: '#d77c29', fontSize: 9, letterSpacing: 0.8, marginBottom: 3 },
  previewTitle: { color: '#182230', fontSize: 14 },
  previewRating: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 9, backgroundColor: '#182230' },
  previewRatingText: { color: '#fffdf8', fontSize: 11 },
});