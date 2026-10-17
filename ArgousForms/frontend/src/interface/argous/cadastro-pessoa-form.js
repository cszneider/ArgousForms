'use client';

import { useEffect, useState } from 'react';
import { Alert, Box, Button, Checkbox, FormControlLabel, MenuItem, TextField, Typography } from '@mui/material';
import { executar } from '../../programas/login/autenticacao.js';
import { identificacaoCorresponde } from '../../programas/pessoas/regex-identificacao.js';

const vazio = () => ({
  idPessoa: null, idUsuario: null, nome: '', nomeSocial: '', email: '', telefone: '', nascimento: '', sexo: '',
  nacionalidades: [], identificacoes: [], perfis: [], divergenciasRevisadas: false,
});

export default function CadastroPessoaForm({ modo, idPessoa, idUsuario, onSaved, onCancel }) {
  const [catalogo, setCatalogo] = useState(null);
  const [dados, setDados] = useState(vazio);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [buscaPais, setBuscaPais] = useState('');
  const [buscaNumero, setBuscaNumero] = useState('');
  const [emailPendente, setEmailPendente] = useState('');
  const [codigoEmail, setCodigoEmail] = useState('');

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      try {
        const [opcoes, registro] = await Promise.all([
          executar('CATALOGO_CADASTRAL'),
          idPessoa || idUsuario || modo === 'proprio'
            ? executar('CONSULTAR_CADASTRO', { idPessoa, idUsuario })
            : Promise.resolve(null),
        ]);
        if (!ativo) return;
        setCatalogo(opcoes);
        const participante = opcoes.perfis.find((perfil) => perfil.codigo === 'PARTICIPANTE')?.idPerfil;
        setDados(registro ? {
          ...vazio(), ...registro, nascimento: registro.nascimento?.slice(0, 10) || '',
          nomeSocial: registro.nomeSocial || '', telefone: registro.telefone || '', sexo: registro.sexo || '',
          email: registro.email || '', divergenciasRevisadas: false,
          perfis: modo === 'usuario' && !idUsuario ? participante ? [participante] : [] : registro.perfis,
        } : { ...vazio(), perfis: modo === 'usuario' && participante ? [participante] : [] });
      } catch (falha) {
        if (ativo) setErro(falha.message);
      } finally {
        if (ativo) setLoading(false);
      }
    }
    carregar();
    return () => { ativo = false; };
  }, [idPessoa, idUsuario, modo]);

  const alterar = (campo, valor) => setDados((anterior) => ({ ...anterior, [campo]: valor }));
  const tiposPais = (pais) => catalogo?.tipos.filter((tipo) => tipo.idPais === Number(pais)) || [];

  async function localizar() {
    setErro('');
    setAviso('');
    try {
      const encontrada = await executar('LOCALIZAR_PESSOA', { idPais: Number(buscaPais), numero: buscaNumero.trim() });
      if (!encontrada.encontrada) return setAviso('Nenhuma Pessoa encontrada com esta identificação.');
      if (encontrada.contaAtiva) return setErro('Esta Pessoa já possui uma conta ativa. Abra o usuário na lista.');
      const registro = await executar('CONSULTAR_CADASTRO', { idPessoa: encontrada.idPessoa });
      const participante = catalogo.perfis.find((perfil) => perfil.codigo === 'PARTICIPANTE')?.idPerfil;
      setDados({ ...vazio(), ...registro, nascimento: registro.nascimento?.slice(0, 10) || '',
        nomeSocial: registro.nomeSocial || '', telefone: registro.telefone || '', sexo: registro.sexo || '',
        email: registro.email || '', divergenciasRevisadas: false, perfis: participante ? [participante] : [] });
      setAviso('Pessoa existente carregada. Confira todos os dados antes de vinculá-la ao usuário.');
    } catch (falha) {
      setErro(falha.message);
    }
  }

  async function salvar(event) {
    event.preventDefault();
    setErro('');
    setAviso('');
    if (modo !== 'pessoa' && !dados.email.trim()) return setErro('Informe o e-mail.');
    if (dados.idPessoa && !idUsuario && modo === 'usuario' && !dados.divergenciasRevisadas)
      return setErro('Confira os dados da Pessoa existente e marque a revisão.');
    for (const item of dados.identificacoes) {
      const tipo = catalogo.tipos.find((registro) => registro.idTipo === Number(item.idTipo));
      if (!tipo || !identificacaoCorresponde(tipo.regex, item.numero.trim()))
        return setErro('Uma identificação não corresponde ao formato definido para seu tipo.');
    }
    setSaving(true);
    try {
      const operacao = modo === 'pessoa' ? 'SALVAR_PESSOA' : modo === 'proprio' ? 'SALVAR_MEUS_DADOS' : 'SALVAR_USUARIO';
      const resultado = await executar(operacao, { ...dados, nome: dados.nome.trim(), email: dados.email.trim(),
        identificacoes: dados.identificacoes.map((item) => ({ ...item, idPais: Number(item.idPais), idTipo: Number(item.idTipo), numero: item.numero.trim() })) });
      if (modo === 'proprio' && resultado.confirmacaoPendente) setEmailPendente(dados.email.trim());
      onSaved?.(resultado);
      if (resultado.confirmacaoPendente) setAviso(resultado.emailEnviado
        ? 'Um código foi enviado ao novo e-mail. A mudança só será concluída depois da confirmação.'
        : 'O cadastro foi salvo, mas o envio do código não foi confirmado.');
      else setAviso('Cadastro salvo.');
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Typography>Carregando cadastro…</Typography>;
  if (!catalogo) return <Alert severity="error">{erro || 'Não foi possível carregar o cadastro.'}</Alert>;

  return <Box component="form" onSubmit={salvar} sx={{ display: 'grid', gap: 2, pt: 1 }}>
    {erro && <Alert severity="error">{erro}</Alert>}
    {aviso && <Alert severity="info">{aviso}</Alert>}
    {modo === 'usuario' && !dados.idUsuario && !dados.idPessoa && <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      <TextField select label="País da identificação" value={buscaPais} onChange={(e) => setBuscaPais(e.target.value)} sx={{ minWidth: 200 }}>
        {catalogo.paises.map((pais) => <MenuItem key={pais.idPais} value={pais.idPais}>{pais.nome}</MenuItem>)}
      </TextField>
      <TextField label="Identificação sem formatação" value={buscaNumero} onChange={(e) => setBuscaNumero(e.target.value)} />
      <Button type="button" onClick={localizar} disabled={!buscaPais || !buscaNumero.trim()}>Localizar Pessoa existente</Button>
    </Box>}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
      <TextField label="Nome completo" required value={dados.nome} onChange={(e) => alterar('nome', e.target.value)} />
      <TextField label="Nome social" value={dados.nomeSocial} onChange={(e) => alterar('nomeSocial', e.target.value)} />
      <TextField label="E-mail" type="email" required={modo !== 'pessoa'} value={dados.email} onChange={(e) => alterar('email', e.target.value)} />
      <TextField label="Telefone" type="tel" value={dados.telefone} onChange={(e) => alterar('telefone', e.target.value)} />
      <TextField label="Nascimento" type="date" value={dados.nascimento} onChange={(e) => alterar('nascimento', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      <TextField select label="Sexo" value={dados.sexo} onChange={(e) => alterar('sexo', e.target.value)}>
        <MenuItem value="">Não informado</MenuItem><MenuItem value="F">Feminino</MenuItem>
        <MenuItem value="M">Masculino</MenuItem><MenuItem value="O">Outro</MenuItem>
        <MenuItem value="P">Prefiro não informar</MenuItem>
      </TextField>
    </Box>
    <TextField select label="Nacionalidades" value={dados.nacionalidades} onChange={(e) => alterar('nacionalidades',
      (Array.isArray(e.target.value) ? e.target.value : e.target.value.split(',')).map(Number))}
      slotProps={{ select: { multiple: true } }} helperText="Você pode selecionar mais de um país.">
      {catalogo.paises.map((pais) => <MenuItem key={pais.idPais} value={pais.idPais}>{pais.nome}</MenuItem>)}
    </TextField>
    <Typography variant="subtitle1">Identificações por país</Typography>
    {dados.identificacoes.map((item, indice) => <Box key={indice} sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      <TextField select label="País" value={item.idPais} onChange={(e) => alterar('identificacoes', dados.identificacoes.map((atual, posicao) => posicao === indice ? { idPais: Number(e.target.value), idTipo: '', numero: '' } : atual))} sx={{ minWidth: 180 }}>
        {catalogo.paises.map((pais) => <MenuItem key={pais.idPais} value={pais.idPais}>{pais.nome}</MenuItem>)}
      </TextField>
      <TextField select label="Tipo" value={item.idTipo} onChange={(e) => alterar('identificacoes', dados.identificacoes.map((atual, posicao) => posicao === indice ? { ...atual, idTipo: Number(e.target.value) } : atual))} sx={{ minWidth: 180 }}>
        {tiposPais(item.idPais).map((tipo) => <MenuItem key={tipo.idTipo} value={tipo.idTipo}>{tipo.nome}</MenuItem>)}
      </TextField>
      <TextField label="Número sem formatação" value={item.numero} onChange={(e) => alterar('identificacoes', dados.identificacoes.map((atual, posicao) => posicao === indice ? { ...atual, numero: e.target.value } : atual))} />
      <Button type="button" onClick={() => alterar('identificacoes', dados.identificacoes.filter((_, posicao) => posicao !== indice))}>Remover</Button>
    </Box>)}
    <Button type="button" onClick={() => alterar('identificacoes', [...dados.identificacoes, { idPais: '', idTipo: '', numero: '' }])}>Adicionar identificação</Button>
    {modo === 'usuario' && <>
      <Typography variant="subtitle1">Perfis do usuário</Typography>
      {catalogo.perfis.map((perfil) => <FormControlLabel key={perfil.idPerfil}
        control={<Checkbox checked={perfil.codigo === 'ESSENCIAL' || dados.perfis.includes(perfil.idPerfil)}
          disabled={perfil.codigo === 'ESSENCIAL' || dados.contaExcluida && perfil.codigo !== 'PARTICIPANTE'} onChange={(e) => alterar('perfis', e.target.checked
            ? [...dados.perfis, perfil.idPerfil] : dados.perfis.filter((id) => id !== perfil.idPerfil))} />}
        label={perfil.nome} />)}
      {!dados.idUsuario && <Typography variant="body2" color="text.secondary">ESSENCIAL e PARTICIPANTE serão atribuídos por padrão. A pessoa receberá um convite para definir a senha.</Typography>}
      {dados.contaExcluida && <Alert severity="info">Esta conta será reativada com ESSENCIAL e PARTICIPANTE. Outros perfis podem ser atribuídos após a confirmação do convite.</Alert>}
      {dados.idPessoa && !idUsuario && <FormControlLabel control={<Checkbox checked={dados.divergenciasRevisadas}
        onChange={(e) => alterar('divergenciasRevisadas', e.target.checked)} />} label="Revisei os dados da Pessoa existente e autorizo as alterações exibidas" />}
    </>}
    {modo === 'proprio' && <Typography variant="body2" color="text.secondary">Se alterar o e-mail, a mudança dependerá do código enviado ao novo endereço.</Typography>}
    {modo === 'proprio' && <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      <TextField label="Novo e-mail a confirmar" type="email" value={emailPendente} onChange={(e) => setEmailPendente(e.target.value)} />
      <TextField label="Código recebido no novo e-mail" value={codigoEmail} onChange={(e) => setCodigoEmail(e.target.value)} />
      <Button type="button" disabled={!emailPendente || !codigoEmail} onClick={async () => {
        setErro('');
        try {
          await executar('CONFIRMAR_TROCA_EMAIL', { email: emailPendente, codigo: codigoEmail });
          setEmailPendente('');
          setCodigoEmail('');
          setAviso('Novo e-mail confirmado.');
        } catch (falha) { setErro(falha.message); }
      }}>Confirmar novo e-mail</Button>
    </Box>}
    <Box sx={{ display: 'flex', gap: 1 }}>
      <Button type="submit" variant="contained" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
      {onCancel && <Button type="button" onClick={onCancel} disabled={saving}>Fechar</Button>}
    </Box>
  </Box>;
}
