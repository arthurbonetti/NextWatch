import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { AnimatedModalShell } from '@/components/atoms/AnimatedModalShell';
import { AppText } from '@/components/atoms/AppText';
import { BottomFadeScrim } from '@/components/atoms/BottomFadeScrim';
import { FilterChip } from '@/components/atoms/FilterChip';
import { StreamingChip } from '@/components/atoms/StreamingChip';
import { getGenreIcon } from '@/constants/catalog';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';
import {
  EXPLORE_SORT_OPTIONS,
  type RatingFilter,
  type SortOption,
} from '@/hooks/useExploreCatalog';
import { formatCount } from '@/utils/format';

const COLLAPSED_GENRE_COUNT = 7;

type ExploreFiltersModalProps = {
  visible: boolean;
  onClose: () => void;
  search: string;
  sortBy: SortOption;
  onChangeSortBy: (value: SortOption) => void;
  serviceNames: string[];
  selectedServices: string[];
  onClearServices: () => void;
  onToggleService: (service: string) => void;
  genres: string[];
  selectedGenres: string[];
  onClearGenres: () => void;
  onToggleGenre: (genre: string) => void;
  ratingFilter: RatingFilter;
  onChangeRatingFilter: (rating: RatingFilter) => void;
  resultsCount: number;
  hasResettableFilters: boolean;
  onClearAllFilters: () => void;
};

