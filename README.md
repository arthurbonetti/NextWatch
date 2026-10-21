# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

### Requirements

- Node.js 24.22.0 (the version is pinned in `.nvmrc`)
- npm, included with Node.js

### Install and start

```bash
npm ci
npm start
```

To run the web version:

```bash
npm run web
```

If Expo Go on Android cannot connect over Wi-Fi, use the tunnel script instead:

```bash
npm run start:tunnel
```

To run on an Android phone, install [Expo Go](https://expo.dev/go), keep the phone
and computer on the same network, start the app with `npm start`, and scan the
QR code. If the network blocks device discovery, run `npm start -- --tunnel`.

An Android emulator requires Android Studio, JDK 17, and Android SDK Platform 36.
The iOS Simulator is only available on macOS.

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Login prototype

The login and account creation screens are a temporary front-end flow while the
project has no backend. Any valid e-mail and password with at least 6 characters
can start a demo session; new accounts only exist in memory and are cleared when
the app restarts. Do not use real or sensitive passwords.

## Catálogo automático

O projeto consulta o catálogo e a disponibilidade de filmes e séries da API do
[TMDB](https://www.themoviedb.org/settings/api) no Brasil, filtrando pelos
serviços ativos na conta. A atualização acontece ao abrir o app, ao alterar
assinaturas e pelo botão de atualizar em Explorar. Títulos japoneses de animação
são identificados como animes. O IMDb não oferece uma API pública de catálogo
para essa integração; as notas dos resultados automáticos são da comunidade
TMDB, não do IMDb.
O catálogo carrega inicialmente uma página de filmes e uma de séries; use
**Carregar mais títulos** em Explorar para buscar páginas adicionais. A tela
informa quantos títulos já foram carregados em relação ao total encontrado.
O sorteio escolhe imediatamente entre os títulos já carregados. Uma página
adicional é carregada em segundo plano após cada sorteio, sem baixar todo o
catálogo de uma vez nem bloquear o uso do app. Em Explorar, use **Carregar mais
títulos** para navegar por todas as páginas disponíveis.
A busca em Explorar consulta o TMDB depois de uma breve pausa ao digitar, então
também encontra obras que ainda não foram carregadas localmente. Os resultados
remotos são pesquisados no catálogo geral do TMDB; a disponibilidade exata nos
serviços ativos pode variar.

1. Crie uma conta TMDB e solicite o token **API Read Access Token** nas
   configurações da API.
2. Copie `.env.example` para `.env.local` e preencha
   `EXPO_PUBLIC_TMDB_API_KEY` com o token.
3. Reinicie o Expo com `npm start` e toque em atualizar na aba Explorar.

Variáveis `EXPO_PUBLIC_` são incluídas no aplicativo e podem ser inspecionadas.
Use apenas para desenvolvimento; para distribuir o app, mova as chamadas da API
para um backend que proteja as credenciais. Se a chave não estiver configurada
ou a API estiver indisponível, o catálogo fixo existente continua disponível.
Os dados de disponibilidade de streaming são fornecidos pela JustWatch via
TMDB e devem manter a atribuição exigida pelo TMDB.

## Gerar APK Android

O perfil `preview` do EAS está configurado para gerar um APK instalável. Para
usar a compilação na nuvem:

1. Crie uma conta em [expo.dev](https://expo.dev/signup) e conecte o projeto uma
   única vez com `npx eas-cli@latest init`.
2. No painel do projeto Expo, abra **Project settings → Environment variables**
   e crie `EXPO_PUBLIC_TMDB_API_KEY` no ambiente **preview**, com visibilidade
   **Sensitive**. O arquivo local `.env.local` não é enviado para os
   compiladores na nuvem.
3. Entre no EAS com `npx eas-cli@latest login` e gere o APK:

   ```bash
   npx eas-cli@latest build --platform android --profile preview
   ```

Ao terminar, abra o link do build informado pelo EAS para baixar e instalar o
APK no dispositivo Android.

`EXPO_PUBLIC_TMDB_API_KEY` é incorporada ao aplicativo e pode ser extraída do
APK. A visibilidade Sensitive protege o valor nos registros e no painel, mas
não o torna secreto dentro do app. Para distribuir a outras pessoas, mova as
chamadas ao TMDB para um backend e não reutilize um token que já tenha sido
exposto.

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
