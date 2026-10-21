import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/atoms/AppButton';
import { AppInput } from '@/components/atoms/AppInput';
import { AppText } from '@/components/atoms/AppText';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleLogin = () => {
    const normalizedEmail = email.trim();
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
    setEmailError(validEmail ? '' : 'Informe um e-mail válido.');
    setPasswordError(password.length >= 6 ? '' : 'A senha deve ter pelo menos 6 caracteres.');
    if (!validEmail || password.length < 6) return;

    signIn(normalizedEmail);
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          <AppText tipo="legenda" peso="forte" style={styles.eyebrow}>NEXTWATCH</AppText>
          <AppText tipo="titulo" peso="forte" style={styles.title}>Bem-vindo de volta</AppText>
          <AppText tipo="texto" style={styles.subtitle}>Entre para organizar seus streamings e descobrir o que assistir.</AppText>

          <View style={styles.demoNotice}>
            <AppText tipo="legenda" peso="forte" style={styles.demoTitle}>MODO DE DEMONSTRAÇÃO</AppText>
            <AppText tipo="legenda" style={styles.demoText}>Sem banco de dados: use qualquer e-mail válido e uma senha com pelo menos 6 caracteres. A sessão não será salva.</AppText>
          </View>

          <AppInput
            rotulo="E-mail"
            placeholder="seu@email.com"
            value={email}
            onChangeText={(value) => { setEmail(value); setEmailError(''); }}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="next"
            erro={emailError}
          />
          <AppInput
            rotulo="Senha"
            placeholder="Mínimo de 6 caracteres"
            value={password}
            onChangeText={(value) => { setPassword(value); setPasswordError(''); }}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            erro={passwordError}
          />

          <AppButton titulo="Entrar" onPress={handleLogin} estilo={styles.submitButton} />

          <View style={styles.accountPrompt}>
            <AppText tipo="legenda" style={styles.accountText}>Ainda não tem uma conta?</AppText>
            <Pressable onPress={() => router.push('/(auth)/register')} accessibilityRole="button">
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
  demoNotice: { backgroundColor: '#f1e8d7', borderRadius: 14, padding: 14, marginBottom: 22 },
  demoTitle: { color: '#9a5b20', letterSpacing: 0.8, marginBottom: 4 },
  demoText: { color: '#625a4c' },
  submitButton: { backgroundColor: '#182230', borderRadius: 14, marginTop: 4 },
  accountPrompt: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 22 },
  accountText: { color: '#6c6b67' },
  link: { color: '#b66a24' },
});
