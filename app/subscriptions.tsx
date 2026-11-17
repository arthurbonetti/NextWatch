import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Redirect, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/atoms/AppText';
import { BackButton } from '@/components/atoms/BackButton';
import { ServiceLogo } from '@/components/atoms/ServiceLogo';
import { SubscriptionEditorModal } from '@/components/organisms/SubscriptionEditorModal';
import { Subscription } from '@/constants/subscriptions';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptions } from '@/contexts/SubscriptionsContext';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default function SubscriptionsScreen() {
  const { user, authReady } = useAuth();
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

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/tab3');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <BackButton onPress={handleBack} />
          <View style={styles.headerCopy}>
            <AppText tipo="legenda" peso="forte" style={styles.eyebrow}>SEU PAINEL</AppText>
            <AppText tipo="titulo" peso="forte" style={styles.title}>Assinaturas</AppText>
          </View>
          <Pressable
            style={({ pressed }) => [styles.headerActionBtn, pressed && styles.pressed]}
            onPress={addSubscription}
            accessibilityRole="button"
            accessibilityLabel="Adicionar assinatura">
            <MaterialIcons name="add" size={18} color="#182230" />
            <AppText tipo="legenda" peso="forte" style={styles.headerActionText}>Novo</AppText>
          </Pressable>
        </View>

        <View style={styles.totalCard}>
          <View style={styles.totalGlow} />
          <View style={styles.totalTopline}>
            <View style={styles.totalIcon}><MaterialIcons name="account-balance-wallet" size={20} color="#f3b43f" /></View>
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
            <AppText tipo="legenda" tabular style={styles.totalHint}>{currency.format(monthlyTotal * 12)} por ano</AppText>
            <Pressable
              onPress={() => setShowAnnualCost((value) => !value)}
              style={({ pressed }) => [styles.costLink, pressed && styles.pressed]}
              accessibilityRole="button">
              <AppText tipo="legenda" peso="forte" style={styles.costLinkText}>{showAnnualCost ? 'Ocultar resumo' : 'Ver projeção'}</AppText>
              <MaterialIcons name={showAnnualCost ? 'expand-less' : 'expand-more'} size={16} color="#f3b43f" />
            </Pressable>
          </View>
          {showAnnualCost && (
            <View style={styles.annualBreakdown}>
              <View style={styles.breakdownRow}>
                <AppText tipo="legenda" style={styles.annualText}>Média por streaming ativo</AppText>
                <AppText tipo="legenda" peso="forte" tabular style={styles.annualValue}>{currency.format(averagePerService)}</AppText>
              </View>
              <View style={styles.breakdownRow}>
                <AppText tipo="legenda" style={styles.annualText}>Projeção em 6 meses</AppText>
                <AppText tipo="legenda" peso="forte" tabular style={styles.annualValue}>{currency.format(monthlyTotal * 6)}</AppText>
              </View>
            </View>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderCopy}>
            <AppText tipo="subtitulo" peso="forte" style={styles.sectionTitle}>Seus serviços</AppText>
            <AppText tipo="legenda" style={styles.sectionSubtitle}>Planos ativos e pausados no seu painel</AppText>
          </View>
          <AppText tipo="legenda" peso="forte" tabular numberOfLines={1} style={styles.countBadge}>{subscriptions.length} {subscriptions.length === 1 ? 'serviço' : 'serviços'}</AppText>
        </View>

        {subscriptions.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}><MaterialIcons name="subscriptions" size={26} color="#d77c29" /></View>
            <AppText tipo="subtitulo" peso="forte" style={styles.emptyTitle}>Nenhuma assinatura cadastrada</AppText>
            <AppText tipo="legenda" style={styles.emptyDescription}>Adicione os streamings que você assina para acompanhar gastos e liberar o catálogo na Roleta.</AppText>
            <Pressable
              style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}
              onPress={addSubscription}
              accessibilityRole="button">
              <MaterialIcons name="add" size={18} color="#182230" />
              <AppText peso="forte" style={styles.emptyButtonText}>Adicionar primeiro serviço</AppText>
            </Pressable>
          </View>
        ) : subscriptions.map((subscription) => {
          return (
            <View key={subscription.id} style={[styles.subscriptionCard, !subscription.active && styles.subscriptionInactive]}>
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
                  <AppText peso="forte" tabular style={styles.price}>{currency.format(subscription.monthlyPrice)}</AppText>
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
                      <MaterialIcons name="notifications-none" size={14} color="#944c0d" />
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
                    <MaterialIcons name="edit" size={18} color="#5e5c57" />
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.iconActionBtn, pressed && styles.pressed]}
                    onPress={() => setDeletingSubscription(subscription)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remover ${subscription.provider}`}>
                    <MaterialIcons name="delete-outline" size={19} color="#c0392b" />
                  </Pressable>
                  <Pressable
                    onPress={() => toggleSubscription(subscription.id)}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: subscription.active }}
                    accessibilityLabel={subscription.active ? 'Pausar assinatura' : 'Ativar assinatura'}
                    style={({ pressed }) => [styles.switchHitArea, pressed && styles.pressed]}>
                    <View style={[styles.customSwitchTrack, subscription.active && styles.customSwitchTrackActive]}>
                      <View style={[styles.customSwitchThumb, subscription.active && styles.customSwitchThumbActive]} />
                    </View>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })}

        {subscriptions.length > 0 && (
          <Pressable
            style={({ pressed }) => [styles.addRow, pressed && styles.pressed]}
            onPress={addSubscription}
            accessibilityRole="button">
            <View style={styles.addIcon}><MaterialIcons name="add" size={22} color="#182230" /></View>
            <View style={styles.addCopy}>
              <AppText peso="forte" style={styles.addTitle}>Adicionar outro streaming</AppText>
              <AppText tipo="legenda" style={styles.addSubtitle}>Netflix, Disney+, Max, Prime Video e mais</AppText>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#7b7b78" />
          </Pressable>
        )}
      </ScrollView>

      {editorOpen && <SubscriptionEditorModal key={editingSubscription?.id ?? 'new-subscription'} initialSubscription={editingSubscription} onClose={() => setEditorOpen(false)} onSave={handleSaveSubscription} />}

      <Modal
        visible={deletingSubscription !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDeletingSubscription(null)}
        statusBarTranslucent>
        <View style={styles.confirmBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDeletingSubscription(null)} accessibilityLabel="Cancelar exclusão" />
          <View style={styles.confirmCard}>
            <View style={styles.confirmIconBadge}>
              <MaterialIcons name="delete-outline" size={24} color="#c0392b" />
            </View>
            <AppText tipo="legenda" peso="forte" style={styles.confirmEyebrow}>EXCLUIR ASSINATURA</AppText>
            <AppText tipo="subtitulo" familia="editorial" peso="forte" style={styles.confirmTitle}>
              Remover {deletingSubscription?.provider}?
            </AppText>
            <AppText tipo="legenda" style={styles.confirmMessage}>
              Os títulos exclusivos desse streaming deixarão de aparecer na Roleta e em Explorar.
            </AppText>
            <View style={styles.confirmActions}>
              <Pressable
                style={({ pressed }) => [styles.confirmDeleteButton, pressed && styles.pressed]}
                onPress={() => {
                  if (deletingSubscription) {
                    removeSubscription(deletingSubscription.id);
                    setDeletingSubscription(null);
                  }
                }}
                accessibilityRole="button">
                <AppText peso="forte" style={styles.confirmDeleteText}>Sim, remover</AppText>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.confirmCancelButton, pressed && styles.pressed]}
                onPress={() => setDeletingSubscription(null)}
                accessibilityRole="button">
                <AppText peso="forte" style={styles.confirmCancelText}>Cancelar</AppText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f5f0' },
  container: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 42 },
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  headerCopy: { flex: 1 },
  eyebrow: { color: '#e58c34', letterSpacing: 1.5, marginBottom: 3 },
  title: { color: '#182230', fontSize: 25, lineHeight: 30, letterSpacing: -0.4 },
  headerActionBtn: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 13, backgroundColor: '#f3b43f' },
  headerActionText: { color: '#182230', fontSize: 13 },
  totalCard: { overflow: 'hidden', borderRadius: 20, borderWidth: 1, borderColor: '#263442', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 16, backgroundColor: '#182230', marginBottom: 26 },
  totalGlow: { position: 'absolute', width: 190, height: 190, borderRadius: 95, top: -120, right: -40, backgroundColor: 'rgba(243,180,63,0.12)' },
  totalTopline: { flexDirection: 'row', alignItems: 'center' },
  totalIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#263b50', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  totalLabel: { color: '#f3b43f', letterSpacing: 1, flex: 1 },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(46,139,87,0.22)' },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#55c596' },
  activeText: { color: '#a5e6ca', fontSize: 11 },
  totalValue: { color: '#fffdf8', fontSize: 32, lineHeight: 38, marginTop: 12, marginBottom: 12 },
  totalCurrency: { color: 'rgba(255,253,248,0.75)', fontSize: 19, lineHeight: 26 },
  totalFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.14)', paddingTop: 12 },
  totalHint: { color: '#bdc6ce', fontSize: 12 },
  costLink: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2 },
  costLinkText: { color: '#f3b43f', fontSize: 12 },
  annualBreakdown: { gap: 8, marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,253,248,0.06)' },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  annualText: { color: '#bdc6ce', fontSize: 12 },
  annualValue: { color: '#fffdf8', fontSize: 13 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 13 },
  sectionHeaderCopy: { flex: 1 },
  sectionTitle: { color: '#182230', fontSize: 18, lineHeight: 23 },
  sectionSubtitle: { color: '#5e5c57', marginTop: 2, fontSize: 13, lineHeight: 18 },
  countBadge: { flexShrink: 0, textAlign: 'center', color: '#565d63', backgroundColor: '#fffdf8', borderWidth: 1, borderColor: '#e8e2d5', borderRadius: 11, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13 },
  subscriptionCard: { borderRadius: 18, borderWidth: 1, borderColor: '#e8e2d5', backgroundColor: '#fffdf8', padding: 14, marginBottom: 12 },
  subscriptionInactive: { opacity: 0.68 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  serviceInfo: { flex: 1 },
  serviceName: { color: '#182230', fontSize: 16, lineHeight: 21 },
  billingText: { color: '#5e5c57', fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  priceArea: { alignItems: 'flex-end' },
  price: { color: '#182230', fontSize: 16, lineHeight: 21 },
  priceCaption: { color: '#5e5c57', fontSize: 12.5, marginTop: 1 },
  cardDivider: { height: 1, backgroundColor: '#f1ece1', marginVertical: 11 },
  cardBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  badgesRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, flex: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  statusPillActive: { backgroundColor: 'rgba(46,139,87,0.12)' },
  statusPillPaused: { backgroundColor: '#f1ece1' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusDotActive: { backgroundColor: '#2e8b57' },
  statusDotPaused: { backgroundColor: '#6b5943' },
  statusTextActive: { color: '#216941', fontSize: 12 },
  statusTextPaused: { color: '#5e5c57', fontSize: 12 },
  reminderBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#fff2d8' },
  reminderText: { color: '#944c0d', fontSize: 12 },
  subscriptionActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconActionBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#f7f5f0', alignItems: 'center', justifyContent: 'center' },
  switchHitArea: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingLeft: 2 },
  customSwitchTrack: { width: 44, height: 26, borderRadius: 13, backgroundColor: '#d8d3c9', padding: 3, justifyContent: 'center' },
  customSwitchTrackActive: { backgroundColor: '#182230' },
  customSwitchThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fffdf8' },
  customSwitchThumbActive: { alignSelf: 'flex-end', backgroundColor: '#f3b43f' },
  addRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: '#d8d3c9', borderStyle: 'dashed', backgroundColor: '#fffdf8', marginTop: 6 },
  addIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3b43f', marginRight: 12 },
  addCopy: { flex: 1 },
  addTitle: { color: '#182230', fontSize: 14.5, lineHeight: 19 },
  addSubtitle: { color: '#5e5c57', fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  emptyState: { alignItems: 'center', paddingHorizontal: 26, paddingVertical: 36, borderRadius: 18, borderWidth: 1, borderColor: '#e8e2d5', backgroundColor: '#fffdf8' },
  emptyIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#f1e8d7', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { color: '#182230', fontSize: 17, lineHeight: 22 },
  emptyDescription: { color: '#5e5c57', textAlign: 'center', fontSize: 13, lineHeight: 19, marginTop: 6 },
  emptyButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 13, paddingHorizontal: 18, paddingVertical: 11, backgroundColor: '#f3b43f', marginTop: 16 },
  emptyButtonText: { color: '#182230', fontSize: 13 },
  confirmBackdrop: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(9,15,23,0.72)' },
  confirmCard: { width: '100%', maxWidth: 360, alignItems: 'center', borderRadius: 24, paddingHorizontal: 22, paddingTop: 24, paddingBottom: 20, backgroundColor: '#fffdf8', borderWidth: 1, borderColor: '#e8e2d5' },
  confirmIconBadge: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#fdecea', borderWidth: 1, borderColor: '#f5c6c2', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  confirmEyebrow: { color: '#c0392b', letterSpacing: 1.3, textAlign: 'center', marginBottom: 6 },
  confirmTitle: { color: '#182230', fontSize: 21, lineHeight: 26, letterSpacing: -0.35, textAlign: 'center', marginBottom: 8 },
  confirmMessage: { color: '#5e5c57', fontSize: 13.5, lineHeight: 20, textAlign: 'center', marginBottom: 20 },
  confirmActions: { width: '100%', gap: 10 },
  confirmDeleteButton: { width: '100%', minHeight: 48, borderRadius: 14, backgroundColor: '#c0392b', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  confirmDeleteText: { color: '#fffdf8', fontSize: 14.5 },
  confirmCancelButton: { width: '100%', minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: '#ded8cd', backgroundColor: '#f7f5f0', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  confirmCancelText: { color: '#182230', fontSize: 14.5 },
});
