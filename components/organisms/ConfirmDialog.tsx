import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AnimatedModalShell } from '@/components/atoms/AnimatedModalShell';
import { AppIcon, type MaterialIconName } from '@/components/atoms/AppIcon';
import { AppText } from '@/components/atoms/AppText';
import { Theme, THEME } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';

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
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const reducedMotion = useReducedMotion();
  const [cachedCopy, setCachedCopy] = useState({
    icon,
    eyebrow,
    title,
    message,
    confirmLabel,
    confirmIcon,
    cancelLabel,
    tone,
    cancelAccessibilityLabel,
  });

  if (
    visible &&
    (cachedCopy.icon !== icon ||
      cachedCopy.eyebrow !== eyebrow ||
      cachedCopy.title !== title ||
      cachedCopy.message !== message ||
      cachedCopy.confirmLabel !== confirmLabel ||
      cachedCopy.confirmIcon !== confirmIcon ||
      cachedCopy.cancelLabel !== cancelLabel ||
      cachedCopy.tone !== tone ||
      cachedCopy.cancelAccessibilityLabel !== cancelAccessibilityLabel)
  ) {
    setCachedCopy({
      icon,
      eyebrow,
      title,
      message,
      confirmLabel,
      confirmIcon,
      cancelLabel,
      tone,
      cancelAccessibilityLabel,
    });
  }

  const shouldShowInline = inline && visible;
  const [inlineRendered, setInlineRendered] = useState(shouldShowInline);
  if (shouldShowInline && !inlineRendered) {
    setInlineRendered(true);
  } else if (!shouldShowInline && inlineRendered && reducedMotion) {
    setInlineRendered(false);
  }

  const inlineBackdropOpacity = useSharedValue(0);
  const inlineCardOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const inlineScale = useSharedValue(reducedMotion ? 1 : 0.92);
  const inlineTranslateY = useSharedValue(reducedMotion ? 0 : 12);
  const inlineTokenRef = useRef(0);
  const isInlineVisibleRef = useRef(inline && visible);

  useEffect(() => {
    isInlineVisibleRef.current = inline && visible;
  }, [inline, visible]);

  const handleInlineExitComplete = useCallback((token: number) => {
    if (token !== inlineTokenRef.current || isInlineVisibleRef.current) return;
    setInlineRendered(false);
  }, []);

  useEffect(() => {
    if (!inline || !inlineRendered) return;

    cancelAnimation(inlineBackdropOpacity);
    cancelAnimation(inlineCardOpacity);
    cancelAnimation(inlineScale);
    cancelAnimation(inlineTranslateY);

    if (visible) {
      inlineTokenRef.current += 1;
      if (reducedMotion) {
        inlineBackdropOpacity.set(1);
        inlineCardOpacity.set(1);
        inlineScale.set(1);
        inlineTranslateY.set(0);
        return;
      }

      inlineBackdropOpacity.set(0);
      inlineCardOpacity.set(0);
      inlineScale.set(0.92);
      inlineTranslateY.set(12);

      inlineBackdropOpacity.set(
        withTiming(1, { duration: THEME.motion.backdropFadeMs, easing: Easing.out(Easing.cubic) }),
      );
      inlineCardOpacity.set(
        withTiming(1, { duration: THEME.motion.backdropFadeMs, easing: Easing.out(Easing.cubic) }),
      );
      inlineScale.set(withSpring(1, THEME.motion.centerEnterSpring));
      inlineTranslateY.set(withSpring(0, THEME.motion.centerEnterSpring));
      return;
    }

    if (reducedMotion) {
      return;
    }

    const token = ++inlineTokenRef.current;
    const exitDuration = THEME.motion.modalExitMs;

    inlineBackdropOpacity.set(
      withTiming(0, { duration: exitDuration, easing: Easing.in(Easing.cubic) }),
    );
    inlineScale.set(withTiming(0.94, { duration: exitDuration, easing: Easing.in(Easing.cubic) }));
    inlineTranslateY.set(withTiming(10, { duration: exitDuration, easing: Easing.in(Easing.cubic) }));
    inlineCardOpacity.set(
      withTiming(0, { duration: exitDuration, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) {
          scheduleOnRN(handleInlineExitComplete, token);
        }
      }),
    );
  }, [
    handleInlineExitComplete,
    inline,
    inlineBackdropOpacity,
    inlineCardOpacity,
    inlineRendered,
    inlineScale,
    inlineTranslateY,
    reducedMotion,
    visible,
  ]);

  const inlineBackdropStyle = useAnimatedStyle(() => ({
    opacity: inlineBackdropOpacity.get(),
  }));

  const inlineEntranceStyle = useAnimatedStyle(() => ({
    opacity: inlineCardOpacity.get(),
    transform: [{ translateY: inlineTranslateY.get() }, { scale: inlineScale.get() }],
  }));

  const activeCopy = visible
    ? {
        icon,
        eyebrow,
        title,
        message,
        confirmLabel,
        confirmIcon,
        cancelLabel,
        tone,
        cancelAccessibilityLabel,
      }
    : cachedCopy;
  const isWarning = activeCopy.tone === 'warning';

  const cardBody = (
    <View style={styles.card}>
      <View style={[styles.iconBadge, isWarning ? styles.iconBadgeWarning : styles.iconBadgeDanger]}>
        <AppIcon
          name={activeCopy.icon}
          size={24}
          color={isWarning ? colors.accentLink : colors.dangerText}
        />
      </View>
      <AppText tipo="legenda" peso="forte" style={[styles.eyebrow, isWarning && styles.eyebrowWarning]}>
        {activeCopy.eyebrow}
      </AppText>
      <AppText tipo="subtitulo" familia="editorial" peso="forte" style={styles.title}>
        {activeCopy.title}
      </AppText>
      <AppText tipo="legenda" style={styles.message}>
        {activeCopy.message}
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
          {activeCopy.confirmIcon && (
            <AppIcon
              name={activeCopy.confirmIcon}
              size={18}
              color={isWarning ? colors.textOnAccent : colors.textOnNavy}
            />
          )}
          <AppText
            peso="forte"
            style={[styles.confirmText, isWarning ? styles.confirmTextWarning : styles.confirmTextDanger]}
            numberOfLines={1}>
            {activeCopy.confirmLabel}
          </AppText>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
          onPress={onCancel}
          accessibilityRole="button">
          <AppText peso="forte" style={styles.cancelText}>
            {activeCopy.cancelLabel}
          </AppText>
        </Pressable>
      </View>
    </View>
  );

  if (inline) {
    if (!inlineRendered) return null;
    return (
      <Animated.View
        style={[styles.inlineBackdrop, inlineBackdropStyle, { pointerEvents: visible ? 'auto' : 'none' }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          accessibilityLabel={activeCopy.cancelAccessibilityLabel}
        />
        <Animated.View style={[styles.inlineCardWrap, inlineEntranceStyle]}>
          {cardBody}
        </Animated.View>
      </Animated.View>
    );
  }

  return (
    <AnimatedModalShell
      visible={visible}
      onClose={onCancel}
      variant="center"
      maxWidth={360}
      backdropAccessibilityLabel={activeCopy.cancelAccessibilityLabel}>
      {cardBody}
    </AnimatedModalShell>
  );
}

const createStyles = (theme: Theme) => ({
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  inlineBackdrop: {
    ...StyleSheet.absoluteFill,
    padding: theme.spacing.s24,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.colors.backdropDark,
    opacity: 1,
  },
  inlineCardWrap: {
    width: '100%' as const,
    maxWidth: 360,
  },
  card: {
    width: '100%' as const,
    alignItems: 'center' as const,
    borderRadius: theme.radius.card,
    paddingHorizontal: theme.spacing.s22,
    paddingTop: theme.spacing.s24,
    paddingBottom: theme.spacing.s20,
    backgroundColor: theme.colors.bgSurface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: theme.spacing.xl,
  },
  iconBadgeDanger: { backgroundColor: theme.colors.dangerIconBg, borderColor: theme.colors.dangerBorder },
  iconBadgeWarning: { backgroundColor: theme.colors.bgWarning, borderColor: theme.colors.borderWarning },
  eyebrow: { color: theme.colors.dangerText, letterSpacing: 1.3, textAlign: 'center' as const, marginBottom: theme.spacing.sm },
  eyebrowWarning: { color: theme.colors.accentLink },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 21,
    lineHeight: 26,
    letterSpacing: -0.35,
    textAlign: 'center' as const,
    marginBottom: theme.spacing.md,
  },
  message: {
    color: theme.colors.textSecondary,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center' as const,
    marginBottom: theme.spacing.s20,
  },
  actions: { width: '100%' as const, gap: theme.spacing.base },
  confirmButton: {
    width: '100%' as const,
    minHeight: 48,
    borderRadius: theme.radius.lg,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.xxl,
  },
  confirmButtonDanger: { backgroundColor: theme.colors.dangerSolidBg },
  confirmButtonWarning: { backgroundColor: theme.colors.accentPrimary },
  confirmText: { fontSize: 14.5, textAlign: 'center' as const },
  confirmTextDanger: { color: theme.colors.textOnNavy },
  confirmTextWarning: { color: theme.colors.textOnAccent },
  cancelButton: {
    width: '100%' as const,
    minHeight: 46,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bgSurfaceAlt,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: theme.spacing.xxl,
  },
  cancelText: { color: theme.colors.textPrimary, fontSize: 14.5, textAlign: 'center' as const },
});
