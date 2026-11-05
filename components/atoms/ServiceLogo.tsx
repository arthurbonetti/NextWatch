import { Image } from 'expo-image';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { SUBSCRIPTION_PROVIDERS } from '@/constants/subscriptions';
import { getDynamicProviderLogo } from '@/services/tmdb';

type ServiceLogoProps = {
  name: string;
  size: number;
};

type ServiceLogoListProps = {
  services: string[];
  size: number;
  maxVisible?: number;
  overflowSize?: number;
  gap?: number;
  overflowGap?: number;
  onPressOverflow?: () => void;
};

// Logo do streaming (TMDB); para um serviço sem logo cadastrada, mostra a inicial sobre a cor da marca.
export function ServiceLogo({ name, size }: ServiceLogoProps) {
  const [failedLogoPath, setFailedLogoPath] = useState<string | null>(null);
  const provider = SUBSCRIPTION_PROVIDERS.find((item) => item.name === name);
  const box = { width: size, height: size, borderRadius: Math.round(size * 0.29) };
  const logoPath = getDynamicProviderLogo(name) ?? provider?.logo;

  if (logoPath && failedLogoPath !== logoPath) {
    // w92 cobre os ícones pequenos; acima de 30px pede a versão maior para não borrar em tela retina.
    const uri = `https://image.tmdb.org/t/p/${size > 30 ? 'w154' : 'w92'}${logoPath}`;
    return (
      <Image
        source={{ uri }}
        style={box}
        contentFit="cover"
        cachePolicy="memory-disk"
        accessibilityLabel={name}
        onError={() => setFailedLogoPath(logoPath)}
      />
    );
  }

  return (
    <View style={[styles.fallback, box, { backgroundColor: provider?.color ?? '#5d6670' }]}>
      <AppText peso="forte" style={[styles.symbol, { fontSize: Math.round(size * 0.48) }]}>{provider?.symbol ?? name.slice(0, 1).toUpperCase()}</AppText>
    </View>
  );
}

export function ServiceLogoList({
  services,
  size,
  maxVisible = 3,
  overflowSize,
  gap = 6,
  overflowGap = 5,
  onPressOverflow,
}: ServiceLogoListProps) {
  const hasOverflow = services.length > maxVisible;
  const visibleServices = hasOverflow ? services.slice(0, maxVisible) : services;
  const extraCount = services.length - visibleServices.length;
  const effectiveSize = hasOverflow ? (overflowSize ?? size) : size;
  const effectiveGap = hasOverflow ? overflowGap : gap;
  const badgeBox = {
    minWidth: effectiveSize,
    height: effectiveSize,
    borderRadius: Math.round(effectiveSize * 0.29),
    paddingHorizontal: Math.max(4, Math.round(effectiveSize * 0.16)),
  };
  const badgeFontSize = Math.max(9, Math.round(effectiveSize * 0.4));

  return (
    <View style={[styles.list, { gap: effectiveGap }]}>
      {visibleServices.map((serviceName) => (
        <ServiceLogo key={serviceName} name={serviceName} size={effectiveSize} />
      ))}
      {extraCount > 0 && (
        onPressOverflow ? (
          <Pressable
            onPress={onPressOverflow}
            style={[styles.moreBadge, badgeBox]}
            accessibilityRole="button"
            accessibilityLabel={`Mais ${extraCount} ${extraCount === 1 ? 'plataforma' : 'plataformas'}`}>
            <AppText peso="forte" style={[styles.moreText, { fontSize: badgeFontSize, lineHeight: badgeFontSize + 3 }]}>
              +{extraCount}
            </AppText>
          </Pressable>
        ) : (
          <View
            style={[styles.moreBadge, badgeBox]}
            accessibilityLabel={`Mais ${extraCount} ${extraCount === 1 ? 'plataforma' : 'plataformas'}`}>
            <AppText peso="forte" style={[styles.moreText, { fontSize: badgeFontSize, lineHeight: badgeFontSize + 3 }]}>
              +{extraCount}
            </AppText>
          </View>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  symbol: { color: '#fff' },
  list: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  moreBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1e8d7',
    borderWidth: 1,
    borderColor: '#d8ccb9',
  },
  moreText: { color: '#182230' },
});
