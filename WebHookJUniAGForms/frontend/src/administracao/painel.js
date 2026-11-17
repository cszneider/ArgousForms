import React, { useCallback, useEffect, useMemo, useReducer, useRef, useContext } from 'react';
import { Alert, Avatar, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Skeleton, Snackbar } from '@mui/material';
import { LoginContext } from '../login-context.js';
import { PainelContext } from './contexto.js';
import { consultarAdministracao } from './api.js';
import { ACOES, PAGINAS, dataHora, duracao, numero } from './dados.js';
import { Icone, Resultado } from './componentes.js';
import { VisaoGeral } from './visao-geral.js';
import { Transacoes } from './transacoes.js';
import { Estatisticas } from './estatisticas.js';
import { Administradores } from './administradores.js';
import { Atividade } from './atividade.js';
import { Configuracoes } from './configuracoes.js';
import './painel.css';

const reducer = (estado, { field, value }) => ({ ...estado, [field]: typeof value === 'function' ? value(estado[field]) : value });
const TELAS = { resumo: VisaoGeral, transacoes: Transacoes, estatisticas: Estatisticas, administradores: Administradores, atividade: Atividade, configuracao: Configuracoes };

export function PainelAdministrativo() {
  const login = useContext(LoginContext);
  const conta = login.value;
  const initialState = useMemo(() => ({ pagina: 'resumo', filtros: { pagina: 0 }, dados: null, loading: true, erro: '', fuso: 'UTC', recarga: 0, menuAberto: false, salvando: false, edicaoAdmin: null, erroEdicao: '', configRascunho: null, configAlterada: false, confirmacao: null, sucesso: '', detalheTransacao: null, detalheAcao: null }), []);
  const initialStateRef = useRef(initialState);
  const [value, dispatch] = useReducer(reducer, initialState);
  const mutacao = useRef(false);
  const menuRef = useRef(null);
  const detalheAtual = useRef(0);
  useEffect(() => {
    if (!value.menuAberto) return;
    const anterior = document.activeElement;
    const menu = menuRef.current;
    const botoes = () => [...menu.querySelectorAll('button:not(:disabled)')];
    botoes()[0]?.focus();
    const tecla = (event) => {
      if (event.key === 'Escape') dispatch({ field: 'menuAberto', value: false });
      if (event.key !== 'Tab') return;
      const itens = botoes();
      if (event.shiftKey && document.activeElement === itens[0]) { event.preventDefault(); itens.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === itens.at(-1)) { event.preventDefault(); itens[0]?.focus(); }
    };
    menu.addEventListener('keydown', tecla);
    const media = window.matchMedia('(max-width: 900px)');
    const redimensionar = () => { if (!media.matches) dispatch({ field: 'menuAberto', value: false }); };
    media.addEventListener('change', redimensionar);
    return () => { menu.removeEventListener('keydown', tecla); media.removeEventListener('change', redimensionar); if (anterior?.isConnected) anterior.focus(); };
  }, [value.menuAberto]);
  const tratarAutenticacao = useCallback((erro) => {
    if (erro.codigo === 'SESSAO_INVALIDA') {
      login.dispatch({ field: 'sessao', value: null });
      login.dispatch({ field: 'trocaManual', value: false });
      login.dispatch({ field: 'aviso', value: erro.message });
    } else if (erro.codigo === 'TROCA_SENHA_OBRIGATORIA') login.carregar();
  }, [login.dispatch, login.carregar]);

  useEffect(() => {
    const controller = new AbortController();
    dispatch({ field: 'loading', value: true });
    dispatch({ field: 'erro', value: '' });
    consultarAdministracao(value.pagina, value.filtros, undefined, controller.signal).then((dados) => {
      if (controller.signal.aborted) return;
      dispatch({ field: 'dados', value: dados });
      const fuso = dados.periodo?.fuso || dados.fusoHorario || dados.configuracao?.fusoHorario;
      if (fuso) dispatch({ field: 'fuso', value: fuso });
    }).catch((erro) => {
      if (controller.signal.aborted) return;
      tratarAutenticacao(erro);
      dispatch({ field: 'erro', value: erro.message });
    }).finally(() => { if (!controller.signal.aborted) dispatch({ field: 'loading', value: false }); });
    return () => controller.abort();
  }, [value.pagina, value.filtros, value.recarga, tratarAutenticacao]);

  const podeDescartar = useCallback(() => !value.configAlterada || window.confirm('Descartar as alterações não salvas nas configurações?'), [value.configAlterada]);
  const navegar = useCallback((pagina) => {
    if (pagina === value.pagina) { dispatch({ field: 'menuAberto', value: false }); return; }
    if (value.salvando || !podeDescartar()) return;
    dispatch({ field: 'loading', value: true });
    dispatch({ field: 'dados', value: null });
    dispatch({ field: 'configAlterada', value: false });
    dispatch({ field: 'erroEdicao', value: '' });
    dispatch({ field: 'pagina', value: pagina });
    dispatch({ field: 'filtros', value: (antes) => ({ inicio: antes.inicio || '', fim: antes.fim || '', pagina: 0 }) });
    dispatch({ field: 'menuAberto', value: false });
  }, [value.pagina, value.salvando, podeDescartar]);
  const atualizar = useCallback(() => {
    if (!podeDescartar()) return;
    dispatch({ field: 'configAlterada', value: false });
    dispatch({ field: 'erroEdicao', value: '' });
    dispatch({ field: 'recarga', value: (antes) => antes + 1 });
  }, [podeDescartar]);
  const aplicarFiltros = useCallback((filtros) => dispatch({ field: 'filtros', value: { ...filtros, pagina: 0 } }), []);

  const salvar = useCallback(async (operacao, campos) => {
    if (mutacao.current) return;
    mutacao.current = true;
    dispatch({ field: 'salvando', value: true });
    dispatch({ field: 'erroEdicao', value: '' });
    dispatch({ field: 'confirmacao', value: null });
    try {
      const dados = await consultarAdministracao(operacao, {}, campos);
      dispatch({ field: 'edicaoAdmin', value: null });
      dispatch({ field: 'configAlterada', value: false });
      dispatch({ field: 'sucesso', value: operacao === 'administradores' ? 'Administrador salvo.' : 'Configurações salvas.' });
      dispatch({ field: 'recarga', value: (antes) => antes + 1 });
      dispatch({ field: 'filtros', value: (antes) => ({ ...antes, pagina: 0 }) });
      if (dados.sessaoEncerrada || dados.id === conta.sessao.idAdministrador) await login.carregar();
    } catch (erro) {
      tratarAutenticacao(erro);
      dispatch({ field: 'erroEdicao', value: erro.message });
    } finally {
      dispatch({ field: 'salvando', value: false });
      mutacao.current = false;
    }
  }, [conta.sessao.idAdministrador, login.carregar, tratarAutenticacao]);
  const salvarAdmin = useCallback(() => {
    const item = value.edicaoAdmin;
    if (item) salvar('administradores', { id: item.id, nome: item.nome, email: item.email, ativo: String(item.ativo), senhaTemporaria: item.senhaTemporaria, revisao: item.revisao || '' });
  }, [value.edicaoAdmin, salvar]);
  const salvarConfig = useCallback(() => {
    const item = value.configRascunho;
    if (item) salvar('configuracao', Object.fromEntries(['fusoHorario', 'validadeSessaoMinutos', 'retencaoTransacoesDias', 'retencaoAcoesDias', 'retencaoSessoesDias', 'revisao'].map((campo) => [campo, item[campo]])));
  }, [value.configRascunho, salvar]);
  const abrirTransacao = useCallback(async (id) => {
    const requisicao = ++detalheAtual.current;
    dispatch({ field: 'detalheTransacao', value: { loading: true } });
    try {
      const dados = await consultarAdministracao('transacao', { id });
      if (requisicao === detalheAtual.current) dispatch({ field: 'detalheTransacao', value: dados });
    } catch (erro) {
      tratarAutenticacao(erro);
      if (requisicao === detalheAtual.current) dispatch({ field: 'detalheTransacao', value: { erroConsulta: erro.message } });
    }
  }, [tratarAutenticacao]);
  useEffect(() => () => { detalheAtual.current++; }, []);
  const fecharTransacao = () => { detalheAtual.current++; dispatch({ field: 'detalheTransacao', value: null }); };
  const contextValues = useMemo(() => ({ value, dispatch, loading: value.loading, telaAtual: value.pagina, initialStateRef, conta, navegar, aplicarFiltros, salvarAdmin, abrirTransacao }), [value, conta, navegar, aplicarFiltros, salvarAdmin, abrirTransacao]);
  const [ , titulo, , descricao ] = PAGINAS.find(([id]) => id === value.pagina);
  const Tela = TELAS[value.pagina];

  return <PainelContext.Provider value={contextValues}><div className="admin-shell">
    {value.menuAberto && <button className="admin-overlay" aria-label="Fechar menu" onClick={() => dispatch({ field: 'menuAberto', value: false })} />}
    <aside ref={menuRef} id="menu-administrativo" className={`admin-sidebar ${value.menuAberto ? 'aberta' : ''}`}><div className="admin-marca"><span><Icone nome="arrows" tamanho={29} /></span><div>Argous Forms<small>Controle da Integração</small></div></div><div className="admin-instituicao">{conta.nomeInstituicao}</div><p className="admin-nav-rotulo">ADMINISTRAÇÃO</p><nav aria-label="Menu principal">{PAGINAS.map(([id, nome, simbolo]) => <button key={id} aria-current={id === value.pagina ? 'page' : undefined} disabled={value.salvando} onClick={() => navegar(id)}><Icone nome={simbolo} /><span>{nome}</span>{id === value.pagina && <i />}</button>)}</nav><div className="admin-sidebar-base"><div className="admin-preparacao"><span /> Consultas em preparação</div><div className="admin-perfil"><Avatar sx={{ width: 36, height: 36, bgcolor: '#35655a', fontSize: 14 }}>{conta.sessao.nome.slice(0, 1).toUpperCase()}</Avatar><div><strong>{conta.sessao.nome}</strong><small>Administrador</small></div></div><button disabled={value.salvando} onClick={() => { if (podeDescartar()) { login.dispatch({ field: 'trocaManual', value: true }); login.dispatch({ field: 'aviso', value: '' }); } }}><Icone nome="settings" tamanho={17} /> Alterar minha senha</button><button disabled={conta.enviando || value.salvando} onClick={() => { if (podeDescartar()) login.sair(); }}><Icone nome="logout" tamanho={17} /> Sair</button></div></aside>
    <div className="admin-principal"><header className="admin-topo"><div><button className="admin-menu-botao" aria-label="Abrir menu" aria-expanded={value.menuAberto} aria-controls="menu-administrativo" onClick={() => dispatch({ field: 'menuAberto', value: true })}><Icone nome="menu" /></button><span>Integração <b>/</b> {titulo}</span></div><span className="admin-conta-email">{conta.sessao.email}</span></header><main className="admin-conteudo"><div className="admin-titulo"><div><span className="admin-sobretitulo">PAINEL ADMINISTRATIVO</span><h1>{titulo}</h1><p>{descricao}</p></div><Button variant="outlined" size="small" startIcon={<Icone nome="refresh" tamanho={16} />} disabled={value.loading || value.salvando} onClick={atualizar}>Atualizar</Button></div>
      {conta.aviso && <Alert severity="error" sx={{ mb: 2 }}>{conta.aviso}</Alert>}
      {value.pagina === 'resumo' && <div className="admin-aviso-preparo"><Icone nome="arrows" /><div><strong>A estrutura da sua integração está pronta para administrar.</strong><span>O processamento de consultas será disponibilizado em uma próxima etapa. Os painéis já consultam o histórico existente.</span></div></div>}
      {value.loading ? <div className="admin-carregando" aria-label="Carregando dados" role="status"><LinearProgress /><div className="admin-metricas">{[1, 2, 3, 4].map((n) => <Skeleton variant="rounded" height={130} key={n} />)}</div><Skeleton variant="rounded" height={250} /></div> : value.erro ? <Alert severity="error" action={<><Button color="inherit" onClick={atualizar}>Tentar novamente</Button>{value.pagina !== 'configuracao' && <Button color="inherit" onClick={() => dispatch({ field: 'filtros', value: { pagina: 0 } })}>Redefinir filtros</Button>}</>}>{value.erro}</Alert> : value.dados ? <Tela /> : null}
      <footer className="admin-rodape">{conta.nomeInstituicao} <span>·</span> Sistema de Controle da Integração <span>·</span> Argous Forms</footer>
    </main></div>
    <Dialog open={!!value.confirmacao} onClose={() => !value.salvando && dispatch({ field: 'confirmacao', value: null })} fullWidth maxWidth="sm"><DialogTitle>{value.confirmacao?.titulo}</DialogTitle><DialogContent><p>{value.confirmacao?.texto}</p></DialogContent><DialogActions><Button onClick={() => dispatch({ field: 'confirmacao', value: null })}>Cancelar</Button><Button variant="contained" color={value.confirmacao?.tipo === 'admin' ? 'error' : 'primary'} onClick={value.confirmacao?.tipo === 'admin' ? salvarAdmin : salvarConfig}>Confirmar</Button></DialogActions></Dialog>
    <Dialog open={!!value.detalheTransacao} onClose={fecharTransacao} fullWidth maxWidth="md"><DialogTitle>Detalhes da transação</DialogTitle><DialogContent>{value.detalheTransacao?.loading ? <CircularProgress size={26} /> : value.detalheTransacao?.erroConsulta ? <Alert severity="error">{value.detalheTransacao.erroConsulta}</Alert> : value.detalheTransacao && <DetalhesTransacao item={value.detalheTransacao} fuso={value.fuso} />}</DialogContent><DialogActions><Button onClick={fecharTransacao}>Fechar</Button></DialogActions></Dialog>
    <Dialog open={!!value.detalheAcao} onClose={() => dispatch({ field: 'detalheAcao', value: null })} fullWidth maxWidth="md"><DialogTitle>{ACOES[value.detalheAcao?.acao] || 'Detalhes da ação'}</DialogTitle><DialogContent>{value.detalheAcao && <><dl className="admin-detalhes"><dt>Administrador</dt><dd>{value.detalheAcao.administrador}</dd><dt>Data e hora</dt><dd>{dataHora(value.detalheAcao.data, value.fuso)}</dd><dt>Conta afetada</dt><dd>{value.detalheAcao.alvo || '—'}</dd><dt>IP de origem</dt><dd>{value.detalheAcao.ip}</dd><dt>ID da sessão</dt><dd className="admin-mono">{value.detalheAcao.idSessao}</dd></dl><h3>Detalhes registrados</h3><pre className="admin-json">{formatarDetalhes(value.detalheAcao.detalhes)}</pre></>}</DialogContent><DialogActions><Button onClick={() => dispatch({ field: 'detalheAcao', value: null })}>Fechar</Button></DialogActions></Dialog>
    <Snackbar open={!!value.sucesso} autoHideDuration={5000} onClose={() => dispatch({ field: 'sucesso', value: '' })}><Alert severity="success" variant="filled">{value.sucesso}</Alert></Snackbar>
  </div></PainelContext.Provider>;
}

