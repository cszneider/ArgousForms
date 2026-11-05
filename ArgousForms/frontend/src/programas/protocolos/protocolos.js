'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Backdrop,
  Button,
  Chip,
  CircularProgress,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  TextField,
} from '@mui/material';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  FileText,
  GitBranch,
  LayoutTemplate,
  Plus,
  Settings2,
  Trash2,
  Variable,
  X,
} from 'lucide-react';
import { useI18n } from '../../components/i18n/i18n.js';
import { executar } from '../login/autenticacao.js';
import { enviarArquivo } from '../gestor-documentos/upload-arquivo.js';
import {
  nomeTipo,
  TIPOS_DADO,
} from './protocolos-store.js';
import SeletorPasta from './seletor-pasta.js';
import PdfCampos from './pdf-campos.js';
import ModeloHtmlEditor from './modelo-html-editor.js';
import VariaveisInstituicao from './variaveis-instituicao.js';
import FluxoEditorCarregador from './fluxo-editor-carregador.js';
import { REGEX_PRONTAS, normalizarValorExemplo, validarDefinicaoTexto } from './variavel-texto.js';

const areas = [
  { id: 'variaveis', titulo: 'Variáveis', Icon: Variable },
  { id: 'formularios', titulo: 'Formulários', Icon: LayoutTemplate },
  { id: 'fluxo', titulo: 'Fluxo', Icon: GitBranch },
  { id: 'documentos', titulo: 'Modelos de documentos', Icon: FileText },
];

function dataCurta(valor, locale) {
  if (!valor) return '';
  const data = new Date(String(valor).replace(' ', 'T'));
  if (Number.isNaN(data.getTime())) return String(valor);
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(data);
}

function Vazio({ titulo, descricao, acao, aoClicar }) {
  return (
    <div className="protocolos-vazio">
      <h3>{titulo}</h3>
      <p>{descricao}</p>
      {acao && (
        <Button
          variant="outlined"
          startIcon={<Plus size={17} />}
          onClick={aoClicar}
        >
          {acao}
        </Button>
      )}
    </div>
  );
}

