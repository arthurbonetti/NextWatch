import React from 'react';
import { StyleSheet, Text, TextProps } from 'react-native';

type TextoProps = TextProps & {
  tipo?: 'titulo' | 'subtitulo' | 'texto' | 'legenda';
  peso?: 'normal' | 'medio' | 'forte';
};

export function AppText({
  tipo = 'texto',
  peso = 'normal',
  style,
  children,
  ...props
}: TextoProps) {
  return (
    <Text
      style={[
        styles.base,
        estiloTipo[tipo],
        estiloPeso[peso],
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
}

const estiloTipo = StyleSheet.create({
  titulo: {
    fontSize: 30,
    lineHeight: 38,
  },
  subtitulo: {
    fontSize: 20,
    lineHeight: 28,
  },
  texto: {
    fontSize: 16,
    lineHeight: 24,
  },
  legenda: {
    fontSize: 12,
    lineHeight: 18,
  },
});

const estiloPeso = StyleSheet.create({
  normal: {
    fontWeight: '400',
  },
  medio: {
    fontWeight: '500',
  },
  forte: {
    fontWeight: '700',
  },
});

const styles = StyleSheet.create({
  base: {
    color: '#0f172a',
    letterSpacing: 0.1,
  },
});
