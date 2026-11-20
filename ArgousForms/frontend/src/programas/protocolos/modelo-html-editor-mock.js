'use client';

import { useMemo, useRef, useState } from 'react';
import { Box, Dialog, IconButton, Switch, Tooltip } from '@mui/material';
import { AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowLeft, ArrowUp, Bold, Braces, ChevronDown, Code2, FileInput, FileText, Flag, Highlighter, Image, Italic, LayoutTemplate, Link2, List, ListOrdered, Palette, PanelBottom, PanelTop, Plus, Redo2, Settings2, Table2, Underline, Undo2, X } from 'lucide-react';
import DOMPurify from 'dompurify';
import { executar } from '../login/autenticacao.js';
import './modelo-html-editor-mock.css';

const TIPOS = [
  { codigo: 'A', nome: 'Apresentação', Icone: LayoutTemplate },
  { codigo: 'H', nome: 'Cabeçalho', Icone: PanelTop },
  { codigo: 'B', nome: 'Corpo', Icone: FileText },
  { codigo: 'F', nome: 'Rodapé', Icone: PanelBottom },
  { codigo: 'X', nome: 'Encerramento', Icone: Flag },
];
const FONTES = [
  [ 'Padrão', '' ],
  [ 'Arial', 'Arial, Helvetica, sans-serif' ],
  [ 'Georgia', 'Georgia, serif' ],
  [ 'Times New Roman', '"Times New Roman", Times, serif' ],
  [ 'Verdana', 'Verdana, sans-serif' ],
  [ 'Courier New', '"Courier New", monospace' ],
];
const SELETOR_BLOCO = 'p, h1, h2, h3, h4, h5, h6, li, td, th';

function partesIniciais( modelo ) {
  const existentes = ( modelo.partes || [] ).map( ( parte, indice ) => ({
    id: parte.id || parte.idDocumentoHtmlParte || `parte-${indice}`,
    tipo: parte.tipo || parte.tpParte || 'B',
    html: parte.html || parte.txHtml || '',
    ativa: true,
  }) );
  if( !existentes.some( ( parte ) => parte.tipo === 'B' ) ) existentes.push( { id: 'corpo-inicial', tipo: 'B', html: '', ativa: true } );
  return existentes;
}

function htmlSeguro( html ) {
  if( typeof window === 'undefined' ) return '';
  return DOMPurify.sanitize( html || '', { USE_PROFILES: { html: true } } );
}

function documentoSrc( parte, estilos ) {
  const conteudo = htmlSeguro( parte?.html );
  const estilo = estilos.map( ( arquivo ) => String( arquivo.conteudo || '' ) ).join( '\n' ).replace( /@import[^;]*;/gi, '' ).replace( /url\s*\([^)]*\)/gi, 'none' ).replace( /<\/?style/gi, '' );
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'self'"><style>:where(table){border-collapse:collapse}:where(td,th){border:1px solid #aaa;padding:6px}</style><style>${estilo}</style><style>html,body{background:#fff;margin:0;min-height:100%;}body{padding:0;}img{max-width:100%;height:auto}img[data-argous-imagem-selecionada]{outline:2px solid #087d70;outline-offset:3px}.argous-page-break{border-top:2px dashed #087d70;margin:20px 0;min-height:8px}table[data-argous-selecionada]{outline:2px solid #087d70;outline-offset:3px}table[data-argous-tabela-inteira]{outline:3px solid #075bce;outline-offset:4px}td[data-argous-celula],th[data-argous-celula]{outline:2px solid #087d70;outline-offset:-2px;position:relative}td[data-argous-celula-grupo],th[data-argous-celula-grupo]{outline:3px solid #075bce;outline-offset:-3px;background-color:#dcecff!important}td[data-argous-celula]::after,th[data-argous-celula]::after{content:"";position:absolute;right:-5px;top:0;width:9px;height:100%;background:#087d7055;cursor:col-resize}</style></head><body>${conteudo || '<p><br></p>'}</body></html>`;
}

function enderecoRecurso( recurso ) {
  return `/ArgousForms/arquivo-conteudo?idArquivo=${encodeURIComponent( recurso.idArquivo )}&idArquivoVersao=${encodeURIComponent( recurso.idArquivoVersao )}&modo=visualizar`;
}

function mapaTabela( tabela ) {
  const linhas = [ ...tabela.rows ];
  const grade = [];
  const posicoes = new Map();
  linhas.forEach( ( linha, indiceLinha ) => {
    grade[ indiceLinha ] ||= [];
    let coluna = 0;
    [ ...linha.cells ].forEach( ( celula ) => {
      while( grade[ indiceLinha ][ coluna ] ) coluna++;
      const fimSecao = linhas.slice( indiceLinha ).findIndex( ( outra ) => outra.parentElement !== linha.parentElement );
      const alturaSecao = fimSecao < 0 ? linhas.length - indiceLinha : fimSecao;
      const altura = celula.rowSpan === 0 ? alturaSecao : Math.min( celula.rowSpan, alturaSecao );
      const largura = celula.colSpan;
      const posicao = { celula, linha: indiceLinha, coluna, altura, largura };
      posicoes.set( celula, posicao );
      for( let l = indiceLinha; l < Math.min( linhas.length, indiceLinha + altura ); l++ ) {
        grade[ l ] ||= [];
        for( let c = coluna; c < coluna + largura; c++ ) grade[ l ][ c ] = posicao;
      }
      coluna += largura;
    } );
  } );
  return { grade, posicoes };
}

function retanguloCelulas( tabela, inicio, fim ) {
  const { grade, posicoes } = mapaTabela( tabela );
  const primeiro = posicoes.get( inicio );
  const ultimo = posicoes.get( fim );
  if( !primeiro || !ultimo ) return null;
  const topo = Math.min( primeiro.linha, ultimo.linha );
  const esquerda = Math.min( primeiro.coluna, ultimo.coluna );
  const baixo = Math.max( primeiro.linha + primeiro.altura, ultimo.linha + ultimo.altura );
  const direita = Math.max( primeiro.coluna + primeiro.largura, ultimo.coluna + ultimo.largura );
  const celulas = new Set();
  for( let linha = topo; linha < baixo; linha++ ) for( let coluna = esquerda; coluna < direita; coluna++ ) {
    const posicao = grade[ linha ]?.[ coluna ];
    if( !posicao || posicao.linha < topo || posicao.coluna < esquerda
      || posicao.linha + posicao.altura > baixo || posicao.coluna + posicao.largura > direita ) return null;
    celulas.add( posicao.celula );
  }
  return { topo, esquerda, baixo, direita, grade, posicoes, celulas: [ ...celulas ] };
}

function separarHtml( texto ) {
  const documento = new DOMParser().parseFromString( texto, 'text/html' );
  const proibido = documento.querySelector( 'script, iframe, object, embed, form, input, button, svg, math' );
  const tagsServidor = [ ...documento.querySelectorAll( '*' ) ].find( ( elemento ) => elemento.tagName.includes( ':' ) );
  if( proibido || tagsServidor || /<\s*\/?\s*(?:[\w-]+:)?(?:script|iframe|object|embed|form|input|button)\b/i.test( texto ) ) {
    throw new Error( 'O HTML contém elementos que não podem ser importados.' );
  }
  const cssInternos = [ ...documento.querySelectorAll( 'style' ) ].map( ( elemento ) => elemento.textContent || '' );
  const linksLocais = [ ...documento.querySelectorAll( 'link[rel~="stylesheet"]' ) ].map( ( elemento ) => elemento.getAttribute( 'href' ) || '' );
  documento.querySelectorAll( 'style, link, script' ).forEach( ( elemento ) => elemento.remove() );
  return { html: htmlSeguro( documento.body.innerHTML ), cssInternos, linksLocais };
}

