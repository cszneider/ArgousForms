'use client';
import { Box } from '@mui/material';
import { FileStack, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useI18n, LanguageSelect } from '../i18n/i18n.js';
import { ThemeToggle } from '../theme/theme.js';

export default function AccessLayout({
  children,
  backHref = '/',
  backLabel = 'Voltar ao início',
}) {
  const { t: tr } = useI18n();
  return (
    <main className="login-page">
      <section className="login-story">
        <Box component="a" href="/" className="brand">
          <span className="brand-icon">
            <FileStack size={24} />
          </span>
          Argous<span>Docs</span>
        </Box>
        <div>
          <span className="eyebrow">{tr('CADA ETAPA CONTA')}</span>
          <h1>
            {tr('Seu próximo')}
            <br />
            {tr('documento começa')}
            <br />
            {tr('com uma boa conexão.')}
          </h1>
          <p>
            {tr('Modelos organizados. Equipes alinhadas.')}
            <br />
            {tr('Tudo no mesmo fluxo.')}
          </p>
          <div className="login-checks">
            {[
              'Responsabilidades bem definidas',
              'Histórico de cada contribuição',
              'Um documento final, completo',
            ].map((text) => (
              <p key={text}>
                <CheckCircle2 size={18} />
                {tr(text)}
              </p>
            ))}
          </div>
        </div>
        <small>{tr('ArgousDocs · Documentos em movimento')}</small>
      </section>
      <section className="login-form">
        <div className="login-tools access-tools">
          <Box component="a" className="back-link" href={backHref}>
            <ArrowLeft size={16} />
            {tr(backLabel)}
          </Box>
          <div className="access-preferences">
            <LanguageSelect />
            <ThemeToggle />
          </div>
        </div>
        <div>{children}</div>
      </section>
    </main>
  );
}
