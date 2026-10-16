import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, SafeAreaView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/atoms/AppText';

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.topbar}><Pressable onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Voltar"><MaterialIcons name="arrow-back" size={22} color="#182230" /></Pressable><AppText tipo="subtitulo" peso="forte" style={styles.heading}>Meu perfil</AppText><View style={styles.spacer} /></View>
        <View style={styles.profile}><View style={styles.avatar}><AppText peso="forte" style={styles.avatarText}>M</AppText></View><AppText tipo="subtitulo" peso="forte" style={styles.name}>Matheus</AppText><AppText tipo="legenda" style={styles.muted}>matheus@email.com</AppText></View>
        <View style={styles.stats}><View><AppText tipo="subtitulo" peso="forte" style={styles.number}>6</AppText><AppText tipo="legenda" style={styles.muted}>na lista</AppText></View><View><AppText tipo="subtitulo" peso="forte" style={styles.number}>3</AppText><AppText tipo="legenda" style={styles.muted}>serviços</AppText></View><View><AppText tipo="subtitulo" peso="forte" style={styles.number}>12</AppText><AppText tipo="legenda" style={styles.muted}>assistidos</AppText></View></View>
        <AppText tipo="subtitulo" peso="forte" style={styles.sectionTitle}>Preferências</AppText><Pressable style={styles.row}><MaterialIcons name="subscriptions" size={22} color="#d77c29" /><AppText peso="forte" style={styles.rowText}>Gerenciar serviços</AppText><MaterialIcons name="chevron-right" size={22} color="#aaa59b" /></Pressable><Pressable style={styles.row}><MaterialIcons name="notifications-none" size={22} color="#d77c29" /><AppText peso="forte" style={styles.rowText}>Notificações</AppText><MaterialIcons name="chevron-right" size={22} color="#aaa59b" /></Pressable><Pressable style={styles.row}><MaterialIcons name="logout" size={22} color="#d77c29" /><AppText peso="forte" style={styles.rowText}>Sair da conta</AppText><MaterialIcons name="chevron-right" size={22} color="#aaa59b" /></Pressable>
        <AppText tipo="legenda" style={styles.credits}>Pôsteres e banners: The Movie Database (TMDB). This product uses the TMDB API but is not endorsed or certified by TMDB.</AppText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safeArea: { flex: 1, backgroundColor: '#f7f5f0' }, container: { padding: 20 }, topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }, backButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#fffdf8', alignItems: 'center', justifyContent: 'center' }, heading: { color: '#182230', fontSize: 20 }, spacer: { width: 42 }, profile: { alignItems: 'center', marginBottom: 32 }, avatar: { width: 82, height: 82, borderRadius: 41, backgroundColor: '#182230', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }, avatarText: { color: '#f3b43f', fontSize: 32 }, name: { color: '#182230', fontSize: 21, marginBottom: 3 }, muted: { color: '#7b7b78' }, stats: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#f1e8d7', borderRadius: 18, paddingVertical: 17, marginBottom: 31 }, number: { color: '#182230', textAlign: 'center', fontSize: 20, lineHeight: 24, marginBottom: 3 }, sectionTitle: { color: '#182230', fontSize: 19, lineHeight: 24, marginBottom: 13 }, row: { height: 60, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffdf8', borderRadius: 15, paddingHorizontal: 15, marginBottom: 10 }, rowText: { color: '#182230', flex: 1, marginLeft: 12 }, credits: { color: '#9a978f', fontSize: 10, lineHeight: 14, textAlign: 'center', marginTop: 18 } });