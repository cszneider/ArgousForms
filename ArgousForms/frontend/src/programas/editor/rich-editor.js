'use client';
import { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Node, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import { Button, MenuItem, TextField, Alert } from '@mui/material';
import { useI18n } from '../../components/i18n/i18n.js';
import { cleanHtml } from './content.js';
const FieldToken = Node.create({
  name: 'fieldToken',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return {
      fieldId: { default: '', parseHTML: (el) => el.dataset.fieldId },
      label: { default: '', parseHTML: (el) => el.dataset.label },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-field-id]' }];
  },
  renderHTML({ node }) {
    return [
      'span',
      mergeAttributes({
        'data-field-id': node.attrs.fieldId,
        'data-label': node.attrs.label,
      }),
      `⟦${node.attrs.label}⟧`,
    ];
  },
});
export function RichEditor({
  value = '',
  onChange,
  fields = [],
  label,
  disabled = false,
}) {
  const { t } = useI18n();
  const [error, setError] = useState('');
  const [, refresh] = useState(0);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: false }),
      Image.configure({ allowBase64: true }),
      TableKit.configure({ table: { resizable: false } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      FieldToken,
    ],
    content: cleanHtml(value),
    editable: !disabled,
    editorProps: {
      transformPastedHTML: cleanHtml,
      attributes: {
        'aria-label': label || t('Conteúdo'),
        role: 'textbox',
        'aria-multiline': 'true',
      },
    },
    onUpdate: ({ editor }) => onChange(cleanHtml(editor.getHTML())),
    onSelectionUpdate: () => refresh((n) => n + 1),
  });
  useEffect(() => {
    if (editor && editor.getHTML() !== cleanHtml(value))
      editor.commands.setContent(cleanHtml(value), { emitUpdate: false });
  }, [value, editor]);
  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);
  const run = (action) => {
    action(editor.chain().focus()).run();
    refresh((n) => n + 1);
  };
  async function image(file) {
    if (!file) return;
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > 400 * 1024
    ) {
      setError(t('Use uma imagem PNG, JPEG ou WebP de até 400 KB.'));
      return;
    }
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    editor.chain().focus().setImage({ src: data, alt: file.name }).run();
  }
  if (!editor) return <p>{t('Carregando…')}</p>;
  return (
    <div className="rich-editor">
      {label && <strong className="rich-label">{label}</strong>}
      {!disabled && (
        <div
          className="rich-toolbar no-print"
          role="toolbar"
          aria-label={t('Formatação')}
        >
          {[
            ['Negrito', 'bold', (c) => c.toggleBold()],
            ['Itálico', 'italic', (c) => c.toggleItalic()],
            ['Sublinhado', 'underline', (c) => c.toggleUnderline()],
            ['Título', 'heading', (c) => c.toggleHeading({ level: 2 })],
            ['Lista', 'bulletList', (c) => c.toggleBulletList()],
            ['Lista numerada', 'orderedList', (c) => c.toggleOrderedList()],
          ].map(([text, type, action]) => (
            <Button
              key={type}
              size="small"
              aria-pressed={editor.isActive(type)}
              variant={editor.isActive(type) ? 'contained' : 'text'}
              onClick={() => run(action)}
            >
              {t(text)}
            </Button>
          ))}
          {['left', 'center', 'right', 'justify'].map((align, i) => (
            <Button
              key={align}
              size="small"
              onClick={() => run((c) => c.setTextAlign(align))}
            >
              {t(['Esquerda', 'Centro', 'Direita', 'Justificar'][i])}
            </Button>
          ))}
          <Button
            size="small"
            onClick={() =>
              run((c) =>
                c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }),
              )
            }
          >
            {t('Tabela')}
          </Button>
          {editor.isActive('table') && (
            <>
              <Button size="small" onClick={() => run((c) => c.addRowAfter())}>
                {t('Adicionar linha')}
              </Button>
              <Button
                size="small"
                onClick={() => run((c) => c.addColumnAfter())}
              >
                {t('Adicionar coluna')}
              </Button>
              <Button size="small" onClick={() => run((c) => c.deleteTable())}>
                {t('Remover tabela')}
              </Button>
            </>
          )}
          <Button component="label" size="small">
            {t('Imagem')}
            <input
              hidden
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                void image(e.target.files?.[0]).catch(() =>
                  setError(
                    t('Não foi possível ler o arquivo. Tente novamente.'),
                  ),
                );
                e.target.value = '';
              }}
            />
          </Button>
          <Button
            size="small"
            onClick={() => run((c) => c.undo())}
            disabled={!editor.can().undo()}
          >
            {t('Desfazer')}
          </Button>
          <Button
            size="small"
            onClick={() => run((c) => c.redo())}
            disabled={!editor.can().redo()}
          >
            {t('Refazer')}
          </Button>
          {!!fields.length && (
            <TextField
              select
              size="medium"
              label={t('Inserir campo')}
              value=""
              sx={{ width: 180 }}
              onChange={(e) => {
                const f = fields.find((f) => f.id === e.target.value);
                editor
                  .chain()
                  .focus()
                  .insertContent({
                    type: 'fieldToken',
                    attrs: { fieldId: f.id, label: f.label },
                  })
                  .run();
              }}
            >
              {fields.map((f) => (
                <MenuItem key={f.id} value={f.id}>
                  {f.label}
                </MenuItem>
              ))}
            </TextField>
          )}
        </div>
      )}
      {error && (
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
