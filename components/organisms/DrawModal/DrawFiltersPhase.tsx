import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/atoms/AppText';
import { ServiceLogo } from '@/components/atoms/ServiceLogo';
import { SwitchVisual } from '@/components/atoms/SwitchToggle';
import { AnimatedFilterChip } from '@/components/organisms/DrawModal/AnimatedFilterChip';
import { AnimatedRollingNumber } from '@/components/organisms/DrawModal/AnimatedRollingNumber';
import { getGenreIcon, getKindIcon } from '@/constants/catalog';
import { Subscription } from '@/constants/subscriptions';
import { THEME } from '@/constants/theme';
import { DrawFiltersState, DrawKindFilter } from '@/hooks/usePersistedDrawFilters';
import { formatCount } from '@/utils/format';
import { triggerSelectionHaptic } from '@/utils/haptics';

type DrawFiltersPhaseProps = {
  activeSubscriptions: Subscription[];
  availableGenres: string[];
  hasAnyAvailableTitle: boolean;
  eligibleCount: number;
  watchedCount: number;
  filters: DrawFiltersState;
  enabledServices: string[];
  onSelectKind: (kind: DrawKindFilter) => void;
  onToggleGenre: (genre: string) => void;
  onClearGenres: () => void;
  onToggleService: (provider: string) => void;
  onToggleHideWatched: (nextValue: boolean) => void;
  onResetFilters: () => void;
  onDraw: () => void;
};

const KIND_OPTIONS: { value: DrawKindFilter; label: string }[] = [
  { value: 'Todos', label: 'Tanto faz' },
  { value: 'Filme', label: 'Filmes' },
  { value: 'Série', label: 'Séries' },
  { value: 'Anime', label: 'Animes' },
];

type ServiceTogglePillProps = {
  provider: string;
  enabled: boolean;
  onPress: () => void;
};

function ServiceTogglePill({ provider, enabled, onPress }: ServiceTogglePillProps) {
  return (
    <Pressable
      onPress={() => {
        triggerSelectionHaptic();
        onPress();
      }}
      style={({ pressed }) => [
        styles.serviceToggle,
        enabled ? styles.serviceToggleEnabled : styles.serviceToggleDisabled,
        pressed && styles.pressed,
      ]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: enabled }}
      accessibilityLabel={`${provider}: ${enabled ? 'ligado para este sorteio' : 'desligado para este sorteio'}`}>
      <ServiceLogo name={provider} size={32} />
      <View style={[styles.serviceStatusDot, enabled ? styles.serviceStatusOn : styles.serviceStatusOff]}>
        <MaterialIcons
          name={enabled ? 'check' : 'close'}
          size={10}
          color={enabled ? THEME.colors.navy : THEME.colors.textOnNavy}
        />
      </View>
    </Pressable>
  );
}

/**
 * Tela 1 do fluxo de sorteio: filtros com chips, seleção de streamings,
 * toggle de já assistidos e botão principal com contador dinâmico.
 */
