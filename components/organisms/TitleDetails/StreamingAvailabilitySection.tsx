import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/atoms/AppText';
import { ServiceLogo } from '@/components/atoms/ServiceLogo';
import { Subscription } from '@/constants/subscriptions';
import { THEME, withAlpha } from '@/constants/theme';
import { formatCurrency } from '@/utils/format';

type StreamingAvailabilitySectionProps = {
  services: string[];
  subscriptions: Subscription[];
  accentColor: string;
  onPressService: (serviceName: string) => void;
};

export function StreamingAvailabilitySection({
  services,
  subscriptions,
  accentColor,
  onPressService,
}: StreamingAvailabilitySectionProps) {
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

  return (
    <View style={styles.section}>
      <AppText tipo="subtitulo" peso="forte" style={styles.sectionTitle}>
        Disponível em
      </AppText>

      <View style={styles.chipsList}>
        {sortedServices.map((serviceName) => {
          const subscription = subscriptionByProvider.get(serviceName);
          const isSubscribed = Boolean(subscription?.active);
          const priceLabel =
            isSubscribed && subscription && subscription.monthlyPrice > 0
              ? ` · ${formatCurrency(subscription.monthlyPrice)}/mês`
              : '';

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
                        borderColor: withAlpha(accentColor, 0.45),
                        backgroundColor: THEME.colors.bgCard,
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
                    isSubscribed ? { color: THEME.colors.successText } : styles.statusLabelMuted,
                  ]}
                  numberOfLines={1}>
                  {isSubscribed ? `Você assina${priceLabel}` : 'Não assino'}
                </AppText>
              </View>

              <MaterialIcons
                name="open-in-new"
                size={15}
                color={isSubscribed ? THEME.colors.textPrimary : THEME.colors.textMuted}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: THEME.spacing.sm,
  },
  sectionTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 16,
  },
  chipsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: THEME.spacing.sm,
  },
  chip: {
    flexGrow: 1,
    minWidth: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 10,
  },
  chipSubscribed: {
    backgroundColor: THEME.colors.bgCard,
  },
  chipUnsubscribed: {
    backgroundColor: THEME.colors.bgSubtle,
    borderColor: THEME.colors.borderLight,
    opacity: 0.72,
  },
  chipPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
  dimmedLogo: {
    opacity: 0.72,
  },
  chipTextCol: {
    flex: 1,
    gap: 1,
  },
  serviceName: {
    color: THEME.colors.textPrimary,
    fontSize: 14,
  },
  serviceNameMuted: {
    color: THEME.colors.textSecondary,
  },
  statusLabel: {
    fontSize: 11,
    lineHeight: 15,
  },
  statusLabelMuted: {
    color: THEME.colors.textMuted,
  },
});
