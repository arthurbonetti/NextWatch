import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/atoms/AppText';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptions } from '@/contexts/SubscriptionsContext';

export default function ProfileScreen() {
  const { user, token, isConnected, signOut } = useAuth();
  const { subscriptions } = useSubscriptions();
  const activeSubscriptions = subscriptions.filter((subscription) => subscription.active);
  const monthlyTotal = activeSubscriptions.reduce((total, subscription) => total + subscription.monthlyPrice, 0);
  const initials = user?.name.trim().charAt(0).toLocaleUpperCase() ?? '?';

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            accessibilityLabel="Voltar"
            accessibilityRole="button">
            <MaterialIcons name="arrow-back" size={22} color="#182230" />
          </Pressable>
          <AppText tipo="subtitulo" peso="forte" style={styles.heading}>Meu perfil</AppText>
          <View style={styles.spacer} />
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <AppText peso="forte" style={styles.avatarText}>{initials}</AppText>
          </View>
          <AppText tipo="subtitulo" peso="forte" style={styles.name}>{user?.name ?? 'Usuário'}</AppText>
          <AppText tipo="legenda" style={styles.muted}>{user?.email ?? ''}</AppText>
          <View style={styles.statusBadge}>
            <MaterialIcons name="verified-user" size={14} color="#2e8b57" />
            <AppText tipo="legenda" peso="forte" style={styles.statusBadgeText}>
              {token ? 'Conta sincronizada' : 'Sessão ativa'}
              {isConnected === false ? ' · Modo offline' : ' · Online'}
            </AppText>
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
            <AppText tipo="legenda" style={styles.muted}>cadastradas</AppText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <AppText tipo="subtitulo" peso="forte" style={styles.number}>{monthlyTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</AppText>
            <AppText tipo="legenda" style={styles.muted}>por mês</AppText>
          </View>
        </View>

        <AppText tipo="subtitulo" peso="forte" style={styles.sectionTitle}>Ações rápidas</AppText>
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          onPress={() => router.push('/(tabs)/tab3')}
          accessibilityRole="button">
          <MaterialIcons name="subscriptions" size={22} color="#d77c29" />
          <AppText peso="forte" style={styles.rowText}>Gerenciar assinaturas</AppText>
          <MaterialIcons name="chevron-right" size={22} color="#aaa59b" />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          onPress={() => router.push('/(tabs)/tab2')}
          accessibilityRole="button">
          <MaterialIcons name="local-movies" size={22} color="#182230" />
          <AppText peso="forte" style={styles.rowText}>Explorar catálogo completo</AppText>
          <MaterialIcons name="chevron-right" size={22} color="#aaa59b" />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.row, styles.logoutRow, pressed && styles.pressed]}
          onPress={() => { void handleSignOut(); }}
          accessibilityRole="button">
          <MaterialIcons name="logout" size={22} color="#c0392b" />
          <AppText peso="forte" style={styles.logoutText}>Sair da conta</AppText>
          <MaterialIcons name="chevron-right" size={22} color="#aaa59b" />
        </Pressable>

        <AppText tipo="legenda" style={styles.credits}>
          Pôsteres e metadados: The Movie Database (TMDB). Este produto utiliza a API do TMDB, mas não é endossado ou certificado pelo TMDB.
        </AppText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f5f0' },
  container: { width: '100%', maxWidth: 640, alignSelf: 'center', padding: 20, paddingBottom: 36 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  backButton: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: '#e8e2d5', backgroundColor: '#fffdf8', alignItems: 'center', justifyContent: 'center' },
  heading: { color: '#182230', fontSize: 20 },
  spacer: { width: 44 },
  profileCard: { alignItems: 'center', backgroundColor: '#fffdf8', borderRadius: 22, borderWidth: 1, borderColor: '#e8e2d5', paddingVertical: 24, paddingHorizontal: 20, marginBottom: 24 },
  avatar: { width: 78, height: 78, borderRadius: 39, backgroundColor: '#182230', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { color: '#f3b43f', fontSize: 30 },
  name: { color: '#182230', fontSize: 21, marginBottom: 3 },
  muted: { color: '#7b7b78' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: '#f1e8d7' },
  statusBadgeText: { color: '#8b5827', fontSize: 11 },
  sectionTitle: { color: '#182230', fontSize: 18, lineHeight: 23, marginBottom: 12 },
  stats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: '#fffdf8', borderWidth: 1, borderColor: '#e8e2d5', borderRadius: 18, paddingVertical: 16, paddingHorizontal: 8, marginBottom: 24 },
  stat: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 34, backgroundColor: '#e8e2d5' },
  number: { color: '#182230', textAlign: 'center', fontSize: 18, lineHeight: 24, marginBottom: 2 },
  row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffdf8', borderWidth: 1, borderColor: '#e8e2d5', borderRadius: 16, paddingHorizontal: 16, marginBottom: 10 },
  rowText: { color: '#182230', flex: 1, marginLeft: 12 },
  logoutRow: { marginTop: 2 },
  logoutText: { color: '#c0392b', flex: 1, marginLeft: 12 },
  credits: { color: '#8d7a61', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 22 },
});