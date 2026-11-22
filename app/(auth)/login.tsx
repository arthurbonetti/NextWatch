import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedModalShell } from '@/components/atoms/AnimatedModalShell';
import { AppButton } from '@/components/atoms/AppButton';
import { AppInput } from '@/components/atoms/AppInput';
import { AppText } from '@/components/atoms/AppText';
import { PasswordInput } from '@/components/atoms/PasswordInput';
import { ServiceLogoList } from '@/components/atoms/ServiceLogo';
import { AuthBrandHeader } from '@/components/organisms/AuthBrandHeader';
import { AuthStatusBanners } from '@/components/organisms/AuthStatusBanners';
import { Theme } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';
import { isValidEmail, MAX_PASSWORD_LENGTH, MIN_LOGIN_PASSWORD_LENGTH } from '@/types/auth';
import { isPasswordRecoveryUrl } from '@/utils/recoveryUrl';

const SHOWCASE_SERVICES = ['Netflix', 'Max', 'Disney+', 'Prime Video', 'Crunchyroll'];

export default function LoginScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const {
    user,
    authReady,
    isPasswordRecovery,
    signIn,
    sendPasswordReset,
    status,
    errorMessage,
    isConnected,
    clearAuthError,
  } = useAuth();
  const { passwordReset } = useLocalSearchParams<{ passwordReset?: string }>();
  const [dismissedResetBanner, setDismissedResetBanner] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [recoveryVisible, setRecoveryVisible] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryEmailError, setRecoveryEmailError] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState('');
  const [isSendingRecovery, setIsSendingRecovery] = useState(false);

  const isLoading = status === 'loading';
  const showPasswordResetSuccess = passwordReset === '1' && !dismissedResetBanner;
  const webRecoveryPending =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    isPasswordRecoveryUrl(window.location.href);

  if (webRecoveryPending) {
    return null;
  }
  if (authReady && isPasswordRecovery) {
    return <Redirect href="/(auth)/reset-password" />;
  }
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
      password.length === 0
        ? 'Informe sua senha.'
        : validPassword
          ? ''
          : 'E-mail ou senha inválidos.',
    );
    if (!validEmail || !validPassword) return;

    const ok = await signIn(normalizedEmail, password);
    if (ok) {
      router.replace('/(tabs)');
    }
  };

  const openRecoverySheet = () => {
    setRecoveryEmail(email.trim());
    setRecoveryEmailError('');
    setRecoveryError('');
    setRecoverySuccess('');
    setRecoveryVisible(true);
  };

  const handleSendPasswordReset = async () => {
    if (isSendingRecovery) return;
    setRecoveryError('');
    setRecoverySuccess('');
    const normalized = recoveryEmail.trim();
    if (!isValidEmail(normalized)) {
      setRecoveryEmailError('Informe um e-mail válido.');
      return;
    }
    setRecoveryEmailError('');
    setIsSendingRecovery(true);
    try {
      await sendPasswordReset(normalized);
      setRecoverySuccess(
        'Se houver uma conta com este e-mail, enviamos um link para redefinir sua senha.',
      );
    } catch (error) {
      setRecoveryError(
        error instanceof Error
          ? error.message
          : 'Não foi possível enviar o link de recuperação. Tente novamente.',
      );
    } finally {
      setIsSendingRecovery(false);
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
            <AuthBrandHeader />

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

              {showPasswordResetSuccess ? (
                <View style={[styles.feedbackBanner, styles.successBanner]}>
                  <MaterialIcons name="check-circle-outline" size={18} color={colors.successText} />
                  <AppText tipo="legenda" peso="semiforte" style={[styles.feedbackText, styles.successText]}>
                    Senha redefinida com sucesso! Entre com sua nova senha.
                  </AppText>
                </View>
              ) : null}

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
                onChangeText={(value) => { setEmail(value); setEmailError(''); setDismissedResetBanner(true); clearAuthError(); }}
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
                placeholder="Digite sua senha"
                labelAccessory={
                  <Pressable
                    onPress={openRecoverySheet}
                    disabled={isLoading}
                    hitSlop={8}
                    style={({ pressed }) => [styles.forgotButton, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel="Esqueci minha senha">
                    <AppText tipo="legenda" peso="forte" style={styles.forgotLink}>
                      Esqueci minha senha
                    </AppText>
                  </Pressable>
                }
                value={password}
                onChangeText={(value) => { setPassword(value); setPasswordError(''); clearAuthError(); }}
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

      <AnimatedModalShell
        visible={recoveryVisible}
        onClose={() => setRecoveryVisible(false)}
        variant="sheet"
        keyboardAvoiding
        dragEntireSheet
        backdropAccessibilityLabel="Fechar recuperação de senha">
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}>
          <AppText tipo="legenda" peso="forte" style={styles.sheetEyebrow}>
            RECUPERAÇÃO DE ACESSO
          </AppText>
          <AppText tipo="subtitulo" familia="editorial" peso="forte" style={styles.sheetTitle}>
            Redefinir senha
          </AppText>
          <AppText tipo="legenda" style={styles.sheetSubtitle}>
            Informe o e-mail da sua conta para enviarmos um link de redefinição de senha.
          </AppText>

          <AppInput
            rotulo="E-mail da conta"
            placeholder="seu@email.com"
            value={recoveryEmail}
            onChangeText={(value) => {
              setRecoveryEmail(value);
              setRecoveryEmailError('');
              setRecoveryError('');
              setRecoverySuccess('');
            }}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="done"
            editable={!isSendingRecovery}
            onSubmitEditing={() => { void handleSendPasswordReset(); }}
            erro={recoveryEmailError}
          />

          {recoveryError ? (
            <View style={[styles.feedbackBanner, styles.errorBanner]}>
              <MaterialIcons name="error-outline" size={18} color={colors.dangerText} />
              <AppText tipo="legenda" peso="semiforte" style={[styles.feedbackText, styles.errorText]}>
                {recoveryError}
              </AppText>
            </View>
          ) : null}

          {recoverySuccess ? (
            <View style={[styles.feedbackBanner, styles.successBanner]}>
              <MaterialIcons name="mark-email-read" size={18} color={colors.successText} />
              <AppText tipo="legenda" peso="semiforte" style={[styles.feedbackText, styles.successText]}>
                {recoverySuccess}
              </AppText>
            </View>
          ) : null}

          <AppButton
            titulo={isSendingRecovery ? 'Enviando link…' : 'Enviar link de recuperação'}
            onPress={() => { void handleSendPasswordReset(); }}
            disabled={isSendingRecovery || isConnected === false}
            estilo={styles.submitButton}
          />
        </ScrollView>
      </AnimatedModalShell>
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
    paddingVertical: 18,
  },
  pressed: { opacity: 0.84 },
  card: {
    backgroundColor: theme.colors.bgSurface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    padding: 20,
  },
  title: { color: theme.colors.textPrimary, fontSize: 25, lineHeight: 30, letterSpacing: -0.45, marginBottom: 5 },
  subtitle: { color: theme.colors.textSecondary, fontSize: 14.5, lineHeight: 21, marginBottom: 14 },
  servicesStrip: {
    alignItems: 'center' as const,
    backgroundColor: theme.colors.bgSurfaceAlt,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginBottom: 16,
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
  forgotButton: {
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  forgotLink: {
    color: theme.colors.accentLink,
    fontSize: 12.5,
  },
  submitButton: { borderRadius: 14, marginTop: 4 },
  loadingRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8, marginTop: 12 },
  loadingText: { color: theme.colors.textSecondary, fontSize: 13 },
  accountPrompt: { flexDirection: 'row' as const, justifyContent: 'center' as const, alignItems: 'center' as const, gap: 6, marginTop: 16 },
  accountText: { color: theme.colors.textSecondary, fontSize: 13 },
  linkButton: { paddingVertical: 4, paddingHorizontal: 2 },
  link: { color: theme.colors.accentLink, fontSize: 14 },
  sheetEyebrow: {
    color: theme.colors.accentLink,
    letterSpacing: 1.3,
    marginBottom: 4,
  },
  sheetTitle: {
    color: theme.colors.textPrimary,
    fontSize: 22,
    lineHeight: 27,
    letterSpacing: -0.35,
    marginBottom: 6,
  },
  sheetSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 13.5,
    lineHeight: 20,
    marginBottom: 16,
  },
  feedbackBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
  },
  errorBanner: {
    backgroundColor: theme.colors.dangerIconBg,
    borderColor: theme.colors.dangerBorder,
  },
  successBanner: {
    backgroundColor: theme.colors.bgSuccess,
    borderColor: theme.colors.borderSuccess,
  },
  feedbackText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  errorText: { color: theme.colors.dangerText },
  successText: { color: theme.colors.successText },
});
