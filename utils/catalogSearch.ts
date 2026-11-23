import { getTitleAverageRating, getTitleServices } from '../constants/catalog.ts';
import type { MediaTitle } from '../types/media.ts';

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function computeNameMatchScore(
  normalizedName: string,
  normalizedQuery: string,
  queryTokens: string[],
): number {
  if (!normalizedName || !normalizedQuery) return 0;
  if (normalizedName === normalizedQuery) return 1000;

  const lengthPenalty = Math.min(80, Math.max(0, (normalizedName.length - normalizedQuery.length) * 2));
  if (normalizedName.startsWith(`${normalizedQuery} `)) {
    return 750 - lengthPenalty;
  }
  if (normalizedName.startsWith(normalizedQuery)) {
    return 600 - lengthPenalty;
  }
  if (` ${normalizedName} `.includes(` ${normalizedQuery} `)) {
    return 450 - Math.min(50, lengthPenalty);
  }

  const nameWords = normalizedName.split(' ');
  if (queryTokens.length > 1 && queryTokens.every((token) => nameWords.includes(token))) {
    return 380;
  }
  if (normalizedName.includes(normalizedQuery)) {
    return 260;
  }
  if (queryTokens.length > 1 && queryTokens.every((token) => normalizedName.includes(token))) {
    return 180;
  }
  return 0;
}

export function matchesSearchQuery(title: MediaTitle, rawQuery: string): boolean {
  return !normalizeSearchText(rawQuery) || getSearchRelevanceScore(title, rawQuery) > 0;
}

export function getSearchRelevanceScore(title: MediaTitle, rawQuery: string): number {
  const normalizedQuery = normalizeSearchText(rawQuery);
  if (!normalizedQuery) return 0;
  const queryTokens = normalizedQuery.split(' ').filter(Boolean);

  const ptScore = computeNameMatchScore(normalizeSearchText(title.title), normalizedQuery, queryTokens);
  const origScore = title.originalTitle
    ? computeNameMatchScore(normalizeSearchText(title.originalTitle), normalizedQuery, queryTokens) * 0.96
    : 0;
  const nameScore = Math.max(ptScore, origScore);

  let metadataScore = 0;
  if (nameScore === 0) {
    const titleServices = getTitleServices(title);
    const matchesGenre = title.genres.some((genre) => normalizeSearchText(genre).includes(normalizedQuery));
    const matchesService = titleServices.some((service) => normalizeSearchText(service).includes(normalizedQuery));
    if (!matchesGenre && !matchesService) return 0;
    metadataScore = 40;
  }

  const defaultVoteCount = title.catalogSource === 'tmdb' ? 0 : 5000;
  const defaultPopularity = title.catalogSource === 'tmdb' ? 0 : 80;
  const voteCountBoost = Math.log10(Math.max(0, title.voteCount ?? defaultVoteCount) + 1) * 35;
  const popularityBoost = Math.log10(Math.max(0, title.popularity ?? defaultPopularity) + 1) * 25;
  const ratingBoost = getTitleAverageRating(title) * 6;
  const posterBoost = title.tmdbPosterPath || title.catalogSource !== 'tmdb' ? 25 : 0;
  const synopsisBoost = title.synopsis && title.synopsis !== 'Sinopse indisponível no TMDB.' ? 15 : 0;

  return nameScore + metadataScore + voteCountBoost + popularityBoost + ratingBoost + posterBoost + synopsisBoost;
}

export function rankTitlesBySearchRelevance(titles: MediaTitle[], rawQuery: string): MediaTitle[] {
  const normalizedQuery = normalizeSearchText(rawQuery);
  if (!normalizedQuery) return titles;

  return titles
    .map((title, index) => ({
      title,
      index,
      score: getSearchRelevanceScore(title, rawQuery),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.title);
}
