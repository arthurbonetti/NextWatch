import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/atoms/AppText';
import { formatAverageRating, getGenreIcon } from '@/constants/catalog';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';
import type { MediaTitle } from '@/types/media';
import {
  formatUserRatingCount,
  formatUserRatingOutOfFive,
  type TitleRatingSummary,
} from '@/utils/titleRating';

type TitleMetadataSectionProps = {
  title: MediaTitle;
  metacritic: number | null;
  formattedVotes: string | null;
  userRatingSummary?: TitleRatingSummary | null;
  personalRating?: number | null;
  canRate?: boolean;
  watchRequirementHint?: string;
  onPressRating: () => void;
  onPressPersonalRating?: () => void;
  onPressGenre: (genre: string) => void;
};

function renderMiniStars(average: number | null, activeColor: string, mutedColor: string) {
  const stars = [];
  for (let i = 1; i <= 5; i += 1) {
    let iconName: 'star' | 'star-half' | 'star-outline' = 'star-outline';
    let color = mutedColor;
    if (average !== null) {
      if (average >= i - 0.25) {
        iconName = 'star';
        color = activeColor;
      } else if (average >= i - 0.75) {
        iconName = 'star-half';
        color = activeColor;
      }
    }
    stars.push(<MaterialIcons key={i} name={iconName} size={14} color={color} />);
  }
  return stars;
}

/** Exibe as notas (público, Metacritic e média dos usuários) e os chips clicáveis de gêneros de um título. */
export function TitleMetadataSection({
  title,
  metacritic,
  formattedVotes,
  userRatingSummary,
  personalRating = null,
  canRate = false,
  watchRequirementHint = 'Assista a qualquer parte da obra para avaliar.',
  onPressRating,
  onPressPersonalRating,
  onPressGenre,
}: TitleMetadataSectionProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const hasCommunityRatings =
    Boolean(userRatingSummary && userRatingSummary.count > 0 && userRatingSummary.average !== null);
  const communityAverageLabel = formatUserRatingOutOfFive(userRatingSummary);
  const communityCount = userRatingSummary?.count ?? 0;
  const hasPersonalRating = typeof personalRating === 'number' && Number.isFinite(personalRating);

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
          onPress={onPressRating}
          style={({ pressed }) => [
            styles.communityBadge,
            hasCommunityRatings ? styles.communityBadgeFilled : styles.communityBadgeEmpty,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            hasCommunityRatings
              ? `Média dos usuários: ${communityAverageLabel}, ${formatUserRatingCount(communityCount)}`
              : 'Média dos usuários: N/A'
          }>
          <MaterialIcons
            name={hasCommunityRatings ? 'people' : 'people-outline'}
            size={15}
            color={hasCommunityRatings ? colors.badgeAccentText : colors.textMuted}
          />
          <AppText
            peso="forte"
            tabular
            style={[
              styles.communityBadgeValue,
              !hasCommunityRatings && styles.communityBadgeValueEmpty,
            ]}>
            {communityAverageLabel}
          </AppText>
          <AppText
            tipo="legenda"
            peso="semiforte"
            style={[
              styles.communityBadgeLabel,
              !hasCommunityRatings && styles.communityBadgeLabelEmpty,
            ]}>
            Usuários
          </AppText>
        </Pressable>
      </View>

      <View style={styles.communityCard}>
        <View style={styles.communityCardCopy}>
          <View style={styles.communityCardTop}>
            <View style={styles.miniStarsRow}>
              {renderMiniStars(
                hasCommunityRatings ? (userRatingSummary?.average ?? null) : null,
                colors.accentPrimary,
                colors.textMuted,
              )}
            </View>
            <AppText
              tipo="texto"
              peso="forte"
              tabular
              style={[
                styles.communityCardScore,
                !hasCommunityRatings && styles.communityCardScoreEmpty,
              ]}>
              {communityAverageLabel}
            </AppText>
          </View>
          <AppText tipo="legenda" style={styles.communityCardCaption}>
            Média dos usuários ·{' '}
            {hasCommunityRatings ? formatUserRatingCount(communityCount) : 'Nenhuma nota ainda'}
            {hasPersonalRating ? ` · Você: ${personalRating}/5` : ''}
          </AppText>
          {!canRate && (
            <AppText tipo="legenda" style={styles.watchHintText}>
              {watchRequirementHint}
            </AppText>
          )}
        </View>

        {canRate && onPressPersonalRating ? (
          <Pressable
            onPress={onPressPersonalRating}
            style={({ pressed }) => [
              styles.rateButton,
              hasPersonalRating ? styles.rateButtonEdit : styles.rateButtonPrimary,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              hasPersonalRating
                ? `Alterar sua nota atual de ${personalRating} de 5`
                : 'Avaliar este título'
            }>
            <MaterialIcons
              name={hasPersonalRating ? 'edit' : 'star'}
              size={15}
              color={hasPersonalRating ? colors.badgeAccentText : colors.textOnAccent}
            />
            <AppText
              tipo="legenda"
              peso="forte"
              style={hasPersonalRating ? styles.rateButtonEditText : styles.rateButtonPrimaryText}>
              {hasPersonalRating ? 'Editar nota' : 'Avaliar'}
            </AppText>
          </Pressable>
        ) : (
          <View
            style={styles.rateLockedPill}
            accessibilityLabel={`Avaliação bloqueada. ${watchRequirementHint}`}>
            <MaterialIcons name="lock-outline" size={14} color={colors.textMuted} />
            <AppText tipo="legenda" peso="forte" style={styles.rateLockedText}>
              Assista
            </AppText>
          </View>
        )}
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
  communityBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  communityBadgeFilled: {
    backgroundColor: theme.colors.badgeAccentBg,
    borderColor: theme.colors.badgeAccentBorder,
  },
  communityBadgeEmpty: {
    backgroundColor: theme.colors.bgSurface,
    borderColor: theme.colors.borderSubtle,
  },
  communityBadgeValue: {
    color: theme.colors.badgeAccentText,
    fontSize: 13.5,
  },
  communityBadgeValueEmpty: {
    color: theme.colors.textSecondary,
  },
  communityBadgeLabel: {
    color: theme.colors.badgeAccentText,
    fontSize: 11,
    opacity: 0.85,
  },
  communityBadgeLabelEmpty: {
    color: theme.colors.textMuted,
  },
  communityCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 11,
  },
  communityCardCopy: {
    flex: 1,
    gap: 3,
  },
  communityCardTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 7,
  },
  miniStarsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 1,
  },
  communityCardScore: {
    color: theme.colors.textPrimary,
    fontSize: 14,
  },
  communityCardScoreEmpty: {
    color: theme.colors.textSecondary,
  },
  communityCardCaption: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  watchHintText: {
    color: theme.colors.accentLink,
    fontSize: 11.5,
    lineHeight: 16,
  },
  rateButton: {
    minHeight: 38,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 5,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderWidth: 1,
  },
  rateButtonPrimary: {
    backgroundColor: theme.colors.accentPrimary,
    borderColor: theme.colors.accentPrimary,
  },
  rateButtonEdit: {
    backgroundColor: theme.colors.badgeAccentBg,
    borderColor: theme.colors.badgeAccentBorder,
  },
  rateButtonPrimaryText: {
    color: theme.colors.textOnAccent,
    fontSize: 12.5,
  },
  rateButtonEditText: {
    color: theme.colors.badgeAccentText,
    fontSize: 12.5,
  },
  rateLockedPill: {
    minHeight: 36,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bgSurfaceAlt,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  rateLockedText: {
    color: theme.colors.textMuted,
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
