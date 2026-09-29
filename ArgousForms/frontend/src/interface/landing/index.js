'use client';
import { useI18n, LanguageSelect } from '../../components/i18n/i18n.js';
import {
  FileStack,
  ArrowRight,
  Check,
  GitBranch,
  Users,
  LayoutTemplate,
} from 'lucide-react';
import Plans from './plans.js';
import Testimonials from './testimonials.js';
import { ThemeToggle } from '../../components/theme/theme.js';
export default function Home() {
  const { t: tr } = useI18n();
  return (
    <main className="landing">
      <header className="landing-header">
        <div className="landing-nav">
          <a className="brand" href="/">
            <span className="brand-icon">
              <FileStack size={24} />
            </span>
            Argous<span>Docs</span>
          </a>
          <div className="landing-actions">
            <LanguageSelect />
            <ThemeToggle />
            <a className="primary" href="/login">
              <span className="landing-login-full">
                {tr('Entrar na plataforma')}
              </span>
              <span className="landing-login-short">{tr('Entrar')}</span>
              <ArrowRight size={17} />
            </a>
          </div>
        </div>
      </header>
      <section className="hero">
        <div>
          <span className="eyebrow">
            <span className="dot" /> {tr('DOCUMENTOS EM MOVIMENTO')}
          </span>
          <h1>
            {tr('De muitas mãos.')}
            <br />
            {tr('A um documento')}
            <br />
            <em>{tr('bem resolvido.')}</em>
          </h1>
          <p>
            {tr(
              'Conecte modelos, equipes e aprovações em um só lugar. Cada etapa com um responsável. Cada documento com uma história.',
            )}
          </p>
          <a className="primary" href="/login">
            {tr('Conhecer a plataforma')}
            <ArrowRight size={18} />
          </a>
          <div className="hero-note">
            <Check size={16} /> {' ' + tr('Modelos estruturados') + ' '}
            <Check size={16} /> {tr('Fluxos colaborativos')}
          </div>
        </div>
        <div className="hero-board">
          <div className="board-top">
            <span className="eyebrow">{tr('FLUXO DE ATENDIMENTO')}</span>
            <span className="pill">{tr('Em andamento')}</span>
          </div>
          <h3>{tr('Relatório de atendimento')}</h3>
          <p>{tr('Da solicitação à aprovação final.')}</p>
          {[
            ['01', tr('Identificação'), tr('Atendimento'), tr('Concluído')],
            [
              '02',
              tr('Avaliação técnica'),
              tr('Equipe técnica'),
              tr('Em preenchimento'),
            ],
            [
              '03',
              tr('Revisão e aprovação'),
              tr('Supervisão'),
              tr('Aguardando'),
            ],
          ].map((s, i) => (
            <div className={'flow-preview stage-' + i} key={s[0]}>
              <span className="step-number">
                {i === 0 ? <Check size={18} /> : s[0]}
              </span>
              <div>
                <strong>{s[1]}</strong>
                <small>{s[2]}</small>
              </div>
              <span className="stage-label">{s[3]}</span>
            </div>
          ))}
          <div className="board-bottom">
            <FileStack size={20} />
            <span>{tr('Um fluxo. Um documento completo.')}</span>
          </div>
        </div>
      </section>
      <section id="como-funciona" className="landing-features">
        <div>
          <span className="eyebrow">{tr('SIMPLES EM CADA ETAPA')}</span>
          <h2>
            {tr('O trabalho flui.')}
            <br />
            {tr('O documento ganha forma.')}
          </h2>
        </div>
        {[
          [
            LayoutTemplate,
            '01',
            tr('Estruture uma vez'),
            tr(
              'Organize seções e campos em modelos que sua equipe pode reutilizar.',
            ),
          ],
          [
            Users,
            '02',
            tr('Conecte as pessoas'),
            tr('Defina quem preenche e quem aprova, na ordem que faz sentido.'),
          ],
          [
            GitBranch,
            '03',
            tr('Acompanhe até o fim'),
            tr(
              'Veja o andamento e reúna as contribuições em um documento final.',
            ),
          ],
        ].map(([Icon, n, t, d]) => (
          <article key={n}>
            <span className="feature-icon">
              <Icon size={23} />
            </span>
            <small>{n}</small>
            <h3>{t}</h3>
            <p>{d}</p>
          </article>
        ))}
      </section>
      <Plans />
      <Testimonials />
      <footer>
        <a className="brand" href="/">
          Argous<span>Docs</span>
        </a>
        <span>{tr('Organização em cada documento.')}</span>
        <span>© {new Date().getFullYear()} ArgousDocs</span>
      </footer>
    </main>
  );
}
