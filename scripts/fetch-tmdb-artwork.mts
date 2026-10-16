// Busca no TMDB o pôster e o banner de cada título do catálogo e grava em constants/tmdb-artwork.ts.
// Rodar com: npm run artwork  (lê TMDB_API_KEY de .env.local)
import { writeFileSync } from 'node:fs';
import { CATALOG, type MediaTitle } from '../constants/catalog.ts';

type TmdbResult = {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  popularity: number;
};

type Match = { result: TmdbResult; score: number; type: 'movie' | 'tv' };

const KEY = process.env.TMDB_API_KEY?.trim();
if (!KEY) {
  console.error('TMDB_API_KEY não encontrada. Crie .env.local com TMDB_API_KEY=<sua chave> e rode de novo.');
  process.exit(1);
}

// A chave v4 ("API Read Access Token") é um JWT e vai no header; a v3 vai na query string.
const isBearer = KEY.startsWith('eyJ');

async function search(type: 'movie' | 'tv', query: string, year?: number): Promise<TmdbResult[]> {
  const url = new URL(`https://api.themoviedb.org/3/search/${type}`);
  url.searchParams.set('query', query);
  url.searchParams.set('language', 'pt-BR');
  if (year) url.searchParams.set(type === 'movie' ? 'primary_release_year' : 'first_air_date_year', String(year));
  if (!isBearer) url.searchParams.set('api_key', KEY!);

  const response = await fetch(url, { headers: isBearer ? { Authorization: `Bearer ${KEY}` } : {} });
  if (!response.ok) throw new Error(`TMDB ${response.status} em "${query}": ${await response.text()}`);
  const body = (await response.json()) as { results: TmdbResult[] };
  return body.results;
}

const normalize = (text = '') =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function score(item: MediaTitle, result: TmdbResult): number {
  const wanted = normalize(item.title);
  const names = [result.title, result.name, result.original_title, result.original_name].map(normalize);
  const year = Number((result.release_date || result.first_air_date || '').slice(0, 4));

  let points = 0;
  if (names.includes(wanted)) points += 3;
  else if (names.some((name) => name && (name.includes(wanted) || wanted.includes(name)))) points += 1;
  if (year === item.year) points += 2;
  else if (Math.abs(year - item.year) === 1) points += 1;
  if (result.poster_path) points += 0.5;
  return points;
}

async function findBest(item: MediaTitle): Promise<Match | null> {
  const type = item.kind === 'Filme' ? 'movie' : 'tv';
  // Primeiro com o ano; se não vier nada, sem ano (séries costumam ter o ano da temporada, não da estreia).
  let results = await search(type, item.title, item.year);
  if (results.length === 0) results = await search(type, item.title);
  if (results.length === 0) return null;

  const ranked = results
    .map((result) => ({ result, score: score(item, result), type }) as Match)
    .sort((a, b) => b.score - a.score || b.result.popularity - a.result.popularity);
  return ranked[0];
}

const artwork: Record<string, { tmdbId: number; type: 'movie' | 'tv'; poster: string | null; backdrop: string | null }> = {};
const doubts: string[] = [];

for (const item of CATALOG) {
  const match = await findBest(item);
  if (!match) {
    doubts.push(`✗ ${item.title} (${item.year}): nenhum resultado`);
    continue;
  }
  const { result, type } = match;
  const found = `${result.title ?? result.name} (${(result.release_date || result.first_air_date || '????').slice(0, 4)})`;
  artwork[item.id] = { tmdbId: result.id, type, poster: result.poster_path, backdrop: result.backdrop_path };
  // Abaixo de 5 = título e ano não bateram juntos: vale olhar.
  const line = `${match.score >= 5 ? '✓' : '?'} ${item.title} (${item.year}) → ${found} · tmdb ${type}/${result.id}`;
  console.log(line);
  if (match.score < 5) doubts.push(line);
}

const header =
  '// Arquivo gerado por scripts/fetch-tmdb-artwork.mts — não editar à mão; rode `npm run artwork`.\n' +
  '// Imagens: The Movie Database (TMDB). This product uses the TMDB API but is not endorsed or certified by TMDB.\n\n';
const body =
  "export type TmdbArtwork = { tmdbId: number; type: 'movie' | 'tv'; poster: string | null; backdrop: string | null };\n\n" +
  `export const TMDB_ARTWORK: Record<string, TmdbArtwork> = ${JSON.stringify(artwork, null, 2)};\n`;
writeFileSync(new URL('../constants/tmdb-artwork.ts', import.meta.url), header + body);

console.log(`\n${Object.keys(artwork).length}/${CATALOG.length} títulos com imagem gravados em constants/tmdb-artwork.ts`);
if (doubts.length) console.log(`\nConferir (${doubts.length}):\n${doubts.join('\n')}`);