function validarCss( conteudo ) {
  if( /@import\b|url\s*\(|expression\s*\(|javascript\s*:|data\s*:|behavior\s*:|binding\s*:/i.test( conteudo.replace( /\/\*[\s\S]*?\*\//g, '' ) ) ) {
    throw new Error( 'Um CSS contém referências externas ou comandos que não são aceitos nesta importação.' );
  }
  return conteudo;
}

function prepararEdicaoVisual( iframe, aoSelecionar, aoMover, aoSoltar, aoMudarSelecao, aoDigitar, aoAtalho ) {
  const documento = iframe?.contentDocument;
  const corpo = documento?.body;
  if( corpo ) {
    corpo.setAttribute( 'contenteditable', 'true' );
    documento.addEventListener( 'pointerdown', aoSelecionar, true );
    documento.addEventListener( 'keyup', aoSelecionar, true );
    documento.addEventListener( 'pointermove', aoMover, true );
    documento.addEventListener( 'pointerup', aoSoltar, true );
    documento.addEventListener( 'selectionchange', aoMudarSelecao );
    corpo.addEventListener( 'input', aoDigitar );
    documento.addEventListener( 'keydown', aoAtalho, true );
  }
}

function BotaoFerramenta( { Icone, rotulo, desativado = true, aoClicar, ativo = false } ) {
  return <Tooltip title={rotulo}><span><IconButton size="small" aria-label={rotulo} disabled={desativado} onMouseDown={( evento ) => evento.preventDefault()} onClick={aoClicar}
    className={ativo ? 'html-studio-tool-active' : ''}><Icone size={18} /></IconButton></span></Tooltip>;
}

export default function ModeloHtmlEditorMock( { modelo, variaveis = [], idProtocolo, salvando = false, aoFechar, aoSalvar } ) {
  const [partes, setPartes] = useState( () => partesIniciais( modelo ) );
  const [selecionada, setSelecionada] = useState( () => partesIniciais( modelo ).find( ( parte ) => parte.tipo === 'B' )?.id );
  const [aba, setAba] = useState( 'html' );
  const [propriedades, setPropriedades] = useState( !modelo.id );
  const [metadados, setMetadados] = useState( () => ({ codigo: modelo.codigo || '', titulo: modelo.titulo || '', observacoes: modelo.observacoes || '', diasVencimento: modelo.diasVencimento ?? '' }) );
  const [erroSalvar, setErroSalvar] = useState( '' );
  const [codigoFonte, setCodigoFonte] = useState( false );
  const [estilos, setEstilos] = useState( () => modelo.estilos || [] );
  const [erroImportacao, setErroImportacao] = useState( '' );
  const arquivosInput = useRef( null );
  const iframeEditor = useRef( null );
  const celulaTabela = useRef( null );
  const ancoraCelulas = useRef( null );
  const grupoCelulas = useRef( null );
  const blocoAtual = useRef( null );
  const imagemSelecionada = useRef( null );
  const intervaloEdicao = useRef( null );
  const arrasteColuna = useRef( null );
  const historicos = useRef( new Map() );
  const digitacaoPendente = useRef( false );
  const temporizadorDigitacao = useRef( null );
  const tamanhoEditado = useRef( false );
  const larguraTabelaEditada = useRef( false );
  const [tabelaAtiva, setTabelaAtiva] = useState( false );
  const [tabelaInteira, setTabelaInteira] = useState( false );
  const [quantidadeCelulas, setQuantidadeCelulas] = useState( 0 );
  const [celulaMesclada, setCelulaMesclada] = useState( false );
  const [larguraTabela, setLarguraTabela] = useState( '100' );
  const [classeTabela, setClasseTabela] = useState( '' );
  const [avisoTabela, setAvisoTabela] = useState( '' );
  const [avisoFormatacao, setAvisoFormatacao] = useState( '' );
  const [tamanhoFonte, setTamanhoFonte] = useState( '12' );
  const [estiloParagrafo, setEstiloParagrafo] = useState( 'p' );
  const [corTexto, setCorTexto] = useState( '#1c3047' );
  const [corFundo, setCorFundo] = useState( '#fff2a8' );
  const [corCelula, setCorCelula] = useState( '#ffffff' );
  const [buscaVariavel, setBuscaVariavel] = useState( '' );
  const [dialogoVariavel, setDialogoVariavel] = useState( false );
  const [dialogoLink, setDialogoLink] = useState( false );
  const [enderecoLink, setEnderecoLink] = useState( '' );
  const [textoLink, setTextoLink] = useState( '' );
  const [dialogoImagem, setDialogoImagem] = useState( false );
  const [recursos, setRecursos] = useState( [] );
  const [carregandoRecursos, setCarregandoRecursos] = useState( false );
  const [erroRecursos, setErroRecursos] = useState( '' );
  const [recursoEscolhido, setRecursoEscolhido] = useState( '' );
  const [larguraImagem, setLarguraImagem] = useState( '320' );
  const [descricaoImagem, setDescricaoImagem] = useState( '' );
  const parteAtual = partes.find( ( parte ) => parte.id === selecionada );
  const srcDoc = useMemo( () => documentoSrc( parteAtual, estilos ), [parteAtual, estilos] );
  const numeroCorpos = partes.filter( ( parte ) => parte.tipo === 'B' ).length;
  const classesCss = useMemo( () => [ ...new Set( estilos.flatMap( ( arquivo ) => [ ...( arquivo.conteudo || '' ).matchAll( /(?:^|[\s,{>])(?:table)?\.([A-Za-z_][\w-]*)/gm ) ].map( ( resultado ) => resultado[ 1 ] ) ) ) ], [estilos] );

  function htmlDoEditor() {
    const corpo = iframeEditor.current?.contentDocument?.body;
    if( !corpo ) return null;
    const copia = corpo.cloneNode( true );
    copia.querySelectorAll( '[data-argous-selecionada], [data-argous-celula], [data-argous-celula-grupo], [data-argous-tabela-inteira], [data-argous-imagem-selecionada]' ).forEach( ( marcado ) => {
      marcado.removeAttribute( 'data-argous-selecionada' );
      marcado.removeAttribute( 'data-argous-celula' );
      marcado.removeAttribute( 'data-argous-celula-grupo' );
      marcado.removeAttribute( 'data-argous-tabela-inteira' );
      marcado.removeAttribute( 'data-argous-imagem-selecionada' );
    } );
    copia.innerHTML = copia.innerHTML.replace( /\u200b/g, '' );
    copia.querySelectorAll( 'span, strong, em, u' ).forEach( ( marcado ) => {
      if( !marcado.textContent && !marcado.children.length ) marcado.remove();
    } );
    if( copia.children.length === 1 && copia.firstElementChild.tagName === 'P' && !copia.firstElementChild.attributes.length
      && !copia.firstElementChild.textContent.trim() && copia.firstElementChild.innerHTML === '<br>' ) return '';
    return htmlSeguro( copia.innerHTML );
  }

  function encerrarGrupoDigitacao() {
    clearTimeout( temporizadorDigitacao.current );
    digitacaoPendente.current = false;
  }

  function iniciarHistorico() {
    const html = htmlDoEditor();
    if( html === null || !selecionada ) return;
    const existente = historicos.current.get( selecionada );
    if( !existente ) historicos.current.set( selecionada, { anteriores: [], atual: html, posteriores: [] } );
    else if( existente.atual !== html ) {
      existente.anteriores.push( existente.atual );
      existente.atual = html;
      existente.posteriores = [];
    }
  }

  function registrarAlteracao( tipo = 'comando' ) {
    const html = htmlDoEditor();
    const historico = historicos.current.get( selecionada );
    if( html === null || !historico || html === historico.atual ) return;
    if( tipo !== 'digitacao' || !digitacaoPendente.current ) historico.anteriores.push( historico.atual );
    if( historico.anteriores.length > 100 ) historico.anteriores.shift();
    historico.atual = html;
    historico.posteriores = [];
    if( tipo === 'digitacao' ) {
      digitacaoPendente.current = true;
      clearTimeout( temporizadorDigitacao.current );
      temporizadorDigitacao.current = setTimeout( () => { digitacaoPendente.current = false; }, 700 );
    } else encerrarGrupoDigitacao();
  }

  function executarComHistorico( acao ) {
    encerrarGrupoDigitacao();
    const resultado = acao();
    registrarAlteracao();
    return resultado;
  }

  function aplicarHistorico( tipo ) {
    encerrarGrupoDigitacao();
    const historico = historicos.current.get( selecionada );
    const origem = tipo === 'desfazer' ? historico?.anteriores : historico?.posteriores;
    if( !origem?.length ) return;
    const destino = tipo === 'desfazer' ? historico.posteriores : historico.anteriores;
    destino.push( historico.atual );
    historico.atual = origem.pop();
    const corpo = iframeEditor.current?.contentDocument?.body;
    if( !corpo ) return;
    corpo.innerHTML = historico.atual;
    celulaTabela.current = null;
    ancoraCelulas.current = null;
    grupoCelulas.current = null;
    blocoAtual.current = null;
    imagemSelecionada.current = null;
    intervaloEdicao.current = null;
    setTabelaAtiva( false );
    setTabelaInteira( false );
    setQuantidadeCelulas( 0 );
    setCelulaMesclada( false );
    setAvisoTabela( '' );
    setAvisoFormatacao( '' );
    corpo.focus();
  }

  function atalhoHistorico( evento ) {
    if( !( evento.ctrlKey || evento.metaKey ) || evento.altKey ) return;
    const tecla = evento.key.toLowerCase();
    if( tecla === 'z' ) {
      evento.preventDefault();
      aplicarHistorico( evento.shiftKey ? 'refazer' : 'desfazer' );
    } else if( tecla === 'y' ) {
      evento.preventDefault();
      aplicarHistorico( 'refazer' );
    }
  }

  function guardarSelecao() {
    const documento = iframeEditor.current?.contentDocument;
    const selecao = documento?.getSelection();
    if( selecao?.rangeCount && documento.body.contains( selecao.anchorNode ) ) {
      intervaloEdicao.current = selecao.getRangeAt( 0 ).cloneRange();
      const elemento = selecao.anchorNode.nodeType === 1 ? selecao.anchorNode : selecao.anchorNode.parentElement;
      const blocoSelecionado = elemento?.closest( SELETOR_BLOCO );
      if( blocoSelecionado ) blocoAtual.current = blocoSelecionado;
      const tituloInline = elemento?.closest( '[class*="argous-titulo-"]' )?.className.match( /argous-titulo-([1-6])/ )?.[ 1 ];
      const bloco = elemento?.closest( 'h1, h2, h3, h4, h5, h6' );
      setEstiloParagrafo( tituloInline ? `h${tituloInline}` : bloco?.tagName.toLowerCase() || 'p' );
      if( !tamanhoEditado.current && elemento ) {
        const pontos = Math.round( parseFloat( documento.defaultView.getComputedStyle( elemento ).fontSize ) * 7.5 ) / 10;
        if( Number.isFinite( pontos ) ) setTamanhoFonte( String( pontos ) );
      }
    }
  }

  function restaurarSelecao() {
    const documento = iframeEditor.current?.contentDocument;
    const intervalo = intervaloEdicao.current;
    if( !documento || !intervalo || !documento.body.contains( intervalo.commonAncestorContainer ) ) {
      setAvisoFormatacao( 'Selecione um trecho do documento para usar esta ferramenta.' );
      return null;
    }
    const selecao = documento.getSelection();
    selecao.removeAllRanges();
    selecao.addRange( intervalo );
    setAvisoFormatacao( '' );
    return intervalo;
  }

  function formatarTexto( comando, familia = '' ) {
    const intervalo = restaurarSelecao();
    if( !intervalo ) return;
    if( !intervalo.collapsed && intervalo.cloneContents().querySelector( SELETOR_BLOCO ) ) {
      setAvisoFormatacao( 'Para esta formatação, selecione texto dentro de um único parágrafo ou célula.' );
      return;
    }
    const documento = iframeEditor.current.contentDocument;
    const origem = intervalo.startContainer.nodeType === 1 ? intervalo.startContainer : intervalo.startContainer.parentElement;
    const ativo = comando === 'negrito' ? !!origem.closest( 'strong, b' ) : comando === 'italico' ? !!origem.closest( 'em, i' ) : comando === 'sublinhado' ? !!origem.closest( 'u' ) : false;
    const elemento = documento.createElement( comando === 'negrito' && !ativo ? 'strong' : comando === 'italico' && !ativo ? 'em' : comando === 'sublinhado' && !ativo ? 'u' : 'span' );
    if( comando === 'negrito' && ativo ) elemento.style.fontWeight = 'normal';
    if( comando === 'italico' && ativo ) elemento.style.fontStyle = 'normal';
    if( comando === 'sublinhado' && ativo ) elemento.style.textDecoration = 'none';
    if( comando === 'fonte' ) elemento.style.fontFamily = familia || 'inherit';
    if( comando === 'tamanho' ) elemento.style.fontSize = `${familia}pt`;
    if( comando === 'cor' ) elemento.style.color = familia;
    if( comando === 'fundo' ) elemento.style.backgroundColor = familia;
    const digitacaoNova = intervalo.collapsed;
    const marcador = digitacaoNova ? documento.createTextNode( '\u200b' ) : null;
    elemento.appendChild( digitacaoNova ? marcador : intervalo.extractContents() );
    intervalo.insertNode( elemento );
    const novaSelecao = documento.createRange();
    if( digitacaoNova ) {
      novaSelecao.setStart( marcador, 1 );
      novaSelecao.collapse( true );
    } else novaSelecao.selectNodeContents( elemento );
    intervaloEdicao.current = novaSelecao.cloneRange();
    const selecao = documento.getSelection();
    selecao.removeAllRanges();
    selecao.addRange( novaSelecao );
  }

  function blocosSelecionados( intervalo ) {
    const documento = iframeEditor.current.contentDocument;
    if( intervalo.collapsed ) {
      const no = intervalo.startContainer;
      const origem = no.nodeType === 1 ? no : no.parentElement;
      const bloco = origem.closest( SELETOR_BLOCO );
      if( bloco ) return [ bloco ];
      if( blocoAtual.current && documento.body.contains( blocoAtual.current ) ) return [ blocoAtual.current ];

      const containerEditavel = /^(BODY|DIV|SECTION|MAIN|HEADER|FOOTER|BLOCKQUOTE)$/.test( origem.tagName );
      if( no.nodeType === 3 && containerEditavel ) {
        const paragrafo = documento.createElement( 'p' );
        no.before( paragrafo );
        paragrafo.appendChild( no );
        return [ paragrafo ];
      }
      if( no.nodeType === 1 && containerEditavel ) {
        const proximo = no.childNodes[ intervalo.startOffset ];
        const anterior = no.childNodes[ intervalo.startOffset - 1 ];
        const texto = proximo?.nodeType === 3 ? proximo : anterior?.nodeType === 3 ? anterior : null;
        const paragrafo = documento.createElement( 'p' );
        if( texto ) {
          const noInicio = texto === proximo;
          texto.before( paragrafo );
          paragrafo.appendChild( texto );
          intervalo.setStart( texto, noInicio ? 0 : texto.length );
          intervalo.collapse( true );
          intervaloEdicao.current = intervalo.cloneRange();
        } else {
          no.insertBefore( paragrafo, proximo || null );
          paragrafo.appendChild( documento.createElement( 'br' ) );
          intervalo.setStart( paragrafo, 0 );
          intervalo.collapse( true );
          intervaloEdicao.current = intervalo.cloneRange();
        }
        return [ paragrafo ];
      }
      return [];
    }
    return [ ...documento.querySelectorAll( SELETOR_BLOCO ) ].filter( ( bloco ) =>
      intervalo.intersectsNode( bloco ) && !bloco.querySelector( SELETOR_BLOCO ) );
  }

  function alinharTexto( direcao ) {
    if( tabelaInteira ) { alinharTabela( direcao ); return; }
    const intervalo = restaurarSelecao();
    if( !intervalo ) return;
    const blocos = blocosSelecionados( intervalo );
    if( !blocos.length ) { setAvisoFormatacao( 'Posicione o cursor no texto que deseja alinhar.' ); return; }
    blocos.forEach( ( bloco ) => { bloco.style.textAlign = direcao; } );
  }

  function alinharTabela( direcao ) {
    const tabela = celulaTabela.current?.closest( 'table' );
    if( !tabela ) return;
    tabela.style.marginLeft = direcao === 'left' ? '0' : 'auto';
    tabela.style.marginRight = direcao === 'right' ? '0' : 'auto';
    const larguraPai = tabela.parentElement?.getBoundingClientRect().width || 0;
    setAvisoTabela( larguraPai && tabela.getBoundingClientRect().width >= larguraPai - 1
      ? 'A tabela ocupa toda a largura disponível. Reduza sua largura para perceber o alinhamento.' : '' );
  }

  function aplicarEstiloParagrafo( estilo ) {
    const intervalo = restaurarSelecao();
    if( !intervalo ) return;
    const blocos = blocosSelecionados( intervalo );
    if( blocos.length !== 1 || !/^(P|H[1-6])$/.test( blocos[ 0 ].tagName ) ) {
      setAvisoFormatacao( 'Selecione texto de um único parágrafo ou título.' );
      return;
    }
    const documento = iframeEditor.current.contentDocument;
    const bloco = blocos[ 0 ];
    const integral = intervalo.collapsed || intervalo.toString().trim() === bloco.textContent.trim();
    if( integral ) {
      let destino = bloco;
      if( bloco.tagName.toLowerCase() !== estilo ) {
        const novo = documento.createElement( estilo );
        [ ...bloco.attributes ].forEach( ( atributo ) => novo.setAttribute( atributo.name, atributo.value ) );
        while( bloco.firstChild ) novo.appendChild( bloco.firstChild );
        bloco.replaceWith( novo );
        destino = novo;
      }
      const cursor = documento.createRange();
      cursor.selectNodeContents( destino );
      cursor.collapse( destino.firstChild?.nodeName === 'BR' );
      intervaloEdicao.current = cursor.cloneRange();
      const selecao = documento.getSelection();
      selecao.removeAllRanges();
      selecao.addRange( cursor );
    } else {
      if( intervalo.cloneContents().querySelector( SELETOR_BLOCO ) ) {
        setAvisoFormatacao( 'Selecione texto dentro de um único parágrafo para aplicar o estilo.' );
        return;
      }
      const referencia = documento.createElement( estilo );
      referencia.textContent = 'Exemplo';
      bloco.after( referencia );
      const calculado = documento.defaultView.getComputedStyle( referencia );
      const propriedades = [ 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'color', 'textDecoration', 'letterSpacing', 'textTransform' ];
      const valores = Object.fromEntries( propriedades.map( ( propriedade ) => [ propriedade, calculado[ propriedade ] ] ) );
      referencia.remove();
      const span = documento.createElement( 'span' );
      if( estilo !== 'p' ) span.className = `argous-titulo-${estilo.slice( 1 )}`;
      propriedades.forEach( ( propriedade ) => { span.style[ propriedade ] = valores[ propriedade ]; } );
      span.appendChild( intervalo.extractContents() );
      intervalo.insertNode( span );
      const novaSelecao = documento.createRange();
      novaSelecao.selectNodeContents( span );
      intervaloEdicao.current = novaSelecao.cloneRange();
      const selecao = documento.getSelection();
      selecao.removeAllRanges();
      selecao.addRange( novaSelecao );
    }
    setEstiloParagrafo( estilo );
  }

  function alternarLista( tipo ) {
    const intervalo = restaurarSelecao();
    if( !intervalo ) return;
    const blocos = blocosSelecionados( intervalo );
    if( !blocos.length ) { setAvisoFormatacao( 'Posicione o cursor no texto para criar uma lista.' ); return; }
    const documento = iframeEditor.current.contentDocument;
    const item = blocos[ 0 ].closest( 'li' );
    if( item ) {
      const lista = item.parentElement;
      if( lista.tagName.toLowerCase() === tipo ) return;
      const nova = documento.createElement( tipo );
      while( lista.firstChild ) nova.appendChild( lista.firstChild );
      lista.replaceWith( nova );
      return;
    }
    if( blocos.some( ( bloco ) => !/^(P|H[1-6])$/.test( bloco.tagName ) || bloco.parentElement !== blocos[ 0 ].parentElement ) ) {
      setAvisoFormatacao( 'Selecione parágrafos do mesmo trecho para criar uma lista.' );
      return;
    }
    const lista = documento.createElement( tipo );
    blocos[ 0 ].before( lista );
    blocos.forEach( ( bloco ) => {
      const novo = documento.createElement( 'li' );
      [ ...bloco.attributes ].forEach( ( atributo ) => novo.setAttribute( atributo.name, atributo.value ) );
      while( bloco.firstChild ) novo.appendChild( bloco.firstChild );
      lista.appendChild( novo );
      bloco.remove();
    } );
  }

  function selecionarNoDocumento( evento ) {
    const documento = iframeEditor.current?.contentDocument;
    if( !documento ) return;
    if( evento.type === 'keyup' && grupoCelulas.current ) return;
    const selecao = documento.getSelection();
    if( evento.type !== 'pointerdown' && selecao?.rangeCount ) intervaloEdicao.current = selecao.getRangeAt( 0 ).cloneRange();
    const elemento = evento.target?.nodeType === 1 ? evento.target : evento.target?.parentElement;
    if( evento.type === 'pointerdown' ) blocoAtual.current = elemento?.closest( SELETOR_BLOCO ) || null;
    else if( evento.type === 'keyup' ) {
      const ancora = selecao?.anchorNode?.nodeType === 1 ? selecao.anchorNode : selecao?.anchorNode?.parentElement;
      blocoAtual.current = ancora?.closest( SELETOR_BLOCO ) || null;
    }
    const imagem = elemento?.closest( 'img' );
    documento.querySelectorAll( '[data-argous-imagem-selecionada]' ).forEach( ( marcada ) => marcada.removeAttribute( 'data-argous-imagem-selecionada' ) );
    if( imagem ) imagem.setAttribute( 'data-argous-imagem-selecionada', '' );
    imagemSelecionada.current = imagem || null;
    let tabela = elemento?.closest( 'table' );
    let celula = elemento?.closest( 'td, th' );
    if( !tabela && evento.type === 'pointerdown' ) {
      const tabelas = [ ...documento.querySelectorAll( 'table' ) ];
      tabela = tabelas.reverse().find( ( candidata ) => {
        const caixa = candidata.getBoundingClientRect();
        return evento.clientX >= caixa.left - 5 && evento.clientX <= caixa.right + 5 && evento.clientY >= caixa.top - 5 && evento.clientY <= caixa.bottom + 5;
      } );
    }
    if( !tabela && evento.type === 'keyup' ) {
      const ancora = selecao?.anchorNode?.nodeType === 1 ? selecao.anchorNode : selecao?.anchorNode?.parentElement;
      tabela = ancora?.closest( 'table' );
      celula = ancora?.closest( 'td, th' );
    }
    if( tabela && !celula && evento.type === 'pointerdown' ) {
      celula = [ ...tabela.querySelectorAll( 'td, th' ) ].find( ( candidata ) => {
        const caixa = candidata.getBoundingClientRect();
        return evento.clientX >= caixa.left - 5 && evento.clientX <= caixa.right + 5 && evento.clientY >= caixa.top - 5 && evento.clientY <= caixa.bottom + 5;
      } );
    }
    celula ||= tabela?.querySelector( 'td, th' );
    if( evento.type === 'pointerdown' && evento.shiftKey && celula && ancoraCelulas.current?.closest( 'table' ) === tabela ) {
      const area = retanguloCelulas( tabela, ancoraCelulas.current, celula );
      if( !area ) { setAvisoTabela( 'A seleção deve formar um retângulo completo, sem cortar uma célula já mesclada.' ); return; }
      documento.querySelectorAll( '[data-argous-celula-grupo]' ).forEach( ( marcada ) => marcada.removeAttribute( 'data-argous-celula-grupo' ) );
      area.celulas.forEach( ( item ) => item.setAttribute( 'data-argous-celula-grupo', '' ) );
      grupoCelulas.current = { tabela, inicio: ancoraCelulas.current, fim: celula };
      celulaTabela.current = celula;
      setQuantidadeCelulas( area.celulas.length );
      setCelulaMesclada( celula.rowSpan !== 1 || celula.colSpan !== 1 );
      setTabelaAtiva( true );
      setTabelaInteira( false );
      setAvisoTabela( '' );
      evento.preventDefault();
      return;
    }
    if( evento.type === 'pointerdown' ) {
      documento.querySelectorAll( '[data-argous-celula-grupo]' ).forEach( ( marcada ) => marcada.removeAttribute( 'data-argous-celula-grupo' ) );
      grupoCelulas.current = null;
      ancoraCelulas.current = celula || null;
      setQuantidadeCelulas( 0 );
    }
    documento.querySelectorAll( '[data-argous-selecionada], [data-argous-celula], [data-argous-tabela-inteira]' ).forEach( ( marcado ) => {
      marcado.removeAttribute( 'data-argous-selecionada' );
      marcado.removeAttribute( 'data-argous-celula' );
      marcado.removeAttribute( 'data-argous-tabela-inteira' );
    } );
    if( tabela ) tabela.setAttribute( 'data-argous-selecionada', '' );
    if( celula ) celula.setAttribute( 'data-argous-celula', '' );
    celulaTabela.current = celula || null;
    setTabelaAtiva( !!tabela );
    setTabelaInteira( false );
    setCelulaMesclada( !!celula && ( celula.rowSpan !== 1 || celula.colSpan !== 1 ) );
    if( tabela ) {
      const larguraPai = tabela.parentElement?.getBoundingClientRect().width || 1;
      setLarguraTabela( String( Math.min( 100, Math.round( tabela.getBoundingClientRect().width / larguraPai * 100 ) ) ) );
    }
    setClasseTabela( tabela?.className || '' );
    setAvisoTabela( '' );
    if( evento.type === 'pointerdown' && celula ) iniciarArrasteColuna( evento, celula );
  }

  function iniciarArrasteColuna( evento, celula ) {
    const limite = celula.getBoundingClientRect();
    if( limite.right - evento.clientX > 9 || limite.right - evento.clientX < -6 ) return;
    const tabela = celula.closest( 'table' );
    if( !tabela || tabela.querySelector( '[colspan]:not([colspan="1"]), [rowspan]:not([rowspan="1"])' ) ) return;
    const indice = celula.cellIndex;
    const larguras = [ ...tabela.rows[ 0 ].cells ].map( ( item ) => item.getBoundingClientRect().width );
    tabela.style.tableLayout = 'fixed';
    tabela.style.width = `${tabela.getBoundingClientRect().width}px`;
    [ ...tabela.rows ].forEach( ( linha ) => [ ...linha.cells ].forEach( ( item, coluna ) => { item.style.width = `${larguras[ coluna ]}px`; } ) );
    arrasteColuna.current = { tabela, indice, inicioX: evento.clientX, larguras, celula, pointerId: evento.pointerId };
    celula.setPointerCapture( evento.pointerId );
    evento.preventDefault();
  }

  function moverArrasteColuna( evento ) {
    const arraste = arrasteColuna.current;
    if( !arraste ) return;
    const { tabela, indice, inicioX, larguras } = arraste;
    const seguinte = indice + 1;
    const delta = seguinte < larguras.length ? Math.max( 40 - larguras[ indice ], Math.min( larguras[ seguinte ] - 40, evento.clientX - inicioX ) ) : Math.max( 40 - larguras[ indice ], evento.clientX - inicioX );
    [ ...tabela.rows ].forEach( ( linha ) => {
      if( linha.cells[ indice ] ) linha.cells[ indice ].style.width = `${larguras[ indice ] + delta}px`;
      if( linha.cells[ seguinte ] ) linha.cells[ seguinte ].style.width = `${larguras[ seguinte ] - delta}px`;
    } );
    if( seguinte >= larguras.length ) tabela.style.width = `${larguras.reduce( ( total, largura ) => total + largura, 0 ) + delta}px`;
  }

  function encerrarArrasteColuna() {
    const arraste = arrasteColuna.current;
    if( arraste?.celula.hasPointerCapture( arraste.pointerId ) ) arraste.celula.releasePointerCapture( arraste.pointerId );
    arrasteColuna.current = null;
    if( arraste ) registrarAlteracao();
  }

  function inserirTabela() {
    const documento = iframeEditor.current?.contentDocument;
    if( !documento || codigoFonte ) return;
    const tabela = documento.createElement( 'table' );
    const corpo = tabela.createTBody();
    for( let linha = 0; linha < 3; linha++ ) {
      const atual = corpo.insertRow();
      for( let coluna = 0; coluna < 3; coluna++ ) atual.insertCell().innerHTML = '<br>';
    }
    const intervalo = intervaloEdicao.current;
    if( intervalo && documento.body.contains( intervalo.commonAncestorContainer ) && !intervalo.commonAncestorContainer.parentElement?.closest( 'table' ) ) {
      intervalo.collapse( false );
      intervalo.insertNode( tabela );
    } else documento.body.appendChild( tabela );
    celulaTabela.current = tabela.querySelector( 'td' );
    ancoraCelulas.current = celulaTabela.current;
    grupoCelulas.current = null;
    setTabelaAtiva( true );
    setTabelaInteira( false );
    setQuantidadeCelulas( 0 );
    setCelulaMesclada( false );
    setLarguraTabela( '100' );
    setClasseTabela( '' );
    setAvisoTabela( '' );
  }

  function alterarEstruturaTabela( acao ) {
    const celula = celulaTabela.current;
    const tabela = celula?.closest( 'table' );
    const linha = celula?.closest( 'tr' );
    if( !tabela || !linha ) return;
    if( tabela.querySelector( '[colspan]:not([colspan="1"]), [rowspan]:not([rowspan="1"])' ) ) {
      setAvisoTabela( 'Para alterar linhas ou colunas, desfaça primeiro as mesclagens desta tabela.' );
      return;
    }
    const indiceColuna = celula.cellIndex;
    if( acao === 'linha-abaixo' ) {
      const nova = linha.parentElement.insertRow( linha.sectionRowIndex + 1 );
      [ ...linha.cells ].forEach( ( origem ) => { const destino = origem.cloneNode( false ); destino.innerHTML = '<br>'; nova.appendChild( destino ); } );
      celulaTabela.current = nova.cells[ indiceColuna ];
    } else if( acao === 'remover-linha' ) {
      if( tabela.rows.length === 1 ) { setAvisoTabela( 'A tabela precisa manter pelo menos uma linha.' ); return; }
      const proxima = tabela.rows[ Math.min( linha.rowIndex + 1, tabela.rows.length - 1 ) ] === linha ? tabela.rows[ linha.rowIndex - 1 ] : tabela.rows[ Math.min( linha.rowIndex + 1, tabela.rows.length - 1 ) ];
      linha.remove();
      celulaTabela.current = proxima?.cells[ indiceColuna ] || null;
    } else if( acao === 'coluna-direita' ) {
      [ ...tabela.rows ].forEach( ( atual ) => { const origem = atual.cells[ indiceColuna ]; const destino = origem.cloneNode( false ); destino.innerHTML = '<br>'; atual.insertBefore( destino, origem.nextSibling ); } );
      celulaTabela.current = linha.cells[ indiceColuna + 1 ];
    } else if( acao === 'remover-coluna' ) {
      if( linha.cells.length === 1 ) { setAvisoTabela( 'A tabela precisa manter pelo menos uma coluna.' ); return; }
      [ ...tabela.rows ].forEach( ( atual ) => atual.cells[ indiceColuna ]?.remove() );
      celulaTabela.current = linha.cells[ Math.min( indiceColuna, linha.cells.length - 1 ) ];
    }
    setAvisoTabela( '' );
  }

  function mesclarCelulas() {
    const grupo = grupoCelulas.current;
    const area = grupo && retanguloCelulas( grupo.tabela, grupo.inicio, grupo.fim );
    if( !area || area.celulas.length < 2 ) return;
    const linhas = [ ...grupo.tabela.rows ].slice( area.topo, area.baixo );
    if( linhas.some( ( linha ) => linha.parentElement !== linhas[ 0 ].parentElement ) ) {
      setAvisoTabela( 'Não é possível mesclar células entre seções diferentes da tabela.' );
      return;
    }
    const principal = area.grade[ area.topo ][ area.esquerda ].celula;
    const ordenadas = area.celulas.sort( ( a, b ) => {
      const primeira = area.posicoes.get( a );
      const segunda = area.posicoes.get( b );
      return primeira.linha - segunda.linha || primeira.coluna - segunda.coluna;
    } );
    if( !principal.textContent.trim() && !principal.querySelector( 'img, table' ) ) principal.innerHTML = '';
    ordenadas.forEach( ( celula ) => {
      celula.removeAttribute( 'data-argous-celula-grupo' );
      if( celula === principal ) return;
      if( celula.textContent.trim() || celula.querySelector( 'img, table' ) ) {
        if( principal.childNodes.length ) principal.appendChild( principal.ownerDocument.createElement( 'br' ) );
        while( celula.firstChild ) principal.appendChild( celula.firstChild );
      }
      celula.remove();
    } );
    principal.rowSpan = area.baixo - area.topo;
    principal.colSpan = area.direita - area.esquerda;
    grupo.tabela.ownerDocument.querySelectorAll( '[data-argous-celula]' ).forEach( ( marcada ) => marcada.removeAttribute( 'data-argous-celula' ) );
    principal.setAttribute( 'data-argous-celula', '' );
    grupoCelulas.current = null;
    ancoraCelulas.current = principal;
    celulaTabela.current = principal;
    setQuantidadeCelulas( 0 );
    setCelulaMesclada( true );
    setAvisoTabela( '' );
  }

  function dividirCelula() {
    const celula = celulaTabela.current;
    const tabela = celula?.closest( 'table' );
    if( !tabela || ( celula.rowSpan === 1 && celula.colSpan === 1 ) ) return;
    const { posicoes } = mapaTabela( tabela );
    const posicao = posicoes.get( celula );
    const linhas = [ ...tabela.rows ];
    celula.rowSpan = 1;
    celula.colSpan = 1;
    for( let linha = posicao.linha; linha < posicao.linha + posicao.altura; linha++ ) {
      for( let coluna = posicao.coluna; coluna < posicao.coluna + posicao.largura; coluna++ ) {
        if( linha === posicao.linha && coluna === posicao.coluna ) continue;
        const nova = celula.ownerDocument.createElement( celula.tagName.toLowerCase() );
        nova.className = celula.className;
        nova.style.cssText = celula.style.cssText;
        nova.innerHTML = '<br>';
        const seguinte = [ ...linhas[ linha ].cells ].find( ( existente ) => posicoes.get( existente )?.coluna > coluna );
        linhas[ linha ].insertBefore( nova, seguinte || null );
      }
    }
    grupoCelulas.current = null;
    ancoraCelulas.current = celula;
    setQuantidadeCelulas( 0 );
    setCelulaMesclada( false );
    setAvisoTabela( '' );
  }

  function aplicarClasseTabela( classe ) {
    const tabela = celulaTabela.current?.closest( 'table' );
    if( !tabela ) return;
    tabela.className = classe;
    setClasseTabela( classe );
  }

  function alternarSelecaoTabela() {
    const tabela = celulaTabela.current?.closest( 'table' );
    if( !tabela ) return;
    const selecionarInteira = !tabelaInteira;
    tabela.ownerDocument.querySelectorAll( '[data-argous-celula-grupo]' ).forEach( ( marcada ) => marcada.removeAttribute( 'data-argous-celula-grupo' ) );
    grupoCelulas.current = null;
    setQuantidadeCelulas( 0 );
    if( selecionarInteira ) {
      celulaTabela.current?.removeAttribute( 'data-argous-celula' );
      tabela.setAttribute( 'data-argous-tabela-inteira', '' );
      setAvisoTabela( '' );
    } else {
      tabela.removeAttribute( 'data-argous-tabela-inteira' );
      celulaTabela.current?.setAttribute( 'data-argous-celula', '' );
    }
    setTabelaInteira( selecionarInteira );
  }

  function aplicarLarguraTabela() {
    const tabela = celulaTabela.current?.closest( 'table' );
    const largura = Number( larguraTabela );
    if( !tabela || !Number.isInteger( largura ) || largura < 10 || largura > 100 ) {
      setAvisoTabela( 'Informe uma largura entre 10% e 100%.' );
      return;
    }
    tabela.style.width = `${largura}%`;
    setAvisoTabela( '' );
  }

  function colorirCelula( cor ) {
    if( !celulaTabela.current ) return;
    celulaTabela.current.style.backgroundColor = cor;
    setCorCelula( cor );
  }

  function inserirNoCursor( elemento ) {
    const intervalo = restaurarSelecao();
    if( !intervalo ) return false;
    intervalo.deleteContents();
    intervalo.insertNode( elemento );
    const depois = iframeEditor.current.contentDocument.createRange();
    depois.setStartAfter( elemento );
    depois.collapse( true );
    intervaloEdicao.current = depois.cloneRange();
    const selecao = iframeEditor.current.contentDocument.getSelection();
    selecao.removeAllRanges();
    selecao.addRange( depois );
    return true;
  }

  function inserirVariavel( variavel ) {
    const codigo = variavel?.codigo?.trim();
    if( !codigo ) return;
    const inserida = executarComHistorico( () => inserirNoCursor( iframeEditor.current.contentDocument.createTextNode( `{{${codigo}}}` ) ) );
    if( !inserida ) return;
    setDialogoVariavel( false );
    setBuscaVariavel( '' );
  }

  function abrirLink() {
    const intervalo = intervaloEdicao.current;
    const origem = intervalo?.startContainer?.nodeType === 1 ? intervalo.startContainer : intervalo?.startContainer?.parentElement;
    const link = origem?.closest( 'a' );
    setEnderecoLink( link?.getAttribute( 'href' ) || '' );
    setTextoLink( link?.textContent || intervalo?.toString() || '' );
    setDialogoLink( true );
  }

  function aplicarLink() {
    const endereco = enderecoLink.trim();
    if( !/^(https:\/\/[^\s]+|mailto:[^\s@]+@[^\s@]+|#[A-Za-z][\w-]*)$/i.test( endereco ) ) {
      setAvisoFormatacao( 'Informe um endereço HTTPS, um e-mail ou uma âncora local.' );
      return;
    }
    const aplicado = executarComHistorico( () => {
      const intervalo = restaurarSelecao();
      if( !intervalo ) return false;
      const documento = iframeEditor.current.contentDocument;
      const origem = intervalo.startContainer.nodeType === 1 ? intervalo.startContainer : intervalo.startContainer.parentElement;
      const existente = origem?.closest( 'a' );
      if( existente ) { existente.href = endereco; if( textoLink.trim() ) existente.textContent = textoLink.trim(); return true; }
      if( !intervalo.collapsed && intervalo.cloneContents().querySelector( SELETOR_BLOCO ) ) {
        setAvisoFormatacao( 'Selecione texto dentro de um único parágrafo para criar o link.' );
        return false;
      }
      const link = documento.createElement( 'a' );
      link.href = endereco;
      if( intervalo.collapsed || textoLink.trim() !== intervalo.toString().trim() ) {
        if( !textoLink.trim() ) { setAvisoFormatacao( 'Informe o texto que aparecerá no link.' ); return false; }
        link.textContent = textoLink.trim();
        return inserirNoCursor( link );
      } else {
        link.appendChild( intervalo.extractContents() );
        intervalo.insertNode( link );
        return true;
      }
    } );
    if( aplicado ) setDialogoLink( false );
  }

  async function abrirImagens() {
    setDialogoImagem( true );
    setErroRecursos( '' );
    setCarregandoRecursos( true );
    const imagem = imagemSelecionada.current;
    setDescricaoImagem( imagem?.alt || '' );
    setLarguraImagem( imagem?.style.width?.replace( 'px', '' ) || '320' );
    try {
      const consultas = [ executar( 'LISTAR_RECURSOS_INSTITUICAO' ) ];
      if( idProtocolo ) consultas.unshift( executar( 'LISTAR_RECURSOS_PROTOCOLO', { idProtocolo } ) );
      const resultados = await Promise.allSettled( consultas );
      const encontrados = resultados.flatMap( ( resultado, indice ) => resultado.status === 'fulfilled'
        ? ( resultado.value.recursos || [] ).map( ( recurso ) => ({ ...recurso, origem: idProtocolo && indice === 0 ? 'Protocolo' : 'Instituição' }) ) : [] );
      setRecursos( encontrados );
      if( resultados.every( ( resultado ) => resultado.status === 'rejected' ) ) throw resultados[ 0 ].reason;
      if( resultados.some( ( resultado ) => resultado.status === 'rejected' ) ) setErroRecursos( 'Parte dos recursos não pôde ser carregada.' );
      const idAtual = imagem ? new URL( imagem.src ).searchParams.get( 'idArquivoVersao' ) : null;
      setRecursoEscolhido( encontrados.find( ( recurso ) => recurso.idArquivoVersao === idAtual )?.idArquivoVersao || '' );
    } catch ( erro ) {
      setErroRecursos( erro.message || 'Não foi possível consultar os recursos.' );
    } finally {
      setCarregandoRecursos( false );
    }
  }

  function aplicarImagem() {
    const recurso = recursos.find( ( item ) => item.idArquivoVersao === recursoEscolhido );
    const largura = Number( larguraImagem );
    if( !recurso || !Number.isInteger( largura ) || largura < 32 || largura > 1600 ) {
      setErroRecursos( 'Escolha uma imagem e informe largura entre 32 e 1600 pixels.' );
      return;
    }
    const aplicada = executarComHistorico( () => {
      const documento = iframeEditor.current.contentDocument;
      const imagem = imagemSelecionada.current && documento.body.contains( imagemSelecionada.current )
        ? imagemSelecionada.current : documento.createElement( 'img' );
      imagem.src = enderecoRecurso( recurso );
      imagem.alt = descricaoImagem.trim() || recurso.nome || recurso.codigo;
      imagem.style.width = `${largura}px`;
      imagem.style.maxWidth = '100%';
      if( !imagem.isConnected && !inserirNoCursor( imagem ) ) return false;
      imagemSelecionada.current = imagem;
      return true;
    } );
    if( aplicada ) setDialogoImagem( false );
  }

  function inserirQuebraPagina() {
    const documento = iframeEditor.current?.contentDocument;
    const intervalo = restaurarSelecao();
    if( !documento || !intervalo ) return;
    const origem = intervalo.endContainer.nodeType === 1 ? intervalo.endContainer : intervalo.endContainer.parentElement;
    const referencia = origem?.closest( 'table, p, h1, h2, h3, h4, h5, h6, ul, ol, blockquote, pre, section, main, div' );
    if( !referencia || referencia === documento.body ) {
      setAvisoFormatacao( 'Posicione o cursor em um parágrafo para inserir a quebra de página.' );
      return;
    }
    const quebra = documento.createElement( 'div' );
    quebra.className = 'argous-page-break';
    quebra.style.breakBefore = 'page';
    quebra.style.pageBreakBefore = 'always';
    referencia.after( quebra );
    const proximo = documento.createElement( 'p' );
    proximo.appendChild( documento.createElement( 'br' ) );
    quebra.after( proximo );
    const cursor = documento.createRange();
    cursor.selectNodeContents( proximo );
    cursor.collapse( true );
    intervaloEdicao.current = cursor.cloneRange();
    const selecao = documento.getSelection();
    selecao.removeAllRanges();
    selecao.addRange( cursor );
  }

  function capturarEdicao() {
    if( aba !== 'html' || codigoFonte || !selecionada ) return;
    encerrarGrupoDigitacao();
    const html = htmlDoEditor();
    if( html === null ) return;
    if( html !== parteAtual?.html ) setPartes( ( atual ) => atual.map( ( parte ) => parte.id === selecionada ? { ...parte, html } : parte ) );
  }

  function selecionarParte( id ) {
    capturarEdicao();
    setSelecionada( id );
    celulaTabela.current = null;
    imagemSelecionada.current = null;
    blocoAtual.current = null;
    intervaloEdicao.current = null;
    setTabelaAtiva( false );
    setTabelaInteira( false );
  }

  function mudarAba( id ) {
    capturarEdicao();
    setAba( id );
    celulaTabela.current = null;
    blocoAtual.current = null;
    setTabelaAtiva( false );
    setTabelaInteira( false );
  }

  async function importarArquivos( evento ) {
    const arquivos = [ ...( evento.target.files || [] ) ];
    evento.target.value = '';
    if( !arquivos.length ) return;
    try {
      const htmls = arquivos.filter( ( arquivo ) => /\.html?$/i.test( arquivo.name ) );
      const csss = arquivos.filter( ( arquivo ) => /\.css$/i.test( arquivo.name ) );
      if( htmls.length > 1 || ( !htmls.length && !csss.length ) || htmls.length + csss.length !== arquivos.length ) {
        throw new Error( 'Selecione um HTML, um ou mais CSS, ou ambos.' );
      }
      if( new Set( csss.map( ( arquivo ) => arquivo.name ) ).size !== csss.length ) {
        throw new Error( 'Dois arquivos CSS selecionados têm o mesmo nome.' );
      }
      const separado = htmls.length ? separarHtml( await htmls[ 0 ].text() ) : null;
      const arquivosCss = await Promise.all( csss.map( async ( arquivo ) => ({
        id: `css-importado-${arquivo.name}`, nome: arquivo.name, conteudo: validarCss( await arquivo.text() ),
      }) ) );
      const faltantes = ( separado?.linksLocais || [] ).filter( ( referencia ) => !csss.some( ( arquivo ) => arquivo.name === referencia.split( '/' ).pop() ) );
      if( faltantes.length ) throw new Error( `Selecione também o CSS referenciado pelo HTML: ${faltantes.join( ', ' )}` );
      separado?.cssInternos.forEach( validarCss );
      const internos = ( separado?.cssInternos || [] ).map( ( conteudo, indice ) => ({ id: `css-interno-${indice}`, nome: `estilo-interno-${indice + 1}.css`, conteudo }) );
      const ordenados = [ ...arquivosCss, ...internos ];
      const html = separado?.html ?? ( aba === 'html' && !codigoFonte ? htmlDoEditor() : null );
      if( html !== null ) setPartes( ( atual ) => atual.map( ( parte ) => parte.id === selecionada ? { ...parte, html } : parte ) );
      setEstilos( ( atual ) => {
        const semSubstituidos = atual.filter( ( existente ) => !ordenados.some( ( novo ) => novo.nome === existente.nome ) );
        return [ ...semSubstituidos, ...ordenados ];
      } );
      if( separado ) { setCodigoFonte( false ); setAba( 'html' ); }
      else if( aba !== 'html' && arquivosCss.length ) setAba( arquivosCss[ 0 ].id );
      setErroImportacao( '' );
    } catch ( erro ) {
      setErroImportacao( erro.message || 'Não foi possível importar os arquivos.' );
    }
  }

  function atualizarCss( id, conteudo ) {
    setEstilos( ( atual ) => atual.map( ( arquivo ) => arquivo.id === id ? { ...arquivo, conteudo } : arquivo ) );
  }

  function adicionarCss() {
    const id = `css-novo-${estilos.length}`;
    setEstilos( ( atual ) => [ ...atual, { id, nome: `novo-estilo-${atual.length + 1}.css`, conteudo: '' } ] );
    setAba( id );
  }

  const estiloAtual = estilos.find( ( arquivo ) => arquivo.id === aba );

  function alternarParte( tipo, id ) {
    const existente = partes.find( ( parte ) => parte.id === id );
    if( existente ) {
      if( tipo === 'B' && existente.ativa && partes.filter( ( parte ) => parte.tipo === 'B' && parte.ativa ).length === 1 ) return;
      capturarEdicao();
      intervaloEdicao.current = null;
      setPartes( ( atual ) => atual.map( ( parte ) => parte.id === id ? { ...parte, ativa: !parte.ativa } : parte ) );
      if( !existente.ativa ) setSelecionada( id );
      else if( selecionada === id ) setSelecionada( partes.find( ( parte ) => parte.id !== id && parte.ativa )?.id );
      return;
    }
    capturarEdicao();
    intervaloEdicao.current = null;
    const nova = { id: `mock-${tipo}`, tipo, html: '', ativa: true };
    setPartes( ( atual ) => [ ...atual, nova ] );
    setSelecionada( nova.id );
    setAba( 'html' );
  }

  function adicionarCorpo() {
    capturarEdicao();
    intervaloEdicao.current = null;
    const nova = { id: `mock-B-${partes.length}`, tipo: 'B', html: '', ativa: true };
    setPartes( ( atual ) => [ ...atual, nova ] );
    setSelecionada( nova.id );
    setAba( 'html' );
  }

  function moverCorpo( id, direcao ) {
    setPartes( ( atual ) => {
      const corpos = atual.filter( ( parte ) => parte.tipo === 'B' );
      const posicao = corpos.findIndex( ( parte ) => parte.id === id );
      const destino = posicao + direcao;
      if( destino < 0 || destino >= corpos.length ) return atual;
      [ corpos[ posicao ], corpos[ destino ] ] = [ corpos[ destino ], corpos[ posicao ] ];
      let indice = 0;
      return atual.map( ( parte ) => parte.tipo === 'B' ? corpos[ indice++ ] : parte );
    } );
  }

  async function salvarDocumento() {
    const htmlAtual = aba === 'html' && !codigoFonte ? htmlDoEditor() : null;
    const partesParaSalvar = partes.filter( ( parte ) => parte.ativa ).map( ( parte ) => ({
      tipo: parte.tipo,
      html: parte.id === selecionada && htmlAtual !== null ? htmlAtual : parte.html,
    }) );
    if( !metadados.codigo.trim() || !metadados.titulo.trim() ) {
      setErroSalvar( 'Informe o código técnico e o título nas propriedades do documento.' );
      setPropriedades( true );
      return;
    }
    if( !partesParaSalvar.some( ( parte ) => parte.tipo === 'B' && parte.html.trim() ) || partesParaSalvar.some( ( parte ) => !parte.html.trim() ) ) {
      setErroSalvar( 'Preencha todas as partes ativadas, incluindo ao menos um Corpo.' );
      return;
    }
    try {
      setErroSalvar( '' );
      await aoSalvar( { ...modelo, ...metadados, partes: partesParaSalvar,
        estilos: estilos.map( ( estilo ) => ({ nome: estilo.nome, conteudo: estilo.conteudo || '' }) ) } );
    } catch ( erro ) {
      setErroSalvar( erro.message || 'Não foi possível salvar o documento HTML.' );
    }
  }

  return <Dialog open fullScreen onClose={() => { capturarEdicao(); aoFechar(); }} className="html-studio-dialog">
    <div className="html-studio-shell">
      <header className="html-studio-header">
        <div className="html-studio-heading">
          <IconButton aria-label={aba === 'html' ? 'Voltar ao Protocolo' : 'Voltar ao documento HTML'}
            onClick={() => aba === 'html' ? aoFechar() : mudarAba( 'html' )}><ArrowLeft size={21} /></IconButton>
          <div><span className="html-studio-kicker">MODELO DE DOCUMENTO <span className="html-studio-badge">Rascunho</span></span>
            <h1>{metadados.titulo || 'Novo documento HTML'}</h1></div>
        </div>
        <div className="html-studio-header-actions">
          <button className="html-studio-properties-button" type="button" onClick={() => setPropriedades( ( atual ) => !atual )}
            aria-expanded={propriedades}><Settings2 size={18} /> Propriedades <ChevronDown size={15} /></button>
          <button className="html-studio-save" type="button" disabled={salvando || !aoSalvar} onClick={salvarDocumento}>{salvando ? 'Salvando…' : 'Salvar documento'}</button>
          <IconButton aria-label="Fechar protótipo" onClick={aoFechar}><X size={20} /></IconButton>
        </div>
      </header>
      <input ref={arquivosInput} hidden type="file" multiple accept={aba === 'html' ? '.html,.htm,.css,text/html,text/css' : '.css,text/css'} onChange={importarArquivos} />

      {propriedades && <section className="html-studio-properties" aria-label="Propriedades do modelo">
        <label><span>Código técnico</span><input value={metadados.codigo} maxLength={30} disabled={!!modelo.id}
          onChange={( evento ) => setMetadados( ( atual ) => ({ ...atual, codigo: evento.target.value }) )} /></label>
        <label><span>Título</span><input value={metadados.titulo} maxLength={70}
          onChange={( evento ) => setMetadados( ( atual ) => ({ ...atual, titulo: evento.target.value }) )} /></label>
        <label><span>Observações</span><input value={metadados.observacoes}
          onChange={( evento ) => setMetadados( ( atual ) => ({ ...atual, observacoes: evento.target.value }) )} /></label>
        <label><span>Validade em dias</span><input type="number" min="1" max="32767" placeholder="Sem vencimento" value={metadados.diasVencimento}
          onChange={( evento ) => setMetadados( ( atual ) => ({ ...atual, diasVencimento: evento.target.value }) )} /></label>
      </section>}

      {erroSalvar && <output className="html-studio-import-error" role="alert">{erroSalvar}</output>}

      <nav className="html-studio-tabs" aria-label="Arquivos do documento">
        <button type="button" className={aba === 'html' ? 'active' : ''} onClick={() => mudarAba( 'html' )}><FileText size={16} /> Documento HTML</button>
        {estilos.map( ( arquivo ) => <button key={arquivo.id} type="button" className={aba === arquivo.id ? 'active' : ''} onClick={() => mudarAba( arquivo.id )}><Braces size={16} /> {arquivo.nome}</button> )}
        <Tooltip title="Adicionar arquivo CSS"><button type="button" className="html-studio-add-tab" aria-label="Adicionar arquivo CSS" onClick={adicionarCss}><Plus size={17} /></button></Tooltip>
      </nav>

      {aba === 'html' ? <div className="html-studio-workspace">
        <aside className="html-studio-outline" aria-label="Estrutura do documento">
          <div className="html-studio-outline-heading"><span>ESTRUTURA</span><small>Partes do documento</small></div>
          {TIPOS.map( ( tipo ) => {
            const itens = tipo.codigo === 'B' ? partes.filter( ( parte ) => parte.tipo === 'B' ) : [ partes.find( ( parte ) => parte.tipo === tipo.codigo ) ];
            return <div className="html-studio-outline-group" key={tipo.codigo}>
              {itens.map( ( parte, indice ) => {
                const ativa = !!parte?.ativa;
                const rotulo = tipo.codigo === 'B' ? `Corpo ${indice + 1}` : tipo.nome;
                return <div key={parte?.id || tipo.codigo} className={`html-studio-outline-row ${ativa ? 'enabled' : 'disabled'} ${parte?.id === selecionada && aba === 'html' ? 'selected' : ''}`}>
                  <button type="button" className="html-studio-outline-select" disabled={!ativa} onClick={() => selecionarParte( parte.id )}>
                    <tipo.Icone size={18} /><span>{rotulo}</span></button>
                  {tipo.codigo === 'B' && <span className="html-studio-reorder">
                    <button type="button" aria-label={`Subir ${rotulo}`} disabled={indice === 0} onClick={() => moverCorpo( parte.id, -1 )}><ArrowUp size={14} /></button>
                    <button type="button" aria-label={`Descer ${rotulo}`} disabled={indice === numeroCorpos - 1} onClick={() => moverCorpo( parte.id, 1 )}><ArrowDown size={14} /></button>
                  </span>}
                  <Switch size="small" checked={ativa} onChange={() => alternarParte( tipo.codigo, parte?.id )}
                    disabled={tipo.codigo === 'B' && ativa && partes.filter( ( item ) => item.tipo === 'B' && item.ativa ).length === 1}
                    inputProps={{ 'aria-label': `${ativa ? 'Desativar' : 'Ativar'} ${rotulo}` }} />
                </div>;
              } )}
              {tipo.codigo === 'B' && <button type="button" className="html-studio-add-body" onClick={adicionarCorpo}><Plus size={16} /> Adicionar corpo</button>}
            </div>;
          } )}
          <p className="html-studio-outline-note">As partes do corpo aparecem na ordem acima. Cabeçalho e rodapé se repetem nas páginas do documento.</p>
        </aside>

        <main className="html-studio-main">
          {erroImportacao && <div role="alert" className="html-studio-import-error">{erroImportacao}</div>}
          <div className="html-studio-toolbar" role="toolbar" aria-label="Ferramentas de edição do documento">
            <div className="html-studio-toolbar-group"><Tooltip title="Importar HTML e/ou CSS"><button type="button" className="html-studio-import-button" aria-label="Importar HTML e/ou CSS" onClick={() => arquivosInput.current?.click()}><FileInput size={18} /></button></Tooltip></div>
            <div className="html-studio-toolbar-group">
              <BotaoFerramenta Icone={Undo2} rotulo="Desfazer (Ctrl+Z / ⌘Z)" desativado={codigoFonte} aoClicar={() => aplicarHistorico( 'desfazer' )} />
              <BotaoFerramenta Icone={Redo2} rotulo="Refazer (Ctrl+Shift+Z, Ctrl+Y ou ⌘Shift+Z)" desativado={codigoFonte} aoClicar={() => aplicarHistorico( 'refazer' )} />
            </div>
            <div className="html-studio-toolbar-group"><select className="html-studio-font" aria-label="Fonte do texto selecionado" defaultValue="" disabled={codigoFonte}
              onChange={( evento ) => { executarComHistorico( () => formatarTexto( 'fonte', evento.target.value ) ); evento.target.value = ''; }}>
              {FONTES.map( ([ nome, valor ]) => <option key={nome} value={valor}>{nome}</option> )}
            </select></div>
            <div className="html-studio-toolbar-group"><label className="html-studio-size-label">Tamanho
              <input type="number" min="6" max="96" step="0.5" aria-label="Tamanho da fonte em pontos" value={tamanhoFonte} disabled={codigoFonte}
                onChange={( evento ) => { tamanhoEditado.current = true; setTamanhoFonte( evento.target.value ); }}
                onBlur={() => { if( tamanhoEditado.current ) { tamanhoEditado.current = false; const pontos = Number( tamanhoFonte );
                  if( pontos >= 6 && pontos <= 96 ) executarComHistorico( () => formatarTexto( 'tamanho', String( pontos ) ) );
                  else setAvisoFormatacao( 'Informe um tamanho entre 6 e 96 pontos.' ); } }}
                onKeyDown={( evento ) => { if( evento.key === 'Enter' ) evento.currentTarget.blur(); }} /> pt
            </label></div>
            <div className="html-studio-toolbar-group"><select className="html-studio-style" aria-label="Estilo do parágrafo ou texto selecionado" value={estiloParagrafo} disabled={codigoFonte}
              onChange={( evento ) => executarComHistorico( () => aplicarEstiloParagrafo( evento.target.value ) )}>
              <option value="p">Texto normal</option>
              {[ 1, 2, 3, 4, 5, 6 ].map( ( nivel ) => <option key={nivel} value={`h${nivel}`}>Título {nivel}</option> )}
            </select></div>
            <div className="html-studio-toolbar-group">
              <BotaoFerramenta Icone={Bold} rotulo="Negrito" desativado={codigoFonte} aoClicar={() => executarComHistorico( () => formatarTexto( 'negrito' ) )} />
              <BotaoFerramenta Icone={Italic} rotulo="Itálico" desativado={codigoFonte} aoClicar={() => executarComHistorico( () => formatarTexto( 'italico' ) )} />
              <BotaoFerramenta Icone={Underline} rotulo="Sublinhado" desativado={codigoFonte} aoClicar={() => executarComHistorico( () => formatarTexto( 'sublinhado' ) )} />
              <Tooltip title="Cor do texto selecionado"><label className="html-studio-color-tool" aria-label="Cor do texto selecionado"><Palette size={18} /><input type="color" value={corTexto} disabled={codigoFonte} aria-label="Escolher cor do texto" onChange={( evento ) => { setCorTexto( evento.target.value ); executarComHistorico( () => formatarTexto( 'cor', evento.target.value ) ); }} /></label></Tooltip>
              <Tooltip title="Cor de fundo do texto selecionado"><label className="html-studio-color-tool" aria-label="Cor de fundo do texto selecionado"><Highlighter size={18} /><input type="color" value={corFundo} disabled={codigoFonte} aria-label="Escolher cor de fundo do texto" onChange={( evento ) => { setCorFundo( evento.target.value ); executarComHistorico( () => formatarTexto( 'fundo', evento.target.value ) ); }} /></label></Tooltip>
            </div>
            <div className="html-studio-toolbar-group">
              <BotaoFerramenta Icone={List} rotulo="Lista" desativado={codigoFonte} aoClicar={() => executarComHistorico( () => alternarLista( 'ul' ) )} />
              <BotaoFerramenta Icone={ListOrdered} rotulo="Lista numerada" desativado={codigoFonte} aoClicar={() => executarComHistorico( () => alternarLista( 'ol' ) )} />
              <BotaoFerramenta Icone={AlignLeft} rotulo={tabelaInteira ? 'Alinhar tabela à esquerda' : 'Alinhar texto à esquerda'} desativado={codigoFonte} aoClicar={() => executarComHistorico( () => alinharTexto( 'left' ) )} />
              <BotaoFerramenta Icone={AlignCenter} rotulo={tabelaInteira ? 'Centralizar tabela' : 'Centralizar texto'} desativado={codigoFonte} aoClicar={() => executarComHistorico( () => alinharTexto( 'center' ) )} />
              <BotaoFerramenta Icone={AlignRight} rotulo={tabelaInteira ? 'Alinhar tabela à direita' : 'Alinhar texto à direita'} desativado={codigoFonte} aoClicar={() => executarComHistorico( () => alinharTexto( 'right' ) )} />
            </div>
            <div className="html-studio-toolbar-group">
              <BotaoFerramenta Icone={Table2} rotulo="Inserir tabela" desativado={codigoFonte} aoClicar={() => executarComHistorico( inserirTabela )} />
              <BotaoFerramenta Icone={Image} rotulo="Inserir ou editar imagem" desativado={codigoFonte} aoClicar={abrirImagens} />
              <BotaoFerramenta Icone={Braces} rotulo="Inserir variável do Protocolo" desativado={codigoFonte} aoClicar={() => setDialogoVariavel( true )} />
              <BotaoFerramenta Icone={Link2} rotulo="Inserir ou editar link" desativado={codigoFonte} aoClicar={abrirLink} />
              <BotaoFerramenta Icone={FileText} rotulo="Inserir quebra de página" desativado={codigoFonte} aoClicar={() => executarComHistorico( inserirQuebraPagina )} />
            </div>
            <div className="html-studio-toolbar-spacer" />
            <Tooltip title={codigoFonte ? 'Voltar ao editor visual' : 'Visualizar código fonte'}><button type="button"
              className={`html-studio-source-button ${codigoFonte ? 'active' : ''}`}
              aria-label={codigoFonte ? 'Voltar ao editor visual' : 'Visualizar código fonte'} aria-pressed={codigoFonte}
              onClick={() => { if( !codigoFonte ) capturarEdicao(); setTabelaAtiva( false ); setCodigoFonte( ( atual ) => !atual ); }}>
              <Code2 size={18} />
            </button></Tooltip>
          </div>
          {!codigoFonte && tabelaAtiva && <div className="html-studio-table-tools" role="toolbar" aria-label="Editar tabela selecionada">
            <strong><Table2 size={17} /> Tabela</strong>
            <button type="button" className={tabelaInteira ? 'html-studio-table-selected' : ''} aria-pressed={tabelaInteira}
              onClick={alternarSelecaoTabela}>{tabelaInteira ? 'Tabela inteira selecionada' : 'Selecionar tabela inteira'}</button>
            <button type="button" disabled={quantidadeCelulas < 2} title="Selecione a primeira célula e use Shift + clique na última"
              onClick={() => executarComHistorico( mesclarCelulas )}>Mesclar células</button>
            <button type="button" disabled={!celulaMesclada} onClick={() => executarComHistorico( dividirCelula )}>Dividir célula</button>
            <span className="html-studio-table-hint">Selecione a área com Shift + clique.</span>
            <button type="button" onClick={() => executarComHistorico( () => alterarEstruturaTabela( 'linha-abaixo' ) )}>+ Linha abaixo</button>
            <button type="button" onClick={() => executarComHistorico( () => alterarEstruturaTabela( 'remover-linha' ) )}>− Linha</button>
            <button type="button" onClick={() => executarComHistorico( () => alterarEstruturaTabela( 'coluna-direita' ) )}>+ Coluna à direita</button>
            <button type="button" onClick={() => executarComHistorico( () => alterarEstruturaTabela( 'remover-coluna' ) )}>− Coluna</button>
            <label className="html-studio-table-width">Largura <input type="number" min="10" max="100" value={larguraTabela}
              aria-label="Largura da tabela em porcentagem" onChange={( evento ) => { larguraTabelaEditada.current = true; setLarguraTabela( evento.target.value ); }}
              onBlur={() => { if( larguraTabelaEditada.current ) { larguraTabelaEditada.current = false; executarComHistorico( aplicarLarguraTabela ); } }}
              onKeyDown={( evento ) => { if( evento.key === 'Enter' ) evento.currentTarget.blur(); }} />%</label>
            <label>Estilo CSS <select value={classeTabela} onChange={(evento) => executarComHistorico( () => aplicarClasseTabela( evento.target.value ) )}>
              <option value="">Sem classe</option>
              {classeTabela && !classesCss.includes( classeTabela ) && <option value={classeTabela}>{classeTabela}</option>}
              {classesCss.map( ( classe ) => <option key={classe} value={classe}>{classe}</option> )}
            </select></label>
            <Tooltip title="Cor de fundo da célula selecionada"><label className="html-studio-cell-color">Fundo da célula <input type="color" aria-label="Cor de fundo da célula" value={corCelula} onChange={( evento ) => executarComHistorico( () => colorirCelula( evento.target.value ) )} /></label></Tooltip>
          </div>}
          {avisoTabela && <output className="html-studio-table-warning">{avisoTabela}</output>}
          {avisoFormatacao && <output className="html-studio-table-warning">{avisoFormatacao}</output>}
          <div className="html-studio-canvas"><div className="html-studio-page-label">PÁGINA · ÁREA DE EDIÇÃO</div>
            {codigoFonte ? <textarea className="html-studio-source" aria-label="Código HTML da parte selecionada" value={parteAtual?.html || ''}
              onChange={(evento) => setPartes( ( atual ) => atual.map( ( parte ) => parte.id === selecionada ? { ...parte, html: evento.target.value } : parte ) )} />
              : <iframe ref={iframeEditor} title="Edição visual da parte selecionada" sandbox="allow-same-origin" srcDoc={srcDoc}
                onLoad={() => { celulaTabela.current = null; ancoraCelulas.current = null; grupoCelulas.current = null; blocoAtual.current = null; intervaloEdicao.current = null; setTabelaInteira( false ); setQuantidadeCelulas( 0 ); setCelulaMesclada( false ); prepararEdicaoVisual( iframeEditor.current, selecionarNoDocumento, moverArrasteColuna,
                  () => { encerrarArrasteColuna(); guardarSelecao(); }, guardarSelecao, () => registrarAlteracao( 'digitacao' ), atalhoHistorico ); iniciarHistorico(); }} />}
          </div>
        </main>
      </div> : <main className="html-studio-css-workspace">
        {erroImportacao && <div role="alert" className="html-studio-import-error">{erroImportacao}</div>}
        <div className="html-studio-css-bar"><span><Braces size={17} /> {estiloAtual?.nome}</span><div className="html-studio-css-actions">
          <button type="button" onClick={() => arquivosInput.current?.click()}><FileInput size={16} /> Importar CSS</button>
          <button type="button" onClick={() => mudarAba( 'html' )}><ArrowLeft size={16} /> Voltar ao HTML</button>
        </div></div>
        <textarea className="html-studio-css-editor" aria-label={`Editar ${estiloAtual?.nome || 'CSS'}`} value={estiloAtual?.conteudo || ''}
          onChange={(evento) => atualizarCss( estiloAtual.id, evento.target.value )} spellCheck={false} />
      </main>}
      <Dialog open={dialogoVariavel} onClose={() => setDialogoVariavel( false )} fullWidth maxWidth="sm">
        <div className="html-studio-modal">
          <h2>Inserir variável do Protocolo</h2>
          <input type="search" aria-label="Buscar variável" placeholder="Buscar pelo nome ou código técnico" value={buscaVariavel} onChange={( evento ) => setBuscaVariavel( evento.target.value )} />
          <div className="html-studio-option-list">
            {variaveis.filter( ( item ) => `${item.nome || ''} ${item.codigo || ''}`.toLocaleLowerCase().includes( buscaVariavel.toLocaleLowerCase() ) )
              .map( ( item ) => <button type="button" key={item.id || item.codigo} onClick={() => inserirVariavel( item )}>
                <strong>{item.nome || item.codigo}</strong><code>{'{{'}{item.codigo}{'}}'}</code>
              </button> )}
            {!variaveis.length && <p>Este Protocolo ainda não possui variáveis.</p>}
          </div>
          <div className="html-studio-modal-actions"><button type="button" onClick={() => setDialogoVariavel( false )}>Cancelar</button></div>
        </div>
      </Dialog>
      <Dialog open={dialogoLink} onClose={() => setDialogoLink( false )} fullWidth maxWidth="xs">
        <div className="html-studio-modal">
          <h2>Inserir ou editar link</h2>
          <label>Texto exibido<input value={textoLink} onChange={( evento ) => setTextoLink( evento.target.value )} /></label>
          <label>Endereço<input value={enderecoLink} placeholder="https://exemplo.com" onChange={( evento ) => setEnderecoLink( evento.target.value )} /></label>
          <small>Use HTTPS, mailto: ou uma âncora local.</small>
          <div className="html-studio-modal-actions"><button type="button" onClick={() => setDialogoLink( false )}>Cancelar</button><button type="button" className="primary" onClick={aplicarLink}>Aplicar</button></div>
        </div>
      </Dialog>
      <Dialog open={dialogoImagem} onClose={() => setDialogoImagem( false )} fullWidth maxWidth="sm">
        <div className="html-studio-modal">
          <h2>Inserir ou editar imagem</h2>
          <p>Escolha uma imagem dos Recursos do Protocolo ou da Instituição.</p>
          {carregandoRecursos && <p>Carregando imagens...</p>}
          {erroRecursos && <p role="alert" className="html-studio-modal-error">{erroRecursos}</p>}
          <div className="html-studio-image-list">
            {recursos.map( ( recurso ) => <button type="button" key={`${recurso.origem}-${recurso.idArquivoVersao}`}
              className={recursoEscolhido === recurso.idArquivoVersao ? 'selected' : ''}
              onClick={() => { setRecursoEscolhido( recurso.idArquivoVersao ); setDescricaoImagem( recurso.nome || recurso.codigo ); }}>
              <Box component="img" src={enderecoRecurso( recurso )} alt="" /><strong>{recurso.codigo}</strong><small>{recurso.origem}</small>
            </button> )}
          </div>
          {!carregandoRecursos && !recursos.length && !erroRecursos && <p>Nenhuma imagem foi cadastrada nos Recursos.</p>}
          <div className="html-studio-image-fields">
            <label>Descrição da imagem<input value={descricaoImagem} onChange={( evento ) => setDescricaoImagem( evento.target.value )} /></label>
            <label>Largura em pixels<input type="number" min="32" max="1600" value={larguraImagem} onChange={( evento ) => setLarguraImagem( evento.target.value )} /></label>
          </div>
          <div className="html-studio-modal-actions"><button type="button" onClick={() => setDialogoImagem( false )}>Cancelar</button><button type="button" className="primary" disabled={!recursoEscolhido || carregandoRecursos} onClick={aplicarImagem}>Aplicar</button></div>
        </div>
      </Dialog>
    </div>
  </Dialog>;
}
