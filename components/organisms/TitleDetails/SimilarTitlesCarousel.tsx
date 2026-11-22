import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/atoms/AppText';
import { TitleArtwork } from '@/components/atoms/TitleArtwork';
import { formatAverageRating, MediaTitle } from '@/constants/catalog';
import { Theme, withAlpha } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';

type SimilarTitlesCarouselProps = {
  titles: MediaTitle[];
  onSelectTitle: (title: MediaTitle) => void;
  onDrawSimilar: () => void;
};

export function SimilarTitlesCarousel({
  titles,
  onSelectTitle,
  onDrawSimilar,
}: SimilarTitlesCarouselProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <AppText tipo="subtitulo" peso="forte" style={styles.sectionTitle}>
          Parecidos com este
        </AppText>
        <Pressable
          onPress={onDrawSimilar}
          style={({ pressed }) => [
            styles.drawSimilarButton,
            {
              backgroundColor: colors.badgeAccentBg,
              borderColor: colors.badgeAccentBorder,
            },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Sortear outro título parecido">
          <MaterialIcons name="casino" size={15} color={colors.badgeAccentText} />
          <AppText tipo="legenda" peso="forte" style={styles.drawSimilarText}>
            Sortear outro parecido
          </AppText>
        </Pressable>
      </View>

      {titles.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          {titles.map((item) => {
            const posterBgColor = item.color || colors.heroBg;
            return (
              <Pressable
                key={item.id}
                onPress={() => onSelectTitle(item)}
                style={({ pressed }) => [styles.posterCard, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Abrir detalhes de ${item.title}`}>
                <Animated.View
                  sharedTransitionTag={`title-poster-${item.id}`}
                  style={[styles.posterFrame, { backgroundColor: posterBgColor }]}>
                  <TitleArtwork
                    id={item.id}
                    variant="poster"
                    posterPath={item.tmdbPosterPath}
                    backdropPath={item.tmdbBackdropPath}
                    fallback={
                      <View style={styles.posterFallback}>
                        <AppText tipo="subtitulo" peso="forte" style={styles.posterFallbackText}>
                          {item.title.slice(0, 1).toUpperCase()}
                        </AppText>
                      </View>
                    }
                  />
                  <View style={styles.ratingChip}>
                    <MaterialIcons name="star" size={10} color={colors.accentPrimary} />
                    <AppText tipo="legenda" peso="forte" style={styles.ratingText}>
                      {formatAverageRating(item)}
                    </AppText>
                  </View>
                </Animated.View>
                <AppText tipo="legenda" peso="forte" style={styles.itemTitle} numberOfLines={2}>
                  {item.title}
                </AppText>
                <AppText tipo="legenda" style={styles.itemMeta} numberOfLines={1}>
                  {item.year} · {item.kind}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  section: {
    gap: theme.spacing.md,
  },
  headerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
  },
  drawSimilarButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  drawSimilarText: {
    color: theme.colors.badgeAccentText,
    fontSize: 12,
  },
  pressed: {
    opacity: 0.76,
  },
  scrollContent: {
    gap: theme.spacing.md,
    paddingRight: theme.spacing.lg,
  },
  posterCard: {
    width: 112,
    gap: 5,
  },
  posterFrame: {
    width: 112,
    height: 166,
    borderRadius: theme.radius.md,
    overflow: 'hidden' as const,
    position: 'relative' as const,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  posterFallback: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  posterFallbackText: {
    color: theme.colors.textOnNavy,
    fontSize: 22,
  },
  ratingChip: {
    position: 'absolute' as const,
    top: 6,
    right: 6,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
    backgroundColor: withAlpha(theme.colors.heroBg, 0.88),
    borderRadius: theme.radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ratingText: {
    color: theme.colors.textOnNavy,
    fontSize: 10,
  },
  itemTitle: {
    color: theme.colors.textPrimary,
    fontSize: 12.5,
    lineHeight: 16,
  },
  itemMeta: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
});
