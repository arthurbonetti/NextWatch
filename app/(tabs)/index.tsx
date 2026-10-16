import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/atoms/AppText';
import { ServiceLogo } from '@/components/atoms/ServiceLogo';
import { getArtworkUri, TitleArtwork } from '@/components/atoms/TitleArtwork';
import { TitleDetailsModal } from '@/components/organisms/TitleDetailsModal';
import { CATALOG, GENRES, MediaKind, MediaTitle } from '@/constants/catalog';
import { useSubscriptions } from '@/contexts/SubscriptionsContext';

type KindFilter = 'Todos' | MediaKind;
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function randomIndex(length: number) {
  return Math.floor(Math.random() * length);
}

export default function HomeScreen() {
  const { subscriptions, storageReady } = useSubscriptions();
  const [kind, setKind] = useState<KindFilter>('Todos');
  const [genre, setGenre] = useState('Todos os gêneros');
  const [filterVisible, setFilterVisible] = useState(false);
  const [selectedTitle, setSelectedTitle] = useState<MediaTitle | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [lastDrawnId, setLastDrawnId] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [rouletteTitle, setRouletteTitle] = useState<MediaTitle | null>(null);
  const [rouletteRotation] = useState(() => new Animated.Value(0));
  const [rouletteScale] = useState(() => new Animated.Value(1));
  const rouletteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawLock = useRef(false);

  useEffect(() => () => {
    if (rouletteTimer.current) clearTimeout(rouletteTimer.current);
  }, []);

  const activeServiceNames = useMemo(() => new Set(subscriptions.filter((subscription) => subscription.active).map((subscription) => subscription.provider)), [subscriptions]);
  const availableTitles = useMemo(() => CATALOG.filter((title) => activeServiceNames.has(title.service)), [activeServiceNames]);
  const eligibleTitles = useMemo(() => availableTitles.filter((title) => {
    const kindMatches = kind === 'Todos' || title.kind === kind;
    const genreMatches = genre === 'Todos os gêneros' || title.genres.includes(genre);
    return kindMatches && genreMatches;
  }), [availableTitles, genre, kind]);
  const activeSubscriptions = useMemo(() => subscriptions.filter((subscription) => subscription.active), [subscriptions]);

  const openDetails = (title: MediaTitle) => {
    setSelectedTitle(title);
    setDetailsVisible(true);
  };

  const drawTitle = () => {
    if (drawLock.current || eligibleTitles.length === 0) return;

    const candidates = eligibleTitles.length > 1
      ? eligibleTitles.filter((title) => title.id !== lastDrawnId)
      : eligibleTitles;
    const result = candidates[randomIndex(candidates.length)];
    if (!result) return;

    drawLock.current = true;
    setFilterVisible(false);
    setSpinning(true);
    setRouletteTitle(eligibleTitles[randomIndex(eligibleTitles.length)]);
    rouletteRotation.setValue(0);
    rouletteScale.setValue(1);
    Animated.parallel([
      Animated.timing(rouletteRotation, {
        toValue: 1,
        duration: 2150,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(rouletteScale, { toValue: 1.08, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(rouletteScale, { toValue: 1, duration: 1850, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();

    setLastDrawnId(result.id);
    let previewIndex = 0;
    const previewCount = 7;
    const advanceRoulette = () => {
      previewIndex += 1;
      if (previewIndex < previewCount) {
        const preview = eligibleTitles[randomIndex(eligibleTitles.length)];
        if (preview) setRouletteTitle(preview);
        rouletteTimer.current = setTimeout(advanceRoulette, 160 + previewIndex * 55);
        return;
      }

      setRouletteTitle(result);
      rouletteTimer.current = setTimeout(() => {
        setSpinning(false);
        setFilterVisible(false);
        drawLock.current = false;
        openDetails(result);
      }, 420);
    };

    rouletteTimer.current = setTimeout(advanceRoulette, 160);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}>
          <View>
            <AppText tipo="legenda" peso="forte" style={styles.eyebrow}>NEXTWATCH</AppText>
            <AppText tipo="titulo" peso="forte" style={styles.greeting}>Sua próxima história</AppText>
          </View>
          <Pressable style={styles.avatar} onPress={() => router.push('/profile')} accessibilityLabel="Abrir perfil">
            <AppText peso="forte" style={styles.avatarText}>M</AppText>
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <View><AppText tipo="subtitulo" peso="forte" style={styles.statNumber}>{activeSubscriptions.length}</AppText><AppText tipo="legenda" style={styles.muted}>assinaturas ativas</AppText></View>
          <View style={styles.statDivider} />
          <View><AppText tipo="subtitulo" peso="forte" style={styles.statNumber}>{availableTitles.length}</AppText><AppText tipo="legenda" style={styles.muted}>títulos disponíveis</AppText></View>
          <View style={styles.statIcon}><MaterialIcons name="local-movies" size={22} color="#e58c34" /></View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <View style={styles.heroCopy}>
            <View style={styles.pill}><MaterialIcons name="auto-awesome" size={14} color="#f3b43f" /><AppText tipo="legenda" peso="forte" style={styles.pillText}>SORTEIO INTELIGENTE</AppText></View>
            <AppText tipo="subtitulo" peso="forte" style={styles.heroTitle}>Decida em segundos.</AppText>
            <AppText tipo="legenda" style={styles.heroDescription}>{availableTitles.length > 0 ? 'Sorteamos somente títulos dos seus serviços ativos.' : 'Adicione ou ative um streaming na aba Assinaturas para começar.'}</AppText>
            <Pressable style={[styles.drawButton, (!storageReady || eligibleTitles.length === 0) && styles.drawButtonDisabled]} onPress={() => setFilterVisible(true)} disabled={!storageReady || eligibleTitles.length === 0} accessibilityRole="button">
              <AppText peso="forte" style={styles.drawButtonText}>Sortear agora</AppText>
              <MaterialIcons name="casino" size={19} color="#182230" />
            </Pressable>
          </View>
          <View style={styles.heroArt}><MaterialIcons name="auto-awesome" size={72} color="#f3b43f" /></View>
        </View>

        <View style={styles.sectionHeader}>
          <View><AppText tipo="subtitulo" peso="forte" style={styles.sectionTitle}>Seus streamings</AppText><AppText tipo="legenda" style={styles.muted}>{activeSubscriptions.length} ativos · gerencie na aba Assinaturas</AppText></View>
          <MaterialIcons name="subscriptions" size={22} color="#d77c29" />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.serviceList}>
          {activeSubscriptions.map((subscription) => (
            <View style={styles.serviceCard} key={subscription.id}>
              <ServiceLogo name={subscription.provider} size={39} />
              <View style={styles.serviceCopy}><AppText peso="forte" style={styles.serviceName}>{subscription.provider}</AppText><AppText tipo="legenda" style={styles.muted}>{currency.format(subscription.monthlyPrice)}/mês</AppText></View>
            </View>
          ))}
          {activeSubscriptions.length === 0 && <Pressable style={styles.emptyServiceCard} onPress={() => router.push('/(tabs)/tab3')}><MaterialIcons name="add-circle-outline" size={20} color="#d77c29" /><AppText tipo="legenda" peso="forte" style={styles.link}>Adicionar assinatura</AppText></Pressable>}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <View><AppText tipo="subtitulo" peso="forte" style={styles.sectionTitle}>Para assistir</AppText><AppText tipo="legenda" style={styles.muted}>Disponíveis nos seus streamings</AppText></View>
          <Pressable onPress={() => router.push('/(tabs)/tab2')}><AppText tipo="legenda" peso="forte" style={styles.link}>Ver todos</AppText></Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.titleList}>
          {availableTitles.slice(0, 8).map((title) => {
            const hasArtwork = getArtworkUri(title.id, 'poster') !== null;
            return (
            <Pressable style={styles.titleCard} key={title.id} onPress={() => openDetails(title)} accessibilityRole="button">
              <View style={[styles.poster, { backgroundColor: title.color }]}>
                <TitleArtwork id={title.id} variant="poster" />
                {!hasArtwork && <MaterialIcons name={title.icon} size={34} color="rgba(255,255,255,0.9)" />}
                <View style={[styles.posterRating, hasArtwork && styles.posterRatingCorner]}><MaterialIcons name="star" size={12} color="#f3b43f" /><AppText tipo="legenda" peso="forte" style={styles.posterRatingText}>{title.imdbRating}</AppText></View>
                {!hasArtwork && <AppText tipo="legenda" peso="forte" style={styles.posterLabel}>{title.title.toUpperCase()}</AppText>}
              </View>
              <AppText peso="forte" style={styles.titleName} numberOfLines={1}>{title.title}</AppText>
              <AppText tipo="legenda" style={styles.muted}>{title.kind} · {title.year}</AppText>
            </Pressable>
            );
          })}
          {availableTitles.length === 0 && <Pressable style={styles.emptyTitlesCard} onPress={() => router.push('/(tabs)/tab3')}><MaterialIcons name="subscriptions" size={22} color="#d77c29" /><AppText tipo="legenda" peso="forte" style={styles.link}>Adicione uma assinatura para ver títulos</AppText></Pressable>}
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
            <AppText tipo="legenda" style={styles.rouletteCaption}>Escolhendo entre {eligibleTitles.length} títulos...</AppText>
            <View style={styles.roulettePreview}>
              <View style={[styles.previewPoster, { backgroundColor: rouletteTitle?.color ?? '#263b50' }]}>
                {rouletteTitle && <TitleArtwork id={rouletteTitle.id} variant="poster" />}
                {rouletteTitle && !getArtworkUri(rouletteTitle.id, 'poster') && <MaterialIcons name={rouletteTitle.icon} size={24} color="#fffdf8" />}
              </View>
              <View style={styles.previewCopy}>
                <AppText tipo="legenda" peso="forte" style={styles.previewType}>{rouletteTitle ? `${rouletteTitle.kind.toUpperCase()} · ${rouletteTitle.year}` : 'SORTEANDO'}</AppText>
                <AppText peso="forte" style={styles.previewTitle} numberOfLines={1}>{rouletteTitle?.title ?? 'Surpresa a caminho...'}</AppText>
              </View>
              {rouletteTitle && <View style={styles.previewRating}><MaterialIcons name="star" size={13} color="#f3b43f" /><AppText tipo="legenda" peso="forte" style={styles.previewRatingText}>{rouletteTitle.imdbRating}</AppText></View>}
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={filterVisible} transparent animationType="slide" onRequestClose={() => setFilterVisible(false)} statusBarTranslucent>
        <View style={styles.filterBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setFilterVisible(false)} accessibilityLabel="Fechar filtros" />
          <View style={styles.filterCard}>
            <View style={styles.filterHeader}>
              <View><AppText tipo="legenda" peso="forte" style={styles.modalEyebrow}>SORTEIO</AppText><AppText tipo="subtitulo" peso="forte" style={styles.modalTitle}>O que combina com você?</AppText></View>
              <Pressable onPress={() => setFilterVisible(false)} style={styles.closeButton} accessibilityLabel="Fechar"><MaterialIcons name="close" size={21} color="#182230" /></Pressable>
            </View>
            <AppText tipo="legenda" style={styles.modalDescription}>{eligibleTitles.length > 0 ? 'O sorteio considera apenas títulos disponíveis nos seus serviços ativos.' : 'Você ainda não tem títulos nos serviços ativos. Adicione ou ative uma assinatura para sortear.'}</AppText>
            <AppText tipo="legenda" peso="forte" style={styles.filterLabel}>TIPO</AppText>
            <View style={styles.chipRow}>
              {(['Todos', 'Filme', 'Série'] as KindFilter[]).map((item) => (
                <Pressable key={item} onPress={() => setKind(item)} style={[styles.chip, kind === item && styles.chipSelected]}><AppText tipo="legenda" peso="forte" style={kind === item ? styles.chipTextSelected : styles.chipText}>{item === 'Todos' ? 'Tanto faz' : item === 'Filme' ? 'Filmes' : 'Séries'}</AppText></Pressable>
              ))}
            </View>
            <AppText tipo="legenda" peso="forte" style={styles.filterLabel}>GÊNERO</AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {['Todos os gêneros', ...GENRES].map((item) => (
                <Pressable key={item} onPress={() => setGenre(item)} style={[styles.chip, genre === item && styles.chipSelected]}><AppText tipo="legenda" peso="forte" style={genre === item ? styles.chipTextSelected : styles.chipText}>{item === 'Todos os gêneros' ? 'Tanto faz' : item}</AppText></Pressable>
              ))}
            </ScrollView>
            <AppText tipo="legenda" style={styles.resultCount}>{eligibleTitles.length} {eligibleTitles.length === 1 ? 'título disponível' : 'títulos disponíveis'} dos seus streamings</AppText>
            <Pressable style={[styles.confirmButton, eligibleTitles.length === 0 && styles.disabledButton]} onPress={drawTitle} disabled={eligibleTitles.length === 0} accessibilityRole="button">
              <AppText peso="forte" style={styles.confirmButtonText}>Sortear meu próximo título</AppText><MaterialIcons name="auto-awesome" size={19} color="#182230" />
            </Pressable>
          </View>
        </View>
      </Modal>

      <TitleDetailsModal title={selectedTitle} visible={detailsVisible} onClose={() => setDetailsVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f5f0' },
  container: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 21 },
  eyebrow: { color: '#e58c34', letterSpacing: 1.5, marginBottom: 5 },
  greeting: { color: '#182230', fontSize: 25, lineHeight: 30 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#182230' },
  avatarText: { color: '#f3b43f', fontSize: 18 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
  statNumber: { color: '#182230', lineHeight: 22 },
  statDivider: { width: 1, height: 29, backgroundColor: '#d9d3c8', marginHorizontal: 18 },
  statIcon: { marginLeft: 'auto', width: 40, height: 40, borderRadius: 20, backgroundColor: '#fffdf8', alignItems: 'center', justifyContent: 'center' },
  muted: { color: '#7b7b78' },
  hero: { minHeight: 204, overflow: 'hidden', borderRadius: 22, backgroundColor: '#182230', flexDirection: 'row', marginBottom: 29 },
  heroGlow: { position: 'absolute', width: 190, height: 190, borderRadius: 95, right: -48, top: -28, backgroundColor: '#263b50' },
  heroCopy: { flex: 1, padding: 20, zIndex: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  pillText: { color: '#f3b43f', letterSpacing: 1.1 },
  heroTitle: { color: '#fffdf8', fontSize: 22, lineHeight: 27, marginBottom: 5 },
  heroDescription: { color: '#bdc6ce', maxWidth: 230, marginBottom: 15, lineHeight: 18 },
  drawButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, backgroundColor: '#f3b43f', paddingHorizontal: 14, paddingVertical: 10 },
  drawButtonDisabled: { opacity: 0.55 },
  drawButtonText: { color: '#182230', fontSize: 13 },
  heroArt: { width: 82, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-12deg' }] },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  sectionTitle: { color: '#182230', fontSize: 19, lineHeight: 24 },
  link: { color: '#d77c29' },
  serviceList: { gap: 10, paddingBottom: 27 },
  serviceCard: { width: 174, height: 68, padding: 10, borderRadius: 15, backgroundColor: '#fffdf8', flexDirection: 'row', alignItems: 'center', gap: 9 },
  emptyServiceCard: { minWidth: 190, height: 68, paddingHorizontal: 15, borderRadius: 15, backgroundColor: '#fffdf8', flexDirection: 'row', alignItems: 'center', gap: 8 },
  serviceCopy: { flex: 1 },
  serviceName: { color: '#182230', fontSize: 13 },
  titleList: { gap: 13, paddingBottom: 28 },
  emptyTitlesCard: { minHeight: 118, width: 260, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, padding: 14, borderRadius: 15, backgroundColor: '#fffdf8' },
  titleCard: { width: 132 },
  poster: { height: 166, borderRadius: 14, justifyContent: 'center', alignItems: 'center', gap: 10, padding: 11, marginBottom: 9, overflow: 'hidden' },
  posterRating: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(20,28,38,0.72)', borderRadius: 9, paddingHorizontal: 6, paddingVertical: 3 },
  posterRatingCorner: { position: 'absolute', top: 8, left: 8 },
  posterRatingText: { color: '#fffdf8', fontSize: 10 },
  posterLabel: { color: 'rgba(255,255,255,0.95)', textAlign: 'center', letterSpacing: 0.8 },
  titleName: { color: '#182230', fontSize: 13, lineHeight: 18 },
  filterBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(24,34,48,0.58)' },
  filterCard: { backgroundColor: '#fffdf8', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 23, paddingBottom: 32 },
  filterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  modalEyebrow: { color: '#e58c34', letterSpacing: 1.2, marginBottom: 6 },
  modalTitle: { color: '#182230', fontSize: 21, lineHeight: 26, maxWidth: 280 },
  closeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f1eee7', alignItems: 'center', justifyContent: 'center' },
  modalDescription: { color: '#7b7b78', marginTop: 8, marginBottom: 19, lineHeight: 18 },
  filterLabel: { color: '#7b7b78', letterSpacing: 1, marginBottom: 9 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 15 },
  chip: { borderRadius: 18, borderWidth: 1, borderColor: '#ded8cd', paddingHorizontal: 13, paddingVertical: 8, backgroundColor: '#fffdf8' },
  chipSelected: { backgroundColor: '#182230', borderColor: '#182230' },
  chipText: { color: '#6c6b67' },
  chipTextSelected: { color: '#fffdf8' },
  resultCount: { color: '#7b7b78', textAlign: 'center', marginBottom: 10 },
  confirmButton: { minHeight: 52, borderRadius: 14, backgroundColor: '#f3b43f', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  disabledButton: { opacity: 0.5 },
  confirmButtonText: { color: '#182230' },
  rouletteBackdrop: { flex: 1, padding: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(9,15,23,0.82)' },
  rouletteCard: { width: '100%', maxWidth: 380, alignItems: 'center', borderRadius: 26, paddingHorizontal: 22, paddingTop: 27, paddingBottom: 23, backgroundColor: '#fffdf8' },
  rouletteEyebrow: { color: '#d77c29', letterSpacing: 1.5, marginBottom: 19 },
  rouletteWheel: { width: 144, height: 144, alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  wheelRing: { ...StyleSheet.absoluteFill, borderRadius: 72, borderWidth: 10, borderColor: '#f3b43f', borderRightColor: '#d77c29', borderBottomColor: '#182230', borderLeftColor: '#78a69a' },
  wheelCenter: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1e8d7' },
  wheelDot: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: '#fffdf8', borderWidth: 3, borderColor: '#d77c29' },
  wheelDotTop: { top: 1, left: 66 },
  wheelDotRight: { right: 1, top: 66, borderColor: '#182230' },
  wheelDotBottom: { bottom: 1, left: 66, borderColor: '#78a69a' },
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