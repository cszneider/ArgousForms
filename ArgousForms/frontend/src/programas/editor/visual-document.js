/* oxlint-disable next/no-img-element -- User-supplied data URL images must remain local and unoptimized. */
'use client';
import { useSyncExternalStore } from 'react';
import { cleanHtml, filledHtml } from './content.js';
import { PdfModel, PdfDownload } from './pdf-model.js';
import { useI18n } from '../../components/i18n/i18n.js';
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
export function RichContent({ html }) {
  const mounted = useSyncExternalStore(
    subscribe,
    clientSnapshot,
    serverSnapshot,
  );
  return (
    <div
      className="rich-content"
      dangerouslySetInnerHTML={{ __html: mounted ? cleanHtml(html) : '' }}
    />
  );
}
export function VisualDocument({
  template,
  values = {},
  preview = false,
  name = 'documento',
}) {
  const { t } = useI18n();
  const mounted = useSyncExternalStore(
    subscribe,
    clientSnapshot,
    serverSnapshot,
  );
  if (!mounted) return null;
  const layout = template.layout,
    fields = template.sections.flatMap((s) => s.fields);
  if (layout.kind === 'pdf')
    return (
      <div>
        <PdfDownload {...{ template, values, name }} />
        <PdfModel {...{ layout, fields, values, preview }} />
      </div>
    );
  const html = [layout.header, layout.body, layout.footer].join('');
  const remaining = fields.filter(
    (field) => !html.includes(`data-field-id="${field.id}"`),
  );
  return (
    <article className="authored-paper">
      <table className="authored-page-table">
        <thead>
          <tr>
            <td aria-label={t('Cabeçalho')}>
              <div
                className="authored-header rich-content"
                dangerouslySetInnerHTML={{
                  __html: filledHtml(layout.header, fields, values, preview),
                }}
              />
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <div
                className="authored-body rich-content"
                dangerouslySetInnerHTML={{
                  __html: filledHtml(layout.body, fields, values, preview),
                }}
              />
              {!!remaining.length && (
                <section className="authored-fields">
                  {remaining.map((field) => (
                    <div key={field.id}>
                      <strong>{field.label}</strong>
                      {field.type === 'richtext' ? (
                        <div
                          className="rich-content"
                          dangerouslySetInnerHTML={{
                            __html: filledHtml(
                              values[field.id] || '',
                              [],
                              {},
                              false,
                            ),
                          }}
                        />
                      ) : field.type === 'signature' &&
                        values[field.id]?.data ? (
                        <img
                          width="180"
                          src={values[field.id].data}
                          alt={field.label}
                        />
                      ) : (
                        <p>
                          {typeof values[field.id] === 'string'
                            ? values[field.id]
                            : values[field.id]?.name ||
                              (preview
                                ? t('Conteúdo preenchido pela equipe')
                                : '')}
                        </p>
                      )}
                    </div>
                  ))}
                </section>
              )}
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td aria-label={t('Rodapé')}>
              <div
                className="authored-footer rich-content"
                dangerouslySetInnerHTML={{
                  __html: filledHtml(layout.footer, fields, values, preview),
                }}
              />
            </td>
          </tr>
        </tfoot>
      </table>
    </article>
  );
}
