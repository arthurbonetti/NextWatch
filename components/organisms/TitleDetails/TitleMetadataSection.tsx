import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/atoms/AppText';
import { formatAverageRating, getGenreIcon } from '@/constants/catalog';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';
import type { MediaTitle } from '@/types/media';

type TitleMetadataSectionProps = {
  title: MediaTitle;
  metacritic: number | null;
  formattedVotes: string | null;
  personalRating: number | null;
  onPressRating: () => void;
  onPressPersonalRating: () => void;
  onPressGenre: (genre: string) => void;
};

/** Exibe as notas (público e Metacritic) e os chips clicáveis de gêneros de um título. */
export function TitleMetadataSection({
  title,
  metacritic,
  formattedVotes,
  personalRating,
  onPressRating,
  onPressPersonalRating,
  onPressGenre,
}: TitleMetadataSectionProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <>
      <View style={styles.ratingRow}>
        <Pressable
          onPress={onPressRating}
          style={({ pressed }) => [styles.ratingBadge, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Nota ${formatAverageRating(title)}${formattedVotes ? `, ${formattedVotes} votos` : ''}. Toque para ver fontes.`}>
          <MaterialIcons name="star" size={16} color={colors.accentPrimary} />
          <AppText peso="forte" tabular style={styles.ratingValue}>
            {formatAverageRating(title)}
          </AppText>
          <AppText tipo="legenda" peso="forte" style={styles.ratingSource}>
            {title.ratingSource ?? 'TMDB'}
          </AppText>
          {formattedVotes && (
            <AppText tipo="legenda" tabular style={styles.votesInlineText}>
              · {formattedVotes} votos
            </AppText>
          )}
          <MaterialIcons
            name="info-outline"
            size={15}
            color={colors.textOnNavyMuted}
            style={styles.ratingInfoIcon}
          />
        </Pressable>

        {metacritic !== null && (
          <Pressable
            onPress={onPressRating}
            style={({ pressed }) => [
              styles.metacriticBadge,
              metacritic >= 61
                ? styles.mcGreen
                : metacritic >= 40
                  ? styles.mcYellow
                  : styles.mcRed,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Metacritic ${metacritic} de 100`}>
            <AppText peso="forte" tabular style={styles.metacriticScore}>
              {metacritic}
            </AppText>
            <AppText tipo="legenda" peso="forte" style={styles.metacriticLabel}>
              MC
            </AppText>
          </Pressable>
        )}

        <Pressable
          onPress={onPressPersonalRating}
          style={({ pressed }) => [styles.personalRatingBadge, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={personalRating !== null ? `Sua nota: ${personalRating} de 5. Alterar avaliação` : 'Avaliar este título'}>
          <MaterialIcons
            name={personalRating !== null ? 'star' : 'star-outline'}
            size={16}
            color={personalRating !== null ? colors.accentPrimary : colors.textPrimary}
          />
          <AppText peso="forte" style={styles.personalRatingText}>
            {personalRating !== null ? `Minha nota: ${personalRating}/5` : 'Avaliar'}
          </AppText>
        </Pressable>
      </View>

      {title.genres.length > 0 && (
        <View style={styles.genresWrap}>
          {title.genres.map((genre) => (
            <Pressable
              key={genre}
              onPress={() => onPressGenre(genre)}
              style={({ pressed }) => [
                styles.genreChip,
                {
                  borderColor: colors.chipBorder,
                  backgroundColor: colors.bgSurface,
                },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Sortear títulos do gênero ${genre}`}>
              <MaterialIcons
                name={getGenreIcon(genre)}
                size={14}
                color={colors.accentLink}
              />
              <AppText tipo="legenda" peso="forte" style={styles.genreChipText}>
                {genre}
              </AppText>
            </Pressable>
          ))}
        </View>
      )}
    </>
  );
}

const createStyles = (theme: Theme) => ({
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  ratingRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
  },
  ratingBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    backgroundColor: theme.colors.heroBg,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  ratingValue: {
    color: theme.colors.textOnNavy,
    fontSize: 15,
  },
  ratingSource: {
    color: theme.colors.accentPrimary,
    fontSize: 11,
    letterSpacing: 0.4,
  },
  votesInlineText: {
    color: theme.colors.textOnNavyMuted,
    fontSize: 12,
  },
  ratingInfoIcon: {
    marginLeft: 2,
  },
  metacriticBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  mcGreen: {
    backgroundColor: theme.colors.mcGreen,
  },
  mcYellow: {
    backgroundColor: theme.colors.mcYellow,
  },
  mcRed: {
    backgroundColor: theme.colors.mcRed,
  },
  metacriticScore: {
    color: theme.colors.textOnNavy,
    fontSize: 14,
  },
  metacriticLabel: {
    color: theme.colors.textOnNavy,
    fontSize: 10,
    opacity: 0.9,
  },
  personalRatingBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bgSurface,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  personalRatingText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
  },
  genresWrap: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
  },
  genreChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  genreChipText: {
    color: theme.colors.textPrimary,
    fontSize: 12.5,
  },
});
