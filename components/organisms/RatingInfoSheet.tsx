import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { View } from 'react-native';

import { AnimatedModalShell } from '@/components/atoms/AnimatedModalShell';
import { AppText } from '@/components/atoms/AppText';
import { formatAverageRating, getMetacriticScore } from '@/constants/catalog';
import type { MediaTitle } from '@/types/media';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';
import { formatCount } from '@/utils/format';

type RatingInfoSheetProps = {
  visible: boolean;
  title: MediaTitle;
  voteCount?: number | null;
  onClose: () => void;
};

export function RatingInfoSheet({ visible, title, voteCount, onClose }: RatingInfoSheetProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const metacriticScore = getMetacriticScore(title);
  const formattedVotes = typeof voteCount === 'number' && voteCount > 0 ? formatCount(voteCount) : null;

  return (
    <AnimatedModalShell
      visible={visible}
      variant="sheet"
      onClose={onClose}
      dragEntireSheet
      sheetStyle={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <MaterialIcons name="star" size={18} color={colors.accentPrimary} />
          <AppText tipo="subtitulo" peso="forte" style={styles.title}>
            Fontes das avaliações
          </AppText>
        </View>
      </View>

      <View style={styles.scoreHero}>
        <View style={styles.scoreBadge}>
          <MaterialIcons name="star" size={15} color={colors.accentPrimary} />
          <AppText tipo="subtitulo" peso="forte" style={styles.scoreText}>
            {formatAverageRating(title)}
          </AppText>
        </View>
        <View style={styles.scoreMeta}>
          <AppText tipo="texto" peso="forte" style={styles.scoreSource}>
            {metacriticScore ? 'Média combinada' : 'Nota TMDB'}
          </AppText>
          <AppText tipo="legenda" style={styles.votesText}>
            {formattedVotes
              ? `${formattedVotes} ${voteCount === 1 ? 'avaliação registrada' : 'avaliações registradas'}`
              : 'Média usada nas listas e na roleta'}
          </AppText>
        </View>
      </View>

      <View style={styles.rows}>
        <View style={styles.infoRow}>
          <View style={styles.dot} />
          <AppText tipo="legenda" style={styles.infoText}>
            {title.ratingSource === 'IMDb' ? 'IMDb' : 'TMDB (The Movie Database)'}: nota de 0 a 10 ({title.imdbRating.replace('.', ',')}).
          </AppText>
        </View>
        {metacriticScore && (
          <View style={styles.infoRow}>
            <View style={styles.dot} />
            <AppText tipo="legenda" style={styles.infoText}>
              Metacritic: consenso da crítica especializada ({metacriticScore}/100).
            </AppText>
          </View>
        )}
        <View style={styles.infoRow}>
          <View style={styles.dot} />
          <AppText tipo="legenda" style={styles.infoText}>
            A roleta considera apenas obras com nota mínima de 6,0 e volume consistente de votos.
          </AppText>
        </View>
      </View>
    </AnimatedModalShell>
  );
}

const createStyles = (theme: Theme) => ({
  card: {
    backgroundColor: theme.colors.bgSurface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.md,
  },
  titleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 17,
  },
  scoreHero: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.bgSurfaceAlt,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  scoreBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    backgroundColor: theme.colors.heroBg,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  scoreText: {
    color: theme.colors.textOnNavy,
    fontSize: 16,
  },
  scoreMeta: {
    flex: 1,
    gap: 2,
  },
  scoreSource: {
    color: theme.colors.textPrimary,
    fontSize: 14,
  },
  votesText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  rows: {
    gap: theme.spacing.sm,
  },
  infoRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: theme.spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.accentPrimary,
    marginTop: 6,
  },
  infoText: {
    flex: 1,
    color: theme.colors.textStrongBody,
    fontSize: 13,
    lineHeight: 19,
  },
});
