import {
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from 'react-native';

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
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        disabled && styles.desabilitado,
        pressed && !disabled && styles.pressionado,
        estilo,
      ]}
      {...props}
    >
      <AppText tipo="texto" peso="forte" style={styles.texto}>
        {titulo}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    minHeight: 50,
    paddingHorizontal: 20,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#182230',
    borderWidth: 1,
    borderColor: '#182230',
  },
  pressionado: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  desabilitado: {
    opacity: 0.5,
  },
  texto: {
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.1,
    color: '#fffdf8',
  },
});
