import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/atoms/AppText';
import { BookmarkIcon } from '@/components/atoms/BookmarkIcon';
import { CollapsibleSection } from '@/components/atoms/CollapsibleSection';
import { ServiceLogo } from '@/components/atoms/ServiceLogo';
import { Theme, THEME } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';

type TitleActionsFooterProps = {
  titleId: string;
  saved: boolean;
  bottomInset: number;
  streamingDrawerOpen: boolean;
  watchOptions: string[];
  hasMultipleWatchOptions: boolean;
  primaryWatchService: string | null;
  onToggleSaved: () => void;
  onPrimaryWatchPress: () => void;
  onOpenService: (serviceName: string) => void;
};

/** Barra de ações fixa na base da tela de detalhes (Salvar na fila + Assistir + drawer de streamings). */
export function TitleActionsFooter({
  titleId,
  saved,
  bottomInset,
  streamingDrawerOpen,
  watchOptions,
  hasMultipleWatchOptions,
  primaryWatchService,
  onToggleSaved,
  onPrimaryWatchPress,
  onOpenService,
}: TitleActionsFooterProps) {
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(createStyles);
  const reducedMotion = useReducedMotion();

  const saveProgress = useSharedValue(saved ? 1 : 0);
  const drawerChevronRotation = useSharedValue(0);

  const saveInactiveBg = colors.bgSurfaceAlt;
  const saveActiveBg = isDark ? colors.savedActiveBg : colors.navy;
  const saveInactiveBorder = colors.borderSubtle;
  const saveActiveBorder = isDark ? colors.savedActiveBorder : colors.navy;

  useEffect(() => {
    saveProgress.set(
      reducedMotion
        ? saved
          ? 1
          : 0
        : withTiming(saved ? 1 : 0, { duration: 180, easing: Easing.out(Easing.cubic) }),
    );
  }, [reducedMotion, saveProgress, saved]);

  useEffect(() => {
    drawerChevronRotation.set(
      reducedMotion
        ? streamingDrawerOpen
          ? 90
          : 0
        : withTiming(streamingDrawerOpen ? 90 : 0, {
            duration: 240,
            easing: Easing.bezier(0.22, 1, 0.36, 1),
          }),
    );
  }, [drawerChevronRotation, reducedMotion, streamingDrawerOpen]);

  const saveButtonAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      saveProgress.get(),
      [0, 1],
      [saveInactiveBg, saveActiveBg],
    ),
    borderColor: interpolateColor(
      saveProgress.get(),
      [0, 1],
      [saveInactiveBorder, saveActiveBorder],
    ),
  }), [saveInactiveBg, saveActiveBg, saveInactiveBorder, saveActiveBorder]);

  const drawerChevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${drawerChevronRotation.get()}deg` }],
  }));

  return (
    <View
      style={[
        styles.fixedFooter,
        { paddingBottom: Math.max(bottomInset, THEME.spacing.md) },
      ]}>
      <CollapsibleSection
        key={`footer-drawer-${titleId}`}
        expanded={streamingDrawerOpen && hasMultipleWatchOptions}
        slideOffset={8}
        openDuration={240}
        closeDuration={190}
        contentContainerStyle={styles.streamingDrawerSpacer}>
        <View style={styles.streamingDrawer}>
          <AppText tipo="legenda" peso="forte" style={styles.drawerTitle}>
            Escolha onde abrir
          </AppText>
          <View style={styles.drawerButtonsRow}>
            {watchOptions.map((serviceName, index) => (
              <Animated.View
                key={serviceName}
                entering={
                  reducedMotion
                    ? undefined
                    : FadeIn.delay(Math.min(index, 4) * 30).duration(170)
                }>
                <Pressable
                  onPress={() => onOpenService(serviceName)}
                  style={({ pressed }) => [styles.drawerServiceChip, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Assistir no ${serviceName}`}>
                  <ServiceLogo name={serviceName} size={22} />
                  <AppText tipo="legenda" peso="forte" style={styles.drawerServiceName}>
                    {serviceName}
                  </AppText>
                  <MaterialIcons name="open-in-new" size={13} color={colors.textMuted} />
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </View>
      </CollapsibleSection>

      <View style={styles.footerActionsRow}>
        <Animated.View style={[styles.saveButtonShell, saveButtonAnimatedStyle]}>
          <Pressable
            onPress={onToggleSaved}
            style={({ pressed }) => [styles.saveButtonInner, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Remover da sua fila' : 'Salvar na sua fila'}>
            <BookmarkIcon
              saved={saved}
              itemKey={titleId}
              size={20}
              color={colors.savedActiveIcon}
              inactiveColor={colors.textPrimary}
              badgeColor={colors.accentPrimary}
              badgeBorderColor={isDark ? colors.savedActiveBg : colors.navy}
            />
            <AppText
              tipo="legenda"
              peso="forte"
              style={[styles.saveButtonText, saved && styles.saveButtonTextActive]}
              numberOfLines={1}>
              {saved ? 'Na sua Fila' : 'Salvar'}
            </AppText>
          </Pressable>
        </Animated.View>

        <Pressable
          onPress={onPrimaryWatchPress}
          style={({ pressed }) => [styles.watchPrimaryButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={
            hasMultipleWatchOptions
              ? 'Assistir em um dos seus streamings'
              : primaryWatchService
                ? `Assistir no ${primaryWatchService}`
                : 'Buscar onde assistir'
          }>
          {!hasMultipleWatchOptions && primaryWatchService ? (
            <ServiceLogo name={primaryWatchService} size={22} />
          ) : (
            <MaterialIcons name="play-circle-filled" size={21} color={colors.textOnAccent} />
          )}
          <AppText tipo="texto" peso="forte" style={styles.watchPrimaryText} numberOfLines={1}>
            {hasMultipleWatchOptions
              ? 'Assistir em streaming'
              : primaryWatchService
                ? `Assistir no ${primaryWatchService}`
                : 'Buscar onde assistir'}
          </AppText>
          {hasMultipleWatchOptions ? (
            <Animated.View style={drawerChevronStyle}>
              <MaterialIcons name="chevron-right" size={20} color={colors.textOnAccent} />
            </Animated.View>
          ) : (
            <MaterialIcons name="open-in-new" size={16} color={colors.textOnAccent} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  fixedFooter: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bgSurface,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    width: '100%' as const,
    maxWidth: 640,
    alignSelf: 'center' as const,
  },
  streamingDrawerSpacer: {
    paddingBottom: theme.spacing.sm,
  },
  streamingDrawer: {
    backgroundColor: theme.colors.bgSurfaceAlt,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    padding: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  drawerTitle: {
    color: theme.colors.textSecondary,
    fontSize: 11.5,
  },
  drawerButtonsRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.xs,
  },
  drawerServiceChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 7,
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  drawerServiceName: {
    color: theme.colors.textPrimary,
    fontSize: 12.5,
  },
  footerActionsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
  },
  saveButtonShell: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    minHeight: 48,
  },
  saveButtonInner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingHorizontal: theme.spacing.md,
    minHeight: 48,
  },
  saveButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 13.5,
  },
  saveButtonTextActive: {
    color: theme.isDark ? theme.colors.savedActiveText : theme.colors.textOnNavy,
  },
  watchPrimaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accentPrimary,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingHorizontal: theme.spacing.md,
  },
  watchPrimaryText: {
    color: theme.colors.textOnAccent,
    fontSize: 14.5,
    flexShrink: 1,
  },
});
