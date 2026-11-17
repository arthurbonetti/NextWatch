<div align="center">
  <img src="./assets/images/icon.png" alt="NextWatch Logo" width="112" />

  # NextWatch

  **Curadoria inteligente de streaming e gestão financeira de assinaturas.**

  [![React Native](https://img.shields.io/badge/React%20Native-0.86.3-61DAFB?logo=react&logoColor=black)](https://reactnative.dev)
  [![Expo](https://img.shields.io/badge/Expo-~57.0.0-000020?logo=expo&logoColor=white)](https://expo.dev)
  [![TypeScript](https://img.shields.io/badge/TypeScript-~6.0.3-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
  [![TMDB API](https://img.shields.io/badge/TMDB-API%20v3%2Fv4-01B4E4?logo=themoviedatabase&logoColor=white)](https://www.themoviedb.org)
  [![Supabase](https://img.shields.io/badge/Supabase-Auth%20%26%20Sync-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
</div>

---

## Sumário

- [Visão Geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Stack Tecnológica](#stack-tecnológica)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Configuração e Instalação](#configuração-e-instalação)
- [Scripts Disponíveis](#scripts-disponíveis)
- [Build Android (EAS)](#build-android-eas)
- [Atribuição e Licença](#atribuição-e-licença)

---

## Visão Geral

O **NextWatch** é uma aplicação multiplataforma (Android, iOS e Web) desenvolvida em React Native com Expo para centralizar a descoberta de conteúdo sob demanda e o controle de gastos com plataformas de streaming.

O aplicativo resolve dois problemas recorrentes no consumo de mídia digital:
- **Fadiga de escolha**: recomenda filmes, séries e animes exclusivamente dentre os serviços que o usuário realmente assina e mantém ativos.
- **Visibilidade financeira**: consolida mensalidades, projeta custos anuais em BRL e organiza datas de vencimento das assinaturas.

A arquitetura opera com sincronização autenticada via Supabase e persistência local em `AsyncStorage` com fila de operações pendentes para funcionamento offline.

---

## Funcionalidades

### Roleta de Sorteio
- Seleção aleatória de títulos disponíveis apenas nos provedores ativos do usuário, com nota média combinada mínima de `6.0` (TMDB + Metacritic quando disponível).
- Filtros por categoria (`Todos`, `Filme`, `Série`, `Anime`) e por gênero.
- Embaralhamento baseado em `QuickSort` (`quickSortByRandom`) com trava contra sorteios duplicados em sequência.
- Registro imediato da decisão tomada pelo usuário (`assistiu`, `salvou`, `sorteou outro`, `ignorou`).

### Catálogo e Busca
- Integração com a API do **The Movie Database (TMDB)** configurada para a região Brasil (`BR`), com carregamento paginado concorrente e fallback estático embutido.
- Busca textual com normalização, ranqueamento por relevância e *debounce*.
- Filtros combináveis por avaliação, tipo de mídia, gênero e plataforma de streaming.
- Tela e modal de detalhes com resolução sob demanda de duração (filmes) ou quantidade de temporadas e episódios (séries e animes), sinopse expansível e artes em alta resolução.

### Gestão de Assinaturas
- Painel financeiro com total mensal ativo e projeção de custo anual em Reais (`BRL`).
- Cadastro, edição, ativação/pausa e remoção de provedores (Netflix, Disney+, Max, Prime Video, Globoplay, Apple TV+, Crunchyroll, entre outros).
- Configuração de dia de cobrança e alertas de renovação (`1`, `3` ou `7` dias de antecedência).

### Minha Lista e Histórico de Sorteios
- Coleção persistente de títulos salvos para assistir depois (`Minha Lista`).
- Histórico cronológico dos últimos sorteios realizados, com contagem e filtragem por ação tomada.

### Autenticação e Perfil
- Fluxo completo de login e cadastro integrado ao Supabase Auth, com validação de credenciais e controle de tentativas (*rate limiting*).
- Armazenamento seguro de sessão e sincronização automática entre dispositivos quando conectado.

---

## Stack Tecnológica

| Camada | Tecnologia | Finalidade |
| :--- | :--- | :--- |
| Framework | React Native 0.86 + Expo SDK 57 | Base multiplataforma (Android, iOS e Web) |
| Linguagem | TypeScript ~6.0 | Tipagem estática |
| Roteamento | Expo Router ~57.0 | Navegação baseada em arquivos (Tabs, Stacks e Modais) |
| Backend e Auth | Supabase | Autenticação e sincronização de dados do usuário |
| Catálogo Externo | TMDB API (v3/v4) | Metadados, provedores de streaming (`BR`) e imagens |
| Persistência Local | AsyncStorage e Expo SecureStore | Cache offline, fila de sincronização e tokens de sessão |
| UI e Animações | React Native Reanimated, Expo Image e MaterialIcons | Transições fluidas, renderização otimizada de capas e ícones |

---

## Estrutura do Projeto

```text
NextWatch/
├── app/                          # Rotas baseadas em arquivos (Expo Router)
│   ├── (auth)/                   # Fluxos de login e cadastro
│   ├── (tabs)/                   # Abas principais (Início, Explorar, Perfil)
│   ├── title/[id].tsx            # Página de detalhes de um título
│   ├── draw-history.tsx          # Histórico de decisões da roleta
│   ├── my-list.tsx               # Coleção de títulos salvos
│   ├── subscriptions.tsx         # Painel de gestão de assinaturas
│   └── _layout.tsx               # Layout raiz e providers globais
├── assets/                       # Ícones, splash screens e recursos visuais
├── components/
│   ├── atoms/                    # Botões, inputs, tipografia, capas e logos
│   └── organisms/                # Cards e modais de detalhes e de assinaturas
├── constants/                    # Catálogo estático, provedores, tipografia e capas
├── contexts/                     # Estados globais (Auth, Catalog, DrawHistory, MyList, Subscriptions)
├── hooks/                        # Hooks customizados (useNetworkStatus)
├── scripts/                      # Utilitários de manutenção (fetch-tmdb-artwork.mts)
├── services/                     # Clientes de API e armazenamento (authApi, secureStore, tmdb)
└── utils/                        # Funções utilitárias (quickSort)
```

---

## Configuração e Instalação

### Pré-requisitos

- **Node.js** `24.x` (recomendado gerenciar via `nvm`) e **npm**
- Aplicativo **Expo Go** instalado no dispositivo móvel ([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) / [iOS](https://apps.apple.com/app/expo-go/id982107779)) ou emulador configurado

### 1. Clonar o repositório e instalar dependências

```bash
git clone https://github.com/arthurbonetti/NextWatch.git
cd NextWatch
npm ci
```

### 2. Configurar variáveis de ambiente

Crie o arquivo `.env.local` na raiz do projeto utilizando `.env.example` como base:

```bash
cp .env.example .env.local
```

Preencha as variáveis conforme o ambiente desejado:

```env
# Autenticação e sincronização (Supabase)
EXPO_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon_aqui

# Catálogo dinâmico (TMDB API Read Access Token v4)
EXPO_PUBLIC_TMDB_API_KEY=seu_token_tmdb_aqui
TMDB_API_KEY=seu_token_tmdb_aqui
```

> **Nota:** Caso `EXPO_PUBLIC_TMDB_API_KEY` não seja informada, o aplicativo utiliza o catálogo estático embutido como fallback. A variável `TMDB_API_KEY` é utilizada apenas pelo script auxiliar `npm run artwork`. Sem as credenciais do Supabase, os dados ficam restritos ao armazenamento local do dispositivo.

### 3. Iniciar o servidor de desenvolvimento

```bash
npm start
```

Para executar diretamente em plataformas específicas ou redes com restrições:

```bash
npm run web           # Abre no navegador
npm run start:tunnel  # Inicia via túnel Expo para dispositivos em redes distintas
```

---

## Scripts Disponíveis

| Comando | Descrição |
| :--- | :--- |
| `npm start` | Inicia o servidor Metro Bundler via Expo CLI. |
| `npm run start:tunnel` | Inicia o Expo Go utilizando túnel seguro. |
| `npm run android` | Compila e executa o projeto nativamente no Android. |
| `npm run ios` | Compila e executa o projeto nativamente no iOS. |
| `npm run web` | Executa a aplicação em ambiente web. |
| `npm run artwork` | Sincroniza metadados locais de capas via script `scripts/fetch-tmdb-artwork.mts`. |
| `npm run lint` | Executa a análise estática de código com ESLint. |

---

## Build Android (EAS)

O projeto possui o perfil `preview` configurado em [eas.json](./eas.json) para geração de arquivos `.apk` de distribuição interna.

1. Autentique-se na CLI da Expo:
   ```bash
   npx eas-cli@latest login
   ```
2. Cadastre as variáveis de ambiente (`EXPO_PUBLIC_TMDB_API_KEY`, `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`) no painel da Expo em **Project Settings → Environment Variables** para o ambiente `preview`.
3. Inicie a compilação:
   ```bash
   npx eas-cli@latest build --platform android --profile preview
   ```

Ao término da build, o link para download do `.apk` será exibido no terminal.

---

## Atribuição e Licença

- Metadados de filmes, séries, animes e disponibilidade em provedores de streaming são fornecidos por [The Movie Database (TMDB)](https://www.themoviedb.org/) e JustWatch.
- Este produto utiliza a API do TMDB, mas não é endossado nem certificado pelo TMDB.
- Projeto distribuído sob licença de uso privado e educacional.
