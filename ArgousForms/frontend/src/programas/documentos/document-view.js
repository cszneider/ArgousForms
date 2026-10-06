/* oxlint-disable next/no-img-element -- User-supplied data URL images must remain local and unoptimized. */
'use client';
import { WorkspaceContext } from '../../interface/argous/workspace.js';
import { pageReducer } from '../../utils/page-state.js';
import { RichEditor } from '../editor/rich-editor.js';
import { VisualDocument } from '../editor/visual-document.js';
import { PdfDownload } from '../editor/pdf-model.js';
import { RichContent } from '../editor/visual-document.js';
import { hasFieldValue } from './domain.js';
import { useI18n } from '../../components/i18n/i18n.js';
import {
  useEffect,
  createContext,
  useMemo,
  useReducer,
  useRef,
  useContext,
  useCallback,
} from 'react';
import {
  Button,
  TextField,
  MenuItem,
  Tabs,
  Tab,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Stepper,
  Step,
  StepButton,
  LinearProgress,
} from '@mui/material';
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  GitBranch,
  FilePenLine,
  Printer,
  Save,
  UserCheck,
  RotateCcw,
  Paperclip,
  Trash2,
  ShieldCheck,
} from 'lucide-react';
import { canWork, canEditField, canContribute } from './domain.js';
import { ProcessFlow } from './process-flow.js';
import { stageTimings } from './stage-timing.js';
import { stageAppearance } from './process-history.js';
export const DocumentViewContext = createContext({});
export const dateLabel = (s, locale = 'pt-BR') =>
  new Date(s).toLocaleDateString(locale, { day: '2-digit', month: 'short' });
export const statusLabel = (d) =>
  d.status === 'done'
    ? 'Finalizado'
    : d.status === 'returned'
      ? 'Em correção'
      : d.template.stages[d.stageIndex]?.kind === 'approve'
        ? 'Em aprovação'
        : 'Em andamento';
