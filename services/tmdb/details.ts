import { sanitizeTmdbPath } from '@/constants/catalog';
import { CATALOG } from '@/constants/fallbackCatalog';
import type {
  CastMember,
  EpisodeSummary,
  MediaTitle,
  RichTitleDetails,
  SeasonSummary,
} from '@/types/media';
import { shuffleArray } from '@/utils/shuffle';
import { nowMs } from '@/utils/time';

import {
  createAbortError,
  getDevCatalogMetrics,
  hasCatalogBackend,
  isAbortError,
  isUpstreamUnavailable,
  raceWithAbort,
  recordCatalogFetchStart,
  request,
  setUpstreamUnavailable,
} from './client';
import {
  FIRST_BATCH_EMIT_THRESHOLD,
  MAX_PAGES_PER_ENDPOINT,
  PROGRESSIVE_BATCH_EMIT_INTERVAL,
  REQUEST_CONCURRENCY,
  TMDB_STATUS_LABELS,
} from './constants';
import {
  extractBrCertification,
  extractRegularTmdbSeasons,
  formatMovieRuntime,
  mapMedia,
  pickYoutubeTrailerKey,
  resolvedDurationCache,
  resolveTmdbEndpointAndId,
  resolveTvDuration,
} from './mappers';
import {
  extractProvidersFromDetails,
  findProviderIds,
  getWatchProviders,
} from './providers';
import { mergeTitleIntoCatalog } from './search';
import {
  CatalogBackendNotConfiguredError,
  type CatalogFetchResult,
  type MediaEndpoint,
  type TmdbCatalogBatchCallback,
  type TmdbMediaDetails,
  type TmdbMediaResponse,
  type TmdbSeasonDetailsResponse,
  type TmdbVideosResponse,
} from './types';

const isDevRuntime = typeof __DEV__ !== 'undefined' && __DEV__;

const pendingDurationCache = new Map<string, Promise<string>>();
const resolvedTotalEpisodesCache = new Map<string, number>();
const resolvedTrailerCache = new Map<string, string | null>();
const pendingTrailerCache = new Map<string, Promise<string | null>>();
const richDetailsCache = new Map<string, RichTitleDetails>();
const pendingRichDetailsCache = new Map<string, Promise<RichTitleDetails | null>>();
const seasonEpisodesCache = new Map<string, EpisodeSummary[]>();
const pendingSeasonEpisodesCache = new Map<string, Promise<EpisodeSummary[]>>();
const relatedTitlesById = new Map<string, MediaTitle>();
const pendingTitleByIdCache = new Map<string, Promise<MediaTitle | null>>();

function buildStaticFallbackCatalog(): MediaTitle[] {
  return shuffleArray(CATALOG);
}

function cacheTvTotalEpisodes(
  titleId: string,
  details: Pick<TmdbMediaDetails, 'seasons' | 'number_of_episodes'>,
  regularSeasons = extractRegularTmdbSeasons(details),
): number | null {
  const fromSeasons = regularSeasons.reduce((acc, s) => acc + Math.max(0, s.episode_count ?? 0), 0);
  const total = fromSeasons > 0 ? fromSeasons : (details.number_of_episodes ?? 0);
  if (total > 0) {
    resolvedTotalEpisodesCache.set(titleId, total);
    return total;
  }
  return null;
}

export function getCachedTitleTotalEpisodes(titleId: string): number | null {
  return resolvedTotalEpisodesCache.get(titleId) ?? null;
}

export function getCachedTitleDuration(title: MediaTitle): string {
  return resolvedDurationCache.get(title.id) ?? title.duration;
}

