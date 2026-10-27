import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/atoms/AppText';
import { ServiceLogo } from '@/components/atoms/ServiceLogo';
import { SubscriptionEditorModal } from '@/components/organisms/SubscriptionEditorModal';
import { Subscription } from '@/constants/subscriptions';
import { useSubscriptions } from '@/contexts/SubscriptionsContext';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default function SubscriptionsScreen() {
  const { subscriptions, saveSubscription, toggleSubscription, removeSubscription } = useSubscriptions();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | undefined>();
  const [showAnnualCost, setShowAnnualCost] = useState(false);

  const activeSubscriptions = useMemo(() => subscriptions.filter((subscription) => subscription.active), [subscriptions]);
  const monthlyTotal = useMemo(() => activeSubscriptions.reduce((total, subscription) => total + subscription.monthlyPrice, 0), [activeSubscriptions]);

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
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <AppText tipo="legenda" peso="forte" style={styles.eyebrow}>SEU PAINEL</AppText>
            <AppText tipo="titulo" peso="forte" style={styles.title}>Assinaturas</AppText>
          </View>
          <View style={styles.headerIcon}><MaterialIcons name="tune" size={21} color="#182230" /></View>
        </View>

        <View style={styles.totalCard}>
          <View style={styles.totalGlow} />
          <View style={styles.totalTopline}>
            <View style={styles.totalIcon}><MaterialIcons name="account-balance-wallet" size={21} color="#f3b43f" /></View>
            <AppText tipo="legenda" peso="forte" style={styles.totalLabel}>TOTAL MENSAL</AppText>
            <View style={styles.activeBadge}><View style={styles.activeDot} /><AppText tipo="legenda" peso="forte" style={styles.activeText}>{activeSubscriptions.length} ativas</AppText></View>
          </View>
          <AppText tipo="titulo" peso="forte" style={styles.totalValue}>{currency.format(monthlyTotal)}</AppText>
          <View style={styles.totalFooter}>
            <AppText tipo="legenda" style={styles.totalHint}>{currency.format(monthlyTotal * 12)} por ano</AppText>
            <Pressable onPress={() => setShowAnnualCost((value) => !value)} style={styles.costLink} accessibilityRole="button">
              <AppText tipo="legenda" peso="forte" style={styles.costLinkText}>{showAnnualCost ? 'Ocultar detalhes' : 'Ver detalhes de gastos'}</AppText>
              <MaterialIcons name={showAnnualCost ? 'expand-less' : 'arrow-forward'} size={15} color="#c7b2ff" />
            </Pressable>
          </View>
          {showAnnualCost && <View style={styles.annualBreakdown}><AppText tipo="legenda" style={styles.annualText}>Custo anual estimado</AppText><AppText tipo="legenda" peso="forte" style={styles.annualValue}>{currency.format(monthlyTotal * 12)}</AppText></View>}
        </View>

        <View style={styles.sectionHeader}>
          <View><AppText tipo="subtitulo" peso="forte" style={styles.sectionTitle}>Suas assinaturas</AppText><AppText tipo="legenda" style={styles.sectionSubtitle}>Controle cobranças e renovações</AppText></View>
          <AppText tipo="legenda" peso="forte" style={styles.countBadge}>{subscriptions.length} {subscriptions.length === 1 ? 'serviço' : 'serviços'}</AppText>
        </View>

        {subscriptions.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}><MaterialIcons name="subscriptions" size={27} color="#a888ff" /></View>
            <AppText tipo="subtitulo" peso="forte" style={styles.emptyTitle}>Nenhuma assinatura ainda</AppText>
            <AppText tipo="legenda" style={styles.emptyDescription}>Adicione seus streamings para acompanhar os gastos e as próximas cobranças.</AppText>
            <Pressable style={styles.emptyButton} onPress={addSubscription}><AppText peso="forte" style={styles.emptyButtonText}>Adicionar serviço</AppText></Pressable>
          </View>
        ) : subscriptions.map((subscription) => {
          return (
            <View key={subscription.id} style={[styles.subscriptionCard, !subscription.active && styles.subscriptionInactive]}>
              <Pressable style={styles.serviceIdentity} onPress={() => editSubscription(subscription)} accessibilityRole="button" accessibilityLabel={`Editar ${subscription.provider}`}>
                <View style={styles.serviceLogo}><ServiceLogo name={subscription.provider} size={40} /></View>
                <View style={styles.serviceInfo}>
                  <View style={styles.nameLine}><AppText peso="forte" style={styles.serviceName}>{subscription.provider}</AppText>{!subscription.active && <AppText tipo="legenda" style={styles.pausedBadge}>PAUSADA</AppText>}</View>
                  <AppText tipo="legenda" style={styles.billingText}>Cobrança todo dia {subscription.billingDay}</AppText>
                  {subscription.active && subscription.renewalAlert && <View style={styles.reminderBadge}><MaterialIcons name="notifications-active" size={11} color="#ffc15d" /><AppText tipo="legenda" peso="forte" style={styles.reminderText}>Aviso {subscription.alertDays} dias antes</AppText></View>}
                </View>
              </Pressable>
              <View style={styles.subscriptionActions}>
                <View style={styles.priceArea}><AppText tipo="legenda" style={styles.priceCaption}>por mês</AppText><AppText peso="forte" style={styles.price}>{currency.format(subscription.monthlyPrice)}</AppText></View>
                <Switch value={subscription.active} onValueChange={() => toggleSubscription(subscription.id)} trackColor={{ false: '#d8d3c9', true: '#e7b23d' }} thumbColor="#fffdf8" accessibilityLabel={subscription.active ? 'Pausar assinatura' : 'Ativar assinatura'} />
                <Pressable style={styles.deleteButton} onPress={() => removeSubscription(subscription.id)} accessibilityRole="button" accessibilityLabel={`Remover ${subscription.provider}`}>
                  <MaterialIcons name="delete-outline" size={19} color="#858794" />
                </Pressable>
              </View>
            </View>
          );
        })}

        <Pressable style={styles.addRow} onPress={addSubscription} accessibilityRole="button">
          <View style={styles.addIcon}><MaterialIcons name="add" size={22} color="#fff" /></View>
          <View style={styles.addCopy}><AppText peso="forte" style={styles.addTitle}>Adicionar assinatura</AppText><AppText tipo="legenda" style={styles.addSubtitle}>Netflix, Disney+, Max e outros</AppText></View>
          <MaterialIcons name="chevron-right" size={23} color="#777986" />
        </Pressable>

        <View style={styles.tipCard}><MaterialIcons name="lightbulb-outline" size={18} color="#a888ff" /><AppText tipo="legenda" style={styles.tipText}>Dica: acompanhe aqui todas as cobranças mensais dos seus serviços.</AppText></View>
      </ScrollView>

      <Pressable style={styles.fab} onPress={addSubscription} accessibilityRole="button" accessibilityLabel="Adicionar nova assinatura"><MaterialIcons name="add" size={28} color="#fff" /></Pressable>

      {editorOpen && <SubscriptionEditorModal key={editingSubscription?.id ?? 'new-subscription'} initialSubscription={editingSubscription} onClose={() => setEditorOpen(false)} onSave={handleSaveSubscription} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f5f0' },
  container: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 110 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  eyebrow: { color: '#e58c34', letterSpacing: 1.5, marginBottom: 5 },
  title: { color: '#182230', fontSize: 25, lineHeight: 30 },
  headerIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#fffdf8', alignItems: 'center', justifyContent: 'center' },
  totalCard: { overflow: 'hidden', borderRadius: 19, paddingHorizontal: 18, paddingTop: 17, paddingBottom: 15, backgroundColor: '#182230', marginBottom: 26 },
  totalGlow: { position: 'absolute', width: 190, height: 190, borderRadius: 95, top: -120, right: -40, backgroundColor: 'rgba(243,180,63,0.12)' },
  totalTopline: { flexDirection: 'row', alignItems: 'center' },
  totalIcon: { width: 37, height: 37, borderRadius: 12, backgroundColor: '#263b50', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  totalLabel: { color: '#f3b43f', letterSpacing: 1, flex: 1 },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: 'rgba(62,155,118,0.18)' },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#55c596' },
  activeText: { color: '#a5e6ca', fontSize: 10 },
  totalValue: { color: '#fff', fontSize: 31, lineHeight: 38, marginTop: 12, marginBottom: 12 },
  totalFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.14)', paddingTop: 11 },
  totalHint: { color: '#bdc6ce' },
  costLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  costLinkText: { color: '#f3b43f', fontSize: 10 },
  annualBreakdown: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, padding: 11, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.16)' },
  annualText: { color: '#bdc6ce' },
  annualValue: { color: '#fff' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  sectionTitle: { color: '#182230', fontSize: 18, lineHeight: 23 },
  sectionSubtitle: { color: '#7b7b78', marginTop: 2, fontSize: 10 },
  countBadge: { color: '#657078', backgroundColor: '#fffdf8', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6, fontSize: 10 },
  subscriptionCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 81, paddingHorizontal: 11, paddingVertical: 10, borderRadius: 16, backgroundColor: '#fffdf8', marginBottom: 9 },
  subscriptionInactive: { opacity: 0.58 },
  serviceIdentity: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 5 },
  serviceLogo: { marginRight: 10 },
  serviceInfo: { flex: 1 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  serviceName: { color: '#182230', fontSize: 12 },
  pausedBadge: { color: '#a36a21', fontSize: 8, letterSpacing: 0.5 },
  billingText: { color: '#7b7b78', fontSize: 9, marginTop: 3 },
  reminderBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 3, backgroundColor: '#fff2d8', marginTop: 4 },
  reminderText: { color: '#a36a21', fontSize: 8 },
  subscriptionActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  priceArea: { alignItems: 'flex-end', marginRight: 2 },
  priceCaption: { color: '#7b7b78', fontSize: 8 },
  price: { color: '#182230', fontSize: 12, marginTop: 2 },
  deleteButton: { width: 27, height: 35, alignItems: 'center', justifyContent: 'center' },
  addRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderRadius: 15, borderWidth: 1, borderColor: '#d8d3c9', borderStyle: 'dashed', backgroundColor: '#fffdf8', marginTop: 5 },
  addIcon: { width: 37, height: 37, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e58c34', marginRight: 11 },
  addCopy: { flex: 1 },
  addTitle: { color: '#182230', fontSize: 11 },
  addSubtitle: { color: '#7b7b78', fontSize: 9, marginTop: 3 },
  tipCard: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 11, paddingVertical: 12, marginTop: 16, borderRadius: 13, backgroundColor: '#f1e8d7' },
  tipText: { color: '#687078', flex: 1, fontSize: 9, lineHeight: 14 },
  emptyState: { alignItems: 'center', paddingHorizontal: 28, paddingVertical: 34, borderRadius: 18, backgroundColor: '#fffdf8' },
  emptyIcon: { width: 53, height: 53, borderRadius: 18, backgroundColor: '#f1e8d7', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { color: '#182230', fontSize: 14 },
  emptyDescription: { color: '#7b7b78', textAlign: 'center', fontSize: 10, lineHeight: 16, marginTop: 6 },
  emptyButton: { borderRadius: 12, paddingHorizontal: 17, paddingVertical: 10, backgroundColor: '#e58c34', marginTop: 15 },
  emptyButtonText: { color: '#fff', fontSize: 11 },
  fab: { position: 'absolute', right: 21, bottom: 24, width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3b43f', elevation: 7 },
});