/** Sheet modal de filtros e ordenação do catálogo na aba Explorar. */
export function ExploreFiltersModal({
  visible,
  onClose,
  search,
  sortBy,
  onChangeSortBy,
  serviceNames,
  selectedServices,
  onClearServices,
  onToggleService,
  genres,
  selectedGenres,
  onClearGenres,
  onToggleGenre,
  ratingFilter,
  onChangeRatingFilter,
  resultsCount,
  hasResettableFilters,
  onClearAllFilters,
}: ExploreFiltersModalProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [showAllGenres, setShowAllGenres] = useState(false);

  const visibleGenres = useMemo(() => {
    if (showAllGenres || genres.length <= COLLAPSED_GENRE_COUNT) return genres;
    const base = genres.slice(0, COLLAPSED_GENRE_COUNT);
    const extrasSelected = selectedGenres.filter((genre) => !base.includes(genre));
    return [...base, ...extrasSelected];
  }, [genres, selectedGenres, showAllGenres]);

  return (
    <AnimatedModalShell
      visible={visible}
      onClose={onClose}
      variant="sheet"
      expandableSheet
      backdropAccessibilityLabel="Fechar filtros">
      <View style={styles.sheetHeader}>
        <View>
          <AppText tipo="legenda" peso="forte" style={styles.sheetEyebrow}>
            REFINAR CATÁLOGO
          </AppText>
          <AppText tipo="subtitulo" familia="editorial" peso="forte" style={styles.sheetTitle}>
            Filtros e ordenação
          </AppText>
        </View>
        <View style={styles.sheetHeaderActions}>
          <Pressable
            hitSlop={6}
            disabled={!hasResettableFilters}
            onPress={onClearAllFilters}
            style={({ pressed }) => [
              styles.clearHeaderBtn,
              !hasResettableFilters && styles.clearHeaderBtnDisabled,
              pressed && hasResettableFilters && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !hasResettableFilters }}
            accessibilityLabel="Limpar filtros">
            <AppText
              tipo="legenda"
              peso="forte"
              style={[
                styles.clearFilters,
                !hasResettableFilters && styles.clearFiltersDisabled,
              ]}>
              Limpar
            </AppText>
          </Pressable>
        </View>
      </View>

      <View style={styles.sheetScrollWrap}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          bounces={false}
          style={styles.sheetScroll}
          contentContainerStyle={styles.sheetScrollContent}>
          <AppText tipo="legenda" peso="forte" style={styles.filterLabel}>
            ORDENAÇÃO
          </AppText>
          <View style={styles.filterChips}>
            {EXPLORE_SORT_OPTIONS.map((option) => {
              const selected = sortBy === option.value;
              const optionLabel =
                option.value === 'default' && search.trim().length > 0
                  ? 'Relevância'
                  : option.label;
              return (
                <FilterChip
                  key={option.value}
                  label={optionLabel}
                  icon={option.icon}
                  selected={selected}
                  onPress={() => onChangeSortBy(option.value)}
                  accessibilityRole="radio"
                />
              );
            })}
          </View>

          {serviceNames.length > 1 && (
            <>
              <View style={styles.sectionLabelRow}>
                <AppText tipo="legenda" peso="forte" style={[styles.filterLabel, styles.secondFilterLabel]}>
                  STREAMING
                </AppText>
                <AppText tipo="legenda" style={styles.sectionHint}>
                  Múltipla escolha
                </AppText>
              </View>
              <View style={styles.filterChips}>
                <FilterChip
                  label="Meus streamings"
                  icon="subscriptions"
                  selected={selectedServices.length === 0}
                  onPress={onClearServices}
                  accessibilityRole="checkbox"
                />
                {serviceNames.map((service) => (
                  <StreamingChip
                    key={service}
                    provider={service}
                    selected={selectedServices.includes(service)}
                    onPress={() => onToggleService(service)}
                    accessibilityRole="checkbox"
                  />
                ))}
              </View>
            </>
          )}

          <View style={styles.sectionLabelRow}>
            <AppText tipo="legenda" peso="forte" style={[styles.filterLabel, styles.secondFilterLabel]}>
              GÊNERO
            </AppText>
            <AppText tipo="legenda" style={styles.sectionHint}>
              Combina selecionados
            </AppText>
          </View>
          <View style={styles.filterChips}>
            <FilterChip
              label="Todos"
              icon="apps"
              selected={selectedGenres.length === 0}
              onPress={onClearGenres}
              accessibilityRole="checkbox"
            />
            {visibleGenres.map((genre) => (
              <FilterChip
                key={genre}
                label={genre}
                icon={getGenreIcon(genre)}
                selected={selectedGenres.includes(genre)}
                onPress={() => onToggleGenre(genre)}
                accessibilityRole="checkbox"
              />
            ))}
            {genres.length > COLLAPSED_GENRE_COUNT && (
              <Pressable
                onPress={() => setShowAllGenres((prev) => !prev)}
                style={({ pressed }) => [styles.expandGenresChip, pressed && styles.pressed]}>
                <AppText tipo="legenda" peso="forte" style={styles.expandGenresText}>
                  {showAllGenres ? 'Menos' : `Mais (+${genres.length - COLLAPSED_GENRE_COUNT})`}
                </AppText>
              </Pressable>
            )}
          </View>

          <AppText tipo="legenda" peso="forte" style={[styles.filterLabel, styles.secondFilterLabel]}>
            NOTA MÍNIMA
          </AppText>
          <View style={styles.filterChips}>
            {(['Qualquer nota', '6+', '7+', '8+'] as RatingFilter[]).map((rating) => (
              <FilterChip
                key={rating}
                label={rating}
                icon={rating === 'Qualquer nota' ? 'auto-awesome' : 'star'}
                selected={ratingFilter === rating}
                onPress={() => onChangeRatingFilter(rating)}
                accessibilityRole="radio"
              />
            ))}
          </View>
        </ScrollView>
        <BottomFadeScrim color={colors.bgSurface} height={30} style={styles.sheetScrollScrim} />
      </View>

      <Pressable
        disabled={resultsCount === 0}
        style={({ pressed }) => [
          styles.applyButton,
          resultsCount === 0 && styles.applyButtonDisabled,
          pressed && resultsCount > 0 && styles.pressed,
        ]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityState={{ disabled: resultsCount === 0 }}>
        <AppText
          peso="forte"
          style={[styles.applyButtonText, resultsCount === 0 && styles.applyButtonTextDisabled]}>
          {resultsCount === 0
            ? 'Nenhum título encontrado'
            : `Ver ${formatCount(resultsCount)} ${resultsCount === 1 ? 'título' : 'títulos'}`}
        </AppText>
      </Pressable>
      {resultsCount === 0 && hasResettableFilters && (
        <Pressable
          style={({ pressed }) => [styles.secondaryResetButton, pressed && styles.pressed]}
          onPress={onClearAllFilters}
          accessibilityRole="button">
          <AppText tipo="legenda" peso="forte" style={styles.secondaryResetText}>
            Limpar filtros
          </AppText>
        </Pressable>
      )}
    </AnimatedModalShell>
  );
}

const createStyles = (theme: Theme) => ({
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  sectionLabelRow: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    justifyContent: 'space-between' as const,
    marginTop: 15,
    marginBottom: 8,
  },
  filterLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 8,
  },
  secondFilterLabel: { marginTop: 15 },
  sectionHint: { color: theme.colors.textSecondary, fontSize: 12 },
  clearFilters: { color: theme.colors.accentLink, fontSize: 13 },
  clearFiltersDisabled: { color: theme.colors.buttonDisabledText },
  filterChips: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.md,
  },
  expandGenresChip: {
    minHeight: theme.touchTarget.min,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: theme.colors.savedActiveBorder,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.base,
    backgroundColor: theme.colors.savedActiveBg,
  },
  expandGenresText: { color: theme.colors.accentLink, fontSize: 13 },
  sheetHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 14,
  },
  sheetEyebrow: { color: theme.colors.accentLink, letterSpacing: 1.3, marginBottom: 3 },
  sheetTitle: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    lineHeight: 25,
    letterSpacing: -0.3,
  },
  sheetHeaderActions: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  clearHeaderBtn: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: theme.colors.bgSurfaceAlt,
  },
  clearHeaderBtnDisabled: { backgroundColor: theme.colors.buttonDisabledBg },
  sheetScrollWrap: { position: 'relative' as const, flexShrink: 1, marginBottom: 14 },
  sheetScroll: { flexShrink: 1 },
  sheetScrollContent: { paddingBottom: 32 },
  sheetScrollScrim: { position: 'absolute' as const, left: 0, right: 0, bottom: 0 },
  applyButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: theme.colors.primaryButtonBg,
    borderWidth: 1,
    borderColor: theme.colors.primaryButtonBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  applyButtonDisabled: {
    backgroundColor: theme.colors.buttonDisabledBg,
    borderColor: theme.colors.buttonDisabledBorder,
  },
  applyButtonText: { color: theme.colors.primaryButtonText, fontSize: 14.5 },
  applyButtonTextDisabled: { color: theme.colors.buttonDisabledText },
  secondaryResetButton: {
    minHeight: 40,
    marginTop: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  secondaryResetText: { color: theme.colors.accentLink, fontSize: 13.5 },
});
