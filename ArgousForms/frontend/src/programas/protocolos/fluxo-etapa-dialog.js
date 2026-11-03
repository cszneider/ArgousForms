'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Tab, Tabs, TextField } from '@mui/material';
import { useI18n } from '../../components/i18n/i18n.js';
import { createId } from '../../utils/uid.js';

function MiniaturaPdf({ documento }) {
  const { t } = useI18n();
  const canvas = useRef(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    let pdf;
    let tarefa;
    const url = `/ArgousForms/arquivo-conteudo?idArquivo=${encodeURIComponent(documento.idArquivo)}&idArquivoVersao=${encodeURIComponent(documento.idArquivoVersao)}&modo=visualizar`;
    fetch(url, { credentials: 'same-origin' }).then(async (resposta) => {
      if (!resposta.ok) throw new Error(t('Não foi possível abrir o PDF do modelo.'));
      const { openPdf } = await import('../editor/import-model.js');
      return openPdf(await resposta.arrayBuffer());
    }).then(async (arquivo) => {
      pdf = arquivo;
      if (cancelado) return;
      const pagina = await pdf.getPage(1);
      if (cancelado || !canvas.current) return;
      const base = pagina.getViewport({ scale: 1 });
      const vista = pagina.getViewport({ scale: Math.min(1, 220 / base.width) });
      canvas.current.width = Math.ceil(vista.width);
      canvas.current.height = Math.ceil(vista.height);
      tarefa = pagina.render({ canvas: canvas.current, canvasContext: canvas.current.getContext('2d'), viewport: vista });
      await tarefa.promise;
      if (!cancelado) setCarregando(false);
    }).catch((falha) => {
      if (!cancelado && falha?.name !== 'RenderingCancelledException') { setErro(falha.message); setCarregando(false); }
    });
    return () => { cancelado = true; tarefa?.cancel(); pdf?.destroy(); };
  }, [documento.idArquivo, documento.idArquivoVersao, t]);

  return <div className="protocolo-etapa-miniatura">
    {carregando && <span>{t('Carregando prévia do PDF…')}</span>}
    {erro && <Alert severity="warning">{erro}</Alert>}
    <canvas ref={canvas} title={documento.titulo} hidden={!!erro || carregando} />
  </div>;
}

function PreviaFormulario({ formulario, variaveis }) {
  const { t } = useI18n();
  if (!formulario) return <p>{t('Escolha um formulário para ver a prévia.')}</p>;
  return <div className="protocolo-etapa-formulario-previa">
    <strong>{formulario.titulo}</strong>
    {formulario.descricao && <p>{formulario.descricao}</p>}
    {!formulario.campos?.length && <p>{t('Este formulário ainda não possui campos.')}</p>}
    {formulario.campos?.map((campo) => {
      const variavel = variaveis.find((item) => item.id === campo.idVariavel);
      return <TextField key={campo.idVariavel} size="small" fullWidth
        label={variavel?.nome || t('Variável indisponível')}
        value={String(variavel?.definicao?.valorExemplo ?? '')}
        helperText={campo.acesso === 'L' ? t('Somente leitura') : undefined}
        slotProps={{ input: { readOnly: true } }} />;
    })}
  </div>;
}

