import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/atoms/AppText';
import { getArtworkUri, TitleArtwork } from '@/components/atoms/TitleArtwork';
import { TitleDetailsBody } from '@/components/organisms/TitleDetailsBody';
import { MediaTitle } from '@/constants/catalog';

type Props = {
  title: MediaTitle | null;
  visible: boolean;
  onClose: () => void;
};

export function TitleDetailsModal({ title, visible, onClose }: Props) {
  const [scrollEnabled, setScrollEnabled] = useState(false);

  if (!title) return null;
  const hasArtwork = getArtworkUri(title.id, 'backdrop', {
    posterPath: title.tmdbPosterPath,
    backdropPath: title.tmdbBackdropPath,
  }) !== null;

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
            scrollEnabled={scrollEnabled}
            showsVerticalScrollIndicator={true}>
            <TitleDetailsBody title={title} eyebrow="SORTEADO PARA VOCÊ" onScrollEnabledChange={setScrollEnabled} />
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
  doneButton: { minHeight: 48, borderRadius: 14, backgroundColor: '#f3b43f', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  doneButtonText: { color: '#182230' },
});