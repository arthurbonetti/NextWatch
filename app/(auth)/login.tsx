import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/atoms/AppButton';
import { AppInput } from '@/components/atoms/AppInput';
import { AppText } from '@/components/atoms/AppText';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginScreen() {
  const { signIn, status, errorMessage, isConnected, clearAuthError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const isLoading = status === 'loading';

  const handleLogin = async () => {
    if (isLoading) return;
    clearAuthError();
    const normalizedEmail = email.trim();
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
    setEmailError(validEmail ? '' : 'Informe um e-mail válido.');
    setPasswordError(password.length >= 6 ? '' : 'A senha deve ter pelo menos 6 caracteres.');
    if (!validEmail || password.length < 6) return;

    const ok = await signIn(normalizedEmail, password);
    if (ok) {
      router.replace('/(tabs)');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          <AppText tipo="legenda" peso="forte" style={styles.eyebrow}>NEXTWATCH</AppText>
          <AppText tipo="titulo" peso="forte" style={styles.title}>Bem-vindo de volta</AppText>
          <AppText tipo="texto" style={styles.subtitle}>Entre para organizar seus streamings e descobrir o que assistir.</AppText>

          {isConnected === false && (
            <View style={styles.offlineBanner}>
              <MaterialIcons name="wifi-off" size={18} color="#9a5b20" />
              <AppText tipo="legenda" style={styles.offlineText}>
                Dispositivo sem conexão de rede. A autenticação utilizará o armazenamento seguro local como fallback.
              </AppText>
            </View>
          )}

          {status === 'error' && errorMessage && (
            <View style={styles.errorBanner}>
              <MaterialIcons name="error-outline" size={18} color="#c0392b" />
              <View style={styles.errorCopy}>
                <AppText tipo="legenda" peso="forte" style={styles.errorTitle}>Falha na autenticação</AppText>
                <AppText tipo="legenda" style={styles.errorText}>{errorMessage}</AppText>
              </View>
              <Pressable onPress={() => { void handleLogin(); }} style={styles.retryChip} accessibilityRole="button">
                <AppText tipo="legenda" peso="forte" style={styles.retryText}>Tentar de novo</AppText>
              </Pressable>
            </View>
          )}

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
            titulo={isLoading ? 'Autenticando...' : 'Entrar'}
            onPress={() => { void handleLogin(); }}
            disabled={isLoading}
            estilo={styles.submitButton}
          />
          {isLoading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#d77c29" />
              <AppText tipo="legenda" style={styles.loadingText}>Validando credenciais e gravando token seguro…</AppText>
            </View>
          )}

          <View style={styles.accountPrompt}>
            <AppText tipo="legenda" style={styles.accountText}>Ainda não tem uma conta?</AppText>
            <Pressable
              onPress={() => { clearAuthError(); router.push('/(auth)/register'); }}
              disabled={isLoading}
              accessibilityRole="button">
              <AppText tipo="legenda" peso="forte" style={styles.link}>Criar conta</AppText>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f5f0',
  },
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
  container: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 36,
  },
  eyebrow: { color: '#d77c29', letterSpacing: 2, marginBottom: 12 },
  title: { color: '#182230', marginBottom: 8 },
  subtitle: { color: '#6c6b67', marginBottom: 22 },
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
  accountPrompt: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 22 },
  accountText: { color: '#6c6b67' },
  link: { color: '#b66a24' },
});