export default function Protocolos({ usuarioId, usuarioPapeis = [] }) {
  const { t, locale } = useI18n();
  const [carregado, setCarregado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [protocolos, setProtocolos] = useState([]);
  const [selecionado, setSelecionado] = useState(null);
  const [area, setArea] = useState('visao');
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('rascunhos');
  const [cadastro, setCadastro] = useState(null);
  const [exclusao, setExclusao] = useState(null);
  const [publicacao, setPublicacao] = useState(false);
  const [variavelEdicao, setVariavelEdicao] = useState(null);
  const [formularioEdicao, setFormularioEdicao] = useState(null);
  const [formularioAberto, setFormularioAberto] = useState(null);
  const [variavelParaAdicionar, setVariavelParaAdicionar] = useState('');
  const [acessoNovoCampo, setAcessoNovoCampo] = useState('E');
  const [erro, setErro] = useState('');
  const [seletorPastaAberto, setSeletorPastaAberto] = useState(false);
  const [modeloPdf, setModeloPdf] = useState(null);
  const [modeloHtml, setModeloHtml] = useState(null);
  const [modeloExclusao, setModeloExclusao] = useState(null);
  const [modeloCampos, setModeloCampos] = useState(null);
  const [variaveisInstituicaoPdf, setVariaveisInstituicaoPdf] = useState([]);
  const [variaveisInstituicaoCadastro, setVariaveisInstituicaoCadastro] = useState([]);
  const [variaveisSistema, setVariaveisSistema] = useState([]);
  const [erroVariaveisInstituicaoPdf, setErroVariaveisInstituicaoPdf] = useState('');
  const [progressoPdf, setProgressoPdf] = useState(0);
  const [mostrarVariaveisInstituicao, setMostrarVariaveisInstituicao] = useState(false);
  const buscandoVariaveis = Boolean(modeloCampos || variavelEdicao);
  const editandoVariavel = Boolean(variavelEdicao);

  useEffect(() => {
    let cancelado = false;
    executar('LISTAR_PROTOCOLOS')
      .then((dados) => { if (!cancelado) setProtocolos(dados.protocolos || []); })
      .catch((falha) => { if (!cancelado) setErro(falha.message); })
      .finally(() => { if (!cancelado) setCarregado(true); });
    return () => { cancelado = true; };
  }, [usuarioId]);

  useEffect(() => {
    if (!buscandoVariaveis) return;
    let cancelado = false;
    executar('LISTAR_VARIAVEIS_INSTITUICAO')
      .then((dados) => {
        if (cancelado) return;
        const atributos = dados.variaveis || [];
        setVariaveisInstituicaoCadastro(atributos.filter((item) => item.tipo === 'V' && item.ativo));
        const porId = new Map(atributos.map((item) => [item.idAtributo, item]));
        const caminho = (item) => {
          const partes = [item.codigo];
          const visitados = new Set([item.idAtributo]);
          let pai = porId.get(item.idAtributoPai);
          while (pai && !visitados.has(pai.idAtributo)) {
            partes.unshift(pai.codigo);
            visitados.add(pai.idAtributo);
            pai = porId.get(pai.idAtributoPai);
          }
          return partes.join('.');
        };
        setVariaveisInstituicaoPdf(atributos.filter((item) => item.tipo === 'V').map((item) => ({
          id: `instituicao:${item.idAtributo}`, idAtributo: item.idAtributo,
          codigo: caminho(item), nome: caminho(item), tipo: 'S', valorInstituicao: item.valor, ativo: item.ativo,
        })));
        setErroVariaveisInstituicaoPdf('');
      })
      .catch((falha) => { if (!cancelado) setErroVariaveisInstituicaoPdf(falha.message); });
    return () => { cancelado = true; };
  }, [buscandoVariaveis]);

  useEffect(() => {
    if (!editandoVariavel) return;
    let cancelado = false;
    executar('CATALOGO_VARIAVEIS_SISTEMA')
      .then((dados) => { if (!cancelado) setVariaveisSistema(dados.variaveis || []); })
      .catch((falha) => { if (!cancelado) setErro(falha.message); });
    return () => { cancelado = true; };
  }, [editandoVariavel]);

  const protocolo = protocolos.find((item) => item.id === selecionado);
  const modeloParaExcluir = protocolo?.rascunho?.documentos.find((item) => item.id === modeloExclusao);
  const formulario = protocolo?.rascunho?.formularios.find(
    (item) => item.id === formularioAberto,
  );

  async function atualizarLista(idProtocolo) {
    const dados = await executar('LISTAR_PROTOCOLOS');
    if (!idProtocolo) {
      setProtocolos(dados.protocolos || []);
      return;
    }
    const completo = await executar('CONSULTAR_PROTOCOLO', { idProtocolo });
    setProtocolos((dados.protocolos || []).map((item) => item.id === idProtocolo ? completo : item));
  }

  async function executarEdicao(operacao, dados, aoConcluir) {
    if (salvando) return;
    setSalvando(true);
    setErro('');
    try {
      const resultado = await executar(operacao, dados);
      await atualizarLista(operacao === 'EXCLUIR_PROTOCOLO' ? null : dados.idProtocolo || resultado.id);
      aoConcluir?.(resultado);
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setSalvando(false);
    }
  }

  async function abrirProtocolo(idProtocolo) {
    setSalvando(true);
    setErro('');
    try {
      const completo = await executar('CONSULTAR_PROTOCOLO', { idProtocolo });
      if (!completo.rascunho) {
        setErro(t('Este Protocolo não possui rascunho para edição.'));
        return;
      }
      setProtocolos((atuais) => atuais.map((item) => item.id === idProtocolo ? completo : item));
      setSelecionado(idProtocolo);
      setArea('visao');
      setFormularioAberto(null);
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setSalvando(false);
    }
  }

  async function excluirProtocolo() {
    if (!exclusao) return;
    await executarEdicao('EXCLUIR_PROTOCOLO', { idProtocolo: exclusao }, () => {
      setExclusao(null);
      setSelecionado(null);
      setArea('visao');
      setFormularioAberto(null);
    });
  }

  async function publicarProtocolo() {
    if (!protocolo) return;
    await executarEdicao('PUBLICAR_PROTOCOLO', { idProtocolo: protocolo.id }, () => {
      setPublicacao(false);
      setSelecionado(null);
      setArea('visao');
    });
  }

  async function escolherPasta(pasta) {
    await executarEdicao('ASSOCIAR_PASTA_PROTOCOLO', { idProtocolo: protocolo.id, idPasta: pasta.idPasta }, () => {
      setSeletorPastaAberto(false);
    });
  }

  async function criarModeloPdf() {
    if (!modeloPdf || salvando) return;
    const codigo = modeloPdf.codigo.trim();
    const titulo = modeloPdf.titulo.trim();
    if (!codigo || !titulo || (!modeloPdf.id && !modeloPdf.arquivo)) {
      setErro(t('Informe código, título e arquivo PDF.'));
      return;
    }
    if (!modeloPdf.id && protocolo.rascunho.documentos.some((item) => item.codigo === codigo)) {
      setErro(t('Já existe um modelo de documento com este código.'));
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      if (modeloPdf.id) {
        await executar('ALTERAR_MODELO_PDF', { idProtocolo: protocolo.id, idModelo: modeloPdf.id,
          titulo, observacoes: modeloPdf.observacoes });
        await atualizarLista(protocolo.id);
        setModeloPdf(null);
        return;
      }
      const dados = new FormData();
      dados.append('idProtocoloModelo', protocolo.id);
      dados.append('codigoModelo', codigo);
      dados.append('titulo', titulo);
      dados.append('observacoesModelo', modeloPdf.observacoes);
      dados.append('arquivo', modeloPdf.arquivo);
      await enviarArquivo(dados, setProgressoPdf);
      await atualizarLista(protocolo.id);
      setModeloPdf(null);
      setProgressoPdf(0);
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setSalvando(false);
    }
  }

  async function salvarModeloHtml(dados) {
    setSalvando(true);
    try {
      await executar('SALVAR_MODELO_HTML', { idProtocolo: protocolo.id, idModelo: dados.id || null,
        codigo: dados.codigo.trim(), titulo: dados.titulo.trim(), observacoes: dados.observacoes || '',
        css: dados.css || '', partes: dados.partes });
      await atualizarLista(protocolo.id);
      setModeloHtml(null);
    } finally {
      setSalvando(false);
    }
  }

  async function excluirModelo() {
    if (!modeloExclusao) return;
    const modelo = protocolo.rascunho.documentos.find((item) => item.id === modeloExclusao);
    await executarEdicao(modelo?.tipoModelo === 'H' ? 'EXCLUIR_MODELO_HTML' : 'EXCLUIR_MODELO_PDF',
      { idProtocolo: protocolo.id, idModelo: modeloExclusao },
      () => setModeloExclusao(null));
  }

  async function salvarCadastro() {
    const titulo = cadastro?.titulo.trim();
    if (!titulo) {
      setErro(t('Informe o título do Protocolo.'));
      return;
    }
    if (cadastro.modo === 'novo') {
      await executarEdicao('CRIAR_PROTOCOLO', { titulo, descricao: cadastro.descricao }, (novo) => {
        setSelecionado(novo.id);
        setArea('visao');
        setCadastro(null);
      });
      return;
    }
    await executarEdicao('SALVAR_DADOS_PROTOCOLO', { idProtocolo: protocolo.id, titulo, descricao: cadastro.descricao }, () => setCadastro(null));
  }

  async function salvarVariavel() {
    const nome = variavelEdicao?.nome.trim();
    const codigo = variavelEdicao?.codigo.trim();
    if (!nome || !codigo) {
      setErro(t('Informe nome e código da variável.'));
      return;
    }
    if (
      protocolo.rascunho.variaveis.some(
        (item) =>
          item.id !== variavelEdicao.id &&
          item.codigo.toLowerCase() === codigo.toLowerCase(),
      )
    ) {
      setErro(t('Já existe uma variável com este código.'));
      return;
    }
    const definicao = { ...variavelEdicao.definicao };
    if (variavelEdicao.tipo === 'S') definicao.texto ||= {};
    else delete definicao.texto;
    if (variavelEdicao.tipo === 'S') {
      const falha = validarDefinicaoTexto(definicao.texto || {});
      if (falha) { setErro(t(falha)); return; }
    }
    if (definicao.valorExemplo !== undefined) {
      const exemplo = normalizarValorExemplo(definicao.valorExemplo, definicao, variavelEdicao.tipo);
      if (exemplo.erro) { setErro(t(exemplo.erro)); return; }
      definicao.valorExemplo = exemplo.valor;
    }
    await executarEdicao('SALVAR_VARIAVEL_PROTOCOLO', {
      idProtocolo: protocolo.id,
      idVariavel: variavelEdicao.id || null,
      nome, codigo, tipo: variavelEdicao.tipo, descricao: variavelEdicao.descricao.trim(),
      definicao,
    }, () => setVariavelEdicao(null));
  }

  function alterarRegraTexto(chave, valor) {
    setVariavelEdicao((atual) => ({
      ...atual,
      definicao: {
        ...atual.definicao,
        texto: { ...atual.definicao?.texto, [chave]: valor },
      },
    }));
  }

  async function salvarFormulario() {
    const titulo = formularioEdicao?.titulo.trim();
    if (!titulo) {
      setErro(t('Informe o título do formulário.'));
      return;
    }
    await executarEdicao('SALVAR_FORMULARIO_PROTOCOLO', {
      idProtocolo: protocolo.id,
      idFormulario: formularioEdicao.id || null,
      titulo, descricao: formularioEdicao.descricao.trim(), campos: formularioEdicao.campos || [],
    }, (resultado) => {
      setFormularioAberto(resultado.idFormulario);
      setFormularioEdicao(null);
    });
  }

  async function atualizarCampos(campos) {
    await executarEdicao('SALVAR_FORMULARIO_PROTOCOLO', {
      idProtocolo: protocolo.id, idFormulario: formulario.id,
      titulo: formulario.titulo, descricao: formulario.descricao, campos,
    });
  }

  function adicionarCampo() {
    if (!variavelParaAdicionar || !formulario) return;
    if (
      formulario.campos.some(
        (campo) => campo.idVariavel === variavelParaAdicionar,
      )
    )
      return;
    atualizarCampos([
      ...formulario.campos,
      {
        idVariavel: variavelParaAdicionar,
        acesso: acessoNovoCampo,
        obrigatorio: false,
        apresentacao: '1',
      },
    ]);
    setVariavelParaAdicionar('');
  }

  function alterarCampo(indice, alteracao) {
    atualizarCampos(
      formulario.campos.map((campo, posicao) =>
        posicao === indice ? { ...campo, ...alteracao } : campo,
      ),
    );
  }

  function moverCampo(indice, deslocamento) {
    const campos = [...formulario.campos];
    const destino = indice + deslocamento;
    if (destino < 0 || destino >= campos.length) return;
    [campos[indice], campos[destino]] = [campos[destino], campos[indice]];
    atualizarCampos(campos);
  }

  const visiveis = protocolos.filter((item) => {
    const corresponde = `${item.titulo} ${item.descricao}`
      .toLocaleLowerCase(locale)
      .includes(busca.toLocaleLowerCase(locale));
    return (
      corresponde &&
      (filtro === 'todos' ||
        (filtro === 'rascunhos' && (item.temRascunho || !!item.rascunho)) ||
        (filtro === 'publicados' && item.versaoPublicada > 0))
    );
  });

  if (!carregado)
    return (
      <div className="protocolos-shell">
        <p>{t('Carregando Protocolos...')}</p>
      </div>
    );

  if (mostrarVariaveisInstituicao) return <VariaveisInstituicao aoVoltar={() => setMostrarVariaveisInstituicao(false)} />;

  return (
    <div className="protocolos-shell">
      <Backdrop open={salvando} sx={{ zIndex: (tema) => tema.zIndex.modal + 1 }}>
        <CircularProgress color="inherit" />
      </Backdrop>
      {erro && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro('')}>{erro}</Alert>}
      {!protocolo ? (
        <>
          <header className="protocolos-heading">
            <div>
              <span className="eyebrow">{t('ÁREA DO CRIADOR')}</span>
              <h1>{t('Protocolos')}</h1>
              <p>
                {t(
                  'Organize formulários, percurso e documentos de cada atividade.',
                )}
              </p>
            </div>
            <div className="protocolos-central-acoes">
            {usuarioPapeis.includes('MODELADOR') && <Button variant="outlined" startIcon={<Variable size={18} />}
              onClick={() => setMostrarVariaveisInstituicao(true)}>{t('Variáveis da instituição')}</Button>}
            <Button
              variant="contained"
              startIcon={<Plus size={18} />}
              onClick={() => {
                setErro('');
                setCadastro({ modo: 'novo', titulo: '', descricao: '' });
              }}
            >
              {t('Criar Protocolo')}
            </Button>
            </div>
          </header>
          <div className="protocolos-filtros">
            <TextField
              size="small"
              label={t('Buscar Protocolo')}
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
            />
            <div
              className="protocolos-segmentos"
              aria-label={t('Filtrar Protocolos')}
            >
              {[
                ['rascunhos', 'Rascunhos'],
                ['publicados', 'Publicados'],
                ['todos', 'Todos'],
              ].map(([valor, rotulo]) => (
                <button
                  key={valor}
                  type="button"
                  className={filtro === valor ? 'selecionado' : ''}
                  onClick={() => setFiltro(valor)}
                >
                  {t(rotulo)}
                </button>
              ))}
            </div>
          </div>
          {visiveis.length ? (
            <div className="protocolos-lista">
              {visiveis.map((item) => (
                <article className="protocolos-item" key={item.id}>
                  <div className="protocolos-item-icon">
                    <GitBranch size={22} />
                  </div>
                  <div className="protocolos-item-corpo">
                    <div className="protocolos-item-titulo">
                      <h2>{item.titulo}</h2>
                      <Chip
                        size="small"
                        label={t(item.temRascunho || item.rascunho ? 'Rascunho' : 'Publicado')}
                        color={item.temRascunho || item.rascunho ? 'warning' : 'success'}
                      />
                    </div>
                    <p>{item.descricao || t('Sem descrição')}</p>
                    <small>
                      {t('Atualizado em')}{' '}
                      {dataCurta(item.atualizadoEm, locale)}
                    </small>
                  </div>
                  {(item.temRascunho || item.rascunho) && <Button
                    variant="outlined"
                    endIcon={<ArrowRight size={16} />}
                    onClick={() => abrirProtocolo(item.id)}
                  >
                    {t('Continuar edição')}
                  </Button>}
                </article>
              ))}
            </div>
          ) : (
            <Vazio
              titulo={t(
                protocolos.length
                  ? 'Nenhum Protocolo neste filtro'
                  : 'Seu primeiro Protocolo começa aqui',
              )}
              descricao={t(
                protocolos.length
                  ? 'Altere a busca ou escolha outro filtro.'
                  : 'Dê um título à atividade. Depois você poderá montar formulários, fluxo e documentos no seu ritmo.',
              )}
              acao={!protocolos.length ? t('Criar Protocolo') : null}
              aoClicar={() => {
                setErro('');
                setCadastro({ modo: 'novo', titulo: '', descricao: '' });
              }}
            />
          )}
        </>
      ) : (
        <>
          <button
            className="protocolos-voltar"
            type="button"
            onClick={() => {
              setSelecionado(null);
              setArea('visao');
              setFormularioAberto(null);
            }}
          >
            <ArrowLeft size={16} />
            {t('Todos os Protocolos')}
          </button>
          <header className="protocolos-central-heading">
            <div>
              <span className="eyebrow">{t('CENTRAL DO PROTOCOLO')}</span>
              <div className="protocolos-titulo-linha">
                <h1>{protocolo.titulo}</h1>
                <Chip label={t('Rascunho')} size="small" color="warning" />
              </div>
              <p>{protocolo.descricao || t('Sem descrição')}</p>
            </div>
            <div className="protocolos-central-acoes">
              {usuarioPapeis.includes('GESTOR_DE_PROTOCOLOS') && <Button variant="contained"
                onClick={() => setPublicacao(true)}>{t('Publicar Protocolo')}</Button>}
              <Button
                variant="outlined"
                startIcon={<Settings2 size={16} />}
                onClick={() => {
                  setErro('');
                  setCadastro({
                    modo: 'editar',
                    titulo: protocolo.titulo,
                    descricao: protocolo.descricao,
                  });
                }}
              >
                {t('Editar dados')}
              </Button>
              <Button
                color="error"
                startIcon={<Trash2 size={16} />}
                onClick={() => {
                  setErro('');
                  setExclusao(protocolo.id);
                }}
              >
                {t('Excluir Protocolo')}
              </Button>
            </div>
          </header>
          <div className="protocolos-central-layout">
            <nav
              className="protocolos-central-nav"
              aria-label={t('Áreas do Protocolo')}
            >
              <button
                className={area === 'visao' ? 'selecionado' : ''}
                type="button"
                onClick={() => setArea('visao')}
              >
                {t('Visão do Protocolo')}
              </button>
              {areas.map(({ id, titulo, Icon }) => (
                <button
                  key={id}
                  className={area === id ? 'selecionado' : ''}
                  type="button"
                  onClick={() => {
                    setArea(id);
                    setFormularioAberto(null);
                  }}
                >
                  <Icon size={17} />
                  {t(titulo)}
                </button>
              ))}
            </nav>
            <div className="protocolos-central-conteudo">
              {area === 'visao' && (
                <>
                  <div className="protocolos-intro">
                    <span className="eyebrow">
                      {t('SEU ESPAÇO DE TRABALHO')}
                    </span>
                    <h2>{t('Construa uma parte de cada vez')}</h2>
                    <p>
                      {t(
                        'Comece pelos formulários; crie variáveis quando precisar. Depois organize as etapas e os documentos que o processo poderá gerar.',
                      )}
                    </p>
                  </div>
                  <div className="protocolos-area-grid">
                    {areas.map(({ id, titulo, Icon }) => (
                      <button
                        key={id}
                        type="button"
                        className="protocolos-area-card"
                        onClick={() => setArea(id)}
                      >
                        <span className="protocolos-area-icon">
                          <Icon size={21} />
                        </span>
                        <span className="protocolos-area-cabecalho">
                          <strong>{t(titulo)}</strong>
                          <ArrowRight size={18} />
                        </span>
                        <small>
                          {
                            protocolo.rascunho[
                              id === 'fluxo'
                                ? 'etapas'
                                : id === 'documentos'
                                  ? 'documentos'
                                  : id
                            ].length
                          }{' '}
                          {t(
                            id === 'fluxo'
                              ? 'etapas'
                              : id === 'documentos'
                                ? 'modelos de documentos'
                                : titulo,
                          )}
                        </small>
                        <span>
                          {t(
                            id === 'variaveis'
                              ? 'Defina os dados que percorrem o processo.'
                              : id === 'formularios'
                                ? 'Monte as telas que as pessoas preencherão.'
                                : id === 'fluxo'
                                  ? 'Organize o percurso e as responsabilidades.'
                                  : 'Defina a apresentação dos documentos que o processo poderá produzir.',
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="protocolos-config">
                    <div>
                      <span className="eyebrow">{t('CONFIGURAÇÃO')}</span>
                      <h3>{t('Pasta relacionada')}</h3>
                      {protocolo.rascunho.pasta ? <>
                        <p>{protocolo.rascunho.pastaNome || t('Pasta associada')}</p>
                        {protocolo.rascunho.pastaCaminho &&
                          <small className="protocolos-pasta-caminho">{protocolo.rascunho.pastaCaminho}</small>}
                      </> : <p>{t('Ainda não definida. Será necessária antes da publicação.')}</p>}
                    </div>
                    <Button variant="outlined" onClick={() => setSeletorPastaAberto(true)}>
                      {t(protocolo.rascunho.pasta ? 'Alterar pasta' : 'Escolher pasta')}
                    </Button>
                  </div>
                </>
              )}
              {area === 'variaveis' && (
                <>
                  <div className="protocolos-section-title">
                    <div>
                      <h2>{t('Variáveis')}</h2>
                      <p>
                        {t(
                          'Os mesmos dados podem aparecer em vários formulários e etapas.',
                        )}
                      </p>
                    </div>
                    <Button
                      variant="contained"
                      startIcon={<Plus size={16} />}
                      onClick={() => {
                        setErro('');
                        setVariavelEdicao({
                          nome: '',
                          codigo: '',
                          tipo: 'S',
                          descricao: '',
                        });
                      }}
                    >
                      {t('Nova variável')}
                    </Button>
                  </div>
                  {protocolo.rascunho.variaveis.length ? (
                    <div className="protocolos-entry-list">
                      {protocolo.rascunho.variaveis.map((variavel) => (
                        <article className="protocolos-entry" key={variavel.id}>
                          <span className="protocolos-entry-icon">
                            <Variable size={18} />
                          </span>
                          <div>
                            <strong>{variavel.nome}</strong>
                            <small>
                              {variavel.codigo} · {t(nomeTipo(variavel.tipo))}
                            </small>
                            {variavel.descricao && <p>{variavel.descricao}</p>}
                          </div>
                          <Button
                            size="small"
                            onClick={() => {
                              setErro('');
                              setVariavelEdicao({ ...variavel });
                            }}
                          >
                            {t('Editar')}
                          </Button>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <Vazio
                      titulo={t('Nenhuma variável ainda')}
                      descricao={t(
                        'Você também pode criar variáveis enquanto monta um formulário.',
                      )}
                      acao={t('Nova variável')}
                      aoClicar={() => {
                        setErro('');
                        setVariavelEdicao({
                          nome: '',
                          codigo: '',
                          tipo: 'S',
                          descricao: '',
                        });
                      }}
                    />
                  )}
                </>
              )}
              {area === 'formularios' && (
                <>
                  <div className="protocolos-section-title">
                    <div>
                      <h2>{t('Formulários')}</h2>
                      <p>
                        {t(
                          'Organize os campos na ordem em que serão apresentados.',
                        )}
                      </p>
                    </div>
                    <Button
                      variant="contained"
                      startIcon={<Plus size={16} />}
                      onClick={() => {
                        setErro('');
                        setFormularioEdicao({
                          titulo: '',
                          descricao: '',
                          campos: [],
                        });
                      }}
                    >
                      {t('Novo formulário')}
                    </Button>
                  </div>
                  {!formulario ? (
                    protocolo.rascunho.formularios.length ? (
                      <div className="protocolos-entry-list">
                        {protocolo.rascunho.formularios.map((item) => (
                          <article className="protocolos-entry" key={item.id}>
                            <span className="protocolos-entry-icon">
                              <LayoutTemplate size={18} />
                            </span>
                            <div>
                              <strong>{item.titulo}</strong>
                              <small>
                                {item.campos.length} {t('campos')}
                              </small>
                              {item.descricao && <p>{item.descricao}</p>}
                            </div>
                            <Button
                              size="small"
                              endIcon={<ArrowRight size={15} />}
                              onClick={() => setFormularioAberto(item.id)}
                            >
                              {t('Montar formulário')}
                            </Button>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <Vazio
                        titulo={t('Nenhum formulário ainda')}
                        descricao={t(
                          'Comece com o formulário que será usado na primeira etapa.',
                        )}
                        acao={t('Novo formulário')}
                        aoClicar={() => {
                          setErro('');
                          setFormularioEdicao({
                            titulo: '',
                            descricao: '',
                            campos: [],
                          });
                        }}
                      />
                    )
                  ) : (
                    <>
                      <button
                        className="protocolos-voltar interno"
                        type="button"
                        onClick={() => setFormularioAberto(null)}
                      >
                        <ArrowLeft size={16} />
                        {t('Todos os formulários')}
                      </button>
                      <div className="protocolos-form-title">
                        <div>
                          <h3>{formulario.titulo}</h3>
                          <p>
                            {formulario.descricao ||
                              t(
                                'Campos apresentados em uma coluna, de cima para baixo.',
                              )}
                          </p>
                        </div>
                        <Button
                          size="small"
                          onClick={() => {
                            setErro('');
                            setFormularioEdicao({ ...formulario });
                          }}
                        >
                          {t('Editar dados')}
                        </Button>
                      </div>
                      <div className="protocolos-form-canvas">
                        {formulario.campos.length ? (
                          formulario.campos.map((campo, indice) => {
                            const variavel = protocolo.rascunho.variaveis.find(
                              (item) => item.id === campo.idVariavel,
                            );
                            return (
                              <div
                                className="protocolos-field"
                                key={campo.idVariavel}
                              >
                                <span className="protocolos-field-number">
                                  {indice + 1}
                                </span>
                                <div className="protocolos-field-info">
                                  <strong>
                                    {variavel?.nome ||
                                      t('Variável indisponível')}
                                  </strong>
                                  <small>
                                    {variavel?.codigo} ·{' '}
                                    {t(nomeTipo(variavel?.tipo))}
                                  </small>
                                </div>
                                <div className="protocolos-field-actions">
                                  <TextField
                                    select
                                    size="small"
                                    label={t('Apresentação')}
                                    value={campo.apresentacao || '1'}
                                    onChange={(evento) =>
                                      alterarCampo(indice, {
                                        apresentacao: evento.target.value,
                                      })
                                    }
                                    sx={{ minWidth: 145 }}
                                  >
                                    {[
                                      ['1', 'Texto'],
                                      ['2', 'Lista'],
                                      ['3', 'Botões'],
                                      ['4', 'Autocomplete'],
                                      ['5', 'CheckBox'],
                                      ['6', 'Radio Button'],
                                    ].map(([codigo, nome]) => (
                                      <MenuItem key={codigo} value={codigo}>
                                        {t(nome)}
                                      </MenuItem>
                                    ))}
                                  </TextField>
                                  <Button
                                    size="small"
                                    onClick={() =>
                                      alterarCampo(indice, {
                                        acesso:
                                          campo.acesso === 'E' ? 'L' : 'E',
                                      })
                                    }
                                  >
                                    {t(
                                      campo.acesso === 'E'
                                        ? 'Leitura e escrita'
                                        : 'Somente leitura',
                                    )}
                                  </Button>
                                  <Button
                                    size="small"
                                    onClick={() =>
                                      alterarCampo(indice, {
                                        obrigatorio: !campo.obrigatorio,
                                      })
                                    }
                                  >
                                    {t(
                                      campo.obrigatorio
                                        ? 'Obrigatório'
                                        : 'Opcional',
                                    )}
                                  </Button>
                                  <button
                                    type="button"
                                    aria-label={t('Mover para cima')}
                                    disabled={indice === 0}
                                    onClick={() => moverCampo(indice, -1)}
                                  >
                                    <ArrowUp size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={t('Mover para baixo')}
                                    disabled={
                                      indice === formulario.campos.length - 1
                                    }
                                    onClick={() => moverCampo(indice, 1)}
                                  >
                                    <ArrowDown size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={t('Remover do formulário')}
                                    onClick={() =>
                                      atualizarCampos(
                                        formulario.campos.filter(
                                          (_, posicao) => posicao !== indice,
                                        ),
                                      )
                                    }
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <p className="protocolos-form-empty">
                            {t('Este formulário ainda não tem campos.')}
                          </p>
                        )}
                      </div>
                      <div className="protocolos-add-field">
                        <TextField
                          select
                          size="small"
                          label={t('Escolha uma variável')}
                          value={variavelParaAdicionar}
                          onChange={(evento) =>
                            setVariavelParaAdicionar(evento.target.value)
                          }
                          sx={{ minWidth: 220 }}
                        >
                          <MenuItem value="">{t('Selecione')}</MenuItem>
                          {protocolo.rascunho.variaveis
                            .filter(
                              (item) =>
                                !formulario.campos.some(
                                  (campo) => campo.idVariavel === item.id,
                                ),
                            )
                            .map((item) => (
                              <MenuItem key={item.id} value={item.id}>
                                {item.nome}
                              </MenuItem>
                            ))}
                        </TextField>
                        <TextField
                          select
                          size="small"
                          label={t('Acesso')}
                          value={acessoNovoCampo}
                          onChange={(evento) =>
                            setAcessoNovoCampo(evento.target.value)
                          }
                          sx={{ minWidth: 170 }}
                        >
                          <MenuItem value="E">
                            {t('Leitura e escrita')}
                          </MenuItem>
                          <MenuItem value="L">{t('Somente leitura')}</MenuItem>
                        </TextField>
                        <Button
                          variant="outlined"
                          disabled={!variavelParaAdicionar}
                          onClick={adicionarCampo}
                        >
                          {t('Adicionar campo')}
                        </Button>
                        <Button
                          startIcon={<Plus size={16} />}
                          onClick={() => {
                            setErro('');
                            setVariavelEdicao({
                              nome: '',
                              codigo: '',
                              tipo: 'S',
                              descricao: '',
                            });
                          }}
                        >
                          {t('Criar variável')}
                        </Button>
                      </div>
                    </>
                  )}
                </>
              )}
              {area === 'fluxo' && (
                <>
                  <div className="protocolos-section-title">
                    <div>
                      <h2>{t('Fluxo')}</h2>
                      <p>
                        {t(
                          'Aqui serão conectadas as etapas do Protocolo, do início aos pontos finais.',
                        )}
                      </p>
                    </div>
                  </div>
                  <FluxoEditorCarregador key={protocolo.id} idProtocolo={protocolo.id} formularios={protocolo.rascunho.formularios}
                    variaveis={protocolo.rascunho.variaveis} documentos={protocolo.rascunho.documentos} />
                </>
              )}
              {area === 'documentos' && (
                <>
                  <div className="protocolos-section-title">
                    <div>
                      <h2>{t('Modelos de documentos')}</h2>
                      <p>
                        {t(
                          'Defina aqui a apresentação dos documentos que este Protocolo poderá produzir. Um Processo pode gerar vários documentos, ou nenhum.',
                        )}
                      </p>
                    </div>
                    <Button variant="contained" startIcon={<Plus size={16} />}
                      disabled={!protocolo.rascunho.pasta}
                      onClick={() => { setErro(''); setModeloPdf({ codigo: '', titulo: '', observacoes: '', arquivo: null }); }}>
                      {t('Novo modelo PDF')}
                    </Button>
                    <Button variant="outlined" startIcon={<Plus size={16} />}
                      onClick={() => { setErro(''); setModeloHtml({ codigo: '', titulo: '', observacoes: '', css: '', partes: [] }); }}>
                      {t('Novo modelo HTML')}
                    </Button>
                  </div>
                  {!protocolo.rascunho.pasta && <Alert severity="info">{t('Associe uma pasta ao Protocolo antes de enviar modelos PDF.')}</Alert>}
                  {protocolo.rascunho.documentos.length ?
                    <div className="protocolos-entry-list">
                      {protocolo.rascunho.documentos.map((documento) =>
                        <article className="protocolos-entry" key={documento.id}>
                          <span className="protocolos-entry-icon"><FileText size={18} /></span>
                          <div>
                            <strong>{documento.titulo}</strong>
                            <small>{documento.codigo} · {documento.tipoModelo === 'H' ? 'HTML' : `PDF · ${documento.arquivoNome}`}</small>
                            {documento.observacoes && <p>{documento.observacoes}</p>}
                          </div>
                          {documento.tipoModelo === 'H' ? <>
                            <Button size="small" onClick={() => setModeloHtml({ ...documento })}>{t('Editar HTML')}</Button>
                            <Button size="small" color="error" aria-label={t('Excluir modelo HTML')}
                              onClick={() => { setErro(''); setModeloExclusao(documento.id); }}><Trash2 size={16} /></Button>
                          </> : <><Button size="small" component="a" target="_blank" rel="noopener noreferrer"
                            href={`/ArgousForms/arquivo-conteudo?idArquivo=${encodeURIComponent(documento.idArquivo)}&idArquivoVersao=${encodeURIComponent(documento.idArquivoVersao)}&modo=visualizar`}>
                            {t('Visualizar PDF')}
                          </Button>
                          <Button size="small" onClick={() => setModeloCampos(documento)}>{t('Posicionar campos')}</Button>
                          <Button size="small" onClick={() => { setErro(''); setModeloPdf({ ...documento }); }}>
                            {t('Editar')}
                          </Button>
                          <Button size="small" color="error" aria-label={t('Excluir modelo PDF')}
                            onClick={() => { setErro(''); setModeloExclusao(documento.id); }}>
                            <Trash2 size={16} />
                          </Button></>}
                        </article>)}
                    </div> :
                    <Vazio titulo={t('Nenhum modelo de documento definido')}
                      descricao={t('Envie um PDF de origem para começar a definir os documentos deste Protocolo.')} />}
                </>
              )}
            </div>
          </div>
        </>
      )}

      <Dialog open={!!exclusao} onClose={() => setExclusao(null)} fullWidth maxWidth="sm">
        <DialogTitle>{t('Excluir Protocolo')}</DialogTitle>
        <DialogContent>
          <p>{t('Deseja excluir o Protocolo')} <strong>{protocolos.find((item) => item.id === exclusao)?.titulo}</strong>?</p>
          <p>{t('O rascunho, seus formulários, variáveis e modelos de documentos serão excluídos. Esta ação não pode ser desfeita.')}</p>
          {protocolos.find((item) => item.id === exclusao)?.rascunho?.pasta &&
            <p>{t('A pasta associada permanecerá no gestor de documentos.')}</p>}
          {protocolos.find((item) => item.id === exclusao)?.rascunho?.documentos?.some((item) => item.tipoModelo !== 'H') &&
            <p>{t('Os PDFs de origem permanecerão na pasta MODELOS.')}</p>}
          {erro && <Alert severity="error">{erro}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExclusao(null)}>{t('Cancelar')}</Button>
          <Button color="error" variant="contained" onClick={excluirProtocolo}>{t('Excluir Protocolo')}</Button>
        </DialogActions>
      </Dialog>
      {seletorPastaAberto && <SeletorPasta aberto permitirCriacao pastaAtual={protocolo?.rascunho?.pasta}
        aoFechar={() => setSeletorPastaAberto(false)} aoEscolher={escolherPasta} />}
      {modeloCampos && <PdfCampos modelo={modeloCampos}
        variaveis={[...(protocolo?.rascunho?.variaveis || []), ...variaveisInstituicaoPdf]}
        erroCatalogo={erroVariaveisInstituicaoPdf}
        aoFechar={() => setModeloCampos(null)} aoCriarVariavel={() => {
          setModeloCampos(null);
          setArea('variaveis');
        }} aoSalvar={async (campos) => {
          const atualizado = await executar('SALVAR_CAMPOS_MODELO_PDF', {
            idProtocolo: protocolo.id, idModelo: modeloCampos.id,
            campos: campos.map(({ idVariavel, idAtributo, pagina, x, y, largura, altura, apresentacao }) =>
              ({ idVariavel: idVariavel || null, idAtributo: idAtributo ?? null,
                pagina, x, y, largura, altura, apresentacao: apresentacao || {} })),
          });
          setProtocolos((atuais) => atuais.map((item) => item.id === atualizado.id ? atualizado : item));
          setModeloCampos(null);
        }} />}

      {modeloHtml && <ModeloHtmlEditor modelo={modeloHtml} variaveis={protocolo?.rascunho?.variaveis || []}
        salvando={salvando} aoFechar={() => setModeloHtml(null)} aoSalvar={salvarModeloHtml} />}

      <Dialog open={!!modeloPdf} onClose={() => !salvando && setModeloPdf(null)} fullWidth maxWidth="sm">
        <DialogTitle>{t(modeloPdf?.id ? 'Editar modelo PDF' : 'Novo modelo PDF')}</DialogTitle>
        <DialogContent className="protocolos-dialog-fields">
          {erro && <Alert severity="error">{erro}</Alert>}
          <TextField label={t('Código técnico')} required fullWidth value={modeloPdf?.codigo || ''}
            inputProps={{ maxLength: 30 }} disabled={salvando || !!modeloPdf?.id}
            onChange={(evento) => setModeloPdf({ ...modeloPdf, codigo: evento.target.value })} />
          <TextField label={t('Título')} required fullWidth value={modeloPdf?.titulo || ''}
            inputProps={{ maxLength: 70 }} disabled={salvando}
            onChange={(evento) => setModeloPdf({ ...modeloPdf, titulo: evento.target.value })} />
          <TextField label={t('Observações (opcional)')} fullWidth multiline minRows={2}
            value={modeloPdf?.observacoes || ''} disabled={salvando}
            onChange={(evento) => setModeloPdf({ ...modeloPdf, observacoes: evento.target.value })} />
          {!modeloPdf?.id && <Button component="label" variant="outlined" disabled={salvando}>
            {modeloPdf?.arquivo?.name || t('Escolher PDF')}
            <input hidden type="file" accept="application/pdf,.pdf" onChange={(evento) => {
              setModeloPdf({ ...modeloPdf, arquivo: evento.target.files?.[0] || null });
              setProgressoPdf(0);
            }} />
          </Button>}
          {salvando && <p>{progressoPdf > 0 ? `${t('Enviando PDF')} ${progressoPdf}%` : t('Salvando modelo PDF...')}</p>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModeloPdf(null)} disabled={salvando}>{t('Cancelar')}</Button>
          <Button variant="contained" onClick={criarModeloPdf} disabled={salvando}>
            {t(modeloPdf?.id ? 'Salvar modelo PDF' : 'Criar modelo PDF')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!modeloExclusao} onClose={() => setModeloExclusao(null)} fullWidth maxWidth="sm">
        <DialogTitle>{t(modeloParaExcluir?.tipoModelo === 'H' ? 'Excluir modelo HTML' : 'Excluir modelo PDF')}</DialogTitle>
        <DialogContent>
          <p>{t(modeloParaExcluir?.tipoModelo === 'H' ? 'O modelo HTML será retirado do rascunho.' :
            'O modelo será retirado do rascunho. O PDF enviado permanecerá na pasta MODELOS.')}</p>
          {erro && <Alert severity="error">{erro}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModeloExclusao(null)} disabled={salvando}>{t('Cancelar')}</Button>
          <Button color="error" variant="contained" onClick={excluirModelo} disabled={salvando}>
            {t(modeloParaExcluir?.tipoModelo === 'H' ? 'Excluir modelo HTML' : 'Excluir modelo PDF')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!cadastro}
        onClose={() => setCadastro(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {t(
            cadastro?.modo === 'novo'
              ? 'Criar Protocolo'
              : 'Editar dados do Protocolo',
          )}
        </DialogTitle>
        <DialogContent className="protocolos-dialog-fields">
          {erro && <Alert severity="error">{erro}</Alert>}
          <TextField
            label={t('Título')}
            required
            fullWidth
            value={cadastro?.titulo || ''}
            inputProps={{ maxLength: 255 }}
            onChange={(evento) =>
              setCadastro({ ...cadastro, titulo: evento.target.value })
            }
          />
          <TextField
            label={t('Descrição (opcional)')}
            fullWidth
            multiline
            minRows={3}
            value={cadastro?.descricao || ''}
            onChange={(evento) =>
              setCadastro({ ...cadastro, descricao: evento.target.value })
            }
          />
          <p>{t('Você poderá definir a pasta antes da publicação.')}</p>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCadastro(null)}>{t('Cancelar')}</Button>
          <Button variant="contained" onClick={salvarCadastro}>
            {t(
              cadastro?.modo === 'novo'
                ? 'Criar rascunho'
                : 'Salvar alterações',
            )}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={!!variavelEdicao}
        onClose={() => setVariavelEdicao(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {t(variavelEdicao?.id ? 'Editar variável' : 'Nova variável')}
        </DialogTitle>
        <DialogContent className="protocolos-dialog-fields">
          {erro && <Alert severity="error">{erro}</Alert>}
          <TextField
            label={t('Nome apresentado')}
            required
            fullWidth
            value={variavelEdicao?.nome || ''}
            inputProps={{ maxLength: 255 }}
            onChange={(evento) =>
              setVariavelEdicao({
                ...variavelEdicao,
                nome: evento.target.value,
              })
            }
          />
          <TextField
            label={t('Código técnico')}
            required
            fullWidth
            disabled={!!variavelEdicao?.id}
            value={variavelEdicao?.codigo || ''}
            inputProps={{ maxLength: 100 }}
            helperText={t(
              'Usado para identificar a variável em formulários, documentos e scripts.',
            )}
            onChange={(evento) =>
              setVariavelEdicao({
                ...variavelEdicao,
                codigo: evento.target.value,
              })
            }
          />
          <TextField
            select
            label={t('Tipo de dado')}
            fullWidth
            disabled={!!variavelEdicao?.id}
            value={variavelEdicao?.tipo || 'S'}
            onChange={(evento) =>
              setVariavelEdicao({
                ...variavelEdicao,
                tipo: evento.target.value,
                definicao: { ...variavelEdicao.definicao, origem: { tipo: 'MANUAL' } },
              })
            }
          >
            {TIPOS_DADO.map(([codigo, nome]) => (
              <MenuItem key={codigo} value={codigo}>
                {t(nome)}
              </MenuItem>
            ))}
          </TextField>
          <TextField select label={t('Origem do valor')} fullWidth
            value={variavelEdicao?.definicao?.origem?.tipo || 'MANUAL'}
            onChange={(evento) => setVariavelEdicao((atual) => ({ ...atual,
              definicao: { ...atual.definicao, origem: { tipo: evento.target.value } } }))}>
            <MenuItem value="MANUAL">{t('Preenchimento manual')}</MenuItem>
            <MenuItem value="SISTEMA">{t('Variável de sistema')}</MenuItem>
            {variavelEdicao?.tipo === 'S' && <MenuItem value="INSTITUICAO">{t('Variável da instituição')}</MenuItem>}
            <MenuItem value="INTEGRACAO">{t('Integração')}</MenuItem>
          </TextField>
          {variavelEdicao?.definicao?.origem?.tipo === 'SISTEMA' &&
            <TextField select required label={t('Variável de sistema')} fullWidth
              value={variavelEdicao.definicao.origem.codigo || ''}
              onChange={(evento) => setVariavelEdicao((atual) => ({ ...atual,
                definicao: { ...atual.definicao, origem: { tipo: 'SISTEMA', codigo: evento.target.value } } }))}>
              <MenuItem value="">{t('Escolha uma variável')}</MenuItem>
              {variaveisSistema.filter((item) => item.tipoDado === variavelEdicao.tipo).map((item) =>
                <MenuItem key={item.codigo} value={item.codigo}>{item.codigo} · {item.descricao}</MenuItem>)}
            </TextField>}
          {variavelEdicao?.definicao?.origem?.tipo === 'INSTITUICAO' &&
            <TextField select required label={t('Variável da instituição')} fullWidth
              value={variavelEdicao.definicao.origem.idAtributo || ''}
              onChange={(evento) => setVariavelEdicao((atual) => ({ ...atual,
                definicao: { ...atual.definicao, origem: { tipo: 'INSTITUICAO', idAtributo: Number(evento.target.value) } } }))}>
              <MenuItem value="">{t('Escolha uma variável')}</MenuItem>
              {variaveisInstituicaoCadastro.map((item) =>
                <MenuItem key={item.idAtributo} value={item.idAtributo}>{item.codigo}</MenuItem>)}
            </TextField>}
          {variavelEdicao?.definicao?.origem?.tipo === 'INTEGRACAO' &&
            <TextField required label={t('Código de integração')} fullWidth
              value={variavelEdicao.definicao.origem.codigo || ''} inputProps={{ maxLength: 100 }}
              onChange={(evento) => setVariavelEdicao((atual) => ({ ...atual,
                definicao: { ...atual.definicao, origem: { tipo: 'INTEGRACAO', codigo: evento.target.value } } }))}
              helperText={t('O webhook interpretará este código quando a integração for executada.')} />}
          <TextField
            label={t('Descrição (opcional)')}
            multiline
            minRows={2}
            fullWidth
            value={variavelEdicao?.descricao || ''}
            onChange={(evento) =>
              setVariavelEdicao({
                ...variavelEdicao,
                descricao: evento.target.value,
              })
            }
          />
          {variavelEdicao?.tipo === 'S' && <>
            <strong>{t('Regras do texto')}</strong>
            <div className="protocolos-dialog-row">
              <TextField type="number" label={t('Tamanho mínimo')} fullWidth
                inputProps={{ min: 0, max: 10000 }}
                value={variavelEdicao.definicao?.texto?.tamanhoMinimo ?? ''}
                onChange={(evento) => alterarRegraTexto('tamanhoMinimo', evento.target.value === '' ? 0 : Number(evento.target.value))} />
              <TextField type="number" label={t('Tamanho máximo')} fullWidth
                inputProps={{ min: 0, max: 10000 }}
                value={variavelEdicao.definicao?.texto?.tamanhoMaximo ?? ''}
                onChange={(evento) => alterarRegraTexto('tamanhoMaximo', evento.target.value === '' ? 0 : Number(evento.target.value))} />
            </div>
            <TextField label={t('Máscara (opcional)')} fullWidth
              value={variavelEdicao.definicao?.texto?.mascara || ''}
              onChange={(evento) => alterarRegraTexto('mascara', evento.target.value)}
              helperText={t('A/a: letra; D/d: letra ou dígito; 9/0: dígito; */#: qualquer caractere. Maiúsculas exigem preenchimento. Use \\ para exibir um símbolo da máscara.')} />
            <FormControlLabel label={t('Completar com zeros à esquerda')} control={<Checkbox
              checked={variavelEdicao.definicao?.texto?.preencherZerosEsquerda === true}
              onChange={(evento) => alterarRegraTexto('preencherZerosEsquerda', evento.target.checked)} />} />
            <TextField select label={t('Expressão pronta')} fullWidth value=""
              onChange={(evento) => alterarRegraTexto('regex', evento.target.value)}>
              <MenuItem value="">{t('Escolha uma expressão pronta')}</MenuItem>
              {REGEX_PRONTAS.map((item) => <MenuItem key={item.nome} value={item.valor}>{t(item.nome)}</MenuItem>)}
            </TextField>
            <TextField label={t('Expressão regular (opcional)')} fullWidth
              value={variavelEdicao.definicao?.texto?.regex || ''}
              onChange={(evento) => alterarRegraTexto('regex', evento.target.value)}
              helperText={t('Valida o valor completo, sem os separadores da máscara.')} />
          </>}
          <TextField label={t('Valor exemplo (opcional)')} fullWidth
            value={variavelEdicao?.definicao?.valorExemplo || ''}
            inputProps={{ maxLength: 500 }}
            onChange={(evento) => setVariavelEdicao((atual) => ({
              ...atual,
              definicao: { ...atual.definicao, valorExemplo: evento.target.value },
            }))}
            onBlur={() => {
              const definicao = variavelEdicao?.definicao;
              if (!definicao || variavelEdicao.tipo === 'S' && validarDefinicaoTexto(definicao.texto || {})) return;
              const exemplo = normalizarValorExemplo(definicao.valorExemplo || '', definicao, variavelEdicao.tipo);
              if (exemplo.erro) { setErro(t(exemplo.erro)); return; }
              setErro('');
              setVariavelEdicao((atual) => ({ ...atual,
                definicao: { ...atual.definicao, valorExemplo: exemplo.valor } }));
            }}
            helperText={t('Usado apenas nas pré-visualizações; não preenche valores de Processos.')} />
          <TextField label={t('Script ao sair do campo (opcional)')} fullWidth multiline minRows={5}
            value={variavelEdicao?.definicao?.scriptAoSairDoCampo || ''}
            inputProps={{ maxLength: 20000 }}
            onChange={(evento) => setVariavelEdicao((atual) => ({ ...atual,
              definicao: { ...atual.definicao, scriptAoSairDoCampo: evento.target.value } }))}
            helperText={t('Será executado quando o usuário sair do campo durante o preenchimento do formulário.')} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVariavelEdicao(null)}>
            {t('Cancelar')}
          </Button>
          <Button variant="contained" onClick={salvarVariavel}>
            {t('Salvar variável')}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={!!formularioEdicao}
        onClose={() => setFormularioEdicao(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {t(formularioEdicao?.id ? 'Editar formulário' : 'Novo formulário')}
        </DialogTitle>
        <DialogContent className="protocolos-dialog-fields">
          {erro && <Alert severity="error">{erro}</Alert>}
          <TextField
            label={t('Título')}
            required
            fullWidth
            value={formularioEdicao?.titulo || ''}
            inputProps={{ maxLength: 255 }}
            onChange={(evento) =>
              setFormularioEdicao({
                ...formularioEdicao,
                titulo: evento.target.value,
              })
            }
          />
          <TextField
            label={t('Descrição (opcional)')}
            fullWidth
            multiline
            minRows={2}
            value={formularioEdicao?.descricao || ''}
            onChange={(evento) =>
              setFormularioEdicao({
                ...formularioEdicao,
                descricao: evento.target.value,
              })
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormularioEdicao(null)}>
            {t('Cancelar')}
          </Button>
          <Button variant="contained" onClick={salvarFormulario}>
            {t('Salvar formulário')}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={publicacao} onClose={() => setPublicacao(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('Publicar Protocolo')}</DialogTitle>
        <DialogContent>
          <p>{t('A versão publicada não poderá mais ser alterada. Confirme que revisou o fluxo, os destinatários e os modelos de documentos.')}</p>
          {erro && <Alert severity="error">{erro}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPublicacao(false)}>{t('Voltar')}</Button>
          <Button variant="contained" disabled={salvando} onClick={publicarProtocolo}>{t('Confirmar publicação')}</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
