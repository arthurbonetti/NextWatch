import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ReactNode, useState } from 'react';
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

export type AppInputProps = TextInputProps & {
  rotulo?: string;
  erro?: string;
  helperText?: string;
  labelAccessory?: ReactNode;
  estilo?: StyleProp<TextStyle>;
};

export function AppInput({
  rotulo,
  erro,
  helperText,
  labelAccessory,
  estilo,
  secureTextEntry,
  onFocus,
  onBlur,
  ...props
}: AppInputProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [focused, setFocused] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const isSecure = Boolean(secureTextEntry);

  return (
    <View style={styles.wrapper}>
      {(rotulo || labelAccessory) ? (
        <View style={styles.labelRow}>
          {rotulo ? (
            <AppText tipo="legenda" peso="semiforte" style={styles.rotulo}>
              {rotulo}
            </AppText>
          ) : (
            <View />
          )}
          {labelAccessory}
        </View>
      ) : null}

      <View
        style={[
          styles.inputContainer,
          isSecure && styles.inputContainerSecure,
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
          style={[styles.input, isSecure && styles.inputSecure, estilo]}
          {...props}
        />
        {isSecure && (
          <Pressable
            onPress={() => setPasswordVisible((prev) => !prev)}
            hitSlop={6}
            style={styles.eyeButton}
            accessibilityRole="button"
            accessibilityLabel={passwordVisible ? 'Ocultar senha' : 'Mostrar senha'}
          >
            <MaterialIcons
              name={passwordVisible ? 'visibility-off' : 'visibility'}
              size={20}
              color={focused ? colors.textPrimary : colors.textSecondary}
            />
          </Pressable>
        )}
      </View>

      {erro ? (
        <AppText tipo="legenda" peso="medio" style={styles.textoErro}>
          {erro}
        </AppText>
      ) : helperText ? (
        <AppText tipo="legenda" style={styles.helperText}>
          {helperText}
        </AppText>
      ) : null}
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  wrapper: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 8,
    marginBottom: 7,
  },
  rotulo: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
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
    position: 'relative' as const,
  },
  inputContainerSecure: {
    paddingRight: 4,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    fontFamily: FONT_FAMILIES.sans.regular,
    fontSize: 16,
    lineHeight: 22,
    color: theme.colors.textPrimary,
  },
  inputSecure: {
    paddingRight: 44,
  },
  eyeButton: {
    position: 'absolute' as const,
    right: 4,
    width: theme.touchTarget.min,
    height: theme.touchTarget.min,
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
  helperText: {
    color: theme.colors.textHint,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
});