function formatarDetalhes(detalhes) { try { return JSON.stringify(JSON.parse(detalhes), null, 2); } catch { return detalhes || '{}'; } }

function DetalhesTransacao({ item, fuso }) {
  const campos = [
    ['Código', item.codigo], ['Identificador da transação', item.id], ['Identificador da requisição', item.idRequisicao], ['Protocolo', item.idProtocolo],
    ['Início', dataHora(item.inicio, fuso)], ['Término', dataHora(item.fim, fuso)], ['Duração', duracao(item.duracaoMs)], ['HTTP', item.http],
    ['HMAC', item.hmacValido == null ? 'Não verificado' : item.hmacValido ? 'Válido' : 'Inválido'], ['IP de origem', item.ip],
    ['Bytes recebidos', item.bytesRequisicao == null ? '—' : numero(item.bytesRequisicao)], ['Bytes de resposta', item.bytesResposta == null ? '—' : numero(item.bytesResposta)], ['Código do erro', item.codigoErro],
  ];
  return <><Resultado codigo={item.resultado} /><dl className="admin-detalhes">{campos.map(([label, valor]) => <React.Fragment key={label}><dt>{label}</dt><dd>{valor ?? '—'}</dd></React.Fragment>)}</dl>{item.erro && <Alert severity="warning">{item.erro}</Alert>}</>;
}
