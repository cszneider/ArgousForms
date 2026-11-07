'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { ArrowLeft, ArrowRight, FileText, GitBranch, MessageCircle, RefreshCw, UserRound } from 'lucide-react';
import { executar } from '../login/autenticacao.js';
import { useI18n } from '../../components/i18n/i18n.js';
import FormularioEtapa from './formulario-etapa.js';
import './processos.css';

const situacoes = { I: 'Iniciado', E: 'Em execução', A: 'Aguardando conclusão', F: 'Finalizado', C: 'Cancelado' };
const situacoesEtapa = { D: 'Disponível', I: 'Iniciada', P: 'Parcialmente salva', S: 'Salva', F: 'Finalizada' };

function dataInicio(valor, locale, comHora = false) {
  if (!valor) return '—';
  const data = new Date(String(valor).replace(' ', 'T'));
  return Number.isNaN(data.getTime()) ? '—' : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', ...(comHora ? { timeStyle: 'short' } : {}) }).format(data);
}

function identificador(valor) {
  return valor ? `${String(valor).slice(0, 8)}…` : '—';
}

function CentralProcesso({ detalhe, locale, t, aoVoltar, aoAbrirFormulario, aoConcluir }) {
  const etapas = detalhe.etapas || [];
  const atual = etapas.find((etapa) => ['D', 'I', 'P', 'S'].includes(etapa.situacao));
  const finalizadas = etapas.filter((etapa) => etapa.situacao === 'F');

  return <div className="processo-central">
    <button type="button" className="processo-central-voltar" onClick={aoVoltar}><ArrowLeft size={16} />{t('Todos os processos')}</button>
    <header className="processo-central-hero">
      <div><span className="eyebrow">{t('CENTRAL DO PROCESSO')}</span><h1>{detalhe.titulo}</h1>
        <p>{t('Protocolo')} · {t('Versão')} {detalhe.versao} <span>·</span> {t('Processo')} {identificador(detalhe.id)}</p></div>
      <Chip label={t(situacoes[detalhe.situacao] || detalhe.situacao)} color={detalhe.situacao === 'F' ? 'success' : 'default'} />
    </header>
    <div className="processo-central-metadata">
      <div><span>{t('Iniciado em')}</span><strong>{dataInicio(detalhe.inicio, locale, true)}</strong></div>
      <div><span>{t('Iniciado por')}</span><strong>{detalhe.nomeIniciador || identificador(detalhe.iniciador)}</strong></div>
      <div><span>{t('Gestor do processo')}</span><strong>{detalhe.nomeGestor || identificador(detalhe.gestor)}</strong></div>
    </div>
    {detalhe.situacao === 'A' && <Alert severity="info" sx={{ mb: 2 }} action={detalhe.podeConcluir
      ? <Button color="inherit" size="small" onClick={aoConcluir}>{t('Concluir processo')}</Button> : null}>
      {t('Todas as etapas foram finalizadas. O processo aguarda a conclusão pelo gestor.')}
    </Alert>}
    <div className="processo-central-grade">
      <div className="processo-central-principal">
        <section className="processo-central-painel">
          <div className="processo-central-painel-titulo"><GitBranch size={19} /><div><h2>{t('Percurso do processo')}</h2><p>{t('Etapas registradas até este momento')}</p></div></div>
          <div className="processo-central-fluxo">
            {etapas.map((etapa, indice) => <div className={`processo-central-no ${etapa.situacao === 'F' ? 'concluido' : etapa.id === atual?.id ? 'atual' : ''}`} key={etapa.id}>
              <span className="processo-central-no-indice">{indice + 1}</span><strong>{etapa.titulo}</strong>
              <small>{t(situacoesEtapa[etapa.situacao] || etapa.situacao)}</small>
            </div>)}
            {detalhe.situacao !== 'A' && detalhe.situacao !== 'F' && detalhe.situacao !== 'C' && <div className="processo-central-no futuro">
              <span className="processo-central-no-indice">···</span><strong>{t('Próximas etapas')}</strong><small>{t('Definidas pelo fluxo')}</small>
            </div>}
          </div>
        </section>
        <section className="processo-central-painel">
          <div className="processo-central-painel-titulo"><MessageCircle size={19} /><div><h2>{t('Fórum')}</h2><p>{t('Discussões e histórico do processo')}</p></div></div>
          <p className="processo-central-vazio">{t('Fórum em preparação')}</p>
        </section>
      </div>
      <aside className="processo-central-lateral">
        <section className="processo-central-painel processo-central-etapa">
          <div className="processo-central-painel-titulo"><UserRound size={19} /><div><h2>{t('Etapa atual')}</h2><p>{atual ? t(situacoesEtapa[atual.situacao] || atual.situacao) : detalhe.situacao === 'A' ? t('Aguardando conclusão pelo gestor') : t('Sem etapa aberta')}</p></div></div>
          {atual && <><h3>{atual.titulo}</h3><p>{t('Responsável')}: {atual.responsavel ? atual.nomeResponsavel || identificador(atual.responsavel) : t('Aguardando alguém assumir')}</p>
            {atual.podeAbrirFormulario && <Button variant="contained" endIcon={<ArrowRight size={16} />} onClick={() => aoAbrirFormulario(atual.id)}>{t('Abrir formulário')}</Button>}</>}
        </section>
        <section className="processo-central-painel">
          <div className="processo-central-painel-titulo"><FileText size={19} /><div><h2>{t('Formulários e valores')}</h2><p>{t('Consulte as etapas já percorridas')}</p></div></div>
          {finalizadas.length ? <div className="processo-central-registros">{finalizadas.map((etapa) => <div key={etapa.id}>
            <strong>{etapa.titulo}</strong><span>{t('Finalizada em')} {dataInicio(etapa.finalizacao, locale)}</span>
            <small>{t('Visualização dos valores em preparação')}</small>
          </div>)}</div> : <p className="processo-central-vazio">{t('Nenhum formulário finalizado até agora.')}</p>}
        </section>
        <section className="processo-central-painel">
          <div className="processo-central-painel-titulo"><FileText size={19} /><div><h2>{t('Documentos gerados')}</h2><p>{t('Arquivos produzidos pelo processo')}</p></div></div>
          {detalhe.documentos?.length ? <div className="processo-central-registros">{detalhe.documentos.map((documento) =>
            <a key={documento.idArquivoVersao} href={`/ArgousForms/arquivo-conteudo?idArquivo=${encodeURIComponent(documento.idArquivo)}&idArquivoVersao=${encodeURIComponent(documento.idArquivoVersao)}&modo=visualizar`}
              target="_blank" rel="noopener noreferrer"><strong>{documento.titulo}</strong><small>{documento.nome}</small></a>)}</div>
            : <p className="processo-central-vazio">{t('Nenhum documento gerado até agora.')}</p>}
        </section>
      </aside>
    </div>
  </div>;
}

