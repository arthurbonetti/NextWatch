import { BlurView } from 'expo-blur';
import { ReactNode, useEffect, useMemo, useRef } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
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

import { THEME } from '@/constants/theme';

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

  const backdropOpacity = useSharedValue(0);
  const cardScale = useSharedValue(1);
  const cardOpacity = useSharedValue(1);
  const translateY = useSharedValue(0);
  const wasVisibleRef = useRef(false);
  const prevVariantRef = useRef(variant);

  useEffect(() => {
    if (!visible) {
      wasVisibleRef.current = false;
      prevVariantRef.current = variant;
      return;
    }

    const justOpened = !wasVisibleRef.current;
    const variantChanged = prevVariantRef.current !== variant;
    wasVisibleRef.current = true;
    prevVariantRef.current = variant;

    if (reducedMotion) {
      backdropOpacity.set(1);
      cardScale.set(1);
      cardOpacity.set(1);
      translateY.set(0);
      return;
    }

    if (justOpened) {
      backdropOpacity.set(0);
      backdropOpacity.set(withTiming(1, { duration: THEME.motion.backdropFadeMs }));

      if (variant === 'sheet') {
        cardScale.set(1);
        cardOpacity.set(1);
        translateY.set(30);
        translateY.set(withSpring(0, THEME.motion.sheetEnterSpring));
      } else {
        translateY.set(10);
        cardScale.set(0.94);
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
  }, [backdropOpacity, cardOpacity, cardScale, reducedMotion, translateY, variant, visible]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(variant === 'sheet' && enableSheetDrag)
        .onUpdate((event) => {
          if (event.translationY > 0) {
            translateY.set(event.translationY);
          } else {
            translateY.set(event.translationY * 0.25);
          }
        })
        .onEnd((event) => {
          if (onSwipeExpandChange && (event.translationY < -55 || event.velocityY < -500)) {
            translateY.set(withSpring(0, THEME.motion.sheetDragSnapSpring));
            scheduleOnRN(onSwipeExpandChange, true);
            return;
          }
          if (onSwipeExpandChange && isExpanded && (event.translationY > 55 || event.velocityY > 450)) {
            translateY.set(withSpring(0, THEME.motion.sheetDragSnapSpring));
            scheduleOnRN(onSwipeExpandChange, false);
            return;
          }
          if (!isExpanded && (event.translationY > 110 || event.velocityY > 650)) {
            const dismissAction = onSheetDismiss ?? onClose;
            translateY.set(
              withTiming(420, { duration: THEME.motion.backdropFadeMs }, (finished) => {
                if (finished) {
                  scheduleOnRN(dismissAction);
                }
              }),
            );
            return;
          }
          translateY.set(withSpring(0, THEME.motion.sheetDragSnapSpring));
        }),
    [enableSheetDrag, isExpanded, onClose, onSheetDismiss, onSwipeExpandChange, translateY, variant],
  );

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.get(),
  }));

  const motionStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.get(),
    transform: [{ translateY: translateY.get() }, { scale: cardScale.get() }],
  }));

  const resolvedMaxWidth = maxWidth ?? (variant === 'sheet' ? 640 : 460);
  const resolvedMaxHeight = maxHeight ?? (variant === 'sheet' ? Math.round(windowHeight * 0.88) : '90%');

  const layoutTransition =
    layoutAnimated && !reducedMotion
      ? LinearTransition.springify()
          .damping(THEME.motion.layoutSpring.damping)
          .stiffness(THEME.motion.layoutSpring.stiffness)
          .mass(THEME.motion.layoutSpring.mass)
      : undefined;

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
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onRequestClose ?? onClose}
      statusBarTranslucent>
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[styles.backdropContainer, backdropStyle]}>
          <BlurView intensity={26} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, styles.backdropScrim]} />
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
      </GestureHandlerRootView>
    </Modal>
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
    paddingBottom: THEME.spacing.md,
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
