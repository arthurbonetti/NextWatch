import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { PROVIDER_DEEP_LINKS } from '@/constants/subscriptions';

/**
 * Abre o aplicativo do streaming via deep link direto (sem bloqueio de canOpenURL no Android 11+),
 * com fallback automático para a página web / App Link.
 */
export async function openStreamingService(providerName: string, titleQuery?: string): Promise<void> {
  const target = PROVIDER_DEEP_LINKS[providerName];
  const trimmedQuery = titleQuery?.trim() ?? '';
  const encodedQuery = trimmedQuery ? encodeURIComponent(trimmedQuery) : '';
  const fallbackSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(
    trimmedQuery ? `${trimmedQuery} ${providerName}` : providerName,
  )}`;

  if (!target) {
    await Linking.openURL(fallbackSearchUrl).catch(() => {});
    return;
  }

  if (Platform.OS !== 'web') {
    const appUrls = target.buildAppUrls(encodedQuery);
    for (const appUrl of appUrls) {
      try {
        await Linking.openURL(appUrl);
        return;
      } catch {
        // Continua para o próximo esquema ou fallback web caso o app não esteja instalado
      }
    }
  }

  await Linking.openURL(target.buildWebUrl(encodedQuery)).catch(() => {});
}
