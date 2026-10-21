import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/atoms/AppButton';
import { AppInput } from '@/components/atoms/AppInput';
import { AppText } from '@/components/atoms/AppText';
import { useAuth } from '@/contexts/AuthContext';

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  const handleRegister = () => {
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

    signUp(normalizedName, normalizedEmail);
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.backLink}>
            <AppText tipo="legenda" peso="forte" style={styles.link}>Voltar para o login</AppText>
          </Pressable>

          <AppText tipo="legenda" peso="forte" style={styles.eyebrow}>NEXTWATCH</AppText>
          <AppText tipo="titulo" peso="forte" style={styles.title}>Crie sua conta</AppText>
          <AppText tipo="texto" style={styles.subtitle}>Monte seu painel e acompanhe seus serviços de streaming.</AppText>

          <View style={styles.demoNotice}>
            <AppText tipo="legenda" peso="forte" style={styles.demoTitle}>CONTA TEMPORÁRIA</AppText>
            <AppText tipo="legenda" style={styles.demoText}>Este cadastro funciona apenas nesta sessão. Seus dados não são enviados nem salvos.</AppText>
          </View>

          <AppInput
            rotulo="Nome"
            placeholder="Como podemos chamar você?"
            value={name}
            onChangeText={(value) => { setName(value); setNameError(''); }}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
            erro={nameError}
          />
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
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="next"
            erro={passwordError}
          />
          <AppInput
            rotulo="Confirmar senha"
            placeholder="Digite a senha novamente"
            value={confirmPassword}
            onChangeText={(value) => { setConfirmPassword(value); setConfirmPasswordError(''); }}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={handleRegister}
            erro={confirmPasswordError}
          />

          <AppButton titulo="Criar conta" onPress={handleRegister} estilo={styles.submitButton} />
          <View style={styles.loginPrompt}>
            <AppText tipo="legenda" style={styles.accountText}>Já tem uma conta?</AppText>
            <Pressable onPress={() => router.replace('/(auth)/login')} accessibilityRole="button">
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
  demoNotice: { backgroundColor: '#f1e8d7', borderRadius: 14, padding: 14, marginBottom: 20 },
  demoTitle: { color: '#9a5b20', letterSpacing: 0.8, marginBottom: 4 },
  demoText: { color: '#625a4c' },
  submitButton: { backgroundColor: '#182230', borderRadius: 14, marginTop: 4 },
  loginPrompt: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 20 },
  accountText: { color: '#6c6b67' },
  link: { color: '#b66a24' },
});
