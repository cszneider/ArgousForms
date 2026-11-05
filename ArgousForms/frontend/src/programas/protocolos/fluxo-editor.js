'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Chip, IconButton, Tooltip } from '@mui/material';
import { CircleDot, Flag, GitBranch, Maximize2, Minimize2, Plus, Trash2 } from 'lucide-react';
import { addEdge, Background, Controls, Handle, MarkerType, MiniMap, Position, ReactFlow, ReactFlowProvider, useEdgesState, useNodesState, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useI18n } from '../../components/i18n/i18n.js';
import { createId } from '../../utils/uid.js';
import { executar } from '../login/autenticacao.js';
import FluxoEtapaDialog from './fluxo-etapa-dialog.js';

const nosIniciais = [
  { id: 'marcador-inicio', type: 'inicio', position: { x: 40, y: 200 }, data: {}, draggable: false, deletable: false },
  { id: 'etapa-inicial', type: 'etapa', position: { x: 260, y: 178 }, data: { titulo: 'Etapa 1', descricao: '', formularioId: '', destinatarios: [], documentos: [], scriptInicializacao: '', scriptFinalizacao: '' }, deletable: false },
  { id: 'marcador-fim', type: 'fim', position: { x: 585, y: 190 }, data: { titulo: 'Fim' }, deletable: false },
];

const ligacoesIniciais = [
  { id: 'inicio-etapa', source: 'marcador-inicio', target: 'etapa-inicial', deletable: false, markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'etapa-fim', source: 'etapa-inicial', target: 'marcador-fim', markerEnd: { type: MarkerType.ArrowClosed } },
];

function Inicio() {
  const { t } = useI18n();
  return <div className="protocolo-fluxo-inicio" title={t('Início')} aria-label={t('Início')}>
    <CircleDot size={16} /><span>I</span>
    <Handle type="source" position={Position.Right} isConnectable={false} />
  </div>;
}

function Etapa({ data }) {
  const { t } = useI18n();
  return <div className="protocolo-fluxo-etapa">
    <Handle type="target" position={Position.Left} />
    <span className="protocolo-fluxo-tipo">{t('Etapa')}</span>
    <strong>{data.titulo}</strong>
    <span className="protocolo-fluxo-subtitulo">{data.formularioNome || t('Formulário pendente')}</span>
    <Handle type="source" position={Position.Right} />
  </div>;
}

function Final({ data }) {
  return <div className="protocolo-fluxo-final">
    <Handle type="target" position={Position.Left} />
    <Flag size={18} /><strong>{data.titulo}</strong>
  </div>;
}

const tiposDeNo = { inicio: Inicio, etapa: Etapa, fim: Final };

function montarFluxoPersistido(dados, formularios) {
  const etapas = dados.etapas.map((item) => ({
    id: item.id, type: 'etapa', position: { x: item.x, y: item.y },
    data: { ...item, formularioNome: formularios.find((formulario) => formulario.id === item.formularioId)?.titulo || '',
      destinatarios: item.destinatarios.map((regra) => ({ ...regra, id: createId() })) },
  }));
  const inicial = etapas.find((item) => item.id === dados.inicio);
  const finais = etapas.filter((item) => !dados.ligacoes.some((ligacao) => ligacao.origem === item.id));
  const fim = finais.map((item, indice) => ({ id: indice === 0 ? 'marcador-fim' : createId(), type: 'fim',
    position: { x: item.position.x + 320, y: item.position.y }, data: { titulo: indice === 0 ? 'Fim' : `Fim ${indice + 1}` },
    deletable: indice !== 0 }));
  return {
    nos: [{ ...nosIniciais[0], position: { x: (inicial?.position.x || 260) - 220, y: (inicial?.position.y || 178) + 22 } }, ...etapas, ...fim],
    ligacoes: [
      ...(inicial ? [{ id: 'inicio-etapa', source: 'marcador-inicio', target: inicial.id, deletable: false, markerEnd: { type: MarkerType.ArrowClosed } }] : []),
      ...dados.ligacoes.map((item) => ({ id: createId(), source: item.origem, target: item.destino, markerEnd: { type: MarkerType.ArrowClosed } })),
      ...finais.map((item, indice) => ({ id: createId(), source: item.id, target: fim[indice].id, markerEnd: { type: MarkerType.ArrowClosed } })),
    ],
  };
}

