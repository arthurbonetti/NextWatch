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
import { Gesture, GestureDetector, PointerType, State } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { ModalPortal } from '@/components/atoms/ModalPortal';
import { Theme, THEME, withAlpha } from '@/constants/theme';
import { useThemedStyles } from '@/contexts/ThemeContext';

const SHEET_ENTER_OFFSET = 72;
const CENTER_ENTER_OFFSET = 14;
const SHEET_ENTER_MS = 240;
const CENTER_ENTER_MS = 200;
const SHEET_SNAP_MS = 200;
const SHEET_LAYOUT_MS = 220;
const IS_ANDROID = Platform.OS === 'android';
const POINTER_TYPE_MOUSE = PointerType.MOUSE;
const STATE_UNDETERMINED = State.UNDETERMINED;
const STATE_BEGAN = State.BEGAN;
const STATE_ACTIVE = State.ACTIVE;

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
  expandableSheet?: boolean;
  dragEntireSheet?: boolean;
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

    scale.set(withTiming(1, { duration: CENTER_ENTER_MS, easing: Easing.out(Easing.cubic) }));
    translateY.set(withTiming(0, { duration: CENTER_ENTER_MS, easing: Easing.out(Easing.cubic) }));
    opacity.set(withTiming(1, { duration: THEME.motion.backdropFadeMs, easing: Easing.out(Easing.cubic) }));
  }, [active, opacity, reducedMotion, scale, translateY]);

  return useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateY: translateY.get() }, { scale: scale.get() }],
  }));
}

