'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Chip, CircularProgress, MenuItem, TextField } from '@mui/material';
import { useI18n } from '../../components/i18n/i18n.js';
import { executar } from '../login/autenticacao.js';

const regraVazia = { idUsuarioSistema: '', idGrupo: '', cdTagGrupo: '', cdTagUsuario: '', cdTagVinculo: '' };

export default function GestoresElegiveis({ regrasIniciais, salvando, aoSalvar }) {
  const { t } = useI18n();
  const [catalogo, setCatalogo] = useState({ usuarios: [], grupos: [], tags: [] });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [regra, setRegra] = useState(regraVazia);
  const [regras, setRegras] = useState(regrasIniciais || []);

  useEffect(() => {
    let cancelado = false;
    executar('CATALOGO_DESTINATARIOS_PROTOCOLO').then((dados) => {
      if (!cancelado) setCatalogo(dados);
    }).catch((falha) => { if (!cancelado) setErro(falha.message); })
      .finally(() => { if (!cancelado) setCarregando(false); });
    return () => { cancelado = true; };
  }, []);

  function adicionar() {
    if (!Object.values(regra).some(Boolean)) return;
    setRegras((atual) => [...atual, { ...regra }]);
    setRegra(regraVazia);
  }

  function rotulo(item) {
    return [
      catalogo.usuarios.find((usuario) => usuario.id === item.idUsuarioSistema)?.nome,
      catalogo.grupos.find((grupo) => grupo.id === Number(item.idGrupo))?.nome,
      item.cdTagGrupo && `${t('Tag de grupo')}: #${item.cdTagGrupo}`,
      item.cdTagUsuario && `${t('Tag de usuário')}: #${item.cdTagUsuario}`,
      item.cdTagVinculo && `${t('Tag de vínculo')}: #${item.cdTagVinculo}`,
    ].filter(Boolean).join(' · ');
  }

  return <>
    <div className="protocolos-section-title"><div><h2>{t('Gestores elegíveis')}</h2>
      <p>{t('Defina quem poderá gerir os Processos iniciados por este Protocolo. Uma regra pode combinar usuário, grupo e tags.')}</p></div></div>
    {erro && <Alert severity="error" sx={{ mb: 2 }}>{erro}</Alert>}
    {carregando ? <CircularProgress /> : <>
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
        <Button variant="outlined" onClick={adicionar} disabled={!Object.values(regra).some(Boolean)}>{t('Adicionar regra')}</Button>
      </div>
      <div className="protocolo-etapa-chips" style={{ marginTop: 16 }}>
        {regras.map((item, indice) => <Chip key={indice} label={rotulo(item)}
          onDelete={() => setRegras((atual) => atual.filter((_, posicao) => posicao !== indice))} />)}
      </div>
      {!regras.length && <Alert severity="warning" sx={{ mt: 2 }}>{t('Ao menos uma regra será necessária para publicar o Protocolo.')}</Alert>}
      <Button variant="contained" sx={{ mt: 3 }} disabled={salvando} onClick={() => aoSalvar(regras)}>{t('Salvar gestores elegíveis')}</Button>
    </>}
  </>;
}
