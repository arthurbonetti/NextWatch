import {
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from 'react-native';

import { Theme } from '@/constants/theme';
import { useThemedStyles } from '@/contexts/ThemeContext';

import { AppText } from './AppText';

type BotaoProps = PressableProps & {
  titulo: string;
  estilo?: StyleProp<ViewStyle>;
};

export function AppButton({
  titulo,
  estilo,
  disabled,
  ...props
}: BotaoProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        disabled && styles.desabilitado,
        pressed && !disabled && styles.pressionado,
        estilo,
      ]}
      {...props}
    >
      <AppText tipo="texto" peso="forte" style={[styles.texto, disabled && styles.textoDesabilitado]}>
        {titulo}
      </AppText>
    </Pressable>
  );
}

const createStyles = (theme: Theme) => ({
  base: {
    borderRadius: 14,
    minHeight: 50,
    paddingHorizontal: 20,
    paddingVertical: 13,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.colors.primaryButtonBg,
    borderWidth: 1,
    borderColor: theme.colors.primaryButtonBg,
  },
  pressionado: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  desabilitado: {
    backgroundColor: theme.colors.buttonDisabledBg,
    borderColor: theme.colors.buttonDisabledBorder,
  },
  texto: {
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.1,
    color: theme.colors.primaryButtonText,
  },
  textoDesabilitado: {
    color: theme.colors.buttonDisabledText,
  },
});
