import { LinearGradient } from 'expo-linear-gradient';
import { StyleProp, ViewStyle } from 'react-native';

import { withAlpha } from '@/constants/theme';

type BottomFadeScrimProps = {
  color: string;
  height: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Degradê suave na cor de fundo da superfície para evitar cortes secos
 * de conteúdo rolável atrás de elementos fixos (tab bar flutuante ou botões de ação).
 */
export function BottomFadeScrim({ color, height, style }: BottomFadeScrimProps) {
  return (
    <LinearGradient
      colors={[withAlpha(color, 0), withAlpha(color, 0.72), withAlpha(color, 0.96), color]}
      locations={[0, 0.45, 0.78, 1]}
      style={[{ height, pointerEvents: 'none' }, style]}
    />
  );
}
