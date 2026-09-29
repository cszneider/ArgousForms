import { LanguageProvider } from '../components/i18n/i18n.js';
import '../css/globals.css';
import '../css/editor.css';
import { AppTheme } from '../components/theme/theme.js';
export const metadata = {
  title: 'ArgousDocs — Documentos em movimento',
  description:
    'Crie modelos estruturados, conecte equipes e acompanhe cada documento até a aprovação final.',
  icons: { icon: '/favicon.svg' },
};
export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var saved=localStorage.getItem('argousdocs:theme');document.documentElement.dataset.theme=saved==='light'||saved==='dark'?saved:window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}catch(e){document.documentElement.dataset.theme='light';}})();`,
          }}
        />
      </head>
      <body>
        <LanguageProvider>
          <AppTheme>{children}</AppTheme>
        </LanguageProvider>
      </body>
    </html>
  );
}
