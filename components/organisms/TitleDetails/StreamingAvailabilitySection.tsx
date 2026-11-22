import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/atoms/AppText';
import { ServiceLogo } from '@/components/atoms/ServiceLogo';
import { Subscription } from '@/constants/subscriptions';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';

type StreamingAvailabilitySectionProps = {
  services: string[];
  subscriptions: Subscription[];
  onPressService: (serviceName: string) => void;
};

export function StreamingAvailabilitySection({
  services,
  subscriptions,
  onPressService,
}: StreamingAvailabilitySectionProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  if (services.length === 0) {
    return null;
  }

  const subscriptionByProvider = new Map<string, Subscription>();
  for (const item of subscriptions) {
    subscriptionByProvider.set(item.provider, item);
  }

  const sortedServices = [...services].sort((a, b) => {
    const aActive = subscriptionByProvider.get(a)?.active ? 1 : 0;
    const bActive = subscriptionByProvider.get(b)?.active ? 1 : 0;
    return bActive - aActive;
  });

  const rows: string[][] = [];
  for (let i = 0; i < sortedServices.length; i += 2) {
    rows.push(sortedServices.slice(i, i + 2));
  }

  const renderChip = (serviceName: string) => {
    const subscription = subscriptionByProvider.get(serviceName);
    const isSubscribed = Boolean(subscription?.active);

    return (
      <Pressable
        key={serviceName}
        onPress={() => onPressService(serviceName)}
        style={({ pressed }) => [
          styles.chip,
          isSubscribed
            ? [
                styles.chipSubscribed,
                {
                  borderColor: colors.borderSuccess,
                  backgroundColor: colors.bgSurface,
                },
              ]
            : styles.chipUnsubscribed,
          pressed && styles.chipPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Abrir ${serviceName}, ${isSubscribed ? 'você assina' : 'não assino'}`}>
        <View style={!isSubscribed ? styles.dimmedLogo : undefined}>
          <ServiceLogo name={serviceName} size={34} />
        </View>

        <View style={styles.chipTextCol}>
          <AppText
            tipo="texto"
            peso="forte"
            style={[styles.serviceName, !isSubscribed && styles.serviceNameMuted]}
            numberOfLines={1}>
            {serviceName}
          </AppText>
          <AppText
            tipo="legenda"
            peso={isSubscribed ? 'forte' : 'medio'}
            style={[
              styles.statusLabel,
              isSubscribed ? { color: colors.successText } : styles.statusLabelMuted,
            ]}
            numberOfLines={1}>
            {isSubscribed ? 'Você assina' : 'Não assino'}
          </AppText>
        </View>

        <MaterialIcons
          name="open-in-new"
          size={15}
          color={isSubscribed ? colors.textPrimary : colors.textMuted}
        />
      </Pressable>
    );
  };

  return (
    <View style={styles.section}>
      <AppText tipo="subtitulo" peso="forte" style={styles.sectionTitle}>
        Disponível em
      </AppText>

      <View style={styles.chipsGrid}>
        {rows.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={styles.chipsRow}>
            {row.map(renderChip)}
            {sortedServices.length > 1 && row.length === 1 && <View style={styles.chipSpacer} />}
          </View>
        ))}
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  section: {
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
  },
  chipsGrid: {
    gap: theme.spacing.sm,
  },
  chipsRow: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
  },
  chip: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
  },
  chipSpacer: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.transparent,
  },
  chipSubscribed: {
    backgroundColor: theme.colors.bgSurface,
  },
  chipUnsubscribed: {
    backgroundColor: theme.colors.bgSurfaceAlt,
    borderColor: theme.colors.borderSubtle,
    opacity: 0.78,
  },
  chipPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
  dimmedLogo: {
    opacity: 0.78,
  },
  chipTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  serviceName: {
    color: theme.colors.textPrimary,
    fontSize: 14,
  },
  serviceNameMuted: {
    color: theme.colors.textSecondary,
  },
  statusLabel: {
    fontSize: 11,
    lineHeight: 15,
  },
  statusLabelMuted: {
    color: theme.colors.textMuted,
  },
});
