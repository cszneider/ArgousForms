import React from 'react';
import { Box, Button, Chip, MenuItem, TextField } from '@mui/material';
import { usePainel } from './contexto.js';
import { ACOES, RESULTADOS, dataHora, diaCurto, diasCompletos, duracao, horasCompletas, numero } from './dados.js';

export function Icone({ nome, tamanho = 20 }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    chart: <><path d="M4 4v16h17M8 15V9m5 6V5m5 10v-5" /></>,
    arrows: <><path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m3 10v-3a6 6 0 0 0-2-4" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    settings: <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" /><circle cx="16" cy="17" r="3" /></>,
    refresh: <><path d="M20 11a8 8 0 1 0-2 7M20 4v7h-7" /></>,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    search: <><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    alert: <><path d="m12 3 10 18H2L12 3Z" /><path d="M12 9v4m0 3v1" /></>,
    plus: <path d="M12 4v16M4 12h16" />,
    arrow: <path d="m9 5 7 7-7 7" />,
    logout: <><path d="M9 4H4v16h5m5-13 5 5-5 5m-6-5h11" /></>,
  };
  return <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[nome] || paths.grid}</svg>;
}

export function EstadoVazio({ titulo = 'Nenhum registro neste período', texto = 'Altere os filtros ou consulte novamente mais tarde.', icone = 'arrows' }) {
  return <div className="admin-vazio"><span><Icone nome={icone} tamanho={26} /></span><h3>{titulo}</h3><p>{texto}</p></div>;
}

export function Resultado({ codigo }) {
  const [label, color] = RESULTADOS[codigo] || ['Sem resultado', 'default'];
  return <Chip size="small" variant="outlined" color={color} label={label} />;
}

export function Filtros({ transacoes = false, atividade = false, busca = false }) {
  const { value, aplicarFiltros } = usePainel();
  const periodo = value.dados?.periodo;
  return <Box component="form" onSubmit={(e) => { e.preventDefault(); aplicarFiltros(Object.fromEntries(new FormData(e.currentTarget))); }} className="admin-filtros" key={`${value.pagina}-${value.filtros.inicio}-${value.filtros.fim}`}>
    {!busca && <><TextField label="De" name="inicio" type="date" defaultValue={value.filtros.inicio || periodo?.inicio || ''} slotProps={{ inputLabel: { shrink: true } }} /><TextField label="Até" name="fim" type="date" defaultValue={value.filtros.fim || periodo?.fim || ''} slotProps={{ inputLabel: { shrink: true } }} /></>}
    {transacoes && <><TextField label="Código da consulta" name="codigo" defaultValue={value.filtros.codigo || ''} slotProps={{ htmlInput: { maxLength: 100 } }} /><TextField select name="resultado" label="Resultado" defaultValue={value.filtros.resultado || ''}><MenuItem value="">Todos os resultados</MenuItem>{Object.entries(RESULTADOS).map(([codigo, [rotulo]]) => <MenuItem value={codigo} key={codigo}>{rotulo}</MenuItem>)}</TextField></>}
    {atividade && <TextField select name="acao" label="Ação" defaultValue={value.filtros.acao || ''}><MenuItem value="">Todas as ações</MenuItem>{Object.entries(ACOES).map(([codigo, rotulo]) => <MenuItem value={codigo} key={codigo}>{rotulo}</MenuItem>)}</TextField>}
    {(busca || atividade) && <TextField label="Buscar administrador" name="busca" defaultValue={value.filtros.busca || ''} slotProps={{ htmlInput: { maxLength: 100 } }} />}
    <Button variant="outlined" type="submit" startIcon={<Icone nome="search" tamanho={17} />}>Filtrar</Button>
  </Box>;
}

export function Paginacao() {
  const { value, dispatch } = usePainel();
  const dados = value.dados;
  if (!dados?.total) return null;
  const inicio = dados.pagina * dados.tamanhoPagina;
  return <div className="admin-paginacao"><span>{numero(inicio + 1)}–{numero(Math.min(inicio + dados.tamanhoPagina, dados.total))} de {numero(dados.total)}</span><div><Button size="small" disabled={dados.pagina === 0} onClick={() => dispatch({ field: 'filtros', value: (antes) => ({ ...antes, pagina: dados.pagina - 1 }) })}>Anterior</Button><Button size="small" disabled={inicio + dados.tamanhoPagina >= dados.total} onClick={() => dispatch({ field: 'filtros', value: (antes) => ({ ...antes, pagina: dados.pagina + 1 }) })}>Próxima</Button></div></div>;
}

export function TabelaTransacoes({ itens, compacto = false }) {
  const { value, abrirTransacao } = usePainel();
  if (!itens?.length) return <EstadoVazio texto="As chamadas recebidas aparecerão aqui quando o processamento das consultas estiver disponível." />;
  return <div className="admin-tabela-scroll"><table className="admin-tabela"><thead><tr><th>Consulta / início</th><th>Resultado</th><th>Duração</th>{!compacto && <th>HTTP</th>}<th className="admin-col-acao"><span className="sr-only">Detalhes</span></th></tr></thead><tbody>{itens.map((item) => <tr key={item.id}><td><strong>{item.codigo || 'Sem código'}</strong><small>{dataHora(item.inicio, value.dados?.periodo?.fuso)}</small></td><td><Resultado codigo={item.resultado} /></td><td className="admin-numero">{duracao(item.duracaoMs)}</td>{!compacto && <td>{item.http || '—'}</td>}<td className="admin-col-acao"><Button size="small" onClick={() => abrirTransacao(item.id)} aria-label={`Detalhes da transação ${item.id}`}>Detalhes</Button></td></tr>)}</tbody></table></div>;
}

