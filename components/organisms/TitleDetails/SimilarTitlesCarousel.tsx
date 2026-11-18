import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/atoms/AppText';
import { TitleArtwork } from '@/components/atoms/TitleArtwork';
import { formatAverageRating, MediaTitle } from '@/constants/catalog';
import { resolveTitleAccentColor, THEME, withAlpha } from '@/constants/theme';

type SimilarTitlesCarouselProps = {
  titles: MediaTitle[];
  accentColor: string;
  onSelectTitle: (title: MediaTitle) => void;
  onDrawSimilar: () => void;
};

export function SimilarTitlesCarousel({
  titles,
  accentColor,
  onSelectTitle,
  onDrawSimilar,
}: SimilarTitlesCarouselProps) {
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
              backgroundColor: withAlpha(accentColor, 0.14),
              borderColor: withAlpha(accentColor, 0.4),
            },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Sortear outro título parecido">
          <MaterialIcons name="casino" size={15} color={THEME.colors.textPrimary} />
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
            const cardAccent = resolveTitleAccentColor(item.color);
            return (
              <Pressable
                key={item.id}
                onPress={() => onSelectTitle(item)}
                style={({ pressed }) => [styles.posterCard, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Abrir detalhes de ${item.title}`}>
                <Animated.View
                  sharedTransitionTag={`title-poster-${item.id}`}
                  style={[styles.posterFrame, { backgroundColor: cardAccent }]}>
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
                    <MaterialIcons name="star" size={10} color={THEME.colors.gold} />
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

const styles = StyleSheet.create({
  section: {
    gap: THEME.spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: THEME.spacing.sm,
  },
  sectionTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 16,
  },
  drawSimilarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: THEME.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  drawSimilarText: {
    color: THEME.colors.textPrimary,
    fontSize: 12,
  },
  pressed: {
    opacity: 0.76,
  },
  scrollContent: {
    gap: THEME.spacing.md,
    paddingRight: THEME.spacing.lg,
  },
  posterCard: {
    width: 112,
    gap: 5,
  },
  posterFrame: {
    width: 112,
    height: 166,
    borderRadius: THEME.radius.md,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
  },
  posterFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterFallbackText: {
    color: THEME.colors.textOnNavy,
    fontSize: 22,
  },
  ratingChip: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: withAlpha(THEME.colors.navy, 0.88),
    borderRadius: THEME.radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ratingText: {
    color: THEME.colors.textOnNavy,
    fontSize: 10,
  },
  itemTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 12.5,
    lineHeight: 16,
  },
  itemMeta: {
    color: THEME.colors.textMuted,
    fontSize: 11,
  },
});