export async function fetchAllCatalogForProviders(
  providerNames: string[],
  onBatch?: TmdbCatalogBatchCallback,
  signal?: AbortSignal,
): Promise<CatalogFetchResult> {
  if (signal?.aborted) {
    throw createAbortError();
  }
  if (!hasCatalogBackend()) {
    const fallback = buildStaticFallbackCatalog();
    if (!signal?.aborted) {
      onBatch?.(fallback);
    }
    return { titles: fallback, source: 'static-fallback', reason: 'not-configured' };
  }
  setUpstreamUnavailable(false);
  if (providerNames.length === 0) {
    if (!signal?.aborted) {
      onBatch?.([]);
    }
    return { titles: [], source: 'tmdb' };
  }

  const startedAt = nowMs();
  const runId = recordCatalogFetchStart(startedAt);
  if (isDevRuntime) {
    console.info(
      `[CatalogPerf] fetchAllCatalogForProviders #${runId} start (providers=${providerNames.join('|')})`,
    );
  }

  try {
    const allProviders = await getWatchProviders(signal);
    const resolvedProviders = providerNames
      .map((providerName) => ({
        providerName,
        ids: findProviderIds([providerName], allProviders),
      }))
      .filter((entry) => entry.ids.length > 0);

    if (resolvedProviders.length === 0) {
      throw new Error(`Não encontrei no TMDB os serviços ativos: ${providerNames.join(', ')}.`);
    }

    const catalogById = new Map<string, MediaTitle>();
    const idByNameKey = new Map<string, string>();

    const firstPageDescriptors = resolvedProviders.flatMap(({ providerName, ids }) => {
      const baseParams: Record<string, string> = {
        language: 'pt-BR',
        watch_region: 'BR',
        with_watch_providers: ids.join('|'),
        with_watch_monetization_types: 'flatrate|free|ads',
        sort_by: 'popularity.desc',
      };
      const movieParams: Record<string, string> = {
        ...baseParams,
        region: 'BR',
        include_adult: 'false',
      };

      return [
        { endpoint: 'movie' as const, providerName, params: movieParams },
        { endpoint: 'tv' as const, providerName, params: baseParams },
      ];
    });

    type PageStreamDescriptor = {
      endpoint: MediaEndpoint;
      providerName: string;
      params: Record<string, string>;
      maxPages: number;
    };

    const pageStreams: PageStreamDescriptor[] = [];
    const pendingFirstBatchItems: MediaTitle[] = [];
    let firstPagesSettled = 0;
    let firstPagesSucceeded = 0;
    let firstPageError: unknown = null;
    let firstBatchEmitted = false;
    let hasUnemittedFirstPageItems = false;
    let firstPageIndex = 0;
    const initialEmitTarget = Math.min(FIRST_BATCH_EMIT_THRESHOLD, firstPageDescriptors.length);

    const firstPageWorkers = Array.from(
      { length: Math.min(REQUEST_CONCURRENCY, firstPageDescriptors.length) },
      async () => {
        while (firstPageIndex < firstPageDescriptors.length) {
          if (signal?.aborted) return;
          const descriptor = firstPageDescriptors[firstPageIndex++];
          if (!descriptor) break;

          try {
            const response = await request<TmdbMediaResponse>(
              `/discover/${descriptor.endpoint}`,
              { ...descriptor.params, page: '1' },
              { signal },
            );
            if (signal?.aborted) return;

            firstPagesSucceeded += 1;
            const mapped = response.results.map((item) =>
              mapMedia(item, descriptor.endpoint, [descriptor.providerName]),
            );
            const maxPages = Math.min(response.total_pages, MAX_PAGES_PER_ENDPOINT);
            if (maxPages >= 2) {
              pageStreams.push({
                endpoint: descriptor.endpoint,
                providerName: descriptor.providerName,
                params: descriptor.params,
                maxPages,
              });
            }

            if (!firstBatchEmitted) {
              pendingFirstBatchItems.push(...mapped);
            } else {
              for (const title of shuffleArray(mapped)) {
                mergeTitleIntoCatalog(catalogById, idByNameKey, title);
              }
              hasUnemittedFirstPageItems = true;
            }
          } catch (error) {
            if (signal?.aborted || isAbortError(error)) {
              throw createAbortError();
            }
            if (firstPageError === null) {
              firstPageError = error;
            }
          } finally {
            firstPagesSettled += 1;
            if (
              !signal?.aborted &&
              !firstBatchEmitted &&
              firstPagesSettled >= initialEmitTarget &&
              pendingFirstBatchItems.length > 0
            ) {
              firstBatchEmitted = true;
              const itemsToMerge = pendingFirstBatchItems.splice(0, pendingFirstBatchItems.length);
              for (const title of shuffleArray(itemsToMerge)) {
                mergeTitleIntoCatalog(catalogById, idByNameKey, title);
              }
              const snapshot = Array.from(catalogById.values());
              onBatch?.(snapshot);
              if (isDevRuntime) {
                console.info(
                  `[CatalogPerf] fetchAllCatalogForProviders #${runId} firstBatch emitted in ${Math.round(nowMs() - startedAt)}ms (titles=${snapshot.length})`,
                );
              }
            }
          }
        }
      },
    );

    await Promise.all(firstPageWorkers);

    if (signal?.aborted) {
      throw createAbortError();
    }

    if (firstPagesSucceeded === 0 && firstPageError !== null) {
      throw firstPageError;
    }

    if (pendingFirstBatchItems.length > 0) {
      for (const title of shuffleArray(pendingFirstBatchItems)) {
        mergeTitleIntoCatalog(catalogById, idByNameKey, title);
      }
      pendingFirstBatchItems.length = 0;
      hasUnemittedFirstPageItems = true;
    }

    if (!firstBatchEmitted || hasUnemittedFirstPageItems) {
      const snapshot = Array.from(catalogById.values());
      onBatch?.(snapshot);
      if (!firstBatchEmitted && isDevRuntime) {
        console.info(
          `[CatalogPerf] fetchAllCatalogForProviders #${runId} firstBatch emitted in ${Math.round(nowMs() - startedAt)}ms (titles=${snapshot.length})`,
        );
      }
      firstBatchEmitted = true;
    }

    const highestMaxPage = pageStreams.reduce(
      (max, stream) => Math.max(max, stream.maxPages),
      1,
    );
    const remainingTasks: (() => Promise<MediaTitle[]>)[] = [];
    for (let page = 2; page <= highestMaxPage; page++) {
      for (const stream of pageStreams) {
        if (page > stream.maxPages) continue;
        remainingTasks.push(async () => {
          if (signal?.aborted) {
            throw createAbortError();
          }
          try {
            const pageRes = await request<TmdbMediaResponse>(
              `/discover/${stream.endpoint}`,
              {
                ...stream.params,
                page: String(page),
              },
              { retries: 2, signal },
            );
            return pageRes.results.map((item) =>
              mapMedia(item, stream.endpoint, [stream.providerName]),
            );
          } catch (error) {
            if (signal?.aborted || isAbortError(error)) {
              throw createAbortError();
            }
            return [];
          }
        });
      }
    }

    if (remainingTasks.length > 0) {
      let taskIndex = 0;
      let completedSinceEmit = 0;

      const workers = Array.from(
        { length: Math.min(REQUEST_CONCURRENCY, remainingTasks.length) },
        async () => {
          while (taskIndex < remainingTasks.length) {
            if (signal?.aborted) return;
            const currentTask = remainingTasks[taskIndex++];
            if (!currentTask) break;
            const pageTitles = await currentTask();
            if (signal?.aborted) return;
            for (const title of shuffleArray(pageTitles)) {
              mergeTitleIntoCatalog(catalogById, idByNameKey, title);
            }
            completedSinceEmit += 1;
            if (completedSinceEmit >= PROGRESSIVE_BATCH_EMIT_INTERVAL) {
              completedSinceEmit = 0;
              onBatch?.(Array.from(catalogById.values()));
            }
          }
        },
      );

      await Promise.all(workers);
    }

    if (signal?.aborted) {
      throw createAbortError();
    }

    const finalTitles = Array.from(catalogById.values());
    onBatch?.(finalTitles);
    if (isDevRuntime) {
      const { fetchCount } = getDevCatalogMetrics();
      console.info(
        `[CatalogPerf] fetchAllCatalogForProviders #${runId} finished in ${Math.round(nowMs() - startedAt)}ms (titles=${finalTitles.length}, bootFetchCount=${fetchCount})`,
      );
    }
    return { titles: finalTitles, source: 'tmdb' };
  } catch (error) {
    if (signal?.aborted || isAbortError(error)) {
      if (isDevRuntime) {
        console.info(
          `[CatalogPerf] fetchAllCatalogForProviders #${runId} aborted after ${Math.round(nowMs() - startedAt)}ms`,
        );
      }
      throw createAbortError();
    }
    const fallback = buildStaticFallbackCatalog();
    onBatch?.(fallback);
    if (error instanceof CatalogBackendNotConfiguredError) {
      return { titles: fallback, source: 'static-fallback', reason: 'not-configured' };
    }
    return {
      titles: fallback,
      source: 'static-fallback',
      reason: 'error',
      errorMessage:
        error instanceof Error ? error.message : 'Não foi possível atualizar o catálogo.',
    };
  }
}

