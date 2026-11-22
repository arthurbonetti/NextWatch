import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/atoms/AppButton';
import { AppText } from '@/components/atoms/AppText';
import { PasswordInput } from '@/components/atoms/PasswordInput';
import { AuthBrandHeader } from '@/components/organisms/AuthBrandHeader';
import { Theme } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';
import {
  type RecoverySessionHandle,
  validateAndPrepareRecoverySession,
} from '@/services/authService';
import { isStrongPassword, MIN_PASSWORD_LENGTH } from '@/types/auth';
import {
  buildRecoveryPayloadKey,
  clearPendingRecoveryParams,
  hasRecoveryPayload,
  parseRecoveryUrlParams,
  peekPendingRecoveryParams,
  type RecoveryUrlParams,
} from '@/utils/recoveryUrl';

function stripRecoveryParamsFromWebUrl(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    if (window.location.hash || window.location.search) {
      window.history.replaceState(null, '', window.location.pathname || '/reset-password');
    }
  } catch {
    // Ignora falha ao limpar histórico
  }
}

export default function ResetPasswordScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const {
    isPasswordRecovery,
    beginPasswordRecoveryLock,
    cancelPasswordRecovery,
    completePasswordRecovery,
  } = useAuth();
  const params = useLocalSearchParams<{ code?: string; token_hash?: string; type?: string }>();
  const incomingUrl = Linking.useURL();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPasswordError, setNewPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [sessionReady, setSessionReady] = useState(isPasswordRecovery);
  const [checkingLink, setCheckingLink] = useState(!isPasswordRecovery);
  const [linkErrorMessage, setLinkErrorMessage] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const recoveryHandleRef = useRef<RecoverySessionHandle | null>(
    isPasswordRecovery ? { kind: 'main-recovery' } : null,
  );
  const isMountedRef = useRef(true);
  const inFlightKeyRef = useRef<string | null>(null);
  const completedKeyRef = useRef<string | null>(null);
  const validationSeqRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const handoffParams = peekPendingRecoveryParams();
    const webHref =
      Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : null;
    const parsedFromUrls = {
      ...parseRecoveryUrlParams(webHref),
      ...parseRecoveryUrlParams(incomingUrl),
    };

    const merged: RecoveryUrlParams = {
      ...(handoffParams ?? {}),
      ...parsedFromUrls,
      ...(typeof params.code === 'string' && params.code ? { code: params.code } : {}),
      ...(typeof params.token_hash === 'string' && params.token_hash
        ? { tokenHash: params.token_hash }
        : {}),
      ...(typeof params.type === 'string' && params.type ? { type: params.type } : {}),
    };

    const hasPayload = hasRecoveryPayload(merged);
    if (!hasPayload) {
      if (inFlightKeyRef.current !== null) {
        return;
      }
      if (recoveryHandleRef.current !== null) {
        setSessionReady(true);
        setCheckingLink(false);
        return;
      }
      if (completedKeyRef.current !== null && completedKeyRef.current !== '__empty__') {
        setCheckingLink(false);
        return;
      }
    }

    const payloadKey = hasPayload
      ? buildRecoveryPayloadKey(merged)
      : isPasswordRecovery
        ? '__main_recovery__'
        : '__empty__';

    if (inFlightKeyRef.current === payloadKey) {
      return;
    }
    if (completedKeyRef.current === payloadKey) {
      setCheckingLink(false);
      return;
    }

    if (handoffParams) {
      clearPendingRecoveryParams();
    }
    if (hasPayload) {
      stripRecoveryParamsFromWebUrl();
    }

    inFlightKeyRef.current = payloadKey;
    const seq = ++validationSeqRef.current;

    setCheckingLink(true);
    setLinkErrorMessage('');

    void validateAndPrepareRecoverySession(merged, {
      allowExistingRecoverySession: isPasswordRecovery,
      onRequireMainRecoveryLock: beginPasswordRecoveryLock,
    })
      .then((result) => {
        if (!isMountedRef.current || validationSeqRef.current !== seq) return;
        inFlightKeyRef.current = null;
        completedKeyRef.current = payloadKey;
        if (result.ok) {
          recoveryHandleRef.current = result.handle;
          setSessionReady(true);
          setLinkErrorMessage('');
        } else {
          recoveryHandleRef.current = null;
          setSessionReady(false);
          setLinkErrorMessage(result.errorMessage);
        }
      })
      .catch(() => {
        if (!isMountedRef.current || validationSeqRef.current !== seq) return;
        inFlightKeyRef.current = null;
        completedKeyRef.current = payloadKey;
        recoveryHandleRef.current = null;
        setSessionReady(false);
        setLinkErrorMessage(
          'Este link de recuperação expirou ou já foi utilizado. Solicite um novo envio na tela de login.',
        );
      })
      .finally(() => {
        if (!isMountedRef.current || validationSeqRef.current !== seq) return;
        setCheckingLink(false);
      });
  }, [beginPasswordRecoveryLock, incomingUrl, isPasswordRecovery, params.code, params.token_hash, params.type]);

  const handleBackToLogin = useCallback(async () => {
    recoveryHandleRef.current = null;
    inFlightKeyRef.current = null;
    completedKeyRef.current = null;
    validationSeqRef.current += 1;
    clearPendingRecoveryParams();
    stripRecoveryParamsFromWebUrl();
    await cancelPasswordRecovery();
    router.replace('/(auth)/login');
  }, [cancelPasswordRecovery]);

  const handleReset = async () => {
    if (isSubmitting) return;
    setSubmitError('');
    setSuccessMessage('');

    const validNew = isStrongPassword(newPassword);
    const passwordsMatch = newPassword === confirmPassword;

    setNewPasswordError(
      validNew ? '' : `Use pelo menos ${MIN_PASSWORD_LENGTH} caracteres com letras e números.`,
    );
    setConfirmPasswordError(passwordsMatch ? '' : 'As senhas não coincidem.');
    if (!validNew || !passwordsMatch) return;

    setIsSubmitting(true);
    try {
      await completePasswordRecovery(newPassword, recoveryHandleRef.current);
      recoveryHandleRef.current = null;
      clearPendingRecoveryParams();
      setSuccessMessage('Senha redefinida com sucesso! Redirecionando para o login…');
      setTimeout(() => {
        router.replace({ pathname: '/(auth)/login', params: { passwordReset: '1' } });
      }, 900);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'Não foi possível redefinir sua senha. Solicite um novo link no login.',
      );
    } finally {
      setIsSubmitting(false);
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
              <AppText tipo="titulo" peso="forte" style={styles.title}>
                Nova senha
              </AppText>
              <AppText tipo="texto" style={styles.subtitle}>
                Defina uma nova senha segura para acessar sua conta NextWatch.
              </AppText>

              {checkingLink ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={colors.accentLink} />
                  <AppText tipo="legenda" style={styles.loadingText}>
                    Validando link de recuperação…
                  </AppText>
                </View>
              ) : !sessionReady ? (
                <View style={styles.expiredBox}>
                  <MaterialIcons name="link-off" size={22} color={colors.accentLink} />
                  <AppText tipo="legenda" style={styles.expiredText}>
                    {linkErrorMessage ||
                      'Este link de recuperação expirou ou já foi utilizado. Solicite um novo envio na tela de login.'}
                  </AppText>
                  <AppButton
                    titulo="Voltar para o login"
                    onPress={() => {
                      void handleBackToLogin();
                    }}
                    estilo={styles.submitButton}
                  />
                </View>
              ) : (
                <>
                  <PasswordInput
                    rotulo="Nova senha"
                    placeholder="Digite a nova senha"
                    helperText={`Mínimo de ${MIN_PASSWORD_LENGTH} caracteres com letras e números`}
                    value={newPassword}
                    onChangeText={(value) => {
                      setNewPassword(value);
                      setNewPasswordError('');
                      setSubmitError('');
                    }}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    returnKeyType="next"
                    editable={!isSubmitting}
                    erro={newPasswordError}
                  />

                  <PasswordInput
                    rotulo="Confirmar nova senha"
                    placeholder="Repita a nova senha"
                    value={confirmPassword}
                    onChangeText={(value) => {
                      setConfirmPassword(value);
                      setConfirmPasswordError('');
                      setSubmitError('');
                    }}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    returnKeyType="done"
                    editable={!isSubmitting}
                    onSubmitEditing={() => {
                      void handleReset();
                    }}
                    erro={confirmPasswordError}
                  />

                  {submitError ? (
                    <View style={[styles.feedbackBanner, styles.errorBanner]}>
                      <MaterialIcons name="error-outline" size={18} color={colors.dangerText} />
                      <AppText tipo="legenda" peso="semiforte" style={[styles.feedbackText, styles.errorText]}>
                        {submitError}
                      </AppText>
                    </View>
                  ) : null}

                  {successMessage ? (
                    <View style={[styles.feedbackBanner, styles.successBanner]}>
                      <MaterialIcons name="check-circle-outline" size={18} color={colors.successText} />
                      <AppText tipo="legenda" peso="semiforte" style={[styles.feedbackText, styles.successText]}>
                        {successMessage}
                      </AppText>
                    </View>
                  ) : null}

                  <AppButton
                    titulo={isSubmitting ? 'Salvando senha…' : 'Salvar nova senha'}
                    onPress={() => {
                      void handleReset();
                    }}
                    disabled={isSubmitting}
                    estilo={styles.submitButton}
                  />
                </>
              )}
            </View>

            <View style={styles.footerPrompt}>
              <Pressable
                onPress={() => {
                  void handleBackToLogin();
                }}
                hitSlop={8}
                accessibilityRole="button">
                <AppText tipo="legenda" peso="forte" style={styles.link}>
                  Voltar para o login
                </AppText>
              </Pressable>
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
  container: {
    width: '100%' as const,
    maxWidth: 460,
    alignSelf: 'center' as const,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  card: {
    backgroundColor: theme.colors.bgSurface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    padding: 20,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 25,
    lineHeight: 30,
    letterSpacing: -0.45,
    marginBottom: 5,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 14.5,
    lineHeight: 21,
    marginBottom: 16,
  },
  loadingRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingVertical: 18,
  },
  loadingText: { color: theme.colors.textSecondary, fontSize: 13 },
  expiredBox: {
    gap: 12,
    alignItems: 'center' as const,
    paddingVertical: 10,
  },
  expiredText: {
    color: theme.colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 19,
  },
  submitButton: { borderRadius: 14, marginTop: 4, width: '100%' as const },
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
  feedbackText: { flex: 1, fontSize: 13, lineHeight: 18 },
  errorText: { color: theme.colors.dangerText },
  successText: { color: theme.colors.successText },
  footerPrompt: { alignItems: 'center' as const, marginTop: 16 },
  link: { color: theme.colors.accentLink, fontSize: 14 },
});