export default function Processos({ idProcessoInicial = null, aoVoltar = null }) {
  const { t, locale } = useI18n();
  const [processos, setProcessos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [recarregar, setRecarregar] = useState(0);
  const [detalhe, setDetalhe] = useState(null);
  const [erroDetalhe, setErroDetalhe] = useState('');
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [idEtapaAberta, setIdEtapaAberta] = useState(null);
  const [confirmarConclusao, setConfirmarConclusao] = useState(false);
  const [concluindo, setConcluindo] = useState(false);

  async function abrir(idProcesso) {
    setErroDetalhe('');
    setCarregandoDetalhe(true);
    setDetalhe(null);
    try { setDetalhe(await executar('CONSULTAR_PROCESSO', { idProcesso })); }
    catch (falha) { setErroDetalhe(falha.message); }
    finally { setCarregandoDetalhe(false); }
  }

  useEffect(() => {
    if (!idProcessoInicial) return;
    let cancelado = false;
    executar('CONSULTAR_PROCESSO', { idProcesso: idProcessoInicial }).then((dados) => {
      if (!cancelado) { setDetalhe(dados); setErroDetalhe(''); }
    }).catch((falha) => { if (!cancelado) setErroDetalhe(falha.message); });
    return () => { cancelado = true; };
  }, [idProcessoInicial]);

  async function concluir() {
    setConcluindo(true);
    setErroDetalhe('');
    try {
      await executar('CONCLUIR_PROCESSO', { idProcesso: detalhe.id });
      setConfirmarConclusao(false);
      await abrir(detalhe.id);
      setRecarregar((valor) => valor + 1);
    } catch (falha) { setErroDetalhe(falha.message); }
    finally { setConcluindo(false); }
  }

  useEffect(() => {
    let cancelado = false;
    executar('LISTAR_MEUS_PROCESSOS').then((dados) => {
      if (!cancelado) { setProcessos(dados.processos || []); setErro(''); }
    }).catch((falha) => { if (!cancelado) setErro(falha.message); })
      .finally(() => { if (!cancelado) setCarregando(false); });
    return () => { cancelado = true; };
  }, [recarregar]);

  return <div className="processos-pagina">
    {detalhe ? <CentralProcesso detalhe={detalhe} locale={locale} t={t} aoVoltar={() => aoVoltar ? aoVoltar() : setDetalhe(null)} aoAbrirFormulario={setIdEtapaAberta} aoConcluir={() => setConfirmarConclusao(true)} /> : <>
    {idProcessoInicial && <Button onClick={aoVoltar} startIcon={<ArrowLeft size={16} />}>{t('Voltar às tarefas')}</Button>}
    <header className="page-heading"><div><span className="eyebrow">{t('SEU HISTÓRICO')}</span>
      <h1>{t('Processos')}</h1><p>{t('Processos nos quais você já teve participação.')}</p></div>
      <Button variant="outlined" startIcon={<RefreshCw size={16} />} onClick={() => { setCarregando(true); setRecarregar((valor) => valor + 1); }}>{t('Atualizar')}</Button>
    </header>
    {erro && <Alert severity="error" sx={{ mb: 2 }}>{erro}</Alert>}
    {carregando ? <CircularProgress /> : processos.length ? <div className="processos-lista">
      {processos.map((item) => <article className="processos-cartao" key={item.id}>
        <span className="processos-icone"><GitBranch size={20} /></span>
        <div className="processos-cartao-corpo"><h2>{item.titulo}</h2>
          <p>{t('Versão')} {item.versao} · {t('Iniciado em')} {dataInicio(item.inicio, locale)}</p></div>
        <Chip size="small" label={t(situacoes[item.situacao] || item.situacao)} color={item.situacao === 'F' ? 'success' : 'default'} />
        <Button endIcon={<ArrowRight size={16} />} onClick={() => abrir(item.id)}>{t('Abrir')}</Button>
      </article>)}
    </div> : <div className="processos-vazio"><GitBranch size={28} /><h2>{t('Nenhum processo ainda')}</h2>
      <p>{t('Um processo aparecerá aqui depois que você iniciar ou participar dele.')}</p></div>}
    {erroDetalhe && <Alert severity="error" sx={{ mt: 2 }}>{erroDetalhe}</Alert>}
    {carregandoDetalhe && <CircularProgress sx={{ mt: 2 }} />}
    </>}
    <FormularioEtapa idEtapa={idEtapaAberta} aoFechar={() => setIdEtapaAberta(null)} aoSalvar={() => { if (detalhe) abrir(detalhe.id); setRecarregar((valor) => valor + 1); }} />
    {erroDetalhe && detalhe && <Alert severity="error" sx={{ mt: 2 }}>{erroDetalhe}</Alert>}
    <Dialog open={confirmarConclusao} onClose={() => !concluindo && setConfirmarConclusao(false)}>
      <DialogTitle>{t('Concluir processo?')}</DialogTitle>
      <DialogContent>{t('O processo será encerrado. Os documentos gerados já estão publicados.')}</DialogContent>
      <DialogActions><Button disabled={concluindo} onClick={() => setConfirmarConclusao(false)}>{t('Voltar')}</Button>
        <Button disabled={concluindo} variant="contained" onClick={concluir}>{t('Concluir processo')}</Button></DialogActions>
    </Dialog>
  </div>;
}
