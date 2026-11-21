'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, CircularProgress, MenuItem, TextField } from '@mui/material';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { executar } from '../login/autenticacao.js';
import { useI18n } from '../../components/i18n/i18n.js';
import Processos from './processos.js';
import './processos.css';

const colunas = [['paraFazer', 'Para fazer'], ['paraAssumir', 'Para assumir'], ['acompanhando', 'Acompanhando'], ['concluidos', 'Concluídos']];

function diaLocal(data, fuso) {
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(data);
  const valor = (tipo) => partes.find((parte) => parte.type === tipo).value;
  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}

function seloPrazo(item, t) {
  if (!item.limite) return null;
  const fuso = item.fusoHorario || 'UTC';
  const hoje = diaLocal(new Date(), fuso);
  const limite = diaLocal(new Date(item.limite), fuso);
  const dias = Math.round((Date.parse(`${limite}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / 86400000);
  if (new Date(item.limite) < new Date()) return { texto: `${t('Atrasada')} ${Math.max(1, -dias)} ${t('dia(s)')}`, classe: 'atrasada' };
  if (dias === 0 && item.unidadePrazo === 'H') {
    const hora = new Intl.DateTimeFormat(undefined, { timeZone: fuso, hour: '2-digit', minute: '2-digit' }).format(new Date(item.limite));
    return { texto: `${t('Vence às')} ${hora}`, classe: 'hoje' };
  }
  if (dias === 0) return { texto: t('Vence hoje'), classe: 'hoje' };
  return { texto: `${t('Vence em')} ${dias} ${t('dia(s)')}`, classe: 'futuro' };
}

function contexto(item, t) {
  if (item.coluna === 'paraAssumir') return `${t('Na fila desde')} ${new Date(item.contexto.disponibilizacao).toLocaleDateString()}`;
  if (item.coluna === 'acompanhando' && item.contexto.nomeResponsavel) return `${t('Agora com')}: ${item.contexto.nomeResponsavel}`;
  return `${t('Aberto por')} ${item.contexto.nomeIniciador || '—'} · ${new Date(item.contexto.inicio).toLocaleDateString()}`;
}

export default function Tarefas({ aoAbrirProcessos }) {
  const { t } = useI18n();
  const [tarefas, setTarefas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [assumindo, setAssumindo] = useState(null);
  const [erro, setErro] = useState('');
  const [recarregar, setRecarregar] = useState(0);
  const [idProcessoAberto, setIdProcessoAberto] = useState(null);
  const [acaoAberta, setAcaoAberta] = useState(null);
  const [busca, setBusca] = useState('');
  const [protocolo, setProtocolo] = useState('');

  useEffect(() => {
    let cancelado = false;
    executar('LISTAR_MINHAS_TAREFAS').then((dados) => {
      if (!cancelado) { setTarefas(dados.tarefas || []); setErro(''); }
    }).catch((falha) => { if (!cancelado) setErro(falha.message); })
      .finally(() => { if (!cancelado) setCarregando(false); });
    return () => { cancelado = true; };
  }, [recarregar]);

  const protocolos = useMemo(() => [...new Map(tarefas.map((item) => [item.idProtocolo, item.titulo])).entries()], [tarefas]);
  const visiveis = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase();
    return tarefas.filter((item) => (!protocolo || item.idProtocolo === protocolo)
      && (!termo || `${item.titulo} ${item.numero}`.toLocaleLowerCase().includes(termo)));
  }, [tarefas, busca, protocolo]);

  async function assumir(item) {
    setAssumindo(item.idEtapa);
    try {
      await executar('ASSUMIR_ETAPA_PROCESSO', { idEtapa: item.idEtapa });
      setCarregando(true);
      setRecarregar((valor) => valor + 1);
    } catch (falha) { setErro(falha.message); }
    finally { setAssumindo(null); }
  }

  if (idProcessoAberto) return <Processos idProcessoInicial={idProcessoAberto} idEtapaInicial={acaoAberta?.idEtapa} concluirInicial={acaoAberta?.concluir}
    aoVoltar={() => { setIdProcessoAberto(null); setAcaoAberta(null); setRecarregar((valor) => valor + 1); }} />;

  return <div className="processos-pagina">
    <header className="page-heading"><div><span className="eyebrow">{t('QUADRO DE TRABALHO')}</span>
      <h1>{t('Tarefas')}</h1><p>{t('Processos organizados pela ação que cabe a você.')}</p></div>
      <Button variant="outlined" startIcon={<RefreshCw size={16} />} onClick={() => { setCarregando(true); setRecarregar((valor) => valor + 1); }}>{t('Atualizar')}</Button>
    </header>
    <div className="tarefas-filtros">
      <fieldset className="tarefas-escopo"><legend>{t('Escopo das tarefas')}</legend><Button variant="contained" size="small">{t('Minhas')}</Button><span title={t('Em breve')}><Button size="small" disabled>{t('Equipe')}</Button></span></fieldset>
      <TextField size="small" type="search" label={t('Buscar por título ou número')} value={busca} onChange={(evento) => setBusca(evento.target.value)} />
      <TextField size="small" select label={t('Protocolo')} value={protocolo} onChange={(evento) => setProtocolo(evento.target.value)} sx={{ minWidth: 180 }}>
        <MenuItem value="">{t('Todos os protocolos')}</MenuItem>{protocolos.map(([id, titulo]) => <MenuItem key={id} value={id}>{titulo}</MenuItem>)}
      </TextField>
      <small aria-live="polite">{t('Atualizado agora')}</small>
    </div>
    {erro && <Alert severity="error" sx={{ mb: 2 }}>{erro}</Alert>}
    {carregando ? <CircularProgress /> : <div className="tarefas-quadro">
      {colunas.map(([codigo, titulo]) => {
        const itens = visiveis.filter((item) => item.coluna === codigo);
        return <section key={codigo} className="tarefas-coluna" aria-label={t(titulo)}>
          <header><h2>{t(titulo)}</h2><span>{itens.length}</span></header>
          {itens.map((item) => {
            const selo = seloPrazo(item, t);
            const resultado = item.resultado === 'N' ? t('Reprovado') : item.resultado === 'P' ? t('Concluído') : t('Cancelado');
            return <article key={`${item.idProcesso}-${item.idEtapa || codigo}`} className="tarefas-cartao">
              <h3>{item.titulo}</h3><code className="tarefas-numero">{item.numero}</code>
              {item.etapa && <p>{t('Etapa')}: {item.etapa}</p>}
              {codigo !== 'concluidos' && <p>{contexto(item, t)}</p>}
              <div className="tarefas-cartao-rodape">
                {codigo === 'concluidos' ? <span className={`tarefas-selo resultado-${item.resultado || 'C'}`}>{resultado}</span>
                  : selo && <span className={`tarefas-selo ${selo.classe}`} aria-label={selo.texto}>{selo.texto}</span>}
                {codigo === 'paraAssumir' ? <Button size="small" disabled={assumindo === item.idEtapa} onClick={() => assumir(item)}>{t('Assumir')}</Button>
                  : <Button size="small" endIcon={<ArrowRight size={14} />} onClick={() => { setAcaoAberta(codigo === 'paraFazer' ? { idEtapa: item.idEtapa, concluir: !item.idEtapa } : null); setIdProcessoAberto(item.idProcesso); }}>{t(codigo === 'paraFazer' ? item.idEtapa ? 'Preencher' : 'Concluir' : 'Ver')}</Button>}
              </div>
            </article>;
          })}
          {!itens.length && <p className="tarefas-vazio">{t('Nenhum processo nesta coluna.')}</p>}
        </section>;
      })}
    </div>}
    {aoAbrirProcessos && <Button size="small" onClick={aoAbrirProcessos}>{t('Histórico completo em Processos')}</Button>}
  </div>;
}
