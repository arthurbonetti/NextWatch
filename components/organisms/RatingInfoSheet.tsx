import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AnimatedModalShell } from '@/components/atoms/AnimatedModalShell';
import { AppText } from '@/components/atoms/AppText';
import { formatAverageRating, getMetacriticScore, MediaTitle } from '@/constants/catalog';
import { THEME } from '@/constants/theme';
import { formatCount } from '@/utils/format';

type RatingInfoSheetProps = {
  visible: boolean;
  title: MediaTitle;
  voteCount?: number | null;
  onClose: () => void;
};

export function RatingInfoSheet({ visible, title, voteCount, onClose }: RatingInfoSheetProps) {
  const metacriticScore = getMetacriticScore(title);
  const formattedVotes = typeof voteCount === 'number' && voteCount > 0 ? formatCount(voteCount) : null;

  return (
    <AnimatedModalShell
      visible={visible}
      variant="sheet"
      onClose={onClose}
      showSheetHandle={false}
      sheetStyle={styles.card}>
      <View style={styles.handle} />
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <MaterialIcons name="star" size={18} color={THEME.colors.gold} />
          <AppText tipo="subtitulo" peso="forte" style={styles.title}>
            Fontes das avaliações
          </AppText>
        </View>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Fechar informações da nota">
          <MaterialIcons name="close" size={18} color={THEME.colors.textPrimary} />
        </Pressable>
      </View>

      <View style={styles.scoreHero}>
        <View style={styles.scoreBadge}>
          <MaterialIcons name="star" size={15} color={THEME.colors.gold} />
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.bgCard,
    borderTopLeftRadius: THEME.radius.xl,
    borderTopRightRadius: THEME.radius.xl,
    paddingHorizontal: THEME.spacing.lg,
    paddingTop: THEME.spacing.sm,
    paddingBottom: THEME.spacing.xxl,
    gap: THEME.spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: THEME.colors.handle,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: THEME.spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
  },
  title: {
    color: THEME.colors.textPrimary,
    fontSize: 17,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: THEME.colors.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
  scoreHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.md,
    backgroundColor: THEME.colors.bgSubtle,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: THEME.colors.navy,
    borderRadius: THEME.radius.sm,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  scoreText: {
    color: THEME.colors.textOnNavy,
    fontSize: 16,
  },
  scoreMeta: {
    flex: 1,
    gap: 2,
  },
  scoreSource: {
    color: THEME.colors.textPrimary,
    fontSize: 14,
  },
  votesText: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  rows: {
    gap: THEME.spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: THEME.spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.accent,
    marginTop: 6,
  },
  infoText: {
    flex: 1,
    color: THEME.colors.textStrongBody,
    fontSize: 13,
    lineHeight: 19,
  },
});
