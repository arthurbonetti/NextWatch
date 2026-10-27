export type MediaKind = 'Filme' | 'Série' | 'Anime';
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
};

export function getTitleServices(title: MediaTitle): string[] {
  return title.services && title.services.length > 0 ? title.services : [title.service];
}

export function getMetacriticScore(title: MediaTitle): number | null {
  if (typeof title.metacriticScore === 'number' && title.metacriticScore > 0) {
    return title.metacriticScore;
  }
  const tmdb = Number(title.imdbRating.replace(',', '.'));
  if (!Number.isNaN(tmdb) && tmdb > 0) {
    return Math.min(98, Math.max(20, Math.round(tmdb * 10)));
  }
  return null;
}

export function getTitleAverageRating(title: MediaTitle): number {
  const tmdb = Number(title.imdbRating.replace(',', '.'));
  const hasTmdb = !Number.isNaN(tmdb) && tmdb > 0;
  const metacritic = getMetacriticScore(title);
  const hasMetacritic = metacritic !== null && metacritic > 0;

  if (hasTmdb && hasMetacritic) {
    const metacriticNormalized = metacritic / 10;
    return Number(((tmdb + metacriticNormalized) / 2).toFixed(1));
  }
  if (hasTmdb) return tmdb;
  if (hasMetacritic) return Number((metacritic / 10).toFixed(1));
  return 0;
}

export function formatAverageRating(title: MediaTitle): string {
  const avg = getTitleAverageRating(title);
  return avg > 0 ? avg.toFixed(1).replace('.', ',') : '—';
}

