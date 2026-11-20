import { useCallback, useState } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { AnimatedModalShell } from '@/components/atoms/AnimatedModalShell';
import { ConfirmDialog } from '@/components/organisms/ConfirmDialog';
import { DrawFiltersPhase } from '@/components/organisms/DrawModal/DrawFiltersPhase';
import { DrawResultPhase } from '@/components/organisms/DrawModal/DrawResultPhase';
import { DrawRoulettePhase } from '@/components/organisms/DrawModal/DrawRoulettePhase';
import { MediaTitle } from '@/constants/catalog';
import { Subscription } from '@/constants/subscriptions';
import { DrawFiltersState, DrawKindFilter } from '@/hooks/usePersistedDrawFilters';
import type { DrawPhase, SpinSession } from '@/hooks/useRouletteFlow';

export type { DrawPhase } from '@/hooks/useRouletteFlow';

type DrawFlowModalProps = {
  visible: boolean;
  phase: DrawPhase;
  spinSession: SpinSession | null;
  incompleteConfirmVisible: boolean;
  activeSubscriptions: Subscription[];
  availableGenres: string[];
  hasAnyAvailableTitle: boolean;
  eligibleTitles: MediaTitle[];
  watchedCount: number;
  filters: DrawFiltersState;
  enabledServices: string[];
  winnerDuration: string;
  winnerTrailerUrl: string | null;
  isWinnerSaved: boolean;
  onClose: () => void;
  onDismissFromSheet: () => void;
  onSelectKind: (kind: DrawKindFilter) => void;
  onToggleGenre: (genre: string) => void;
  onClearGenres: () => void;
  onToggleService: (provider: string) => void;
  onToggleHideWatched: (nextValue: boolean) => void;
  onResetFilters: () => void;
  onDrawPress: () => void;
  onConfirmIncompleteDraw: () => void;
  onCancelIncompleteDraw: () => void;
  onRouletteDone: () => void;
  onDrawAnother: () => void;
  onWatchWinner: () => void;
  onMarkWinnerWatched: () => void;
  onToggleWinnerSaved: () => void;
};

/**
 * Modal único e contínuo que apresenta as 3 fases do sorteio:
 * 'filtros' (bottom sheet com snap points) -> 'sorteando' (roleta) -> 'resultado',
 * compartilhando o container global AnimatedModalShell.
 */
export function DrawFlowModal({
  visible,
  phase,
  spinSession,
  incompleteConfirmVisible,
  activeSubscriptions,
  availableGenres,
  hasAnyAvailableTitle,
  eligibleTitles,
  watchedCount,
  filters,
  enabledServices,
  winnerDuration,
  winnerTrailerUrl,
  isWinnerSaved,
  onClose,
  onDismissFromSheet,
  onSelectKind,
  onToggleGenre,
  onClearGenres,
  onToggleService,
  onToggleHideWatched,
  onResetFilters,
  onDrawPress,
  onConfirmIncompleteDraw,
  onCancelIncompleteDraw,
  onRouletteDone,
  onDrawAnother,
  onWatchWinner,
  onMarkWinnerWatched,
  onToggleWinnerSaved,
}: DrawFlowModalProps) {
  const reducedMotion = useReducedMotion();
  const { height: windowHeight } = useWindowDimensions();
  const [expandedSheet, setExpandedSheet] = useState(false);

  if (!visible && expandedSheet) {
    setExpandedSheet(false);
  }

  const defaultSheetHeight = Math.min(Math.round(windowHeight * 0.78), 660);
  const expandedSheetHeight = Math.min(Math.round(windowHeight * 0.92), 780);
  const activeSheetMaxHeight = expandedSheet ? expandedSheetHeight : defaultSheetHeight;

  const handleSheetDismiss = useCallback(() => {
    setExpandedSheet(false);
    onDismissFromSheet();
  }, [onDismissFromSheet]);

  const handleClose = useCallback(() => {
    setExpandedSheet(false);
    onClose();
  }, [onClose]);

  const handleRequestClose = useCallback(() => {
    if (incompleteConfirmVisible) {
      onCancelIncompleteDraw();
      return;
    }
    if (phase === 'sorteando') {
      onRouletteDone();
      return;
    }
    handleClose();
  }, [handleClose, incompleteConfirmVisible, onCancelIncompleteDraw, onRouletteDone, phase]);

  return (
    <AnimatedModalShell
      visible={visible}
      variant={phase === 'filtros' ? 'sheet' : 'center'}
      onClose={handleClose}
      onSheetDismiss={handleSheetDismiss}
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
      layoutAnimated={phase === 'filtros'}
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
          onConfirm={onConfirmIncompleteDraw}
          onCancel={onCancelIncompleteDraw}
        />
      }>
      {phase === 'filtros' && (
        <Animated.View
          key="phase-filtros"
          entering={reducedMotion ? undefined : FadeIn.duration(150)}
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
            onDraw={onDrawPress}
          />
        </Animated.View>
      )}

      {phase === 'sorteando' && spinSession && (
        <Animated.View
          key={`phase-sorteando-${spinSession.spinKey}`}
          entering={reducedMotion ? undefined : FadeIn.duration(150)}>
          <DrawRoulettePhase
            winner={spinSession.winner}
            candidates={spinSession.candidates}
            eligibleCount={spinSession.eligibleCount}
            spinKey={spinSession.spinKey}
            onFinish={onRouletteDone}
            onSkip={onRouletteDone}
          />
        </Animated.View>
      )}

      {phase === 'resultado' && spinSession && (
        <Animated.View
          key={`phase-resultado-${spinSession.winner.id}-${spinSession.spinKey}`}
          entering={reducedMotion ? undefined : FadeIn.duration(160)}
          style={styles.resultInner}>
          <DrawResultPhase
            title={spinSession.winner}
            duration={winnerDuration}
            trailerUrl={winnerTrailerUrl}
            saved={isWinnerSaved}
            activeSubscriptions={activeSubscriptions}
            enabledServices={enabledServices}
            canDrawAnother={eligibleTitles.length > 1}
            onClose={handleClose}
            onWatch={onWatchWinner}
            onToggleSave={onToggleWinnerSaved}
            onMarkWatched={onMarkWinnerWatched}
            onDrawAnother={onDrawAnother}
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
