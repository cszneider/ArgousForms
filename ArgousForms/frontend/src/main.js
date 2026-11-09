import { Suspense, createElement, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { LanguageProvider } from './components/i18n/i18n.js';
import { AppTheme } from './components/theme/theme.js';
import './css/globals.css';
import './css/editor.css';

const pages = {
  '/': lazy(() => import('./interface/landing/index.js')),
  '/app': lazy(() => import('./interface/argous/workspace.js')),
  '/cadastro': lazy(() => import('./interface/cadastro/index.js')),
  '/convite': lazy(() => import('./interface/convite/index.js')),
  '/inicio': lazy(() => import('./interface/inicio/index.js')),
  '/login': lazy(() => import('./interface/login/index.js')),
  '/plataforma': lazy(() => import('./interface/plataforma/index.js')),
};

const path = window.location.pathname.replace(/^\/ArgousForms(?=\/|$)/, '').replace(/\/$/, '') || '/';
const Page = pages[path] || pages['/'];

createRoot(document.getElementById('root')).render(
  createElement(LanguageProvider, null,
    createElement(AppTheme, null,
      createElement(Suspense, { fallback: createElement('p', null, 'Carregando...') }, createElement(Page)),
    ),
  ),
);
