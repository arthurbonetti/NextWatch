import React, { useState } from 'react';
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
  onFocus,
  onBlur,
  ...props
}: CampoProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      {rotulo ? (
        <AppText tipo="legenda" peso="forte" style={styles.rotulo}>
          {rotulo}
        </AppText>
      ) : null}

      <TextInput
        placeholderTextColor="#9a978f"
        selectionColor="#d77c29"
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          focused && styles.inputFocado,
          !!erro && styles.inputErro,
          estilo,
        ]}
        {...props}
      />

      {erro ? (
        <AppText tipo="legenda" peso="medio" style={styles.textoErro}>
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
    color: '#182230',
    marginBottom: 7,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: '#ded8cd',
    backgroundColor: '#f7f5f0',
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 15,
    color: '#182230',
  },
  inputFocado: {
    borderColor: '#182230',
    backgroundColor: '#fffdf8',
  },
  inputErro: {
    borderColor: '#c0392b',
    backgroundColor: '#fdecea',
  },
  textoErro: {
    color: '#c0392b',
    marginTop: 6,
  },
});
