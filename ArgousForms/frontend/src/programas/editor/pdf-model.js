/* oxlint-disable next/no-img-element -- User-supplied data URL images must remain local and unoptimized. */
'use client';
import { useEffect, useRef, useState } from 'react';
import { Alert, Button, LinearProgress } from '@mui/material';
import { useI18n } from '../../components/i18n/i18n.js';
import { readAsset, downloadBlob } from './assets.js';
import { openPdf } from './import-model.js';
import { fieldText, PDF_FIELD_LABELS } from './layout-rules.js';

function PdfPage({
  pdf,
  index,
  page,
  placements,
  fields,
  values,
  preview,
  selected,
  onSelect,
  onPlace,
}) {
  const canvas = useRef(null),
    [error, setError] = useState('');
  const { t } = useI18n();
  useEffect(() => {
    let stopped = false,
      task;
    (async () => {
      const source = await pdf.getPage(index + 1);
      if (stopped) return;
      const view = source.getViewport({
        scale: Math.min(1.5, 1400 / Math.max(page.width, page.height)),
      });
      canvas.current.width = view.width;
      canvas.current.height = view.height;
      task = source.render({
        canvasContext: canvas.current.getContext('2d'),
        viewport: view,
      });
      await task.promise;
    })().catch((e) => {
      if (!stopped) setError(e.message);
    });
    return () => {
      stopped = true;
      task?.cancel();
    };
  }, [pdf, index, page.width, page.height]);
  return (
    <div className="pdf-sheet-wrap">
      <small className="no-print">
        {t('Página')} {index + 1}
      </small>
      {error && <Alert severity="error">{error}</Alert>}
      <div
        className={'pdf-sheet ' + (onPlace ? 'pdf-placement-surface' : '')}
        style={{ aspectRatio: page.width + '/' + page.height }}
      >
        <canvas ref={canvas} aria-label={t('Página') + ' ' + (index + 1)} />
        {onPlace && (
          <button
            type="button"
            className="pdf-placement-target"
            aria-label={t(
              'Posicionar campo: pressione Enter no centro da página e ajuste as coordenadas.',
            )}
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              onPlace(
                index,
                event.detail === 0
                  ? 0.5
                  : (event.clientX - rect.left) / rect.width,
                event.detail === 0
                  ? 0.5
                  : (event.clientY - rect.top) / rect.height,
              );
            }}
          />
        )}
        {placements.map((item) => {
          const field = fields.find((f) => f.id === item.fieldId),
            value = values[item.fieldId];
          const style = {
            left: `${item.x * 100}%`,
            top: `${item.y * 100}%`,
            width: `${item.width * 100}%`,
            height: `${item.height * 100}%`,
            fontSize: `${((item.fontSize || 12) / page.width) * 100}cqw`,
          };
          const content =
            field?.type === 'signature' && value?.data ? (
              <img src={value.data} alt={field.label} />
            ) : (
              fieldText(field, value) ||
              (preview ? `⟦${field?.label || '?'}⟧` : '')
            );
          return onSelect ? (
            <button
              type="button"
              key={item.id}
              className={
                'pdf-field editing ' + (selected === item.id ? 'selected' : '')
              }
              style={style}
              title={`${field?.label || '?'} · ${t(PDF_FIELD_LABELS[field?.type] || 'Campo')} · ${t(field?.required ? 'Obrigatório' : 'Opcional')}`}
              aria-label={`${field?.label || '?'} · ${t(PDF_FIELD_LABELS[field?.type] || 'Campo')} · ${t(field?.required ? 'Obrigatório' : 'Opcional')}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(item.id);
              }}
            >
              <span className="pdf-marker-label">
                {field?.label || '?'}
                {field?.required ? ' *' : ''}
              </span>
              <span className="pdf-marker-meta">
                {t(PDF_FIELD_LABELS[field?.type] || 'Campo')} ·{' '}
                {t(field?.required ? 'Obrigatório' : 'Opcional')}
              </span>
            </button>
          ) : (
            <div key={item.id} className="pdf-field" style={style}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
function PdfModelContent({
  layout,
  fields,
  values = {},
  preview = false,
  selected,
  onSelect,
  onPlace,
}) {
  const [pdf, setPdf] = useState(null),
    [error, setError] = useState('');
  const { system } = useI18n();
  useEffect(() => {
    let stopped = false,
      loaded;
    (async () => {
      const file = await readAsset(layout.assetId);
      loaded = await openPdf(await file.arrayBuffer());
      if (stopped) {
        await loaded.destroy();
        return;
      }
      setPdf(loaded);
    })().catch((e) => {
      if (!stopped) setError(e.message);
    });
    return () => {
      stopped = true;
      void loaded?.destroy();
    };
  }, [layout.assetId]);
  if (error) return <Alert severity="error">{system(error)}</Alert>;
  if (!pdf) return <LinearProgress />;
  return (
    <div className="pdf-model">
      {layout.pages.map((page, index) => (
        <PdfPage
          key={index}
          {...{
            pdf,
            page,
            index,
            fields,
            values,
            preview,
            selected,
            onSelect,
            onPlace,
          }}
          placements={(layout.placements || []).filter((p) => p.page === index)}
        />
      ))}
    </div>
  );
}
export function PdfModel(props) {
  return <PdfModelContent key={props.layout.assetId} {...props} />;
}
export function PdfDownload({ template, values = {}, name = 'documento' }) {
  const { t, system } = useI18n();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <div className="no-print">
      <Button
        disabled={busy}
        variant="outlined"
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            const { exportPdf } = await import('./pdf-export.js');
            downloadBlob(await exportPdf(template, values), `${name}.pdf`);
          } catch (e) {
            setError(system(e.message));
          } finally {
            setBusy(false);
          }
        }}
      >
        {t(busy ? 'Carregando…' : 'Baixar PDF preenchido')}
      </Button>
      {error && <Alert severity="error">{error}</Alert>}
    </div>
  );
}
