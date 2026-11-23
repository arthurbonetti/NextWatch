import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleProp,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/atoms/AppText';
import { CLOSE_EASING, OPEN_EASING } from '@/constants/animations';
import { Theme, withAlpha } from '@/constants/theme';
import { TextRole, TextWeight } from '@/constants/typography';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';

type ExpandableTextProps = {
  text: string;
  expanded: boolean;
  onToggle: () => void;
  collapsedLines?: number;
  fadeColor: string;
  tipo?: TextRole;
  peso?: TextWeight;
  textStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
  staticBottomSpacing?: number;
  expandLabel?: string;
  collapseLabel?: string;
  expandAccessibilityLabel?: string;
  collapseAccessibilityLabel?: string;
  buttonStyle?: StyleProp<ViewStyle>;
  buttonTextStyle?: StyleProp<TextStyle>;
  chevronColor?: string;
  chevronSize?: number;
};

type ExpandableBodyProps = {
  text: string;
  expanded: boolean;
  onToggle: () => void;
  collapsedHeight: number;
  fullHeight: number;
  fadeColor: string;
  tipo: TextRole;
  peso: TextWeight;
  textStyle?: StyleProp<TextStyle>;
  expandLabel: string;
  collapseLabel: string;
  expandAccessibilityLabel?: string;
  collapseAccessibilityLabel?: string;
  buttonStyle?: StyleProp<ViewStyle>;
  buttonTextStyle?: StyleProp<TextStyle>;
  chevronColor: string;
  chevronSize: number;
};

