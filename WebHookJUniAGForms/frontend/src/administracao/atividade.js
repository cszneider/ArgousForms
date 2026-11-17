import React from 'react';
import { Button, Chip } from '@mui/material';
import { usePainel } from './contexto.js';
import { Card, EstadoVazio, Filtros, Paginacao } from './componentes.js';
import { ACOES, dataHora, numero } from './dados.js';

export function Atividade() {
  const { value, dispatch } = usePainel();
  return <><Filtros atividade /><Card titulo="Histórico de ações" apoio={`${numero(value.dados.total)} ações no período`}>{!value.dados.itens.length ? <EstadoVazio icone="clock" titulo="Nenhuma ação encontrada" texto="Os acessos e as alterações administrativas aparecerão aqui." /> : <div className="admin-tabela-scroll"><table className="admin-tabela"><thead><tr><th>Data e hora</th><th>Administrador</th><th>Ação</th><th>Origem</th><th className="admin-col-acao"><span className="sr-only">Detalhes</span></th></tr></thead><tbody>{value.dados.itens.map((item) => <tr key={item.id}><td className="admin-nowrap">{dataHora(item.data, value.dados.periodo.fuso)}</td><td><strong>{item.administrador}</strong><small>{item.email}</small></td><td><Chip size="small" variant="outlined" label={ACOES[item.acao] || item.acao} /></td><td className="admin-mono">{item.ip}</td><td className="admin-col-acao"><Button size="small" onClick={() => dispatch({ field: 'detalheAcao', value: item })}>Detalhes</Button></td></tr>)}</tbody></table></div>}<Paginacao /></Card></>;
}
