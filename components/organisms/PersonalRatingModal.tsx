import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AnimatedModalShell } from '@/components/atoms/AnimatedModalShell';
import { AppIcon } from '@/components/atoms/AppIcon';
import { AppText } from '@/components/atoms/AppText';
import { Theme, withAlpha } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';
import { triggerSelectionHaptic, triggerSuccessHaptic } from '@/utils/haptics';
import {
  formatUserRatingCount,
  formatUserRatingOutOfFive,
  getStarQualityLabel,
  type TitleRatingSummary,
} from '@/utils/titleRating';

type PersonalRatingModalProps = {
  visible: boolean;
  titleName: string;
  initialRating: number | null;
  communitySummary?: TitleRatingSummary | null;
  canRate?: boolean;
  watchRequirementHint?: string;
  onSave: (rating: number | null) => void;
  onClose: () => void;
};

type AnimatedStarButtonProps = {
  star: number;
  active: boolean;
  onPress: () => void;
};

function AnimatedStarButton({ star, active, onPress }: AnimatedStarButtonProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  const handlePress = () => {
    triggerSelectionHaptic();
    if (!reducedMotion) {
      scale.set(
        withSequence(
          withTiming(1.18, { duration: 95, easing: Easing.out(Easing.cubic) }),
          withTiming(1, { duration: 140, easing: Easing.out(Easing.cubic) }),
        ),
      );
    }
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`Avaliar com ${star} ${star === 1 ? 'estrela' : 'estrelas'} de 5`}
      style={({ pressed }) => [styles.starButton, pressed && styles.starButtonPressed]}>
      <Animated.View style={animatedStyle}>
        <MaterialIcons
          name={active ? 'star' : 'star-border'}
          size={34}
          color={active ? colors.accentPrimary : colors.textMuted}
        />
      </Animated.View>
    </Pressable>
  );
}

