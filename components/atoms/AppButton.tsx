import React from 'react';
import {
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  TextStyle,
  ViewStyle,
} from 'react-native';

import { AppText } from './AppText';

type BotaoProps = PressableProps & {
  titulo: string;
  variacao?: 'principal' | 'secundario' | 'destaque' | 'ghost' | 'outline';
  estilo?: StyleProp<ViewStyle>;
  textoEstilo?: StyleProp<TextStyle>;
};

export function AppButton({
  titulo,
  variacao = 'principal',
  estilo,
  textoEstilo,
  disabled,
  ...props
}: BotaoProps) {
  const isDark = variacao === 'principal';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        estilosVariacao[variacao],
        disabled && styles.desabilitado,
        pressed && !disabled && styles.pressionado,
        estilo,
      ]}
      {...props}
    >
      <AppText
        tipo="texto"
        peso="forte"
        style={[
          styles.textoBase,
          isDark ? styles.textoClaro : styles.textoEscuro,
          textoEstilo,
        ]}
      >
        {titulo}
      </AppText>
    </Pressable>
  );
}

const estilosVariacao = StyleSheet.create({
  principal: {
    backgroundColor: '#182230',
    borderWidth: 1,
    borderColor: '#182230',
  },
  destaque: {
    backgroundColor: '#f3b43f',
    borderWidth: 1,
    borderColor: '#f3b43f',
  },
  secundario: {
    backgroundColor: '#f3b43f',
    borderWidth: 1,
    borderColor: '#f3b43f',
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ded8cd',
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#182230',
  },
});

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    minHeight: 50,
    paddingHorizontal: 20,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressionado: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  desabilitado: {
    opacity: 0.5,
  },
  textoBase: {
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  textoClaro: {
    color: '#fffdf8',
  },
  textoEscuro: {
    color: '#182230',
  },
});
