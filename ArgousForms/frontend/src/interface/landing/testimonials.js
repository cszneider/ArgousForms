'use client';
import { Quote } from 'lucide-react';
import { useI18n } from '../../components/i18n/i18n.js';
const examples = [
  [
    'Organização',
    'Ter as informações reunidas em um documento facilita acompanhar o trabalho da equipe.',
    'Equipe de operações',
  ],
  [
    'Colaboração',
    'Cada pessoa sabe em qual etapa participar e o que precisa preencher.',
    'Equipe administrativa',
  ],
  [
    'Visibilidade',
    'Visualizar o andamento das etapas ajuda a entender o que ainda está pendente.',
    'Gestão de processos',
  ],
];
export default function Testimonials() {
  const { t } = useI18n();
  return (
    <section
      className="landing-testimonials"
      aria-labelledby="testimonials-title"
    >
      <div className="testimonials-heading">
        <span className="eyebrow">{t('Opiniões dos clientes')}</span>
        <h2 id="testimonials-title">
          {t('O trabalho visto por quem participa.')}
        </h2>
        <p>
          {t(
            'Depoimentos ilustrativos. Este espaço receberá opiniões reais de clientes.',
          )}
        </p>
      </div>
      <div className="testimonials-grid">
        {examples.map(([topic, quote, team], index) => (
          <figure className="testimonial-card" key={topic}>
            <div className="testimonial-top">
              <Quote size={27} aria-hidden="true" />
              <span>{t('Exemplo ilustrativo')}</span>
            </div>
            <h3>{t(topic)}</h3>
            <blockquote>{t(quote)}</blockquote>
            <figcaption>
              <span className="testimonial-avatar" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <strong>{t(team)}</strong>
                <span>{t('Perfil de exemplo')}</span>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