export async function fetchTitleDuration(
  title: MediaTitle,
  signal?: AbortSignal,
): Promise<string> {
  if (signal?.aborted) {
    throw createAbortError();
  }
  const cached = resolvedDurationCache.get(title.id);
  if (cached) {
    return cached;
  }

  const target = resolveTmdbEndpointAndId(title.id);
  if (!target || !hasCatalogBackend() || isUpstreamUnavailable()) {
    return title.duration;
  }

  const existingPromise = pendingDurationCache.get(title.id);
  if (existingPromise) {
    return raceWithAbort(existingPromise, signal);
  }

  const promise = request<TmdbMediaDetails>(`/${target.endpoint}/${target.tmdbId}`, {
    language: 'pt-BR',
  })
    .then((details) => {
      let formatted = title.duration;
      if (target.endpoint === 'movie') {
        if (details.runtime && details.runtime > 0) {
          formatted = formatMovieRuntime(details.runtime);
        }
      } else {
        const regularSeasons = extractRegularTmdbSeasons(details);
        cacheTvTotalEpisodes(title.id, details, regularSeasons);
        formatted = resolveTvDuration(title, details, regularSeasons);
      }
      if (formatted) {
        resolvedDurationCache.set(title.id, formatted);
      }
      return formatted;
    })
    .catch(() => title.duration)
    .finally(() => {
      pendingDurationCache.delete(title.id);
    });

  pendingDurationCache.set(title.id, promise);
  return raceWithAbort(promise, signal);
}