// Montado apenas após medição real para o Reanimated inicializar height e top no primeiro frame (Fabric/Android).
function ExpandableBody({
  text,
  expanded,
  onToggle,
  collapsedHeight,
  fullHeight,
  fadeColor,
  tipo,
  peso,
  textStyle,
  expandLabel,
  collapseLabel,
  expandAccessibilityLabel,
  collapseAccessibilityLabel,
  buttonStyle,
  buttonTextStyle,
  chevronColor,
  chevronSize,
}: ExpandableBodyProps) {
  const styles = useThemedStyles(createStyles);
  const reducedMotion = useReducedMotion();
  const prevExpandedRef = useRef(expanded);

  const collapsedHeightSv = useSharedValue(collapsedHeight);
  const fullHeightSv = useSharedValue(fullHeight);
  const progress = useSharedValue(expanded ? 1 : 0);
  const labelOpacity = useSharedValue(1);

  useEffect(() => {
    collapsedHeightSv.set(collapsedHeight);
    fullHeightSv.set(fullHeight);
  }, [collapsedHeight, collapsedHeightSv, fullHeight, fullHeightSv]);

  useEffect(() => {
    if (prevExpandedRef.current === expanded) return;
    prevExpandedRef.current = expanded;

    cancelAnimation(progress);
    cancelAnimation(labelOpacity);

    if (reducedMotion) {
      progress.set(expanded ? 1 : 0);
      labelOpacity.set(1);
      return;
    }

    const delta = Math.max(0, fullHeight - collapsedHeight);
    const duration = expanded
      ? Math.min(380, Math.max(240, Math.round(220 + delta * 0.45)))
      : Math.min(320, Math.max(200, Math.round(190 + delta * 0.35)));
    const easing = expanded ? OPEN_EASING : CLOSE_EASING;

    progress.set(withTiming(expanded ? 1 : 0, { duration, easing }));
    labelOpacity.set(0.25);
    labelOpacity.set(withTiming(1, { duration: 190, easing: Easing.out(Easing.cubic) }));
  }, [collapsedHeight, expanded, fullHeight, labelOpacity, progress, reducedMotion]);

  const clipAnimatedStyle = useAnimatedStyle<ViewStyle>(() => ({
    height: interpolate(
      progress.get(),
      [0, 1],
      [collapsedHeightSv.get(), fullHeightSv.get()],
      Extrapolation.CLAMP,
    ),
  }));

  const revealVeilStyle = useAnimatedStyle(() => ({
    top: collapsedHeightSv.get(),
    opacity: interpolate(
      progress.get(),
      [0, 0.2, 0.88, 1],
      [0.94, 0.6, 0.06, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const bottomFadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.get(),
      [0, 0.55, 1],
      [1, 0.78, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const chevronAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: `${interpolate(progress.get(), [0, 1], [0, 180], Extrapolation.CLAMP)}deg`,
      },
    ],
  }));

  const labelAnimatedStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.get(),
  }));

  return (
    <>
      <Animated.View style={[styles.clipBox, clipAnimatedStyle]}>
        <AppText tipo={tipo} peso={peso} style={textStyle}>
          {text}
        </AppText>

        <Animated.View
          style={[styles.revealVeil, { backgroundColor: fadeColor, pointerEvents: 'none' }, revealVeilStyle]}
        />
        <Animated.View style={[styles.bottomFadeWrap, bottomFadeStyle, { pointerEvents: 'none' }]}>
          <LinearGradient
            colors={[withAlpha(fadeColor, 0), withAlpha(fadeColor, 0.72), fadeColor]}
            locations={[0, 0.58, 1]}
            style={styles.bottomFadeGradient}
          />
        </Animated.View>
      </Animated.View>

      <Pressable
        onPress={onToggle}
        hitSlop={6}
        style={({ pressed }) => [styles.expandButton, buttonStyle, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={
          expanded
            ? (collapseAccessibilityLabel ?? collapseLabel)
            : (expandAccessibilityLabel ?? expandLabel)
        }>
        <Animated.View style={labelAnimatedStyle}>
          <AppText tipo="legenda" peso="forte" style={[styles.expandButtonText, buttonTextStyle]}>
            {expanded ? collapseLabel : expandLabel}
          </AppText>
        </Animated.View>
        <Animated.View style={chevronAnimatedStyle}>
          <MaterialIcons name="expand-more" size={chevronSize} color={chevronColor} />
        </Animated.View>
      </Pressable>
    </>
  );
}

/**
 * Texto editorial expansível com medição real das linhas, fade suave nas linhas reveladas,
 * gradiente na borda inferior e rotação contínua do ícone.
 */
export function ExpandableText({
  text,
  expanded,
  onToggle,
  collapsedLines = 4,
  fadeColor,
  tipo = 'texto',
  peso = 'normal',
  textStyle,
  style,
  staticBottomSpacing,
  expandLabel = 'Mostrar mais',
  collapseLabel = 'Mostrar menos',
  expandAccessibilityLabel,
  collapseAccessibilityLabel,
  buttonStyle,
  buttonTextStyle,
  chevronColor,
  chevronSize = 18,
}: ExpandableTextProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const resolvedChevronColor = chevronColor ?? colors.accentLink;

  const measureKey = `${collapsedLines}:${text}`;
  const [measured, setMeasured] = useState({ key: measureKey, collapsed: 0, full: 0 });

  const collapsedHeight = measured.key === measureKey ? measured.collapsed : 0;
  const fullHeight = measured.key === measureKey ? measured.full : 0;
  const hasMeasured = collapsedHeight > 0 && fullHeight > 0;
  const canExpand = hasMeasured && fullHeight > collapsedHeight + 4;

  const handleCollapsedLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const nextHeight = Math.ceil(event.nativeEvent.layout.height);
      if (nextHeight <= 0) return;

      setMeasured((prev) => {
        if (prev.key === measureKey && Math.abs(prev.collapsed - nextHeight) < 1) {
          return prev;
        }
        return {
          key: measureKey,
          collapsed: nextHeight,
          full: prev.key === measureKey ? prev.full : 0,
        };
      });
    },
    [measureKey],
  );

  const handleFullLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const nextHeight = Math.ceil(event.nativeEvent.layout.height);
      if (nextHeight <= 0) return;

      setMeasured((prev) => {
        if (prev.key === measureKey && Math.abs(prev.full - nextHeight) < 1) {
          return prev;
        }
        return {
          key: measureKey,
          collapsed: prev.key === measureKey ? prev.collapsed : 0,
          full: nextHeight,
        };
      });
    },
    [measureKey],
  );

  return (
    <View style={[styles.root, style]}>
      <View
        style={[styles.measurerAnchor, { pointerEvents: 'none' }]}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        aria-hidden>
        <View
          key={`c-${measureKey}`}
          style={styles.measurerLayer}
          onLayout={handleCollapsedLayout}>
          <AppText tipo={tipo} peso={peso} style={textStyle} numberOfLines={collapsedLines}>
            {text}
          </AppText>
        </View>
        <View key={`f-${measureKey}`} style={styles.measurerLayer} onLayout={handleFullLayout}>
          <AppText tipo={tipo} peso={peso} style={textStyle}>
            {text}
          </AppText>
        </View>
      </View>

      {canExpand ? (
        <ExpandableBody
          text={text}
          expanded={expanded}
          onToggle={onToggle}
          collapsedHeight={collapsedHeight}
          fullHeight={fullHeight}
          fadeColor={fadeColor}
          tipo={tipo}
          peso={peso}
          textStyle={textStyle}
          expandLabel={expandLabel}
          collapseLabel={collapseLabel}
          expandAccessibilityLabel={expandAccessibilityLabel}
          collapseAccessibilityLabel={collapseAccessibilityLabel}
          buttonStyle={buttonStyle}
          buttonTextStyle={buttonTextStyle}
          chevronColor={resolvedChevronColor}
          chevronSize={chevronSize}
        />
      ) : (
        <View
          style={[
            styles.clipBox,
            staticBottomSpacing !== undefined && { marginBottom: staticBottomSpacing },
          ]}>
          <AppText
            tipo={tipo}
            peso={peso}
            style={textStyle}
            numberOfLines={!hasMeasured ? collapsedLines : undefined}>
            {text}
          </AppText>
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  root: {
    position: 'relative' as const,
  },
  measurerAnchor: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    height: 0,
    overflow: 'hidden' as const,
    opacity: 0,
  },
  measurerLayer: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
  },
  clipBox: {
    position: 'relative' as const,
    overflow: 'hidden' as const,
  },
  revealVeil: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bottomFadeWrap: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
    height: 36,
  },
  bottomFadeGradient: {
    flex: 1,
  },
  expandButton: {
    alignSelf: 'flex-start' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
    paddingVertical: 4,
  },
  expandButtonText: {
    color: theme.colors.accentLink,
    fontSize: 13.5,
  },
  pressed: {
    opacity: 0.78,
  },
});
