import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useState } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/atoms/AppText';

const services = [
  { name: 'Netflix', color: '#e50914', symbol: 'N' },
  { name: 'Disney+', color: '#113ccf', symbol: 'D' },
  { name: 'Max', color: '#17132f', symbol: 'M' },
];

const titles = [
  { name: 'Duna: Parte Dois', meta: '2024 · Ficção', color: '#c18b57', icon: 'movie' as const },
  { name: 'Bebê Rena', meta: 'Série · Drama', color: '#7c5260', icon: 'live-tv' as const },
  { name: 'O Menu', meta: '2022 · Terror', color: '#8b6c48', icon: 'theaters' as const },
];

export default function HomeScreen() {
  const [genre, setGenre] = useState('Tanto faz');
  const [drawn, setDrawn] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}>
          <View>
            <AppText tipo="legenda" peso="forte" style={styles.eyebrow}>NEXTWATCH</AppText>
            <AppText tipo="titulo" peso="forte" style={styles.greeting}>Boa noite, Matheus</AppText>
          </View>
          <Pressable style={styles.avatar} accessibilityLabel="Abrir perfil"><AppText peso="forte" style={styles.avatarText}>M</AppText></Pressable>
        </View>

        <View style={styles.statsRow}>
          <View><AppText tipo="subtitulo" peso="forte" style={styles.statNumber}>3</AppText><AppText tipo="legenda" style={styles.muted}>serviços ativos</AppText></View>
          <View style={styles.statDivider} />
          <View><AppText tipo="subtitulo" peso="forte" style={styles.statNumber}>6</AppText><AppText tipo="legenda" style={styles.muted}>títulos na sua lista</AppText></View>
          <Pressable style={styles.notification} accessibilityLabel="Notificações"><MaterialIcons name="notifications-none" size={22} color="#182230" /></Pressable>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <View style={styles.heroCopy}>
            <View style={styles.pill}><MaterialIcons name="auto-awesome" size={13} color="#f3b43f" /><AppText tipo="legenda" peso="forte" style={styles.pillText}>SEU SORTEIO</AppText></View>
            <AppText tipo="subtitulo" peso="forte" style={styles.heroTitle}>{drawn ? 'Sua próxima sessão' : 'Não sabe o que ver?'}</AppText>
            <AppText tipo="legenda" style={styles.heroDescription}>{drawn ? 'Duna: Parte Dois está te esperando.' : 'A gente sorteia entre o que você já paga.'}</AppText>
            <Pressable style={styles.drawButton} onPress={() => setFilterVisible(true)} accessibilityRole="button"><AppText peso="forte" style={styles.drawButtonText}>{drawn ? 'Sortear de novo' : 'Sortear agora'}</AppText><MaterialIcons name="arrow-forward" size={18} color="#182230" /></Pressable>
          </View>
          <View style={styles.heroArt}><MaterialIcons name={drawn ? 'local-movies' : 'casino'} size={74} color="#f3b43f" /></View>
        </View>

        <View style={styles.sectionHeader}><AppText tipo="subtitulo" peso="forte" style={styles.sectionTitle}>Seus serviços</AppText><Pressable><AppText tipo="legenda" peso="forte" style={styles.link}>Ver tudo</AppText></Pressable></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.serviceList}>
          {services.map((service) => <View style={styles.serviceCard} key={service.name}><View style={[styles.serviceLogo, { backgroundColor: service.color }]}><AppText peso="forte" style={styles.serviceSymbol}>{service.symbol}</AppText></View><View><AppText peso="forte" style={styles.serviceName}>{service.name}</AppText><AppText tipo="legenda" style={styles.muted}>Ativo agora</AppText></View><MaterialIcons name="check-circle" size={17} color="#3e9b76" /></View>)}
        </ScrollView>

        <View style={styles.spendCard}><View style={styles.spendIcon}><MaterialIcons name="payments" size={21} color="#e58c34" /></View><View style={styles.spendCopy}><AppText tipo="legenda" style={styles.muted}>Gasto mensal</AppText><AppText tipo="subtitulo" peso="forte" style={styles.spendValue}>R$ 89,70</AppText></View><AppText tipo="legenda" style={styles.muted}>3 assinaturas</AppText></View>

        <View style={styles.sectionHeader}><AppText tipo="subtitulo" peso="forte" style={styles.sectionTitle}>Na sua lista</AppText><Pressable><AppText tipo="legenda" peso="forte" style={styles.link}>Ver tudo</AppText></Pressable></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.titleList}>
          {titles.map((title) => <View style={styles.titleCard} key={title.name}><View style={[styles.poster, { backgroundColor: title.color }]}><MaterialIcons name={title.icon} size={35} color="rgba(255,255,255,0.78)" /><AppText tipo="legenda" peso="forte" style={styles.posterLabel}>{title.name.toUpperCase()}</AppText></View><AppText peso="forte" style={styles.titleName}>{title.name}</AppText><AppText tipo="legenda" style={styles.muted}>{title.meta}</AppText></View>)}
        </ScrollView>

      </ScrollView>

      <Modal visible={filterVisible} transparent animationType="fade" onRequestClose={() => setFilterVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View><AppText tipo="legenda" peso="forte" style={styles.modalEyebrow}>SEU SORTEIO</AppText><AppText tipo="subtitulo" peso="forte" style={styles.modalTitle}>O que você quer ver?</AppText></View>
              <Pressable onPress={() => setFilterVisible(false)} style={styles.closeButton} accessibilityLabel="Fechar filtros"><MaterialIcons name="close" size={21} color="#182230" /></Pressable>
            </View>
            <AppText tipo="legenda" style={styles.modalDescription}>Escolha um gênero ou deixe a gente surpreender você.</AppText>
            <View style={styles.modalChips}>
              {['Tanto faz', 'Ficção', 'Drama', 'Terror', 'Comédia'].map((item) => <Pressable key={item} onPress={() => setGenre(item)} style={[styles.chip, genre === item && styles.chipSelected]}><AppText tipo="legenda" peso="forte" style={genre === item ? styles.chipTextSelected : styles.chipText}>{item}</AppText></Pressable>)}
            </View>
            <Pressable style={styles.confirmButton} onPress={() => { setDrawn(true); setFilterVisible(false); }} accessibilityRole="button"><AppText peso="forte" style={styles.confirmButtonText}>Sortear agora</AppText><MaterialIcons name="auto-awesome" size={18} color="#182230" /></Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f5f0' },
  container: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 21 },
  eyebrow: { color: '#e58c34', letterSpacing: 1.5, marginBottom: 5 },
  greeting: { color: '#182230', fontSize: 25, lineHeight: 30 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#182230' },
  avatarText: { color: '#f3b43f', fontSize: 18 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
  statNumber: { color: '#182230', lineHeight: 22 },
  statDivider: { width: 1, height: 29, backgroundColor: '#d9d3c8', marginHorizontal: 18 },
  muted: { color: '#7b7b78' },
  notification: { marginLeft: 'auto', width: 40, height: 40, borderRadius: 20, backgroundColor: '#fffdf8', alignItems: 'center', justifyContent: 'center' },
  hero: { minHeight: 190, overflow: 'hidden', borderRadius: 22, backgroundColor: '#182230', flexDirection: 'row', marginBottom: 29 },
  heroGlow: { position: 'absolute', width: 190, height: 190, borderRadius: 95, right: -48, top: -28, backgroundColor: '#263b50' },
  heroCopy: { flex: 1, padding: 20, zIndex: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  pillText: { color: '#f3b43f', letterSpacing: 1.1 },
  heroTitle: { color: '#fffdf8', fontSize: 22, lineHeight: 27, marginBottom: 5 },
  heroDescription: { color: '#bdc6ce', maxWidth: 190, marginBottom: 15 },
  drawButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, backgroundColor: '#f3b43f', paddingHorizontal: 14, paddingVertical: 10 },
  drawButtonText: { color: '#182230', fontSize: 13 },
  heroArt: { width: 102, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-12deg' }] },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  sectionTitle: { color: '#182230', fontSize: 19, lineHeight: 24 },
  link: { color: '#d77c29' },
  serviceList: { gap: 10, paddingBottom: 25 },
  serviceCard: { width: 174, height: 68, padding: 10, borderRadius: 15, backgroundColor: '#fffdf8', flexDirection: 'row', alignItems: 'center', gap: 9 },
  serviceLogo: { width: 39, height: 39, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  serviceSymbol: { color: '#fff', fontSize: 19 },
  serviceName: { color: '#182230', fontSize: 13 },
  spendCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, backgroundColor: '#f1e8d7', marginBottom: 28 },
  spendIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff7e8', justifyContent: 'center', alignItems: 'center', marginRight: 11 },
  spendCopy: { flex: 1 },
  spendValue: { color: '#182230', fontSize: 20, lineHeight: 24, marginTop: 1 },
  titleList: { gap: 13, paddingBottom: 28 },
  titleCard: { width: 125 },
  poster: { height: 157, borderRadius: 14, justifyContent: 'center', alignItems: 'center', gap: 11, padding: 12, marginBottom: 9 },
  posterLabel: { color: 'rgba(255,255,255,0.9)', textAlign: 'center', letterSpacing: 0.8 },
  titleName: { color: '#182230', fontSize: 13, lineHeight: 18 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(24,34,48,0.55)' },
  modalCard: { backgroundColor: '#fffdf8', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 24, paddingBottom: 32 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  modalEyebrow: { color: '#e58c34', letterSpacing: 1.2, marginBottom: 6 },
  modalTitle: { color: '#182230', fontSize: 22, lineHeight: 27 },
  closeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f1eee7', alignItems: 'center', justifyContent: 'center' },
  modalDescription: { color: '#7b7b78', marginTop: 8, marginBottom: 22 },
  modalChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 25 },
  confirmButton: { minHeight: 52, borderRadius: 14, backgroundColor: '#f3b43f', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  confirmButtonText: { color: '#182230' },
  chip: { borderRadius: 18, borderWidth: 1, borderColor: '#ded8cd', paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#fffdf8' },
  chipSelected: { backgroundColor: '#182230', borderColor: '#182230' },
  chipText: { color: '#6c6b67' },
  chipTextSelected: { color: '#fffdf8' },
});