import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Dispara haptic de seleção em plataformas nativas, ignorando web com segurança. */
export function triggerSelectionHaptic(): void {
  if (Platform.OS === 'web') return;
  void Haptics.selectionAsync().catch(() => {});
}

/** Dispara haptic leve de impacto (usado a cada pôster que passa na roleta). */
export function triggerLightImpactHaptic(): void {
  if (Platform.OS === 'web') return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Dispara haptic de sucesso (usado na parada da roleta / confirmação). */
export function triggerSuccessHaptic(): void {
  if (Platform.OS === 'web') return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