export function Metricas() {
  const { value } = usePainel();
  const m = value.dados.metricas;
  const percentual = Number(m.total) ? `${(Number(m.sucessos) * 100 / Number(m.total)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% com sucesso` : 'Aguardando primeiras chamadas';
  const cards = [
    ['Total de consultas', numero(m.total), 'arrows', 'No período selecionado', ''],
    ['Consultas com sucesso', numero(m.sucessos), 'check', percentual, 'verde'],
    ['Falhas técnicas', numero(m.falhas), 'alert', `${numero(m.recusadas)} recusadas ou suspensas`, 'laranja'],
    ['Tempo médio de resposta', duracao(m.tempoMedioMs), 'clock', 'Chamadas com duração registrada', 'azul'],
  ];
  return <div className="admin-metricas">{cards.map(([titulo, valor, icone, apoio, cor]) => <div className="admin-metrica" key={titulo}><div><span>{titulo}</span><i className={cor}><Icone nome={icone} /></i></div><strong>{valor}</strong><small>{apoio}</small></div>)}</div>;
}

export function Card({ titulo, apoio, acao, children, className = '' }) {
  return <section className={`admin-card ${className}`}><header><div><h2>{titulo}</h2>{apoio && <p>{apoio}</p>}</div>{acao}</header>{children}</section>;
}

export function GraficoDias() {
  const { value } = usePainel();
  const dados = value.dados;
  if (!Number(dados.metricas.total)) return <EstadoVazio icone="chart" titulo="A atividade aparecerá aqui" texto="O gráfico mostrará o volume de consultas conforme os registros forem recebidos." />;
  const dias = diasCompletos(dados.dias, dados.periodo.inicio, dados.periodo.fim);
  const max = Math.max(1, ...dias.map((dia) => Number(dia.total)));
  const largura = 700, altura = 170;
  const pontos = dias.map((dia, i) => `${30 + i * 640 / Math.max(1, dias.length - 1)},${altura - Number(dia.total) * 140 / max}`);
  return <div className="admin-grafico"><svg role="img" aria-label="Consultas por dia no período selecionado" viewBox={`0 0 ${largura} 210`}><defs><linearGradient id="area-consultas" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b9781" stopOpacity=".22" /><stop offset="100%" stopColor="#3b9781" stopOpacity=".01" /></linearGradient></defs>{[0, .5, 1].map((n) => <g key={n}><line x1="30" x2="670" y1={altura - n * 140} y2={altura - n * 140} stroke="#e7eeeb" strokeDasharray="4 5" /><text x="4" y={altura - n * 140 - 4} fontSize="10" fill="#84918c">{numero(Math.round(max * n))}</text></g>)}<polygon points={`30,${altura} ${pontos.join(' ')} 670,${altura}`} fill="url(#area-consultas)" /><polyline points={pontos.join(' ')} fill="none" stroke="#23836d" strokeWidth="2.5" />{dias.map((dia, i) => <g key={dia.dia}><circle cx={30 + i * 640 / Math.max(1, dias.length - 1)} cy={altura - Number(dia.total) * 140 / max} r={dias.length > 50 ? 2 : 4} fill="#23836d"><title>{`${diaCurto(dia.dia)}: ${numero(dia.total)} consultas; ${numero(dia.falhas)} falhas`}</title></circle>{(i === 0 || i === dias.length - 1 || i % Math.max(1, Math.ceil(dias.length / 6)) === 0) && <text x={30 + i * 640 / Math.max(1, dias.length - 1)} y="199" textAnchor="middle" fontSize="10" fill="#84918c">{diaCurto(dia.dia)}</text>}</g>)}</svg></div>;
}

export function GraficoHoras() {
  const { value } = usePainel();
  const horas = horasCompletas(value.dados.horas);
  const max = Math.max(1, ...horas.map((hora) => hora.total));
  if (!Number(value.dados.metricas.total)) return <EstadoVazio icone="clock" titulo="Ainda não há horários de pico" texto="A distribuição por hora será calculada a partir das transações registradas." />;
  const pico = horas.reduce((a, b) => b.total > a.total ? b : a, horas[0]);
  return <><div className="admin-horas" role="img" aria-label={`Volume por hora. Maior atividade às ${pico.hora}h: ${numero(pico.total)} consultas.`}>{horas.map((item) => <div className="admin-hora" key={item.hora} title={`${item.hora}h: ${numero(item.total)} consultas`}><div style={{ height: `${Math.max(2, item.total * 110 / max)}px`, background: item.hora === pico.hora ? '#23836d' : '#b8d8ce' }} /><span>{item.hora % 3 === 0 ? `${item.hora}h` : ''}</span></div>)}</div><p className="admin-legenda">Maior atividade às <strong>{pico.hora}h</strong> · {numero(pico.total)} consultas · {value.dados.periodo.fuso}</p></>;
}
