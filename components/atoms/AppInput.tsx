import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useState } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
} from 'react-native';

import { FONT_FAMILIES } from '@/constants/typography';

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
  secureTextEntry,
  onFocus,
  onBlur,
  ...props
}: CampoProps) {
  const [focused, setFocused] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const isSecure = Boolean(secureTextEntry);

  return (
    <View style={styles.wrapper}>
      {rotulo ? (
        <AppText tipo="legenda" peso="semiforte" style={styles.rotulo}>
          {rotulo}
        </AppText>
      ) : null}

      <View
        style={[
          styles.inputContainer,
          focused && styles.inputFocado,
          !!erro && styles.inputErro,
        ]}
      >
        <TextInput
          placeholderTextColor="#9a978f"
          selectionColor="#d77c29"
          secureTextEntry={isSecure && !passwordVisible}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, estilo]}
          {...props}
        />
        {isSecure && (
          <Pressable
            onPress={() => setPasswordVisible((prev) => !prev)}
            hitSlop={10}
            style={styles.eyeButton}
            accessibilityRole="button"
            accessibilityLabel={passwordVisible ? 'Ocultar senha' : 'Mostrar senha'}
          >
            <MaterialIcons
              name={passwordVisible ? 'visibility-off' : 'visibility'}
              size={20}
              color={focused ? '#182230' : '#7b7b78'}
            />
          </Pressable>
        )}
      </View>

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
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 7,
  },
  inputContainer: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ded8cd',
    backgroundColor: '#f7f5f0',
    borderRadius: 14,
    paddingHorizontal: 15,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontFamily: FONT_FAMILIES.sans.regular,
    fontSize: 16,
    lineHeight: 22,
    color: '#182230',
  },
  eyeButton: {
    paddingLeft: 10,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
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
