import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/atoms/AppText';
import { FadeInBlock } from '@/components/atoms/FadeInBlock';
import { ConfirmDialog } from '@/components/organisms/ConfirmDialog';
import { DrawHistoryCard } from '@/components/organisms/DrawHistoryCard';
import { EmptyStateCard } from '@/components/organisms/EmptyStateCard';
import { ScreenHeader } from '@/components/organisms/ScreenHeader';
import { Theme } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useThemedStyles } from '@/contexts/ThemeContext';
import { DrawAction, useDrawHistory } from '@/hooks/useDrawHistory';
import { useMyList } from '@/hooks/useMyList';
import { formatCount } from '@/utils/format';

type HistoryFilter = 'all' | DrawAction;

export default function DrawHistoryScreen() {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { user, authReady, isPasswordRecovery } = useAuth();
  const { findSavedTitle } = useMyList();
  const { history, storageReady, clearDrawHistory, refreshDrawHistory } = useDrawHistory();
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const isScrolled = event.nativeEvent.contentOffset.y > 6;
    setScrolled((prev) => (prev === isScrolled ? prev : isScrolled));
  }, []);

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
  if (isPasswordRecovery) return <Redirect href="/(auth)/reset-password" />;
  if (!user) return <Redirect href="/(auth)/login" />;

  const filterRowNode = history.length > 0 ? (
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
  ) : undefined;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader
        eyebrow="HISTÓRICO"
        title="Sorteios"
        showBack
        fallbackHref="/(tabs)/profile"
        scrolled={scrolled}
        rightSlot={
          history.length > 0 ? (
            <Pressable
              style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
              onPress={() => setClearConfirmOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Limpar histórico de sorteios">
              <AppText tipo="legenda" peso="forte" style={styles.clearButtonText}>Limpar</AppText>
            </Pressable>
          ) : undefined
        }
        bottomSlot={filterRowNode}
      />
      <ScrollView
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.container,
          { paddingBottom: Math.max(36, insets.bottom + 16) },
        ]}
        showsVerticalScrollIndicator={false}>
        {history.length > 0 && (
          <FadeInBlock delay={0}>
            <View style={styles.summaryRow}>
              <AppText tipo="legenda" tabular style={styles.summaryText}>
                {formatCount(history.length)} {history.length === 1 ? 'sorteio registrado' : 'sorteios registrados'}
              </AppText>
            </View>
          </FadeInBlock>
        )}

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

const createStyles = (theme: Theme) => ({
  safeArea: { flex: 1, backgroundColor: theme.colors.bgPrimary },
  container: { width: '100%' as const, maxWidth: 640, alignSelf: 'center' as const, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 36 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  clearButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.borderSubtle, backgroundColor: theme.colors.bgSurface },
  clearButtonText: { color: theme.colors.accentLink, fontSize: 13 },
  summaryRow: { marginBottom: 10 },
  summaryText: { color: theme.colors.textSecondary, fontSize: 13 },
  filterRow: { flexDirection: 'row' as const, gap: 7, paddingBottom: 2 },
  filterChip: { borderWidth: 1, borderColor: theme.colors.chipBorder, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: theme.colors.chipBg },
  filterChipActive: { borderColor: theme.colors.chipSelectedBorder, backgroundColor: theme.colors.chipSelectedBg },
  filterChipText: { color: theme.colors.chipText, fontSize: 12.5 },
  filterChipTextActive: { color: theme.colors.chipSelectedText, fontSize: 12.5 },
  list: { gap: 8 },
});