export function getCachedTitleTrailerUrl(title: MediaTitle): string | null {
  return resolvedTrailerCache.get(title.id) ?? null;
}

export async function fetchTitleTrailerUrl(
  title: MediaTitle,
  signal?: AbortSignal,
): Promise<string | null> {
  if (signal?.aborted) {
    throw createAbortError();
  }
  if (resolvedTrailerCache.has(title.id)) {
    return resolvedTrailerCache.get(title.id) ?? null;
  }

  const target = resolveTmdbEndpointAndId(title.id);
  if (!target || !hasCatalogBackend() || isUpstreamUnavailable()) {
    return null;
  }

  const existingPromise = pendingTrailerCache.get(title.id);
  if (existingPromise) {
    return raceWithAbort(existingPromise, signal);
  }

  const promise = (async () => {
    const ptRes = await request<TmdbVideosResponse>(`/${target.endpoint}/${target.tmdbId}/videos`, {
      language: 'pt-BR',
    }).catch(() => null);
    let videoKey = pickYoutubeTrailerKey(ptRes?.results);

    if (!videoKey) {
      const enRes = await request<TmdbVideosResponse>(
        `/${target.endpoint}/${target.tmdbId}/videos`,
        {
          language: 'en-US',
        },
      ).catch(() => null);
      videoKey = pickYoutubeTrailerKey(enRes?.results);
    }

    const url = videoKey ? `https://www.youtube.com/watch?v=${videoKey}` : null;
    resolvedTrailerCache.set(title.id, url);
    return url;
  })()
    .catch(() => null)
    .finally(() => {
      pendingTrailerCache.delete(title.id);
    });

  pendingTrailerCache.set(title.id, promise);
  return raceWithAbort(promise, signal);
}

export function findCachedRelatedTitle(id: string): MediaTitle | undefined {
  return relatedTitlesById.get(id);
}

