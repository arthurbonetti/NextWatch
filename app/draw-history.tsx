import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/atoms/AppText';
import { BackButton } from '@/components/atoms/BackButton';
import { DrawHistoryCard } from '@/components/organisms/DrawHistoryCard';
import { useAuth } from '@/contexts/AuthContext';
import { useCatalog } from '@/contexts/CatalogContext';
import { DrawAction, useDrawHistory } from '@/contexts/DrawHistoryContext';
import { useMyList } from '@/contexts/MyListContext';

type HistoryFilter = 'all' | DrawAction;

const countFormat = new Intl.NumberFormat('pt-BR');

export default function DrawHistoryScreen() {
  const { user, authReady } = useAuth();
  const { findTitle } = useCatalog();
  const { findSavedTitle } = useMyList();
  const { history, storageReady, clearDrawHistory, refreshDrawHistory } = useDrawHistory();
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refreshDrawHistory();
    }, [refreshDrawHistory]),
  );

  const counts = useMemo(() => {
    const byAction: Record<DrawAction, number> = {
      assistiu: 0,
      salvou: 0,
      'sorteou outro': 0,
      ignorou: 0,
    };
    for (const entry of history) {
      byAction[entry.acao] += 1;
    }
    return byAction;
  }, [history]);

  const filteredHistory = useMemo(
    () => (filter === 'all' ? history : history.filter((entry) => entry.acao === filter)),
    [filter, history],
  );

  if (!authReady) return null;
  if (!user) return <Redirect href="/(auth)/login" />;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/tab3');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <BackButton onPress={handleBack} />
          <View style={styles.headerCopy}>
            <AppText tipo="legenda" peso="forte" style={styles.eyebrow}>HISTÓRICO</AppText>
            <AppText tipo="titulo" peso="forte" style={styles.title}>Sorteios</AppText>
          </View>
          {history.length > 0 && (
            <Pressable
              style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
              onPress={() => setClearConfirmOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Limpar histórico de sorteios">
              <AppText tipo="legenda" peso="forte" style={styles.clearButtonText}>Limpar</AppText>
            </Pressable>
          )}
        </View>

        {history.length > 0 && (
          <>
            <View style={styles.summaryRow}>
              <AppText tipo="legenda" tabular style={styles.summaryText}>
                {countFormat.format(history.length)} {history.length === 1 ? 'sorteio registrado' : 'sorteios registrados'}
              </AppText>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {(
                [
                  { id: 'all', label: `Todos (${history.length})` },
                  { id: 'assistiu', label: `Assistidos (${counts.assistiu})` },
                  { id: 'salvou', label: `Salvos (${counts.salvou})` },
                  { id: 'sorteou outro', label: `Sorteou outro (${counts['sorteou outro']})` },
                  { id: 'ignorou', label: `Ignorou (${counts.ignorou})` },
                ] as const
              ).map((chip) => {
                const selected = filter === chip.id;
                return (
                  <Pressable
                    key={chip.id}
                    onPress={() => setFilter(chip.id)}
                    style={({ pressed }) => [
                      styles.filterChip,
                      selected && styles.filterChipActive,
                      pressed && styles.pressed,
                    ]}>
                    <AppText tipo="legenda" peso="forte" style={selected ? styles.filterChipTextActive : styles.filterChipText}>
                      {chip.label}
                    </AppText>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        )}

        {filteredHistory.length > 0 ? (
          <View style={styles.list}>
            {filteredHistory.map((entry) => {
              const resolved = findTitle(entry.tmdbId) ?? findSavedTitle(entry.tmdbId);
              return (
                <DrawHistoryCard
                  key={entry.id}
                  entry={entry}
                  resolvedTitle={resolved}
                  onPress={resolved ? () => router.push({ pathname: '/title/[id]', params: { id: resolved.id } }) : undefined}
                />
              );
            })}
          </View>
        ) : storageReady ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="casino" size={26} color="#a3520d" />
            </View>
            <AppText tipo="subtitulo" peso="forte" style={styles.emptyTitle}>
              {history.length === 0 ? 'Nenhum sorteio registrado' : 'Nada com esse filtro'}
            </AppText>
            <AppText tipo="legenda" style={styles.emptyDescription}>
              {history.length === 0
                ? 'Gire a Roleta na tela inicial para registrar os títulos que você assistiu, salvou ou pulou.'
                : 'Escolha outro filtro acima para ver os demais registros.'}
            </AppText>
            {history.length === 0 && (
              <Pressable
                style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}
                onPress={() => router.replace('/(tabs)')}
                accessibilityRole="button">
                <MaterialIcons name="casino" size={18} color="#182230" />
                <AppText peso="forte" style={styles.emptyButtonText}>Ir para a Roleta</AppText>
              </Pressable>
            )}
          </View>
        ) : null}
      </ScrollView>

      <Modal
        visible={clearConfirmOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setClearConfirmOpen(false)}
        statusBarTranslucent>
        <View style={styles.confirmBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setClearConfirmOpen(false)} accessibilityLabel="Cancelar limpeza" />
          <View style={styles.confirmCard}>
            <View style={styles.confirmIconBadge}>
              <MaterialIcons name="delete-outline" size={24} color="#c0392b" />
            </View>
            <AppText tipo="legenda" peso="forte" style={styles.confirmEyebrow}>HISTÓRICO DE SORTEIOS</AppText>
            <AppText tipo="subtitulo" familia="editorial" peso="forte" style={styles.confirmTitle}>
              Limpar histórico?
            </AppText>
            <AppText tipo="legenda" style={styles.confirmMessage}>
              Todos os registros de sorteios serão removidos da sua conta.
            </AppText>
            <View style={styles.confirmActions}>
              <Pressable
                style={({ pressed }) => [styles.confirmDeleteButton, pressed && styles.pressed]}
                onPress={() => {
                  setClearConfirmOpen(false);
                  void clearDrawHistory();
                }}
                accessibilityRole="button">
                <AppText peso="forte" style={styles.confirmDeleteText}>Sim, limpar histórico</AppText>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.confirmCancelButton, pressed && styles.pressed]}
                onPress={() => setClearConfirmOpen(false)}
                accessibilityRole="button">
                <AppText peso="forte" style={styles.confirmCancelText}>Cancelar</AppText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f5f0' },
  container: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  headerCopy: { flex: 1 },
  eyebrow: { color: '#e58c34', letterSpacing: 1.5, marginBottom: 3 },
  title: { color: '#182230', fontSize: 25, lineHeight: 30, letterSpacing: -0.4 },
  clearButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#e8e2d5', backgroundColor: '#fffdf8' },
  clearButtonText: { color: '#a3520d', fontSize: 13 },
  summaryRow: { marginBottom: 10 },
  summaryText: { color: '#5e5c57', fontSize: 13 },
  filterRow: { flexDirection: 'row', gap: 7, paddingBottom: 16 },
  filterChip: { borderWidth: 1, borderColor: '#ded8cd', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#fffdf8' },
  filterChipActive: { borderColor: '#182230', backgroundColor: '#182230' },
  filterChipText: { color: '#5e5c57', fontSize: 12.5 },
  filterChipTextActive: { color: '#fffdf8', fontSize: 12.5 },
  list: { gap: 8 },
  emptyState: { alignItems: 'center', paddingHorizontal: 26, paddingVertical: 36, borderRadius: 18, borderWidth: 1, borderColor: '#e8e2d5', backgroundColor: '#fffdf8' },
  emptyIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#f1e8d7', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { color: '#182230', fontSize: 17, lineHeight: 22 },
  emptyDescription: { color: '#5e5c57', textAlign: 'center', fontSize: 13, lineHeight: 19, marginTop: 6 },
  emptyButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 13, paddingHorizontal: 18, paddingVertical: 11, backgroundColor: '#f3b43f', marginTop: 16 },
  emptyButtonText: { color: '#182230', fontSize: 13 },
  confirmBackdrop: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(9,15,23,0.72)' },
  confirmCard: { width: '100%', maxWidth: 360, alignItems: 'center', borderRadius: 24, paddingHorizontal: 22, paddingTop: 24, paddingBottom: 20, backgroundColor: '#fffdf8', borderWidth: 1, borderColor: '#e8e2d5' },
  confirmIconBadge: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#fdecea', borderWidth: 1, borderColor: '#f5c6c2', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  confirmEyebrow: { color: '#c0392b', letterSpacing: 1.3, textAlign: 'center', marginBottom: 6 },
  confirmTitle: { color: '#182230', fontSize: 21, lineHeight: 26, letterSpacing: -0.35, textAlign: 'center', marginBottom: 8 },
  confirmMessage: { color: '#5e5c57', fontSize: 13.5, lineHeight: 20, textAlign: 'center', marginBottom: 20 },
  confirmActions: { width: '100%', gap: 10 },
  confirmDeleteButton: { width: '100%', minHeight: 48, borderRadius: 14, backgroundColor: '#c0392b', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  confirmDeleteText: { color: '#fffdf8', fontSize: 14.5 },
  confirmCancelButton: { width: '100%', minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: '#ded8cd', backgroundColor: '#f7f5f0', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  confirmCancelText: { color: '#182230', fontSize: 14.5 },
});
