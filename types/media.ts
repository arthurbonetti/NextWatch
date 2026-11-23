export type MediaKind = 'Filme' | 'Série' | 'Anime';
export type MediaKindFilter = 'Todos' | MediaKind;
export type MediaIcon = 'movie' | 'live-tv' | 'theaters';
export type RatingSource = 'IMDb' | 'TMDB';

export type MediaTitle = {
  id: string;
  title: string;
  kind: MediaKind;
  year: number;
  duration: string;
  genres: string[];
  service: string;
  services?: string[];
  imdbRating: string;
  metacriticScore?: number | null;
  synopsis: string;
  color: string;
  icon: MediaIcon;
  ratingSource?: RatingSource;
  catalogSource?: 'tmdb';
  tmdbPosterPath?: string | null;
  tmdbBackdropPath?: string | null;
  originalTitle?: string;
  popularity?: number;
  voteCount?: number;
};

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
