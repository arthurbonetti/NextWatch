import React from 'react';
import {
    StyleProp,
    StyleSheet,
    TextInput,
    TextInputProps,
    TextStyle,
    View,
} from 'react-native';

import { AppText } from './AppText';

type CampoProps = TextInputProps & {
  rotulo?: string;
  erro?: string;
  estilo?: StyleProp<TextStyle>;
};

export function AppInput({
  rotulo,
  erro,
  estilo,
  ...props
}: CampoProps) {
  return (
    <View style={styles.wrapper}>
      {rotulo ? (
        <AppText tipo="legenda" peso="medio" style={styles.rotulo}>
          {rotulo}
        </AppText>
      ) : null}

      <TextInput
        placeholderTextColor="#94a3b8"
        style={[styles.input, !!erro && styles.inputErro, estilo]}
        {...props}
      />

      {erro ? (
        <AppText tipo="legenda" style={styles.textoErro}>
          {erro}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  rotulo: {
    color: '#334155',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0f172a',
  },
  inputErro: {
    borderColor: '#ef4444',
  },
  textoErro: {
    color: '#dc2626',
    marginTop: 6,
  },
});