export function Status({ doc }) {
  const { t: tr } = useI18n();
  return (
    <Chip
      size="small"
      label={tr(statusLabel(doc))}
      className={
        'status-' +
        (doc.status === 'done'
          ? 'done'
          : doc.status === 'returned'
            ? 'returned'
            : doc.template.stages[doc.stageIndex]?.kind === 'approve'
              ? 'review'
              : 'active')
      }
    />
  );
}
export function DocumentView() {
  const {
    value: workspaceValue,
    onDirtyChange,
    performDocumentAction: onAction,
    closeDocument: onBack,
    switchPerson: onSwitchPerson,
  } = useContext(WorkspaceContext);
  const { people, groups, documents } = workspaceValue.state;
  const doc = documents.find((item) => item.id === workspaceValue.documentId);
  const person =
    people.find((item) => item.id === workspaceValue.actorId) || people[0];
  const initialState = useMemo(
    () => ({
      telaAtual: 'DocumentView',
      loading: false,
      values: structuredClone(doc.values),
      tab: doc.status === 'done' ? 1 : 0,
      historyStage: null,
      simulateId: '',
      returnOpen: false,
      reason: '',
      error: '',
      reading: false,
      historyNow: 0,
    }),
    [doc],
  );
  const initialStateRef = useRef(initialState);
  const [pageState, dispatch] = useReducer(pageReducer, initialState);
  const { values, tab, simulateId, returnOpen, reason, error, reading } =
    pageState;
  const analysis = useMemo(
    () => stageTimings(doc, pageState.historyNow),
    [doc, pageState.historyNow],
  );
  const selectHistoryStage = useCallback(
    (value) => dispatch({ field: 'historyStage', value }),
    [],
  );
  const contextValues = useMemo(() => {
    const { telaAtual: _telaAtual, loading: _loading, ...value } = pageState;
    return {
      telaAtual: value.tab,
      loading: value.reading,
      value: { ...value, doc, people, groups, analysis },
      dispatch,
      initialStateRef,
      selectHistoryStage,
    };
  }, [pageState, doc, people, groups, analysis, selectHistoryStage]);

  const { t: tr, system } = useI18n();

  const stage = doc.template.stages[doc.stageIndex];
  const allowed = canWork(doc, person, groups);
  const owned = allowed && doc.assignee === person.id;
  const contributor = canContribute(doc, person, groups);
  const assignee = people.find((p) => p.id === doc.assignee);
  const group = groups.find((g) => g.id === stage.groupId);
  const nextStage = doc.template.stages[doc.stageIndex + 1];
  const availablePeople = people.filter(
    (p) =>
      group?.memberIds.includes(p.id) &&
      (!doc.assignee || p.id === doc.assignee),
  );
  const candidate =
    availablePeople.find((p) => p.id === simulateId) || availablePeople[0];
  const requiredFields = doc.template.sections
    .filter((s) => stage.sectionIds.includes(s.id))
    .flatMap((s) => s.fields)
    .filter((f) => f.required);
  const missing = requiredFields.filter((f) => {
    const value = values[f.id];
    return !hasFieldValue(f, value);
  }).length;
  const filled = requiredFields.length - missing;
  const changed = JSON.stringify(values) !== JSON.stringify(doc.values);
  useEffect(() => {
    onDirtyChange(changed);
    return () => onDirtyChange(false);
  }, [changed, onDirtyChange]);
  const perform = (action) => {
    if (onAction(action, values, reason)) {
      dispatch({ field: 'returnOpen', value: false });
      dispatch({ field: 'reason', value: '' });
    }
  };
  const attach = async (id, file) => {
    if (!file) return;
    const field = doc.template.sections
      .flatMap((s) => s.fields)
      .find((f) => f.id === id);
    if (
      field?.type === 'signature' &&
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
    ) {
      dispatch({
        field: 'error',
        value: 'Use uma imagem PNG, JPEG ou WebP para a assinatura.',
      });
      return;
    }
    if (file.size > 500 * 1024) {
      dispatch({
        field: 'error',
        value: 'O anexo deve ter até 500 KB nesta demonstração.',
      });
      return;
    }
    if (
      !['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(
        file.type,
      )
    ) {
      dispatch({
        field: 'error',
        value: 'Escolha um PDF ou imagem PNG, JPEG ou WebP.',
      });
      return;
    }
    dispatch({ field: 'reading', value: true });
    try {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      dispatch({
        field: 'values',
        value: (v) => ({
          ...v,
          [id]: { name: file.name, size: file.size, data },
        }),
      });
    } catch {
      dispatch({
        field: 'error',
        value: 'Não foi possível ler o arquivo. Tente novamente.',
      });
    } finally {
      dispatch({ field: 'reading', value: false });
    }
  };
  return (
    <DocumentViewContext.Provider value={contextValues}>
      <>
        <div className="page-heading no-print">
          <div>
            <Button startIcon={<ArrowLeft size={16} />} onClick={onBack}>
              {tr('Voltar aos documentos')}
            </Button>
            <div className="title-with-status">
              <h1>{doc.title}</h1>
              <Status doc={doc} />
            </div>
            <p>
              {doc.code} <span className="separator">/</span>{' '}
              {doc.template.name} {tr('· versão')}
              {doc.template.version}
            </p>
          </div>
          {doc.template.layout?.kind !== 'pdf' && (
            <Button
              variant="outlined"
              startIcon={<Printer size={17} />}
              onClick={() => {
                dispatch({ field: 'tab', value: 1 });
                if (doc.template.layout?.kind !== 'pdf')
                  setTimeout(() => window.print(), 100);
              }}
            >
              {tr('Imprimir / PDF')}
            </Button>
          )}
          {doc.template.layout?.kind === 'pdf' && (
            <PdfDownload
              template={doc.template}
              values={doc.values}
              name={doc.code}
            />
          )}
        </div>
        <section
          className="journey-overview no-print"
          aria-label={tr('Andamento do documento')}
        >
          <div className="journey-summary">
            <div>
              <span>{tr('ETAPA ATUAL')}</span>
              <strong>
                {doc.status === 'done'
                  ? tr('Documento finalizado')
                  : stage.title}
              </strong>
            </div>
            <div>
              <span>{tr('COM QUEM ESTÁ')}</span>
              <strong>
                {doc.status === 'done'
                  ? tr('Fluxo concluído')
                  : assignee?.name || group?.name}
              </strong>
            </div>
            <div>
              <span>{tr('PRÓXIMO PASSO')}</span>
              <strong>
                {doc.status === 'done'
                  ? tr('Consultar ou salvar o PDF')
                  : nextStage
                    ? nextStage.title
                    : tr('Finalizar documento')}
              </strong>
            </div>
          </div>
          <div className="journey-stepper">
            <Stepper
              nonLinear
              activeStep={
                doc.status === 'done'
                  ? doc.template.stages.length
                  : doc.stageIndex
              }
            >
              {doc.template.stages.map((s, i) => (
                <Step
                  key={s.id}
                  completed={doc.status === 'done' || i < doc.stageIndex}
                >
                  <StepButton
                    onClick={() => {
                      dispatch({ field: 'historyStage', value: s.id });
                      dispatch({ field: 'tab', value: 2 });
                    }}
                    optional={
                      <span className="step-caption">
                        {stageAppearance(doc, i).label}
                      </span>
                    }
                  >
                    {s.title}
                  </StepButton>
                </Step>
              ))}
            </Stepper>
          </div>
        </section>
        <div className="document-layout document-layout-focused">
          <div className="document-main">
            <div className="panel no-print">
              <Tabs
                value={tab}
                onChange={(_, v) => dispatch({ field: 'tab', value: v })}
                variant="scrollable"
                scrollButtons="auto"
              >
                <Tab
                  label={tr('Etapa atual')}
                  icon={<FilePenLine size={17} />}
                  iconPosition="start"
                />
                <Tab
                  label={tr('Documento completo')}
                  icon={<FileText size={17} />}
                  iconPosition="start"
                />
                <Tab
                  label={tr('Fluxo e histórico')}
                  icon={<GitBranch size={17} />}
                  iconPosition="start"
                />
              </Tabs>
              {tab === 0 && (
                <div className="document-form">
                  {doc.status === 'done' ? (
                    <Alert severity="success">
                      {tr(
                        'Documento finalizado. O conteúdo está disponível na aba Documento completo.',
                      )}
                    </Alert>
                  ) : (
                    <>
                      <div className="form-stage-heading">
                        <span className="eyebrow">
                          {owned
                            ? tr('SUA ETAPA')
                            : tr('ETAPA {0} DE {1}', {
                                0: doc.stageIndex + 1,
                                1: doc.template.stages.length,
                              })}
                        </span>
                        <h2>
                          {stage.kind === 'approve'
                            ? tr('Revisar e aprovar')
                            : doc.status === 'returned'
                              ? tr('Ajustar as informações')
                              : tr('Preencher as informações')}
                        </h2>
                        <p>
                          {owned
                            ? stage.kind === 'approve'
                              ? tr(
                                  'Leia o documento abaixo. Ao terminar, aprove ou devolva com o motivo da correção.',
                                )
                              : tr(
                                  'Complete os campos desta etapa. Você pode salvar um rascunho e continuar depois.',
                                )
                            : tr(
                                'Confira abaixo quem pode continuar este documento.',
                              )}
                        </p>
                      </div>
                      {doc.status === 'returned' && (
                        <Alert severity="warning" sx={{ mb: 3 }}>
                          <strong>{tr('Correção solicitada')}</strong>
                          <br />
                          {[...doc.history]
                            .reverse()
                            .find(
                              (e) =>
                                e.kind === 'returned' ||
                                e.message.startsWith('Devolveu para correção:'),
                            )
                            ?.message.replace('Devolveu para correção: ', '')}
                        </Alert>
                      )}
                      {!owned && (!contributor || allowed) && (
                        <div className="stage-entry-card">
                          <span className="stage-entry-icon">
                            {stage.kind === 'approve' ? (
                              <ShieldCheck size={26} />
                            ) : (
                              <UserCheck size={26} />
                            )}
                          </span>
                          <div className="stage-entry-copy">
                            <h3>
                              {!allowed
                                ? tr('Aguardando {0}', {
                                    0:
                                      assignee?.name ||
                                      group?.name ||
                                      tr('Grupo indisponível'),
                                  })
                                : doc.assignee
                                  ? tr('{0} está trabalhando nesta etapa', {
                                      0:
                                        assignee?.name ||
                                        tr('Grupo indisponível'),
                                    })
                                  : tr('Pronto para começar')}
                            </h3>
                            <p>
                              {!doc.assignee && allowed
                                ? tr(
                                    'Ao começar, esta etapa fica atribuída a você.',
                                  )
                                : tr(
                                    'Você está acessando como {0}. {1} é responsável pela próxima ação.',
                                    {
                                      0: person.name,
                                      1:
                                        assignee?.name ||
                                        group?.name ||
                                        tr('Grupo indisponível'),
                                    },
                                  )}
                            </p>
                            {stage.kind === 'fill' && (
                              <div className="stage-scope">
                                {doc.template.sections
                                  .filter((s) =>
                                    stage.sectionIds.includes(s.id),
                                  )
                                  .map((s) => (
                                    <Chip
                                      key={s.id}
                                      label={tr('{0} · {1} campos', {
                                        0: s.title,
                                        1: s.fields.length,
                                      })}
                                      size="small"
                                      variant="outlined"
                                    />
                                  ))}
                              </div>
                            )}
                            {!doc.assignee && allowed ? (
                              <Button
                                variant="contained"
                                onClick={() => onAction('claim', values)}
                                endIcon={<ArrowRight size={17} />}
                              >
                                {stage.kind === 'approve'
                                  ? tr('Iniciar revisão')
                                  : tr('Começar preenchimento')}
                              </Button>
                            ) : (
                              availablePeople.length > 0 && (
                                <div className="stage-simulation">
                                  <span>
                                    {tr('Testar esta etapa na demonstração')}
                                  </span>
                                  <div>
                                    {availablePeople.length > 1 && (
                                      <TextField
                                        select
                                        label={tr('Participante do grupo')}
                                        value={candidate?.id || ''}
                                        onChange={(e) =>
                                          dispatch({
                                            field: 'simulateId',
                                            value: e.target.value,
                                          })
                                        }
                                      >
                                        {availablePeople.map((p) => (
                                          <MenuItem key={p.id} value={p.id}>
                                            {p.name}
                                          </MenuItem>
                                        ))}
                                      </TextField>
                                    )}
                                    <Button
                                      variant="outlined"
                                      onClick={() =>
                                        candidate &&
                                        onSwitchPerson(candidate.id)
                                      }
                                    >
                                      {tr('Continuar como')}{' '}
                                      {candidate?.name.split(' ')[0]}
                                    </Button>
                                  </div>
                                </div>
                              )
                            )}
                            <Button
                              size="small"
                              onClick={() =>
                                dispatch({ field: 'tab', value: 1 })
                              }
                              startIcon={<FileText size={16} />}
                            >
                              {tr('Consultar documento completo')}
                            </Button>
                          </div>
                        </div>
                      )}
                      {owned && stage.kind === 'fill' && (
                        <div className="completion-guide">
                          <div>
                            <strong>
                              {missing
                                ? `${missing} ${missing === 1 ? tr('campo obrigatório restante') : tr('campos obrigatórios restantes')}`
                                : tr('Campos obrigatórios preenchidos')}
                            </strong>
                            <span>
                              {filled} {tr('de')}
                              {requiredFields.length}
                            </span>
                          </div>
                          <LinearProgress
                            variant="determinate"
                            value={
                              requiredFields.length
                                ? (filled / requiredFields.length) * 100
                                : 100
                            }
                          />
                          <p>{tr('Os campos com * são obrigatórios.')}</p>
                        </div>
                      )}
                      {error && (
                        <Alert
                          severity="error"
                          onClose={() =>
                            dispatch({ field: 'error', value: '' })
                          }
                        >
                          {system(error)}
                        </Alert>
                      )}
                      {(owned || contributor) &&
                        (stage.kind === 'approve' ? (
                          <DocumentPaper doc={doc} values={values} />
                        ) : (
                          doc.template.sections
                            .filter((s) => stage.sectionIds.includes(s.id))
                            .map((section) => (
                              <section
                                className="form-section"
                                key={section.id}
                              >
                                <h3>{section.title}</h3>
                                <div className="form-fields">
                                  {section.fields.map((field) => {
                                    const value = values[field.id];
                                    const editable = canEditField(
                                      doc,
                                      field,
                                      person,
                                      groups,
                                    );
                                    return (
                                      <div
                                        className={
                                          field.type === 'textarea' ||
                                          field.type === 'richtext' ||
                                          field.type === 'file'
                                            ? 'wide-field'
                                            : ''
                                        }
                                        key={field.id}
                                      >
                                        {field.responsibility && (
                                          <p className="muted">
                                            {tr('Responsável pelo campo')}:{' '}
                                            {field.responsibility.type ===
                                            'group'
                                              ? groups.find(
                                                  (g) =>
                                                    g.id ===
                                                    field.responsibility.id,
                                                )?.name
                                              : people.find(
                                                  (p) =>
                                                    p.id ===
                                                    field.responsibility.id,
                                                )?.name}
                                          </p>
                                        )}
                                        {field.type === 'richtext' ? (
                                          <RichEditor
                                            label={
                                              field.label +
                                              (field.required ? ' *' : '')
                                            }
                                            value={
                                              typeof value === 'string'
                                                ? value
                                                : ''
                                            }
                                            disabled={!editable}
                                            onChange={(html) =>
                                              dispatch({
                                                field: 'values',
                                                value: {
                                                  ...values,
                                                  [field.id]: html,
                                                },
                                              })
                                            }
                                          />
                                        ) : field.type === 'file' ||
                                          field.type === 'signature' ? (
                                          <div className="attachment-field">
                                            <label>
                                              {field.label}
                                              {field.required ? ' *' : ''}
                                            </label>
                                            <p>
                                              {field.hint ||
                                                tr(
                                                  field.type === 'signature'
                                                    ? 'Imagem PNG, JPEG ou WebP de até 500 KB. Assinatura visual, sem certificado digital.'
                                                    : 'PDF ou imagem de até 500 KB.',
                                                )}
                                            </p>
                                            {value &&
                                            typeof value !== 'string' ? (
                                              <div className="attachment-row">
                                                <Paperclip size={16} />
                                                <a
                                                  href={value.data}
                                                  download={value.name}
                                                >
                                                  {value.name}
                                                </a>
                                                {editable && (
                                                  <IconButton
                                                    aria-label={tr(
                                                      'Remover anexo',
                                                    )}
                                                    size="small"
                                                    onClick={() =>
                                                      dispatch({
                                                        field: 'values',
                                                        value: {
                                                          ...values,
                                                          [field.id]: '',
                                                        },
                                                      })
                                                    }
                                                  >
                                                    <Trash2 size={16} />
                                                  </IconButton>
                                                )}
                                              </div>
                                            ) : (
                                              <span className="muted">
                                                {tr('Nenhum arquivo anexado.')}
                                              </span>
                                            )}
                                            {editable && (
                                              <Button
                                                component="label"
                                                variant="outlined"
                                                size="small"
                                                disabled={reading}
                                                startIcon={
                                                  <Paperclip size={16} />
                                                }
                                              >
                                                {reading
                                                  ? tr('Carregando…')
                                                  : tr('Selecionar arquivo')}
                                                <input
                                                  hidden
                                                  type="file"
                                                  accept={
                                                    field.type === 'signature'
                                                      ? 'image/png,image/jpeg,image/webp'
                                                      : '.pdf,.png,.jpg,.jpeg,.webp'
                                                  }
                                                  onChange={(e) => {
                                                    void attach(
                                                      field.id,
                                                      e.target.files?.[0],
                                                    );
                                                    e.target.value = '';
                                                  }}
                                                />
                                              </Button>
                                            )}
                                          </div>
                                        ) : (
                                          <TextField
                                            label={field.label}
                                            required={field.required}
                                            disabled={!editable}
                                            helperText={field.hint}
                                            value={
                                              typeof value === 'string'
                                                ? value
                                                : ''
                                            }
                                            onChange={(e) =>
                                              dispatch({
                                                field: 'values',
                                                value: {
                                                  ...values,
                                                  [field.id]: e.target.value,
                                                },
                                              })
                                            }
                                            type={
                                              field.type === 'date'
                                                ? 'date'
                                                : field.type === 'number'
                                                  ? 'number'
                                                  : 'text'
                                            }
                                            multiline={
                                              field.type === 'textarea'
                                            }
                                            minRows={
                                              field.type === 'textarea'
                                                ? 4
                                                : undefined
                                            }
                                            select={field.type === 'select'}
                                            slotProps={{
                                              inputLabel: { shrink: true },
                                            }}
                                          >
                                            {field.type === 'select'
                                              ? field.options.map((option) => (
                                                  <MenuItem
                                                    key={option}
                                                    value={option}
                                                  >
                                                    {option}
                                                  </MenuItem>
                                                ))
                                              : undefined}
                                          </TextField>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </section>
                            ))
                        ))}
                      {contributor && !owned && (
                        <div className="form-actions">
                          <Button
                            variant="contained"
                            disabled={reading}
                            startIcon={<Save size={16} />}
                            onClick={() => perform('save')}
                          >
                            {tr('Salvar meus campos')}
                          </Button>
                        </div>
                      )}
                      {owned && (
                        <>
                          <div className="next-step-note">
                            <ArrowRight size={17} />
                            <span>
                              {nextStage ? (
                                <>
                                  {tr('Ao concluir, o documento segue para')}{' '}
                                  <strong>
                                    {
                                      groups.find(
                                        (g) => g.id === nextStage.groupId,
                                      )?.name
                                    }
                                  </strong>
                                  : {nextStage.title}.
                                </>
                              ) : (
                                tr(
                                  'Esta é a última etapa. A conclusão finaliza o documento.',
                                )
                              )}
                            </span>
                          </div>
                          <div className="form-actions">
                            <Button
                              startIcon={<RotateCcw size={16} />}
                              disabled={doc.stageIndex === 0 || reading}
                              onClick={() =>
                                dispatch({ field: 'returnOpen', value: true })
                              }
                            >
                              {tr('Solicitar correção')}
                            </Button>
                            <span className="push-right" />
                            {stage.kind === 'fill' && (
                              <Button
                                variant="outlined"
                                startIcon={<Save size={16} />}
                                disabled={reading}
                                onClick={() => perform('save')}
                              >
                                {tr('Salvar rascunho')}
                              </Button>
                            )}
                            <Button
                              variant="contained"
                              disabled={reading}
                              endIcon={
                                stage.kind === 'approve' ? (
                                  <ShieldCheck size={17} />
                                ) : (
                                  <ArrowRight size={17} />
                                )
                              }
                              onClick={() => perform('complete')}
                            >
                              {stage.kind === 'approve'
                                ? tr('Aprovar documento')
                                : doc.stageIndex ===
                                    doc.template.stages.length - 1
                                  ? tr('Finalizar documento')
                                  : tr('Concluir e encaminhar')}
                            </Button>
                          </div>
                        </>
                      )}

                      {owned && changed && (
                        <p className="helper">
                          {tr(
                            'Há alterações ainda não salvas. Salve o rascunho antes de sair.',
                          )}
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
              {tab === 2 && <ProcessFlow />}
            </div>
            {tab === 1 && (
              <div className="document-preview">
                <DocumentPaper doc={doc} values={doc.values} />
                {changed && (
                  <Alert className="no-print" severity="info">
                    {tr(
                      'Esta visualização mostra a última versão salva. Salve o rascunho para incluir suas alterações.',
                    )}
                  </Alert>
                )}
              </div>
            )}
          </div>
        </div>
        <Dialog
          open={returnOpen}
          onClose={() => dispatch({ field: 'returnOpen', value: false })}
        >
          <DialogTitle>{tr('Devolver para correção')}</DialogTitle>
          <DialogContent>
            <p>
              {tr('O documento voltará para “')}
              {doc.template.stages[doc.stageIndex - 1]?.title}
              {tr('”. Explique o que deve ser ajustado.')}
            </p>
            <TextField
              autoFocus
              multiline
              minRows={3}
              label={tr('Motivo da devolução')}
              value={reason}
              onChange={(e) =>
                dispatch({ field: 'reason', value: e.target.value })
              }
              required
            />
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => dispatch({ field: 'returnOpen', value: false })}
            >
              {tr('Cancelar')}
            </Button>
            <Button
              variant="contained"
              disabled={!reason.trim()}
              onClick={() => perform('return')}
            >
              {tr('Devolver documento')}
            </Button>
          </DialogActions>
        </Dialog>
      </>
    </DocumentViewContext.Provider>
  );
}
export function DocumentPaper({ doc, values }) {
  const { t: tr, locale } = useI18n();
  if (doc.template.layout)
    return (
      <VisualDocument template={doc.template} values={values} name={doc.code} />
    );
  return (
    <article className="document-paper">
      <div className="paper-brand">
        ArgousDocs{' '}
        <span>
          {doc.code} · V{doc.template.version}
        </span>
      </div>
      <div className="paper-status">
        {doc.status === 'done'
          ? tr('DOCUMENTO FINALIZADO')
          : tr('DOCUMENTO EM ELABORAÇÃO')}
      </div>
      <h1>{doc.title}</h1>
      <p>{doc.template.name}</p>
      {doc.template.sections.map((section, i) => (
        <section key={section.id}>
          <h2>
            <span>{String(i + 1).padStart(2, '0')}</span>
            {section.title}
          </h2>
          {section.fields.map((field) => {
            const value = values[field.id];
            return (
              <div className="paper-field" key={field.id}>
                <label>{field.label}</label>
                {field.type === 'richtext' ? (
                  <RichContent html={value || ''} />
                ) : field.type === 'signature' && value?.data ? (
                  <img src={value.data} alt={field.label} width="180" />
                ) : value && typeof value === 'object' ? (
                  <a href={value.data} download={value.name}>
                    <Paperclip size={14} /> {value.name}
                  </a>
                ) : (
                  <p>
                    {value
                      ? field.type === 'date'
                        ? value.split('-').reverse().join('/')
                        : value
                      : tr('Não informado')}
                  </p>
                )}
              </div>
            );
          })}
        </section>
      ))}
      <div className="paper-footer">
        <span>
          {doc.status === 'done' ? tr('Finalizado') : tr('Última atualização')}{' '}
          {tr('em')} {new Date(doc.updatedAt).toLocaleString(locale)}
        </span>
        <span>{tr('Gerado no ArgousDocs')}</span>
      </div>
    </article>
  );
}
