'use client';
import { useI18n } from '../../components/i18n/i18n.js';
import { useEffect, useState } from 'react';
import {
  Button,
  TextField,
  MenuItem,
  IconButton,
  Checkbox,
  FormControlLabel,
  Tabs,
  Tab,
  Chip,
  Alert,
} from '@mui/material';
import {
  ArrowLeft,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  FileText,
  GitBranch,
  Eye,
  GripVertical,
} from 'lucide-react';
import { uid, validateTemplate } from '../documentos/domain.js';
import { ModelDesigner } from '../editor/model-designer.js';
import { VisualDocument } from '../editor/visual-document.js';
const fieldTypes = [
  ['text', 'Texto curto'],
  ['textarea', 'Texto longo'],
  ['number', 'Número'],
  ['date', 'Data'],
  ['select', 'Seleção'],
  ['file', 'Anexo'],
  ['richtext', 'Texto com formatação'],
  ['signature', 'Assinatura (imagem)'],
];
function move(list, index, direction) {
  const copy = [...list];
  [copy[index], copy[index + direction]] = [
    copy[index + direction],
    copy[index],
  ];
  return copy;
}
export function TemplateEditor({
  initial,
  groups,
  people = [],
  onSave,
  onClose,
  onDirtyChange,
}) {
  const { t: tr, system } = useI18n();
  const [t, setT] = useState(() => structuredClone(initial));
  const [tab, setTab] = useState(initial.layout || !initial.name ? 3 : 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(initial.sections[0]?.id);
  useEffect(() => {
    onDirtyChange(busy || JSON.stringify(t) !== JSON.stringify(initial));
    return () => onDirtyChange(false);
  }, [t, initial, onDirtyChange, busy]);
  const save = (create = false) => {
    const e = validateTemplate(t, groups, people);
    if (e) {
      setError(e);
      return;
    }
    onSave({ ...t, draft: false }, create);
  };
  const section = t.sections.find((s) => s.id === selected);
  const updateField = (id, patch) =>
    setT({
      ...t,
      sections: t.sections.map((s) =>
        s.id === selected
          ? {
              ...s,
              fields: s.fields.map((f) =>
                f.id === id ? { ...f, ...patch } : f,
              ),
            }
          : s,
      ),
    });
  return (
    <>
      <div className="page-heading">
        <div>
          <Button
            disabled={busy}
            startIcon={<ArrowLeft size={16} />}
            onClick={onClose}
          >
            {tr('Voltar aos modelos')}
          </Button>
          <h1>{initial.name ? tr('Editar modelo') : tr('Novo modelo')}</h1>
          <p>
            {tr('Defina o conteúdo e o caminho que seu documento vai seguir.')}
          </p>
        </div>
        <div className="designer-actions">
          <Button
            disabled={busy}
            variant="outlined"
            startIcon={<Save size={17} />}
            onClick={() => onSave({ ...t, draft: true }, false)}
          >
            {tr('Salvar parcialmente')}
          </Button>
          <Button disabled={busy} variant="outlined" onClick={() => save(true)}>
            {tr('Salvar e criar documento')}
          </Button>
          <Button
            disabled={busy}
            variant="contained"
            startIcon={<Save size={17} />}
            onClick={() => {
              const e = validateTemplate(t, groups, people);
              if (e) {
                setError(e);
                return;
              }
              onSave({ ...t, draft: false });
            }}
          >
            {tr('Salvar modelo')}
          </Button>
        </div>
      </div>
      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
          {system(error)}
        </Alert>
      )}
      <div className="panel model-meta" inert={busy ? true : undefined}>
        <TextField
          label={tr('Nome do modelo')}
          value={t.name}
          onChange={(e) => setT({ ...t, name: e.target.value })}
          required
        />
        <TextField
          label={tr('Descrição')}
          value={t.description}
          onChange={(e) => setT({ ...t, description: e.target.value })}
        />
        <Chip label={tr('Versão {0}', { 0: t.version })} variant="outlined" />
      </div>
      <div className="panel editor-panel">
        <Tabs
          inert={busy ? true : undefined}
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab value={3} label={tr('Editor do documento')} />
          <Tab
            value={0}
            icon={<FileText size={17} />}
            iconPosition="start"
            label={tr('Seções e campos')}
          />
          <Tab
            value={1}
            icon={<GitBranch size={17} />}
            iconPosition="start"
            label={tr('Fluxo de trabalho')}
          />
          <Tab
            value={2}
            icon={<Eye size={17} />}
            iconPosition="start"
            label={tr('Prévia do modelo')}
          />
        </Tabs>
        {tab === 3 && (
          <ModelDesigner
            template={t}
            groups={groups}
            people={people}
            onChange={setT}
            onBusy={setBusy}
          />
        )}
        {tab === 0 && (
          <div className="editor-grid">
            <aside className="section-list">
              <span className="eyebrow">{tr('SEÇÕES DO DOCUMENTO')}</span>
              {t.sections.map((s, i) => (
                <div
                  className={
                    'section-item ' + (s.id === selected ? 'selected' : '')
                  }
                  key={s.id}
                >
                  <button onClick={() => setSelected(s.id)}>
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    {s.title || tr('Sem título')}
                  </button>
                  <div className="section-tools">
                    <IconButton
                      size="small"
                      disabled={i === 0}
                      aria-label={tr('Mover seção para cima')}
                      onClick={() =>
                        setT({ ...t, sections: move(t.sections, i, -1) })
                      }
                    >
                      <ArrowUp size={14} />
                    </IconButton>
                    <IconButton
                      size="small"
                      disabled={i === t.sections.length - 1}
                      aria-label={tr('Mover seção para baixo')}
                      onClick={() =>
                        setT({ ...t, sections: move(t.sections, i, 1) })
                      }
                    >
                      <ArrowDown size={14} />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={tr('Remover seção')}
                      onClick={() => {
                        const rest = t.sections.filter((x) => x.id !== s.id);
                        setT({
                          ...t,
                          sections: rest,
                          stages: t.stages.map((e) => ({
                            ...e,
                            sectionIds: e.sectionIds.filter(
                              (id) => id !== s.id,
                            ),
                          })),
                        });
                        setSelected(rest[0]?.id);
                      }}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                </div>
              ))}
              <Button
                startIcon={<Plus size={16} />}
                onClick={() => {
                  const id = uid();
                  setT({
                    ...t,
                    sections: [
                      ...t.sections,
                      { id, title: tr('Nova seção'), fields: [] },
                    ],
                  });
                  setSelected(id);
                }}
              >
                {tr('Adicionar seção')}
              </Button>
              <p className="helper">
                {tr(
                  'As seções organizam o conteúdo. As etapas definem quem trabalha nele.',
                )}
              </p>
            </aside>
            <div className="field-editor">
              {section ? (
                <>
                  <div className="section-title">
                    <TextField
                      label={tr('Título da seção')}
                      value={section.title}
                      onChange={(e) =>
                        setT({
                          ...t,
                          sections: t.sections.map((s) =>
                            s.id === selected
                              ? { ...s, title: e.target.value }
                              : s,
                          ),
                        })
                      }
                    />
                    <span className="muted">
                      {section.fields.length} {tr('campos')}
                    </span>
                  </div>
                  {section.fields.map((f, i) => (
                    <div className="field-card" key={f.id}>
                      <div className="field-card-top">
                        <GripVertical size={17} />
                        <strong>
                          {tr('Campo') + ' '}
                          {i + 1}
                        </strong>
                        <span />
                        {[
                          [tr('Mover campo para cima'), ArrowUp, -1],
                          [tr('Mover campo para baixo'), ArrowDown, 1],
                        ].map(([title, Icon, dir]) => (
                          <IconButton
                            key={title}
                            size="small"
                            aria-label={title}
                            disabled={
                              dir === -1
                                ? i === 0
                                : i === section.fields.length - 1
                            }
                            onClick={() =>
                              setT({
                                ...t,
                                sections: t.sections.map((s) =>
                                  s.id === selected
                                    ? { ...s, fields: move(s.fields, i, dir) }
                                    : s,
                                ),
                              })
                            }
                          >
                            <Icon size={15} />
                          </IconButton>
                        ))}
                        <IconButton
                          size="small"
                          aria-label={tr('Remover campo')}
                          onClick={() =>
                            setT({
                              ...t,
                              sections: t.sections.map((s) =>
                                s.id === selected
                                  ? {
                                      ...s,
                                      fields: s.fields.filter(
                                        (x) => x.id !== f.id,
                                      ),
                                    }
                                  : s,
                              ),
                            })
                          }
                        >
                          <Trash2 size={16} />
                        </IconButton>
                      </div>
                      <div className="two-columns">
                        <TextField
                          label={tr('Nome do campo')}
                          value={f.label}
                          onChange={(e) =>
                            updateField(f.id, { label: e.target.value })
                          }
                        />
                        <TextField
                          select
                          label={tr('Tipo de campo')}
                          value={f.type}
                          onChange={(e) =>
                            updateField(f.id, {
                              type: e.target.value,
                            })
                          }
                        >
                          {fieldTypes.map(([value, label]) => (
                            <MenuItem key={value} value={value}>
                              {tr(label)}
                            </MenuItem>
                          ))}
                        </TextField>
                      </div>
                      <TextField
                        label={tr('Orientação de preenchimento (opcional)')}
                        value={f.hint}
                        onChange={(e) =>
                          updateField(f.id, { hint: e.target.value })
                        }
                      />
                      {f.type === 'select' && (
                        <TextField
                          label={tr('Opções (uma por linha)')}
                          multiline
                          minRows={2}
                          value={f.options.join('\n')}
                          onChange={(e) =>
                            updateField(f.id, {
                              options: e.target.value.split('\n'),
                            })
                          }
                        />
                      )}
                      <FormControlLabel
                        control={
                          <Checkbox
                            size="small"
                            checked={f.required}
                            onChange={(e) =>
                              updateField(f.id, { required: e.target.checked })
                            }
                          />
                        }
                        label={tr('Preenchimento obrigatório')}
                      />
                    </div>
                  ))}
                  <Button
                    variant="outlined"
                    startIcon={<Plus size={17} />}
                    onClick={() =>
                      setT({
                        ...t,
                        sections: t.sections.map((s) =>
                          s.id === selected
                            ? {
                                ...s,
                                fields: [
                                  ...s.fields,
                                  {
                                    id: uid(),
                                    label: tr('Novo campo'),
                                    type: 'text',
                                    required: false,
                                    hint: '',
                                    options: [],
                                  },
                                ],
                              }
                            : s,
                        ),
                      })
                    }
                  >
                    {tr('Adicionar campo')}
                  </Button>
                </>
              ) : (
                <div className="empty-state">
                  <FileText />
                  <h3>{tr('Comece por uma seção')}</h3>
                  <p>{tr('Adicione uma seção para organizar os campos.')}</p>
                </div>
              )}
            </div>
          </div>
        )}
        {tab === 1 && (
          <div className="flow-editor">
            <div className="flow-intro">
              <h2>{tr('Uma etapa de cada vez.')}</h2>
              <p>
                {tr(
                  'Escolha os grupos responsáveis e as seções que serão preenchidas.',
                )}
              </p>
            </div>
            {t.stages.map((stage, i) => (
              <div className="stage-card" key={stage.id}>
                <div className="stage-card-head">
                  <span className="step-number">{i + 1}</span>
                  <strong>{stage.title || tr('Nova etapa')}</strong>
                  <div className="push-right">
                    <IconButton
                      aria-label={tr('Mover etapa para cima')}
                      disabled={i === 0}
                      onClick={() =>
                        setT({ ...t, stages: move(t.stages, i, -1) })
                      }
                    >
                      <ArrowUp size={17} />
                    </IconButton>
                    <IconButton
                      aria-label={tr('Mover etapa para baixo')}
                      disabled={i === t.stages.length - 1}
                      onClick={() =>
                        setT({ ...t, stages: move(t.stages, i, 1) })
                      }
                    >
                      <ArrowDown size={17} />
                    </IconButton>
                    <IconButton
                      aria-label={tr('Remover etapa')}
                      onClick={() =>
                        setT({
                          ...t,
                          stages: t.stages.filter((s) => s.id !== stage.id),
                        })
                      }
                    >
                      <Trash2 size={17} />
                    </IconButton>
                  </div>
                </div>
                <div className="stage-fields">
                  <TextField
                    label={tr('Nome da etapa')}
                    value={stage.title}
                    onChange={(e) =>
                      setT({
                        ...t,
                        stages: t.stages.map((s) =>
                          s.id === stage.id
                            ? { ...s, title: e.target.value }
                            : s,
                        ),
                      })
                    }
                  />
                  <div className="two-columns">
                    <TextField
                      select
                      label={tr('Grupo responsável')}
                      value={stage.groupId}
                      onChange={(e) =>
                        setT({
                          ...t,
                          stages: t.stages.map((s) =>
                            s.id === stage.id
                              ? { ...s, groupId: e.target.value }
                              : s,
                          ),
                        })
                      }
                    >
                      {groups.map((g) => (
                        <MenuItem value={g.id} key={g.id}>
                          {g.name}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      select
                      label={tr('Ação')}
                      value={stage.kind}
                      onChange={(e) =>
                        setT({
                          ...t,
                          stages: t.stages.map((s) =>
                            s.id === stage.id
                              ? {
                                  ...s,
                                  kind: e.target.value,
                                  sectionIds: [],
                                }
                              : s,
                          ),
                        })
                      }
                    >
                      <MenuItem value="fill">{tr('Preencher seções')}</MenuItem>
                      <MenuItem value="approve">
                        {tr('Revisar e aprovar')}
                      </MenuItem>
                    </TextField>
                  </div>
                  {stage.kind === 'fill' ? (
                    <div>
                      <p className="field-label">
                        {tr('Seções disponíveis nesta etapa')}
                      </p>
                      {t.sections.map((s) => (
                        <FormControlLabel
                          key={s.id}
                          label={s.title}
                          control={
                            <Checkbox
                              size="small"
                              checked={stage.sectionIds.includes(s.id)}
                              onChange={(e) =>
                                setT({
                                  ...t,
                                  stages: t.stages.map((x) =>
                                    x.id === stage.id
                                      ? {
                                          ...x,
                                          sectionIds: e.target.checked
                                            ? [...x.sectionIds, s.id]
                                            : x.sectionIds.filter(
                                                (id) => id !== s.id,
                                              ),
                                        }
                                      : x,
                                  ),
                                })
                              }
                            />
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <Alert severity="info">
                      {tr(
                        'O responsável revisa o documento, aprova ou devolve para a etapa anterior.',
                      )}
                    </Alert>
                  )}
                </div>
              </div>
            ))}
            <Button
              variant="outlined"
              startIcon={<Plus size={17} />}
              onClick={() =>
                setT({
                  ...t,
                  stages: [
                    ...t.stages,
                    {
                      id: uid(),
                      title: tr('Nova etapa'),
                      groupId: groups[0]?.id || '',
                      kind: 'fill',
                      sectionIds: [],
                    },
                  ],
                })
              }
            >
              {tr('Adicionar etapa')}
            </Button>
          </div>
        )}
        {tab === 2 && t.layout && (
          <div className="template-preview-wrap">
            <VisualDocument template={t} preview name={t.name} />
          </div>
        )}
        {tab === 2 && !t.layout && (
          <div className="template-preview-wrap">
            <article className="document-paper">
              <div className="paper-brand">
                ArgousDocs{' '}
                <span>
                  {tr('MODELO · V')}
                  {t.version}
                </span>
              </div>
              <h1>{t.name || tr('Sem título')}</h1>
              <p>{t.description}</p>
              {t.sections.map((s, i) => (
                <section key={s.id}>
                  <h2>
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    {s.title}
                  </h2>
                  {s.fields.map((f) => (
                    <div className="paper-field" key={f.id}>
                      <label>
                        {f.label}
                        {f.required ? ' *' : ''}
                      </label>
                      <p className="placeholder-value">
                        {f.type === 'select'
                          ? f.options.filter(Boolean).join(' / ')
                          : f.type === 'file'
                            ? tr('Anexo')
                            : f.type === 'date'
                              ? 'dd/mm/aaaa'
                              : tr('Conteúdo preenchido pela equipe')}
                      </p>
                    </div>
                  ))}
                </section>
              ))}
            </article>
          </div>
        )}
      </div>
      <p className="helper">
        {tr(
          'Ao salvar alterações, documentos já iniciados mantêm sua versão original.',
        )}
      </p>
    </>
  );
}
