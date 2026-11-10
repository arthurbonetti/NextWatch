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
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  subtitulo: {
    fontSize: 19,
    lineHeight: 25,
    letterSpacing: -0.15,
  },
  texto: {
    fontSize: 15,
    lineHeight: 23,
  },
  legenda: {
    fontSize: 12,
    lineHeight: 17,
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
    color: '#182230',
  },
});
