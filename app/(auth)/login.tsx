import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/atoms/AppButton';
import { AppInput } from '@/components/atoms/AppInput';
import { AppText } from '@/components/atoms/AppText';
import { NextWatchLogo } from '@/components/atoms/NextWatchLogo';
import { ServiceLogoList } from '@/components/atoms/ServiceLogo';
import { AuthStatusBanners } from '@/components/organisms/AuthStatusBanners';
import { Theme } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';
import { isValidEmail, MAX_PASSWORD_LENGTH, MIN_LOGIN_PASSWORD_LENGTH } from '@/types/auth';

const SHOWCASE_SERVICES = ['Netflix', 'Max', 'Disney+', 'Prime Video', 'Crunchyroll'];

export default function LoginScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { user, authReady, signIn, status, errorMessage, isConnected, clearAuthError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const isLoading = status === 'loading';

  if (authReady && user) {
    return <Redirect href="/(tabs)" />;
  }

  const handleLogin = async () => {
    if (isLoading) return;
    clearAuthError();
    const normalizedEmail = email.trim();
    const validEmail = isValidEmail(normalizedEmail);
    const validPassword =
      password.length >= MIN_LOGIN_PASSWORD_LENGTH && password.length <= MAX_PASSWORD_LENGTH;
    setEmailError(validEmail ? '' : 'Informe um e-mail válido.');
    setPasswordError(
      validPassword
        ? ''
        : `A senha deve ter entre ${MIN_LOGIN_PASSWORD_LENGTH} e ${MAX_PASSWORD_LENGTH} caracteres.`,
    );
    if (!validEmail || !validPassword) return;

    const ok = await signIn(normalizedEmail, password);
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
            <View style={styles.brandHeader}>
              <NextWatchLogo size={46} />
              <View style={styles.brandCopy}>
                <AppText tipo="legenda" peso="forte" style={styles.eyebrow}>NEXTWATCH</AppText>
                <AppText tipo="legenda" style={styles.brandTagline}>Curadoria e controle dos seus streamings</AppText>
              </View>
            </View>

            <View style={styles.card}>
              <AppText tipo="titulo" peso="forte" style={styles.title}>Entre na sua conta</AppText>
              <AppText tipo="texto" style={styles.subtitle}>
                Sincronize seus serviços ativos e sorteie o que assistir com nota 6,0+.
              </AppText>

              <View style={styles.servicesStrip}>
                <AppText tipo="legenda" peso="forte" style={styles.servicesStripEyebrow}>
                  CATÁLOGO INTEGRADO NO BRASIL
                </AppText>
                <View style={styles.servicesLogosRow}>
                  <ServiceLogoList services={SHOWCASE_SERVICES} size={28} maxVisible={5} gap={10} />
                </View>
              </View>

              <AuthStatusBanners
                isConnected={isConnected}
                offlineMessage="Sem conexão com a internet. Você ainda pode acessar sua sessão salva neste aparelho."
                status={status}
                errorMessage={errorMessage}
                errorTitle="Não foi possível entrar"
                onRetry={() => { void handleLogin(); }}
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
              <AppInput
                rotulo="Senha"
                placeholder="Mínimo de 6 caracteres"
                value={password}
                onChangeText={(value) => { setPassword(value); setPasswordError(''); clearAuthError(); }}
                secureTextEntry
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="done"
                editable={!isLoading}
                onSubmitEditing={() => { void handleLogin(); }}
                erro={passwordError}
              />

              <AppButton
                titulo={isLoading ? 'Entrando…' : 'Entrar na conta'}
                onPress={() => { void handleLogin(); }}
                disabled={isLoading}
                estilo={styles.submitButton}
              />
              {isLoading && (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={colors.accentLink} />
                  <AppText tipo="legenda" style={styles.loadingText}>Sincronizando sua sessão e assinaturas…</AppText>
                </View>
              )}
            </View>

            <View style={styles.accountPrompt}>
              <AppText tipo="legenda" style={styles.accountText}>Ainda não tem uma conta?</AppText>
              <Pressable
                onPress={() => { clearAuthError(); router.push('/(auth)/register'); }}
                disabled={isLoading}
                hitSlop={8}
                style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
                accessibilityRole="button">
                <AppText tipo="legenda" peso="forte" style={styles.link}>Criar conta gratuita</AppText>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) => ({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center' as const },
  container: {
    width: '100%' as const,
    maxWidth: 460,
    alignSelf: 'center' as const,
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  pressed: { opacity: 0.84 },
  brandHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    marginBottom: 18,
  },
  brandCopy: { flex: 1 },
  eyebrow: { color: theme.colors.accentLink, letterSpacing: 2.0, marginBottom: 2 },
  brandTagline: { color: theme.colors.textSecondary },
  card: {
    backgroundColor: theme.colors.bgSurface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    padding: 22,
  },
  title: { color: theme.colors.textPrimary, fontSize: 26, lineHeight: 31, letterSpacing: -0.45, marginBottom: 6 },
  subtitle: { color: theme.colors.textSecondary, fontSize: 15, lineHeight: 23, marginBottom: 16 },
  servicesStrip: {
    alignItems: 'center' as const,
    backgroundColor: theme.colors.bgSurfaceAlt,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 18,
    gap: 8,
  },
  servicesStripEyebrow: {
    color: theme.colors.accentLink,
    fontSize: 10,
    letterSpacing: 1.2,
    textAlign: 'center' as const,
  },
  servicesLogosRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  submitButton: { borderRadius: 14, marginTop: 6 },
  loadingRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8, marginTop: 12 },
  loadingText: { color: theme.colors.textSecondary, fontSize: 13 },
  accountPrompt: { flexDirection: 'row' as const, justifyContent: 'center' as const, alignItems: 'center' as const, gap: 6, marginTop: 20 },
  accountText: { color: theme.colors.textSecondary, fontSize: 13 },
  linkButton: { paddingVertical: 4, paddingHorizontal: 2 },
  link: { color: theme.colors.accentLink, fontSize: 14 },
});
