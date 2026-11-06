'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, MenuItem, TextField } from '@mui/material';
import { ArrowLeft, ArrowRight, CalendarDays, Check, FileText, GitBranch, Image, LayoutTemplate, Variable } from 'lucide-react';
import { executar } from '../login/autenticacao.js';
import { useI18n } from '../../components/i18n/i18n.js';
import FluxoPublicado from './fluxo-publicado.js';
import ModeloHtmlPublicado from './modelo-html-publicado.js';

const secoes = [
  { id: 'visao', titulo: 'Visão do Protocolo', Icon: Check },
  { id: 'variaveis', titulo: 'Variáveis', Icon: Variable },
  { id: 'formularios', titulo: 'Formulários', Icon: LayoutTemplate },
  { id: 'fluxo', titulo: 'Fluxo', Icon: GitBranch },
  { id: 'documentos', titulo: 'Modelos de documentos', Icon: FileText },
  { id: 'recursos', titulo: 'Recursos', Icon: Image },
];

export default function ProtocoloPublicado({ idProtocolo, numeroInicial, aoVoltar }) {
  const { t, locale } = useI18n();
  const [numero, setNumero] = useState(numeroInicial);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [area, setArea] = useState('visao');
  const [formularioId, setFormularioId] = useState(null);
  const [documentoId, setDocumentoId] = useState(null);

  useEffect(() => {
    let cancelado = false;
    executar('CONSULTAR_PROTOCOLO_PUBLICADO', { idProtocolo, numeroVersao: numero })
      .then((resposta) => { if (!cancelado) { setDados(resposta); setErro(''); } })
      .catch((falha) => { if (!cancelado) setErro(falha.message); });
    return () => { cancelado = true; };
  }, [idProtocolo, numero]);

  const variaveis = dados?.variaveis || [];
  const formularios = dados?.formularios || [];
  const etapas = dados?.fluxo?.etapas || [];
  const documentos = dados?.documentos || [];
  const recursos = dados?.recursosAtuais || [];
  const formulario = formularios.find((item) => item.id === formularioId);
  const documento = documentos.find((item) => item.idVersao === documentoId);
  const publicadoEm = dados?.publicadoEm ? new Date(String(dados.publicadoEm).replace(' ', 'T')) : null;
  const dataPublicacao = publicadoEm && !Number.isNaN(publicadoEm.getTime())
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(publicadoEm) : '';

  return <div className="protocolos-shell">
    <button className="protocolos-voltar" type="button" onClick={aoVoltar}>
      <ArrowLeft size={16} />{t('Todos os Protocolos')}
    </button>
    {erro && <Alert severity="error">{erro}</Alert>}
    {!dados && !erro && <p>{t('Carregando Protocolo...')}</p>}
    {dados && <>
      <header className="protocolo-publicado-hero">
        <div className="protocolo-publicado-hero-corpo">
          <span className="protocolo-publicado-kicker"><Check size={14} />{t('PROTOCOLO PUBLICADO')}</span>
          <h1>{dados.titulo}</h1>
          <p>{dados.descricao || t('Sem descrição')}</p>
          <div className="protocolo-publicado-meta">
            <span>{t('Versão')} {dados.numero}</span>
            {dataPublicacao && <span><CalendarDays size={14} /> {t('Publicado em')} {dataPublicacao}</span>}
            <span>{t('Somente leitura')}</span>
          </div>
        </div>
        <TextField select size="small" label={t('Versão publicada')} value={numero}
          className="protocolo-publicado-versao"
          onChange={(evento) => { setDados(null); setNumero(Number(evento.target.value)); setFormularioId(null); setDocumentoId(null); }}>
          {(dados.versoes || []).map((versao) => <MenuItem key={versao} value={versao}>{t('Versão')} {versao}</MenuItem>)}
        </TextField>
      </header>
      <div className="protocolos-central-layout">
        <nav className="protocolos-central-nav" aria-label={t('Áreas do Protocolo')}>
          {secoes.map(({ id, titulo, Icon }) => <button key={id} type="button"
            className={area === id ? 'selecionado' : ''} onClick={() => setArea(id)}>
            <Icon size={17} />{t(titulo)}
          </button>)}
        </nav>
        <main className="protocolos-central-conteudo">
          {area === 'visao' && <>
            <div className="protocolo-publicado-intro">
              <span className="eyebrow">{t('VERSÃO CONSULTADA')}</span>
              <h2>{t('Estrutura do Protocolo')}</h2>
              <p>{t('Confira o percurso, os formulários e os documentos definidos nesta versão publicada.')}</p>
            </div>
            <div className="protocolo-publicado-resumo">
              {secoes.slice(1, 5).map(({ id, titulo, Icon }) => {
                const quantidade = { variaveis: variaveis.length, formularios: formularios.length,
                  fluxo: etapas.length, documentos: documentos.length }[id];
                return <button key={id} className="protocolo-publicado-resumo-card" type="button" onClick={() => setArea(id)}>
                  <span className="protocolo-publicado-resumo-icone"><Icon size={20} /></span>
                  <strong>{quantidade}</strong><span>{t(titulo)}</span><ArrowRight size={16} />
                </button>;
              })}
            </div>
            <div className="protocolo-publicado-detalhe">
              <h3>{t('Percurso')}</h3>
              <p>{etapas.length ? `${t('Início')} → ${etapas.find((item) => item.id === dados.fluxo?.inicio)?.titulo || etapas[0].titulo} · ${etapas.length} ${t('etapas no fluxo')}` : t('Nenhuma etapa')}</p>
              {etapas.length > 0 && <Button size="small" endIcon={<ArrowRight size={15} />} onClick={() => setArea('fluxo')}>{t('Ver fluxo completo')}</Button>}
            </div>
          </>}
          {area === 'variaveis' && <section>
            <div className="protocolo-publicado-secao-titulo"><h2>{t('Variáveis')}</h2><p>{t('Dados utilizados pelos formulários e documentos desta versão.')}</p></div>
            {variaveis.length ? <div className="protocolo-publicado-lista">{variaveis.map((item) => <article className="protocolo-publicado-linha" key={item.id}>
              <span className="protocolo-publicado-linha-icone"><Variable size={18} /></span>
              <div><h3>{item.nome}</h3><p>{item.descricao || item.codigo}</p></div>
              <span className="protocolo-publicado-codigo">{item.codigo}</span>
            </article>)}</div> : <div className="protocolo-publicado-vazio">{t('Nenhuma variável nesta versão.')}</div>}
          </section>}
          {area === 'formularios' && <section>
            <div className="protocolo-publicado-secao-titulo"><h2>{t('Formulários')}</h2><p>{t('Veja os campos na ordem em que foram definidos.')}</p></div>
            {formularios.length ? <div className="protocolo-publicado-lista">{formularios.map((item) => <article className="protocolo-publicado-linha" key={item.id}>
              <span className="protocolo-publicado-linha-icone"><LayoutTemplate size={18} /></span>
              <div><h3>{item.titulo}</h3><p>{item.descricao || `${item.campos?.length || 0} ${t('campos')}`}</p></div>
              <Button size="small" onClick={() => setFormularioId(item.id)}>{t('Visualizar')}</Button>
            </article>)}</div> : <div className="protocolo-publicado-vazio">{t('Nenhum formulário nesta versão.')}</div>}
            {formulario && <div className="protocolo-publicado-detalhe">
              <button type="button" className="protocolos-voltar" onClick={() => setFormularioId(null)}><ArrowLeft size={15} /> {t('Fechar prévia')}</button>
              <h3>{formulario.titulo}</h3><p>{formulario.descricao}</p>
              {formulario.campos?.map((campo, indice) => {
                const variavel = variaveis.find((item) => item.id === campo.idVariavel);
                return <div key={`${campo.idVariavel}-${indice}`} className="protocolo-publicado-campo">
                  <span>{variavel?.nome || campo.idVariavel}{campo.obrigatorio ? ' *' : ''}</span>
                  <small>{variavel?.codigo || ''} · {campo.acesso === 'L' ? t('Somente leitura') : t('Preenchimento')}</small>
                </div>;
              })}
            </div>}
          </section>}
          {area === 'fluxo' && <section>
            <div className="protocolo-publicado-secao-titulo"><h2>{t('Fluxo')}</h2><p>{t('Percurso publicado e detalhes de cada etapa.')}</p></div>
            <FluxoPublicado fluxo={dados.fluxo} formularios={formularios} documentos={documentos} />
          </section>}
          {area === 'documentos' && <section>
            <div className="protocolo-publicado-secao-titulo"><h2>{t('Modelos de documentos')}</h2><p>{t('Modelos vinculados a esta versão publicada.')}</p></div>
            {documentos.length ? <div className="protocolo-publicado-lista">{documentos.map((item) => <article className="protocolo-publicado-linha" key={item.idVersao}>
              <span className="protocolo-publicado-linha-icone"><FileText size={18} /></span>
              <div><h3>{item.titulo}</h3><p>{item.observacoes || item.arquivoNome || item.codigo}</p></div>
              <span className="protocolo-publicado-codigo">{item.tipoModelo === 'H' ? 'HTML' : 'PDF'}</span>
              <Button size="small" onClick={() => setDocumentoId(item.idVersao)}>{t('Visualizar')}</Button>
            </article>)}</div> : <div className="protocolo-publicado-vazio">{t('Nenhum modelo nesta versão.')}</div>}
            {documento && <div className="protocolo-publicado-detalhe">
              <button type="button" className="protocolos-voltar" onClick={() => setDocumentoId(null)}><ArrowLeft size={15} /> {t('Fechar prévia')}</button>
              <h3>{documento.titulo}</h3><p>{documento.observacoes}</p>
              {documento.tipoModelo === 'H'
                ? <ModeloHtmlPublicado documento={documento} variaveis={variaveis} />
                : <iframe title={documento.titulo} className="protocolo-publicado-pdf"
                  src={`/ArgousForms/arquivo-conteudo?idArquivo=${encodeURIComponent(documento.idArquivo)}&idArquivoVersao=${encodeURIComponent(documento.idArquivoVersao)}&modo=visualizar`} />}
            </div>}
          </section>}
          {area === 'recursos' && <section>
            <div className="protocolo-publicado-secao-titulo"><h2>{t('Recursos atuais do Protocolo')}</h2><p>{t('Os recursos ainda não possuem histórico por versão.')}</p></div>
            {recursos.length ? <div className="protocolo-publicado-lista">{recursos.map((item) => <article className="protocolo-publicado-linha" key={item.idArquivoVersao}>
              <span className="protocolo-publicado-linha-icone"><Image size={18} /></span><h3>{item.codigo}</h3>
            </article>)}</div> : <div className="protocolo-publicado-vazio">{t('Nenhum recurso vinculado.')}</div>}
          </section>}
        </main>
      </div>
    </>}
  </div>;
}