/** Modal editorial para avaliar uma obra de 0 a 5 estrelas após assistir parte dela. */
export function PersonalRatingModal({
  visible,
  titleName,
  initialRating,
  communitySummary,
  canRate = true,
  watchRequirementHint = 'Assista a qualquer parte da obra para avaliar.',
  onSave,
  onClose,
}: PersonalRatingModalProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const [prevVisible, setPrevVisible] = useState(visible);
  const [prevInitial, setPrevInitial] = useState(initialRating);
  const [selectedRating, setSelectedRating] = useState<number | null>(initialRating);

  if (visible && !prevVisible) {
    setPrevVisible(true);
    setPrevInitial(initialRating);
    setSelectedRating(initialRating);
  } else if (!visible && prevVisible) {
    setPrevVisible(false);
  } else if (visible && initialRating !== prevInitial) {
    setPrevInitial(initialRating);
    if (selectedRating === prevInitial) {
      setSelectedRating(initialRating);
    }
  }

  const handleSavePress = () => {
    if (!canRate || selectedRating === null) return;
    triggerSuccessHaptic();
    onSave(selectedRating);
    onClose();
  };

  const handleRemovePress = () => {
    triggerSelectionHaptic();
    onSave(null);
    onClose();
  };

  const hasSelected = selectedRating !== null;
  const communityFormatted = formatUserRatingOutOfFive(communitySummary);
  const communityCount = communitySummary?.count ?? 0;

  return (
    <AnimatedModalShell
      visible={visible}
      variant="center"
      onClose={onClose}
      maxWidth={360}
      backdropDismissible
      backdropAccessibilityLabel="Fechar avaliação">
      <View style={styles.card}>
        <Pressable
          onPress={onClose}
          hitSlop={8}
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Fechar">
          <AppIcon name="close" size={18} color={colors.textSecondary} />
        </Pressable>

        <View style={styles.heroIconWrap}>
          <MaterialIcons name="star" size={26} color={colors.textOnAccent} />
        </View>

        <AppText tipo="legenda" peso="forte" style={styles.eyebrow}>
          SUA AVALIAÇÃO
        </AppText>
        <AppText tipo="subtitulo" familia="editorial" peso="forte" style={styles.title}>
          Como você avaliaria?
        </AppText>
        <AppText tipo="legenda" style={styles.subtitle} numberOfLines={2}>
          {titleName}
        </AppText>

        {communitySummary !== undefined && (
          <View style={styles.communityPill}>
            <MaterialIcons name="people" size={14} color={colors.accentLink} />
            <AppText tipo="legenda" peso="semiforte" tabular style={styles.communityText}>
              Média dos usuários: {communityFormatted}
              {communityCount > 0 ? ` (${formatUserRatingCount(communityCount)})` : ''}
            </AppText>
          </View>
        )}

        <View style={styles.scoreSection}>
          <View style={styles.scoreRow}>
            <AppText
              tipo="titulo"
              peso="forte"
              tabular
              style={[styles.score, !hasSelected && styles.scoreEmpty]}>
              {hasSelected ? selectedRating : '—'}
            </AppText>
            <AppText tipo="subtitulo" peso="semiforte" style={styles.scoreOutOf}>
              /5
            </AppText>
          </View>

          <View
            style={[
              styles.qualityBadge,
              hasSelected ? styles.qualityBadgeActive : styles.qualityBadgeIdle,
            ]}>
            <AppText
              tipo="legenda"
              peso="forte"
              style={hasSelected ? styles.qualityTextActive : styles.qualityTextIdle}>
              {getStarQualityLabel(selectedRating)}
            </AppText>
          </View>
        </View>

        {!canRate ? (
          <View style={styles.lockedBanner}>
            <MaterialIcons name="lock-outline" size={18} color={colors.textMuted} />
            <AppText tipo="legenda" style={styles.lockedText}>
              {watchRequirementHint}
            </AppText>
          </View>
        ) : (
          <>
            <View style={styles.starsBox}>
              {Array.from({ length: 5 }, (_, index) => index + 1).map((star) => (
                <AnimatedStarButton
                  key={star}
                  star={star}
                  active={selectedRating !== null && star <= selectedRating}
                  onPress={() =>
                    setSelectedRating((current) => (current === star ? null : star))
                  }
                />
              ))}
            </View>

            <Pressable
              onPress={() => {
                triggerSelectionHaptic();
                setSelectedRating((current) => (current === 0 ? null : 0));
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedRating === 0 }}
              accessibilityLabel="Avaliar com zero estrelas de cinco"
              style={({ pressed }) => [
                styles.zeroChip,
                selectedRating === 0 && styles.zeroChipActive,
                pressed && styles.pressed,
              ]}>
              <MaterialIcons
                name={selectedRating === 0 ? 'check-circle' : 'radio-button-unchecked'}
                size={15}
                color={selectedRating === 0 ? colors.badgeAccentText : colors.textMuted}
              />
              <AppText
                tipo="legenda"
                peso="forte"
                style={[
                  styles.zeroChipText,
                  selectedRating === 0 && styles.zeroChipTextActive,
                ]}>
                Avaliar com 0 estrelas
              </AppText>
            </Pressable>
          </>
        )}

        {canRate && initialRating !== null && (
          <Pressable
            onPress={handleRemovePress}
            accessibilityRole="button"
            accessibilityLabel="Remover minha avaliação"
            style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}>
            <MaterialIcons name="delete-outline" size={15} color={colors.dangerText} />
            <AppText tipo="legenda" peso="forte" style={styles.removeText}>
              Remover minha nota
            </AppText>
          </Pressable>
        )}

        <View style={styles.actions}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cancelar avaliação"
            style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}>
            <AppText tipo="texto" peso="forte" style={styles.cancelButtonText}>
              {canRate ? 'Agora não' : 'Fechar'}
            </AppText>
          </Pressable>

          {canRate && (
            <Pressable
              disabled={!hasSelected}
              onPress={handleSavePress}
              accessibilityRole="button"
              accessibilityState={{ disabled: !hasSelected }}
              accessibilityLabel="Salvar nota"
              style={({ pressed }) => [
                styles.saveButton,
                !hasSelected && styles.saveButtonDisabled,
                pressed && hasSelected && styles.pressed,
              ]}>
              <MaterialIcons
                name="check"
                size={18}
                color={hasSelected ? colors.textOnAccent : colors.buttonDisabledText}
              />
              <AppText
                tipo="texto"
                peso="forte"
                style={[
                  styles.saveButtonText,
                  !hasSelected && styles.saveButtonTextDisabled,
                ]}>
                Salvar nota
              </AppText>
            </Pressable>
          )}
        </View>
      </View>
    </AnimatedModalShell>
  );
}

