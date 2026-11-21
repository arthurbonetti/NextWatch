import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Redirect } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/atoms/AppText';
import { BackButton } from '@/components/atoms/BackButton';
import { FadeInBlock } from '@/components/atoms/FadeInBlock';
import { ServiceLogo } from '@/components/atoms/ServiceLogo';
import { SwitchToggle } from '@/components/atoms/SwitchToggle';
import { ConfirmDialog } from '@/components/organisms/ConfirmDialog';
import { EmptyStateCard } from '@/components/organisms/EmptyStateCard';
import { SubscriptionEditorModal } from '@/components/organisms/SubscriptionEditorModal';
import { Subscription } from '@/constants/subscriptions';
import { darkColors, Theme, withAlpha } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { formatCurrency } from '@/utils/format';

export default function SubscriptionsScreen() {
  const { user, authReady } = useAuth();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { subscriptions, saveSubscription, toggleSubscription, removeSubscription } = useSubscriptions();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | undefined>();
  const [deletingSubscription, setDeletingSubscription] = useState<Subscription | null>(null);
  const [showAnnualCost, setShowAnnualCost] = useState(false);

  const activeSubscriptions = useMemo(() => subscriptions.filter((subscription) => subscription.active), [subscriptions]);
  const monthlyTotal = useMemo(() => activeSubscriptions.reduce((total, subscription) => total + subscription.monthlyPrice, 0), [activeSubscriptions]);
  const averagePerService = activeSubscriptions.length > 0 ? monthlyTotal / activeSubscriptions.length : 0;

  if (!authReady) return null;
  if (!user) return <Redirect href="/(auth)/login" />;

  const addSubscription = () => {
    setEditingSubscription(undefined);
    setEditorOpen(true);
  };

  const editSubscription = (subscription: Subscription) => {
    setEditingSubscription(subscription);
    setEditorOpen(true);
  };

  const handleSaveSubscription = (subscription: Subscription) => {
    saveSubscription(subscription);
    setEditorOpen(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <FadeInBlock delay={0}>
          <View style={styles.header}>
            <BackButton fallbackHref="/(tabs)/tab3" />
            <View style={styles.headerCopy}>
              <AppText tipo="legenda" peso="forte" style={styles.eyebrow}>SEU PAINEL</AppText>
              <AppText tipo="titulo" peso="forte" style={styles.title}>Assinaturas</AppText>
            </View>
            <Pressable
              style={({ pressed }) => [styles.headerActionBtn, pressed && styles.pressed]}
              onPress={addSubscription}
              accessibilityRole="button"
              accessibilityLabel="Adicionar assinatura">
              <MaterialIcons name="add" size={18} color={colors.textOnAccent} />
              <AppText tipo="legenda" peso="forte" style={styles.headerActionText}>Novo</AppText>
            </Pressable>
          </View>
        </FadeInBlock>

        <FadeInBlock delay={35}>
          <View style={styles.totalCard}>
            <View style={styles.totalGlow} />
            <View style={styles.totalTopline}>
              <View style={styles.totalIcon}><MaterialIcons name="account-balance-wallet" size={20} color={colors.accentPrimary} /></View>
              <AppText tipo="legenda" peso="forte" style={styles.totalLabel}>GASTO MENSAL ATIVO</AppText>
              <View style={styles.activeBadge}>
                <View style={styles.activeDot} />
                <AppText tipo="legenda" peso="forte" tabular style={styles.activeText}>
                  {activeSubscriptions.length} {activeSubscriptions.length === 1 ? 'ativa' : 'ativas'}
                </AppText>
              </View>
            </View>
            <AppText tipo="destaque" familia="sans" peso="forte" tabular style={styles.totalValue}>
              <AppText tipo="subtitulo" familia="sans" peso="semiforte" style={styles.totalCurrency}>R$ </AppText>
              {monthlyTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </AppText>
            <View style={styles.totalFooter}>
              <AppText tipo="legenda" tabular style={styles.totalHint}>{formatCurrency(monthlyTotal * 12)} por ano</AppText>
              <Pressable
                onPress={() => setShowAnnualCost((value) => !value)}
                style={({ pressed }) => [styles.costLink, pressed && styles.pressed]}
                accessibilityRole="button">
                <AppText tipo="legenda" peso="forte" style={styles.costLinkText}>{showAnnualCost ? 'Ocultar resumo' : 'Ver projeção'}</AppText>
                <MaterialIcons name={showAnnualCost ? 'expand-less' : 'expand-more'} size={16} color={colors.accentPrimary} />
              </Pressable>
            </View>
            {showAnnualCost && (
              <View style={styles.annualBreakdown}>
                <View style={styles.breakdownRow}>
                  <AppText tipo="legenda" style={styles.annualText}>Média por streaming ativo</AppText>
                  <AppText tipo="legenda" peso="forte" tabular style={styles.annualValue}>{formatCurrency(averagePerService)}</AppText>
                </View>
                <View style={styles.breakdownRow}>
                  <AppText tipo="legenda" style={styles.annualText}>Projeção em 6 meses</AppText>
                  <AppText tipo="legenda" peso="forte" tabular style={styles.annualValue}>{formatCurrency(monthlyTotal * 6)}</AppText>
                </View>
              </View>
            )}
          </View>
        </FadeInBlock>

        <FadeInBlock delay={70}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderCopy}>
              <AppText tipo="subtitulo" peso="forte" style={styles.sectionTitle}>Seus serviços</AppText>
              <AppText tipo="legenda" style={styles.sectionSubtitle}>Planos ativos e pausados no seu painel</AppText>
            </View>
            <AppText tipo="legenda" peso="forte" tabular numberOfLines={1} style={styles.countBadge}>{subscriptions.length} {subscriptions.length === 1 ? 'serviço' : 'serviços'}</AppText>
          </View>
        </FadeInBlock>

        {subscriptions.length === 0 ? (
          <FadeInBlock delay={140}>
            <EmptyStateCard
              icon="subscriptions"
              iconColor={colors.accentLink}
              title="Nenhuma assinatura cadastrada"
              description="Adicione os streamings que você assina para acompanhar gastos e liberar o catálogo na Roleta."
              actionLabel="Adicionar primeiro serviço"
              actionIcon="add"
              onAction={addSubscription}
            />
          </FadeInBlock>
        ) : subscriptions.map((subscription, index) => {
          return (
            <FadeInBlock key={subscription.id} delay={Math.min(index + 3, 8) * 30}>
              <View style={[styles.subscriptionCard, !subscription.active && styles.subscriptionInactive]}>
                <Pressable
                  style={({ pressed }) => [styles.cardTopRow, pressed && styles.pressed]}
                  onPress={() => editSubscription(subscription)}
                  accessibilityRole="button"
                  accessibilityLabel={`Editar ${subscription.provider}`}>
                  <ServiceLogo name={subscription.provider} size={44} />
                  <View style={styles.serviceInfo}>
                    <AppText peso="forte" style={styles.serviceName} numberOfLines={1}>
                      {subscription.provider}
                    </AppText>
                    <AppText tipo="legenda" tabular style={styles.billingText} numberOfLines={1}>
                      Vence todo dia {subscription.billingDay}
                    </AppText>
                  </View>
                  <View style={styles.priceArea}>
                    <AppText peso="forte" tabular style={styles.price}>{formatCurrency(subscription.monthlyPrice)}</AppText>
                    <AppText tipo="legenda" style={styles.priceCaption}>por mês</AppText>
                  </View>
                </Pressable>

                <View style={styles.cardDivider} />

                <View style={styles.cardBottomRow}>
                  <View style={styles.badgesRow}>
                    <View style={[styles.statusPill, subscription.active ? styles.statusPillActive : styles.statusPillPaused]}>
                      <View style={[styles.statusDot, subscription.active ? styles.statusDotActive : styles.statusDotPaused]} />
                      <AppText tipo="legenda" peso="forte" style={subscription.active ? styles.statusTextActive : styles.statusTextPaused}>
                        {subscription.active ? 'Ativa' : 'Pausada'}
                      </AppText>
                    </View>

                    {subscription.active && subscription.renewalAlert && (
                      <View style={styles.reminderBadge}>
                        <MaterialIcons name="notifications-none" size={14} color={colors.savedActiveText} />
                        <AppText tipo="legenda" peso="forte" tabular style={styles.reminderText} numberOfLines={1}>
                          Aviso {subscription.alertDays} {subscription.alertDays === 1 ? 'dia' : 'dias'} antes
                        </AppText>
                      </View>
                    )}
                  </View>

                  <View style={styles.subscriptionActions}>
                    <Pressable
                      style={({ pressed }) => [styles.iconActionBtn, pressed && styles.pressed]}
                      onPress={() => editSubscription(subscription)}
                      accessibilityRole="button"
                      accessibilityLabel={`Editar ${subscription.provider}`}>
                      <MaterialIcons name="edit" size={18} color={colors.textSecondary} />
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.iconActionBtn, pressed && styles.pressed]}
                      onPress={() => setDeletingSubscription(subscription)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remover ${subscription.provider}`}>
                      <MaterialIcons name="delete-outline" size={19} color={colors.dangerText} />
                    </Pressable>
                    <SwitchToggle
                      value={subscription.active}
                      onToggle={() => toggleSubscription(subscription.id)}
                      accessibilityLabel={subscription.active ? 'Pausar assinatura' : 'Ativar assinatura'}
                      style={styles.switchHitArea}
                    />
                  </View>
                </View>
              </View>
            </FadeInBlock>
          );
        })}

        {subscriptions.length > 0 && (
          <FadeInBlock delay={140}>
            <Pressable
              style={({ pressed }) => [styles.addRow, pressed && styles.pressed]}
              onPress={addSubscription}
              accessibilityRole="button">
              <View style={styles.addIcon}><MaterialIcons name="add" size={22} color={colors.textOnAccent} /></View>
              <View style={styles.addCopy}>
                <AppText peso="forte" style={styles.addTitle}>Adicionar outro streaming</AppText>
                <AppText tipo="legenda" style={styles.addSubtitle}>Netflix, Disney+, Max, Prime Video e mais</AppText>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} />
            </Pressable>
          </FadeInBlock>
        )}
      </ScrollView>

      <SubscriptionEditorModal
        visible={editorOpen}
        initialSubscription={editingSubscription}
        onClose={() => setEditorOpen(false)}
        onSave={handleSaveSubscription}
      />

      <ConfirmDialog
        visible={deletingSubscription !== null}
        icon="delete-outline"
        eyebrow="EXCLUIR ASSINATURA"
        title={`Remover ${deletingSubscription?.provider ?? ''}?`}
        message="Os títulos exclusivos desse streaming deixarão de aparecer na Roleta e em Explorar."
        confirmLabel="Sim, remover"
        cancelAccessibilityLabel="Cancelar exclusão"
        onConfirm={() => {
          if (deletingSubscription) {
            removeSubscription(deletingSubscription.id);
            setDeletingSubscription(null);
          }
        }}
        onCancel={() => setDeletingSubscription(null)}
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) => ({
  safeArea: { flex: 1, backgroundColor: theme.colors.bgPrimary },
  container: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 42 },
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  header: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, marginBottom: 20 },
  headerCopy: { flex: 1 },
  eyebrow: { color: theme.colors.accentLink, letterSpacing: 1.5, marginBottom: 3 },
  title: { color: theme.colors.textPrimary, fontSize: 25, lineHeight: 30, letterSpacing: -0.4 },
  headerActionBtn: { minHeight: 40, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 13, backgroundColor: theme.colors.accentPrimary },
  headerActionText: { color: theme.colors.textOnAccent, fontSize: 13 },
  totalCard: { overflow: 'hidden' as const, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.heroBorder, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 16, backgroundColor: theme.colors.heroBg, marginBottom: 26 },
  totalGlow: { position: 'absolute' as const, width: 190, height: 190, borderRadius: 95, top: -120, right: -40, backgroundColor: withAlpha(theme.colors.accentPrimary, 0.12) },
  totalTopline: { flexDirection: 'row' as const, alignItems: 'center' as const },
  totalIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: theme.colors.navyMuted, alignItems: 'center' as const, justifyContent: 'center' as const, marginRight: 10 },
  totalLabel: { color: theme.colors.accentPrimary, letterSpacing: 1, flex: 1 },
  activeBadge: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: withAlpha(darkColors.successText, 0.18) },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: darkColors.successText },
  activeText: { color: darkColors.successText, fontSize: 11 },
  totalValue: { color: theme.colors.textOnNavy, fontSize: 32, lineHeight: 38, marginTop: 12, marginBottom: 12 },
  totalCurrency: { color: withAlpha(theme.colors.textOnNavy, 0.75), fontSize: 19, lineHeight: 26 },
  totalFooter: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, borderTopWidth: 1, borderTopColor: theme.colors.cardBorderOverlay, paddingTop: 12 },
  totalHint: { color: theme.colors.textOnNavyMuted, fontSize: 12 },
  costLink: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, paddingVertical: 2 },
  costLinkText: { color: theme.colors.accentPrimary, fontSize: 12 },
  annualBreakdown: { gap: 8, marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: theme.colors.cardOverlaySubtle },
  breakdownRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
  annualText: { color: theme.colors.textOnNavyMuted, fontSize: 12 },
  annualValue: { color: theme.colors.textOnNavy, fontSize: 13 },
  sectionHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: 10, marginBottom: 13 },
  sectionHeaderCopy: { flex: 1 },
  sectionTitle: { color: theme.colors.textPrimary, fontSize: 18, lineHeight: 23 },
  sectionSubtitle: { color: theme.colors.textSecondary, marginTop: 2, fontSize: 13, lineHeight: 18 },
  countBadge: { flexShrink: 0, textAlign: 'center' as const, color: theme.colors.textSecondary, backgroundColor: theme.colors.bgSurface, borderWidth: 1, borderColor: theme.colors.borderSubtle, borderRadius: 11, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13 },
  subscriptionCard: { borderRadius: 18, borderWidth: 1, borderColor: theme.colors.borderSubtle, backgroundColor: theme.colors.bgSurface, padding: 14, marginBottom: 12 },
  subscriptionInactive: { opacity: 0.68 },
  cardTopRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 },
  serviceInfo: { flex: 1 },
  serviceName: { color: theme.colors.textPrimary, fontSize: 16, lineHeight: 21 },
  billingText: { color: theme.colors.textSecondary, fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  priceArea: { alignItems: 'flex-end' as const },
  price: { color: theme.colors.textPrimary, fontSize: 16, lineHeight: 21 },
  priceCaption: { color: theme.colors.textSecondary, fontSize: 12.5, marginTop: 1 },
  cardDivider: { height: 1, backgroundColor: theme.colors.borderSubtle, marginVertical: 11 },
  cardBottomRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: 8 },
  badgesRow: { flexDirection: 'row' as const, alignItems: 'center' as const, flexWrap: 'wrap' as const, gap: 6, flex: 1 },
  statusPill: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  statusPillActive: { backgroundColor: theme.colors.bgSuccess },
  statusPillPaused: { backgroundColor: theme.colors.bgSurfaceAlt },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusDotActive: { backgroundColor: theme.colors.successText },
  statusDotPaused: { backgroundColor: theme.colors.textMuted },
  statusTextActive: { color: theme.colors.successText, fontSize: 12 },
  statusTextPaused: { color: theme.colors.textSecondary, fontSize: 12 },
  reminderBadge: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: theme.colors.savedActiveBg },
  reminderText: { color: theme.colors.savedActiveText, fontSize: 12 },
  subscriptionActions: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 },
  iconActionBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.colors.bgSurfaceAlt, alignItems: 'center' as const, justifyContent: 'center' as const },
  switchHitArea: { minWidth: 44, minHeight: 44, alignItems: 'center' as const, justifyContent: 'center' as const, paddingLeft: 2 },
  addRow: { minHeight: 70, flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.borderSubtle, borderStyle: 'dashed' as const, backgroundColor: theme.colors.bgSurface, marginTop: 6 },
  addIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: theme.colors.accentPrimary, marginRight: 12 },
  addCopy: { flex: 1 },
  addTitle: { color: theme.colors.textPrimary, fontSize: 14.5, lineHeight: 19 },
  addSubtitle: { color: theme.colors.textSecondary, fontSize: 12.5, lineHeight: 17, marginTop: 2 },
});
