import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/atoms/AppText';
import { BookmarkIcon } from '@/components/atoms/BookmarkIcon';
import { TitleArtwork } from '@/components/atoms/TitleArtwork';
import { TitleDetailsBody } from '@/components/organisms/TitleDetailsBody';
import { MediaTitle } from '@/constants/catalog';
import { useMyList } from '@/contexts/MyListContext';

type Props = {
  title: MediaTitle | null;
  visible: boolean;
  eyebrow?: string;
  onClose: () => void;
  onWatch?: () => void;
  onSaveChange?: (saved: boolean) => void;
  onDrawAnother?: () => void;
};

export function TitleDetailsModal({
  title,
  visible,
  eyebrow = 'SORTEADO PARA VOCÊ',
  onClose,
  onWatch,
  onSaveChange,
  onDrawAnother,
}: Props) {
  const [scrollEnabled, setScrollEnabled] = useState(false);
  const { isSaved, toggleSavedTitle } = useMyList();

  if (!title) return null;
  const saved = isSaved(title.id);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fechar detalhes" />
        <View style={styles.dialog}>
          <View style={[styles.cover, { backgroundColor: title.color }]}>
            <TitleArtwork
              id={title.id}
              variant="backdrop"
              posterPath={title.tmdbPosterPath}
              backdropPath={title.tmdbBackdropPath}
              fallback={
                <>
                  <View style={styles.coverGlow} />
                  <MaterialIcons name={title.icon} size={66} color="rgba(255,255,255,0.9)" />
                  <AppText tipo="legenda" peso="forte" style={styles.coverTitle}>{title.title.toUpperCase()}</AppText>
                </>
              }
            />
            <Pressable
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Fechar">
              <MaterialIcons name="close" size={22} color="#fff" />
            </Pressable>
          </View>

          <ScrollView
            style={styles.detailsScroll}
            contentContainerStyle={styles.detailsContent}
            scrollEnabled={scrollEnabled}
            showsVerticalScrollIndicator={false}>
            <TitleDetailsBody title={title} eyebrow={eyebrow} onScrollEnabledChange={setScrollEnabled} />
            <View style={styles.actionsRow}>
              <Pressable
                style={({ pressed }) => [styles.saveButton, saved && styles.saveButtonActive, pressed && styles.pressed]}
                onPress={() => {
                  const nextSaved = !saved;
                  toggleSavedTitle(title);
                  onSaveChange?.(nextSaved);
                }}
                accessibilityRole="button"
                accessibilityLabel={saved ? 'Remover da minha lista' : 'Salvar na minha lista'}>
                <BookmarkIcon
                  saved={saved}
                  itemKey={title.id}
                  size={22}
                  color="#f3b43f"
                  inactiveColor="#182230"
                  badgeBorderColor="#182230"
                />
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}
                onPress={onWatch ?? onClose}
                accessibilityRole="button">
                <AppText peso="forte" style={styles.doneButtonText}>Assistir este título</AppText>
                <MaterialIcons name="check" size={19} color="#182230" />
              </Pressable>
            </View>
            {onDrawAnother && (
              <Pressable
                style={({ pressed }) => [styles.redrawButton, pressed && styles.pressed]}
                onPress={onDrawAnother}
                accessibilityRole="button">
                <MaterialIcons name="casino" size={17} color="#a3520d" />
                <AppText tipo="legenda" peso="forte" style={styles.redrawText}>Sortear outro</AppText>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, padding: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(9, 15, 23, 0.78)' },
  dialog: { width: '100%', maxWidth: 460, maxHeight: '94%', overflow: 'hidden', borderRadius: 24, borderWidth: 1, borderColor: '#e8e2d5', backgroundColor: '#fffdf8' },
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  cover: { height: 175, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  coverGlow: { position: 'absolute', width: 260, height: 260, borderRadius: 130, right: -55, top: -115, backgroundColor: 'rgba(255,255,255,0.16)' },
  closeButton: { position: 'absolute', top: 12, right: 12, zIndex: 2, width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,20,28,0.48)' },
  coverTitle: { maxWidth: '78%', marginTop: 10, color: '#fff', textAlign: 'center', letterSpacing: 1.5 },
  detailsScroll: { flexShrink: 1 },
  detailsContent: { padding: 18, paddingBottom: 20 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  saveButton: { width: 50, height: 50, borderRadius: 14, borderWidth: 1, borderColor: '#e8e2d5', backgroundColor: '#f1eee7', alignItems: 'center', justifyContent: 'center' },
  saveButtonActive: { borderColor: '#182230', backgroundColor: '#182230' },
  doneButton: { flex: 1, minHeight: 50, borderRadius: 14, backgroundColor: '#f3b43f', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  doneButtonText: { color: '#182230' },
  redrawButton: { minHeight: 38, marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  redrawText: { color: '#a3520d', fontSize: 14 },
});