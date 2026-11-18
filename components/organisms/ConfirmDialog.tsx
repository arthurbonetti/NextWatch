import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AnimatedModalShell, useCenterEntranceStyle } from '@/components/atoms/AnimatedModalShell';
import { AppText } from '@/components/atoms/AppText';
import { THEME } from '@/constants/theme';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

type ConfirmDialogProps = {
  visible: boolean;
  icon: MaterialIconName;
  eyebrow: string;
  title: string;
  message: string;
  confirmLabel: string;
  confirmIcon?: MaterialIconName;
  cancelLabel?: string;
  tone?: 'danger' | 'warning';
  inline?: boolean;
  cancelAccessibilityLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  visible,
  icon,
  eyebrow,
  title,
  message,
  confirmLabel,
  confirmIcon,
  cancelLabel = 'Cancelar',
  tone = 'danger',
  inline = false,
  cancelAccessibilityLabel = 'Cancelar',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const inlineEntranceStyle = useCenterEntranceStyle(visible && inline);

  if (!visible) return null;
  const isWarning = tone === 'warning';

  const cardBody = (
    <View style={styles.card}>
      <View style={[styles.iconBadge, isWarning ? styles.iconBadgeWarning : styles.iconBadgeDanger]}>
        <MaterialIcons
          name={icon}
          size={24}
          color={isWarning ? THEME.colors.accentDeep : THEME.colors.mcRed}
        />
      </View>
      <AppText tipo="legenda" peso="forte" style={[styles.eyebrow, isWarning && styles.eyebrowWarning]}>
        {eyebrow}
      </AppText>
      <AppText tipo="subtitulo" familia="editorial" peso="forte" style={styles.title}>
        {title}
      </AppText>
      <AppText tipo="legenda" style={styles.message}>
        {message}
      </AppText>
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [
            styles.confirmButton,
            isWarning ? styles.confirmButtonWarning : styles.confirmButtonDanger,
            pressed && styles.pressed,
          ]}
          onPress={onConfirm}
          accessibilityRole="button">
          {confirmIcon && (
            <MaterialIcons
              name={confirmIcon}
              size={18}
              color={isWarning ? THEME.colors.navy : THEME.colors.textOnNavy}
            />
          )}
          <AppText
            peso="forte"
            style={[styles.confirmText, isWarning ? styles.confirmTextWarning : styles.confirmTextDanger]}
            numberOfLines={1}>
            {confirmLabel}
          </AppText>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
          onPress={onCancel}
          accessibilityRole="button">
          <AppText peso="forte" style={styles.cancelText}>
            {cancelLabel}
          </AppText>
        </Pressable>
      </View>
    </View>
  );

  if (inline) {
    return (
      <View style={styles.inlineBackdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          accessibilityLabel={cancelAccessibilityLabel}
        />
        <Animated.View style={[styles.inlineCardWrap, inlineEntranceStyle]}>
          {cardBody}
        </Animated.View>
      </View>
    );
  }

  return (
    <AnimatedModalShell
      visible={visible}
      onClose={onCancel}
      variant="center"
      maxWidth={360}
      backdropAccessibilityLabel={cancelAccessibilityLabel}>
      {cardBody}
    </AnimatedModalShell>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  inlineBackdrop: {
    ...StyleSheet.absoluteFill,
    padding: THEME.spacing.s24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.backdropDark,
    opacity: 1,
  },
  inlineCardWrap: {
    width: '100%',
    maxWidth: 360,
  },
  card: {
    width: '100%',
    alignItems: 'center',
    borderRadius: THEME.radius.card,
    paddingHorizontal: THEME.spacing.s22,
    paddingTop: THEME.spacing.s24,
    paddingBottom: THEME.spacing.s20,
    backgroundColor: THEME.colors.bgCard,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: THEME.spacing.xl,
  },
  iconBadgeDanger: { backgroundColor: THEME.colors.bgDanger, borderColor: THEME.colors.borderDanger },
  iconBadgeWarning: { backgroundColor: THEME.colors.bgWarning, borderColor: THEME.colors.borderWarning },
  eyebrow: { color: THEME.colors.mcRed, letterSpacing: 1.3, textAlign: 'center', marginBottom: THEME.spacing.sm },
  eyebrowWarning: { color: THEME.colors.accent },
  title: {
    color: THEME.colors.textPrimary,
    fontSize: 21,
    lineHeight: 26,
    letterSpacing: -0.35,
    textAlign: 'center',
    marginBottom: THEME.spacing.md,
  },
  message: {
    color: THEME.colors.textSecondary,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: THEME.spacing.s20,
  },
  actions: { width: '100%', gap: THEME.spacing.base },
  confirmButton: {
    width: '100%',
    minHeight: 48,
    borderRadius: THEME.radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: THEME.spacing.md,
    paddingHorizontal: THEME.spacing.xxl,
  },
  confirmButtonDanger: { backgroundColor: THEME.colors.mcRed },
  confirmButtonWarning: { backgroundColor: THEME.colors.gold },
  confirmText: { fontSize: 14.5, textAlign: 'center' },
  confirmTextDanger: { color: THEME.colors.textOnNavy },
  confirmTextWarning: { color: THEME.colors.navy },
  cancelButton: {
    width: '100%',
    minHeight: 46,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.borderMedium,
    backgroundColor: THEME.colors.bgCanvas,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: THEME.spacing.xxl,
  },
  cancelText: { color: THEME.colors.textPrimary, fontSize: 14.5, textAlign: 'center' },
});
