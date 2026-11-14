'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, TextField, Tooltip } from '@mui/material';
import { AlignCenter, AlignLeft, AlignRight, AlignJustify, ArrowDown, ArrowUp, Bold, Eye, Heading2, Image, Italic, Link, List, ListOrdered, Plus, Redo2, Table2, Trash2, Underline, Undo2 } from 'lucide-react';
import { Mark, mergeAttributes } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import DOMPurify from 'dompurify';
import { useI18n } from '../../components/i18n/i18n.js';

const TIPOS = { A: 'Apresentação', H: 'Cabeçalho', B: 'Corpo', F: 'Rodapé', X: 'Encerramento' };
const ORDEM = ['A', 'H', 'B', 'F', 'X'];
const novaParte = (tipo) => ({ id: `${Date.now()}-${Math.random()}`, tipo, html: '<p></p>' });
const escapar = (valor) => String(valor ?? '').replace(/[&<>"']/g, (caractere) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[caractere]);
const FONTES = [
  ['Arial', 'Arial, sans-serif'],
  ['Georgia', 'Georgia, serif'],
  ['Times New Roman', 'Times New Roman, serif'],
  ['Verdana', 'Verdana, sans-serif'],
  ['Courier New', 'Courier New, monospace'],
];
const FontFamilyMark = Mark.create({
  name: 'fontFamily',
  addAttributes() {
    return { family: { default: null, parseHTML: (elemento) =>
      FONTES.find(([, valor]) => valor.toLowerCase() === elemento.style.fontFamily.replace(/["']/g, '').toLowerCase())?.[1] || null,
      renderHTML: ({ family }) => family && FONTES.some(([, valor]) => valor === family) ? { style: `font-family: ${family}` } : {} } };
  },
  parseHTML() { return [{ tag: 'span[style*="font-family"]' }]; },
  renderHTML({ HTMLAttributes }) { return ['span', mergeAttributes(HTMLAttributes), 0]; },
});

function EditorParte({ html, aoAlterar, variaveis }) {
  const { t } = useI18n();
  const [modoFonte, setModoFonte] = useState(false);
  const [sugestao, setSugestao] = useState(null);
  const [opcaoAtiva, setOpcaoAtiva] = useState(0);
  const [linkAberto, setLinkAberto] = useState(false);
  const [urlLink, setUrlLink] = useState('');
  const [, atualizarBarra] = useState(0);
  const caixaEditor = useRef(null);
  const listaSugestoes = useRef(null);
  const editor = useEditor({
    extensions: [StarterKit, TableKit.configure({ table: { resizable: false } }),
      TextAlign.configure({ types: ['paragraph', 'heading'] }), FontFamilyMark],
    content: html,
    immediatelyRender: false,
    editorProps: { attributes: { 'aria-label': t('Conteúdo do documento HTML') } },
    onUpdate: ({ editor: atual }) => {
      aoAlterar(atual.getHTML());
      atualizarSugestao(atual);
    },
    onSelectionUpdate: ({ editor: atual }) => { atualizarBarra((valor) => valor + 1); atualizarSugestao(atual); },
  });

  function atualizarSugestao(atual) {
    const { $from, empty } = atual.state.selection;
    if (!empty || !caixaEditor.current) { setSugestao(null); return; }
    const antes = $from.parent.textBetween(0, $from.parentOffset);
    const encontrado = antes.match(/\{\{([A-Za-z0-9_.-]*)$/);
    if (!encontrado) { setSugestao(null); return; }
    const posicao = atual.view.coordsAtPos($from.pos);
    const caixa = caixaEditor.current.getBoundingClientRect();
    setOpcaoAtiva(0);
    setSugestao({ termo: encontrado[1], inicio: $from.pos - encontrado[0].length,
      fim: $from.pos, esquerda: posicao.left - caixa.left, topo: posicao.bottom - caixa.top });
  }

  const opcoes = sugestao ? variaveis.filter((item) =>
    item.codigo?.toLocaleLowerCase().includes(sugestao.termo.toLocaleLowerCase()) ||
    item.nome?.toLocaleLowerCase().includes(sugestao.termo.toLocaleLowerCase())) : [];

  useEffect(() => {
    listaSugestoes.current?.querySelectorAll('button')[opcaoAtiva]?.scrollIntoView({ block: 'nearest' });
  }, [opcaoAtiva, sugestao?.termo]);

  function escolherVariavel(item) {
    if (!editor || !sugestao) return;
    editor.chain().focus().insertContentAt({ from: sugestao.inicio, to: sugestao.fim }, `{{${item.codigo}}}`).run();
    setSugestao(null);
  }

  function teclaEditor(evento) {
    if (!sugestao) return;
    if (evento.key === 'Escape') { evento.preventDefault(); evento.stopPropagation(); setSugestao(null); return; }
    if (!opcoes.length) return;
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault();
      evento.stopPropagation();
      setOpcaoAtiva((atual) => (atual + (evento.key === 'ArrowDown' ? 1 : -1) + opcoes.length) % opcoes.length);
    } else if (evento.key === 'Enter') {
      evento.preventDefault();
      evento.stopPropagation();
      escolherVariavel(opcoes[Math.min(opcaoAtiva, opcoes.length - 1)]);
    }
  }

  function aplicarLink() {
    const url = urlLink.trim();
    if (!url) editor?.chain().focus().unsetLink().run();
    else if (/^(https?:\/\/|mailto:)/i.test(url)) editor?.chain().focus().setLink({ href: url }).run();
    else return;
    setLinkAberto(false);
  }

  const comandos = [
    ['Negrito', Bold, () => editor?.chain().focus().toggleBold().run(), editor?.isActive('bold')],
    ['Itálico', Italic, () => editor?.chain().focus().toggleItalic().run(), editor?.isActive('italic')],
    ['Sublinhado', Underline, () => editor?.chain().focus().toggleUnderline().run(), editor?.isActive('underline')],
    ['Título', Heading2, () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), editor?.isActive('heading', { level: 2 })],
    ['Lista', List, () => editor?.chain().focus().toggleBulletList().run(), editor?.isActive('bulletList')],
    ['Lista numerada', ListOrdered, () => editor?.chain().focus().toggleOrderedList().run(), editor?.isActive('orderedList')],
  ];

  return <div className="modelo-html-edicao">
    <div className="modelo-html-ferramentas" role="toolbar" aria-label={t('Formatação')}>
      <label className="modelo-html-fonte">
        <span>{t('Fonte')}</span>
        <select disabled={modoFonte || !editor} value={editor?.getAttributes('fontFamily').family || ''}
          onChange={(evento) => {
            if (evento.target.value) editor?.chain().focus().setMark('fontFamily', { family: evento.target.value }).run();
            else editor?.chain().focus().unsetMark('fontFamily').run();
          }}>
          <option value="">{t('Padrão')}</option>
          {FONTES.map(([nome, valor]) => <option key={nome} value={valor}>{nome}</option>)}
        </select>
      </label>
      {comandos.map(([rotulo, Icone, acao, ativo]) => <Tooltip key={rotulo} title={t(rotulo)}><span>
        <IconButton size="small" disabled={modoFonte || !editor} aria-label={t(rotulo)} aria-pressed={!!ativo} onClick={acao}>
          <Icone size={18} />
        </IconButton>
      </span></Tooltip>)}
      {[
        ['Esquerda', AlignLeft, 'left'], ['Centro', AlignCenter, 'center'],
        ['Direita', AlignRight, 'right'], ['Justificar', AlignJustify, 'justify'],
      ].map(([rotulo, Icone, alinhamento]) => <Tooltip key={rotulo} title={t(rotulo)}><span>
        <IconButton size="small" disabled={modoFonte || !editor} aria-label={t(rotulo)}
          aria-pressed={editor?.isActive({ textAlign: alinhamento }) || false}
          onClick={() => editor?.chain().focus().setTextAlign(alinhamento).run()}><Icone size={18} /></IconButton>
      </span></Tooltip>)}
      <Tooltip title={t('Inserir tabela')}><span><IconButton size="small" disabled={modoFonte || !editor}
        aria-label={t('Inserir tabela')} onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
        <Table2 size={18} /></IconButton></span></Tooltip>
      {editor?.isActive('table') && <>
        <Button size="small" disabled={modoFonte} onClick={() => editor.chain().focus().addRowAfter().run()}>{t('Adicionar linha')}</Button>
        <Button size="small" disabled={modoFonte} onClick={() => editor.chain().focus().addColumnAfter().run()}>{t('Adicionar coluna')}</Button>
        <Button size="small" disabled={modoFonte} onClick={() => editor.chain().focus().deleteTable().run()}>{t('Remover tabela')}</Button>
      </>}
      <Tooltip title={t('Inserir link')}><span><IconButton size="small" disabled={modoFonte || !editor}
        aria-label={t('Inserir link')} onClick={() => {
          setUrlLink(editor?.getAttributes('link').href || '');
          setLinkAberto(true);
        }}><Link size={18} /></IconButton></span></Tooltip>
      <Tooltip title={t('Imagens estarão disponíveis após o vínculo com o gestor de documentos.')}><span>
        <IconButton size="small" disabled aria-label={t('Inserir imagem')}><Image size={18} /></IconButton>
      </span></Tooltip>
      <Tooltip title={t('Desfazer')}><span><IconButton size="small" disabled={modoFonte || !editor?.can().undo()}
        aria-label={t('Desfazer')} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={18} /></IconButton></span></Tooltip>
      <Tooltip title={t('Refazer')}><span><IconButton size="small" disabled={modoFonte || !editor?.can().redo()}
        aria-label={t('Refazer')} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={18} /></IconButton></span></Tooltip>
      <Button size="small" onClick={() => {
        if (modoFonte) editor?.commands.setContent(html);
        setModoFonte(!modoFonte);
      }}>{t(modoFonte ? 'Editor visual' : 'Editar HTML')}</Button>
    </div>
    {modoFonte ? <TextField multiline minRows={12} fullWidth value={html} onChange={(evento) => aoAlterar(evento.target.value)}
      label={t('Código HTML')} /> : <div ref={caixaEditor} className="modelo-html-editor-area" onKeyDownCapture={teclaEditor}>
      <EditorContent editor={editor} className="modelo-html-visual" />
      {sugestao && <div ref={listaSugestoes} className="modelo-html-sugestoes" aria-live="polite"
        style={{ left: sugestao.esquerda, top: sugestao.topo }}>
        {opcoes.length ? opcoes.map((item, indice) => <button type="button" aria-current={indice === opcaoAtiva}
          key={item.id} className={indice === opcaoAtiva ? 'ativa' : ''}
          onMouseDown={(evento) => evento.preventDefault()} onClick={() => escolherVariavel(item)}>
          <strong>{item.nome}</strong><small>{'{{'}{item.codigo}{'}}'}</small>
        </button>) : <p>{t('Nenhuma variável encontrada.')}</p>}
      </div>}
    </div>}
    <Dialog open={linkAberto} onClose={() => setLinkAberto(false)} fullWidth maxWidth="xs">
      <DialogTitle>{t('Inserir link')}</DialogTitle>
      <DialogContent><TextField label={t('Endereço do link')} fullWidth value={urlLink}
        onChange={(evento) => setUrlLink(evento.target.value)} helperText={t('Use https://, http:// ou mailto:.')} /></DialogContent>
      <DialogActions><Button onClick={() => setLinkAberto(false)}>{t('Cancelar')}</Button>
        <Button onClick={aplicarLink} disabled={!!urlLink.trim() && !/^(https?:\/\/|mailto:)/i.test(urlLink.trim())}>{t('Aplicar')}</Button>
      </DialogActions>
    </Dialog>
  </div>;
}

export default function ModeloHtmlEditor({ modelo, variaveis, salvando, aoFechar, aoSalvar }) {
  const { t } = useI18n();
  const [dados, setDados] = useState(() => ({
    ...modelo, css: modelo.css || '',
    partes: modelo.partes?.length ? modelo.partes.map((parte) => ({ ...parte, id: `${Date.now()}-${Math.random()}` })) : [novaParte('B')],
  }));
  const [selecionada, setSelecionada] = useState(0);
  const [previa, setPrevia] = useState(false);
  const [htmlPrevia, setHtmlPrevia] = useState('');
  const [erro, setErro] = useState('');
  const parte = dados.partes[selecionada];

  function alterarParte(id, html) {
    setDados((atual) => ({ ...atual, partes: atual.partes.map((item) => item.id === id ? { ...item, html } : item) }));
  }

  function adicionar(tipo) {
    const parteNova = novaParte(tipo);
    const partes = [...dados.partes, parteNova].sort((a, b) => ORDEM.indexOf(a.tipo) - ORDEM.indexOf(b.tipo));
    setDados({ ...dados, partes });
    setSelecionada(partes.findIndex((item) => item.id === parteNova.id));
  }

  function remover(indice) {
    if (dados.partes[indice].tipo === 'B' && dados.partes.filter((item) => item.tipo === 'B').length === 1) return;
    setDados((atual) => ({ ...atual, partes: atual.partes.filter((_, posicao) => posicao !== indice) }));
    setSelecionada(Math.max(0, Math.min(selecionada, dados.partes.length - 2)));
  }

  function mover(indice, deslocamento) {
    const destino = indice + deslocamento;
    if (destino < 0 || destino >= dados.partes.length || dados.partes[indice].tipo !== dados.partes[destino].tipo) return;
    setDados((atual) => {
      const partes = [...atual.partes];
      [partes[indice], partes[destino]] = [partes[destino], partes[indice]];
      return { ...atual, partes };
    });
    setSelecionada(destino);
  }

  useEffect(() => {
    if (!previa) return;
    try {
      const limpar = (html) => DOMPurify.sanitize(html, {
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'link', 'meta', 'base', 'style'],
        FORBID_ATTR: ['src', 'onerror', 'onclick'],
      }).replace(/\{\{([A-Za-z][A-Za-z0-9_.-]*)\}\}/g, (marcador, codigo) => {
        const exemplo = variaveis.find((item) => item.codigo === codigo)?.definicao?.valorExemplo;
        return escapar(exemplo || marcador);
      });
      const corpo = dados.partes.filter((item) => item.tipo === 'B').map((item) => limpar(item.html)).join('');
      const secao = (tipo) => dados.partes.filter((item) => item.tipo === tipo).map((item) => limpar(item.html)).join('');
      const css = dados.css.replace(/@import\b|url\s*\(/gi, '/* recurso externo bloqueado */');
      const documento = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';"><style>body{font:16px sans-serif;padding:24px;line-height:1.5}table{border-collapse:collapse;width:100%}td,th{border:1px solid #aaa;padding:6px}${css}</style></head><body>` +
        `<section>${secao('A')}</section><header>${secao('H')}</header><main>${corpo}</main><footer>${secao('F')}</footer><section>${secao('X')}</section></body></html>`;
      setHtmlPrevia(documento);
    } catch {
      setErro(t('Não foi possível gerar a prévia do HTML.'));
    }
  }, [previa, dados, t, variaveis]);

  async function salvar() {
    if (!dados.codigo?.trim() || !dados.titulo?.trim() || !dados.partes.some((item) => item.tipo === 'B' && item.html.trim())) {
      setErro(t('Informe código, título e ao menos uma parte de corpo.'));
      return;
    }
    setErro('');
    try {
      await aoSalvar({ ...dados, partes: dados.partes.map(({ tipo, html }) => ({ tipo, html })) });
    } catch (falha) {
      setErro(falha.message);
    }
  }

  return <Dialog open onClose={() => !salvando && aoFechar()} fullWidth maxWidth="xl">
    <DialogTitle>{t(dados.id ? 'Editar modelo HTML' : 'Novo modelo HTML')}</DialogTitle>
    <DialogContent>
      {erro && <Alert severity="error" sx={{ mb: 2 }}>{erro}</Alert>}
      <div className="modelo-html-dados">
        <TextField label={t('Código técnico')} required value={dados.codigo || ''} disabled={!!dados.id || salvando}
          onChange={(evento) => setDados({ ...dados, codigo: evento.target.value })} inputProps={{ maxLength: 30 }} />
        <TextField label={t('Título')} required value={dados.titulo || ''} disabled={salvando || modelo.versao > 1}
          onChange={(evento) => setDados({ ...dados, titulo: evento.target.value })} inputProps={{ maxLength: 70 }} />
        <TextField label={t('Observações (opcional)')} value={dados.observacoes || ''} disabled={salvando || modelo.versao > 1}
          onChange={(evento) => setDados({ ...dados, observacoes: evento.target.value })} />
        <TextField label={t('Prazo de validade em dias (opcional)')} type="number"
          value={dados.diasVencimento ?? ''} disabled={salvando} inputProps={{ min: 1, max: 32767, step: 1 }}
          onChange={(evento) => setDados({ ...dados, diasVencimento: evento.target.value })}
          helperText={t('Sem prazo, o documento não vence.')} />
      </div>
      <div className="modelo-html-partes">
        <aside>
          {dados.partes.map((item, indice) => <div className={`modelo-html-parte${indice === selecionada ? ' selecionada' : ''}`} key={item.id}>
            <button type="button" onClick={() => { setPrevia(false); setSelecionada(indice); }}>
              {t(TIPOS[item.tipo])}{item.tipo === 'B' && ` ${dados.partes.slice(0, indice + 1).filter((valor) => valor.tipo === 'B').length}`}
            </button>
            <Button size="small" disabled={salvando || indice === 0 || dados.partes[indice - 1].tipo !== item.tipo}
              aria-label={t('Mover para cima')} onClick={() => mover(indice, -1)}><ArrowUp size={15} /></Button>
            <Button size="small" disabled={salvando || indice === dados.partes.length - 1 || dados.partes[indice + 1].tipo !== item.tipo}
              aria-label={t('Mover para baixo')} onClick={() => mover(indice, 1)}><ArrowDown size={15} /></Button>
            <Button size="small" disabled={salvando || item.tipo === 'B' && dados.partes.filter((valor) => valor.tipo === 'B').length === 1}
              aria-label={t('Remover parte')} onClick={() => remover(indice)}><Trash2 size={15} /></Button>
          </div>)}
          <Button size="small" startIcon={<Plus size={15} />} onClick={() => adicionar('B')}>{t('Adicionar parte do corpo')}</Button>
          {['A', 'H', 'F', 'X'].filter((tipo) => !dados.partes.some((item) => item.tipo === tipo)).map((tipo) =>
            <Button key={tipo} size="small" onClick={() => adicionar(tipo)}>{t(`Adicionar ${TIPOS[tipo]}`)}</Button>)}
        </aside>
        <section>
          <div className="modelo-html-abas">
            <Button variant={!previa ? 'contained' : 'text'} onClick={() => setPrevia(false)}>{t('Editar')}</Button>
            <Button variant={previa ? 'contained' : 'text'} startIcon={<Eye size={16} />} onClick={() => setPrevia(true)}>{t('Pré-visualizar')}</Button>
          </div>
          {previa ? <iframe title={t('Prévia do modelo HTML')} sandbox="" srcDoc={htmlPrevia} className="modelo-html-preview" /> : <>
            <p>{t(TIPOS[parte.tipo])}</p>
            <EditorParte key={parte.id} html={parte.html} aoAlterar={(html) => alterarParte(parte.id, html)} variaveis={variaveis} />
            <TextField label={t('CSS do documento (opcional)')} multiline minRows={5} fullWidth value={dados.css}
              onChange={(evento) => setDados({ ...dados, css: evento.target.value })} sx={{ mt: 2 }} />
          </>}
        </section>
      </div>
    </DialogContent>
    <DialogActions>
      <Button disabled={salvando} onClick={aoFechar}>{t('Cancelar')}</Button>
      <Button variant="contained" disabled={salvando} onClick={salvar}>{t('Salvar modelo HTML')}</Button>
    </DialogActions>
  </Dialog>;
}
