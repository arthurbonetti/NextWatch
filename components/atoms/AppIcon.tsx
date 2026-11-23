import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ComponentProps } from 'react';
import { StyleProp, TextStyle } from 'react-native';

export type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

type AppIconProps = Omit<ComponentProps<typeof MaterialIcons>, 'style'> & {
  size?: number;
  style?: StyleProp<TextStyle>;
};

/**
 * Wrapper de MaterialIcons com métricas padronizadas (sem font padding extra
 * no Android e caixa quadrada com lineHeight igual ao tamanho) para alinhamento
 * preciso dentro de círculos, quadrados e botões de ícone.
 */
export function AppIcon({ size = 20, style, ...rest }: AppIconProps) {
  return (
    <MaterialIcons
      size={size}
      {...rest}
      style={[
        {
          width: size,
          height: size,
          lineHeight: size,
          textAlign: 'center',
          textAlignVertical: 'center',
          includeFontPadding: false,
        },
        style,
      ]}
    />
  );
}
