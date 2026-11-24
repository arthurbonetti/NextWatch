import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AnimatedModalShell } from '@/components/atoms/AnimatedModalShell';
import { AppButton } from '@/components/atoms/AppButton';
import { AppText } from '@/components/atoms/AppText';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';

type PersonalRatingModalProps = {
  visible: boolean;
  titleName: string;
  initialRating: number | null;
  onSave: (rating: number | null) => void;
  onClose: () => void;
};

export function PersonalRatingModal({
  visible,
  titleName,
  initialRating,
  onSave,
  onClose,
}: PersonalRatingModalProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [selectedRating, setSelectedRating] = useState<number | null>(initialRating);

  useEffect(() => {
    if (visible) setSelectedRating(initialRating);
  }, [initialRating, visible]);

  const handleSave = () => {
    onSave(selectedRating);
    onClose();
  };

  return (
    <AnimatedModalShell
      visible={visible}
      variant="center"
      onClose={onClose}
      maxWidth={320}
      backdropDismissible
      backdropAccessibilityLabel="Fechar avaliação">
      <View style={styles.card}>
        <View style={styles.iconBadge}>
          <MaterialIcons name="star" size={25} color={colors.accentPrimary} />
        </View>
        <AppText tipo="subtitulo" peso="forte" style={styles.title}>Como você avaliaria?</AppText>
        <AppText tipo="legenda" style={styles.subtitle} numberOfLines={2}>{titleName}</AppText>

        <View style={styles.scoreRow}>
          <AppText tipo="titulo" peso="forte" style={styles.score}>
            {selectedRating === null ? '—' : selectedRating}
          </AppText>
          <AppText tipo="texto" style={styles.scoreOutOf}>/5</AppText>
        </View>

        <View style={styles.starsRow}>
          {Array.from({ length: 5 }, (_, index) => index + 1).map((star) => {
            const active = selectedRating !== null && star <= selectedRating;
            return (
              <Pressable
                key={star}
                onPress={() => setSelectedRating(star)}
                accessibilityRole="button"
                accessibilityLabel={`Avaliar com ${star} de 5`}
                style={({ pressed }) => [styles.starButton, pressed && styles.pressed]}>
                <MaterialIcons
                  name={active ? 'star' : 'star-border'}
                  size={32}
                  color={active ? colors.accentPrimary : colors.textMuted}
                />
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => setSelectedRating(0)}
          accessibilityRole="button"
          accessibilityLabel="Avaliar com zero de cinco"
          style={({ pressed }) => [styles.zeroButton, pressed && styles.pressed]}>
          <AppText tipo="legenda" peso="forte" style={styles.zeroText}>Avaliar com 0</AppText>
        </Pressable>

        <View style={styles.actions}>
          <AppButton titulo="Depois" onPress={onClose} estilo={styles.secondaryButton} />
          <AppButton
            titulo={selectedRating === null ? 'Não avaliar' : 'Salvar nota'}
            onPress={handleSave}
            disabled={selectedRating === null}
            estilo={styles.primaryButton}
          />
        </View>
      </View>
    </AnimatedModalShell>
  );
}

const createStyles = (theme: Theme) => ({
  card: {
    width: '100%' as const,
    alignItems: 'center' as const,
    borderRadius: theme.radius.sheet,
    paddingHorizontal: theme.spacing.s20,
    paddingTop: theme.spacing.s20,
    paddingBottom: theme.spacing.s18,
    backgroundColor: theme.colors.bgSurface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.colors.accentPrimary,
  },
  title: { marginTop: theme.spacing.sm, color: theme.colors.textPrimary, textAlign: 'center' as const },
  subtitle: { marginTop: 4, color: theme.colors.textSecondary, textAlign: 'center' as const },
  scoreRow: { flexDirection: 'row' as const, alignItems: 'baseline' as const, marginTop: theme.spacing.md },
  score: { color: theme.colors.accentPrimary, fontSize: 38, lineHeight: 44 },
  scoreOutOf: { color: theme.colors.textSecondary, marginLeft: 4 },
  starsRow: {
    width: '100%' as const,
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    flexWrap: 'wrap' as const,
    gap: 2,
    marginTop: theme.spacing.sm,
  },
  starButton: { width: 44, height: 44, alignItems: 'center' as const, justifyContent: 'center' as const },
  zeroButton: { marginTop: theme.spacing.sm, paddingVertical: 8, paddingHorizontal: 12 },
  zeroText: { color: theme.colors.accentLink },
  actions: { width: '100%' as const, flexDirection: 'row' as const, gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  primaryButton: { flex: 1, borderRadius: theme.radius.md },
  secondaryButton: { flex: 1, borderRadius: theme.radius.md, backgroundColor: theme.colors.bgSurface },
  pressed: { opacity: 0.75, transform: [{ scale: 0.96 }] },
});