/**
 * Container global de modal do aplicativo com backdrop BlurView,
 * entrada suave sem bounce, e suporte a bottom sheet com gesto de arrastar.
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
  expandableSheet = false,
  dragEntireSheet = false,
  onSwipeExpandChange,
  isExpanded = false,
  onToggleExpand,
  handleAccessibilityLabel = 'Arrastar ou tocar para ajustar painel',
  layoutAnimated = false,
  sheetStyle,
  contentContainerStyle,
}: AnimatedModalShellProps) {
  const styles = useThemedStyles(createStyles);
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [internalExpanded, setInternalExpanded] = useState(false);

  const [rendered, setRendered] = useState(visible);
  if (visible && !rendered) {
    setRendered(true);
  } else if (!visible && rendered && reducedMotion) {
    setRendered(false);
  }
  if (!visible && internalExpanded) {
    setInternalExpanded(false);
  }

  const effectiveExpanded = onSwipeExpandChange ? isExpanded : expandableSheet && internalExpanded;
  const effectiveSwipeExpandChange =
    onSwipeExpandChange ?? (expandableSheet ? setInternalExpanded : undefined);
  const hasSwipeExpand = Boolean(effectiveSwipeExpandChange);
  const effectiveToggleExpand =
    onToggleExpand ??
    (expandableSheet ? () => setInternalExpanded((prev) => !prev) : undefined);
  const effectiveLayoutAnimated = layoutAnimated || expandableSheet;

  const backdropOpacity = useSharedValue(0);
  const cardScale = useSharedValue(reducedMotion ? 1 : variant === 'center' ? 0.92 : 1);
  const cardOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const translateY = useSharedValue(
    reducedMotion ? 0 : variant === 'sheet' ? SHEET_ENTER_OFFSET : CENTER_ENTER_OFFSET,
  );
  const dismissedBySwipe = useSharedValue(false);
  const hasDragged = useSharedValue(false);

  const [swipeDismissCount, setSwipeDismissCount] = useState(0);
  const [swipeExpandRequest, setSwipeExpandRequest] = useState<{
    expanded: boolean;
    token: number;
  } | null>(null);

  const wasVisibleRef = useRef(false);
  const prevVariantRef = useRef(variant);
  const closeTokenRef = useRef(0);
  const isVisibleRef = useRef(visible);
  const onCloseRef = useRef(onClose);
  const onSheetDismissRef = useRef(onSheetDismiss);
  const swipeExpandChangeRef = useRef(effectiveSwipeExpandChange);
  const handledDismissCountRef = useRef(0);
  const handledExpandTokenRef = useRef(0);

  useEffect(() => {
    isVisibleRef.current = visible;
    onCloseRef.current = onClose;
    onSheetDismissRef.current = onSheetDismiss;
    swipeExpandChangeRef.current = effectiveSwipeExpandChange;
  }, [effectiveSwipeExpandChange, onClose, onSheetDismiss, visible]);

  useEffect(() => {
    if (swipeDismissCount > handledDismissCountRef.current) {
      handledDismissCountRef.current = swipeDismissCount;
      const dismissAction = onSheetDismissRef.current ?? onCloseRef.current;
      dismissAction();
    }
  }, [swipeDismissCount]);

  useEffect(() => {
    if (swipeExpandRequest && swipeExpandRequest.token > handledExpandTokenRef.current) {
      handledExpandTokenRef.current = swipeExpandRequest.token;
      swipeExpandChangeRef.current?.(swipeExpandRequest.expanded);
    }
  }, [swipeExpandRequest]);

  const handleExitComplete = useCallback((token: number) => {
    if (token !== closeTokenRef.current || isVisibleRef.current) return;
    setRendered(false);
  }, []);

  const handleSwipeDismiss = useCallback(() => {
    setRendered(false);
    setSwipeDismissCount((count) => count + 1);
  }, []);

  const handleSwipeExpandChange = useCallback((expanded: boolean) => {
    setSwipeExpandRequest((prev) => ({ expanded, token: (prev?.token ?? 0) + 1 }));
  }, []);

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
      hasDragged.set(false);

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
          translateY.set(withTiming(0, { duration: SHEET_ENTER_MS, easing: Easing.out(Easing.cubic) }));
        } else {
          translateY.set(CENTER_ENTER_OFFSET);
          cardScale.set(0.92);
          cardOpacity.set(0);
          translateY.set(withTiming(0, { duration: CENTER_ENTER_MS, easing: Easing.out(Easing.cubic) }));
          cardScale.set(withTiming(1, { duration: CENTER_ENTER_MS, easing: Easing.out(Easing.cubic) }));
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
        cardScale.set(withTiming(1, { duration: CENTER_ENTER_MS, easing: Easing.out(Easing.cubic) }));
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
    hasDragged,
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
        .hitSlop(dragEntireSheet ? 0 : { top: 16, bottom: 36 })
        .onBegin(() => {
          'worklet';
          hasDragged.set(false);
        })
        .onStart(() => {
          'worklet';
          if (dismissedBySwipe.get()) return;
          cancelAnimation(translateY);
          cancelAnimation(backdropOpacity);
        })
        .onUpdate((event) => {
          'worklet';
          if (dismissedBySwipe.get()) return;
          hasDragged.set(true);
          if (event.translationY > 0) {
            translateY.set(event.translationY);
            if (!effectiveExpanded) {
              backdropOpacity.set(Math.max(0.2, 1 - event.translationY / 420));
            }
          } else {
            translateY.set(0);
            if (!effectiveExpanded) {
              backdropOpacity.set(1);
            }
          }
        })
        .onTouchesUp((event, stateManager) => {
          'worklet';
          // Workaround para bug do react-native-gesture-handler no Android com mouse (ex.: Waydroid):
          // GestureHandler.shouldActivateWithMouse ignora ACTION_UP para TOOL_TYPE_MOUSE esperando
          // ACTION_BUTTON_RELEASE, mas RNGestureHandlerRootView só encaminha hover em
          // dispatchGenericMotionEvent, deixando o gesto preso em STATE_ACTIVE ao soltar o mouse.
          if (!IS_ANDROID || event.pointerType !== POINTER_TYPE_MOUSE || event.numberOfTouches > 0) {
            return;
          }
          if (event.state === STATE_ACTIVE) {
            stateManager.end();
          } else if (event.state === STATE_BEGAN || event.state === STATE_UNDETERMINED) {
            stateManager.fail();
          }
        })
        .onEnd((event, success) => {
          'worklet';
          hasDragged.set(false);
          if (dismissedBySwipe.get()) return;
          if (!success) {
            backdropOpacity.set(withTiming(1, { duration: 120 }));
            translateY.set(withTiming(0, { duration: SHEET_SNAP_MS, easing: Easing.out(Easing.cubic) }));
            return;
          }
          if (hasSwipeExpand && (event.translationY < -55 || event.velocityY < -500)) {
            backdropOpacity.set(withTiming(1, { duration: 120 }));
            translateY.set(withTiming(0, { duration: SHEET_SNAP_MS, easing: Easing.out(Easing.cubic) }));
            scheduleOnRN(handleSwipeExpandChange, true);
            return;
          }
          if (
            hasSwipeExpand &&
            effectiveExpanded &&
            (event.translationY > 55 || event.velocityY > 450)
          ) {
            backdropOpacity.set(withTiming(1, { duration: 120 }));
            translateY.set(withTiming(0, { duration: SHEET_SNAP_MS, easing: Easing.out(Easing.cubic) }));
            scheduleOnRN(handleSwipeExpandChange, false);
            return;
          }
          if (!effectiveExpanded && (event.translationY > 80 || event.velocityY > 550)) {
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
          translateY.set(withTiming(0, { duration: SHEET_SNAP_MS, easing: Easing.out(Easing.cubic) }));
        })
        .onFinalize(() => {
          'worklet';
          if (hasDragged.get() && !dismissedBySwipe.get()) {
            hasDragged.set(false);
            backdropOpacity.set(withTiming(1, { duration: 120 }));
            translateY.set(withTiming(0, { duration: SHEET_SNAP_MS, easing: Easing.out(Easing.cubic) }));
          }
        }),
    [
      backdropOpacity,
      dismissedBySwipe,
      dragEntireSheet,
      effectiveExpanded,
      enableSheetDrag,
      handleSwipeDismiss,
      handleSwipeExpandChange,
      hasDragged,
      hasSwipeExpand,
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
  const expandableDefaultHeight = Math.min(Math.round(windowHeight * 0.78), 660);
  const expandableFullHeight = Math.min(Math.round(windowHeight * 0.92), 780);
  const rawMaxHeight =
    maxHeight ??
    (variant === 'sheet'
      ? expandableSheet
        ? effectiveExpanded
          ? expandableFullHeight
          : expandableDefaultHeight
        : Math.round(windowHeight * 0.88)
      : '90%');
  const resolvedMaxHeight =
    typeof rawMaxHeight === 'number'
      ? rawMaxHeight
      : Math.round((windowHeight * Number.parseFloat(rawMaxHeight)) / 100);

  const layoutTransition =
    effectiveLayoutAnimated && !reducedMotion
      ? LinearTransition.duration(SHEET_LAYOUT_MS).easing(Easing.out(Easing.cubic))
      : undefined;

  if (!rendered) return null;

  const handleNode =
    variant === 'sheet' && showSheetHandle ? (
      effectiveToggleExpand ? (
        <Pressable
          onPress={effectiveToggleExpand}
          style={styles.dragZone}
          accessibilityRole="button"
          accessibilityLabel={handleAccessibilityLabel}>
          <View style={styles.sheetHandle} />
        </Pressable>
      ) : (
        <View style={styles.dragZone}>
          <View style={styles.sheetHandle} />
        </View>
      )
    ) : null;

  const sheetGestureOnCard = variant === 'sheet' && enableSheetDrag && dragEntireSheet;
  const sheetGestureOnHandle = variant === 'sheet' && enableSheetDrag && !dragEntireSheet;

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
      {sheetGestureOnHandle && handleNode ? (
        <GestureDetector gesture={panGesture}>{handleNode}</GestureDetector>
      ) : (
        handleNode
      )}
      {children}
    </Animated.View>
  );

  const stageCard = sheetGestureOnCard ? (
    <GestureDetector gesture={panGesture}>{cardNode}</GestureDetector>
  ) : (
    cardNode
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
        {stageCard}
      </Animated.View>
    </View>
  );

  return (
    <ModalPortal onBackPress={visible ? (onRequestClose ?? onClose) : undefined}>
      <View style={[styles.root, { pointerEvents: visible ? 'auto' : 'none' }]}>
        <Animated.View style={[styles.backdropContainer, backdropStyle, { pointerEvents: 'none' }]}>
          {Platform.OS !== 'android' && (
            <BlurView intensity={32} tint="dark" style={StyleSheet.absoluteFill} />
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

const createStyles = (theme: Theme) => ({
  root: {
    flex: 1,
  },
  backdropContainer: {
    ...StyleSheet.absoluteFill,
  },
  backdropScrim: {
    backgroundColor: theme.colors.backdropOverlay,
  },
  backdropScrimSolid: {
    backgroundColor: theme.isDark
      ? theme.colors.backdropDark
      : withAlpha(theme.colors.navy, 0.68),
  },
  stage: {
    flex: 1,
  },
  stageBottom: {
    justifyContent: 'flex-end' as const,
  },
  stageCenter: {
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: theme.spacing.s20,
  },
  layoutWrapper: {
    width: '100%' as const,
    alignSelf: 'center' as const,
    flexShrink: 1,
  },
  sheetContainer: {
    width: '100%' as const,
    alignSelf: 'center' as const,
    backgroundColor: theme.colors.bgSurface,
    borderTopLeftRadius: theme.radius.sheet,
    borderTopRightRadius: theme.radius.sheet,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: theme.colors.borderSubtle,
    paddingHorizontal: theme.spacing.s22,
    overflow: 'hidden' as const,
  },
  centerContainer: {
    width: '100%' as const,
  },
  dragZone: {
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.base,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.handle,
  },
});
