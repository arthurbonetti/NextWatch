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
];

export const INITIAL_SUBSCRIPTIONS: Subscription[] = [
  { id: 'netflix', provider: 'Netflix', monthlyPrice: 39.9, billingDay: 18, active: true, renewalAlert: true, alertDays: 3 },
  { id: 'disney-plus', provider: 'Disney+', monthlyPrice: 27.9, billingDay: 24, active: true, renewalAlert: true, alertDays: 3 },
  { id: 'max', provider: 'Max', monthlyPrice: 21.9, billingDay: 28, active: true, renewalAlert: false, alertDays: 1 },
];
