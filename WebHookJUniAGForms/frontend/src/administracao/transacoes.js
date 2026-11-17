import React from 'react';
import { usePainel } from './contexto.js';
import { Card, Filtros, Paginacao, TabelaTransacoes } from './componentes.js';
import { numero } from './dados.js';

export function Transacoes() {
  const { value } = usePainel();
  return <><Filtros transacoes /><Card titulo="Histórico de transações" apoio={`${numero(value.dados.total)} registros encontrados`}><TabelaTransacoes itens={value.dados.itens} /><Paginacao /></Card></>;
}
