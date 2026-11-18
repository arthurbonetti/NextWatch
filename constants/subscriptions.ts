import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

export type Subscription = {
  id: string;
  provider: string;
  monthlyPrice: number;
  billingDay: number;
  active: boolean;
  renewalAlert: boolean;
  alertDays: 1 | 3 | 7;
};

export type SubscriptionProvider = {
  name: string;
  color: string;
  symbol: string;
  // Caminho da logo no TMDB (lista de provedores de streaming do Brasil, /watch/providers).
  logo?: string;
};

export const SUBSCRIPTION_PROVIDERS: SubscriptionProvider[] = [
  { name: 'Netflix', color: '#e50914', symbol: 'N', logo: '/rK1KljqmbvO9HQa1PBFLILWah72.png' },
  { name: 'Disney+', color: '#113ccf', symbol: 'D', logo: '/5eZ872CghnHFLB1j8grszbrx0dx.png' },
  { name: 'Max', color: '#5736c9', symbol: 'M', logo: '/skypuy7SXuugIQeYg0IglmzoKaS.png' },
  { name: 'Prime Video', color: '#1679a9', symbol: 'P', logo: '/gMZdpavHmxFNnLpMHwVxfqeux2g.png' },
  { name: 'Apple TV+', color: '#30343a', symbol: 'A', logo: '/9icYBfYFcwgCbky5VdGUIKJ4C5i.png' },
  { name: 'Globoplay', color: '#ed1c24', symbol: 'G', logo: '/9A6Oxd3F7iXm7mds7CxYOBicojs.png' },
  { name: 'Crunchyroll', color: '#f47521', symbol: 'C', logo: '/fzN5Jok5Ig1eJ7gyNGoMhnLSCfh.jpg' },
];

export type ProviderDeepLinkConfig = {
  buildAppUrls: (encodedQuery: string) => string[];
  buildWebUrl: (encodedQuery: string) => string;
};

export const PROVIDER_DEEP_LINKS: Record<string, ProviderDeepLinkConfig> = {
  Netflix: {
    buildAppUrls: (q) => (q ? [`nflx://www.netflix.com/search?q=${q}`, 'nflx://www.netflix.com'] : ['nflx://www.netflix.com']),
    buildWebUrl: (q) => (q ? `https://www.netflix.com/search?q=${q}` : 'https://www.netflix.com'),
  },
  'Disney+': {
    buildAppUrls: () => ['disneyplus://'],
    buildWebUrl: () => 'https://www.disneyplus.com',
  },
  Max: {
    buildAppUrls: () => ['max://', 'hbomax://'],
    buildWebUrl: () => 'https://play.max.com',
  },
  'Prime Video': {
    buildAppUrls: () =>
      Platform.OS === 'ios' ? ['aiv://', 'primevideo://'] : ['primevideo://', 'aiv://', 'amzn://'],
    buildWebUrl: (q) =>
      q ? `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${q}` : 'https://www.primevideo.com',
  },
  'Apple TV+': {
    buildAppUrls: () => (Platform.OS === 'ios' ? ['videos://'] : []),
    buildWebUrl: (q) => (q ? `https://tv.apple.com/search?term=${q}` : 'https://tv.apple.com'),
  },
  Globoplay: {
    buildAppUrls: () => ['globoplay://', 'globoplay-gcom://'],
    buildWebUrl: (q) => (q ? `https://globoplay.globo.com/busca/?q=${q}` : 'https://globoplay.globo.com'),
  },
  Crunchyroll: {
    buildAppUrls: () => ['crunchyroll://'],
    buildWebUrl: (q) => (q ? `https://www.crunchyroll.com/search?q=${q}` : 'https://www.crunchyroll.com'),
  },
};

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
