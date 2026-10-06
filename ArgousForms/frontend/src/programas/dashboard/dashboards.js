'use client';
import { WorkspaceContext } from '../../interface/argous/workspace.js';
import { pageReducer } from '../../utils/page-state.js';
import { useI18n } from '../../components/i18n/i18n.js';
import {
  useEffect,
  useMemo,
  createContext,
  useReducer,
  useRef,
  useContext,
} from 'react';
import {
  Button,
  useTheme,
  TextField,
  MenuItem,
  Drawer,
  IconButton,
  Chip,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Alert,
  LinearProgress,
} from '@mui/material';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import {
  Files,
  Clock,
  RotateCcw,
  ArrowUpRight,
  ArrowRight,
  GitBranch,
  Users,
  Inbox,
  ShieldCheck,
  CheckCircle2,
  X,
  RefreshCw,
  ChartNoAxesCombined,
} from 'lucide-react';
import { buildDashboard, defaultDashboardFilters } from './dashboard.js';
import { durationLabel } from '../documentos/stage-timing.js';
import { Status } from '../documentos/document-view.js';
export const DashboardContext = createContext({});
export function Dashboards() {
  const {
    value: workspaceValue,
    dispatch: workspaceDispatch,
    openDocument: onOpenDocument,
  } = useContext(WorkspaceContext);
  const { state: store, dashboardFilters: filters } = workspaceValue;
  const onFilters = (value) =>
    workspaceDispatch({ field: 'dashboardFilters', value });
  const initialState = useMemo(
    () => ({
      telaAtual: 'Dashboards',
      loading: false,
      now: 0,
      drill: null,
      allStages: false,
    }),
    [],
  );
  const initialStateRef = useRef(initialState);
  const [pageState, dispatch] = useReducer(pageReducer, initialState);
  const { now, drill, allStages } = pageState;

  const contextValues = useMemo(() => {
    const { telaAtual, loading, ...value } = pageState;
    return { telaAtual, loading, value, dispatch, initialStateRef };
  }, [pageState]);

  const { t: tr, locale } = useI18n();
  const integer = (n) => n.toLocaleString(locale);
  const percent = (n) =>
    `${n.toLocaleString(locale, { maximumFractionDigits: 1 })}%`;
  const display = (value) =>
    typeof value === 'string'
      ? value
      : value
        ? tr(value.key, value.values)
        : '';
  const theme = useTheme();
  const createdColor = theme.palette.mode === 'dark' ? '#87d3b4' : '#267b66';
  const completedColor = theme.palette.mode === 'dark' ? '#9bc4e8' : '#6699c5';

  useEffect(() => {
    dispatch({ field: 'now', value: Date.now() });
    const timer = setInterval(
      () => dispatch({ field: 'now', value: Date.now() }),
      30000,
    );
    return () => clearInterval(timer);
  }, []);
  const data = useMemo(
    () => buildDashboard(store, filters, now, locale),
    [store, filters, now, locale],
  );
  const models = [
    ...new Map(
      [...store.templates, ...store.documents.map((d) => d.template)].map(
        (t) => [t.id, t],
      ),
    ).values(),
  ];
  const inspect = (
    title,
    documents,
    description = {
      key: 'Documentos correspondentes ao indicador e aos filtros atuais.',
    },
  ) => dispatch({ field: 'drill', value: { title, description, documents } });
  const segments = useMemo(
    () =>
      data.distribution.reduce(
        (result, segment) => {
          const next =
            result.offset +
            (data.documents.length
              ? (segment.documents.length / data.documents.length) * 100
              : 0);
          return {
            offset: next,
            colors: [
              ...result.colors,
              `${segment.color} ${result.offset}% ${next}%`,
            ],
          };
        },
        { offset: 0, colors: [] },
      ).colors,
    [data],
  );
  const best = data.stages.find((s) => s.averageMs !== null);
  const maximum = Math.max(1, ...data.stages.map((s) => s.averageMs ?? 0));
  const maxGroup = Math.max(1, ...data.groups.map((g) => g.documents.length));
  const shownStages = allStages ? data.stages : data.stages.slice(0, 6);
  return (
    <DashboardContext.Provider value={contextValues}>
      <div className="dashboards-page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">{tr('ACOMPANHAMENTO DA OPERAÇÃO')}</span>
            <h1>{tr('Dashboards')}</h1>
            <p>
              {tr(
                'Entenda o volume, encontre gargalos e acompanhe seus fluxos.',
              )}
            </p>
          </div>
          <div className="dashboard-refresh">
            <span>
              {tr('Atualizado às')}{' '}
              {new Date(now).toLocaleTimeString(locale, {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <Button
              variant="outlined"
              startIcon={<RefreshCw size={16} />}
              onClick={() => dispatch({ field: 'now', value: Date.now() })}
            >
              {tr('Atualizar')}
            </Button>
          </div>
        </div>
        <div className="panel dashboard-filters">
          <div className="dashboard-filter-label">
            <ChartNoAxesCombined size={20} />
            <div>
              <strong>{tr('Visão da organização')}</strong>
              <small>
                {integer(data.documents.length)} {tr('documentos no recorte')}
              </small>
            </div>
          </div>
          <TextField
            select
            label={tr('Documentos criados')}
            value={filters.period}
            onChange={(e) =>
              onFilters({
                ...filters,
                period: e.target.value,
              })
            }
          >
            <MenuItem value="7">{tr('Últimos 7 dias')}</MenuItem>
            <MenuItem value="30">{tr('Últimos 30 dias')}</MenuItem>
            <MenuItem value="90">{tr('Últimos 90 dias')}</MenuItem>
            <MenuItem value="all">{tr('Todo o período')}</MenuItem>
          </TextField>
          <TextField
            select
            label={tr('Modelo de documento')}
            value={filters.templateId}
            onChange={(e) =>
              onFilters({ ...filters, templateId: e.target.value })
            }
          >
            <MenuItem value="all">{tr('Todos os modelos')}</MenuItem>
            {models.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.name}
              </MenuItem>
            ))}
          </TextField>
          <Button
            size="small"
            onClick={() =>
              onFilters({ ...defaultDashboardFilters, period: 'all' })
            }
          >
            {tr('Limpar filtros')}
          </Button>
        </div>
        {!data.documents.length ? (
          <div className="panel empty-state dashboard-empty">
            <ChartNoAxesCombined size={38} />
            <h2>{tr('Nenhum documento neste recorte')}</h2>
            <p>
              {tr(
                'Escolha outro período ou modelo para visualizar os indicadores.',
              )}
            </p>
            <Button
              variant="outlined"
              onClick={() =>
                onFilters({ ...defaultDashboardFilters, period: 'all' })
              }
            >
              {tr('Ver todos os documentos')}
            </Button>
          </div>
        ) : (
          <>
            <div className="dashboard-kpis">
              <button
                className="dashboard-kpi"
                onClick={() =>
                  inspect({ key: 'Todos os documentos' }, data.documents)
                }
              >
                <div>
                  <span>{tr('Documentos no período')}</span>
                  <Files size={20} />
                </div>
                <strong>{integer(data.documents.length)}</strong>
                <small>
                  {integer(data.completed.length)} {' ' + tr('finalizados ·')}{' '}
                  {percent(data.completionRate)} {tr('do total')}
                </small>
                <ArrowUpRight className="kpi-link" size={17} />
              </button>
              <button
                className="dashboard-kpi primary-kpi"
                onClick={() =>
                  inspect({ key: 'Documentos em fluxo' }, data.active)
                }
              >
                <div>
                  <span>{tr('Em fluxo agora')}</span>
                  <GitBranch size={20} />
                </div>
                <strong>{integer(data.active.length)}</strong>
                <small>
                  {integer(data.unassigned.length)}{' '}
                  {tr('aguardando alguém assumir')}
                </small>
                <ArrowUpRight className="kpi-link" size={17} />
              </button>
              <button
                className="dashboard-kpi"
                onClick={() =>
                  inspect(
                    { key: 'Documentos com devoluções' },
                    data.returnedDocuments,
                    {
                      key: 'Documentos que já receberam ao menos uma devolução, mesmo que tenham sido finalizados.',
                    },
                  )
                }
              >
                <div>
                  <span>{tr('Com devolução')}</span>
                  <RotateCcw size={20} />
                </div>
                <strong>{percent(data.returnRate)}</strong>
                <small>
                  {integer(data.returnedDocuments.length)} {tr('de')}{' '}
                  {integer(data.documents.length)} {tr('documentos')}
                </small>
                <ArrowUpRight className="kpi-link" size={17} />
              </button>
              <button
                className="dashboard-kpi"
                disabled={!data.completed.length}
                onClick={() =>
                  inspect({ key: 'Documentos finalizados' }, data.completed, {
                    key: 'O tempo médio considera somente finalizações com horário registrado e válido.',
                  })
                }
              >
                <div>
                  <span>{tr('Tempo médio de conclusão')}</span>
                  <Clock size={20} />
                </div>
                <strong className="duration-kpi">
                  {data.meanCycleMs === null
                    ? '—'
                    : durationLabel(data.meanCycleMs, locale)}
                </strong>
                <small>
                  {data.cycleSamples}{' '}
                  {' ' + tr('finalizações com horário válido')}
                </small>
                <ArrowUpRight className="kpi-link" size={17} />
              </button>
            </div>
            <section
              className="dashboard-priorities"
              aria-label={tr('Pendências para acompanhar')}
            >
              <span className="priority-label">{tr('Acompanhar agora')}</span>
              <button
                onClick={() =>
                  inspect({ key: 'Aguardando atribuição' }, data.unassigned)
                }
              >
                <Inbox size={17} />
                <strong>{data.unassigned.length}</strong>{' '}
                {tr('sem responsável')}
                <ArrowUpRight size={14} />
              </button>
              <button
                onClick={() =>
                  inspect({ key: 'Aguardando aprovação' }, data.review)
                }
              >
                <ShieldCheck size={17} />
                <strong>{data.review.length}</strong> {tr('em aprovação')}
                <ArrowUpRight size={14} />
              </button>
              <button
                onClick={() =>
                  inspect({ key: 'Em correção' }, data.corrections)
                }
              >
                <RotateCcw size={17} />
                <strong>{data.corrections.length}</strong> {tr('em correção')}
                <ArrowUpRight size={14} />
              </button>
            </section>
            <div className="dashboard-chart-grid">
              <section className="panel dashboard-trend">
                <div className="panel-heading">
                  <div>
                    <h2>{tr('Entrada e conclusão de documentos')}</h2>
                    <p>
                      {tr('Últimos')}
                      {data.trendDays}{' '}
                      {tr('dias · documentos que correspondem aos filtros')}
                    </p>
                  </div>
                  <div className="chart-key">
                    <span>
                      <i style={{ background: createdColor }} />
                      {tr('Criados')}
                    </span>
                    <span>
                      <i style={{ background: completedColor }} />
                      {tr('Finalizados')}
                    </span>
                  </div>
                </div>
                <div
                  className="trend-chart"
                  role="img"
                  aria-label={tr(
                    'Gráfico diário: {0} documentos criados e {1} finalizados nos últimos {2} dias, entre os documentos filtrados.',
                    {
                      0: data.trend.reduce((n, d) => n + d.created, 0),
                      1: data.trend.reduce((n, d) => n + d.completed, 0),
                      2: data.trendDays,
                    },
                  )}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={data.trend}
                      margin={{ top: 14, right: 24, bottom: 4, left: -20 }}
                    >
                      <CartesianGrid
                        stroke={theme.palette.divider}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="day"
                        minTickGap={32}
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 12,
                          fill: theme.palette.text.secondary,
                        }}
                        tickMargin={12}
                      />
                      <YAxis
                        allowDecimals={false}
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 12,
                          fill: theme.palette.text.secondary,
                        }}
                      />
                      <Tooltip
                        labelFormatter={(value) => tr('Dia {0}', { 0: value })}
                        contentStyle={{
                          border: `1px solid ${theme.palette.divider}`,
                          background: theme.palette.background.paper,
                          color: theme.palette.text.primary,
                          borderRadius: 9,
                          fontSize: 13,
                        }}
                      />
                      <Area
                        type="linear"
                        dataKey="created"
                        name={tr('Criados')}
                        stroke={createdColor}
                        fill={createdColor}
                        fillOpacity={0.08}
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                      <Area
                        type="linear"
                        dataKey="completed"
                        name={tr('Finalizados')}
                        stroke={completedColor}
                        fill={completedColor}
                        fillOpacity={0.05}
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>
              <section className="panel dashboard-status">
                <div className="panel-heading">
                  <div>
                    <h2>{tr('Distribuição por status')}</h2>
                    <p>{tr('Situação atual dos documentos')}</p>
                  </div>
                </div>
                <div className="status-chart-body">
                  <div
                    className="status-donut"
                    role="img"
                    aria-label={data.distribution
                      .map((s) => `${tr(s.label)}: ${s.documents.length}`)
                      .join('. ')}
                    style={{
                      background: `conic-gradient(${segments.join(',')})`,
                    }}
                  >
                    <div>
                      <strong>{percent(data.completionRate)}</strong>
                      <span>{tr('finalizados')}</span>
                    </div>
                  </div>
                  <div className="status-chart-legend">
                    {data.distribution.map((s) => (
                      <button
                        key={s.key}
                        onClick={() => inspect({ key: s.label }, s.documents)}
                      >
                        <i style={{ background: s.color }} />
                        <span>{s.label}</span>
                        <strong>{s.documents.length}</strong>
                        <ArrowUpRight size={13} />
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            </div>
            <div className="dashboard-analysis-grid">
              <section className="panel dashboard-bottlenecks">
                <div className="panel-heading">
                  <div>
                    <h2>{tr('Onde o fluxo fica mais tempo')}</h2>
                    <p>
                      {tr(
                        'Tempo médio acumulado por documento, incluindo retornos',
                      )}
                    </p>
                  </div>
                  <span className="dashboard-section-icon">
                    <Clock size={20} />
                  </span>
                </div>
                {best && (
                  <div className="dashboard-bottleneck-callout">
                    <div>
                      <span>{tr('MAIOR TEMPO MÉDIO REGISTRADO')}</span>
                      <strong>{best.name}</strong>
                      <small>
                        {best.templateName} · v{best.version} ·{' '}
                        {best.measuredDocuments.length}{' '}
                        {tr('documentos medidos')}
                      </small>
                    </div>
                    <b>{durationLabel(best.averageMs, locale)}</b>
                  </div>
                )}
                <div className="stage-ranking">
                  {shownStages.map((s) => (
                    <button
                      className="stage-rank-row"
                      key={s.key}
                      onClick={() =>
                        inspect(
                          `${s.name} · ${s.templateName} v${s.version}`,
                          s.documents,
                          {
                            key: 'Documentos que chegaram à etapa. A média exclui históricos parciais e inclui retornos e tempo em curso.',
                          },
                        )
                      }
                    >
                      <div className="rank-row-heading">
                        <strong>{s.name}</strong>
                        <b>
                          {s.averageMs === null
                            ? tr('Sem dados')
                            : durationLabel(s.averageMs, locale)}
                        </b>
                      </div>
                      <div className="rank-row-meta">
                        <span>
                          {s.templateName} · v{s.version} · {s.groupName}
                        </span>
                        <span>
                          {s.currentCount} {tr('agora')}
                        </span>
                      </div>
                      <LinearProgress
                        variant="determinate"
                        value={((s.averageMs ?? 0) / maximum) * 100}
                      />
                      <small>
                        {s.measuredDocuments.length} {tr('documentos medidos')}
                        {s.partialCount
                          ? tr(' · {0} com histórico parcial', {
                              0: s.partialCount,
                            })
                          : ''}
                        <ArrowUpRight size={13} />
                      </small>
                    </button>
                  ))}
                </div>
                {data.stages.length > 6 && (
                  <Button
                    className="dashboard-more"
                    size="small"
                    onClick={() =>
                      dispatch({ field: 'allStages', value: !allStages })
                    }
                  >
                    {allStages
                      ? tr('Mostrar principais etapas')
                      : tr('Ver todas as {0} etapas', {
                          0: data.stages.length,
                        })}
                  </Button>
                )}
                <p className="dashboard-method-note">
                  {tr(
                    'As médias incluem etapas em curso. Modelos e versões são comparados separadamente; períodos com histórico parcial ficam fora da média.',
                  )}
                </p>
              </section>
              <section className="panel dashboard-workload">
                <div className="panel-heading">
                  <div>
                    <h2>{tr('Carga atual por grupo')}</h2>
                    <p>{tr('Documentos na etapa de cada equipe')}</p>
                  </div>
                  <Users size={20} color="#7e9a9d" />
                </div>
                <div className="group-load-list">
                  {data.groups.length ? (
                    data.groups.map((g) => (
                      <button
                        className="group-load-row"
                        key={g.id}
                        onClick={() =>
                          inspect(
                            {
                              key: 'Pendências · {0}',
                              values: { 0: g.name },
                            },
                            g.documents,
                          )
                        }
                      >
                        <div>
                          <span className="group-load-avatar">
                            {g.name.charAt(0)}
                          </span>
                          <strong>{g.name}</strong>
                          <b>{g.documents.length}</b>
                        </div>
                        <LinearProgress
                          variant="determinate"
                          value={(g.documents.length / maxGroup) * 100}
                        />
                        <small>
                          {g.unassigned} {' ' + tr('sem atribuição ·')}{' '}
                          {g.documents.length - g.unassigned} {tr('assumidos')}
                          <ArrowUpRight size={13} />
                        </small>
                      </button>
                    ))
                  ) : (
                    <div className="empty-state compact">
                      <CheckCircle2 size={30} />
                      <h3>{tr('Nenhuma fila pendente')}</h3>
                      <p>
                        {tr('Os documentos deste recorte estão finalizados.')}
                      </p>
                    </div>
                  )}
                </div>
                <div className="dashboard-workload-foot">
                  <strong>{data.active.length}</strong>
                  <span>
                    {tr('documentos em fluxo')}
                    <br />
                    {tr('entre')}
                    {data.groups.length} {tr('grupos')}
                  </span>
                </div>
              </section>
            </div>
            <section className="panel dashboard-flows">
              <div className="panel-heading">
                <div>
                  <h2>{tr('Desempenho dos fluxos')}</h2>
                  <p>{tr('Compare os modelos e suas versões em uso')}</p>
                </div>
                <GitBranch size={20} color="#7e9a9d" />
              </div>
              <TableContainer>
                <Table aria-label={tr('Desempenho por fluxo')}>
                  <TableHead>
                    <TableRow>
                      <TableCell>{tr('FLUXO / MODELO')}</TableCell>
                      <TableCell>{tr('DOCUMENTOS')}</TableCell>
                      <TableCell>{tr('EM FLUXO')}</TableCell>
                      <TableCell>{tr('FINALIZADOS')}</TableCell>
                      <TableCell>{tr('COM DEVOLUÇÃO')}</TableCell>
                      <TableCell>{tr('CONCLUSÃO MÉDIA')}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.flows.map((f) => (
                      <TableRow key={f.key} hover>
                        <TableCell>
                          <strong className="flow-table-name">{f.name}</strong>
                          <small className="flow-table-meta">
                            {tr('Versão')}
                            {f.version} · {f.stageCount} {tr('etapas')}
                          </small>
                        </TableCell>
                        <TableCell>{f.documents.length}</TableCell>
                        <TableCell>
                          {f.documents.length - f.completed}
                        </TableCell>
                        <TableCell>{f.completed}</TableCell>
                        <TableCell>
                          {percent((f.returned / f.documents.length) * 100)}
                          <small className="flow-table-meta">
                            {f.returned} {tr('documentos')}
                          </small>
                        </TableCell>
                        <TableCell>
                          {f.meanCycleMs === null
                            ? '—'
                            : durationLabel(f.meanCycleMs, locale)}
                          <small className="flow-table-meta">
                            {f.cycleSamples} {tr('finalizações medidas')}
                          </small>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            onClick={() =>
                              inspect(
                                {
                                  key: '{0} · versão {1}',
                                  values: {
                                    0: f.name,
                                    1: f.version,
                                  },
                                },
                                f.documents,
                              )
                            }
                            endIcon={<ArrowUpRight size={15} />}
                          >
                            {tr('Explorar')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </section>
            <section className="panel dashboard-oldest">
              <div className="panel-heading">
                <div>
                  <h2>{tr('Pendências mais longas')}</h2>
                  <p>
                    {tr(
                      'Tempo acumulado na etapa atual, incluindo passagens anteriores',
                    )}
                  </p>
                </div>
                <Button
                  size="small"
                  onClick={() =>
                    inspect(
                      { key: 'Todos os documentos em fluxo' },
                      data.pending.map((p) => p.doc),
                      {
                        key: 'Ordenados pelo maior tempo acumulado na etapa atual; históricos parciais ficam ao final.',
                      },
                    )
                  }
                  endIcon={<ArrowRight size={16} />}
                >
                  {tr('Ver todas')}
                </Button>
              </div>
              {data.pending.length ? (
                <div className="oldest-list">
                  {data.pending.slice(0, 5).map((item) => (
                    <button
                      className="oldest-item"
                      key={item.doc.id}
                      onClick={() => onOpenDocument(item.doc.id)}
                    >
                      <span className="oldest-icon">
                        <Clock size={20} />
                      </span>
                      <div>
                        <strong>{item.doc.title}</strong>
                        <small>
                          {item.stage.title} · {item.groupName}
                        </small>
                      </div>
                      <Status doc={item.doc} />
                      <b>
                        {item.elapsedMs === null
                          ? tr('Histórico parcial')
                          : durationLabel(item.elapsedMs, locale)}
                      </b>
                      <ArrowUpRight size={17} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-state compact">
                  <CheckCircle2 size={28} />
                  <h3>{tr('Tudo concluído neste recorte')}</h3>
                </div>
              )}
            </section>
            <div className="dashboard-data-note">
              <span>
                <i className="dot" />{' '}
                {tr(
                  'Indicadores calculados a partir dos documentos desta demonstração.',
                )}
              </span>
              <span>
                {data.returnCount} {' ' + tr('devoluções registradas')}
              </span>
            </div>
            {(data.partialCount > 0 || data.unknownCount > 0) && (
              <Alert severity="info" sx={{ mt: 2, fontSize: 13 }}>
                {data.partialCount > 0
                  ? tr(
                      '{0} documentos têm períodos sem histórico completo; esses períodos não entram nas médias por etapa. ',
                      { 0: data.partialCount },
                    )
                  : ''}
                {data.unknownCount > 0
                  ? tr(
                      '{0} documentos não detalham a hora de atribuição em alguma etapa. O tempo total conhecido é preservado.',
                      { 0: data.unknownCount },
                    )
                  : ''}
              </Alert>
            )}
          </>
        )}
        <Drawer
          anchor="right"
          open={!!drill}
          onClose={() => dispatch({ field: 'drill', value: null })}
          slotProps={{ paper: { sx: { width: { xs: '100%', sm: 520 } } } }}
        >
          <div className="dashboard-drill">
            <div className="drill-heading">
              <div>
                <span className="eyebrow">
                  {tr('DETALHAMENTO DO INDICADOR')}
                </span>
                <h2>{display(drill?.title)}</h2>
              </div>
              <IconButton
                aria-label={tr('Fechar detalhamento')}
                onClick={() => dispatch({ field: 'drill', value: null })}
              >
                <X size={20} />
              </IconButton>
            </div>
            <p>{display(drill?.description)}</p>
            <Chip
              label={tr('{0} documentos', {
                0: drill?.documents.length || 0,
              })}
              size="small"
              variant="outlined"
            />
            {drill?.documents.length ? (
              <div className="drill-documents">
                {drill.documents.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => {
                      dispatch({ field: 'drill', value: null });
                      onOpenDocument(d.id);
                    }}
                  >
                    <div>
                      <strong>{d.title}</strong>
                      <small>
                        {d.code} · {d.template.name} v{d.template.version}
                      </small>
                      <Status doc={d} />
                    </div>
                    <ArrowUpRight size={18} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <Inbox size={30} />
                <h3>{tr('Nenhum documento nesta condição')}</h3>
              </div>
            )}
          </div>
        </Drawer>
      </div>
    </DashboardContext.Provider>
  );
}
