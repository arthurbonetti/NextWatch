import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { SUBSCRIPTION_PROVIDERS } from '@/constants/subscriptions';
import { Theme } from '@/constants/theme';
import { useThemedStyles } from '@/contexts/ThemeContext';
import { getDynamicProviderLogo, tmdbImageUri } from '@/utils/tmdbImage';

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
  overflowExpanded?: boolean;
  onPressOverflow?: () => void;
};

// Logo do streaming (TMDB) com moldura hairline padrão para separar logos claros/escuros da superfície.
export function ServiceLogo({ name, size }: ServiceLogoProps) {
  const styles = useThemedStyles(createStyles);
  const [failedLogoPath, setFailedLogoPath] = useState<string | null>(null);
  const provider = SUBSCRIPTION_PROVIDERS.find((item) => item.name === name);
  const box = { width: size, height: size, borderRadius: Math.round(size * 0.29) };
  const logoPath = getDynamicProviderLogo(name) ?? provider?.logo;
  // w92 cobre os ícones pequenos; acima de 30px pede a versão maior para não borrar em tela retina.
  const uri = logoPath && failedLogoPath !== logoPath
    ? tmdbImageUri(logoPath, size > 30 ? 'w154' : 'w92')
    : null;

  return (
    <View style={[styles.frame, box]} accessibilityLabel={uri ? undefined : name}>
      {uri && logoPath ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          accessibilityLabel={name}
          onError={() => setFailedLogoPath(logoPath)}
        />
      ) : (
        <View style={[styles.fallback, { backgroundColor: provider?.color ?? '#5d6670' }]}>
          <AppText peso="forte" style={[styles.symbol, { fontSize: Math.round(size * 0.48) }]}>
            {provider?.symbol ?? name.slice(0, 1).toUpperCase()}
          </AppText>
        </View>
      )}
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
  overflowExpanded = false,
  onPressOverflow,
}: ServiceLogoListProps) {
  const styles = useThemedStyles(createStyles);
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
            style={({ pressed }) => [styles.moreBadge, badgeBox, pressed && styles.moreBadgePressed]}
            accessibilityRole="button"
            accessibilityLabel={
              overflowExpanded
                ? 'Recolher plataformas'
                : `Mais ${extraCount} ${extraCount === 1 ? 'plataforma' : 'plataformas'}`
            }>
            <AppText
              peso="forte"
              style={[
                styles.moreText,
                { fontSize: overflowExpanded ? badgeFontSize + 2 : badgeFontSize, lineHeight: badgeFontSize + 3 },
              ]}>
              {overflowExpanded ? '×' : `+${extraCount}`}
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

const createStyles = (theme: Theme) => ({
  frame: {
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: theme.colors.logoBorder,
    backgroundColor: theme.colors.bgSurface,
  },
  fallback: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  symbol: { color: '#FFFFFF' },
  list: { flexDirection: 'row' as const, alignItems: 'center' as const, flexShrink: 1 },
  moreBadge: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.colors.bgSurfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  moreBadgePressed: { opacity: 0.8, transform: [{ scale: 0.92 }] },
  moreText: { color: theme.colors.textPrimary },
});