function FluxoEditorInterno({ idProtocolo, formularios = [], variaveis = [], documentos = [] }) {
  const { t } = useI18n();
  const [nos, setNos, aoAlterarNos] = useNodesState(nosIniciais);
  const [ligacoes, setLigacoes, aoAlterarLigacoes] = useEdgesState(ligacoesIniciais);
  const [selecionado, setSelecionado] = useState(null);
  const [ligacaoSelecionada, setLigacaoSelecionada] = useState(null);
  const [etapaAberta, setEtapaAberta] = useState(null);
  const [expandido, setExpandido] = useState(false);
  const [catalogo, setCatalogo] = useState({ usuarios: [], grupos: [], tags: [] });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const sequencia = useRef(1);
  const fluxo = useReactFlow();

  useEffect(() => {
    let cancelado = false;
    Promise.allSettled([
      executar('CONSULTAR_FLUXO_PROTOCOLO', { idProtocolo }),
      executar('CATALOGO_DESTINATARIOS_PROTOCOLO'),
    ]).then(([consulta, catalogoRecebido]) => {
      if (cancelado) return;
      if (consulta.status === 'rejected') throw consulta.reason;
      const dados = consulta.value;
      if (catalogoRecebido.status === 'fulfilled') setCatalogo(catalogoRecebido.value);
      else setErro(catalogoRecebido.reason.message);
      if (dados.etapas?.length) {
        const carregado = montarFluxoPersistido(dados, formularios);
        setNos(carregado.nos);
        setLigacoes(carregado.ligacoes);
      }
    }).catch((falha) => { if (!cancelado) setErro(falha.message); })
      .finally(() => { if (!cancelado) setCarregando(false); });
    return () => { cancelado = true; };
  }, [idProtocolo, formularios, setNos, setLigacoes]);

  useEffect(() => {
    if (!expandido) return;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const sairComEscape = (evento) => { if (evento.key === 'Escape') setExpandido(false); };
    document.addEventListener('keydown', sairComEscape);
    return () => {
      document.body.style.overflow = overflowAnterior;
      document.removeEventListener('keydown', sairComEscape);
    };
  }, [expandido]);

  useEffect(() => {
    const ajuste = setTimeout(() => fluxo.fitView({ padding: 0.2, duration: 250 }), 50);
    return () => clearTimeout(ajuste);
  }, [expandido, fluxo]);

  const adicionar = useCallback((tipo, posicao) => {
    const id = createId();
    const numero = ++sequencia.current;
    const novo = { id, type: tipo === 'F' ? 'fim' : 'etapa',
      position: posicao || { x: 380 + (numero - 2) * 210, y: 340 },
      data: tipo === 'F' ? { titulo: `Fim ${numero}` }
        : { titulo: `Etapa ${numero}`, descricao: '', formularioId: '', destinatarios: [], documentos: [], scriptInicializacao: '', scriptFinalizacao: '' } };
    setNos((atuais) => [...atuais, novo]);
    setSelecionado(id);
    setLigacaoSelecionada(null);
    if (tipo !== 'F') setEtapaAberta(id);
  }, [setNos]);

  const conectar = useCallback((conexao) => {
    setLigacoes((atuais) => addEdge({ ...conexao, markerEnd: { type: MarkerType.ArrowClosed } }, atuais));
  }, [setLigacoes]);

  const conexaoValida = useCallback((conexao) => {
    if (conexao.source === conexao.target || conexao.target === 'marcador-inicio' || conexao.source === 'marcador-inicio') return false;
    if (nos.find((no) => no.id === conexao.source)?.type === 'fim') return false;
    return !ligacoes.some((ligacao) => ligacao.source === conexao.source && ligacao.target === conexao.target);
  }, [nos, ligacoes]);

  function aoSoltar(evento) {
    evento.preventDefault();
    const tipo = evento.dataTransfer.getData('application/argousforms-etapa');
    if (tipo !== 'E' && tipo !== 'F') return;
    adicionar(tipo, fluxo.screenToFlowPosition({ x: evento.clientX, y: evento.clientY }));
  }

  function salvarEtapa(dados) {
    setNos((atuais) => atuais.map((no) => no.id === etapaAberta
      ? { ...no, data: { ...dados, formularioNome: formularios.find((formulario) => formulario.id === dados.formularioId)?.titulo || '' } }
      : no));
    setEtapaAberta(null);
    setSucesso('');
  }

  async function salvarFluxo() {
    const etapas = nos.filter((no) => no.type === 'etapa');
    const entradas = ligacoes.filter((item) => item.source === 'marcador-inicio');
    const finais = ligacoes.filter((item) => nos.some((no) => no.id === item.target && no.type === 'fim'));
    if (entradas.length !== 1 || !etapas.some((item) => item.id === entradas[0].target)) {
      setErro(t('Ligue o marcador de início a uma única etapa.'));
      return;
    }
    if (!finais.length) { setErro(t('Ligue ao menos uma etapa a um ponto final.')); return; }
    if (etapas.some((item) => !item.data.formularioId)) { setErro(t('Escolha um formulário para cada etapa antes de salvar.')); return; }
    if (finais.some((item) => ligacoes.some((outra) => outra.source === item.source && etapas.some((etapa) => etapa.id === outra.target)))) {
      setErro(t('Uma etapa ligada ao fim não pode ter outra saída.'));
      return;
    }
    setSalvando(true);
    setErro('');
    setSucesso('');
    try {
      const dados = await executar('SALVAR_FLUXO_PROTOCOLO', {
        idProtocolo, inicio: entradas[0].target,
        etapas: etapas.map((item) => ({ ...item.data, id: item.id, x: Math.round(item.position.x), y: Math.round(item.position.y) })),
        ligacoes: ligacoes.filter((item) => etapas.some((etapa) => etapa.id === item.source) && etapas.some((etapa) => etapa.id === item.target))
          .map((item) => ({ origem: item.source, destino: item.target })),
      });
      setSucesso(t('Fluxo salvo.'));
      if (dados.etapas?.length) {
        const carregado = montarFluxoPersistido(dados, formularios);
        setNos(carregado.nos);
        setLigacoes(carregado.ligacoes);
      }
    } catch (falha) { setErro(falha.message); }
    finally { setSalvando(false); }
  }

  function excluirSelecionado() {
    if (selecionado && !['etapa-inicial', 'marcador-inicio', 'marcador-fim'].includes(selecionado)) {
      setNos((atuais) => atuais.filter((no) => no.id !== selecionado));
      setLigacoes((atuais) => atuais.filter((ligacao) => ligacao.source !== selecionado && ligacao.target !== selecionado));
      setSelecionado(null);
    } else if (ligacaoSelecionada && ligacaoSelecionada !== 'inicio-etapa') {
      setLigacoes((atuais) => atuais.filter((ligacao) => ligacao.id !== ligacaoSelecionada));
      setLigacaoSelecionada(null);
    }
  }

  const etapaSelecionada = nos.find((no) => no.id === selecionado && no.type === 'etapa');
  const etapaEmEdicao = nos.find((no) => no.id === etapaAberta && no.type === 'etapa');

  return <div className={`protocolo-fluxo-editor${expandido ? ' protocolo-fluxo-editor-expandido' : ''}`}>
    <div className="protocolo-fluxo-aviso">
      <Chip size="small" label={t('Rascunho do fluxo')} />
      <span>{t('Configure as etapas e conecte os blocos no canvas.')}</span>
      <Button variant="contained" size="small" onClick={salvarFluxo} disabled={salvando || carregando}>{t(salvando ? 'Salvando…' : 'Salvar fluxo')}</Button>
      <Tooltip title={t(expandido ? 'Voltar à visualização normal' : 'Expandir editor')}>
        <IconButton className="protocolo-fluxo-expandir" aria-label={t(expandido ? 'Voltar à visualização normal' : 'Expandir editor')}
          onClick={() => setExpandido((atual) => !atual)}>
          {expandido ? <Minimize2 size={19} /> : <Maximize2 size={19} />}
        </IconButton>
      </Tooltip>
    </div>
    {erro && <Alert severity="error" onClose={() => setErro('')}>{erro}</Alert>}
    {sucesso && <Alert severity="success" onClose={() => setSucesso('')}>{sucesso}</Alert>}
    <div className="protocolo-fluxo-corpo">
      <div className="protocolo-fluxo-canvas" onDragOver={(evento) => evento.preventDefault()} onDrop={aoSoltar}>
        <ReactFlow nodes={nos} edges={ligacoes} nodeTypes={tiposDeNo} onNodesChange={aoAlterarNos}
          onEdgesChange={aoAlterarLigacoes} onConnect={conectar} isValidConnection={conexaoValida}
          onNodeClick={(_, no) => { setSelecionado(no.id); setLigacaoSelecionada(null); }}
          onNodeDoubleClick={(_, no) => { if (no.type === 'etapa') { setSelecionado(no.id); setEtapaAberta(no.id); } }}
          onEdgeClick={(_, ligacao) => { setLigacaoSelecionada(ligacao.id); setSelecionado(null); }}
          onPaneClick={() => { setSelecionado(null); setLigacaoSelecionada(null); }}
          fitView fitViewOptions={{ padding: 0.25 }} deleteKeyCode={null}
          defaultEdgeOptions={{ type: 'smoothstep' }}>
          <Background gap={24} size={1} /><Controls showInteractive={false} /><MiniMap pannable zoomable />
        </ReactFlow>
      </div>
      <aside className="protocolo-fluxo-lateral">
        <h3>{t('Adicionar ao fluxo')}</h3>
        <p>{t('Arraste um bloco para o canvas ou clique para adicioná-lo.')}</p>
        <Button fullWidth variant="outlined" startIcon={<Plus size={17} />} draggable
          onDragStart={(evento) => evento.dataTransfer.setData('application/argousforms-etapa', 'E')}
          onClick={() => adicionar('E')}>{t('Nova etapa')}</Button>
        <Button fullWidth variant="outlined" startIcon={<Flag size={17} />} draggable
          onDragStart={(evento) => evento.dataTransfer.setData('application/argousforms-etapa', 'F')}
          onClick={() => adicionar('F')}>{t('Ponto final')}</Button>
        {etapaSelecionada && <Button startIcon={<GitBranch size={16} />} onClick={() => setEtapaAberta(etapaSelecionada.id)}>{t('Configurar etapa')}</Button>}
        {(selecionado && !['etapa-inicial', 'marcador-inicio', 'marcador-fim'].includes(selecionado) || ligacaoSelecionada && ligacaoSelecionada !== 'inicio-etapa') &&
          <Button color="error" startIcon={<Trash2 size={16} />} onClick={excluirSelecionado}>
            {t(selecionado ? nos.find((no) => no.id === selecionado)?.type === 'fim' ? 'Excluir ponto final' : 'Excluir etapa' : 'Excluir ligação')}
          </Button>}
      </aside>
    </div>
    {etapaEmEdicao && <FluxoEtapaDialog key={etapaEmEdicao.id} etapa={etapaEmEdicao}
      formularios={formularios} variaveis={variaveis} documentos={documentos}
      catalogo={catalogo}
      aoSalvar={salvarEtapa} aoFechar={() => setEtapaAberta(null)} />}
  </div>;
}

export default function FluxoEditor(props) {
  return <ReactFlowProvider><FluxoEditorInterno {...props} /></ReactFlowProvider>;
}
