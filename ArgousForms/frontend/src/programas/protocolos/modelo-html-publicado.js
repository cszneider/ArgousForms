'use client';

import { useEffect, useState } from 'react';
import { Alert } from '@mui/material';
import DOMPurify from 'dompurify';
import { useI18n } from '../../components/i18n/i18n.js';

const escapar = (valor) => String(valor ?? '').replace(/[&<>"']/g, (caractere) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[caractere]);

export default function ModeloHtmlPublicado({ documento, variaveis }) {
  const { t } = useI18n();
  const [html, setHtml] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    try {
      const limpar = (conteudo) => DOMPurify.sanitize(conteudo || '', {
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'link', 'meta', 'base', 'style'],
        FORBID_ATTR: ['src', 'onerror', 'onclick'],
      }).replace(/\{\{([A-Za-z][A-Za-z0-9_.-]*)\}\}/g, (marcador, codigo) => {
        const exemplo = variaveis.find((item) => item.codigo === codigo)?.definicao?.valorExemplo;
        return escapar(exemplo || marcador);
      });
      const secao = (tipo) => (documento.partes || []).filter((item) => item.tipo === tipo).map((item) => limpar(item.html)).join('');
      const css = (documento.css || '').replace(/@import\b|url\s*\(/gi, '/* recurso externo bloqueado */');
      setHtml(`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';"><style>body{font:16px sans-serif;padding:24px;line-height:1.5}table{border-collapse:collapse;width:100%}td,th{border:1px solid #aaa;padding:6px}${css}</style></head><body><section>${secao('A')}</section><header>${secao('H')}</header><main>${secao('B')}</main><footer>${secao('F')}</footer><section>${secao('X')}</section></body></html>`);
    } catch {
      setErro(t('Não foi possível gerar a prévia do HTML.'));
    }
  }, [documento, variaveis, t]);

  if (erro) return <Alert severity="error">{erro}</Alert>;
  return html ? <iframe title={t('Prévia do modelo HTML')} sandbox="" srcDoc={html} className="protocolo-publicado-pdf" />
    : <p>{t('Carregando prévia...')}</p>;
}
