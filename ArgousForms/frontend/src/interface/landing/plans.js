'use client';
import { useI18n } from '../../components/i18n/i18n.js';
import {
  ArrowRight,
  Clock3,
  FileText,
  Zap,
  Gem,
  Building2,
} from 'lucide-react';
const plans = [
  ['Básico', 'Para começar a organizar seus documentos.', FileText, '39'],
  ['Pro', 'Para equipes que trabalham juntas todos os dias.', Zap, '59'],
  [
    'Premium',
    'Para operações com maior volume de documentos e processos.',
    Gem,
    '89',
  ],
  [
    'Empresarial',
    'Para empresas que precisam definir uma operação com várias equipes.',
    Building2,
    '119',
  ],
];
export default function Plans() {
  const { t } = useI18n();
  return (
    <section
      id="planos"
      className="landing-plans"
      aria-labelledby="plans-title"
    >
      <div className="plans-heading">
        <span className="eyebrow">{t('Planos')}</span>
        <h2 id="plans-title">{t('Planos para sua equipe')}</h2>
        <p>{t('Conheça a plataforma antes de escolher seu plano.')}</p>
      </div>
      <div className="plans-grid">
        {plans.map(([name, description, Icon, price]) => (
          <article
            className={
              'plan-card' + (name === 'Premium' ? ' plan-card-accent' : '')
            }
            key={name}
          >
            {name === 'Premium' && (
              <span className="plan-popular-badge">{t('Mais usado')}</span>
            )}
            <span className="plan-icon">
              <Icon size={23} aria-hidden="true" />
            </span>
            <h3>{t(name)}</h3>
            <p className="plan-description">{t(description)}</p>
            <p className="plan-price" aria-label={`R$ ${price},90`}>
              <span>R$</span> {price}
              <span className="plan-cents">,90</span>
            </p>
            <p className="plan-terms">
              {t('Condições e limites em definição.')}
            </p>
            <a className="plan-link" href="/login">
              {t('Conhecer a plataforma')}
              <ArrowRight size={17} aria-hidden="true" />
            </a>
          </article>
        ))}
      </div>
      <div className="plan-trial trial-banner">
        <div>
          <span className="eyebrow">
            <Clock3 size={20} aria-hidden="true" />
            {t('Avaliação gratuita')}
          </span>
          <h3>
            {t('Período grátis')}: {t('Duração a definir')}
          </h3>
          <p>
            {t(
              'Crie seus modelos, cadastre sua equipe e experimente um fluxo completo.',
            )}
          </p>
        </div>
        <a className="primary" href="/login">
          {t('Explorar a demonstração')}
          <ArrowRight size={17} />
        </a>
      </div>
      <p className="plans-note">
        {t(
          'Os planos e as condições comerciais estão em preparação. A demonstração atual não realiza cobranças nem inicia uma assinatura.',
        )}
      </p>
    </section>
  );
}
