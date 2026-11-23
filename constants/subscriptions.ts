import { Platform } from 'react-native';

import type {
  ProviderDeepLinkConfig,
  SubscriptionProvider,
} from '@/types/subscription';

export const SUBSCRIPTION_PROVIDERS: SubscriptionProvider[] = [
  { name: 'Netflix', color: '#e50914', symbol: 'N', logo: '/rK1KljqmbvO9HQa1PBFLILWah72.png' },
  { name: 'Disney+', color: '#113ccf', symbol: 'D', logo: '/5eZ872CghnHFLB1j8grszbrx0dx.png' },
  { name: 'Max', color: '#5736c9', symbol: 'M', logo: '/skypuy7SXuugIQeYg0IglmzoKaS.png' },
  { name: 'Prime Video', color: '#1679a9', symbol: 'P', logo: '/gMZdpavHmxFNnLpMHwVxfqeux2g.png' },
  { name: 'Apple TV+', color: '#30343a', symbol: 'A', logo: '/9icYBfYFcwgCbky5VdGUIKJ4C5i.png' },
  { name: 'Globoplay', color: '#ed1c24', symbol: 'G', logo: '/9A6Oxd3F7iXm7mds7CxYOBicojs.png' },
  { name: 'Crunchyroll', color: '#f47521', symbol: 'C', logo: '/fzN5Jok5Ig1eJ7gyNGoMhnLSCfh.jpg' },
];

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
