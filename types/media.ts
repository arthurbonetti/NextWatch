import type { MediaTitle } from '@/constants/catalog';

export type TmdbImageSize = 'w92' | 'w154' | 'w342' | 'w500' | 'w780';

export type CastMember = {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
};

export type SeasonSummary = {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  voteAverage: number | null;
  airDate: string | null;
  posterPath: string | null;
};

export type EpisodeSummary = {
  episodeNumber: number;
  name: string;
  runtime: number | null;
  airDate: string | null;
  voteAverage: number | null;
};

export type RichTitleDetails = {
  duration: string;
  episodeDuration: string | null;
  statusLabel: string | null;
  certification: string | null;
  voteCount: number | null;
  trailerUrl: string | null;
  providers: string[] | null;
  cast: CastMember[];
  seasons: SeasonSummary[];
  similarTitles: MediaTitle[];
};
