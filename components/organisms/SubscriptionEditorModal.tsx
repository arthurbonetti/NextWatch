import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { AnimatedModalShell } from '@/components/atoms/AnimatedModalShell';
import { AppText } from '@/components/atoms/AppText';
import { ServiceLogo } from '@/components/atoms/ServiceLogo';
import { SwitchToggle } from '@/components/atoms/SwitchToggle';
import { SUBSCRIPTION_PROVIDERS } from '@/constants/subscriptions';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';
import type { Subscription, SubscriptionProvider } from '@/types/subscription';
import { triggerSelectionHaptic } from '@/utils/haptics';

type SubscriptionEditorModalProps = {
  visible?: boolean;
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

export function SubscriptionEditorModal({
  visible = true,
  initialSubscription,
  onClose,
  onSave,
}: SubscriptionEditorModalProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

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
  const prevVisibleRef = useRef(false);
  const prevInitialIdRef = useRef<string | undefined>(initialSubscription?.id);

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
    const justOpened = visible && !prevVisibleRef.current;
    const switchedTarget = visible && prevInitialIdRef.current !== initialSubscription?.id;
    prevVisibleRef.current = visible;
    prevInitialIdRef.current = initialSubscription?.id;

    if (!visible) return;

    if (justOpened || switchedTarget) {
      setProvider(initialSubscription?.provider ?? SUBSCRIPTION_PROVIDERS[0].name);
      setMonthlyPrice(initialSubscription?.monthlyPrice.toFixed(2).replace('.', ',') ?? '');
      setBillingDay(initialSubscription?.billingDay.toString() ?? '');
      setRenewalAlert(initialSubscription?.renewalAlert ?? true);
      setAlertDays(initialSubscription?.alertDays ?? 3);
      setFocusedField(null);
      setError('');
      hasInitialScrolledRef.current = false;
    }

    const timer = setTimeout(() => {
      if (!hasInitialScrolledRef.current) {
        scrollToProvider(initialSubscription?.provider ?? SUBSCRIPTION_PROVIDERS[0].name, false);
        hasInitialScrolledRef.current = true;
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [initialSubscription, scrollToProvider, visible]);

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
      visible={visible}
      onClose={onClose}
      variant="sheet"
      expandableSheet
      keyboardAvoiding
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
                {selected && <MaterialIcons name="check-circle" size={15} color={colors.chipSelectedIcon} />}
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
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                selectionColor={colors.accentLink}
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
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                selectionColor={colors.accentLink}
                maxLength={2}
              />
              <AppText tipo="legenda" style={styles.daySuffix}>de cada mês</AppText>
            </View>
          </View>
        </View>

        <View style={styles.alertCard}>
          <View style={styles.alertHeader}>
            <View style={styles.alertIcon}>
              <MaterialIcons name="notifications-active" size={19} color={colors.accentLink} />
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
          <MaterialIcons name="check" size={19} color={colors.textOnAccent} />
        </Pressable>
      </ScrollView>
    </AnimatedModalShell>
  );
}

const createStyles = (theme: Theme) => ({
  formScroll: { flexShrink: 1 },
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  header: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, marginBottom: theme.spacing.s20 },
  eyebrow: { color: theme.colors.accentLink, letterSpacing: 1.4, marginBottom: 5 },
  title: { color: theme.colors.textPrimary, fontSize: theme.fontSizes.title, lineHeight: theme.lineHeights.title, letterSpacing: -0.35 },
  label: { color: theme.colors.textSecondary, letterSpacing: 0.8, marginBottom: theme.spacing.base },
  providers: { gap: theme.spacing.md, paddingBottom: theme.spacing.s22 },
  providerChip: { minHeight: theme.touchTarget.min, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 7, borderWidth: 1, borderColor: theme.colors.borderSubtle, borderRadius: theme.radius.lg, backgroundColor: theme.colors.bgSurface, paddingHorizontal: 11, paddingVertical: 9 },
  providerChipSelected: { borderColor: theme.colors.chipSelectedBorder, backgroundColor: theme.colors.chipSelectedBg },
  providerName: { color: theme.colors.textPrimary, fontSize: 12.5 },
  providerNameSelected: { color: theme.colors.chipSelectedText },
  fieldsRow: { flexDirection: 'row' as const, gap: theme.spacing.lg, marginBottom: theme.spacing.s18 },
  priceField: { flex: 1.15 },
  dayField: { flex: 0.85 },
  inputWrap: { minHeight: theme.touchTarget.button, flexDirection: 'row' as const, alignItems: 'center' as const, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.borderSubtle, backgroundColor: theme.colors.bgSurfaceAlt, paddingHorizontal: theme.spacing.lg },
  inputWrapFocused: { borderColor: theme.colors.borderFocused, backgroundColor: theme.colors.bgSurface },
  currency: { color: theme.colors.accentLink, marginRight: 7 },
  input: { flex: 1, color: theme.colors.textPrimary, fontFamily: theme.fonts.sans.semibold, fontSize: 16, lineHeight: 22, fontVariant: ['tabular-nums' as const], paddingVertical: 9 },
  daySuffix: { color: theme.colors.textMuted, fontSize: theme.fontSizes.caption },
  alertCard: { borderRadius: theme.radius.xl, borderWidth: 1, borderColor: theme.colors.borderSubtle, backgroundColor: theme.colors.bgSurfaceAlt, padding: 13, marginBottom: 17 },
  alertHeader: { flexDirection: 'row' as const, alignItems: 'center' as const },
  alertIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: theme.colors.savedActiveBg, alignItems: 'center' as const, justifyContent: 'center' as const, marginRight: theme.spacing.lg },
  alertCopy: { flex: 1 },
  alertTitle: { color: theme.colors.textPrimary, fontSize: theme.fontSizes.bodySm },
  helper: { color: theme.colors.textSecondary, fontSize: theme.fontSizes.caption, lineHeight: 16, marginTop: 2 },
  switchToggle: { marginLeft: theme.spacing.md },
  reminderOptions: { flexDirection: 'row' as const, gap: 7, marginTop: theme.spacing.lg, paddingLeft: 46 },
  reminderChip: { minHeight: theme.touchTarget.min - 4, borderRadius: 11, borderWidth: 1, borderColor: theme.colors.borderSubtle, backgroundColor: theme.colors.bgSurface, paddingHorizontal: theme.spacing.lg, paddingVertical: 7, justifyContent: 'center' as const },
  reminderSelected: { borderColor: theme.colors.savedActiveBorder, backgroundColor: theme.colors.savedActiveBg },
  reminderText: { color: theme.colors.textSecondary, fontSize: theme.fontSizes.caption },
  reminderSelectedText: { color: theme.colors.savedActiveText, fontSize: theme.fontSizes.caption },
  error: { color: theme.colors.dangerText, marginBottom: 9 },
  saveButton: { minHeight: theme.touchTarget.cta, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: theme.spacing.md, borderRadius: theme.radius.lg, backgroundColor: theme.colors.accentPrimary },
  saveText: { color: theme.colors.textOnAccent },
});
