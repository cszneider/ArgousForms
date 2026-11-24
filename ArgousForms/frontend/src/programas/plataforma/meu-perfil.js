'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Avatar, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, MenuItem, Stack, TextField, Typography, Checkbox } from '@mui/material';
import { Camera, LockKeyhole, Pencil, Trash2 } from 'lucide-react';
import { executar } from '../login/autenticacao.js';
import { identificacaoCorresponde } from '../pessoas/regex-identificacao.js';

const fotoUrl = '/ArgousForms/foto-pessoa';
const iniciais = (nome) => (nome || '').trim().split(/\s+/).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase();

export default function MeuPerfil({ usuario }) {
  const [dados, setDados] = useState(null);
  const [catalogo, setCatalogo] = useState(null);
  const [organizacao, setOrganizacao] = useState({ grupos: [] });
  const [edicao, setEdicao] = useState(null);
  const [rascunho, setRascunho] = useState(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [fotoVersao, setFotoVersao] = useState(0);
  const [fotoFalhou, setFotoFalhou] = useState(false);
  const [emailPendente, setEmailPendente] = useState('');
  const [codigoEmail, setCodigoEmail] = useState('');
  const [celularPendente, setCelularPendente] = useState('');
  const [codigoCelular, setCodigoCelular] = useState('');
  const arquivoRef = useRef(null);

  const carregar = useCallback(async () => {
    try {
      const [perfil, opcoes, contexto] = await Promise.all([
        executar('CONSULTAR_CADASTRO'), executar('CATALOGO_CADASTRAL'), executar('MEU_CONTEXTO_ORGANIZACAO'),
      ]);
      setDados(perfil);
      setCatalogo(opcoes);
      setOrganizacao(contexto);
      setFotoFalhou(false);
    } catch (falha) { setErro(falha.message); }
  }, []);

  useEffect(() => { queueMicrotask(carregar); }, [carregar]);

  function abrir(secao) {
    setErro('');
    setEdicao(secao);
    setRascunho({ ...dados, nacionalidades: [...(dados.nacionalidades || [])], identificacoes: (dados.identificacoes || []).map((item) => ({ ...item })) });
  }

  function alterar(chave, valor) { setRascunho((anterior) => ({ ...anterior, [chave]: valor })); }

  async function salvar() {
    setErro('');
    setSalvando(true);
    try {
      if (edicao === 'documentos') {
        for (const item of rascunho.identificacoes) {
          const tipo = catalogo.tipos.find((opcao) => opcao.idTipo === Number(item.idTipo));
          if (!tipo || !identificacaoCorresponde(tipo.regex, item.numero?.trim() || '')) throw Error('Uma identificação não corresponde ao formato exigido.');
        }
      }
      await executar(edicao === 'sobre' ? 'ATUALIZAR_MEUS_DADOS_PESSOAIS' : 'ATUALIZAR_MEUS_DOCUMENTOS', rascunho);
      await carregar();
      window.dispatchEvent(new Event('perfil-atualizado'));
      setEdicao(null);
      setAviso('Dados atualizados.');
    } catch (falha) { setErro(falha.message); }
    finally { setSalvando(false); }
  }

  async function enviarFoto(arquivo) {
    if (!arquivo) return;
    setErro('');
    if (!['image/jpeg', 'image/png'].includes(arquivo.type)) return setErro('Escolha uma foto JPEG ou PNG.');
    if (arquivo.size > 5 * 1024 * 1024) return setErro('A foto deve ter até 5 MB.');
    const corpo = new FormData();
    corpo.append('foto', arquivo);
    setSalvando(true);
    try {
      const resposta = await fetch(fotoUrl, { method: 'POST', body: corpo, credentials: 'same-origin' });
      const resultado = await resposta.json();
      if (!resposta.ok || resultado.status !== 'ok') throw Error(resultado.mensagem || 'Não foi possível enviar a foto.');
      setFotoVersao(Date.now());
      setFotoFalhou(false);
      window.dispatchEvent(new Event('foto-perfil-alterada'));
      setAviso('Foto atualizada.');
      await carregar();
    } catch (falha) { setErro(falha.message); }
    finally { setSalvando(false); if (arquivoRef.current) arquivoRef.current.value = ''; }
  }

  async function removerFoto() {
    setSalvando(true);
    setErro('');
    try {
      const resposta = await fetch(fotoUrl, { method: 'DELETE', credentials: 'same-origin' });
      const resultado = await resposta.json();
      if (!resposta.ok || resultado.status !== 'ok') throw Error(resultado.mensagem || 'Não foi possível remover a foto.');
      setFotoFalhou(true);
      window.dispatchEvent(new Event('foto-perfil-alterada'));
      await carregar();
      setFotoFalhou(true);
      setAviso('Foto removida.');
    } catch (falha) { setErro(falha.message); }
    finally { setSalvando(false); }
  }

  async function solicitarEmail() {
    setErro('');
    setSalvando(true);
    try {
      const resultado = await executar('SOLICITAR_TROCA_MEU_EMAIL', { email: emailPendente });
      setAviso(resultado.emailEnviado ? 'Código enviado ao novo e-mail. A troca ainda não foi concluída.' : 'A solicitação foi registrada, mas o envio do código não foi confirmado.');
    } catch (falha) { setErro(falha.message); }
    finally { setSalvando(false); }
  }

  async function confirmarEmail() {
    setErro('');
    setSalvando(true);
    try {
      await executar('CONFIRMAR_TROCA_EMAIL', { email: emailPendente, codigo: codigoEmail });
      setEmailPendente('');
      setCodigoEmail('');
      await carregar();
      setAviso('E-mail confirmado.');
    } catch (falha) { setErro(falha.message); }
    finally { setSalvando(false); }
  }

  async function solicitarCelular() {
    setErro('');
    setSalvando(true);
    try {
      const resultado = await executar('SOLICITAR_TROCA_MEU_CELULAR', { celular: celularPendente });
      setAviso(resultado.emailEnviado ? 'Código enviado ao e-mail atual. O celular ainda não foi alterado.' : 'A solicitação foi registrada, mas o envio do código não foi confirmado.');
    } catch (falha) { setErro(falha.message); }
    finally { setSalvando(false); }
  }

  async function confirmarCelular() {
    setErro('');
    setSalvando(true);
    try {
      await executar('CONFIRMAR_TROCA_MEU_CELULAR', { celular: celularPendente, codigo: codigoCelular });
      setCelularPendente('');
      setCodigoCelular('');
      await carregar();
      setAviso('Celular confirmado.');
    } catch (falha) { setErro(falha.message); }
    finally { setSalvando(false); }
  }

  if (!dados || !catalogo) return <Box sx={{ p: 3 }}>{erro ? <Alert severity="error">{erro}</Alert> : <Typography>Carregando perfil…</Typography>}</Box>;
  const nome = dados.nomeSocial || dados.nome;
  return <Box sx={{ display: 'grid', gap: 2, maxWidth: 1120 }}>
    {erro && <Alert severity="error" onClose={() => setErro('')}>{erro}</Alert>}
    {aviso && <Alert severity="success" onClose={() => setAviso('')}>{aviso}</Alert>}
    <Stack direction={{ xs: 'column', sm: 'row' }} gap={3} alignItems={{ xs: 'flex-start', sm: 'center' }}>
      <Box sx={{ position: 'relative' }}><Avatar src={fotoFalhou ? undefined : `${fotoUrl}?v=${fotoVersao}`} onError={() => setFotoFalhou(true)} sx={{ width: 112, height: 112, fontSize: 38 }}>{iniciais(nome)}</Avatar>
        <IconButton aria-label="Trocar foto" title="Trocar foto" onClick={() => arquivoRef.current?.click()} sx={{ position: 'absolute', right: -5, bottom: -5, bgcolor: 'background.paper', boxShadow: 2 }}><Camera size={20} /></IconButton>
        <input ref={arquivoRef} type="file" accept="image/jpeg,image/png" hidden onChange={(evento) => enviarFoto(evento.target.files?.[0])} /></Box>
      <Box sx={{ flex: 1 }}><Typography variant="overline">MEU PERFIL</Typography><Typography variant="h4" component="h1">{nome}</Typography><Typography color="text.secondary">{dados.email}</Typography></Box>
      {dados.idFoto && <Button color="error" startIcon={<Trash2 size={17} />} disabled={salvando} onClick={removerFoto}>Remover foto</Button>}
    </Stack>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
      <Card variant="outlined"><CardContent><Stack direction="row" justifyContent="space-between"><Typography variant="h6">Sobre você</Typography><Button startIcon={<Pencil size={16} />} onClick={() => abrir('sobre')}>Editar</Button></Stack>
        <Typography>Nome completo: {dados.nome}</Typography><Typography>Nome social: {dados.nomeSocial || 'Não informado'}</Typography>
        <Typography>Nascimento: {dados.nascimento ? new Date(`${dados.nascimento.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : 'Não informado'}</Typography>
        <Typography>Sexo: {({ F: 'Feminino', M: 'Masculino', O: 'Outro', P: 'Prefiro não informar' })[dados.sexo] || 'Não informado'}</Typography>
        <Typography>Nacionalidades: {dados.nacionalidades.map((id) => catalogo.paises.find((pais) => pais.idPais === id)?.nome).filter(Boolean).join(', ') || 'Não informadas'}</Typography></CardContent></Card>
      <Card variant="outlined"><CardContent><Stack direction="row" justifyContent="space-between"><Typography variant="h6">Documentos de identificação</Typography><Button startIcon={<Pencil size={16} />} onClick={() => abrir('documentos')}>Editar</Button></Stack>
        {dados.identificacoes.length ? dados.identificacoes.map((item) => <Typography key={`${item.idPais}-${item.idTipo}`}>{catalogo.tipos.find((tipo) => tipo.idTipo === item.idTipo)?.nome || 'Documento'}: {item.numero}</Typography>) : <Typography color="text.secondary">Nenhum documento cadastrado.</Typography>}</CardContent></Card>
      <Card variant="outlined"><CardContent><Typography variant="h6">Contato</Typography>
        <Stack direction="row" gap={1} alignItems="center"><Typography>E-mail: {dados.email}</Typography>{dados.emailInstitucional && <Chip size="small" icon={<LockKeyhole size={14} />} label="Institucional" />}</Stack>
        {!dados.emailInstitucional && <><TextField fullWidth size="small" type="email" label="Novo e-mail" value={emailPendente} onChange={(evento) => setEmailPendente(evento.target.value)} sx={{ mt: 2 }} /><Button disabled={!emailPendente || salvando} onClick={solicitarEmail}>Enviar código</Button>{emailPendente && <Stack direction="row" gap={1} sx={{ mt: 1 }}><TextField size="small" label="Código recebido" value={codigoEmail} onChange={(evento) => setCodigoEmail(evento.target.value)} /><Button disabled={!codigoEmail || salvando} onClick={confirmarEmail}>Confirmar</Button></Stack>}</>}
        {dados.emailInstitucional && <Typography variant="body2" color="text.secondary">Gerenciado pela empresa. Para trocar, fale com o administrador.</Typography>}
        <Typography sx={{ mt: 2 }}>Celular: {dados.celular || 'Não informado'}</Typography>{dados.celularInstitucional && <Typography variant="body2" color="text.secondary">Celular gerenciado pela empresa. Para trocar, fale com o administrador.</Typography>}
        {!dados.celularInstitucional && <><TextField fullWidth size="small" type="tel" label="Novo celular" value={celularPendente} onChange={(evento) => setCelularPendente(evento.target.value)} sx={{ mt: 2 }} /><Button disabled={!celularPendente || salvando} onClick={solicitarCelular}>Enviar código ao e-mail atual</Button>{celularPendente && <Stack direction="row" gap={1} sx={{ mt: 1 }}><TextField size="small" label="Código recebido" value={codigoCelular} onChange={(evento) => setCodigoCelular(evento.target.value)} /><Button disabled={!codigoCelular || salvando} onClick={confirmarCelular}>Confirmar</Button></Stack>}</>}
      </CardContent></Card>
      <Card variant="outlined"><CardContent><Typography variant="h6">Na empresa</Typography>
        <Typography color="text.secondary" variant="body2">Mantido pelo administrador</Typography>
        <Typography sx={{ mt: 1 }}>Lotação: {organizacao.grupos.filter((grupo) => grupo.lotacao).map((grupo) => grupo.nome).join(', ') || 'Não informada'}</Typography>
        <Typography>Gestor(es): {organizacao.grupos.filter((grupo) => grupo.lotacao).flatMap((grupo) => grupo.gestores || []).join(', ') || 'Não informado'}</Typography>
        <Typography>Vínculos: {organizacao.grupos.map((grupo) => grupo.nome).join(', ') || 'Nenhum'}</Typography>
        <Typography>Perfis: {usuario?.perfis?.join(', ') || 'Não informados'}</Typography></CardContent></Card>
    </Box>
    <Dialog open={edicao === 'sobre'} onClose={() => setEdicao(null)} fullWidth maxWidth="sm"><DialogTitle>Sobre você</DialogTitle><DialogContent sx={{ display: 'grid', gap: 2, pt: '16px !important' }}>
      <TextField label="Nome completo" required value={rascunho?.nome || ''} onChange={(evento) => alterar('nome', evento.target.value)} />
      <TextField label="Nome social" value={rascunho?.nomeSocial || ''} onChange={(evento) => alterar('nomeSocial', evento.target.value)} />
      <TextField type="date" label="Nascimento" value={rascunho?.nascimento?.slice(0, 10) || ''} onChange={(evento) => alterar('nascimento', evento.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      <TextField select label="Sexo" value={rascunho?.sexo || ''} onChange={(evento) => alterar('sexo', evento.target.value)}><MenuItem value="">Não informado</MenuItem><MenuItem value="F">Feminino</MenuItem><MenuItem value="M">Masculino</MenuItem><MenuItem value="O">Outro</MenuItem><MenuItem value="P">Prefiro não informar</MenuItem></TextField>
      <Typography fontWeight={700}>Nacionalidades</Typography>{catalogo.paises.map((pais) => <FormControlLabel key={pais.idPais} control={<Checkbox checked={rascunho?.nacionalidades.includes(pais.idPais) || false} onChange={(evento) => alterar('nacionalidades', evento.target.checked ? [...rascunho.nacionalidades, pais.idPais] : rascunho.nacionalidades.filter((id) => id !== pais.idPais))} />} label={pais.nome} />)}
    </DialogContent><DialogActions><Button onClick={() => setEdicao(null)}>Cancelar</Button><Button variant="contained" disabled={salvando} onClick={salvar}>Salvar</Button></DialogActions></Dialog>
    <Dialog open={edicao === 'documentos'} onClose={() => setEdicao(null)} fullWidth maxWidth="md"><DialogTitle>Documentos de identificação</DialogTitle><DialogContent sx={{ display: 'grid', gap: 2, pt: '16px !important' }}>
      {(rascunho?.identificacoes || []).map((item, indice) => <Stack key={indice} direction={{ xs: 'column', sm: 'row' }} gap={1}>
        <TextField select label="País" value={item.idPais} onChange={(evento) => alterar('identificacoes', rascunho.identificacoes.map((atual, posicao) => posicao === indice ? { idPais: Number(evento.target.value), idTipo: '', numero: '' } : atual))} sx={{ minWidth: 150 }}>{catalogo.paises.map((pais) => <MenuItem key={pais.idPais} value={pais.idPais}>{pais.nome}</MenuItem>)}</TextField>
        <TextField select label="Tipo" value={item.idTipo} onChange={(evento) => alterar('identificacoes', rascunho.identificacoes.map((atual, posicao) => posicao === indice ? { ...atual, idTipo: Number(evento.target.value) } : atual))} sx={{ minWidth: 150 }}>{catalogo.tipos.filter((tipo) => tipo.idPais === Number(item.idPais)).map((tipo) => <MenuItem key={tipo.idTipo} value={tipo.idTipo}>{tipo.nome}</MenuItem>)}</TextField>
        <TextField label="Número" value={item.numero} onChange={(evento) => alterar('identificacoes', rascunho.identificacoes.map((atual, posicao) => posicao === indice ? { ...atual, numero: evento.target.value } : atual))} />
        <Button onClick={() => alterar('identificacoes', rascunho.identificacoes.filter((_, posicao) => posicao !== indice))}>Remover</Button>
      </Stack>)}
      <Button startIcon={<Pencil size={16} />} onClick={() => alterar('identificacoes', [...rascunho.identificacoes, { idPais: '', idTipo: '', numero: '' }])}>Adicionar documento</Button>
    </DialogContent><DialogActions><Button onClick={() => setEdicao(null)}>Cancelar</Button><Button variant="contained" disabled={salvando} onClick={salvar}>Salvar</Button></DialogActions></Dialog>
  </Box>;
}
