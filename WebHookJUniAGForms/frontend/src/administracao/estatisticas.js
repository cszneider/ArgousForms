import React from 'react';
import { usePainel } from './contexto.js';
import { Card, EstadoVazio, Filtros, GraficoDias, GraficoHoras, Metricas, Resultado } from './componentes.js';
import { duracao, numero } from './dados.js';

export function Estatisticas() {
  const { value } = usePainel();
  const dados = value.dados;
  return <>
    <Filtros /><Metricas />
    <Card titulo="Evolução das consultas" apoio="Volume diário no fuso da instituição"><GraficoDias /></Card>
    <div className="admin-duas-colunas"><Card titulo="Horários de maior atividade" apoio="Volume agregado por hora no período"><GraficoHoras /></Card><Card titulo="Distribuição de resultados" apoio="Todas as transações do período">{!Number(dados.metricas.total) ? <EstadoVazio icone="chart" /> : <div className="admin-distribuicao">{dados.resultados.map((item) => <div key={item.resultado}><div><Resultado codigo={item.resultado} /><strong>{numero(item.total)} <small>({(item.total * 100 / dados.metricas.total).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)</small></strong></div><progress value={item.total} max={dados.metricas.total} aria-label={`Resultado ${item.resultado}`} /></div>)}</div>}</Card></div>
    <Card titulo="Consultas mais utilizadas" apoio="Até dez códigos com maior volume">{!dados.codigos.length ? <EstadoVazio /> : <div className="admin-tabela-scroll"><table className="admin-tabela"><thead><tr><th>Código da consulta</th><th>Chamadas</th><th>Tempo médio</th></tr></thead><tbody>{dados.codigos.map((item) => <tr key={item.codigo}><td><strong>{item.codigo}</strong></td><td>{numero(item.total)}</td><td>{duracao(item.tempoMedioMs)}</td></tr>)}</tbody></table></div>}</Card>
  </>;
}
