'use client';
import { useI18n } from '../../components/i18n/i18n.js';
import { useId, useState, useEffect } from 'react';
import { Button } from '@mui/material';
import {
  ArrowDown,
  Check,
  FilePenLine,
  GitBranch,
  ShieldCheck,
  RotateCcw,
  Clock,
  UserRound,
} from 'lucide-react';
import { processEvents, stageAppearance } from './process-history.js';
import { stageTimings, durationLabel } from './stage-timing.js';
import { TimingSummary, TimingComparison } from './stage-timing-panel.js';
export function ProcessFlow({ doc, groups, people, selected, onSelect }) {
  const { t: tr, locale, system } = useI18n();
  const marker = useId().replace(/:/g, '');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const analysis = stageTimings(doc, Math.max(now, Date.now()));
  const events = processEvents(doc);
  const stages = doc.template.stages;
  const returns = events.filter((e) => e.kind === 'returned');
  const paths = returns
    .filter((e) => e.stageId && e.toStageId)
    .reduce((list, e) => {
      const from = stages.findIndex((s) => s.id === e.stageId),
        to = stages.findIndex((s) => s.id === e.toStageId);
      if (from < 0 || to < 0 || from === to) return list;
      const found = list.find((x) => x.from === from && x.to === to);
      if (found) found.count++;
      else list.push({ from, to, count: 1 });
      return list;
    }, []);
  const width = stages.length * 284 + 132,
    height = paths.length ? 326 + paths.length * 40 : 286;
  const shown = selected
    ? events.filter((e) => e.stageId === selected || e.toStageId === selected)
    : events;
  const selectedStage = stages.find((s) => s.id === selected);
  return (
    <section
      className="process-history"
      aria-label={tr('Fluxograma e histórico do documento')}
    >
      <div className="process-heading">
        <div>
          <h2>{tr('O caminho deste documento')}</h2>
          <p>
            {tr(
              'Selecione uma etapa para ver quem participou e o que aconteceu.',
            )}
          </p>
        </div>
        <div className="flow-legend">
          <span>
            <i className="done" />
            {tr('Concluída')}
          </span>
          <span>
            <i className="current" />
            {tr('Atual')}
          </span>
          <span>
            <i className="pending" />
            {tr('Aguardando')}
          </span>
          <span>
            <i className="returned" />
            {tr('Devolução')}
          </span>
        </div>
      </div>
      <TimingSummary analysis={analysis} doc={doc} onSelect={onSelect} />
      <div
        className="process-scroll"
        role="region"
        aria-label={tr(
          'Etapas do processo. Role horizontalmente para ver fluxos longos.',
        )}
        tabIndex={0}
      >
        <div className="process-canvas" style={{ width, height }}>
          <svg
            className="process-connectors"
            viewBox={`0 0 ${width} ${height}`}
            aria-hidden="true"
          >
            <defs>
              <marker
                id={marker + '-arrow'}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#9aacae" />
              </marker>
              <marker
                id={marker + '-return'}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#b77020" />
              </marker>
            </defs>
            <path
              d="M 38 163 H 75"
              stroke="#9aacae"
              strokeWidth="2"
              markerEnd={`url(#${marker}-arrow)`}
            />
            {stages.map((s, i) => (
              <path
                key={s.id}
                d={`M ${80 + i * 284 + 228} 163 H ${i === stages.length - 1 ? width - 38 : 80 + (i + 1) * 284 - 6}`}
                stroke="#9aacae"
                strokeWidth="2"
                strokeDasharray={
                  doc.status !== 'done' && i >= doc.stageIndex
                    ? '5 5'
                    : undefined
                }
                markerEnd={`url(#${marker}-arrow)`}
              />
            ))}
            {paths.map((r, i) => {
              const y = 300 + i * 40,
                from = 194 + r.from * 284,
                to = 194 + r.to * 284;
              return (
                <g key={r.from + '-' + r.to}>
                  <path
                    d={`M ${from} 248 V ${y - 12} Q ${from} ${y} ${from - 12} ${y} H ${to + 12} Q ${to} ${y} ${to} ${y - 12} V 251`}
                    fill="none"
                    stroke="#b77020"
                    strokeWidth="2"
                    markerEnd={`url(#${marker}-return)`}
                  />
                  <rect
                    x={(from + to) / 2 - 65}
                    y={y - 11}
                    width="130"
                    height="22"
                    rx="11"
                    fill="var(--flow-return-bg)"
                  />
                  <text
                    x={(from + to) / 2}
                    y={y + 4}
                    textAnchor="middle"
                    fill="var(--flow-return-text)"
                    fontSize="12"
                  >
                    {r.count === 1
                      ? tr('Devolvido para ajuste')
                      : tr('{0} devoluções', { 0: r.count })}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="process-endpoint start">
            <span />
            <small>{tr('Início')}</small>
          </div>
          <div
            className={
              'process-endpoint end ' +
              (doc.status === 'done' ? 'finished' : '')
            }
          >
            <span>{doc.status === 'done' && <Check size={12} />}</span>
            <small>{tr('Fim')}</small>
          </div>
          {stages.map((stage, i) => {
            const appearance = stageAppearance(doc, i),
              current = doc.status !== 'done' && i === doc.stageIndex;
            const completed = events
              .filter((e) => e.stageId === stage.id && e.kind === 'completed')
              .at(-1);
            const who = current
              ? people.find((p) => p.id === doc.assignee)?.name
              : appearance.tone === 'done'
                ? completed?.actor
                : undefined;
            return (
              <div
                className="process-node-wrap"
                key={stage.id}
                style={{ left: 80 + i * 284 }}
              >
                <span
                  className={
                    'node-duration ' +
                    (analysis.longestIds.includes(stage.id) ? 'longest' : '')
                  }
                  title={tr('Tempo total pendente nesta etapa')}
                >
                  <Clock size={13} />
                  {analysis.stages[i].visits
                    ? durationLabel(analysis.stages[i].totalMs, locale)
                    : analysis.stages[i].partial
                      ? tr('Histórico parcial')
                      : tr('Não iniciada')}
                  {analysis.longestIds.includes(stage.id) && (
                    <strong>{tr('Maior tempo')}</strong>
                  )}
                </span>
                <button
                  className={`process-node ${appearance.tone} ${selected === stage.id ? 'selected' : ''}`}
                  aria-pressed={selected === stage.id}
                  aria-label={tr('{0}. {1}. {2}. Ver registros.', {
                    0: i + 1,
                    1: stage.title,
                    2: tr(appearance.label),
                  })}
                  onClick={() =>
                    onSelect(selected === stage.id ? null : stage.id)
                  }
                >
                  <span className="process-node-top">
                    <span className={'node-kind ' + stage.kind}>
                      {appearance.tone === 'done' ? (
                        <Check size={19} />
                      ) : stage.kind === 'approve' ? (
                        <ShieldCheck size={19} />
                      ) : (
                        <FilePenLine size={19} />
                      )}
                    </span>
                    <small>
                      {tr('ETAPA') + ' '}
                      {String(i + 1).padStart(2, '0')}
                    </small>
                  </span>
                  <strong>{stage.title}</strong>
                  <span className="process-node-group">
                    {groups.find((g) => g.id === stage.groupId)?.name ||
                      tr('Grupo indisponível')}
                  </span>
                  <span className="process-node-status">
                    {tr(appearance.label)}
                  </span>
                </button>
                {who && (
                  <span className="node-person">
                    <UserRound size={13} />
                    {who}
                  </span>
                )}
                <ArrowDown className="mobile-flow-arrow" size={22} />
              </div>
            );
          })}
        </div>
      </div>
      {returns.length > 0 && (
        <div className="return-summary">
          <RotateCcw size={17} />
          <span>
            {returns.length}{' '}
            {returns.length === 1
              ? tr('devolução registrada')
              : tr('devoluções registradas')}
            {tr('. As devoluções preservam as contribuições anteriores.')}
          </span>
        </div>
      )}
      <TimingComparison
        analysis={analysis}
        doc={doc}
        selected={selected}
        onSelect={onSelect}
      />
      <div className="process-records">
        <div className="process-records-heading">
          <div>
            <h3>
              {selectedStage
                ? selectedStage.title
                : tr('Registros de todo o fluxo')}
            </h3>
            <p>
              {selectedStage
                ? tr(
                    'Ações realizadas nesta etapa e movimentações de entrada ou saída.',
                  )
                : tr(
                    'Da criação até a última movimentação, em ordem cronológica.',
                  )}
            </p>
          </div>
          {selected && (
            <Button size="small" onClick={() => onSelect(null)}>
              {tr('Ver todos os registros')}
            </Button>
          )}
        </div>
        {shown.length ? (
          <ol className="process-event-list">
            {shown.map((e) => (
              <li
                key={e.id}
                className={e.kind === 'returned' ? 'returned' : ''}
              >
                <span className="event-symbol">
                  {e.kind === 'returned' ? (
                    <RotateCcw size={17} />
                  ) : e.kind === 'completed' || e.kind === 'finished' ? (
                    <Check size={17} />
                  ) : (
                    <Clock size={17} />
                  )}
                </span>
                <div>
                  <p>{system(e.message)}</p>
                  {e.kind === 'returned' && e.stageId && e.toStageId && (
                    <span className="return-route">
                      {stages.find((s) => s.id === e.stageId)?.title} →{' '}
                      {stages.find((s) => s.id === e.toStageId)?.title}
                    </span>
                  )}
                  <small>
                    {e.actor} ·{' '}
                    <time dateTime={e.at}>
                      {new Date(e.at).toLocaleString(locale, {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </time>
                  </small>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="empty-state compact">
            <GitBranch size={26} />
            <h3>{tr('Esta etapa ainda não tem registros')}</h3>
            <p>
              {tr(
                'As contribuições aparecerão aqui quando a equipe iniciar o trabalho.',
              )}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
