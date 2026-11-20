/** Factory centralizada de query keys do TanStack Query. */
export const queryKeys = {
  subscriptions: (userId: string | null) => ['subscriptions', userId] as const,
  myList: (userId: string | null) => ['myList', userId] as const,
  drawHistory: (userId: string | null) => ['drawHistory', userId] as const,
  seriesProgress: (userId: string | null, titleId: string) => ['seriesProgress', userId, titleId] as const,
  seriesProgressGuest: (titleId: string) => ['seriesProgress', 'guest', titleId] as const,
  watchedProgressIds: (userId: string | null) => ['watchedProgressIds', userId] as const,
  watchedProgressIdsGuest: () => ['watchedProgressIds', 'guest'] as const,
  catalog: (providerKey: string) => ['catalog', providerKey] as const,
  catalogSearch: (normalizedQuery: string, providerKey: string) =>
    ['catalogSearch', normalizedQuery, providerKey] as const,
  titleById: (titleId: string) => ['titleById', titleId] as const,
  titleDetails: (titleId: string) => ['titleDetails', titleId] as const,
  seasonEpisodes: (titleId: string, seasonNumber: number) => ['seasonEpisodes', titleId, seasonNumber] as const,
  titleDuration: (titleId: string) => ['titleDuration', titleId] as const,
  titleTotalEpisodes: (titleId: string) => ['titleTotalEpisodes', titleId] as const,
};
