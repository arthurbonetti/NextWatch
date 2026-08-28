import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';

import { AppCard } from '@/components/atoms/AppCard';
import { AppText } from '@/components/atoms/AppText';

export default function TabTwoScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <AppCard titulo="Tab 2" subtitulo="Exemplo de segunda aba">
        <AppText tipo="texto">
          Esta tela representa uma rota dentro do grupo de tabs.
        </AppText>
      </AppCard>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    padding: 20,
  },
});