export async function fetchTitleById(
  titleId: string,
  signal?: AbortSignal,
): Promise<MediaTitle | null> {
  if (signal?.aborted) {
    throw createAbortError();
  }
  const cached = relatedTitlesById.get(titleId);
  if (cached) return cached;

  const staticMatch = CATALOG.find((item) => item.id === titleId) ?? null;
  const target = resolveTmdbEndpointAndId(titleId);
  if (!target || !hasCatalogBackend() || isUpstreamUnavailable()) {
    return staticMatch;
  }

  const pending = pendingTitleByIdCache.get(titleId);
  if (pending) return raceWithAbort(pending, signal);

  const promise = request<TmdbMediaDetails>(`/${target.endpoint}/${target.tmdbId}`, {
    language: 'pt-BR',
    append_to_response: 'watch/providers',
  })
    .then((details) => {
      if (target.endpoint === 'movie') {
        if (details.runtime && details.runtime > 0) {
          resolvedDurationCache.set(titleId, formatMovieRuntime(details.runtime));
        }
      } else {
        const regularSeasons = extractRegularTmdbSeasons(details);
        cacheTvTotalEpisodes(titleId, details, regularSeasons);
        const formatted = resolveTvDuration({ duration: '' } as MediaTitle, details, regularSeasons);
        if (formatted) {
          resolvedDurationCache.set(titleId, formatted);
        }
      }
      const genreIds = (details.genres ?? [])
        .map((g) => g.id)
        .filter((id): id is number => typeof id === 'number');
      const providers = extractProvidersFromDetails(details) ?? [];
      const mapped = mapMedia(
        { ...details, id: details.id ?? Number(target.tmdbId), genre_ids: genreIds },
        target.endpoint,
        providers,
      );
      const resolved = mapped.id === titleId ? mapped : { ...mapped, id: titleId };
      relatedTitlesById.set(titleId, resolved);
      return resolved;
    })
    .catch(() => staticMatch)
    .finally(() => {
      pendingTitleByIdCache.delete(titleId);
    });

  pendingTitleByIdCache.set(titleId, promise);
  return raceWithAbort(promise, signal);
}

export function getCachedRichTitleDetails(titleId: string): RichTitleDetails | null {
  return richDetailsCache.get(titleId) ?? null;
}

export async function fetchRichTitleDetails(
  title: MediaTitle,
  options?: { throwOnError?: boolean; signal?: AbortSignal },
): Promise<RichTitleDetails | null> {
  if (options?.signal?.aborted) {
    throw createAbortError();
  }
  const cached = richDetailsCache.get(title.id);
  if (cached) return cached;

  const target = resolveTmdbEndpointAndId(title.id);
  if (!target || !hasCatalogBackend() || isUpstreamUnavailable()) {
    return null;
  }

  let pending = pendingRichDetailsCache.get(title.id);
  if (!pending) {
    pending = (async () => {
      const append =
        target.endpoint === 'tv'
          ? 'videos,credits,recommendations,similar,content_ratings,watch/providers'
          : 'videos,credits,recommendations,similar,release_dates,watch/providers';

      const details = await request<TmdbMediaDetails>(`/${target.endpoint}/${target.tmdbId}`, {
        language: 'pt-BR',
        append_to_response: append,
      });

      const regularSeasons =
        target.endpoint === 'tv' ? extractRegularTmdbSeasons(details) : [];

      let duration = title.duration;
      if (target.endpoint === 'movie') {
        if (details.runtime && details.runtime > 0) {
          duration = formatMovieRuntime(details.runtime);
        }
      } else {
        cacheTvTotalEpisodes(title.id, details, regularSeasons);
        duration = resolveTvDuration(title, details, regularSeasons);
      }
      if (duration) {
        resolvedDurationCache.set(title.id, duration);
      }

      const rawEpRuntime =
        details.episode_run_time?.find((val) => typeof val === 'number' && val > 0) ??
        (details.last_episode_to_air?.runtime && details.last_episode_to_air.runtime > 0
          ? details.last_episode_to_air.runtime
          : null);
      const episodeDuration = rawEpRuntime ? `${rawEpRuntime}min/ep` : null;

      const videoKey = pickYoutubeTrailerKey(details.videos?.results);
      let trailerUrl = videoKey ? `https://www.youtube.com/watch?v=${videoKey}` : null;
      if (trailerUrl) {
        resolvedTrailerCache.set(title.id, trailerUrl);
      } else {
        trailerUrl = await fetchTitleTrailerUrl(title);
      }

      const cast: CastMember[] = (details.credits?.cast ?? [])
        .filter((member) => Boolean(member.name?.trim()))
        .slice(0, 14)
        .map((member) => ({
          id: member.id,
          name: member.name!.trim(),
          character: member.character?.trim() || '',
          profilePath: sanitizeTmdbPath(member.profile_path),
        }));

      const seasons: SeasonSummary[] = regularSeasons.map((season) => ({
        seasonNumber: season.season_number!,
        name: season.name?.trim() || `Temporada ${season.season_number}`,
        episodeCount: season.episode_count ?? 0,
        voteAverage:
          typeof season.vote_average === 'number' && season.vote_average > 0
            ? Number(season.vote_average.toFixed(1))
            : null,
        airDate: season.air_date ?? null,
        posterPath: sanitizeTmdbPath(season.poster_path),
      }));

      const rawRelated = [
        ...(details.recommendations?.results ?? []),
        ...(details.similar?.results ?? []),
      ];
      const seenRelatedIds = new Set<number>([Number(target.tmdbId)]);
      const similarTitles: MediaTitle[] = [];
      for (const item of rawRelated) {
        if (!item?.id || seenRelatedIds.has(item.id)) continue;
        seenRelatedIds.add(item.id);
        const mapped = mapMedia(item, target.endpoint, []);
        relatedTitlesById.set(mapped.id, mapped);
        similarTitles.push(mapped);
        if (similarTitles.length >= 14) break;
      }

      const rich: RichTitleDetails = {
        duration,
        episodeDuration,
        statusLabel: details.status ? (TMDB_STATUS_LABELS[details.status] ?? null) : null,
        certification: extractBrCertification(target.endpoint, details),
        voteCount:
          typeof details.vote_count === 'number' && details.vote_count > 0
            ? details.vote_count
            : null,
        trailerUrl,
        providers: extractProvidersFromDetails(details),
        cast,
        seasons,
        similarTitles,
      };

      richDetailsCache.set(title.id, rich);
      return rich;
    })().finally(() => {
      pendingRichDetailsCache.delete(title.id);
    });

    pendingRichDetailsCache.set(title.id, pending);
  }

  if (options?.throwOnError) {
    return raceWithAbort(pending, options.signal);
  }
  return raceWithAbort(pending.catch(() => null), options?.signal);
}

