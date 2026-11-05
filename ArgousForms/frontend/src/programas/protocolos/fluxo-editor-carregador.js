'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '../../components/i18n/i18n.js';

export default function FluxoEditorCarregador(props) {
  const { t } = useI18n();
  const [Editor, setEditor] = useState(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let ativo = true;
    import('./fluxo-editor.js').then((modulo) => {
      if (ativo) setEditor(() => modulo.default);
    }).catch(() => { if (ativo) setErro(true); });
    return () => { ativo = false; };
  }, []);

  if (erro) return <div className="protocolos-fluxo-carregando">{t('Não foi possível abrir o editor visual.')}</div>;
  return Editor ? <Editor {...props} /> : <div className="protocolos-fluxo-carregando">{t('Carregando editor visual…')}</div>;
}
