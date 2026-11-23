import { Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

import { AppText } from '@/components/atoms/AppText';
import { BackButton } from '@/components/atoms/BackButton';
import { Theme, withAlpha } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';

type ScreenHeaderProps = {
  eyebrow?: string;
  title: string;
  showBack?: boolean;
  onBackPress?: () => void;
  fallbackHref?: Href;
  rightSlot?: ReactNode;
  rightSlotAlign?: 'center' | 'start';
  bottomSlot?: ReactNode;
  scrolled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Cabeçalho estruturado e persistente (fixo acima da área rolável),
 * com suporte a botão de retorno, eyebrow editorial, ação à direita,
 * faixa inferior opcional (ex.: abas ou busca) e borda/degradê ao rolar.
 */
export function ScreenHeader({
  eyebrow,
  title,
  showBack = false,
  onBackPress,
  fallbackHref = '/(tabs)',
  rightSlot,
  rightSlotAlign = 'center',
  bottomSlot,
  scrolled = false,
  style,
}: ScreenHeaderProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.outer, scrolled && styles.outerScrolled, style]}>
      <View style={[styles.inner, Boolean(bottomSlot) && styles.innerWithBottom]}>
        <View style={styles.topRow}>
          {showBack && (
            <BackButton onPress={onBackPress} fallbackHref={fallbackHref} />
          )}
          <View style={styles.copy}>
            {Boolean(eyebrow) && (
              <AppText tipo="legenda" peso="forte" numberOfLines={1} style={styles.eyebrow}>
                {eyebrow}
              </AppText>
            )}
            <AppText tipo="titulo" peso="forte" numberOfLines={1} style={styles.title}>
              {title}
            </AppText>
          </View>
          {rightSlot ? (
            <View style={[styles.rightSlot, rightSlotAlign === 'start' && styles.rightSlotStart]}>
              {rightSlot}
            </View>
          ) : null}
        </View>

        {bottomSlot ? <View style={styles.bottomSlot}>{bottomSlot}</View> : null}
      </View>

      {scrolled && (
        <LinearGradient
          colors={[withAlpha(colors.bgPrimary, 0.9), withAlpha(colors.bgPrimary, 0)]}
          locations={[0, 1]}
          style={[styles.scrollEdgeScrim, { pointerEvents: 'none' }]}
        />
      )}
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  outer: {
    position: 'relative' as const,
    zIndex: 10,
    backgroundColor: theme.colors.bgPrimary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.transparent,
  },
  outerScrolled: {
    borderBottomColor: theme.colors.borderSubtle,
  },
  inner: {
    width: '100%' as const,
    maxWidth: 640,
    alignSelf: 'center' as const,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
  },
  innerWithBottom: {
    paddingBottom: 10,
  },
  topRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    color: theme.colors.accentLink,
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.4,
  },
  rightSlot: {
    flexShrink: 0,
  },
  rightSlotStart: {
    alignSelf: 'flex-start' as const,
  },
  bottomSlot: {
    marginTop: 12,
  },
  scrollEdgeScrim: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: -11,
    height: 10,
  },
});
