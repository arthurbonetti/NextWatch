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
};

export const SUBSCRIPTION_PROVIDERS: SubscriptionProvider[] = [
  { name: 'Netflix', color: '#e50914', symbol: 'N' },
  { name: 'Disney+', color: '#113ccf', symbol: 'D' },
  { name: 'Max', color: '#5736c9', symbol: 'M' },
  { name: 'Prime Video', color: '#1679a9', symbol: 'P' },
  { name: 'Apple TV+', color: '#30343a', symbol: 'A' },
  { name: 'Globoplay', color: '#ed1c24', symbol: 'G' },
];

export const INITIAL_SUBSCRIPTIONS: Subscription[] = [
  { id: 'netflix', provider: 'Netflix', monthlyPrice: 39.9, billingDay: 18, active: true, renewalAlert: true, alertDays: 3 },
  { id: 'disney-plus', provider: 'Disney+', monthlyPrice: 27.9, billingDay: 24, active: true, renewalAlert: true, alertDays: 3 },
  { id: 'max', provider: 'Max', monthlyPrice: 21.9, billingDay: 28, active: true, renewalAlert: false, alertDays: 1 },
];
