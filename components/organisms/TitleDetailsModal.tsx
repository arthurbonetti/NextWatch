import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/atoms/AppText';
import { ServiceLogo } from '@/components/atoms/ServiceLogo';
import { getArtworkUri, TitleArtwork } from '@/components/atoms/TitleArtwork';
import { getMetacriticScore, getTitleServices, MediaTitle } from '@/constants/catalog';
import { fetchTitleDuration, getCachedTitleDuration } from '@/services/tmdb';

type Props = {
  title: MediaTitle | null;
  visible: boolean;
  onClose: () => void;
};

const SYNOPSIS_PREVIEW_LIMIT = 280;

export function TitleDetailsModal({ title, visible, onClose }: Props) {
  const [duration, setDuration] = useState(() => (title ? getCachedTitleDuration(title) : ''));
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
    if (!title) return;
    let active = true;
    setDuration(getCachedTitleDuration(title));
    void fetchTitleDuration(title).then((resolved) => {
      if (active) setDuration(resolved);
    });
    return () => {
      active = false;
    };
  }, [title]);

  if (!title) return null;
  const hasArtwork = getArtworkUri(title.id, 'backdrop', {
    posterPath: title.tmdbPosterPath,
    backdropPath: title.tmdbBackdropPath,
  }) !== null;
  const metacritic = getMetacriticScore(title);
  const isLongSynopsis = title.synopsis.length > SYNOPSIS_PREVIEW_LIMIT;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fechar detalhes" />
        <View style={styles.dialog}>
          <View style={[styles.cover, { backgroundColor: title.color }]}>
            <TitleArtwork id={title.id} variant="backdrop" posterPath={title.tmdbPosterPath} backdropPath={title.tmdbBackdropPath} />
            {!hasArtwork && <View style={styles.coverGlow} />}
            <Pressable style={styles.closeButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar">
              <MaterialIcons name="close" size={22} color="#fff" />
            </Pressable>
            {!hasArtwork && <MaterialIcons name={title.icon} size={66} color="rgba(255,255,255,0.9)" />}
            {!hasArtwork && <AppText tipo="legenda" peso="forte" style={styles.coverTitle}>{title.title.toUpperCase()}</AppText>}
          </View>

          <ScrollView
            style={styles.detailsScroll}
            contentContainerStyle={styles.detailsContent}
            scrollEnabled={isLongSynopsis && expanded}
            showsVerticalScrollIndicator={false}>
            <AppText tipo="legenda" peso="forte" style={styles.eyebrow}>SORTEADO PARA VOCÊ</AppText>
            <AppText tipo="titulo" peso="forte" style={styles.title}>{title.title}</AppText>
            <AppText tipo="legenda" style={styles.meta}>{title.year}  ·  {title.kind}  ·  {duration}</AppText>

            <View style={styles.ratingRow}>
              <View style={styles.ratingBadge}>
                <MaterialIcons name="star" size={16} color="#f3b43f" />
                <AppText peso="forte" style={styles.rating}>{title.imdbRating}</AppText>
                <AppText peso="forte" style={styles.ratingTag}>{title.ratingSource ?? 'IMDb'}</AppText>
              </View>
              {metacritic !== null && (
                <View style={[styles.metacriticBadge, metacritic >= 61 ? styles.mcGreen : metacritic >= 40 ? styles.mcYellow : styles.mcRed]}>
                  <AppText peso="forte" style={styles.metacriticScore}>{metacritic}</AppText>
                  <AppText peso="forte" style={styles.metacriticLabel}>MC</AppText>
                </View>
              )}
              <View style={styles.providerBadge}>
                {getTitleServices(title).map((serviceName) => (
                  <ServiceLogo key={serviceName} name={serviceName} size={38} />
                ))}
              </View>
            </View>

            <AppText peso="medio" style={styles.genres}>{title.genres.join('  ·  ')}</AppText>

            <AppText tipo="subtitulo" peso="forte" style={styles.sectionTitle}>Sinopse</AppText>
            <AppText
              tipo="texto"
              style={[styles.synopsis, isLongSynopsis && styles.synopsisWithToggle]}
              numberOfLines={isLongSynopsis && !expanded ? 4 : undefined}>
              {title.synopsis}
            </AppText>
            {isLongSynopsis && (
              <Pressable
                style={styles.expandButton}
                onPress={() => setExpanded((prev) => !prev)}
                accessibilityRole="button">
                <AppText tipo="legenda" peso="forte" style={styles.expandButtonText}>
                  {expanded ? 'Mostrar menos' : 'Mostrar mais'}
                </AppText>
                <MaterialIcons
                  name={expanded ? 'expand-less' : 'expand-more'}
                  size={18}
                  color="#d77c29"
                />
              </Pressable>
            )}
            <Pressable style={styles.doneButton} onPress={onClose} accessibilityRole="button">
              <AppText peso="forte" style={styles.doneButtonText}>Boa escolha</AppText>
              <MaterialIcons name="check" size={19} color="#182230" />
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, padding: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(9, 15, 23, 0.78)' },
  dialog: { width: '100%', maxWidth: 460, maxHeight: '94%', overflow: 'hidden', borderRadius: 24, backgroundColor: '#fffdf8' },
  cover: { height: 175, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  coverGlow: { position: 'absolute', width: 260, height: 260, borderRadius: 130, right: -55, top: -115, backgroundColor: 'rgba(255,255,255,0.16)' },
  closeButton: { position: 'absolute', top: 12, right: 12, zIndex: 2, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,20,28,0.42)' },
  coverTitle: { maxWidth: '78%', marginTop: 10, color: '#fff', textAlign: 'center', letterSpacing: 1.5 },
  detailsScroll: { flexShrink: 1 },
  detailsContent: { padding: 18, paddingBottom: 20 },
  eyebrow: { color: '#d77c29', letterSpacing: 1.3, marginBottom: 4 },
  title: { color: '#182230', fontSize: 24, lineHeight: 28, marginBottom: 4 },
  meta: { color: '#7b7b78' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, marginBottom: 12 },
  ratingBadge: { height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 10, borderRadius: 11, backgroundColor: '#182230' },
  rating: { color: '#fffdf8', fontSize: 15, lineHeight: 18 },
  ratingTag: { color: '#f3b43f', fontSize: 10, lineHeight: 13, letterSpacing: 0.4 },
  metacriticBadge: { height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 10, borderRadius: 11 },
  mcGreen: { backgroundColor: '#2e8b57' },
  mcYellow: { backgroundColor: '#d49b27' },
  mcRed: { backgroundColor: '#c0392b' },
  metacriticScore: { color: '#fffdf8', fontSize: 15, lineHeight: 18 },
  metacriticLabel: { color: 'rgba(255,253,248,0.9)', fontSize: 10, lineHeight: 13, letterSpacing: 0.4 },
  providerBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 'auto' },
  genres: { color: '#8d7a61', fontSize: 13, lineHeight: 18, letterSpacing: 0.2, marginBottom: 14 },
  sectionTitle: { color: '#182230', fontSize: 17, lineHeight: 22, marginBottom: 5 },
  synopsis: { color: '#687078', lineHeight: 21, marginBottom: 18 },
  synopsisWithToggle: { marginBottom: 4 },
  expandButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 3, marginBottom: 14 },
  expandButtonText: { color: '#d77c29', fontSize: 13 },
  doneButton: { minHeight: 48, borderRadius: 14, backgroundColor: '#f3b43f', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  doneButtonText: { color: '#182230' },
});