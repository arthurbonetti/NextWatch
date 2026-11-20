import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ComponentProps, useCallback, useEffect, useRef, useState } from 'react';
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
        <MaterialIcons
          name={activeCopy.icon}
          size={24}
          color={isWarning ? THEME.colors.accentDeep : THEME.colors.mcRed}
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
            <MaterialIcons
              name={activeCopy.confirmIcon}
              size={18}
              color={isWarning ? THEME.colors.navy : THEME.colors.textOnNavy}
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
