import { BlurView } from 'expo-blur';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { ModalPortal } from '@/components/atoms/ModalPortal';
import { THEME } from '@/constants/theme';

const SHEET_ENTER_OFFSET = 72;
const CENTER_ENTER_OFFSET = 14;

export type ModalShellVariant = 'center' | 'sheet';

type AnimatedModalShellProps = {
  visible: boolean;
  onClose: () => void;
  onSheetDismiss?: () => void;
  onRequestClose?: () => void;
  variant?: ModalShellVariant;
  children: ReactNode;
  overlayChildren?: ReactNode;
  maxWidth?: number;
  maxHeight?: number | `${number}%`;
  backdropDismissible?: boolean;
  backdropAccessibilityLabel?: string;
  keyboardAvoiding?: boolean;
  showSheetHandle?: boolean;
  enableSheetDrag?: boolean;
  onSwipeExpandChange?: (expanded: boolean) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  handleAccessibilityLabel?: string;
  layoutAnimated?: boolean;
  sheetStyle?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

/**
 * Hook global de entrada sutil para cards centralizados (usado pelo AnimatedModalShell e ConfirmDialog inline).
 */
export function useCenterEntranceStyle(active: boolean) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!active) return;
    if (reducedMotion) {
      scale.set(1);
      translateY.set(0);
      opacity.set(1);
      return;
    }

    scale.set(0.94);
    translateY.set(10);
    opacity.set(0);

    scale.set(withSpring(1, THEME.motion.centerEnterSpring));
    translateY.set(withSpring(0, THEME.motion.centerEnterSpring));
    opacity.set(withTiming(1, { duration: THEME.motion.backdropFadeMs, easing: Easing.out(Easing.cubic) }));
  }, [active, opacity, reducedMotion, scale, translateY]);

  return useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateY: translateY.get() }, { scale: scale.get() }],
  }));
}

/**
 * Container global de modal do aplicativo com backdrop BlurView,
 * entrada com bounce sutil e curto, e suporte a bottom sheet com gesto de arrastar.
 */
