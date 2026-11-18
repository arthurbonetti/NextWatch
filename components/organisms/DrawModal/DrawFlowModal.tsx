import { useCallback, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { AnimatedModalShell } from '@/components/atoms/AnimatedModalShell';
import { ConfirmDialog } from '@/components/organisms/ConfirmDialog';
import { DrawFiltersPhase } from '@/components/organisms/DrawModal/DrawFiltersPhase';
import { DrawResultPhase } from '@/components/organisms/DrawModal/DrawResultPhase';
import { DrawRoulettePhase } from '@/components/organisms/DrawModal/DrawRoulettePhase';
import { MediaTitle } from '@/constants/catalog';
import { Subscription } from '@/constants/subscriptions';
import { DrawAction, useDrawHistory } from '@/contexts/DrawHistoryContext';
import { DrawFiltersState, DrawKindFilter } from '@/hooks/usePersistedDrawFilters';
import { fetchTitleDuration, fetchTitleTrailerUrl } from '@/services/tmdb';
import { quickSortByRandom } from '@/utils/quickSort';

export type DrawPhase = 'filtros' | 'sorteando' | 'resultado';

type SpinSession = {
  winner: MediaTitle;
  candidates: MediaTitle[];
  eligibleCount: number;
  spinKey: number;
};

type DrawFlowModalProps = {
  visible: boolean;
  onClose: () => void;
  activeSubscriptions: Subscription[];
  availableGenres: string[];
  hasAnyAvailableTitle: boolean;
  eligibleTitles: MediaTitle[];
  watchedCount: number;
  isFetchingCatalog: boolean;
  filters: DrawFiltersState;
  enabledServices: string[];
  onSelectKind: (kind: DrawKindFilter) => void;
  onToggleGenre: (genre: string) => void;
  onClearGenres: () => void;
  onToggleService: (provider: string) => void;
  onToggleHideWatched: (nextValue: boolean) => void;
  onResetFilters: () => void;
};

/**
 * Modal único e contínuo que orquestra as 3 fases do sorteio:
 * 'filtros' (bottom sheet com snap points) -> 'sorteando' (roleta) -> 'resultado',
 * compartilhando o container global AnimatedModalShell.
 */
export function DrawFlowModal({
  visible,
  onClose,
  activeSubscriptions,
  availableGenres,
  hasAnyAvailableTitle,
  eligibleTitles,
  watchedCount,
  isFetchingCatalog,
  filters,
  enabledServices,
  onSelectKind,
  onToggleGenre,
  onClearGenres,
  onToggleService,
  onToggleHideWatched,
  onResetFilters,
}: DrawFlowModalProps) {
  const reducedMotion = useReducedMotion();
  const { height: windowHeight } = useWindowDimensions();
  const { recordDrawAction, updateDrawAction } = useDrawHistory();

  const [phase, setPhase] = useState<DrawPhase>('filtros');
  const [expandedSheet, setExpandedSheet] = useState(false);
  const [incompleteConfirmVisible, setIncompleteConfirmVisible] = useState(false);
  const [lastDrawnId, setLastDrawnId] = useState<string | null>(null);
  const [spinSession, setSpinSession] = useState<SpinSession | null>(null);

  const drawEntryPromiseRef = useRef<Promise<string | null> | null>(null);
  const drawHandledRef = useRef(false);

  const defaultSheetHeight = Math.min(Math.round(windowHeight * 0.78), 660);
  const expandedSheetHeight = Math.min(Math.round(windowHeight * 0.92), 780);
  const activeSheetMaxHeight = expandedSheet ? expandedSheetHeight : defaultSheetHeight;

  const commitDrawAction = useCallback(
    (title: MediaTitle, action: DrawAction) => {
      drawHandledRef.current = true;
      const existingPromise = drawEntryPromiseRef.current;
      if (!existingPromise) {
        drawEntryPromiseRef.current = recordDrawAction(title, action);
        return;
      }
      void existingPromise.then((entryId) => {
        if (entryId) void updateDrawAction(entryId, action);
      });
    },
    [recordDrawAction, updateDrawAction],
  );

  const dismissFromSheet = useCallback(() => {
    setIncompleteConfirmVisible(false);
    setPhase('filtros');
    setExpandedSheet(false);
    setSpinSession(null);
    onClose();
  }, [onClose]);

  const handleClose = useCallback(() => {
    if (phase === 'resultado' && spinSession?.winner && !drawHandledRef.current) {
      drawHandledRef.current = true;
      void recordDrawAction(spinSession.winner, 'ignorou');
    }
    drawEntryPromiseRef.current = null;
    drawHandledRef.current = false;
    dismissFromSheet();
  }, [dismissFromSheet, phase, recordDrawAction, spinSession]);

  const startDraw = useCallback(() => {
    if (eligibleTitles.length === 0) return;

    const candidates =
      eligibleTitles.length > 1
        ? eligibleTitles.filter((title) => title.id !== lastDrawnId)
        : eligibleTitles;
    const winner = quickSortByRandom(candidates)[0];
    if (!winner) return;

    void fetchTitleDuration(winner);
    void fetchTitleTrailerUrl(winner);

    drawEntryPromiseRef.current = null;
    drawHandledRef.current = false;
    setLastDrawnId(winner.id);
    setSpinSession((prev) => ({
      winner,
      candidates: eligibleTitles,
      eligibleCount: eligibleTitles.length,
      spinKey: (prev?.spinKey ?? 0) + 1,
    }));

    if (reducedMotion) {
      setPhase('resultado');
    } else {
      setPhase('sorteando');
    }
  }, [eligibleTitles, lastDrawnId, reducedMotion]);

  const handleDrawPress = useCallback(() => {
    if (eligibleTitles.length === 0) return;
    if (isFetchingCatalog) {
      setIncompleteConfirmVisible(true);
      return;
    }
    startDraw();
  }, [eligibleTitles.length, isFetchingCatalog, startDraw]);

  const handleRouletteDone = useCallback(() => {
    setPhase('resultado');
  }, []);

  const handleDrawAnother = useCallback(() => {
    if (spinSession?.winner && !drawHandledRef.current) {
      drawHandledRef.current = true;
      void recordDrawAction(spinSession.winner, 'sorteou outro');
    }
    startDraw();
  }, [recordDrawAction, spinSession, startDraw]);

  const handleRequestClose = useCallback(() => {
    if (incompleteConfirmVisible) {
      setIncompleteConfirmVisible(false);
      return;
    }
    if (phase === 'sorteando') {
      handleRouletteDone();
      return;
    }
    handleClose();
  }, [handleClose, handleRouletteDone, incompleteConfirmVisible, phase]);

  return (
    <AnimatedModalShell
      visible={visible}
      variant={phase === 'filtros' ? 'sheet' : 'center'}
      onClose={handleClose}
      onSheetDismiss={dismissFromSheet}
      onRequestClose={handleRequestClose}
      maxWidth={phase === 'filtros' ? 640 : 440}
      maxHeight={phase === 'filtros' ? activeSheetMaxHeight : Math.round(windowHeight * 0.9)}
      backdropDismissible={phase !== 'sorteando'}
      backdropAccessibilityLabel="Fechar modal de sorteio"
      enableSheetDrag={phase === 'filtros'}
      isExpanded={expandedSheet}
      onSwipeExpandChange={setExpandedSheet}
      onToggleExpand={() => setExpandedSheet((prev) => !prev)}
      handleAccessibilityLabel={
        expandedSheet ? 'Reduzir painel de filtros' : 'Expandir painel de filtros'
      }
      layoutAnimated
      overlayChildren={
        <ConfirmDialog
          visible={incompleteConfirmVisible}
          inline
          tone="warning"
          icon="hourglass-top"
          eyebrow="CATÁLOGO EM CARREGAMENTO"
          title="Títulos ainda carregando"
          message="Nem todos os títulos foram carregados ainda. Deseja sortear apenas com os disponíveis?"
          confirmLabel="Sortear mesmo assim"
          confirmIcon="auto-awesome"
          cancelAccessibilityLabel="Fechar aviso de carregamento"
          onConfirm={() => {
            setIncompleteConfirmVisible(false);
            startDraw();
          }}
          onCancel={() => setIncompleteConfirmVisible(false)}
        />
      }>
      {phase === 'filtros' && (
        <Animated.View
          key="phase-filtros"
          entering={reducedMotion ? undefined : FadeIn.duration(130)}
          exiting={reducedMotion ? undefined : FadeOut.duration(80)}
          style={styles.phaseInner}>
          <DrawFiltersPhase
            activeSubscriptions={activeSubscriptions}
            availableGenres={availableGenres}
            hasAnyAvailableTitle={hasAnyAvailableTitle}
            eligibleCount={eligibleTitles.length}
            watchedCount={watchedCount}
            filters={filters}
            enabledServices={enabledServices}
            onSelectKind={onSelectKind}
            onToggleGenre={onToggleGenre}
            onClearGenres={onClearGenres}
            onToggleService={onToggleService}
            onToggleHideWatched={onToggleHideWatched}
            onResetFilters={onResetFilters}
            onDraw={handleDrawPress}
            onClose={handleClose}
          />
        </Animated.View>
      )}

      {phase === 'sorteando' && spinSession && (
        <Animated.View
          key={`phase-sorteando-${spinSession.spinKey}`}
          entering={reducedMotion ? undefined : FadeIn.duration(130)}
          exiting={reducedMotion ? undefined : FadeOut.duration(80)}>
          <DrawRoulettePhase
            winner={spinSession.winner}
            candidates={spinSession.candidates}
            eligibleCount={spinSession.eligibleCount}
            spinKey={spinSession.spinKey}
            onFinish={handleRouletteDone}
            onSkip={handleRouletteDone}
          />
        </Animated.View>
      )}

      {phase === 'resultado' && spinSession && (
        <Animated.View
          key={`phase-resultado-${spinSession.winner.id}-${spinSession.spinKey}`}
          entering={reducedMotion ? undefined : FadeIn.duration(140)}
          style={styles.resultInner}>
          <DrawResultPhase
            title={spinSession.winner}
            activeSubscriptions={activeSubscriptions}
            enabledServices={enabledServices}
            canDrawAnother={eligibleTitles.length > 1}
            onClose={handleClose}
            onWatch={() => {
              commitDrawAction(spinSession.winner, 'assistiu');
              handleClose();
            }}
            onMarkWatched={() => {
              commitDrawAction(spinSession.winner, 'assistiu');
            }}
            onSaveChange={(nextSaved) => {
              if (nextSaved) {
                commitDrawAction(spinSession.winner, 'salvou');
              }
            }}
            onDrawAnother={handleDrawAnother}
          />
        </Animated.View>
      )}
    </AnimatedModalShell>
  );
}

const styles = StyleSheet.create({
  phaseInner: {
    flexShrink: 1,
  },
  resultInner: {
    maxHeight: '100%',
  },
});
