'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import { ArrowLeft, FileText, GitBranch, History, Image, LayoutTemplate, MoreHorizontal, Plus, Settings2, Variable } from 'lucide-react';
import { useI18n } from '../../components/i18n/i18n.js';
import { executar } from '../login/autenticacao.js';
import FluxoPublicado from './fluxo-publicado.js';

const secoes = [
  { id: 'fluxo', nome: 'Fluxo', Icone: GitBranch },
  { id: 'biblioteca', nome: 'Biblioteca', Icone: LayoutTemplate },
  { id: 'configuracoes', nome: 'Configurações', Icone: Settings2 },
  { id: 'versoes', nome: 'Versões', Icone: History },
];

const biblioteca = [
  { id: 'campos', nome: 'Campos', Icone: Variable, chave: 'variaveis' },
  { id: 'formularios', nome: 'Formulários', Icone: LayoutTemplate, chave: 'formularios' },
  { id: 'documentos', nome: 'Modelos de documento', Icone: FileText, chave: 'documentos' },
  { id: 'imagens', nome: 'Imagens', Icone: Image, chave: 'recursosAtuais' },
];

export default function ProtocolosNovo({ usuarioId, usuarioPapeis = [] }) {
  const { t } = useI18n();
  const [lista, setLista] = useState([]);
  const [protocolo, setProtocolo] = useState(null);
  const [publicado, setPublicado] = useState(null);
  const [versoesPublicadas, setVersoesPublicadas] = useState([]);
  const [fluxoRascunho, setFluxoRascunho] = useState(null);
  const [secao, setSecao] = useState('fluxo');
  const [itemBiblioteca, setItemBiblioteca] = useState('campos');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [novo, setNovo] = useState(false);
  const [tituloNovo, setTituloNovo] = useState('');
  const [descricaoNova, setDescricaoNova] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [editandoTitulo, setEditandoTitulo] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [menuAberto, setMenuAberto] = useState(false);
  const [prefixo, setPrefixo] = useState('');
  const [sequencia, setSequencia] = useState('A');

  useEffect(() => {
    let ativo = true;
    executar('LISTAR_PROTOCOLOS').then((dados) => {
      if (ativo) setLista(dados.protocolos || []);
    }).catch((falha) => {
      if (ativo) setErro(falha.message);
    }).finally(() => {
      if (ativo) setCarregando(false);
    });
    return () => { ativo = false; };
  }, [usuarioId]);

  async function abrir(item) {
    setCarregando(true);
    setErro('');
    setSecao('fluxo');
    setItemBiblioteca('campos');
    setMenuAberto(false);
    try {
      if (item.temRascunho && item.proprio !== false) {
        const [dados, fluxoAtual, versaoAtual] = await Promise.all([
          executar('CONSULTAR_PROTOCOLO', { idProtocolo: item.id }),
          executar('CONSULTAR_FLUXO_PROTOCOLO', { idProtocolo: item.id }),
          item.versaoPublicada > 0
            ? executar('CONSULTAR_PROTOCOLO_PUBLICADO', { idProtocolo: item.id, numeroVersao: item.versaoPublicada })
            : Promise.resolve(null),
        ]);
        setProtocolo(dados);
        setFluxoRascunho(fluxoAtual);
        setVersoesPublicadas(versaoAtual?.versoes || []);
        setPublicado(null);
        setTitulo(dados.titulo);
        setPrefixo(dados.prefixo || '');
        setSequencia(dados.sequencia || 'A');
      } else if (item.versaoPublicada > 0) {
        const dados = await executar('CONSULTAR_PROTOCOLO_PUBLICADO', { idProtocolo: item.id, numeroVersao: item.versaoPublicada });
        setProtocolo({ ...item, titulo: dados.titulo, descricao: dados.descricao });
        setPublicado(dados);
        setVersoesPublicadas(dados.versoes || []);
        setFluxoRascunho(null);
        setTitulo(dados.titulo);
      } else {
        setErro(t('Este Protocolo não está disponível para consulta.'));
      }
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setCarregando(false);
    }
  }

  async function criar() {
    if (!tituloNovo.trim()) return;
    setSalvando(true);
    setErro('');
    try {
      const criado = await executar('CRIAR_PROTOCOLO', { titulo: tituloNovo.trim(), descricao: descricaoNova.trim() });
      const dados = await executar('CONSULTAR_PROTOCOLO', { idProtocolo: criado.id });
      setLista((atual) => [{ id: dados.id, titulo: dados.titulo, descricao: dados.descricao, temRascunho: true, proprio: true, versaoPublicada: 0 }, ...atual]);
      setProtocolo(dados);
      setPublicado(null);
      setVersoesPublicadas([]);
      setFluxoRascunho(null);
      setSecao('fluxo');
      setTitulo(dados.titulo);
      setPrefixo(dados.prefixo || '');
      setSequencia(dados.sequencia || 'A');
      setNovo(false);
      setTituloNovo('');
      setDescricaoNova('');
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setSalvando(false);
    }
  }

  async function salvarTitulo() {
    if (!titulo.trim() || titulo.trim() === protocolo.titulo) {
      setTitulo(protocolo.titulo);
      setEditandoTitulo(false);
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      await executar('SALVAR_DADOS_PROTOCOLO', { idProtocolo: protocolo.id, titulo: titulo.trim(),
        descricao: protocolo.descricao, gestorFinaliza: protocolo.rascunho.gestorFinaliza });
      setProtocolo((atual) => ({ ...atual, titulo: titulo.trim() }));
      setLista((atual) => atual.map((item) => item.id === protocolo.id ? { ...item, titulo: titulo.trim() } : item));
      setEditandoTitulo(false);
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setSalvando(false);
    }
  }

  async function salvarNumeracao() {
    if (prefixo && !/^[A-Z0-9]{2,6}$/.test(prefixo)) { setErro(t('Use de 2 a 6 letras maiúsculas ou dígitos no prefixo.')); return; }
    setSalvando(true);
    setErro('');
    try {
      const atualizado = await executar('SALVAR_DADOS_PROTOCOLO', { idProtocolo: protocolo.id,
        titulo: protocolo.titulo, descricao: protocolo.descricao, gestorFinaliza: protocolo.rascunho.gestorFinaliza,
        prefixo, sequencia });
      setProtocolo(atualizado);
    } catch (falha) { setErro(falha.message); }
    finally { setSalvando(false); }
  }

  const rascunho = protocolo?.rascunho;
  const dados = rascunho || publicado;
  const versao = rascunho ? (protocolo.versaoPublicada || 0) + 1 : publicado?.numero || protocolo?.versaoPublicada;
  const podeCriar = usuarioPapeis.includes('CRIADOR_DE_PROTOCOLOS') || usuarioPapeis.includes('MODELADOR');
  const fluxo = rascunho ? fluxoRascunho : publicado?.fluxo;

  return <div className="protocolos-novo">
    {erro && <Alert severity="error" onClose={() => setErro('')}>{erro}</Alert>}
    {!protocolo ? <>
      <header className="protocolos-novo-lista-cabecalho">
        <div><span className="eyebrow">{t('ÁREA DO CRIADOR')}</span><h1>{t('Protocolos Novo')}</h1>
          <p>{t('Escolha um Protocolo para acompanhar sua estrutura.')}</p></div>
        {podeCriar && <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setNovo(true)}>{t('Criar Protocolo')}</Button>}
      </header>
      {carregando ? <p>{t('Carregando Protocolos...')}</p> : lista.length ? <div className="protocolos-novo-lista">
        {lista.map((item) => <button key={item.id} type="button" onClick={() => abrir(item)}
          disabled={item.temRascunho && item.proprio === false && !item.versaoPublicada}>
          <GitBranch size={22} /><span><strong>{item.titulo}</strong><small>{item.descricao || t('Sem descrição')}</small></span>
          <Chip size="small" label={t(item.temRascunho ? 'Rascunho' : 'Publicado')} color={item.temRascunho ? 'warning' : 'success'} />
        </button>)}
      </div> : <p>{t('Nenhum Protocolo disponível.')}</p>}
    </> : <>
      <header className="protocolos-novo-cabecalho">
        <div className="protocolos-novo-identidade">
          <button type="button" className="protocolos-novo-voltar" onClick={() => { setProtocolo(null); setPublicado(null); setEditandoTitulo(false); }}>
            <ArrowLeft size={17} />{t('Protocolos')}
          </button>
          {editandoTitulo ? <><TextField size="small" value={titulo} onChange={(evento) => setTitulo(evento.target.value)}
            onKeyDown={(evento) => { if (evento.key === 'Enter') salvarTitulo(); if (evento.key === 'Escape') setEditandoTitulo(false); }}
            slotProps={{ htmlInput: { 'aria-label': t('Nome apresentado do Protocolo') } }} />
            <Button size="small" onClick={salvarTitulo} disabled={salvando}>{t('Salvar')}</Button>
            <Button size="small" onClick={() => { setTitulo(protocolo.titulo); setEditandoTitulo(false); }} disabled={salvando}>{t('Cancelar')}</Button></>
            : <button type="button" className="protocolos-novo-titulo" disabled={!rascunho || salvando}
              title={rascunho ? t('Editar nome do Protocolo') : undefined} onClick={() => setEditandoTitulo(true)}>{protocolo.titulo}</button>}
          <Chip size="small" label={`${t(rascunho ? 'Rascunho' : 'Publicado')} · ${t('versão')} ${versao}`} color={rascunho ? 'warning' : 'success'} />
        </div>
        <nav className="protocolos-novo-abas" aria-label={t('Seções do Protocolo')}>
          {secoes.map(({ id, nome, Icone }) => <button key={id} type="button" aria-current={secao === id ? 'page' : undefined}
            className={secao === id ? 'ativo' : ''} onClick={() => setSecao(id)}><Icone size={16} />{t(nome)}</button>)}
        </nav>
        <div className="protocolos-novo-acoes">
          <span className="protocolos-novo-pendencias" title={t('A verificação das pendências será adicionada em uma próxima etapa.')}>{t('Verificação pendente')}</span>
          <Button size="small" variant="outlined" disabled title={t('A simulação será adicionada em uma próxima etapa.')}>{t('Simular')}</Button>
          {rascunho && <Button size="small" variant="contained" disabled title={t('A verificação das pendências será adicionada em uma próxima etapa.')}>{t('Publicar')}</Button>}
          <div className="protocolos-novo-menu">
            <button type="button" aria-label={t('Mais opções')} aria-expanded={menuAberto} onClick={() => setMenuAberto((atual) => !atual)}><MoreHorizontal size={20} /></button>
            {menuAberto && <div role="menu"><span role="menuitem" aria-disabled="true">{t('Descartar rascunho')} · {t('em construção')}</span></div>}
          </div>
        </div>
      </header>
      <div className="protocolos-novo-area">
        {secao === 'biblioteca' && <aside className="protocolos-novo-biblioteca" aria-label={t('Seções da biblioteca')}>
          <h2>{t('Biblioteca')}</h2>
          {biblioteca.map(({ id, nome, Icone, chave }) => <button key={id} type="button" aria-current={itemBiblioteca === id ? 'page' : undefined}
            className={itemBiblioteca === id ? 'ativo' : ''} onClick={() => setItemBiblioteca(id)}><Icone size={17} /><span>{t(nome)}</span><small>{dados?.[chave]?.length ?? 0}</small></button>)}
        </aside>}
        <main className="protocolos-novo-conteudo">
          {carregando && <p>{t('Carregando Protocolo...')}</p>}
          {secao === 'fluxo' && <section><h2>{t('Fluxo')}</h2><p>{t('Etapas e encaminhamentos desta versão.')}</p>
            {fluxo?.etapas?.length ? <FluxoPublicado fluxo={fluxo} formularios={dados?.formularios || []} documentos={dados?.documentos || []} />
              : <div className="protocolos-novo-vazio">{t('O fluxo ainda não foi definido. A edição visual será integrada nesta área na próxima etapa.')}</div>}</section>}
          {secao === 'biblioteca' && <section><h2>{t(biblioteca.find((item) => item.id === itemBiblioteca)?.nome)}</h2>
            {itemBiblioteca === 'campos' && <><p>{t('Informações que o Processo utiliza nos formulários e documentos.')}</p>
              {(dados?.variaveis || []).map((campo) => <article key={campo.id} className="protocolos-novo-linha"><strong>{campo.nome}</strong><small>{t('Código técnico')}: {campo.codigo}</small></article>)}</>}
            {itemBiblioteca === 'formularios' && (dados?.formularios || []).map((item) => <article key={item.id} className="protocolos-novo-linha"><strong>{item.titulo}</strong><small>{item.descricao}</small></article>)}
            {itemBiblioteca === 'documentos' && (dados?.documentos || []).map((item) => <article key={item.id} className="protocolos-novo-linha"><strong>{item.titulo}</strong><small>{t('Código técnico')}: {item.codigo}</small></article>)}
            {itemBiblioteca === 'imagens' && (dados?.recursosAtuais || []).map((item) => <article key={item.id || item.codigo} className="protocolos-novo-linha"><strong>{item.codigo || item.nome}</strong></article>)}
            {!dados?.[biblioteca.find((item) => item.id === itemBiblioteca)?.chave]?.length && <div className="protocolos-novo-vazio">{t('Nenhum item cadastrado nesta seção.')}</div>}
          </section>}
          {secao === 'configuracoes' && <section><h2>{t('Configurações')}</h2>
            <article className="protocolos-novo-linha"><strong>{t('Nome apresentado')}</strong><span>{protocolo.titulo}</span></article>
            <article className="protocolos-novo-linha"><strong>{t('Observações')}</strong><span>{protocolo.descricao || '—'}</span></article>
            <article className="protocolos-novo-linha"><strong>{t('Pasta associada')}</strong><span>{rascunho?.pastaCaminho || t('Ainda não definida')}</span></article>
            <article className="protocolos-novo-linha"><strong>{t('Conclusão pelo gestor')}</strong><span>{dados?.gestorFinaliza ? t('Necessária') : t('Automática')}</span></article>
            {rascunho && <div className="protocolos-novo-numeracao">
              <TextField label={t('Prefixo do número')} value={prefixo} inputProps={{ maxLength: 6 }}
                error={!!prefixo && !/^[A-Z0-9]{2,6}$/.test(prefixo)}
                helperText={t('Use de 2 a 6 letras maiúsculas ou dígitos. Obrigatório para publicar.')}
                onChange={(evento) => setPrefixo(evento.target.value.toUpperCase())} />
              <TextField select label={t('Numeração')} value={sequencia} onChange={(evento) => setSequencia(evento.target.value)}>
                <MenuItem value="A">{t('Anual')}</MenuItem><MenuItem value="C">{t('Contínua')}</MenuItem>
              </TextField>
              {prefixo && /^[A-Z0-9]{2,6}$/.test(prefixo) && <p>{t('Exemplo de número')}: <code>{prefixo}-{sequencia === 'A' ? `${new Date().getFullYear()}-` : ''}000001</code></p>}
              <Button variant="contained" disabled={salvando} onClick={salvarNumeracao}>{t('Salvar numeração')}</Button>
            </div>}
          </section>}
          {secao === 'versoes' && <section><h2>{t('Versões')}</h2><p>{t('Cada Processo segue na versão em que foi iniciado.')}</p>
            {rascunho && <article className="protocolos-novo-linha"><strong>{t('Rascunho')} · {t('versão')} {versao}</strong><small>{t('Em preparação')}</small></article>}
            {versoesPublicadas.map((numero) => <article key={numero} className="protocolos-novo-linha"><strong>{t('Versão')} {numero}</strong><small>{t('Publicada')}</small></article>)}
            {!rascunho && !protocolo.versaoPublicada && <div className="protocolos-novo-vazio">{t('Nenhuma versão publicada.')}</div>}
          </section>}
        </main>
      </div>
    </>}
    <Dialog open={novo} onClose={() => !salvando && setNovo(false)} fullWidth maxWidth="sm">
      <DialogTitle>{t('Criar Protocolo')}</DialogTitle><DialogContent className="protocolos-novo-dialogo">
        <TextField fullWidth required label={t('Título')} value={tituloNovo} onChange={(evento) => setTituloNovo(evento.target.value)} />
        <TextField fullWidth multiline minRows={3} label={t('Descrição (opcional)')} value={descricaoNova} onChange={(evento) => setDescricaoNova(evento.target.value)} />
      </DialogContent><DialogActions><Button onClick={() => setNovo(false)} disabled={salvando}>{t('Cancelar')}</Button>
        <Button variant="contained" onClick={criar} disabled={salvando || !tituloNovo.trim()}>{t('Criar Protocolo')}</Button></DialogActions>
    </Dialog>
  </div>;
}
