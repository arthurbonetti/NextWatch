import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/atoms/AppButton';
import { AppInput } from '@/components/atoms/AppInput';
import { AppText } from '@/components/atoms/AppText';
import { useAuth } from '@/contexts/AuthContext';

export default function RegisterScreen() {
  const { signUp, status, errorMessage, isConnected, clearAuthError } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const isLoading = status === 'loading';

  const handleRegister = async () => {
    if (isLoading) return;
    clearAuthError();
    const normalizedName = name.trim();
    const normalizedEmail = email.trim();
    const validName = normalizedName.length >= 2;
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
    const validPassword = password.length >= 6;
    const passwordsMatch = password === confirmPassword;

    setNameError(validName ? '' : 'Informe seu nome (pelo menos 2 caracteres).');
    setEmailError(validEmail ? '' : 'Informe um e-mail válido.');
    setPasswordError(validPassword ? '' : 'A senha deve ter pelo menos 6 caracteres.');
    setConfirmPasswordError(passwordsMatch ? '' : 'As senhas não coincidem.');
    if (!validName || !validEmail || !validPassword || !passwordsMatch) return;

    const ok = await signUp(normalizedName, normalizedEmail, password);
    if (ok) {
      router.replace('/(tabs)');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          <Pressable
            onPress={() => { clearAuthError(); router.back(); }}
            disabled={isLoading}
            accessibilityRole="button"
            style={styles.backLink}>
            <AppText tipo="legenda" peso="forte" style={styles.link}>Voltar para o login</AppText>
          </Pressable>

          <AppText tipo="legenda" peso="forte" style={styles.eyebrow}>NEXTWATCH</AppText>
          <AppText tipo="titulo" peso="forte" style={styles.title}>Crie sua conta</AppText>
          <AppText tipo="texto" style={styles.subtitle}>Monte seu painel e acompanhe seus serviços de streaming.</AppText>

          {isConnected === false && (
            <View style={styles.offlineBanner}>
              <MaterialIcons name="wifi-off" size={18} color="#9a5b20" />
              <AppText tipo="legenda" style={styles.offlineText}>
                Sem conexão de rede. Sua conta será salva com fallback seguro no dispositivo.
              </AppText>
            </View>
          )}

          {status === 'error' && errorMessage && (
            <View style={styles.errorBanner}>
              <MaterialIcons name="error-outline" size={18} color="#c0392b" />
              <View style={styles.errorCopy}>
                <AppText tipo="legenda" peso="forte" style={styles.errorTitle}>Não foi possível criar a conta</AppText>
                <AppText tipo="legenda" style={styles.errorText}>{errorMessage}</AppText>
              </View>
              <Pressable onPress={() => { void handleRegister(); }} style={styles.retryChip} accessibilityRole="button">
                <AppText tipo="legenda" peso="forte" style={styles.retryText}>Tentar de novo</AppText>
              </Pressable>
            </View>
          )}

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
          <AppInput
            rotulo="Senha"
            placeholder="Mínimo de 6 caracteres"
            value={password}
            onChangeText={(value) => { setPassword(value); setPasswordError(''); clearAuthError(); }}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="next"
            editable={!isLoading}
            erro={passwordError}
          />
          <AppInput
            rotulo="Confirmar senha"
            placeholder="Digite a senha novamente"
            value={confirmPassword}
            onChangeText={(value) => { setConfirmPassword(value); setConfirmPasswordError(''); clearAuthError(); }}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            editable={!isLoading}
            onSubmitEditing={() => { void handleRegister(); }}
            erro={confirmPasswordError}
          />

          <AppButton
            titulo={isLoading ? 'Criando conta...' : 'Criar conta'}
            onPress={() => { void handleRegister(); }}
            disabled={isLoading}
            estilo={styles.submitButton}
          />
          {isLoading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#d77c29" />
              <AppText tipo="legenda" style={styles.loadingText}>Registrando conta e emitindo Bearer Token…</AppText>
            </View>
          )}

          <View style={styles.loginPrompt}>
            <AppText tipo="legenda" style={styles.accountText}>Já tem uma conta?</AppText>
            <Pressable
              onPress={() => { clearAuthError(); router.replace('/(auth)/login'); }}
              disabled={isLoading}
              accessibilityRole="button">
              <AppText tipo="legenda" peso="forte" style={styles.link}>Entrar</AppText>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f5f0' },
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
  container: { width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 24, paddingVertical: 28 },
  backLink: { alignSelf: 'flex-start', paddingVertical: 10, marginBottom: 12 },
  eyebrow: { color: '#d77c29', letterSpacing: 2, marginBottom: 12 },
  title: { color: '#182230', marginBottom: 8 },
  subtitle: { color: '#6c6b67', marginBottom: 20 },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f5e6c8',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  offlineText: { flex: 1, color: '#625a4c' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fdecea',
    borderRadius: 14,
    padding: 12,
    marginBottom: 18,
  },
  errorCopy: { flex: 1 },
  errorTitle: { color: '#c0392b', marginBottom: 2 },
  errorText: { color: '#7a271f' },
  retryChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#f9d7d3',
  },
  retryText: { color: '#962318', fontSize: 11 },
  submitButton: { backgroundColor: '#182230', borderRadius: 14, marginTop: 4 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 },
  loadingText: { color: '#6c6b67' },
  loginPrompt: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 20 },
  accountText: { color: '#6c6b67' },
  link: { color: '#b66a24' },
});
