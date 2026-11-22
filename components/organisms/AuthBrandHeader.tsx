import { StyleProp, View, ViewStyle } from 'react-native';

import { AppText } from '@/components/atoms/AppText';
import { NextWatchLogo } from '@/components/atoms/NextWatchLogo';
import { Theme } from '@/constants/theme';
import { useThemedStyles } from '@/contexts/ThemeContext';

type AuthBrandHeaderProps = {
  style?: StyleProp<ViewStyle>;
};

/**
 * Cabeçalho de marca padronizado compartilhado entre Login, Cadastro e Recuperação de senha.
 */
export function AuthBrandHeader({ style }: AuthBrandHeaderProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.brandHeader, style]}>
      <NextWatchLogo size={42} />
      <View style={styles.brandCopy}>
        <AppText tipo="legenda" peso="forte" style={styles.eyebrow}>
          NEXTWATCH
        </AppText>
        <AppText tipo="legenda" style={styles.brandTagline}>
          Curadoria e controle dos seus streamings
        </AppText>
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  brandHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    marginBottom: 14,
  },
  brandCopy: {
    flex: 1,
  },
  eyebrow: {
    color: theme.colors.accentLink,
    letterSpacing: 2.0,
    marginBottom: 2,
  },
  brandTagline: {
    color: theme.colors.textSecondary,
  },
});
