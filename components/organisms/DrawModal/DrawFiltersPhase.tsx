import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, ScrollView, View } from 'react-native';
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
import { Theme, THEME } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';
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
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

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
          color={enabled ? colors.textOnAccent : colors.textOnNavy}
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
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
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
                <MaterialIcons name="warning-amber" size={16} color={colors.accentLink} />
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
                <MaterialIcons name="visibility-off" size={18} color={colors.textSecondary} />
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
                  <MaterialIcons name="auto-awesome" size={19} color={colors.textOnAccent} />
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

const createStyles = (theme: Theme) => ({
  container: {
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.84,
  },
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
    gap: theme.spacing.md,
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    color: theme.colors.accentLink,
    letterSpacing: 1.3,
    marginBottom: theme.spacing.sm,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSizes.title,
    lineHeight: theme.lineHeights.title,
    letterSpacing: -0.35,
  },
  headerActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
  },
  resetButton: {
    minHeight: theme.touchTarget.min,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.bgSurfaceAlt,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  resetButtonText: {
    color: theme.colors.accentLink,
    fontSize: theme.fontSizes.bodySm,
  },
  description: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSizes.bodySm,
    lineHeight: theme.lineHeights.bodyMd,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  scrollArea: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.xxl,
  },
  sectionBlock: {
    gap: theme.spacing.md,
  },
  sectionLabelRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  filterLabel: {
    color: theme.colors.textSecondary,
    letterSpacing: 1,
  },
  sectionHint: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.caption,
  },
  servicesRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.base,
  },
  serviceToggle: {
    minWidth: theme.touchTarget.button,
    minHeight: theme.touchTarget.button,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  serviceToggleEnabled: {
    borderColor: theme.isDark ? theme.colors.accentPrimary : theme.colors.navy,
    backgroundColor: theme.colors.savedActiveBg,
    opacity: 1,
  },
  serviceToggleDisabled: {
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bgSurfaceAlt,
    opacity: 0.48,
  },
  serviceStatusDot: {
    position: 'absolute' as const,
    bottom: -theme.spacing.xs,
    right: -theme.spacing.xs,
    width: theme.spacing.s18,
    height: theme.spacing.s18,
    borderRadius: theme.radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1.5,
    borderColor: theme.colors.bgSurface,
  },
  serviceStatusOn: {
    backgroundColor: theme.colors.accentPrimary,
  },
  serviceStatusOff: {
    backgroundColor: theme.colors.textMuted,
  },
  warningBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.base,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bgWarning,
    borderWidth: 1,
    borderColor: theme.colors.borderWarning,
  },
  warningText: {
    flex: 1,
    color: theme.colors.accentLink,
    fontSize: theme.fontSizes.caption,
    lineHeight: theme.lineHeights.caption,
  },
  chipGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.md,
  },
  watchedSection: {
    paddingTop: theme.spacing.xxs,
  },
  watchedRow: {
    minHeight: theme.touchTarget.min + theme.spacing.sm,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.base,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bgSurfaceAlt,
  },
  watchedCopyRow: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.base,
  },
  watchedIconWrap: {
    width: theme.spacing.s32,
    height: theme.spacing.s32,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.bgSurface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  watchedCopy: {
    flex: 1,
  },
  watchedTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.fontSizes.bodySm,
    lineHeight: theme.lineHeights.bodySm,
  },
  watchedHint: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.caption,
    lineHeight: theme.lineHeights.caption,
  },
  footer: {
    paddingTop: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  emptyNotice: {
    color: theme.colors.accentLink,
    fontSize: theme.fontSizes.caption,
    textAlign: 'center' as const,
  },
  ctaButton: {
    minHeight: theme.touchTarget.cta,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.accentPrimary,
    paddingHorizontal: theme.spacing.xxl,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  ctaDisabled: {
    backgroundColor: theme.colors.bgSurfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  ctaContent: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  ctaIconWrap: {
    marginLeft: theme.spacing.md,
  },
  ctaText: {
    color: theme.colors.textOnAccent,
    fontSize: theme.fontSizes.body,
    lineHeight: theme.lineHeights.body,
  },
  ctaTextDisabled: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.bodyMd,
  },
});
