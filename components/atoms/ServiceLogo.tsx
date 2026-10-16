import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { SUBSCRIPTION_PROVIDERS } from '@/constants/subscriptions';

type ServiceLogoProps = {
  name: string;
  size: number;
};

// Logo do streaming (TMDB); para um serviço sem logo cadastrada, mostra a inicial sobre a cor da marca.
export function ServiceLogo({ name, size }: ServiceLogoProps) {
  const provider = SUBSCRIPTION_PROVIDERS.find((item) => item.name === name);
  const box = { width: size, height: size, borderRadius: Math.round(size * 0.29) };

  if (provider?.logo) {
    // w92 cobre os ícones pequenos; acima de 30px pede a versão maior para não borrar em tela retina.
    const uri = `https://image.tmdb.org/t/p/${size > 30 ? 'w154' : 'w92'}${provider.logo}`;
    return <Image source={{ uri }} style={box} contentFit="cover" cachePolicy="memory-disk" accessibilityLabel={name} />;
  }

  return (
    <View style={[styles.fallback, box, { backgroundColor: provider?.color ?? '#5d6670' }]}>
      <AppText peso="forte" style={[styles.symbol, { fontSize: Math.round(size * 0.48) }]}>{provider?.symbol ?? name.slice(0, 1).toUpperCase()}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  symbol: { color: '#fff' },
});
