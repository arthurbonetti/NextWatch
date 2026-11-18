import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AnimatedModalShell } from '@/components/atoms/AnimatedModalShell';
import { AppText } from '@/components/atoms/AppText';
import { ServiceLogo } from '@/components/atoms/ServiceLogo';
import { SwitchToggle } from '@/components/atoms/SwitchToggle';
import { SUBSCRIPTION_PROVIDERS, Subscription, SubscriptionProvider } from '@/constants/subscriptions';
import { THEME } from '@/constants/theme';
import { triggerSelectionHaptic } from '@/utils/haptics';

type Props = {
  initialSubscription?: Subscription;
  onClose: () => void;
  onSave: (subscription: Subscription) => void;
};

const MAX_SUBSCRIPTION_PRICE = 9999.99;
const ALLOWED_PROVIDER_NAMES = new Set(SUBSCRIPTION_PROVIDERS.map((p) => p.name));

function generateSubscriptionId(providerName: string): string {
  const slug = providerName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sub';
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${slug}-${globalThis.crypto.randomUUID().slice(0, 8)}`;
  }
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = new Uint8Array(4);
    globalThis.crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${slug}-${hex}`;
  }
  return `${slug}-${Date.now().toString(36)}`;
}

export function SubscriptionEditorModal({ initialSubscription, onClose, onSave }: Props) {
  const [provider, setProvider] = useState(initialSubscription?.provider ?? SUBSCRIPTION_PROVIDERS[0].name);
  const [monthlyPrice, setMonthlyPrice] = useState(initialSubscription?.monthlyPrice.toFixed(2).replace('.', ',') ?? '');
  const [billingDay, setBillingDay] = useState(initialSubscription?.billingDay.toString() ?? '');
  const [renewalAlert, setRenewalAlert] = useState(initialSubscription?.renewalAlert ?? true);
  const [alertDays, setAlertDays] = useState<1 | 3 | 7>(initialSubscription?.alertDays ?? 3);
  const [focusedField, setFocusedField] = useState<'price' | 'day' | null>(null);
  const [error, setError] = useState('');
  const providersScrollRef = useRef<ScrollView>(null);
  const providersViewportWidthRef = useRef(0);
  const providerLayoutsRef = useRef<Record<string, { x: number; width: number }>>({});
  const hasInitialScrolledRef = useRef(false);

  const scrollToProvider = useCallback((providerName: string, animated: boolean) => {
    const layout = providerLayoutsRef.current[providerName];
    const scrollView = providersScrollRef.current;
    if (!layout || !scrollView) return;
    const viewportWidth = providersViewportWidthRef.current;
    const targetX = viewportWidth > 0
      ? Math.max(0, layout.x - (viewportWidth - layout.width) / 2)
      : Math.max(0, layout.x - 16);
    scrollView.scrollTo({ x: targetX, animated });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasInitialScrolledRef.current) {
        scrollToProvider(provider, false);
        hasInitialScrolledRef.current = true;
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [provider, scrollToProvider]);

  const save = () => {
    const parsedPrice = Number(monthlyPrice.replace(',', '.'));
    const parsedDay = Number(billingDay);
    if (!ALLOWED_PROVIDER_NAMES.has(provider)) {
      setError('Selecione um serviço de streaming válido.');
      return;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0 || parsedPrice > MAX_SUBSCRIPTION_PRICE) {
      setError('Informe um valor mensal válido (entre R$ 0,01 e R$ 9.999,99).');
      return;
    }
    if (!Number.isInteger(parsedDay) || parsedDay < 1 || parsedDay > 31) {
      setError('O dia de cobrança deve estar entre 1 e 31.');
      return;
    }

    onSave({
      id: initialSubscription?.id ?? generateSubscriptionId(provider),
      provider,
      monthlyPrice: Number(parsedPrice.toFixed(2)),
      billingDay: parsedDay,
      active: initialSubscription?.active ?? true,
      renewalAlert,
      alertDays,
    });
  };

  return (
    <AnimatedModalShell
      visible
      onClose={onClose}
      variant="sheet"
      keyboardAvoiding
      maxHeight="94%"
      backdropAccessibilityLabel="Fechar formulário">
      <ScrollView
        style={styles.formScroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}>
        <View style={styles.header}>
          <View>
            <AppText tipo="legenda" peso="forte" style={styles.eyebrow}>
              {initialSubscription ? 'EDITAR PLANO' : 'NOVA ASSINATURA'}
            </AppText>
            <AppText tipo="subtitulo" familia="editorial" peso="forte" style={styles.title}>
              {initialSubscription ? 'Atualize os dados' : 'Adicionar serviço'}
            </AppText>
          </View>
          <Pressable
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Fechar">
            <MaterialIcons name="close" size={21} color={THEME.colors.textPrimary} />
          </Pressable>
        </View>

        <AppText tipo="legenda" peso="forte" style={styles.label}>SERVIÇO DE STREAMING</AppText>
        <ScrollView
          ref={providersScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.providers}
          onLayout={(event) => {
            providersViewportWidthRef.current = event.nativeEvent.layout.width;
            if (!hasInitialScrolledRef.current && providerLayoutsRef.current[provider]) {
              hasInitialScrolledRef.current = true;
              scrollToProvider(provider, false);
            }
          }}>
          {SUBSCRIPTION_PROVIDERS.map((item: SubscriptionProvider) => {
            const selected = provider === item.name;
            return (
              <Pressable
                key={item.name}
                onLayout={(event) => {
                  const { x, width } = event.nativeEvent.layout;
                  providerLayoutsRef.current[item.name] = { x, width };
                  if (selected && !hasInitialScrolledRef.current && providersViewportWidthRef.current > 0) {
                    hasInitialScrolledRef.current = true;
                    scrollToProvider(item.name, false);
                  }
                }}
                onPress={() => {
                  triggerSelectionHaptic();
                  setProvider(item.name);
                  scrollToProvider(item.name, true);
                }}
                style={({ pressed }) => [
                  styles.providerChip,
                  selected && styles.providerChipSelected,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}>
                <ServiceLogo name={item.name} size={24} />
                <AppText tipo="legenda" peso="forte" style={[styles.providerName, selected && styles.providerNameSelected]}>
                  {item.name}
                </AppText>
                {selected && <MaterialIcons name="check-circle" size={15} color={THEME.colors.gold} />}
              </Pressable>
            );
          })}
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
                placeholderTextColor={THEME.colors.textSubtle}
                style={styles.input}
                selectionColor={THEME.colors.accentDeep}
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
                placeholderTextColor={THEME.colors.textSubtle}
                style={styles.input}
                selectionColor={THEME.colors.accentDeep}
                maxLength={2}
              />
              <AppText tipo="legenda" style={styles.daySuffix}>de cada mês</AppText>
            </View>
          </View>
        </View>

        <View style={styles.alertCard}>
          <View style={styles.alertHeader}>
            <View style={styles.alertIcon}>
              <MaterialIcons name="notifications-active" size={19} color={THEME.colors.accentDeep} />
            </View>
            <View style={styles.alertCopy}>
              <AppText tipo="legenda" peso="forte" style={styles.alertTitle}>Avisar antes de renovar</AppText>
              <AppText tipo="legenda" style={styles.helper}>Receba um lembrete antes da cobrança</AppText>
            </View>
            <SwitchToggle
              value={renewalAlert}
              onToggle={() => setRenewalAlert((prev) => !prev)}
              accessibilityLabel="Alternar lembrete de renovação"
              style={styles.switchToggle}
            />
          </View>
          {renewalAlert && (
            <View style={styles.reminderOptions}>
              {([1, 3, 7] as const).map((days) => (
                <Pressable
                  key={days}
                  onPress={() => {
                    triggerSelectionHaptic();
                    setAlertDays(days);
                  }}
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
          <AppText peso="forte" style={styles.saveText}>
            {initialSubscription ? 'Salvar alterações' : 'Adicionar assinatura'}
          </AppText>
          <MaterialIcons name="check" size={19} color={THEME.colors.navy} />
        </Pressable>
      </ScrollView>
    </AnimatedModalShell>
  );
}

const styles = StyleSheet.create({
  formScroll: { flexShrink: 1 },
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: THEME.spacing.s20 },
  eyebrow: { color: THEME.colors.accent, letterSpacing: 1.4, marginBottom: 5 },
  title: { color: THEME.colors.textPrimary, fontSize: THEME.fontSizes.title, lineHeight: THEME.lineHeights.title, letterSpacing: -0.35 },
  close: { width: THEME.touchTarget.min, height: THEME.touchTarget.min, borderRadius: THEME.radius.full, backgroundColor: THEME.colors.bgSubtle, alignItems: 'center', justifyContent: 'center' },
  label: { color: THEME.colors.textSubtle, letterSpacing: 0.8, marginBottom: THEME.spacing.base },
  providers: { gap: THEME.spacing.md, paddingBottom: THEME.spacing.s22 },
  providerChip: { minHeight: THEME.touchTarget.min, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: THEME.colors.borderMedium, borderRadius: THEME.radius.lg, backgroundColor: THEME.colors.bgCard, paddingHorizontal: 11, paddingVertical: 9 },
  providerChipSelected: { borderColor: THEME.colors.navy, backgroundColor: THEME.colors.navy },
  providerName: { color: THEME.colors.textPrimary, fontSize: 12.5 },
  providerNameSelected: { color: THEME.colors.textOnNavy },
  fieldsRow: { flexDirection: 'row', gap: THEME.spacing.lg, marginBottom: THEME.spacing.s18 },
  priceField: { flex: 1.15 },
  dayField: { flex: 0.85 },
  inputWrap: { minHeight: THEME.touchTarget.button, flexDirection: 'row', alignItems: 'center', borderRadius: THEME.radius.lg, borderWidth: 1, borderColor: THEME.colors.borderMedium, backgroundColor: THEME.colors.bgCanvas, paddingHorizontal: THEME.spacing.lg },
  inputWrapFocused: { borderColor: THEME.colors.navy, backgroundColor: THEME.colors.bgCard },
  currency: { color: THEME.colors.accentDeep, marginRight: 7 },
  input: { flex: 1, color: THEME.colors.textPrimary, fontFamily: THEME.fonts.sans.semibold, fontSize: 16, lineHeight: 22, fontVariant: ['tabular-nums'], paddingVertical: 9 },
  daySuffix: { color: THEME.colors.textSubtle, fontSize: THEME.fontSizes.caption },
  alertCard: { borderRadius: THEME.radius.xl, borderWidth: 1, borderColor: THEME.colors.borderWarm, backgroundColor: THEME.colors.bgWarm, padding: 13, marginBottom: 17 },
  alertHeader: { flexDirection: 'row', alignItems: 'center' },
  alertIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: THEME.colors.bgHighlight, alignItems: 'center', justifyContent: 'center', marginRight: THEME.spacing.lg },
  alertCopy: { flex: 1 },
  alertTitle: { color: THEME.colors.textPrimary, fontSize: THEME.fontSizes.bodySm },
  helper: { color: THEME.colors.textSubtle, fontSize: THEME.fontSizes.caption, lineHeight: 16, marginTop: 2 },
  switchToggle: { marginLeft: THEME.spacing.md },
  reminderOptions: { flexDirection: 'row', gap: 7, marginTop: THEME.spacing.lg, paddingLeft: 46 },
  reminderChip: { minHeight: THEME.touchTarget.min - 4, borderRadius: 11, borderWidth: 1, borderColor: THEME.colors.borderWarm, paddingHorizontal: THEME.spacing.lg, paddingVertical: 7, justifyContent: 'center' },
  reminderSelected: { borderColor: THEME.colors.accent, backgroundColor: THEME.colors.bgHighlight },
  reminderText: { color: THEME.colors.textSubtle, fontSize: THEME.fontSizes.caption },
  reminderSelectedText: { color: THEME.colors.accentText, fontSize: THEME.fontSizes.caption },
  error: { color: THEME.colors.mcRed, marginBottom: 9 },
  saveButton: { minHeight: THEME.touchTarget.cta, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: THEME.spacing.md, borderRadius: THEME.radius.lg, backgroundColor: THEME.colors.gold },
  saveText: { color: THEME.colors.navy },
});
