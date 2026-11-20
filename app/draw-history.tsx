import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/atoms/AppText';
import { BackButton } from '@/components/atoms/BackButton';
import { FadeInBlock } from '@/components/atoms/FadeInBlock';
import { ConfirmDialog } from '@/components/organisms/ConfirmDialog';
import { DrawHistoryCard } from '@/components/organisms/DrawHistoryCard';
import { EmptyStateCard } from '@/components/organisms/EmptyStateCard';
import { useAuth } from '@/contexts/AuthContext';
import { DrawAction, useDrawHistory } from '@/hooks/useDrawHistory';
import { useMyList } from '@/hooks/useMyList';
import { formatCount } from '@/utils/format';

type HistoryFilter = 'all' | DrawAction;

export default function DrawHistoryScreen() {
  const { user, authReady } = useAuth();
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <FadeInBlock delay={0}>
          <View style={styles.header}>
            <BackButton fallbackHref="/(tabs)/tab3" />
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
                  {formatCount(history.length)} {history.length === 1 ? 'sorteio registrado' : 'sorteios registrados'}
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
        </FadeInBlock>

        {filteredHistory.length > 0 ? (
          <View style={styles.list}>
            {filteredHistory.map((entry, index) => {
              const resolved = findSavedTitle(entry.tmdbId);
              return (
                <FadeInBlock key={entry.id} delay={Math.min(index + 1, 7) * 30}>
                  <DrawHistoryCard
                    entry={entry}
                    resolvedTitle={resolved}
                    onPress={() => router.push({ pathname: '/title/[id]', params: { id: entry.tmdbId } })}
                  />
                </FadeInBlock>
              );
            })}
          </View>
        ) : storageReady ? (
          <FadeInBlock delay={40}>
            <EmptyStateCard
              icon="casino"
              title={history.length === 0 ? 'Nenhum sorteio registrado' : 'Nada com esse filtro'}
              description={
                history.length === 0
                  ? 'Gire a Roleta na tela inicial para registrar os títulos que você assistiu, salvou ou pulou.'
                  : 'Escolha outro filtro acima para ver os demais registros.'
              }
              actionLabel={history.length === 0 ? 'Ir para a Roleta' : undefined}
              actionIcon={history.length === 0 ? 'casino' : undefined}
              onAction={history.length === 0 ? () => router.replace('/(tabs)') : undefined}
            />
          </FadeInBlock>
        ) : null}
      </ScrollView>

      <ConfirmDialog
        visible={clearConfirmOpen}
        icon="delete-outline"
        eyebrow="HISTÓRICO DE SORTEIOS"
        title="Limpar histórico?"
        message="Todos os registros de sorteios serão removidos da sua conta."
        confirmLabel="Sim, limpar histórico"
        cancelAccessibilityLabel="Cancelar limpeza"
        onConfirm={() => {
          setClearConfirmOpen(false);
          void clearDrawHistory();
        }}
        onCancel={() => setClearConfirmOpen(false)}
      />
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
});
