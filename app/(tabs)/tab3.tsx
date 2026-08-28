import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';

import { AppBadge } from '@/components/atoms/AppBadge';
import { AppCard } from '@/components/atoms/AppCard';
import { AppText } from '@/components/atoms/AppText';

export default function TabThreeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <AppCard titulo="Tab 3" subtitulo="Status e marcadores">
        <AppText tipo="texto" style={styles.text}>
          Componentes como badges também podem ser usados em telas de conteúdo.
        </AppText>
        <AppBadge label="Em desenvolvimento" color="#e0f2fe" />
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
  text: {
    marginBottom: 16,
  },
});