export const CATALOG: MediaTitle[] = [
  {
    id: 'dune-parte-dois', title: 'Duna: Parte Dois', kind: 'Filme', year: 2024, duration: '2h 46min',
    genres: ['Ficção científica', 'Aventura'], service: 'Max', imdbRating: '8,5', color: '#b47e50', icon: 'movie',
    synopsis: 'Paul Atreides une forças a Chani e aos Fremen enquanto busca vingança contra os conspiradores que destruíram sua família.',
  },
  {
    id: 'bebe-rena', title: 'Bebê Rena', kind: 'Série', year: 2024, duration: '7 episódios',
    genres: ['Drama', 'Suspense'], service: 'Netflix', imdbRating: '7,7', color: '#76515e', icon: 'live-tv',
    synopsis: 'Um comediante em dificuldades oferece um gesto de gentileza que desencadeia uma relação obsessiva e muda sua vida.',
  },
  {
    id: 'divertida-mente-2', title: 'Divertida Mente 2', kind: 'Filme', year: 2024, duration: '1h 36min',
    genres: ['Animação', 'Comédia'], service: 'Disney+', imdbRating: '7,5', color: '#397a91', icon: 'theaters',
    synopsis: 'Riley está crescendo e, junto com novas experiências, novas emoções chegam à sala de controle da sua mente.',
  },
  {
    id: 'o-menu', title: 'O Menu', kind: 'Filme', year: 2022, duration: '1h 47min',
    genres: ['Terror', 'Comédia'], service: 'Max', imdbRating: '7,2', color: '#806341', icon: 'movie',
    synopsis: 'Um casal visita um restaurante exclusivo em uma ilha, onde o chef preparou um menu tão surpreendente quanto perturbador.',
  },
  {
    id: 'oppenheimer', title: 'Oppenheimer', kind: 'Filme', year: 2023, duration: '3h',
    genres: ['Drama', 'História'], service: 'Prime Video', imdbRating: '8,3', color: '#765d4a', icon: 'movie',
    synopsis: 'A história do físico J. Robert Oppenheimer e de sua participação no desenvolvimento da primeira bomba atômica.',
  },
  {
    id: 'the-bear', title: 'O Urso', kind: 'Série', year: 2022, duration: '4 temporadas',
    genres: ['Drama', 'Comédia'], service: 'Disney+', imdbRating: '8,5', color: '#8c5a48', icon: 'live-tv',
    synopsis: 'Um jovem chef retorna a Chicago para administrar a lanchonete da família e tenta transformar o negócio e a própria equipe.',
  },
  {
    id: 'a-chegada', title: 'A Chegada', kind: 'Filme', year: 2016, duration: '1h 56min',
    genres: ['Ficção científica', 'Drama'], service: 'Netflix', imdbRating: '7,9', color: '#496579', icon: 'theaters',
    synopsis: 'Uma linguista é convocada para tentar se comunicar com misteriosas naves que aparecem em diferentes partes do planeta.',
  },
  {
    id: 'interestelar', title: 'Interestelar', kind: 'Filme', year: 2014, duration: '2h 49min',
    genres: ['Ficção científica', 'Aventura'], service: 'Max', imdbRating: '8,7', color: '#45536e', icon: 'movie',
    synopsis: 'Com a Terra enfrentando uma crise, uma equipe atravessa um buraco de minhoca em busca de um novo lar para a humanidade.',
  },
  {
    id: 'parasita', title: 'Parasita', kind: 'Filme', year: 2019, duration: '2h 12min',
    genres: ['Suspense', 'Drama'], service: 'Prime Video', imdbRating: '8,5', color: '#65745c', icon: 'theaters',
    synopsis: 'Uma família com poucos recursos se aproxima de uma família rica, e um segredo escondido na casa muda o rumo dos acontecimentos.',
  },
  {
    id: 'arcane', title: 'Arcane', kind: 'Série', year: 2021, duration: '2 temporadas',
    genres: ['Animação', 'Aventura'], service: 'Netflix', imdbRating: '9,0', color: '#59517f', icon: 'live-tv',
    synopsis: 'Duas irmãs ficam em lados opostos de um conflito entre a cidade de Piltover e o submundo de Zaun.',
  },
  {
    id: 'dark', title: 'Dark', kind: 'Série', year: 2017, duration: '3 temporadas',
    genres: ['Ficção científica', 'Suspense'], service: 'Netflix', imdbRating: '8,7', color: '#364b55', icon: 'live-tv',
    synopsis: 'O desaparecimento de uma criança leva quatro famílias de uma pequena cidade a uma trama que atravessa gerações e épocas.',
  },
  {
    id: 'homem-aranha-atraves', title: 'Homem-Aranha: Através do Aranhaverso', kind: 'Filme', year: 2023, duration: '2h 20min',
    genres: ['Animação', 'Aventura'], service: 'Netflix', imdbRating: '8,6', color: '#a34852', icon: 'theaters',
    synopsis: 'Miles Morales atravessa diferentes dimensões e encontra uma equipe de pessoas-aranha com ideias próprias sobre como proteger o multiverso.',
  },
  {
    id: 'ruptura', title: 'Ruptura', kind: 'Série', year: 2022, duration: '2 temporadas',
    genres: ['Ficção científica', 'Suspense'], service: 'Apple TV+', imdbRating: '8,7', color: '#45645f', icon: 'live-tv',
    synopsis: 'Funcionários de uma empresa passam por um procedimento que separa completamente suas memórias profissionais das pessoais.',
  },
  {
    id: 'the-last-of-us', title: 'The Last of Us', kind: 'Série', year: 2023, duration: '2 temporadas',
    genres: ['Drama', 'Aventura'], service: 'Max', imdbRating: '8,7', color: '#586547', icon: 'live-tv',
    synopsis: 'Em um mundo devastado por uma pandemia, Joel recebe a missão de escoltar Ellie em uma jornada perigosa pelos Estados Unidos.',
  },
  {
    id: 'stranger-things', title: 'Stranger Things', kind: 'Série', year: 2016, duration: '4 temporadas',
    genres: ['Ficção científica', 'Suspense'], service: 'Netflix', imdbRating: '8,7', color: '#702d43', icon: 'live-tv',
    synopsis: 'O desaparecimento de um garoto leva seus amigos a investigar acontecimentos sobrenaturais em uma pequena cidade.',
  },
  {
    id: 'wandinha', title: 'Wandinha', kind: 'Série', year: 2022, duration: '2 temporadas',
    genres: ['Comédia', 'Suspense'], service: 'Netflix', imdbRating: '8,0', color: '#4c4058', icon: 'live-tv',
    synopsis: 'Em uma escola para jovens incomuns, Wandinha investiga mistérios enquanto aprende a lidar com novas amizades e visões.',
  },
  {
    id: 'bridgerton', title: 'Bridgerton', kind: 'Série', year: 2020, duration: '3 temporadas',
    genres: ['Drama', 'Romance'], service: 'Netflix', imdbRating: '7,4', color: '#835b76', icon: 'live-tv',
    synopsis: 'Os irmãos Bridgerton navegam romances, reputação e intrigas na alta sociedade londrina do período da Regência.',
  },
  {
    id: 'lupin', title: 'Lupin', kind: 'Série', year: 2021, duration: '3 temporadas',
    genres: ['Aventura', 'Suspense'], service: 'Netflix', imdbRating: '7,5', color: '#53635d', icon: 'live-tv',
    synopsis: 'Inspirado pelas histórias de Arsène Lupin, Assane busca esclarecer uma injustiça contra sua família usando astúcia e disfarces.',
  },
  {
    id: 'the-crown', title: 'The Crown', kind: 'Série', year: 2016, duration: '6 temporadas',
    genres: ['Drama', 'História'], service: 'Netflix', imdbRating: '8,6', color: '#75654a', icon: 'live-tv',
    synopsis: 'A série acompanha momentos marcantes do reinado de Elizabeth II e os desafios pessoais e políticos da família real britânica.',
  },
  {
    id: 'one-piece-live-action', title: 'One Piece', kind: 'Série', year: 2023, duration: '1 temporada',
    genres: ['Aventura', 'Comédia'], service: 'Netflix', imdbRating: '8,3', color: '#34727a', icon: 'live-tv',
    synopsis: 'Luffy e sua tripulação partem em uma jornada pelo oceano em busca do lendário tesouro One Piece.',
  },
  {
    id: 'o-gambito-da-rainha', title: 'O Gambito da Rainha', kind: 'Série', year: 2020, duration: '7 episódios',
    genres: ['Drama', 'História'], service: 'Netflix', imdbRating: '8,5', color: '#55704e', icon: 'live-tv',
    synopsis: 'Uma jovem prodígio do xadrez busca espaço em um circuito competitivo enquanto enfrenta desafios pessoais.',
  },
  {
    id: 'resgate-2', title: 'Resgate 2', kind: 'Filme', year: 2023, duration: '2h 2min',
    genres: ['Ação', 'Suspense'], service: 'Netflix', imdbRating: '7,0', color: '#914e3d', icon: 'movie',
    synopsis: 'Um mercenário aceita uma missão de alto risco para ajudar uma família a escapar de um ambiente perigoso.',
  },
  {
    id: 'the-mandalorian', title: 'The Mandalorian', kind: 'Série', year: 2019, duration: '3 temporadas',
    genres: ['Ficção científica', 'Aventura'], service: 'Disney+', imdbRating: '8,6', color: '#56616a', icon: 'live-tv',
    synopsis: 'Um caçador de recompensas viaja pelos confins da galáxia e passa a proteger uma criança especial.',
  },
  {
    id: 'loki', title: 'Loki', kind: 'Série', year: 2021, duration: '2 temporadas',
    genres: ['Ficção científica', 'Aventura'], service: 'Disney+', imdbRating: '8,2', color: '#536948', icon: 'live-tv',
    synopsis: 'Após escapar de uma linha temporal, Loki é recrutado por uma organização que monitora as ramificações do tempo.',
  },
  {
    id: 'andor', title: 'Andor', kind: 'Série', year: 2022, duration: '2 temporadas',
    genres: ['Ficção científica', 'Drama'], service: 'Disney+', imdbRating: '8,4', color: '#68675c', icon: 'live-tv',
    synopsis: 'Cassian Andor se envolve cada vez mais com a resistência que começa a desafiar o domínio imperial.',
  },
  {
    id: 'wanda-vision', title: 'WandaVision', kind: 'Série', year: 2021, duration: '9 episódios',
    genres: ['Ficção científica', 'Comédia'], service: 'Disney+', imdbRating: '7,9', color: '#6e4e72', icon: 'live-tv',
    synopsis: 'Wanda e Visão vivem em uma cidade aparentemente perfeita, onde cada detalhe esconde algo inesperado.',
  },
  {
    id: 'moana', title: 'Moana: Um Mar de Aventuras', kind: 'Filme', year: 2016, duration: '1h 47min',
    genres: ['Animação', 'Aventura'], service: 'Disney+', imdbRating: '7,6', color: '#32817b', icon: 'theaters',
    synopsis: 'Uma jovem navegadora cruza o oceano para restaurar o equilíbrio de sua ilha e descobrir seu próprio caminho.',
  },
  {
    id: 'coco', title: 'Viva: A Vida é uma Festa', kind: 'Filme', year: 2017, duration: '1h 45min',
    genres: ['Animação', 'Aventura'], service: 'Disney+', imdbRating: '8,4', color: '#a34c48', icon: 'theaters',
    synopsis: 'Um jovem músico visita a Terra dos Mortos e descobre histórias importantes sobre sua família.',
  },
  {
    id: 'soul', title: 'Soul', kind: 'Filme', year: 2020, duration: '1h 40min',
    genres: ['Animação', 'Comédia'], service: 'Disney+', imdbRating: '8,0', color: '#376f8b', icon: 'theaters',
    synopsis: 'Depois de um acidente inesperado, um músico precisa encontrar o caminho de volta enquanto repensa o sentido da vida.',
  },
  {
    id: 'succession', title: 'Succession', kind: 'Série', year: 2018, duration: '4 temporadas',
    genres: ['Drama', 'Comédia'], service: 'Max', imdbRating: '8,8', color: '#53575c', icon: 'live-tv',
    synopsis: 'Os herdeiros de um grande conglomerado disputam influência e o futuro dos negócios da família.',
  },
  {
    id: 'casa-do-dragao', title: 'A Casa do Dragão', kind: 'Série', year: 2022, duration: '2 temporadas',
    genres: ['Drama', 'Aventura'], service: 'Max', imdbRating: '8,3', color: '#793d37', icon: 'live-tv',
    synopsis: 'Décadas antes de Game of Thrones, disputas de sucessão ameaçam dividir a dinastia Targaryen.',
  },
  {
    id: 'the-white-lotus', title: 'The White Lotus', kind: 'Série', year: 2021, duration: '3 temporadas',
    genres: ['Drama', 'Comédia'], service: 'Max', imdbRating: '8,0', color: '#6b7560', icon: 'live-tv',
    synopsis: 'Hóspedes e funcionários de resorts luxuosos se envolvem em conflitos e situações cada vez mais inesperadas.',
  },
  {
    id: 'euphoria', title: 'Euphoria', kind: 'Série', year: 2019, duration: '2 temporadas',
    genres: ['Drama', 'Romance'], service: 'Max', imdbRating: '8,2', color: '#6d548b', icon: 'live-tv',
    synopsis: 'Um grupo de jovens enfrenta relações intensas, escolhas difíceis e a busca por identidade.',
  },
  {
    id: 'joker', title: 'Coringa', kind: 'Filme', year: 2019, duration: '2h 2min',
    genres: ['Drama', 'Suspense'], service: 'Max', imdbRating: '8,3', color: '#806145', icon: 'movie',
    synopsis: 'Um comediante marginalizado enfrenta uma cidade indiferente e passa por uma transformação radical.',
  },
  {
    id: 'batman', title: 'Batman', kind: 'Filme', year: 2022, duration: '2h 56min',
    genres: ['Ação', 'Suspense'], service: 'Max', imdbRating: '7,8', color: '#39434d', icon: 'movie',
    synopsis: 'Em seu segundo ano como vigilante, Batman investiga uma sequência de crimes que abala Gotham City.',
  },
  {
    id: 'barbie', title: 'Barbie', kind: 'Filme', year: 2023, duration: '1h 54min',
    genres: ['Comédia', 'Aventura'], service: 'Max', imdbRating: '6,8', color: '#c45b83', icon: 'movie',
    synopsis: 'Uma viagem para o mundo real leva Barbie e Ken a questionar suas certezas sobre identidade e felicidade.',
  },
  {
    id: 'fallout', title: 'Fallout', kind: 'Série', year: 2024, duration: '1 temporada',
    genres: ['Ficção científica', 'Aventura'], service: 'Prime Video', imdbRating: '8,3', color: '#98723e', icon: 'live-tv',
    synopsis: 'Séculos após uma catástrofe nuclear, habitantes de abrigos subterrâneos descobrem a realidade do mundo exterior.',
  },
  {
    id: 'the-boys', title: 'The Boys', kind: 'Série', year: 2019, duration: '4 temporadas',
    genres: ['Ação', 'Comédia'], service: 'Prime Video', imdbRating: '8,6', color: '#704b48', icon: 'live-tv',
    synopsis: 'Um grupo tenta expor super-heróis poderosos cuja imagem pública esconde interesses perigosos.',
  },
  {
    id: 'reacher', title: 'Reacher', kind: 'Série', year: 2022, duration: '3 temporadas',
    genres: ['Ação', 'Suspense'], service: 'Prime Video', imdbRating: '8,0', color: '#516173', icon: 'live-tv',
    synopsis: 'Um ex-investigador militar itinerante chega a uma cidade pequena e se vê envolvido em uma conspiração local.',
  },
  {
    id: 'senhor-dos-aneis-aneis-poder', title: 'O Senhor dos Anéis: Os Anéis de Poder', kind: 'Série', year: 2022, duration: '2 temporadas',
    genres: ['Aventura', 'Drama'], service: 'Prime Video', imdbRating: '6,9', color: '#846c48', icon: 'live-tv',
    synopsis: 'Na Segunda Era da Terra-média, diferentes povos enfrentam ameaças e mudanças que moldarão o futuro do mundo.',
  },
  {
    id: 'fleabag', title: 'Fleabag', kind: 'Série', year: 2016, duration: '2 temporadas',
    genres: ['Comédia', 'Drama'], service: 'Prime Video', imdbRating: '8,7', color: '#875546', icon: 'live-tv',
    synopsis: 'Uma mulher espirituosa tenta equilibrar família, trabalho e relacionamentos enquanto encara perdas e recomeços.',
  },
  {
    id: 'sound-of-metal', title: 'O Som do Silêncio', kind: 'Filme', year: 2019, duration: '2h',
    genres: ['Drama', 'Música'], service: 'Prime Video', imdbRating: '7,7', color: '#5a655c', icon: 'movie',
    synopsis: 'A vida de um baterista muda quando sua audição começa a falhar, levando-o a repensar sua relação com a música.',
  },
  {
    id: 'ted-lasso', title: 'Ted Lasso', kind: 'Série', year: 2020, duration: '3 temporadas',
    genres: ['Comédia', 'Drama'], service: 'Apple TV+', imdbRating: '8,8', color: '#738451', icon: 'live-tv',
    synopsis: 'Um técnico de futebol americano assume um clube inglês e conquista o elenco com otimismo e empatia.',
  },
  {
    id: 'silo', title: 'Silo', kind: 'Série', year: 2023, duration: '2 temporadas',
    genres: ['Ficção científica', 'Suspense'], service: 'Apple TV+', imdbRating: '8,1', color: '#59645c', icon: 'live-tv',
    synopsis: 'Em uma comunidade subterrânea, uma engenheira começa a investigar os segredos por trás das regras que mantêm todos vivos.',
  },
  {
    id: 'foundation', title: 'Fundação', kind: 'Série', year: 2021, duration: '3 temporadas',
    genres: ['Ficção científica', 'Drama'], service: 'Apple TV+', imdbRating: '7,6', color: '#59637d', icon: 'live-tv',
    synopsis: 'Cientistas e líderes tentam preservar o conhecimento diante da queda prevista de um vasto império galáctico.',
  },
  {
    id: 'the-morning-show', title: 'The Morning Show', kind: 'Série', year: 2019, duration: '4 temporadas',
    genres: ['Drama'], service: 'Apple TV+', imdbRating: '8,2', color: '#6a5868', icon: 'live-tv',
    synopsis: 'Apresentadores e jornalistas lidam com disputas de poder e transformações em um programa matinal de televisão.',
  },
  {
    id: 'slow-horses', title: 'Slow Horses', kind: 'Série', year: 2022, duration: '5 temporadas',
    genres: ['Suspense', 'Comédia'], service: 'Apple TV+', imdbRating: '8,3', color: '#55665f', icon: 'live-tv',
    synopsis: 'Agentes afastados do serviço secreto britânico recebem missões improváveis sob a liderança de um chefe pouco convencional.',
  },
  {
    id: 'pluribus', title: 'Pluribus', kind: 'Série', year: 2025, duration: '1 temporada',
    genres: ['Ficção científica', 'Drama'], service: 'Apple TV+', imdbRating: '8,0', color: '#76875c', icon: 'live-tv',
    synopsis: 'Uma autora precisa lidar com uma mudança global que transforma a vida cotidiana e desafia sua visão de mundo.',
  },
  {
    id: 'sob-pressao', title: 'Sob Pressão', kind: 'Série', year: 2017, duration: '5 temporadas',
    genres: ['Drama'], service: 'Globoplay', imdbRating: '8,6', color: '#4e6877', icon: 'live-tv',
    synopsis: 'Uma equipe médica de um hospital público enfrenta emergências complexas e dilemas pessoais a cada plantão.',
  },
  {
    id: 'os-outros', title: 'Os Outros', kind: 'Série', year: 2023, duration: '2 temporadas',
    genres: ['Drama', 'Suspense'], service: 'Globoplay', imdbRating: '7,8', color: '#6e5556', icon: 'live-tv',
    synopsis: 'Um conflito entre vizinhos em um condomínio se intensifica e expõe tensões que estavam escondidas no cotidiano.',
  },
  {
    id: 'justica', title: 'Justiça', kind: 'Série', year: 2016, duration: '2 temporadas',
    genres: ['Drama', 'Suspense'], service: 'Globoplay', imdbRating: '8,4', color: '#5a5d61', icon: 'live-tv',
    synopsis: 'Histórias de pessoas afetadas por decisões judiciais se cruzam ao longo de anos, revelando diferentes lados de cada caso.',
  },
  {
    id: 'aruanas', title: 'Aruanas', kind: 'Série', year: 2019, duration: '2 temporadas',
    genres: ['Drama', 'Aventura'], service: 'Globoplay', imdbRating: '7,2', color: '#48715d', icon: 'live-tv',
    synopsis: 'Integrantes de uma organização ambiental investigam crimes e ameaças em uma região de floresta tropical.',
  },
  {
    id: 'ilha-de-ferro', title: 'Ilha de Ferro', kind: 'Série', year: 2018, duration: '2 temporadas',
    genres: ['Drama', 'Aventura'], service: 'Globoplay', imdbRating: '7,5', color: '#48616d', icon: 'live-tv',
    synopsis: 'Trabalhadores de uma plataforma de petróleo enfrentam riscos profissionais e relações intensas em alto-mar.',
  },
  {
    id: 'todas-as-flores', title: 'Todas as Flores', kind: 'Série', year: 2022, duration: '2 temporadas',
    genres: ['Drama', 'Romance'], service: 'Globoplay', imdbRating: '7,7', color: '#865a68', icon: 'live-tv',
    synopsis: 'Uma jovem enfrenta segredos familiares e manipulações enquanto tenta construir uma vida independente.',
  },
];

export const GENRES = ['Ficção científica', 'Drama', 'Aventura', 'Comédia', 'Suspense', 'Terror', 'Animação', 'História', 'Romance', 'Ação', 'Música'];