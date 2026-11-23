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

export type ProviderDeepLinkConfig = {
  buildAppUrls: (encodedQuery: string) => string[];
  buildWebUrl: (encodedQuery: string) => string;
};