export function getCachedTvSeasonEpisodes(
  titleId: string,
  seasonNumber: number,
): EpisodeSummary[] | null {
  return seasonEpisodesCache.get(`${titleId}:s${seasonNumber}`) ?? null;
}

export async function fetchTvSeasonEpisodes(
  titleId: string,
  seasonNumber: number,
  options?: { throwOnError?: boolean; signal?: AbortSignal },
): Promise<EpisodeSummary[]> {
  if (options?.signal?.aborted) {
    throw createAbortError();
  }
  const cacheKey = `${titleId}:s${seasonNumber}`;
  const cached = seasonEpisodesCache.get(cacheKey);
  if (cached) return cached;

  const target = resolveTmdbEndpointAndId(titleId);
  if (!target || target.endpoint !== 'tv' || !hasCatalogBackend() || isUpstreamUnavailable()) {
    return [];
  }

  let pending = pendingSeasonEpisodesCache.get(cacheKey);
  if (!pending) {
    pending = request<TmdbSeasonDetailsResponse>(
      `/tv/${target.tmdbId}/season/${seasonNumber}`,
      { language: 'pt-BR' },
    )
      .then((res) => {
        const episodes: EpisodeSummary[] = (res.episodes ?? [])
          .filter((ep) => typeof ep.episode_number === 'number' && ep.episode_number > 0)
          .map((ep) => ({
            episodeNumber: ep.episode_number!,
            name: ep.name?.trim() || `Episódio ${ep.episode_number}`,
            runtime: typeof ep.runtime === 'number' && ep.runtime > 0 ? ep.runtime : null,
            airDate: ep.air_date ?? null,
            voteAverage:
              typeof ep.vote_average === 'number' && ep.vote_average > 0
                ? Number(ep.vote_average.toFixed(1))
                : null,
          }));
        seasonEpisodesCache.set(cacheKey, episodes);
        return episodes;
      })
      .finally(() => {
        pendingSeasonEpisodesCache.delete(cacheKey);
      });

    pendingSeasonEpisodesCache.set(cacheKey, pending);
  }

  if (options?.throwOnError) {
    return raceWithAbort(pending, options.signal);
  }
  return raceWithAbort(pending.catch(() => []), options?.signal);
}
