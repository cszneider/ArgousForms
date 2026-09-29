'use client';
import { useState } from 'react';
import {
  Button,
  Alert,
  TextField,
  MenuItem,
  Chip,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import { useI18n } from '../../components/i18n/i18n.js';
import { createId } from '../../utils/uid.js';
import { RichEditor } from './rich-editor.js';
import { importModel } from './import-model.js';
import { PdfModel } from './pdf-model.js';
import { readAsset, downloadBlob } from './assets.js';
import { PDF_FIELD_TYPES, PDF_FIELD_LABELS } from './layout-rules.js';

export function ModelDesigner({
  template,
  onChange,
  onBusy,
  groups = [],
  people = [],
}) {
  const { t, system } = useI18n();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [selected, setSelected] = useState(null),
    [fieldId, setFieldId] = useState('');
  const layout = template.layout,
    fields = template.sections.flatMap((s) => s.fields),
    place = layout?.placements?.find((p) => p.id === selected);
  const activeField = fields.find((f) => f.id === (place?.fieldId || fieldId));
  const updateField = (patch) =>
    onChange({
      ...template,
      sections: template.sections.map((section) => ({
        ...section,
        fields: section.fields.map((field) =>
          field.id === activeField.id ? { ...field, ...patch } : field,
        ),
      })),
    });
  const sharedField =
    activeField &&
    (layout.placements || []).filter((item) => item.fieldId === activeField.id)
      .length > 1;
  const update = (patch) =>
    onChange({ ...template, layout: { ...layout, ...patch } });
  const changeSource = () =>
    !layout ||
    window.confirm(
      t('Substituir o conteúdo visual? Os campos e o fluxo serão mantidos.'),
    );
  const patchPlacement = (patch) =>
    update({
      placements: layout.placements.map((p) =>
        p.id === selected ? { ...p, ...patch } : p,
      ),
    });
  async function importFile(file) {
    if (!file || !changeSource()) return;
    setBusy(true);
    onBusy(true);
    setError('');
    try {
      const next = await importModel(file);
      onChange({
        ...template,
        name: template.name || file.name.replace(/\.[^.]+$/, ''),
        layout: next,
      });
      setSelected(null);
    } catch (e) {
      setError(system(e.message));
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <div className="model-designer">
      <Alert severity="info">
        <strong>
          {t('Prefira PDF para preservar a aparência do modelo.')}
        </strong>
        <br />
        {t(
          'O PDF mantém o layout original. O Word permite editar o conteúdo, mas pode apresentar diferenças de formatação.',
        )}
      </Alert>
      <div className="designer-actions">
        <Button
          disabled={busy}
          variant="outlined"
          onClick={() => {
            if (changeSource())
              onChange({
                ...template,
                layout: {
                  kind: 'rich',
                  body: '<p></p>',
                  header: '',
                  footer: '',
                },
              });
          }}
        >
          {t('Criar no editor')}
        </Button>
        <Button disabled={busy} variant="contained" component="label">
          {t(busy ? 'Carregando…' : 'Importar PDF ou Word')}
          <input
            hidden
            type="file"
            accept=".pdf,.docx"
            onChange={(e) => {
              void importFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </Button>
        {layout?.assetId && (
          <Button
            onClick={async () => {
              try {
                downloadBlob(await readAsset(layout.assetId), layout.name);
              } catch (e) {
                setError(system(e.message));
              }
            }}
          >
            {t('Baixar original')}
          </Button>
        )}
        {layout?.name && <Chip label={layout.name} />}
      </div>
      <p className="muted">
        {t(
          'Arquivos de até 20 MB e PDFs de até 50 páginas. Os originais ficam neste navegador.',
        )}
      </p>
      {error && (
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {layout?.importedWord && (
        <Alert severity="warning">
          {t(
            'Revise o Word importado: fontes, paginação, imagens, cabeçalhos e rodapés podem mudar ou não ser importados. Complete essas áreas no editor.',
          )}
        </Alert>
      )}
      {layout?.kind === 'rich' && (
        <div className="design-a4">
          <RichEditor
            label={t('Cabeçalho')}
            value={layout.header}
            fields={fields}
            onChange={(header) => update({ header })}
            disabled={busy}
          />
          <RichEditor
            label={t('Conteúdo')}
            value={layout.body}
            fields={fields}
            onChange={(body) => update({ body })}
            disabled={busy}
          />
          <RichEditor
            label={t('Rodapé')}
            value={layout.footer}
            fields={fields}
            onChange={(footer) => update({ footer })}
            disabled={busy}
          />
          <p className="muted">
            {t(
              'Use Inserir campo para ligar o texto às seções do fluxo. Cabeçalho e rodapé se repetem na impressão.',
            )}
          </p>
        </div>
      )}
      {layout?.kind === 'pdf' && (
        <>
          <p>
            {t(
              'Selecione um campo e clique na página para posicioná-lo. Para mover, selecione a marcação e clique no novo local.',
            )}
          </p>
          <div className="placement-toolbar">
            <TextField
              select
              label={t('Campo')}
              value={place?.fieldId || fieldId}
              onChange={(e) => {
                setFieldId(e.target.value);
                setSelected(null);
              }}
              sx={{ maxWidth: 260 }}
            >
              <MenuItem value="">{t('Selecione um campo')}</MenuItem>
              {fields
                .filter((f) => PDF_FIELD_TYPES.includes(f.type))
                .map((f) => (
                  <MenuItem key={f.id} value={f.id}>
                    {f.label}
                  </MenuItem>
                ))}
            </TextField>
            <Button
              variant="contained"
              onClick={() => {
                const section =
                  template.sections.find((section) =>
                    section.fields.some((f) => f.id === activeField?.id),
                  ) || template.sections[0];
                if (!section) {
                  setError(t('Adicione uma seção antes de criar campos.'));
                  return;
                }
                const id = createId();
                onChange({
                  ...template,
                  sections: template.sections.map((s) =>
                    s.id === section.id
                      ? {
                          ...s,
                          fields: [
                            ...s.fields,
                            {
                              id,
                              label: t('Novo campo'),
                              type: 'text',
                              required: false,
                              options: [],
                              hint: '',
                            },
                          ],
                        }
                      : s,
                  ),
                });
                setSelected(null);
                setFieldId(id);
              }}
            >
              {t('Novo campo')}
            </Button>
            <Button
              disabled={!fieldId && !place}
              onClick={() => {
                setFieldId(place?.fieldId || fieldId);
                setSelected(null);
              }}
            >
              {t('Repetir marcação')}
            </Button>
            {place && (
              <>
                {[
                  ['x', 'Posição X (%)'],
                  ['y', 'Posição Y (%)'],
                  ['width', 'Largura (%)'],
                  ['height', 'Altura (%)'],
                ].map(([key, label]) => (
                  <TextField
                    key={key}
                    type="number"
                    label={t(label)}
                    value={Math.round(place[key] * 1000) / 10}
                    sx={{ width: 120 }}
                    onChange={(e) => {
                      let val = Number(e.target.value) / 100;
                      if (!Number.isFinite(val)) return;
                      val = Math.max(
                        key === 'x' || key === 'y' ? 0 : 0.01,
                        Math.min(1, val),
                      );
                      const patch = { [key]: val };
                      if (key === 'x') patch.x = Math.min(val, 1 - place.width);
                      if (key === 'y')
                        patch.y = Math.min(val, 1 - place.height);
                      if (key === 'width')
                        patch.width = Math.min(val, 1 - place.x);
                      if (key === 'height')
                        patch.height = Math.min(val, 1 - place.y);
                      patchPlacement(patch);
                    }}
                  />
                ))}
                <TextField
                  type="number"
                  label={t('Fonte (pt)')}
                  value={place.fontSize || 12}
                  sx={{ width: 100 }}
                  onChange={(e) =>
                    patchPlacement({
                      fontSize: Math.max(
                        6,
                        Math.min(36, Number(e.target.value) || 12),
                      ),
                    })
                  }
                />
                <Button
                  color="error"
                  onClick={() => {
                    update({
                      placements: layout.placements.filter(
                        (p) => p.id !== selected,
                      ),
                    });
                    setSelected(null);
                  }}
                >
                  {t('Remover marcação')}
                </Button>
              </>
            )}
          </div>
          {activeField && (
            <section
              className="pdf-field-properties"
              aria-label={t('Propriedades do campo')}
            >
              <h3>{t('Propriedades do campo')}</h3>
              <div className="pdf-field-properties-grid">
                <TextField
                  label={t('Nome do campo')}
                  value={activeField.label}
                  required
                  onChange={(event) =>
                    updateField({ label: event.target.value })
                  }
                />
                <TextField
                  select
                  label={t('Tipo de dado')}
                  value={activeField.type}
                  onChange={(event) =>
                    updateField({ type: event.target.value })
                  }
                >
                  {PDF_FIELD_TYPES.map((type) => (
                    <MenuItem value={type} key={type}>
                      {t(PDF_FIELD_LABELS[type])}
                    </MenuItem>
                  ))}
                </TextField>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={!!activeField.required}
                      onChange={(event) =>
                        updateField({ required: event.target.checked })
                      }
                    />
                  }
                  label={t('Campo obrigatório')}
                />
              </div>
              <div
                className="pdf-field-properties-grid"
                style={{ marginTop: 16 }}
              >
                <TextField
                  select
                  label={t('Responsável pelo campo')}
                  value={activeField.responsibility?.type || 'stage'}
                  onChange={(event) =>
                    updateField({
                      responsibility:
                        event.target.value === 'stage'
                          ? null
                          : { type: event.target.value, id: '' },
                    })
                  }
                >
                  <MenuItem value="stage">{t('Responsável da etapa')}</MenuItem>
                  <MenuItem value="group">{t('Grupo')}</MenuItem>
                  <MenuItem value="user">{t('Usuário específico')}</MenuItem>
                </TextField>
                {activeField.responsibility && (
                  <TextField
                    select
                    required
                    label={t(
                      activeField.responsibility.type === 'group'
                        ? 'Grupo responsável'
                        : 'Usuário responsável',
                    )}
                    value={activeField.responsibility.id}
                    onChange={(event) =>
                      updateField({
                        responsibility: {
                          ...activeField.responsibility,
                          id: event.target.value,
                        },
                      })
                    }
                  >
                    <MenuItem value="">{t('Selecione')}</MenuItem>
                    {(activeField.responsibility.type === 'group'
                      ? groups
                      : people
                    ).map((item) => (
                      <MenuItem key={item.id} value={item.id}>
                        {item.name}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              </div>
              <p className="muted">
                {t(
                  'Qualquer integrante do grupo selecionado pode preencher. Para restringir a uma pessoa, escolha Usuário específico.',
                )}
              </p>
              {activeField.type === 'select' && (
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  label={t('Opções (uma por linha)')}
                  value={(activeField.options || []).join('\n')}
                  onChange={(event) =>
                    updateField({ options: event.target.value.split('\n') })
                  }
                  sx={{ mt: 2 }}
                />
              )}
              {sharedField && (
                <Alert
                  severity="info"
                  sx={{ mt: 2 }}
                  action={
                    <Button
                      color="inherit"
                      size="small"
                      onClick={() => {
                        const id = createId();
                        onChange({
                          ...template,
                          sections: template.sections.map((section) =>
                            section.fields.some((f) => f.id === activeField.id)
                              ? {
                                  ...section,
                                  fields: [
                                    ...section.fields,
                                    {
                                      ...activeField,
                                      id,
                                      options: [...(activeField.options || [])],
                                    },
                                  ],
                                }
                              : section,
                          ),
                          layout: {
                            ...layout,
                            placements: layout.placements.map((item) =>
                              item.id === selected
                                ? { ...item, fieldId: id }
                                : item,
                            ),
                          },
                        });
                        setFieldId(id);
                      }}
                    >
                      {t('Separar este campo')}
                    </Button>
                  }
                >
                  {t(
                    'Este campo aparece em mais de uma marcação. As alterações e o valor preenchido são compartilhados.',
                  )}
                </Alert>
              )}
            </section>
          )}
          <PdfModel
            layout={layout}
            fields={fields}
            preview
            selected={selected}
            onSelect={setSelected}
            onPlace={(page, x, y) => {
              if (busy) return;
              if (place) {
                patchPlacement({
                  page,
                  x: Math.max(0, Math.min(x, 1 - place.width)),
                  y: Math.max(0, Math.min(y, 1 - place.height)),
                });
                return;
              }
              if (!fields.some((f) => f.id === fieldId)) return;
              const id = createId();
              update({
                placements: [
                  ...(layout.placements || []),
                  {
                    id,
                    fieldId,
                    page,
                    x: Math.max(0, Math.min(x, 0.75)),
                    y: Math.max(0, Math.min(y, 0.94)),
                    width: 0.25,
                    height: 0.06,
                    fontSize: 12,
                  },
                ],
              });
              setSelected(id);
            }}
          />
        </>
      )}
      {!layout && (
        <p>
          {t(
            'Comece pelo editor ou importe um modelo. Configure os campos e responsáveis nas outras abas.',
          )}
        </p>
      )}
    </div>
  );
}
