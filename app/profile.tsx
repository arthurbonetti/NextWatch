import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/atoms/AppText';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptions } from '@/contexts/SubscriptionsContext';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { subscriptions } = useSubscriptions();
  const activeSubscriptions = subscriptions.filter((subscription) => subscription.active);
  const monthlyTotal = activeSubscriptions.reduce((total, subscription) => total + subscription.monthlyPrice, 0);
  const initials = user?.name.trim().charAt(0).toLocaleUpperCase() ?? '?';

  const handleSignOut = () => {
    signOut();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}>
          <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Voltar" accessibilityRole="button">
            <MaterialIcons name="arrow-back" size={22} color="#182230" />
          </Pressable>
          <AppText tipo="subtitulo" peso="forte" style={styles.heading}>Meu perfil</AppText>
          <View style={styles.spacer} />
        </View>

        <View style={styles.profile}>
          <View style={styles.avatar}><AppText peso="forte" style={styles.avatarText}>{initials}</AppText></View>
          <AppText tipo="subtitulo" peso="forte" style={styles.name}>{user?.name ?? 'Usuário'}</AppText>
          <AppText tipo="legenda" style={styles.muted}>{user?.email ?? ''}</AppText>
          <View style={styles.demoBadge}>
            <MaterialIcons name="science" size={15} color="#9a5b20" />
            <AppText tipo="legenda" peso="forte" style={styles.demoBadgeText}>Conta de demonstração</AppText>
          </View>
        </View>

        <AppText tipo="subtitulo" peso="forte" style={styles.sectionTitle}>Resumo da sua conta</AppText>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <AppText tipo="subtitulo" peso="forte" style={styles.number}>{activeSubscriptions.length}</AppText>
            <AppText tipo="legenda" style={styles.muted}>ativas</AppText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <AppText tipo="subtitulo" peso="forte" style={styles.number}>{subscriptions.length}</AppText>
            <AppText tipo="legenda" style={styles.muted}>serviços</AppText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <AppText tipo="subtitulo" peso="forte" style={styles.number}>{monthlyTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</AppText>
            <AppText tipo="legenda" style={styles.muted}>por mês</AppText>
          </View>
        </View>

        <AppText tipo="subtitulo" peso="forte" style={styles.sectionTitle}>Sua conta</AppText>
        <Pressable style={styles.row} onPress={() => router.push('/(tabs)/tab3')} accessibilityRole="button">
          <MaterialIcons name="subscriptions" size={22} color="#d77c29" />
          <AppText peso="forte" style={styles.rowText}>Gerenciar serviços</AppText>
          <MaterialIcons name="chevron-right" size={22} color="#aaa59b" />
        </Pressable>
        <Pressable style={[styles.row, styles.logoutRow]} onPress={handleSignOut} accessibilityRole="button">
          <MaterialIcons name="logout" size={22} color="#b5473c" />
          <AppText peso="forte" style={styles.logoutText}>Sair da conta</AppText>
          <MaterialIcons name="chevron-right" size={22} color="#aaa59b" />
        </Pressable>

        <AppText tipo="legenda" style={styles.demoMessage}>O cadastro e a sessão são temporários e existem somente nesta demonstração. A conexão com banco de dados será adicionada depois.</AppText>
        <AppText tipo="legenda" style={styles.credits}>Pôsteres e banners: The Movie Database (TMDB). Este produto usa a API do TMDB, mas não é endossado ou certificado pelo TMDB.</AppText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f5f0' },
  container: { width: '100%', maxWidth: 640, alignSelf: 'center', padding: 20, paddingBottom: 32 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 30 },
  backButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#fffdf8', alignItems: 'center', justifyContent: 'center' },
  heading: { color: '#182230', fontSize: 20 },
  spacer: { width: 42 },
  profile: { alignItems: 'center', marginBottom: 30 },
  avatar: { width: 82, height: 82, borderRadius: 41, backgroundColor: '#182230', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { color: '#f3b43f', fontSize: 32 },
  name: { color: '#182230', fontSize: 21, marginBottom: 3 },
  muted: { color: '#7b7b78' },
  demoBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 14, backgroundColor: '#f1e8d7' },
  demoBadgeText: { color: '#9a5b20' },
  sectionTitle: { color: '#182230', fontSize: 19, lineHeight: 24, marginBottom: 13 },
  stats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: '#f1e8d7', borderRadius: 18, paddingVertical: 17, paddingHorizontal: 8, marginBottom: 28 },
  stat: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 34, backgroundColor: '#dacdb8' },
  number: { color: '#182230', textAlign: 'center', fontSize: 18, lineHeight: 24, marginBottom: 3 },
  row: { minHeight: 60, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffdf8', borderRadius: 15, paddingHorizontal: 15, marginBottom: 10 },
  rowText: { color: '#182230', flex: 1, marginLeft: 12 },
  logoutRow: { marginTop: 4 },
  logoutText: { color: '#b5473c', flex: 1, marginLeft: 12 },
  demoMessage: { color: '#7b7b78', textAlign: 'center', marginTop: 14, paddingHorizontal: 8 },
  credits: { color: '#9a978f', fontSize: 10, lineHeight: 14, textAlign: 'center', marginTop: 18 },
});