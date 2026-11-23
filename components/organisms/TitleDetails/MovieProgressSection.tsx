import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/atoms/AppText';
import { Theme, withAlpha } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';

type MovieProgressSectionProps = {
  titleName: string;
  watched: boolean;
  onToggleWatched: () => void;
};

/** Bloco de progresso para filmes com barra visual e ação de marcar/desmarcar como assistido. */
export function MovieProgressSection({
  titleName,
  watched,
  onToggleWatched,
}: MovieProgressSectionProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.movieProgressSection}>
      <View style={styles.movieProgressHeader}>
        <AppText tipo="subtitulo" peso="forte" style={styles.sectionTitle}>
          Progresso
        </AppText>
        <AppText tipo="legenda" peso="forte" style={styles.movieProgressPercent}>
          {watched ? '100%' : '0%'}
        </AppText>
      </View>

      <View
        style={[
          styles.movieProgressCard,
          watched && { borderColor: withAlpha(colors.successText, 0.42) },
        ]}>
        <View style={styles.movieProgressTrack}>
          <View
            style={[
              styles.movieProgressFill,
              {
                width: watched ? '100%' : '0%',
                backgroundColor: watched ? colors.successText : colors.accentPrimary,
              },
            ]}
          />
        </View>

        <View style={styles.movieProgressRow}>
          <AppText tipo="legenda" style={styles.movieProgressHint}>
            {watched
              ? 'Você já assistiu a este filme.'
              : 'Ainda não marcado como assistido.'}
          </AppText>
          <Pressable
            onPress={onToggleWatched}
            style={({ pressed }) => [
              styles.movieMarkButton,
              watched ? styles.movieMarkButtonDone : styles.movieMarkButtonDefault,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ checked: watched }}
            accessibilityLabel={
              watched
                ? `Desmarcar ${titleName} como assistido`
                : `Marcar ${titleName} como assistido`
            }>
            <MaterialIcons
              name={watched ? 'check-circle' : 'radio-button-unchecked'}
              size={16}
              color={watched ? colors.successText : colors.textPrimary}
            />
            <AppText
              tipo="legenda"
              peso="forte"
              style={[styles.movieMarkText, watched && styles.movieMarkTextDone]}>
              {watched ? 'Assistido' : 'Marcar'}
            </AppText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    marginBottom: 2,
  },
  movieProgressSection: {
    gap: theme.spacing.sm,
  },
  movieProgressHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
  },
  movieProgressPercent: {
    color: theme.colors.textSecondary,
    fontSize: 12.5,
  },
  movieProgressCard: {
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  movieProgressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.bgSurfaceAlt,
    overflow: 'hidden' as const,
  },
  movieProgressFill: {
    height: '100%' as const,
    borderRadius: 4,
  },
  movieProgressRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
  },
  movieProgressHint: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  movieMarkButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  movieMarkButtonDefault: {
    backgroundColor: theme.colors.bgSurfaceAlt,
    borderColor: theme.colors.borderSubtle,
  },
  movieMarkButtonDone: {
    backgroundColor: theme.colors.bgSuccess,
    borderColor: theme.colors.borderSuccess,
  },
  movieMarkText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
  },
  movieMarkTextDone: {
    color: theme.colors.successText,
  },
});