export function DrawFiltersPhase({
  activeSubscriptions,
  availableGenres,
  hasAnyAvailableTitle,
  eligibleCount,
  watchedCount,
  filters,
  enabledServices,
  onSelectKind,
  onToggleGenre,
  onClearGenres,
  onToggleService,
  onToggleHideWatched,
  onResetFilters,
  onDraw,
}: DrawFiltersPhaseProps) {
  const reducedMotion = useReducedMotion();
  const ctaScale = useSharedValue(1);

  const hasEnabledService = enabledServices.length > 0;
  const canDraw = hasEnabledService && eligibleCount > 0;
  const hasCustomFilters =
    filters.kind !== 'Todos' ||
    filters.selectedGenres.length > 0 ||
    filters.disabledServices.length > 0 ||
    filters.hideWatched;

  const ctaAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ctaScale.get() }],
  }));

  const emptyMessage = !hasAnyAvailableTitle
    ? 'Ative uma assinatura para sortear'
    : !hasEnabledService
      ? 'Ligue ao menos um streaming acima'
      : 'Nenhum título com esses filtros';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <AppText tipo="legenda" peso="forte" style={styles.eyebrow}>
            SORTEIO
          </AppText>
          <AppText tipo="subtitulo" familia="editorial" peso="forte" style={styles.title}>
            O que combina com você?
          </AppText>
        </View>
        <View style={styles.headerActions}>
          {hasCustomFilters && (
            <Pressable
              onPress={() => {
                triggerSelectionHaptic();
                onResetFilters();
              }}
              style={({ pressed }) => [styles.resetButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Limpar filtros do sorteio">
              <AppText tipo="legenda" peso="forte" style={styles.resetButtonText}>
                Limpar
              </AppText>
            </Pressable>
          )}
        </View>
      </View>

      <AppText tipo="legenda" style={styles.description}>
        {hasAnyAvailableTitle
          ? 'Apenas obras com nota 6,0+ e boa relevância entram na roleta.'
          : 'Você ainda não tem títulos nos serviços ativos. Adicione ou ative uma assinatura para sortear.'}
      </AppText>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}>
        {activeSubscriptions.length > 0 && (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionLabelRow}>
              <AppText tipo="legenda" peso="forte" style={styles.filterLabel}>
                SORTEANDO EM:
              </AppText>
              <AppText tipo="legenda" tabular style={styles.sectionHint}>
                {enabledServices.length} de {activeSubscriptions.length}{' '}
                {activeSubscriptions.length === 1 ? 'ativo' : 'ativos'}
              </AppText>
            </View>
            <View style={styles.servicesRow}>
              {activeSubscriptions.map((subscription) => {
                const isEnabled = !filters.disabledServices.includes(subscription.provider);
                return (
                  <ServiceTogglePill
                    key={subscription.id}
                    provider={subscription.provider}
                    enabled={isEnabled}
                    onPress={() => onToggleService(subscription.provider)}
                  />
                );
              })}
            </View>
            {!hasEnabledService && (
              <View style={styles.warningBanner}>
                <MaterialIcons name="warning-amber" size={16} color={THEME.colors.accentText} />
                <AppText tipo="legenda" peso="semiforte" style={styles.warningText}>
                  Nenhum streaming selecionado. Toque em um logo acima para incluir no sorteio.
                </AppText>
              </View>
            )}
          </View>
        )}

        <View style={styles.sectionBlock}>
          <AppText tipo="legenda" peso="forte" style={styles.filterLabel}>
            TIPO
          </AppText>
          <View style={styles.chipGrid}>
            {KIND_OPTIONS.map((option) => (
              <AnimatedFilterChip
                key={option.value}
                label={option.label}
                icon={getKindIcon(option.value)}
                selected={filters.kind === option.value}
                onPress={() => onSelectKind(option.value)}
                accessibilityRole="radio"
              />
            ))}
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <View style={styles.sectionLabelRow}>
            <AppText tipo="legenda" peso="forte" style={styles.filterLabel}>
              GÊNERO
            </AppText>
            <AppText tipo="legenda" style={styles.sectionHint}>
              {filters.selectedGenres.length > 0
                ? `${filters.selectedGenres.length} selecionado${filters.selectedGenres.length > 1 ? 's' : ''}`
                : 'Múltipla escolha'}
            </AppText>
          </View>
          <View style={styles.chipGrid}>
            <AnimatedFilterChip
              label="Tanto faz"
              icon="auto-awesome"
              selected={filters.selectedGenres.length === 0}
              onPress={onClearGenres}
              accessibilityRole="checkbox"
            />
            {availableGenres.map((genre) => (
              <AnimatedFilterChip
                key={genre}
                label={genre}
                icon={getGenreIcon(genre)}
                selected={filters.selectedGenres.includes(genre)}
                onPress={() => onToggleGenre(genre)}
                accessibilityRole="checkbox"
              />
            ))}
          </View>
        </View>

        <View style={styles.watchedSection}>
          <Pressable
            onPress={() => {
              triggerSelectionHaptic();
              onToggleHideWatched(!filters.hideWatched);
            }}
            accessibilityRole="switch"
            accessibilityState={{ checked: filters.hideWatched }}
            accessibilityLabel="Ocultar já assistidos"
            style={({ pressed }) => [styles.watchedRow, pressed && styles.pressed]}>
            <View style={styles.watchedCopyRow}>
              <View style={styles.watchedIconWrap}>
                <MaterialIcons name="visibility-off" size={18} color={THEME.colors.textWarm} />
              </View>
              <View style={styles.watchedCopy}>
                <AppText tipo="legenda" peso="forte" style={styles.watchedTitle}>
                  Ocultar já assistidos
                </AppText>
                {watchedCount > 0 && (
                  <AppText tipo="legenda" tabular style={styles.watchedHint}>
                    {formatCount(watchedCount)} {watchedCount === 1 ? 'título marcado' : 'títulos marcados'}
                  </AppText>
                )}
              </View>
            </View>
            <SwitchVisual value={filters.hideWatched} />
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {eligibleCount === 0 && (
          <AppText tipo="legenda" peso="semiforte" style={styles.emptyNotice}>
            {emptyMessage}
          </AppText>
        )}
        <Pressable
          onPress={onDraw}
          onPressIn={() => {
            if (!reducedMotion && canDraw) {
              ctaScale.set(withTiming(0.97, { duration: THEME.motion.pressDurationMs }));
            }
          }}
          onPressOut={() => {
            if (!reducedMotion) {
              ctaScale.set(withTiming(1, { duration: THEME.motion.pressDurationMs }));
            }
          }}
          disabled={!canDraw}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canDraw }}
          accessibilityLabel={
            canDraw ? `Sortear entre ${formatCount(eligibleCount)} títulos` : emptyMessage
          }>
          <Animated.View style={[styles.ctaButton, !canDraw && styles.ctaDisabled, ctaAnimatedStyle]}>
            {canDraw ? (
              <View style={styles.ctaContent}>
                <AppText peso="forte" style={styles.ctaText}>
                  Sortear entre{' '}
                </AppText>
                <AnimatedRollingNumber value={eligibleCount} style={styles.ctaText} />
                <AppText peso="forte" style={styles.ctaText}>
                  {eligibleCount === 1 ? ' título' : ' títulos'}
                </AppText>
                <View style={styles.ctaIconWrap}>
                  <MaterialIcons name="auto-awesome" size={19} color={THEME.colors.navy} />
                </View>
              </View>
            ) : (
              <AppText peso="forte" style={styles.ctaTextDisabled}>
                {emptyMessage}
              </AppText>
            )}
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.84,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: THEME.spacing.md,
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    color: THEME.colors.accent,
    letterSpacing: 1.3,
    marginBottom: THEME.spacing.sm,
  },
  title: {
    color: THEME.colors.textPrimary,
    fontSize: THEME.fontSizes.title,
    lineHeight: THEME.lineHeights.title,
    letterSpacing: -0.35,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
  },
  resetButton: {
    minHeight: THEME.touchTarget.min,
    paddingHorizontal: THEME.spacing.lg,
    borderRadius: THEME.radius.pill,
    backgroundColor: THEME.colors.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButtonText: {
    color: THEME.colors.accentText,
    fontSize: THEME.fontSizes.bodySm,
  },
  description: {
    color: THEME.colors.textSecondary,
    fontSize: THEME.fontSizes.bodySm,
    lineHeight: THEME.lineHeights.bodyMd,
    marginTop: THEME.spacing.md,
    marginBottom: THEME.spacing.lg,
  },
  scrollArea: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: THEME.spacing.md,
    gap: THEME.spacing.xxl,
  },
  sectionBlock: {
    gap: THEME.spacing.md,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterLabel: {
    color: THEME.colors.textSecondary,
    letterSpacing: 1,
  },
  sectionHint: {
    color: THEME.colors.textMuted,
    fontSize: THEME.fontSizes.caption,
  },
  servicesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: THEME.spacing.base,
  },
  serviceToggle: {
    minWidth: THEME.touchTarget.button,
    minHeight: THEME.touchTarget.button,
    padding: THEME.spacing.sm,
    borderRadius: THEME.radius.lg,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceToggleEnabled: {
    borderColor: THEME.colors.navy,
    backgroundColor: THEME.colors.bgHighlight,
    opacity: 1,
  },
  serviceToggleDisabled: {
    borderColor: THEME.colors.borderMedium,
    backgroundColor: THEME.colors.bgSubtle,
    opacity: 0.48,
  },
  serviceStatusDot: {
    position: 'absolute',
    bottom: -THEME.spacing.xs,
    right: -THEME.spacing.xs,
    width: THEME.spacing.s18,
    height: THEME.spacing.s18,
    borderRadius: THEME.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: THEME.colors.bgCard,
  },
  serviceStatusOn: {
    backgroundColor: THEME.colors.gold,
  },
  serviceStatusOff: {
    backgroundColor: THEME.colors.textMuted,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.md,
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.base,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.bgWarning,
    borderWidth: 1,
    borderColor: THEME.colors.borderWarning,
  },
  warningText: {
    flex: 1,
    color: THEME.colors.accentText,
    fontSize: THEME.fontSizes.caption,
    lineHeight: THEME.lineHeights.caption,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: THEME.spacing.md,
  },
  watchedSection: {
    paddingTop: THEME.spacing.xxs,
  },
  watchedRow: {
    minHeight: THEME.touchTarget.min + THEME.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: THEME.spacing.lg,
    paddingHorizontal: THEME.spacing.xl,
    paddingVertical: THEME.spacing.base,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    backgroundColor: THEME.colors.bgSubtle,
  },
  watchedCopyRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.base,
  },
  watchedIconWrap: {
    width: THEME.spacing.s32,
    height: THEME.spacing.s32,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  watchedCopy: {
    flex: 1,
  },
  watchedTitle: {
    color: THEME.colors.textPrimary,
    fontSize: THEME.fontSizes.bodySm,
    lineHeight: THEME.lineHeights.bodySm,
  },
  watchedHint: {
    color: THEME.colors.textMuted,
    fontSize: THEME.fontSizes.caption,
    lineHeight: THEME.lineHeights.caption,
  },
  footer: {
    paddingTop: THEME.spacing.lg,
    gap: THEME.spacing.md,
  },
  emptyNotice: {
    color: THEME.colors.accentText,
    fontSize: THEME.fontSizes.caption,
    textAlign: 'center',
  },
  ctaButton: {
    minHeight: THEME.touchTarget.cta,
    borderRadius: THEME.radius.lg,
    backgroundColor: THEME.colors.gold,
    paddingHorizontal: THEME.spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: {
    backgroundColor: THEME.colors.bgSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.borderMedium,
  },
  ctaContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaIconWrap: {
    marginLeft: THEME.spacing.md,
  },
  ctaText: {
    color: THEME.colors.navy,
    fontSize: THEME.fontSizes.body,
    lineHeight: THEME.lineHeights.body,
  },
  ctaTextDisabled: {
    color: THEME.colors.textMuted,
    fontSize: THEME.fontSizes.bodyMd,
  },
});
