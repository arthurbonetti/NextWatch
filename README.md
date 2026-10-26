<div align="center">
  <img src="./assets/images/icon.png" alt="NextWatch Logo" width="120" />

  # NextWatch 🎬

  **Seu guia inteligente de streaming e controle de assinaturas.**

  [![React Native](https://img.shields.io/badge/React%20Native-0.86.3-61DAFB?logo=react&logoColor=black)](https://reactnative.dev)
  [![Expo](https://img.shields.io/badge/Expo-~57.0.0-000020?logo=expo&logoColor=white)](https://expo.dev)
  [![TypeScript](https://img.shields.io/badge/TypeScript-~6.0.3-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
  [![TMDB API](https://img.shields.io/badge/TMDB-API%20v3%2Fv4-01B4E4?logo=themoviedatabase&logoColor=white)](https://www.themoviedb.org)

  *Saiba exatamente quanto você gasta por mês e nunca mais perca horas decidindo o que assistir.*
</div>

---

## 📌 Sobre o Projeto

O **NextWatch** é um aplicativo mobile e web multiplataforma projetado para resolver dois dilemas comuns de quem consome entretenimento sob demanda:
1. **O que assistir?** Indecisão frente a catálogos gigantescos e espalhados.
2. **Quanto estou gastando?** Falta de visibilidade sobre o custo acumulado de múltiplos serviços de streaming contratados.

Com o NextWatch, o usuário cadastra suas assinaturas ativas e tem acesso a um catálogo dinâmico integrado ao **The Movie Database (TMDB)**, além de uma roleta de sorteio que sugere filmes, séries e animes disponíveis exclusivamente nos serviços que ele assina.

---

## ✨ Funcionalidades Principais

- 🎲 **Roleta de Sorteio Inteligente**:
  - Sorteio aleatório com algoritmo de embaralhamento rápido (`QuickSort`).
  - Filtro por tipo de mídia (*Filmes*, *Séries*, *Animes*) e por gênero.
  - Sorteia apenas obras disponíveis nos serviços ativos da conta.
  - Carregamento assíncrono em segundo plano para novos títulos após cada rodada.

- 🔍 **Exploração e Busca no Catálogo**:
  - Consulta e paginação sob demanda sincronizadas com a API do TMDB (região Brasil).
  - Pesquisa em tempo real por títulos e termos com *debounce* e cache local de consultas.
  - Filtros avançados por nota de avaliação (`7+`, `8+`), status (*Quero ver* / *Assistidos*), gênero e serviço.
  - Modal e página de detalhes completos com sinopse, ano, duração, pôsteres e banners de alta resolução.

- 💳 **Painel de Gestão de Assinaturas**:
  - Visualização resumida de gastos mensais e projeção de custo anual em Reais (BRL).
  - Ativação, pausa, edição e remoção de provedores (*Netflix*, *Disney+*, *Max*, *Prime Video*, *Globoplay*, *Apple TV+*, etc.).
  - Configuração de dia de cobrança e lembretes de renovação (1, 3 ou 7 dias antes).
  - Persistência local segura dos dados com `AsyncStorage`.

- 👤 **Autenticação e Perfil**:
  - Fluxo de login e cadastro integrado ao ciclo de vida do app.

---

## 🛠️ Tecnologias Utilizadas

- **Core**: [React Native](https://reactnative.dev/) + [Expo](https://expo.dev/) (SDK 57)
- **Linguagem**: [TypeScript](https://www.typescriptlang.org/)
- **Roteamento**: [Expo Router](https://docs.expo.dev/router/introduction/) (File-based Routing com Tabs, Stacks e Modais)
- **Estilização e Animações**: React Native StyleSheet, React Native Animated e [React Native Reanimated](https://docs.swmansion.com/react-native-reanimated/)
- **Ícones e Mídia**: `@expo/vector-icons`, [Expo Image](https://docs.expo.dev/versions/latest/sdk/image/) e `expo-symbols`
- **Armazenamento Local**: `@react-native-async-storage/async-storage`
- **Dados Externos**: [The Movie Database (TMDB) API](https://www.themoviedb.org/documentation/api)

---

## 🚀 Como Executar o Projeto

### Pré-requisitos
- **Node.js** `24.22.0` (recomendado gerenciar via `nvm`)
- **npm** instalado
- Aplicativo **Expo Go** instalado no celular ([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) / [iOS](https://apps.apple.com/app/expo-go/id982107779)) ou um emulador configurado.

### 1. Clonar e Instalar Dependências
```bash
# Clone o repositório
git clone https://github.com/seu-usuario/NextWatch.git
cd NextWatch

# Instale os pacotes
npm ci
```

### 2. Configurar Variáveis de Ambiente
O aplicativo consome dados do TMDB para catálogo dinâmico e imagens.

1. Crie uma conta no [The Movie Database (TMDB)](https://www.themoviedb.org/).
2. Em **Configurações → API**, gere um **API Read Access Token** (Token v4).
3. Crie o arquivo `.env.local` na raiz do projeto a partir do exemplo:
   ```bash
   cp .env.example .env.local
   ```
4. Insira sua chave:
   ```env
   EXPO_PUBLIC_TMDB_API_KEY=seu_token_aqui
   TMDB_API_KEY=seu_token_aqui
   ```
> *Nota: Caso a chave não seja configurada, o aplicativo iniciará normalmente utilizando o catálogo estático embutido como fallback.*

### 3. Iniciar o Servidor de Desenvolvimento
```bash
npm start
```
- **No celular**: Abra o app Expo Go e escaneie o QR Code do terminal.
- **Caso esteja usando túnel (rede diferente/firewall)**:
  ```bash
  npm run start:tunnel
  ```
- **Versão Web**:
  ```bash
  npm run web
  ```

---

## 📦 Scripts Úteis

| Comando | Descrição |
| :--- | :--- |
| `npm start` | Inicia o bundler Metro com Expo. |
| `npm run web` | Inicia o projeto com suporte a navegador desktop/mobile. |
| `npm run start:tunnel` | Conexão via túnel seguro (ideal para conexões Wi-Fi restritas). |
| `npm run artwork` | Executa o script que busca e atualiza os metadados de imagem locais do TMDB. |
| `npm run lint` | Executa a verificação estática de código com o ESLint. |

---

## 📱 Gerar APK para Android (Build EAS)

O repositório já está configurado com `eas.json` para geração de builds de teste (`preview`):

1. Conecte sua conta Expo:
   ```bash
   npx eas-cli@latest login
   ```
2. Configure a variável `EXPO_PUBLIC_TMDB_API_KEY` no painel da Expo (**Project Settings → Environment Variables**) com o ambiente `preview` marcado como *Sensitive*.
3. Execute a compilação:
   ```bash
   npx eas-cli@latest build --platform android --profile preview
   ```
Ao finalizar o processo, o link de download direto do arquivo `.apk` será disponibilizado pelo terminal.

---

## 📂 Estrutura de Diretórios

```text
NextWatch/
├── app/                  # Roteamento file-based (Expo Router)
│   ├── (auth)/           # Telas de login e cadastro
│   ├── (tabs)/           # Abas de navegação (Início, Explorar, Assinaturas)
│   ├── title/[id].tsx    # Detalhes dinâmicos da obra
│   └── _layout.tsx       # Layout raiz e provedores globais
├── assets/               # Ícones, splash screens e imagens
├── components/           # Componentes modulares
│   ├── atoms/            # Botões, inputs, badges, textos e logos
│   └── organisms/        # Modais de detalhes e de edição de assinatura
├── constants/            # Catálogo estático, assinaturas e paleta de cores
├── contexts/             # Context API (AuthContext, CatalogContext, SubscriptionsContext)
├── services/             # Clientes de API (tmdb.ts)
├── utils/                # Funções utilitárias (algoritmo QuickSort, etc.)
└── scripts/              # Scripts auxiliares de build e sincronização
```

---

## ⚖️ Atribuição e Licença

- Os dados de obras, filmes, séries e provedores de streaming são fornecidos por [The Movie Database (TMDB)](https://www.themoviedb.org/) e JustWatch.
- *Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB.*
- Projeto sob a licença de uso privado e educacional.
