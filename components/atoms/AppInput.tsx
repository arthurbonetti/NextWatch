import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import {
  Pressable,
  StyleProp,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
} from 'react-native';

import { Theme } from '@/constants/theme';
import { FONT_FAMILIES } from '@/constants/typography';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';

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
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
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
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.accentLink}
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
              color={focused ? colors.textPrimary : colors.textMuted}
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

const createStyles = (theme: Theme) => ({
  wrapper: {
    marginBottom: 16,
  },
  rotulo: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 7,
  },
  inputContainer: {
    minHeight: 50,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bgSurfaceAlt,
    borderRadius: 14,
    paddingHorizontal: 15,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontFamily: FONT_FAMILIES.sans.regular,
    fontSize: 16,
    lineHeight: 22,
    color: theme.colors.textPrimary,
  },
  eyeButton: {
    paddingLeft: 10,
    paddingVertical: 6,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  inputFocado: {
    borderColor: theme.colors.borderFocused,
    backgroundColor: theme.colors.bgSurface,
  },
  inputErro: {
    borderColor: theme.colors.dangerText,
    backgroundColor: theme.colors.dangerIconBg,
  },
  textoErro: {
    color: theme.colors.dangerText,
    marginTop: 6,
  },
});
