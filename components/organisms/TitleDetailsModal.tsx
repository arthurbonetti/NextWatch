import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/atoms/AppText';
import { ServiceLogo } from '@/components/atoms/ServiceLogo';
import { getArtworkUri, TitleArtwork } from '@/components/atoms/TitleArtwork';
import { MediaTitle } from '@/constants/catalog';

type Props = {
  title: MediaTitle | null;
  visible: boolean;
  onClose: () => void;
};

export function TitleDetailsModal({ title, visible, onClose }: Props) {
  if (!title) return null;
  const hasArtwork = getArtworkUri(title.id, 'backdrop') !== null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fechar detalhes" />
        <View style={styles.dialog}>
          <View style={[styles.cover, { backgroundColor: title.color }]}>
            <TitleArtwork id={title.id} variant="backdrop" />
            {!hasArtwork && <View style={styles.coverGlow} />}
            <Pressable style={styles.closeButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar">
              <MaterialIcons name="close" size={22} color="#fff" />
            </Pressable>
            {!hasArtwork && <MaterialIcons name={title.icon} size={66} color="rgba(255,255,255,0.9)" />}
            {!hasArtwork && <AppText tipo="legenda" peso="forte" style={styles.coverTitle}>{title.title.toUpperCase()}</AppText>}
          </View>

          <ScrollView style={styles.detailsScroll} contentContainerStyle={styles.detailsContent} showsVerticalScrollIndicator={false}>
            <AppText tipo="legenda" peso="forte" style={styles.eyebrow}>SORTEADO PARA VOCÊ</AppText>
            <AppText tipo="titulo" peso="forte" style={styles.title}>{title.title}</AppText>
            <AppText tipo="legenda" style={styles.meta}>{title.year}  ·  {title.kind}  ·  {title.duration}</AppText>

            <View style={styles.ratingRow}>
              <View style={styles.ratingBadge}>
                <MaterialIcons name="star" size={21} color="#f3b43f" />
                <AppText tipo="subtitulo" peso="forte" style={styles.rating}>{title.imdbRating}</AppText>
              </View>
              <View>
                <AppText tipo="legenda" peso="forte" style={styles.ratingLabel}>IMDb</AppText>
                <AppText tipo="legenda" style={styles.ratingCaption}>avaliação da comunidade</AppText>
              </View>
              <View style={styles.providerBadge}>
                <ServiceLogo name={title.service} size={20} />
                <AppText tipo="legenda" peso="forte" style={styles.provider}>{title.service}</AppText>
              </View>
            </View>

            <AppText peso="medio" style={styles.genres}>{title.genres.join('  ·  ')}</AppText>

            <AppText tipo="subtitulo" peso="forte" style={styles.sectionTitle}>Sinopse</AppText>
            <AppText tipo="texto" style={styles.synopsis}>{title.synopsis}</AppText>
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
  backdrop: { flex: 1, padding: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(9, 15, 23, 0.78)' },
  dialog: { width: '100%', maxWidth: 460, maxHeight: '94%', overflow: 'hidden', borderRadius: 26, backgroundColor: '#fffdf8' },
  cover: { height: 190, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  coverGlow: { position: 'absolute', width: 260, height: 260, borderRadius: 130, right: -55, top: -115, backgroundColor: 'rgba(255,255,255,0.16)' },
  closeButton: { position: 'absolute', top: 14, right: 14, zIndex: 2, width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,20,28,0.42)' },
  coverTitle: { maxWidth: '78%', marginTop: 10, color: '#fff', textAlign: 'center', letterSpacing: 1.5, textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 8 },
  detailsScroll: { flexShrink: 1 },
  detailsContent: { padding: 22, paddingBottom: 24 },
  eyebrow: { color: '#d77c29', letterSpacing: 1.3, marginBottom: 5 },
  title: { color: '#182230', fontSize: 25, lineHeight: 30, marginBottom: 5 },
  meta: { color: '#7b7b78' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18, marginBottom: 16 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 9, borderRadius: 12, backgroundColor: '#182230', marginRight: 9 },
  rating: { color: '#fffdf8', fontSize: 17, lineHeight: 21 },
  ratingLabel: { color: '#182230' },
  ratingCaption: { color: '#8b8a84', fontSize: 10 },
  providerBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 'auto', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12, backgroundColor: '#f1e8d7' },
  provider: { color: '#182230' },
  genres: { color: '#8d7a61', fontSize: 13, lineHeight: 18, letterSpacing: 0.2, marginBottom: 20 },
  sectionTitle: { color: '#182230', fontSize: 17, lineHeight: 22, marginBottom: 6 },
  synopsis: { color: '#687078', lineHeight: 21, marginBottom: 20 },
  doneButton: { minHeight: 50, borderRadius: 14, backgroundColor: '#f3b43f', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  doneButtonText: { color: '#182230' },
});