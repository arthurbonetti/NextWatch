import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const WEB_FOCUS_STYLES = `
*:focus:not(:focus-visible) {
  outline: none !important;
}
input:focus,
textarea:focus {
  outline: none !important;
}
button:focus-visible,
a:focus-visible,
[role="button"]:focus-visible,
[role="tab"]:focus-visible,
[role="radio"]:focus-visible,
[role="checkbox"]:focus-visible,
[role="switch"]:focus-visible {
  outline: 2px solid var(--nw-focus-ring, #F2AE30);
  outline-offset: 2px;
}
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <ScrollViewStyleReset />
        <style id="nextwatch-web-focus-styles" dangerouslySetInnerHTML={{ __html: WEB_FOCUS_STYLES }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