export function AnimatedModalShell({
  visible,
  onClose,
  onSheetDismiss,
  onRequestClose,
  variant = 'center',
  children,
  overlayChildren,
  maxWidth,
  maxHeight,
  backdropDismissible = true,
  backdropAccessibilityLabel = 'Fechar modal',
  keyboardAvoiding = false,
  showSheetHandle = true,
  enableSheetDrag = true,
  onSwipeExpandChange,
  isExpanded = false,
  onToggleExpand,
  handleAccessibilityLabel = 'Arrastar ou tocar para ajustar painel',
  layoutAnimated = false,
  sheetStyle,
  contentContainerStyle,
}: AnimatedModalShellProps) {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const [rendered, setRendered] = useState(visible);
  if (visible && !rendered) {
    setRendered(true);
  } else if (!visible && rendered && reducedMotion) {
    setRendered(false);
  }

  const backdropOpacity = useSharedValue(0);
  const cardScale = useSharedValue(reducedMotion ? 1 : variant === 'center' ? 0.92 : 1);
  const cardOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const translateY = useSharedValue(
    reducedMotion ? 0 : variant === 'sheet' ? SHEET_ENTER_OFFSET : CENTER_ENTER_OFFSET,
  );
  const dismissedBySwipe = useSharedValue(false);

  const wasVisibleRef = useRef(false);
  const prevVariantRef = useRef(variant);
  const closeTokenRef = useRef(0);
  const isVisibleRef = useRef(visible);

  useEffect(() => {
    isVisibleRef.current = visible;
  }, [visible]);

  const handleExitComplete = useCallback((token: number) => {
    if (token !== closeTokenRef.current || isVisibleRef.current) return;
    setRendered(false);
  }, []);

  const handleSwipeDismiss = useCallback(() => {
    setRendered(false);
    const dismissAction = onSheetDismiss ?? onClose;
    dismissAction();
  }, [onClose, onSheetDismiss]);

  useEffect(() => {
    if (!visible) {
      wasVisibleRef.current = false;
      prevVariantRef.current = variant;
    }
    if (!rendered) return;

    if (visible) {
      const justOpened = !wasVisibleRef.current;
      const variantChanged = prevVariantRef.current !== variant;
      wasVisibleRef.current = true;
      prevVariantRef.current = variant;
      closeTokenRef.current += 1;
      dismissedBySwipe.set(false);

      cancelAnimation(backdropOpacity);
      cancelAnimation(cardOpacity);
      cancelAnimation(cardScale);
      cancelAnimation(translateY);

      if (reducedMotion) {
        backdropOpacity.set(1);
        cardScale.set(1);
        cardOpacity.set(1);
        translateY.set(0);
        return;
      }

      if (justOpened) {
        backdropOpacity.set(0);
        backdropOpacity.set(
          withTiming(1, { duration: THEME.motion.backdropFadeMs, easing: Easing.out(Easing.cubic) }),
        );

        if (variant === 'sheet') {
          cardScale.set(1);
          cardOpacity.set(0);
          translateY.set(SHEET_ENTER_OFFSET);
          cardOpacity.set(withTiming(1, { duration: 120, easing: Easing.out(Easing.cubic) }));
          translateY.set(withSpring(0, THEME.motion.sheetEnterSpring));
        } else {
          translateY.set(CENTER_ENTER_OFFSET);
          cardScale.set(0.92);
          cardOpacity.set(0);
          translateY.set(withSpring(0, THEME.motion.centerEnterSpring));
          cardScale.set(withSpring(1, THEME.motion.centerEnterSpring));
          cardOpacity.set(
            withTiming(1, { duration: THEME.motion.backdropFadeMs, easing: Easing.out(Easing.cubic) }),
          );
        }
        return;
      }

      if (variantChanged) {
        translateY.set(0);
        cardOpacity.set(1);
        cardScale.set(0.96);
        cardScale.set(withSpring(1, THEME.motion.centerEnterSpring));
      }
      return;
    }

    wasVisibleRef.current = false;
    prevVariantRef.current = variant;

    if (reducedMotion) {
      return;
    }

    const token = ++closeTokenRef.current;

    if (dismissedBySwipe.get()) {
      dismissedBySwipe.set(false);
      backdropOpacity.set(
        withTiming(0, { duration: 1 }, (finished) => {
          if (finished) {
            scheduleOnRN(handleExitComplete, token);
          }
        }),
      );
      return;
    }

    const exitDuration = THEME.motion.modalExitMs;

    cancelAnimation(backdropOpacity);
    cancelAnimation(cardOpacity);
    cancelAnimation(cardScale);
    cancelAnimation(translateY);

    backdropOpacity.set(withTiming(0, { duration: exitDuration, easing: Easing.in(Easing.cubic) }));

    if (variant === 'sheet') {
      const exitOffset = Math.max(140, Math.round(windowHeight * 0.28));
      translateY.set(withTiming(exitOffset, { duration: exitDuration, easing: Easing.in(Easing.cubic) }));
      cardOpacity.set(
        withTiming(0, { duration: exitDuration, easing: Easing.in(Easing.cubic) }, (finished) => {
          if (finished) {
            scheduleOnRN(handleExitComplete, token);
          }
        }),
      );
    } else {
      translateY.set(withTiming(10, { duration: exitDuration, easing: Easing.in(Easing.cubic) }));
      cardScale.set(withTiming(0.94, { duration: exitDuration, easing: Easing.in(Easing.cubic) }));
      cardOpacity.set(
        withTiming(0, { duration: exitDuration, easing: Easing.in(Easing.cubic) }, (finished) => {
          if (finished) {
            scheduleOnRN(handleExitComplete, token);
          }
        }),
      );
    }
  }, [
    backdropOpacity,
    cardOpacity,
    cardScale,
    dismissedBySwipe,
    handleExitComplete,
    reducedMotion,
    rendered,
    translateY,
    variant,
    visible,
    windowHeight,
  ]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(variant === 'sheet' && enableSheetDrag && visible)
        .activeOffsetY([-6, 6])
        .onUpdate((event) => {
          if (event.translationY > 0) {
            translateY.set(event.translationY);
            if (!isExpanded) {
              backdropOpacity.set(Math.max(0.2, 1 - event.translationY / 420));
            }
          } else {
            translateY.set(event.translationY * 0.25);
          }
        })
        .onEnd((event) => {
          if (onSwipeExpandChange && (event.translationY < -55 || event.velocityY < -500)) {
            backdropOpacity.set(withTiming(1, { duration: 120 }));
            translateY.set(withSpring(0, THEME.motion.sheetDragSnapSpring));
            scheduleOnRN(onSwipeExpandChange, true);
            return;
          }
          if (onSwipeExpandChange && isExpanded && (event.translationY > 55 || event.velocityY > 450)) {
            backdropOpacity.set(withTiming(1, { duration: 120 }));
            translateY.set(withSpring(0, THEME.motion.sheetDragSnapSpring));
            scheduleOnRN(onSwipeExpandChange, false);
            return;
          }
          if (!isExpanded && (event.translationY > 80 || event.velocityY > 550)) {
            dismissedBySwipe.set(true);
            const dismissDistance = Math.max(480, Math.round(windowHeight * 0.65));
            backdropOpacity.set(
              withTiming(0, { duration: THEME.motion.modalExitMs, easing: Easing.in(Easing.cubic) }),
            );
            translateY.set(
              withTiming(
                dismissDistance,
                { duration: THEME.motion.modalExitMs, easing: Easing.in(Easing.cubic) },
                (finished) => {
                  if (finished) {
                    scheduleOnRN(handleSwipeDismiss);
                  }
                },
              ),
            );
            return;
          }
          backdropOpacity.set(withTiming(1, { duration: 120 }));
          translateY.set(withSpring(0, THEME.motion.sheetDragSnapSpring));
        }),
    [
      backdropOpacity,
      dismissedBySwipe,
      enableSheetDrag,
      handleSwipeDismiss,
      isExpanded,
      onSwipeExpandChange,
      translateY,
      variant,
      visible,
      windowHeight,
    ],
  );

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.get(),
  }));

  const motionStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.get(),
    transform: [{ translateY: translateY.get() }, { scale: cardScale.get() }],
  }));

  const resolvedMaxWidth = maxWidth ?? (variant === 'sheet' ? 640 : 460);
  const rawMaxHeight = maxHeight ?? (variant === 'sheet' ? Math.round(windowHeight * 0.88) : '90%');
  const resolvedMaxHeight =
    typeof rawMaxHeight === 'number'
      ? rawMaxHeight
      : Math.round((windowHeight * Number.parseFloat(rawMaxHeight)) / 100);

  const layoutTransition =
    layoutAnimated && !reducedMotion
      ? LinearTransition.springify()
          .damping(THEME.motion.layoutSpring.damping)
          .stiffness(THEME.motion.layoutSpring.stiffness)
          .mass(THEME.motion.layoutSpring.mass)
      : undefined;

  if (!rendered) return null;

  const cardNode = (
    <Animated.View
      style={[
        variant === 'sheet'
          ? [
              styles.sheetContainer,
              {
                maxWidth: resolvedMaxWidth,
                maxHeight: resolvedMaxHeight,
                paddingBottom: Math.max(THEME.spacing.s24, insets.bottom + THEME.spacing.base),
              },
              sheetStyle,
            ]
          : [
              styles.centerContainer,
              {
                maxWidth: resolvedMaxWidth,
                maxHeight: resolvedMaxHeight,
              },
            ],
        contentContainerStyle,
        motionStyle,
      ]}>
      {variant === 'sheet' && showSheetHandle && (
        enableSheetDrag ? (
          <GestureDetector gesture={panGesture}>
            <Pressable
              onPress={onToggleExpand}
              disabled={!onToggleExpand}
              style={styles.dragZone}
              accessibilityRole={onToggleExpand ? 'button' : undefined}
              accessibilityLabel={onToggleExpand ? handleAccessibilityLabel : undefined}>
              <View style={styles.sheetHandle} />
            </Pressable>
          </GestureDetector>
        ) : (
          <View style={styles.dragZone}>
            <View style={styles.sheetHandle} />
          </View>
        )
      )}
      {children}
    </Animated.View>
  );

  const stageBody = (
    <View style={[styles.stage, variant === 'sheet' ? styles.stageBottom : styles.stageCenter]}>
      {backdropDismissible && (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel={backdropAccessibilityLabel}
        />
      )}

      <Animated.View
        layout={layoutTransition}
        style={[styles.layoutWrapper, { maxWidth: resolvedMaxWidth, maxHeight: resolvedMaxHeight }]}>
        {cardNode}
      </Animated.View>
    </View>
  );

  return (
    <ModalPortal onBackPress={visible ? (onRequestClose ?? onClose) : undefined}>
      <View style={styles.root} pointerEvents={visible ? 'auto' : 'none'}>
        <Animated.View style={[styles.backdropContainer, backdropStyle]} pointerEvents="none">
          {Platform.OS !== 'android' && (
            <BlurView intensity={26} tint="dark" style={StyleSheet.absoluteFill} />
          )}
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.backdropScrim,
              Platform.OS === 'android' && styles.backdropScrimSolid,
            ]}
          />
        </Animated.View>

        {keyboardAvoiding ? (
          <KeyboardAvoidingView
            style={styles.root}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            {stageBody}
          </KeyboardAvoidingView>
        ) : (
          stageBody
        )}

        {overlayChildren}
      </View>
    </ModalPortal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdropContainer: {
    ...StyleSheet.absoluteFill,
  },
  backdropScrim: {
    backgroundColor: THEME.colors.backdropOverlay,
  },
  backdropScrimSolid: {
    backgroundColor: 'rgba(18, 26, 38, 0.66)',
  },
  stage: {
    flex: 1,
  },
  stageBottom: {
    justifyContent: 'flex-end',
  },
  stageCenter: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.xxl,
    paddingVertical: THEME.spacing.s20,
  },
  layoutWrapper: {
    width: '100%',
    alignSelf: 'center',
    flexShrink: 1,
  },
  sheetContainer: {
    width: '100%',
    alignSelf: 'center',
    backgroundColor: THEME.colors.bgCard,
    borderTopLeftRadius: THEME.radius.sheet,
    borderTopRightRadius: THEME.radius.sheet,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: THEME.colors.borderLight,
    paddingHorizontal: THEME.spacing.s22,
    overflow: 'hidden',
  },
  centerContainer: {
    width: '100%',
  },
  dragZone: {
    paddingTop: THEME.spacing.lg,
    paddingBottom: THEME.spacing.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.handle,
  },
});