const createStyles = (theme: Theme) => ({
  pressed: { opacity: 0.84, transform: [{ scale: 0.98 }] },
  card: {
    width: '100%' as const,
    alignItems: 'center' as const,
    borderRadius: theme.radius.sheet,
    paddingHorizontal: theme.spacing.s20,
    paddingTop: theme.spacing.s22,
    paddingBottom: theme.spacing.s20,
    backgroundColor: theme.colors.bgSurface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  closeButton: {
    position: 'absolute' as const,
    top: theme.spacing.md,
    right: theme.spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.colors.bgSurfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.colors.accentPrimary,
    borderWidth: 3,
    borderColor: withAlpha(theme.colors.accentPrimary, 0.28),
  },
  eyebrow: {
    marginTop: theme.spacing.md,
    color: theme.colors.accentLink,
    fontSize: 11,
    letterSpacing: 1.4,
  },
  title: {
    marginTop: 4,
    color: theme.colors.textPrimary,
    fontSize: 21,
    lineHeight: 26,
    textAlign: 'center' as const,
  },
  subtitle: {
    marginTop: 4,
    color: theme.colors.textSecondary,
    textAlign: 'center' as const,
    fontSize: 13,
    lineHeight: 18,
  },
  communityPill: {
    marginTop: theme.spacing.md,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.bgSurfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  communityText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  scoreSection: {
    alignItems: 'center' as const,
    marginTop: theme.spacing.md,
    gap: 6,
  },
  scoreRow: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
  },
  score: {
    color: theme.colors.accentPrimary,
    fontSize: 40,
    lineHeight: 46,
  },
  scoreEmpty: {
    color: theme.colors.textMuted,
  },
  scoreOutOf: {
    color: theme.colors.textSecondary,
    marginLeft: 3,
    fontSize: 16,
  },
  qualityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
  },
  qualityBadgeActive: {
    backgroundColor: theme.colors.badgeAccentBg,
    borderColor: theme.colors.badgeAccentBorder,
  },
  qualityBadgeIdle: {
    backgroundColor: theme.colors.bgSurfaceAlt,
    borderColor: theme.colors.borderSubtle,
  },
  qualityTextActive: {
    color: theme.colors.badgeAccentText,
    fontSize: 12,
  },
  qualityTextIdle: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  starsBox: {
    width: '100%' as const,
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    gap: 2,
    marginTop: theme.spacing.lg,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.bgSurfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  starButton: {
    width: 48,
    height: 48,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  starButtonPressed: {
    opacity: 0.8,
  },
  zeroChip: {
    marginTop: theme.spacing.md,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bgSurfaceAlt,
  },
  zeroChipActive: {
    backgroundColor: theme.colors.badgeAccentBg,
    borderColor: theme.colors.badgeAccentBorder,
  },
  zeroChipText: {
    color: theme.colors.textSecondary,
    fontSize: 12.5,
  },
  zeroChipTextActive: {
    color: theme.colors.badgeAccentText,
  },
  lockedBanner: {
    width: '100%' as const,
    marginTop: theme.spacing.lg,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bgSurfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  lockedText: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: 12.5,
    lineHeight: 18,
  },
  removeButton: {
    marginTop: theme.spacing.md,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  removeText: {
    color: theme.colors.dangerText,
    fontSize: 12.5,
  },
  actions: {
    width: '100%' as const,
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  cancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bgSurfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 12,
  },
  cancelButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
  },
  saveButton: {
    flex: 1.2,
    minHeight: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accentPrimary,
    borderWidth: 1,
    borderColor: theme.colors.accentPrimary,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingHorizontal: 14,
  },
  saveButtonDisabled: {
    backgroundColor: theme.colors.buttonDisabledBg,
    borderColor: theme.colors.buttonDisabledBorder,
  },
  saveButtonText: {
    color: theme.colors.textOnAccent,
    fontSize: 14,
  },
  saveButtonTextDisabled: {
    color: theme.colors.buttonDisabledText,
  },
});
