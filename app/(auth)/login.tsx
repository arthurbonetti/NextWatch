import React from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/atoms/AppButton';
import { AppInput } from '@/components/atoms/AppInput';
import { AppText } from '@/components/atoms/AppText';

export default function LoginScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <AppText tipo="titulo" peso="forte" style={styles.title}>
          Bem-vindo ao NextWatch
        </AppText>

        <AppText tipo="texto" style={styles.subtitle}>
          Faça login para continuar.
        </AppText>

        <AppInput rotulo="E-mail" placeholder="seu@email.com" autoCapitalize="none" />
        <AppInput rotulo="Senha" placeholder="••••••••" secureTextEntry />

        <AppButton titulo="Entrar" onPress={() => {}} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    color: '#6b7280',
    marginBottom: 24,
  },
});
