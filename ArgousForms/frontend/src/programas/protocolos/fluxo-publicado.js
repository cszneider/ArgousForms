'use client';

import { useState } from 'react';
import { Background, Controls, Handle, MarkerType, Position, ReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { CircleDot, Flag } from 'lucide-react';
import { useI18n } from '../../components/i18n/i18n.js';

function Inicio() {
  return <div className="protocolo-fluxo-inicio"><CircleDot size={16} /><span>I</span>
    <Handle type="source" position={Position.Right} isConnectable={false} />
  </div>;
}

function Etapa({ data }) {
  return <div className="protocolo-fluxo-etapa"><Handle type="target" position={Position.Left} isConnectable={false} />
    <span className="protocolo-fluxo-tipo">Etapa</span><strong>{data.titulo}</strong>
    <span className="protocolo-fluxo-subtitulo">{data.formularioNome}</span>
    <Handle type="source" position={Position.Right} isConnectable={false} />
  </div>;
}

function Fim({ data }) {
  return <div className="protocolo-fluxo-final"><Handle type="target" position={Position.Left} isConnectable={false} />
    <Flag size={18} /><strong>{data.titulo}</strong>
  </div>;
}

const tipos = { inicio: Inicio, etapa: Etapa, fim: Fim };

export default function FluxoPublicado({ fluxo, formularios = [], documentos = [] }) {
  const { t } = useI18n();
  const [selecionado, setSelecionado] = useState(null);
  const etapas = fluxo?.etapas || [];
  const ligacoes = fluxo?.ligacoes || [];
  const etapa = etapas.find((item) => item.id === selecionado);
  const grafo = (() => {
    if (!etapas.length) return { nodes: [], edges: [] };
    const primeira = etapas.find((item) => item.id === fluxo.inicio) || etapas[0];
    const finais = etapas.filter((item) => !ligacoes.some((ligacao) => ligacao.origem === item.id));
    const nodes = [
      { id: 'inicio', type: 'inicio', position: { x: primeira.x - 220, y: primeira.y + 20 }, data: {}, draggable: false },
      ...etapas.map((item) => ({ id: item.id, type: 'etapa', position: { x: item.x, y: item.y },
        data: { titulo: item.titulo, formularioNome: formularios.find((formulario) => formulario.id === item.formularioId)?.titulo || '' }, draggable: false })),
      ...finais.map((item, indice) => ({ id: `fim-${indice}`, type: 'fim', position: { x: item.x + 320, y: item.y + 10 },
        data: { titulo: indice ? `Fim ${indice + 1}` : 'Fim' }, draggable: false })),
    ];
    const seta = { type: MarkerType.ArrowClosed };
    const edges = [
      { id: 'inicio-primeira', source: 'inicio', target: primeira.id, markerEnd: seta },
      ...ligacoes.map((item, indice) => ({ id: `ligacao-${indice}`, source: item.origem, target: item.destino,
        label: item.teste || '', markerEnd: seta })),
      ...finais.map((item, indice) => ({ id: `saida-${indice}`, source: item.id, target: `fim-${indice}`, markerEnd: seta })),
    ];
    return { nodes, edges };
  })();

  if (!etapas.length) return <div className="protocolo-publicado-vazio">{t('Nenhuma etapa nesta versão.')}</div>;

  return <>
    <div className="protocolo-publicado-fluxo">
      <ReactFlow nodes={grafo.nodes} edges={grafo.edges} nodeTypes={tipos} fitView nodesDraggable={false}
        nodesConnectable={false} elementsSelectable onNodeClick={(_, no) => setSelecionado(no.type === 'etapa' ? no.id : null)}>
        <Background /><Controls showInteractive={false} />
      </ReactFlow>
    </div>
    {etapa && <div className="protocolo-publicado-detalhe">
      <span className="eyebrow">{t('ETAPA SELECIONADA')}</span><h3>{etapa.titulo}</h3>
      {etapa.descricao && <p>{etapa.descricao}</p>}
      <p>{t('Formulário')}: <strong>{formularios.find((item) => item.id === etapa.formularioId)?.titulo || '—'}</strong></p>
      <p>{t('Documentos gerados')}: <strong>{(etapa.documentos || []).map((id) => documentos.find((item) => item.id === id)?.titulo || id).join(', ') || '—'}</strong></p>
      <p>{t('Destinatários')}: <strong>{etapa.destinatarios?.length || 0}</strong></p>
      {etapa.destinatarios?.map((regra, indice) => <p key={indice} className="protocolo-publicado-regra">
        {Object.entries(regra).filter(([, valor]) => valor !== null).map(([chave, valor]) => `${chave}: ${valor}`).join(' · ')}
      </p>)}
      {(etapa.scriptInicializacao || etapa.scriptFinalizacao) && <details><summary>{t('Scripts')}</summary>
        {etapa.scriptInicializacao && <pre>{etapa.scriptInicializacao}</pre>}
        {etapa.scriptFinalizacao && <pre>{etapa.scriptFinalizacao}</pre>}
      </details>}
    </div>}
  </>;
}
