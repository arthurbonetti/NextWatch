import React from 'react';
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
  variacao?: 'principal' | 'secundario' | 'ghost';
  estilo?: StyleProp<ViewStyle>;
};

export function AppButton({
  titulo,
  variacao = 'principal',
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
        style={variacao === 'ghost' ? styles.textoGhost : styles.textoConteudo}
      >
        {titulo}
      </AppText>
    </Pressable>
  );
}

const estilosVariacao = StyleSheet.create({
  principal: {
    backgroundColor: '#2563eb',
  },
  secundario: {
    backgroundColor: '#e2e8f0',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
});

const styles = StyleSheet.create({
  base: {
    borderRadius: 16,
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressionado: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  desabilitado: {
    opacity: 0.5,
  },
  textoConteudo: {
    color: '#ffffff',
  },
  textoGhost: {
    color: '#1f2937',
  },
});
