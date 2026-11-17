import React from 'react';
import { Button, Chip } from '@mui/material';
import { usePainel } from './contexto.js';
import { Card, Filtros, GraficoDias, Metricas, TabelaTransacoes } from './componentes.js';
import { numero } from './dados.js';

export function VisaoGeral() {
  const { value, navegar } = usePainel();
  const config = value.dados.configuracao;
  return <>
    <Filtros />
    <Metricas />
    <div className="admin-duas-colunas"><Card titulo="Atividade da integração" apoio="Consultas recebidas por dia"><GraficoDias /></Card><Card titulo="Sua instalação" apoio="Configuração em uso"><div className="admin-instalacao"><div><span>Recebimento configurado</span><Chip size="small" color={config.recebimentoAtivo ? 'success' : 'default'} label={config.recebimentoAtivo ? 'Habilitado' : 'Suspenso'} /></div><div><span>Fuso horário</span><strong>{config.fusoHorario}</strong></div><div><span>Retenção de transações</span><strong>{numero(config.retencaoTransacoesDias)} dias</strong></div><div><span>Validade de novas sessões</span><strong>{numero(config.validadeSessaoMinutos)} min</strong></div><Button size="small" onClick={() => navegar('configuracao')}>Consultar configurações →</Button></div></Card></div>
    <Card titulo="Transações recentes" apoio="Últimas chamadas no período selecionado" acao={<Button size="small" onClick={() => navegar('transacoes')}>Ver todas →</Button>}><TabelaTransacoes itens={value.dados.recentes} compacto /></Card>
  </>;
}
