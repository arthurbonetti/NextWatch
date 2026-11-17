import { TextStyle } from 'react-native';

export const FONT_FAMILIES = {
  display: {
    semibold: 'Fraunces_600SemiBold',
    bold: 'Fraunces_700Bold',
  },
  sans: {
    regular: 'PlusJakartaSans_400Regular',
    medium: 'PlusJakartaSans_500Medium',
    semibold: 'PlusJakartaSans_600SemiBold',
    bold: 'PlusJakartaSans_700Bold',
  },
} as const;

export type TextRole = 'destaque' | 'titulo' | 'subtitulo' | 'texto' | 'legenda';
export type TextWeight = 'normal' | 'medio' | 'semiforte' | 'forte';
export type TextFamily = 'editorial' | 'sans';

export const TABULAR_NUMS_STYLE: Pick<TextStyle, 'fontVariant'> = {
  fontVariant: ['tabular-nums'],
};