export default function FluxoEtapaDialog({ etapa, formularios, variaveis, documentos, catalogo, aoSalvar, aoFechar }) {
  const { t } = useI18n();
  const [aba, setAba] = useState(0);
  const [dados, setDados] = useState(() => ({ ...etapa.data,
    destinatarios: etapa.data.destinatarios || [], documentos: etapa.data.documentos || [] }));
  const [regra, setRegra] = useState({ idUsuarioSistema: '', idGrupo: '', cdTagGrupo: '', cdTagUsuario: '', cdTagVinculo: '' });
  const [documentoPrevia, setDocumentoPrevia] = useState(documentos[0]?.idVersao || '');
  const formulario = formularios.find((item) => item.id === dados.formularioId);
  const documento = documentos.find((item) => item.idVersao === documentoPrevia);

  function alterar(campo, valor) { setDados((atual) => ({ ...atual, [campo]: valor })); }

  function alternar(lista, id) {
    alterar(lista, dados[lista].includes(id) ? dados[lista].filter((item) => item !== id) : [...dados[lista], id]);
  }

  function adicionarDestinatario() {
    if (!Object.values(regra).some(Boolean)) return;
    alterar('destinatarios', [...dados.destinatarios, { ...regra, id: createId() }]);
    setRegra({ idUsuarioSistema: '', idGrupo: '', cdTagGrupo: '', cdTagUsuario: '', cdTagVinculo: '' });
  }

  const rotuloRegra = (item) => [
    catalogo.usuarios.find((usuario) => usuario.id === item.idUsuarioSistema)?.nome,
    catalogo.grupos.find((grupo) => grupo.id === Number(item.idGrupo))?.nome,
    item.cdTagGrupo && `${t('Tag de grupo')}: #${item.cdTagGrupo}`,
    item.cdTagUsuario && `${t('Tag de usuário')}: #${item.cdTagUsuario}`,
    item.cdTagVinculo && `${t('Tag de vínculo')}: #${item.cdTagVinculo}`,
  ].filter(Boolean).join(' · ');

  return <Dialog open onClose={aoFechar} fullWidth maxWidth="lg" aria-labelledby="fluxo-etapa-titulo">
    <DialogTitle id="fluxo-etapa-titulo">{t('Configurar etapa')} · {dados.titulo}</DialogTitle>
    <DialogContent className="protocolo-etapa-dialogo">
      <Tabs value={aba} onChange={(_, proxima) => setAba(proxima)} variant="scrollable" scrollButtons="auto" aria-label={t('Configuração da etapa')}>
        {['Geral', 'Destinatários', 'Documentos', 'Scripts'].map((rotulo) => <Tab key={rotulo} label={t(rotulo)} />)}
      </Tabs>
      <div className="protocolo-etapa-dialogo-corpo">
        <div className="protocolo-etapa-dialogo-campos">
          {aba === 0 && <>
            <TextField label={t('Título')} value={dados.titulo} fullWidth inputProps={{ maxLength: 255 }}
              onChange={(evento) => alterar('titulo', evento.target.value)} />
            <TextField label={t('Descrição')} multiline minRows={3} fullWidth value={dados.descricao || ''}
              onChange={(evento) => alterar('descricao', evento.target.value)} />
            <TextField select label={t('Formulário')} value={dados.formularioId || ''} fullWidth
              onChange={(evento) => alterar('formularioId', evento.target.value)}>
              <MenuItem value="">{t('Escolha um formulário')}</MenuItem>
              {formularios.map((item) => <MenuItem key={item.id} value={item.id}>{item.titulo}</MenuItem>)}
            </TextField>
          </>}
          {aba === 1 && <>
            <p>{t('Defina quem poderá assumir esta etapa quando ela ficar disponível.')}</p>
            <div className="protocolo-etapa-destinatario-novo">
              <TextField select label={t('Usuário')} value={regra.idUsuarioSistema}
                onChange={(evento) => setRegra((atual) => ({ ...atual, idUsuarioSistema: evento.target.value }))}>
                <MenuItem value="">{t('Qualquer')}</MenuItem>
                {catalogo.usuarios.map((item) => <MenuItem key={item.id} value={item.id}>{item.nome} · {item.email}</MenuItem>)}
              </TextField>
              <TextField select label={t('Grupo')} value={regra.idGrupo}
                onChange={(evento) => setRegra((atual) => ({ ...atual, idGrupo: evento.target.value }))}>
                <MenuItem value="">{t('Qualquer')}</MenuItem>
                {catalogo.grupos.map((item) => <MenuItem key={item.id} value={item.id}>{item.nome}</MenuItem>)}
              </TextField>
              {[
                ['cdTagGrupo', 'Tag de grupo', 'grupo'],
                ['cdTagUsuario', 'Tag de usuário', 'usuario'],
                ['cdTagVinculo', 'Tag de vínculo', 'vinculo'],
              ].map(([campo, titulo, aplicacao]) => <TextField key={campo} select label={t(titulo)} value={regra[campo]}
                onChange={(evento) => setRegra((atual) => ({ ...atual, [campo]: evento.target.value }))}>
                <MenuItem value="">{t('Qualquer')}</MenuItem>
                {catalogo.tags.filter((item) => item[aplicacao]).map((item) =>
                  <MenuItem key={item.codigo} value={item.codigo}>{item.descricao || item.codigo}</MenuItem>)}
              </TextField>)}
              <Button variant="outlined" onClick={adicionarDestinatario} disabled={!Object.values(regra).some(Boolean)}>{t('Adicionar regra')}</Button>
            </div>
            <div className="protocolo-etapa-chips">
              {dados.destinatarios.map((item) => <Chip key={item.id}
                label={rotuloRegra(item)}
                onDelete={() => alterar('destinatarios', dados.destinatarios.filter((destino) => destino.id !== item.id))} />)}
            </div>
          </>}
          {aba === 2 && <>
            <p>{t('Escolha os modelos gerados automaticamente ao finalizar esta etapa.')}</p>
            {!documentos.length && <p>{t('Este Protocolo ainda não possui modelos de documento.')}</p>}
            {documentos.map((item) => <FormControlLabel key={item.id}
              control={<Checkbox checked={dados.documentos.includes(item.idVersao)} onChange={() => alternar('documentos', item.idVersao)} />}
              label={item.titulo} onMouseEnter={() => setDocumentoPrevia(item.idVersao)} onFocus={() => setDocumentoPrevia(item.idVersao)} />)}
          </>}
          {aba === 3 && <>
            <TextField label={t('Script de inicialização')} multiline minRows={8} fullWidth
              value={dados.scriptInicializacao || ''} onChange={(evento) => alterar('scriptInicializacao', evento.target.value)}
              slotProps={{ input: { sx: { fontFamily: 'monospace' } } }} />
            <TextField label={t('Script de finalização')} multiline minRows={8} fullWidth
              value={dados.scriptFinalizacao || ''} onChange={(evento) => alterar('scriptFinalizacao', evento.target.value)}
              slotProps={{ input: { sx: { fontFamily: 'monospace' } } }} />
          </>}
        </div>
        <aside className="protocolo-etapa-dialogo-previa">
          {aba === 0 && <><h3>{t('Prévia do formulário')}</h3><PreviaFormulario formulario={formulario} variaveis={variaveis} /></>}
          {aba === 2 && <><h3>{t('Prévia do documento')}</h3>
            {documento ? <><strong>{documento.titulo}</strong><MiniaturaPdf key={documento.id} documento={documento} /></>
              : <p>{t('Escolha um modelo para ver a prévia.')}</p>}</>}
          {aba !== 0 && aba !== 2 && <p>{t('As alterações serão gravadas quando você salvar o fluxo.')}</p>}
        </aside>
      </div>
    </DialogContent>
    <DialogActions>
      <Button onClick={aoFechar}>{t('Cancelar')}</Button>
      <Button variant="contained" disabled={!dados.titulo.trim()} onClick={() => aoSalvar(dados)}>{t('Aplicar à etapa')}</Button>
    </DialogActions>
  </Dialog>;
}
