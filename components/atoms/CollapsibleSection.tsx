import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { CLOSE_EASING, OPEN_EASING } from '@/constants/animations';
import { THEME } from '@/constants/theme';

type CollapsibleSectionProps = {
  expanded: boolean;
  children: ReactNode;
  slideOffset?: number;
  openDuration?: number;
  closeDuration?: number;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  onOpenEnd?: () => void;
};

/**
 * Container expansível com animação suave de altura, opacidade e leve deslizamento na UI thread.
 */
export function CollapsibleSection({
  expanded,
  children,
  slideOffset = -6,
  openDuration = THEME.motion.disclosureOpenMs,
  closeDuration = THEME.motion.disclosureCloseMs,
  style,
  contentContainerStyle,
  onOpenEnd,
}: CollapsibleSectionProps) {
  const reducedMotion = useReducedMotion();
  const [shouldRender, setShouldRender] = useState(expanded);

  if (expanded && !shouldRender) {
    setShouldRender(true);
  } else if (!expanded && shouldRender && reducedMotion) {
    setShouldRender(false);
  }

  const animatedHeight = useSharedValue(0);
  const contentOpacity = useSharedValue(expanded ? 1 : 0);
  const contentTranslateY = useSharedValue(expanded ? 0 : slideOffset);

  const expandedRef = useRef(expanded);
  const initialExpandedRef = useRef(expanded);
  const hasOpenedOnceRef = useRef(false);
  const measuredHeightRef = useRef(0);
  const transitionTokenRef = useRef(0);
  const onOpenEndRef = useRef(onOpenEnd);

  useEffect(() => {
    onOpenEndRef.current = onOpenEnd;
  }, [onOpenEnd]);

  const handleCloseComplete = useCallback((token: number) => {
    if (token !== transitionTokenRef.current || expandedRef.current) return;
    measuredHeightRef.current = 0;
    hasOpenedOnceRef.current = false;
    setShouldRender(false);
  }, []);

  const handleOpenComplete = useCallback((token: number) => {
    if (token !== transitionTokenRef.current || !expandedRef.current) return;
    onOpenEndRef.current?.();
  }, []);

  const animateOpenTo = useCallback(
    (targetHeight: number, isResize: boolean) => {
      const token = ++transitionTokenRef.current;
      cancelAnimation(animatedHeight);
      cancelAnimation(contentOpacity);
      cancelAnimation(contentTranslateY);

      if (reducedMotion || (initialExpandedRef.current && !hasOpenedOnceRef.current)) {
        initialExpandedRef.current = false;
        hasOpenedOnceRef.current = true;
        animatedHeight.set(targetHeight);
        contentOpacity.set(1);
        contentTranslateY.set(0);
        if (!isResize) {
          onOpenEndRef.current?.();
        }
        return;
      }

      hasOpenedOnceRef.current = true;

      if (isResize) {
        animatedHeight.set(withTiming(targetHeight, { duration: 220, easing: OPEN_EASING }));
        contentOpacity.set(1);
        contentTranslateY.set(0);
        return;
      }

      animatedHeight.set(
        withTiming(targetHeight, { duration: openDuration, easing: OPEN_EASING }, (finished) => {
          if (finished) {
            scheduleOnRN(handleOpenComplete, token);
          }
        }),
      );
      contentOpacity.set(
        withDelay(
          25,
          withTiming(1, {
            duration: Math.max(140, Math.round(openDuration * 0.85)),
            easing: Easing.out(Easing.quad),
          }),
        ),
      );
      contentTranslateY.set(withTiming(0, { duration: openDuration, easing: OPEN_EASING }));
    },
    [
      animatedHeight,
      contentOpacity,
      contentTranslateY,
      handleOpenComplete,
      openDuration,
      reducedMotion,
    ],
  );

  useEffect(() => {
    expandedRef.current = expanded;

    if (!shouldRender) return;

    if (expanded) {
      if (measuredHeightRef.current > 0) {
        animateOpenTo(measuredHeightRef.current, false);
      }
      return;
    }

    initialExpandedRef.current = false;
    const token = ++transitionTokenRef.current;
    cancelAnimation(animatedHeight);
    cancelAnimation(contentOpacity);
    cancelAnimation(contentTranslateY);

    if (reducedMotion) {
      animatedHeight.set(0);
      contentOpacity.set(0);
      contentTranslateY.set(slideOffset);
      measuredHeightRef.current = 0;
      hasOpenedOnceRef.current = false;
      return;
    }

    contentOpacity.set(
      withTiming(0, {
        duration: Math.max(100, Math.round(closeDuration * 0.62)),
        easing: Easing.in(Easing.quad),
      }),
    );
    contentTranslateY.set(
      withTiming(slideOffset, { duration: closeDuration, easing: CLOSE_EASING }),
    );
    animatedHeight.set(
      withTiming(0, { duration: closeDuration, easing: CLOSE_EASING }, (finished) => {
        if (finished) {
          scheduleOnRN(handleCloseComplete, token);
        }
      }),
    );
  }, [
    animateOpenTo,
    animatedHeight,
    closeDuration,
    contentOpacity,
    contentTranslateY,
    expanded,
    handleCloseComplete,
    reducedMotion,
    shouldRender,
    slideOffset,
  ]);

  const handleContentLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const nextHeight = Math.ceil(event.nativeEvent.layout.height);
      if (nextHeight <= 0) return;

      const prevHeight = measuredHeightRef.current;
      if (Math.abs(nextHeight - prevHeight) < 1) return;

      measuredHeightRef.current = nextHeight;

      if (expandedRef.current) {
        animateOpenTo(nextHeight, prevHeight > 0 && hasOpenedOnceRef.current);
      }
    },
    [animateOpenTo],
  );

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    height: animatedHeight.get(),
  }));

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.get(),
    transform: [{ translateY: contentTranslateY.get() }],
  }));

  if (!shouldRender) return null;

  return (
    <Animated.View
      style={[styles.clipper, style, containerAnimatedStyle, { pointerEvents: expanded ? 'auto' : 'none' }]}>
      <Animated.View
        style={[styles.measureInner, contentContainerStyle, contentAnimatedStyle]}
        onLayout={handleContentLayout}>
        {children}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clipper: {
    width: '100%',
    overflow: 'hidden',
  },
  measureInner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
