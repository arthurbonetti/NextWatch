import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/atoms/AppText';
import { ServiceLogo } from '@/components/atoms/ServiceLogo';
import { SUBSCRIPTION_PROVIDERS, Subscription, SubscriptionProvider } from '@/constants/subscriptions';

type Props = {
  initialSubscription?: Subscription;
  onClose: () => void;
  onSave: (subscription: Subscription) => void;
};

export function SubscriptionEditorModal({ initialSubscription, onClose, onSave }: Props) {
  const [provider, setProvider] = useState(initialSubscription?.provider ?? SUBSCRIPTION_PROVIDERS[0].name);
  const [monthlyPrice, setMonthlyPrice] = useState(initialSubscription?.monthlyPrice.toFixed(2).replace('.', ',') ?? '');
  const [billingDay, setBillingDay] = useState(initialSubscription?.billingDay.toString() ?? '');
  const [renewalAlert, setRenewalAlert] = useState(initialSubscription?.renewalAlert ?? true);
  const [alertDays, setAlertDays] = useState<1 | 3 | 7>(initialSubscription?.alertDays ?? 3);
  const [focusedField, setFocusedField] = useState<'price' | 'day' | null>(null);
  const [error, setError] = useState('');

  const save = () => {
    const parsedPrice = Number(monthlyPrice.replace(',', '.'));
    const parsedDay = Number(billingDay);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError('Informe um valor mensal válido.');
      return;
    }
    if (!Number.isInteger(parsedDay) || parsedDay < 1 || parsedDay > 31) {
      setError('O dia de cobrança deve estar entre 1 e 31.');
      return;
    }

    onSave({
      id: initialSubscription?.id ?? `${provider.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
      provider,
      monthlyPrice: parsedPrice,
      billingDay: parsedDay,
      active: initialSubscription?.active ?? true,
      renewalAlert,
      alertDays,
    });
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fechar formulário" />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.header}>
            <View>
              <AppText tipo="legenda" peso="forte" style={styles.eyebrow}>{initialSubscription ? 'EDITAR PLANO' : 'NOVA ASSINATURA'}</AppText>
              <AppText tipo="subtitulo" peso="forte" style={styles.title}>{initialSubscription ? 'Atualize os dados' : 'Adicionar serviço'}</AppText>
            </View>
            <Pressable
              style={({ pressed }) => [styles.close, pressed && styles.pressed]}
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Fechar">
              <MaterialIcons name="close" size={21} color="#182230" />
            </Pressable>
          </View>

          <AppText tipo="legenda" peso="forte" style={styles.label}>SERVIÇO DE STREAMING</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.providers}>
            {SUBSCRIPTION_PROVIDERS.map((item: SubscriptionProvider) => (
              <Pressable
                key={item.name}
                onPress={() => setProvider(item.name)}
                style={({ pressed }) => [
                  styles.providerChip,
                  provider === item.name && styles.providerChipSelected,
                  pressed && styles.pressed,
                ]}>
                <ServiceLogo name={item.name} size={24} />
                <AppText tipo="legenda" peso="forte" style={styles.providerName}>{item.name}</AppText>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.fieldsRow}>
            <View style={styles.priceField}>
              <AppText tipo="legenda" peso="forte" style={styles.label}>VALOR MENSAL</AppText>
              <View style={[styles.inputWrap, focusedField === 'price' && styles.inputWrapFocused]}>
                <AppText tipo="legenda" peso="forte" style={styles.currency}>R$</AppText>
                <TextInput
                  value={monthlyPrice}
                  onChangeText={(value) => { setMonthlyPrice(value); setError(''); }}
                  onFocus={() => setFocusedField('price')}
                  onBlur={() => setFocusedField((prev) => (prev === 'price' ? null : prev))}
                  keyboardType="decimal-pad"
                  placeholder="39,90"
                  placeholderTextColor="#9a978f"
                  style={styles.input}
                  selectionColor="#d77c29"
                />
              </View>
            </View>
            <View style={styles.dayField}>
              <AppText tipo="legenda" peso="forte" style={styles.label}>DIA DA COBRANÇA</AppText>
              <View style={[styles.inputWrap, focusedField === 'day' && styles.inputWrapFocused]}>
                <TextInput
                  value={billingDay}
                  onChangeText={(value) => { setBillingDay(value.replace(/[^0-9]/g, '').slice(0, 2)); setError(''); }}
                  onFocus={() => setFocusedField('day')}
                  onBlur={() => setFocusedField((prev) => (prev === 'day' ? null : prev))}
                  keyboardType="number-pad"
                  placeholder="18"
                  placeholderTextColor="#9a978f"
                  style={styles.input}
                  selectionColor="#d77c29"
                  maxLength={2}
                />
                <AppText tipo="legenda" style={styles.daySuffix}>de cada mês</AppText>
              </View>
            </View>
          </View>

          <View style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <View style={styles.alertIcon}><MaterialIcons name="notifications-active" size={19} color="#d77c29" /></View>
              <View style={styles.alertCopy}><AppText tipo="legenda" peso="forte" style={styles.alertTitle}>Avisar antes de renovar</AppText><AppText tipo="legenda" style={styles.helper}>Receba um lembrete antes da cobrança</AppText></View>
              <Pressable
                onPress={() => setRenewalAlert((prev) => !prev)}
                hitSlop={8}
                accessibilityRole="switch"
                accessibilityState={{ checked: renewalAlert }}
                accessibilityLabel="Alternar lembrete de renovação"
                style={[styles.customSwitchTrack, renewalAlert && styles.customSwitchTrackActive]}>
                <View style={[styles.customSwitchThumb, renewalAlert && styles.customSwitchThumbActive]} />
              </Pressable>
            </View>
            {renewalAlert && (
              <View style={styles.reminderOptions}>
                {([1, 3, 7] as const).map((days) => (
                  <Pressable
                    key={days}
                    onPress={() => setAlertDays(days)}
                    style={({ pressed }) => [
                      styles.reminderChip,
                      alertDays === days && styles.reminderSelected,
                      pressed && styles.pressed,
                    ]}>
                    <AppText tipo="legenda" peso="forte" style={alertDays === days ? styles.reminderSelectedText : styles.reminderText}>
                      {days} {days === 1 ? 'dia' : 'dias'}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {error ? <AppText tipo="legenda" peso="medio" style={styles.error}>{error}</AppText> : null}
          <Pressable style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]} onPress={save} accessibilityRole="button">
            <AppText peso="forte" style={styles.saveText}>{initialSubscription ? 'Salvar alterações' : 'Adicionar assinatura'}</AppText>
            <MaterialIcons name="check" size={19} color="#182230" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(24,34,48,0.58)' },
  sheet: { maxHeight: '94%', borderTopLeftRadius: 27, borderTopRightRadius: 27, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, backgroundColor: '#fffdf8' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#d8d3c9', alignSelf: 'center', marginBottom: 14 },
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  eyebrow: { color: '#e58c34', letterSpacing: 1.4, marginBottom: 5 },
  title: { color: '#182230', fontSize: 21, lineHeight: 26 },
  close: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#f1eee7', alignItems: 'center', justifyContent: 'center' },
  label: { color: '#7b7b78', letterSpacing: 0.8, marginBottom: 10 },
  providers: { gap: 8, paddingBottom: 22 },
  providerChip: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: '#ded8cd', borderRadius: 14, backgroundColor: '#fffdf8', paddingHorizontal: 11, paddingVertical: 9 },
  providerChipSelected: { borderColor: '#e58c34', backgroundColor: '#fff2d8' },
  providerName: { color: '#182230', fontSize: 12 },
  fieldsRow: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  priceField: { flex: 1.15 },
  dayField: { flex: 0.85 },
  inputWrap: { minHeight: 50, flexDirection: 'row', alignItems: 'center', borderRadius: 13, borderWidth: 1, borderColor: '#ded8cd', backgroundColor: '#f7f5f0', paddingHorizontal: 12 },
  inputWrapFocused: { borderColor: '#182230', backgroundColor: '#fffdf8' },
  currency: { color: '#d77c29', marginRight: 7 },
  input: { flex: 1, color: '#182230', fontSize: 15, paddingVertical: 9 },
  daySuffix: { color: '#7b7b78', fontSize: 11 },
  alertCard: { borderRadius: 16, borderWidth: 1, borderColor: '#e5dac3', backgroundColor: '#f1e8d7', padding: 13, marginBottom: 17 },
  alertHeader: { flexDirection: 'row', alignItems: 'center' },
  alertIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#fff7e8', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  alertCopy: { flex: 1 },
  alertTitle: { color: '#182230', fontSize: 13 },
  helper: { color: '#7b7b78', fontSize: 11, marginTop: 2 },
  customSwitchTrack: { width: 44, height: 26, borderRadius: 13, backgroundColor: '#d8d3c9', padding: 3, justifyContent: 'center', marginLeft: 8 },
  customSwitchTrackActive: { backgroundColor: '#182230' },
  customSwitchThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fffdf8' },
  customSwitchThumbActive: { alignSelf: 'flex-end', backgroundColor: '#f3b43f' },
  reminderOptions: { flexDirection: 'row', gap: 7, marginTop: 12, paddingLeft: 44 },
  reminderChip: { borderRadius: 11, borderWidth: 1, borderColor: '#d8ccb9', paddingHorizontal: 12, paddingVertical: 7 },
  reminderSelected: { borderColor: '#e58c34', backgroundColor: '#fff2d8' },
  reminderText: { color: '#7b7b78', fontSize: 11 },
  reminderSelectedText: { color: '#a36a21', fontSize: 11 },
  error: { color: '#c0392b', marginBottom: 9 },
  saveButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 15, backgroundColor: '#f3b43f' },
  saveText: { color: '#182230' },
});
