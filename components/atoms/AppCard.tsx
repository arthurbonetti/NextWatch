import React from 'react';
import { StyleProp, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';

import { AppText } from './AppText';

type CartaoProps = ViewProps & {
  titulo?: string;
  subtitulo?: string;
  children?: React.ReactNode;
  estilo?: StyleProp<ViewStyle>;
};

export function AppCard({
  titulo,
  subtitulo,
  children,
  estilo,
  ...props
}: CartaoProps) {
  return (
    <View style={[styles.cartao, estilo]} {...props}>
      {(titulo || subtitulo) && (
        <View style={styles.cabecalho}>
          {titulo ? (
            <AppText tipo="subtitulo" peso="forte" style={styles.titulo}>
              {titulo}
            </AppText>
          ) : null}
          {subtitulo ? (
            <AppText tipo="legenda" style={styles.subtitulo}>
              {subtitulo}
            </AppText>
          ) : null}
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  cartao: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 18,
    marginBottom: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cabecalho: {
    marginBottom: 12,
  },
  titulo: {
    color: '#0f172a',
  },
  subtitulo: {
    color: '#64748b',
    marginTop: 4,
  },
});
