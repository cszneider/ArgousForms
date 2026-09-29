'use client';
import { useI18n } from '../../components/i18n/i18n.js';
import {
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  LinearProgress,
  Chip,
} from '@mui/material';
import { Clock, ArrowUpRight } from 'lucide-react';
import { durationLabel } from './stage-timing.js';
export function TimingSummary({ analysis, doc, onSelect }) {
  const { t: tr, locale } = useI18n();
  const longest = analysis.stages.filter((r) =>
    analysis.longestIds.includes(r.stageId),
  );
  const first = longest[0];
  return (
    <div className="bottleneck-summary">
      <span className="bottleneck-icon">
        <Clock size={24} />
      </span>
      <div>
        <span className="timing-eyebrow">
          {analysis.partial
            ? tr('MAIOR TEMPO REGISTRADO')
            : tr('MAIOR TEMPO PENDENTE')}
        </span>
        <h3>
          {first
            ? longest
                .map(
                  (r) =>
                    doc.template.stages.find((s) => s.id === r.stageId)?.title,
                )
                .join(' · ')
            : tr('Ainda não há tempo registrado')}
        </h3>
        <p>
          {first
            ? `${longest.length > 1 ? '' + tr('Etapas empatadas.') + ' ' : ''}${durationLabel(first.totalMs, locale)} ${first.active ? tr('acumulados até agora') : tr('acumulados nesta etapa')}. ${analysis.partial ? tr('O histórico está incompleto; a comparação usa os períodos conhecidos.') : tr('Possível gargalo neste documento.')}`
            : tr('A contagem começa quando o documento chega à etapa.')}
        </p>
      </div>
      {first && (
        <Button
          onClick={() => onSelect(first.stageId)}
          endIcon={<ArrowUpRight size={16} />}
          size="small"
        >
          {tr('Ver registros')}
        </Button>
      )}
    </div>
  );
}
export function TimingComparison({ analysis, doc, selected, onSelect }) {
  const { t: tr, locale } = useI18n();
  const hasUnknown = analysis.stages.some((r) => r.unknownMs > 0);
  return (
    <section
      className="timing-comparison"
      aria-label={tr('Comparação do tempo pendente por etapa')}
    >
      <div className="timing-comparison-heading">
        <h3>{tr('Onde o documento passa mais tempo')}</h3>
        <p>
          {tr(
            'Tempo corrido de cada etapa, somando todas as passagens e correções. A etapa atual é atualizada a cada 30 segundos.',
          )}
        </p>
      </div>
      <TableContainer>
        <Table size="small" aria-label={tr('Tempo por etapa')}>
          <TableHead>
            <TableRow>
              <TableCell>{tr('ETAPA')}</TableCell>
              <TableCell>{tr('TEMPO PENDENTE')}</TableCell>
              <TableCell>{tr('ANTES DE ASSUMIR')}</TableCell>
              <TableCell>{tr('APÓS ASSUMIR')}</TableCell>
              {hasUnknown && <TableCell>{tr('SEM DETALHAMENTO')}</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {analysis.stages.map((r, i) => {
              const highest = analysis.longestIds.includes(r.stageId);
              const started = r.visits > 0 || r.active || r.partial;
              const share = analysis.totalMs
                ? (r.totalMs / analysis.totalMs) * 100
                : 0;
              return (
                <TableRow
                  key={r.stageId}
                  selected={selected === r.stageId}
                  className={highest ? 'timing-longest' : ''}
                >
                  <TableCell>
                    <button
                      className="timing-stage-link"
                      onClick={() => onSelect(r.stageId)}
                    >
                      {String(i + 1).padStart(2, '0')} ·{' '}
                      {doc.template.stages[i].title}
                    </button>
                    <div className="timing-row-meta">
                      {r.active ? (
                        <span className="timing-live">
                          {tr('Contando agora')}
                        </span>
                      ) : !started ? (
                        tr('Não iniciada')
                      ) : r.visits > 0 ? (
                        `${r.visits} ${r.visits === 1 ? tr('passagem') : tr('passagens')}`
                      ) : (
                        tr('Sem registro de entrada')
                      )}
                      {r.partial && (
                        <span> {' ' + tr('· Histórico parcial')}</span>
                      )}
                    </div>
                    {highest && (
                      <Chip
                        size="small"
                        className="timing-badge"
                        label={
                          analysis.longestIds.length > 1
                            ? tr('Maior tempo (empate)')
                            : tr('Maior tempo')
                        }
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <strong className="timing-total">
                      {started ? durationLabel(r.totalMs, locale) : '—'}
                    </strong>
                    <div className="timing-bar">
                      <LinearProgress
                        variant="determinate"
                        value={share}
                        aria-label={tr('{0}% do tempo registrado', {
                          0: share.toFixed(1),
                        })}
                      />
                      <small>{share.toFixed(0)}%</small>
                    </div>
                  </TableCell>
                  <TableCell>
                    {started ? durationLabel(r.waitingMs, locale) : '—'}
                  </TableCell>
                  <TableCell>
                    {started ? durationLabel(r.assignedMs, locale) : '—'}
                  </TableCell>
                  {hasUnknown && (
                    <TableCell>
                      {r.unknownMs ? durationLabel(r.unknownMs, locale) : '—'}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <p className="timing-explanation">
        {tr(
          '“Pendente” é o tempo entre a chegada e a saída da etapa, incluindo o período após alguém assumir. “Após assumir” não representa horas de trabalho efetivo.',
        )}
        {hasUnknown
          ? ' ' +
            tr(
              'Nos registros antigos sem horário de atribuição, o total aparece em “Sem detalhamento”.',
            ) +
            ''
          : ''}
        {analysis.partial
          ? ' ' +
            tr(
              'Períodos sem entrada ou saída identificável ficam fora do cálculo.',
            ) +
            ''
          : ''}
      </p>
    </section>
  );
}
