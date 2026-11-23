import { StyleSheet, Text, TextProps } from 'react-native';

import { Theme } from '@/constants/theme';
import {
  FONT_FAMILIES,
  TABULAR_NUMS_STYLE,
  TextFamily,
  TextRole,
  TextWeight,
} from '@/constants/typography';
import { useThemedStyles } from '@/contexts/ThemeContext';

type AppTextProps = TextProps & {
  tipo?: TextRole;
  peso?: TextWeight;
  familia?: TextFamily;
  tabular?: boolean;
};

function resolveFontFamily(family: TextFamily, peso: TextWeight): string {
  if (family === 'editorial') {
    return peso === 'forte' ? FONT_FAMILIES.display.bold : FONT_FAMILIES.display.semibold;
  }

  switch (peso) {
    case 'forte':
      return FONT_FAMILIES.sans.bold;
    case 'semiforte':
      return FONT_FAMILIES.sans.semibold;
    case 'medio':
      return FONT_FAMILIES.sans.medium;
    default:
      return FONT_FAMILIES.sans.regular;
  }
}

export function AppText({
  tipo = 'texto',
  peso = 'normal',
  familia,
  tabular = false,
  style,
  children,
  ...props
}: AppTextProps) {
  const styles = useThemedStyles(createStyles);
  const resolvedFamily: TextFamily = familia ?? (tipo === 'destaque' || tipo === 'titulo' ? 'editorial' : 'sans');
  const fontFamily = resolveFontFamily(resolvedFamily, peso);

  return (
    <Text
      style={[
        styles.base,
        textStyle[tipo],
        { fontFamily },
        tabular && TABULAR_NUMS_STYLE,
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
}

const textStyle = StyleSheet.create({
  destaque: {
    fontSize: 32,
    lineHeight: 37,
    letterSpacing: -0.6,
  },
  titulo: {
    fontSize: 26,
    lineHeight: 31,
    letterSpacing: -0.45,
  },
  subtitulo: {
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.18,
  },
  texto: {
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0,
  },
  legenda: {
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: 0,
  },
});

const createStyles = (theme: Theme) => ({
  base: {
    color: theme.colors.textPrimary,
  },
});
