import type { MediaEndpoint } from './types';

export const MAX_PAGES_PER_ENDPOINT = 60;
export const REQUEST_CONCURRENCY = 6;
export const FIRST_BATCH_EMIT_THRESHOLD = 4;
export const PROGRESSIVE_BATCH_EMIT_INTERVAL = 16;
export const REQUEST_TIMEOUT_MS = 15000;
export const MAX_SEARCH_QUERY_LENGTH = 100;
export const SAFE_YOUTUBE_KEY_REGEX = /^[a-zA-Z0-9_-]{6,32}$/;

export const PROVIDER_ALIASES: Record<string, string[]> = {
  Netflix: ['netflix', 'netflix standard with ads', 'netflix basic with ads'],
  'Disney+': ['disney plus', 'disney'],
  Max: ['max', 'hbo max'],
  'Prime Video': ['amazon prime video', 'prime video', 'amazon prime video with ads'],
  'Apple TV+': ['apple tv plus', 'apple tv'],
  Globoplay: ['globoplay'],
  Crunchyroll: ['crunchyroll', 'crunchyroll amazon channel'],
};

export const GENRE_NAMES: Record<MediaEndpoint, Record<number, string>> = {
  movie: {
    12: 'Aventura',
    14: 'Fantasia',
    16: 'Animação',
    18: 'Drama',
    27: 'Terror',
    28: 'Ação',
    35: 'Comédia',
    36: 'História',
    37: 'Faroeste',
    53: 'Suspense',
    80: 'Crime',
    99: 'Documentário',
    878: 'Ficção científica',
    9648: 'Mistério',
    10402: 'Música',
    10749: 'Romance',
    10751: 'Família',
    10752: 'Guerra',
    10770: 'Filme para TV',
  },
  tv: {
    16: 'Animação',
    18: 'Drama',
    35: 'Comédia',
    37: 'Faroeste',
    80: 'Crime',
    99: 'Documentário',
    9648: 'Mistério',
    10751: 'Família',
    10759: 'Ação e aventura',
    10762: 'Infantil',
    10763: 'Notícias',
    10764: 'Reality',
    10765: 'Ficção científica e fantasia',
    10766: 'Novela',
    10767: 'Talk show',
    10768: 'Guerra e política',
  },
};

export const COVER_COLORS = ['#596b7c', '#76515e', '#397a91', '#806341', '#59517f', '#48616d'];

export const TMDB_STATUS_LABELS: Record<string, string> = {
  'Returning Series': 'Em exibição',
  Ended: 'Finalizada',
  Canceled: 'Cancelada',
  'In Production': 'Em produção',
  Planned: 'Planejada',
  Pilot: 'Piloto',
  Released: 'Lançado',
};
