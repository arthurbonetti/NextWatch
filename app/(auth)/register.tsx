import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/atoms/AppButton';
import { AppInput } from '@/components/atoms/AppInput';
import { AppText } from '@/components/atoms/AppText';
import { PasswordInput } from '@/components/atoms/PasswordInput';
import { AuthBrandHeader } from '@/components/organisms/AuthBrandHeader';
import { AuthStatusBanners } from '@/components/organisms/AuthStatusBanners';
import { Theme } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';
import { isStrongPassword, isValidEmail, MAX_NAME_LENGTH, MIN_PASSWORD_LENGTH } from '@/types/auth';

export default function RegisterScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { user, authReady, isPasswordRecovery, signUp, status, errorMessage, isConnected, clearAuthError } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [backPressAnim] = useState(() => new Animated.Value(0));
  const isLoading = status === 'loading';

  const animateBack = (toValue: number) => {
    Animated.spring(backPressAnim, {
      toValue,
      useNativeDriver: Platform.OS !== 'web',
      speed: 36,
      bounciness: 6,
    }).start();
  };

  if (authReady && isPasswordRecovery) {
    return <Redirect href="/(auth)/reset-password" />;
  }
  if (authReady && user) {
    return <Redirect href="/(tabs)" />;
  }

  const handleRegister = async () => {
    if (isLoading) return;
    clearAuthError();
    const normalizedName = name.trim().slice(0, MAX_NAME_LENGTH);
    const normalizedEmail = email.trim();
    const validName = normalizedName.length >= 2;
    const validEmail = isValidEmail(normalizedEmail);
    const validPassword = isStrongPassword(password);
    const passwordsMatch = password === confirmPassword;

    setNameError(validName ? '' : 'Informe seu nome (pelo menos 2 caracteres).');
    setEmailError(validEmail ? '' : 'Informe um e-mail válido.');
    setPasswordError(
      validPassword
        ? ''
        : `Use pelo menos ${MIN_PASSWORD_LENGTH} caracteres com letras e números.`,
    );
    setConfirmPasswordError(passwordsMatch ? '' : 'As senhas não coincidem.');
    if (!validName || !validEmail || !validPassword || !passwordsMatch) return;

    const ok = await signUp(normalizedName, normalizedEmail, password);
    if (ok) {
      router.replace('/(tabs)');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}>
          <View style={styles.container}>
            <Pressable
              onPress={() => { clearAuthError(); router.back(); }}
              onPressIn={() => animateBack(1)}
              onPressOut={() => animateBack(0)}
              disabled={isLoading}
              hitSlop={8}
              accessibilityRole="button"
              style={({ pressed }) => [styles.backLink, pressed && styles.pressed]}>
              <Animated.View
                style={{
                  transform: [
                    {
                      translateX: backPressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -3.5],
                      }),
                    },
                  ],
                }}>
                <MaterialIcons name="arrow-back" size={18} color={colors.accentLink} />
              </Animated.View>
              <AppText tipo="legenda" peso="forte" style={styles.link}>Voltar para o login</AppText>
            </Pressable>

            <AuthBrandHeader />

            <View style={styles.card}>
              <AppText tipo="titulo" peso="forte" style={styles.title}>Crie sua conta</AppText>
              <AppText tipo="texto" style={styles.subtitle}>
                Monte seu painel de assinaturas e descubra o que assistir hoje.
              </AppText>

              <AuthStatusBanners
                isConnected={isConnected}
                offlineMessage="Sem conexão com a internet. Conecte-se para sincronizar sua nova conta."
                status={status}
                errorMessage={errorMessage}
                errorTitle="Não foi possível criar a conta"
                onRetry={() => { void handleRegister(); }}
              />

              <AppInput
                rotulo="Nome"
                placeholder="Como podemos chamar você?"
                value={name}
                onChangeText={(value) => { setName(value); setNameError(''); clearAuthError(); }}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                returnKeyType="next"
                editable={!isLoading}
                erro={nameError}
              />
              <AppInput
                rotulo="E-mail"
                placeholder="seu@email.com"
                value={email}
                onChangeText={(value) => { setEmail(value); setEmailError(''); clearAuthError(); }}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="next"
                editable={!isLoading}
                erro={emailError}
              />
              <PasswordInput
                rotulo="Senha"
                placeholder="Crie uma senha"
                helperText={`Mínimo de ${MIN_PASSWORD_LENGTH} caracteres com letras e números`}
                value={password}
                onChangeText={(value) => { setPassword(value); setPasswordError(''); clearAuthError(); }}
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="next"
                editable={!isLoading}
                erro={passwordError}
              />
              <PasswordInput
                rotulo="Confirmar senha"
                placeholder="Repita sua senha"
                value={confirmPassword}
                onChangeText={(value) => { setConfirmPassword(value); setConfirmPasswordError(''); clearAuthError(); }}
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="done"
                editable={!isLoading}
                onSubmitEditing={() => { void handleRegister(); }}
                erro={confirmPasswordError}
              />

              <AppButton
                titulo={isLoading ? 'Criando conta…' : 'Criar minha conta'}
                onPress={() => { void handleRegister(); }}
                disabled={isLoading}
                estilo={styles.submitButton}
              />
              {isLoading && (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={colors.accentLink} />
                  <AppText tipo="legenda" style={styles.loadingText}>Preparando seu catálogo e painel…</AppText>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) => ({
  safeArea: { flex: 1, backgroundColor: theme.colors.bgPrimary },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center' as const },
  container: { width: '100%' as const, maxWidth: 460, alignSelf: 'center' as const, paddingHorizontal: 20, paddingVertical: 16 },
  pressed: { opacity: 0.84 },
  backLink: { alignSelf: 'flex-start' as const, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingVertical: 6, marginBottom: 8 },
  card: {
    backgroundColor: theme.colors.bgSurface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    padding: 20,
  },
  title: { color: theme.colors.textPrimary, fontSize: 25, lineHeight: 30, letterSpacing: -0.45, marginBottom: 5 },
  subtitle: { color: theme.colors.textSecondary, fontSize: 14.5, lineHeight: 21, marginBottom: 14 },
  submitButton: { borderRadius: 14, marginTop: 4 },
  loadingRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8, marginTop: 12 },
  loadingText: { color: theme.colors.textSecondary, fontSize: 13 },
  link: { color: theme.colors.accentLink, fontSize: 14 },
});
