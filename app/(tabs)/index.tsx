import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';

import { AppBadge } from '@/components/atoms/AppBadge';
import { AppButton } from '@/components/atoms/AppButton';
import { AppCard } from '@/components/atoms/AppCard';
import { AppInput } from '@/components/atoms/AppInput';
import { AppText } from '@/components/atoms/AppText';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <AppText tipo="titulo" peso="forte" style={styles.header}>
          NextWatch
        </AppText>

        <AppText tipo="texto" style={styles.subtitle}>
          Componentes do app
        </AppText>

        <AppCard titulo="AppText" subtitulo="Texto e títulos">
          <AppText>Este é um exemplo de texto.</AppText>
        </AppCard>

        <AppCard titulo="AppButton" subtitulo="Ação principal">
          <AppButton titulo="Entrar" onPress={() => {}} />
        </AppCard>

        <AppCard titulo="AppBadge" subtitulo="Indicadores">
          <View style={styles.row}>
            <AppBadge label="Novo" color="#dbeafe" />
            <AppBadge label="Ativo" color="#dcfce7" />
          </View>
        </AppCard>

        <AppCard titulo="AppInput" subtitulo="Campo de entrada">
          <AppInput rotulo="E-mail" placeholder="seu@email.com" />
        </AppCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 6,
    color: '#0f172a',
  },
  subtitle: {
    color: '#475569',
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
});
