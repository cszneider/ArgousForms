'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, Drawer, FormControlLabel, IconButton, MenuItem, Paper, Stack, Switch, Tab,
  Tabs, TextField, Tooltip, Typography,
} from '@mui/material';
import { ArrowRight, ChevronRight, LockKeyhole, Plus, Search, Users, ZoomIn, ZoomOut } from 'lucide-react';
import { executar } from '../login/autenticacao.js';
import CadastroPessoaForm from '../../interface/argous/cadastro-pessoa-form.js';

const nomeTag = (tags, codigo) => tags.find((tag) => tag.codigo === codigo)?.nomeExibicao || codigo;
const departamento = (grupo) => grupo.ativo && grupo.tags?.includes('departamento');
const situacoes = ['todos', 'ativo', 'convidado', 'inativo'];
const nomeExibido = (registro) => registro.nomeSocial || registro.nome;

export default function OrganizacaoAcessos({ podeOrganizar, podeAdministrar, abrirConfiguracoes }) {
  const [aba, setAba] = useState(podeOrganizar ? 'organograma' : 'usuarios');
  const [organizacao, setOrganizacao] = useState({ grupos: [], tags: [], vinculos: [], tagsVinculo: [], tagsUsuario: [], usuarios: [] });
  const [pendencias, setPendencias] = useState([]);
  const [cadastro, setCadastro] = useState({ pessoas: [], usuarios: [] });
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState('todos');
  const [grupoEditado, setGrupoEditado] = useState(null);
  const [novoVinculoUsuario, setNovoVinculoUsuario] = useState('');
  const [novaTagVinculo, setNovaTagVinculo] = useState('gestor');
  const [tagEditada, setTagEditada] = useState(null);
  const [cadastroEditado, setCadastroEditado] = useState(null);
  const [pendenciasAbertas, setPendenciasAbertas] = useState(false);
  const [mostrarUsuarios, setMostrarUsuarios] = useState(false);
  const [zoom, setZoom] = useState(100);

  const carregar = useCallback(async () => {
    setErro('');
    setCarregando(true);
    try {
      const [grupos, vinculos, pessoas, avisos] = await Promise.all([
        podeOrganizar ? executar('LISTAR_ORGANIZACAO') : Promise.resolve({ grupos: [], tags: [] }),
        podeOrganizar ? executar('LISTAR_VINCULOS_ORGANIZACAO') : Promise.resolve({ vinculos: [], tagsVinculo: [], tagsUsuario: [], usuarios: [] }),
        podeAdministrar ? executar('LISTAR_PESSOAS_USUARIOS') : Promise.resolve({ pessoas: [], usuarios: [] }),
        podeOrganizar ? executar('LISTAR_PENDENCIAS_ORGANIZACAO') : Promise.resolve({ pendencias: [] }),
      ]);
      setOrganizacao({ ...grupos, ...vinculos });
      setCadastro(pessoas);
      setPendencias(avisos.pendencias || []);
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setCarregando(false);
    }
  }, [podeOrganizar, podeAdministrar]);

  useEffect(() => { queueMicrotask(carregar); }, [carregar]);

  const departamentos = organizacao.grupos.filter(departamento);
  const outrosGrupos = organizacao.grupos.filter((grupo) => grupo.ativo && !departamento(grupo));
  const gruposFiltrados = organizacao.grupos.filter((grupo) => `${grupo.nome} ${(organizacao.vinculos || []).filter((vinculo) => vinculo.idGrupo === grupo.idGrupo && vinculo.ativo).map((vinculo) => organizacao.usuarios.find((usuario) => usuario.idUsuario === vinculo.idUsuario)?.nome).join(' ')}`.toLocaleLowerCase('pt-BR').includes(busca.toLocaleLowerCase('pt-BR')));
  const raizes = departamentos.filter((grupo) => !departamentos.some((pai) => pai.idGrupo === grupo.idGrupoSuperior));
  const contagens = useMemo(() => Object.fromEntries(situacoes.map((status) => [status, status === 'todos' ? cadastro.usuarios.length : cadastro.usuarios.filter((usuario) => usuario.situacao === status).length])), [cadastro.usuarios]);

  async function executarAcao(operacao, dados, mensagem) {
    setSalvando(true);
    setErro('');
    try {
      await executar(operacao, dados);
      await carregar();
      setAviso(mensagem);
      return true;
    } catch (falha) {
      setErro(falha.message);
      return false;
    } finally {
      setSalvando(false);
    }
  }

  function editarGrupo(grupo) {
    setNovoVinculoUsuario('');
    setNovaTagVinculo('gestor');
    setGrupoEditado(grupo ? { ...grupo, tags: [...(grupo.tags || [])] } : { idGrupo: null, idGrupoSuperior: null, nome: '', ativo: true, tags: ['departamento'] });
  }

  async function salvarGrupo() {
    if (!grupoEditado?.nome.trim()) return setErro('Informe o nome do grupo.');
    if (!grupoEditado.tags.includes('departamento') && grupoEditado.idGrupoSuperior) return setErro('Somente departamentos podem ter superior.');
    const ok = await executarAcao('SALVAR_GRUPO', { ...grupoEditado, nome: grupoEditado.nome.trim(), idGrupoSuperior: grupoEditado.idGrupoSuperior || null }, 'Grupo salvo.');
    if (ok) setGrupoEditado(null);
  }

  async function mudarSuperior(grupo, pai) {
    if (grupo.idGrupo === pai.idGrupo || !window.confirm(`${grupo.nome} passará a responder a ${pai.nome}. Confirmar?`)) return;
    await executarAcao('SALVAR_GRUPO', { ...grupo, idGrupoSuperior: pai.idGrupo, tags: grupo.tags || [] }, 'Superior alterado.');
  }

  async function salvarTag() {
    if (!tagEditada) return;
    const operacao = tagEditada.nova ? 'CRIAR_TAG' : 'ALTERAR_TAG';
    const ok = await executarAcao(operacao, {
      codigo: tagEditada.codigo, descricao: tagEditada.descricao || '', nomeExibicao: tagEditada.nomeExibicao || '',
      restrita: Boolean(tagEditada.restrita), grupo: Boolean(tagEditada.grupo), usuario: Boolean(tagEditada.usuario),
      vinculo: Boolean(tagEditada.vinculo), ativa: Boolean(tagEditada.ativo),
    }, 'Tag salva.');
    if (ok) setTagEditada(null);
  }

  function grupoCaixa(grupo, profundidade = 0, visitados = new Set()) {
    if (visitados.has(grupo.idGrupo)) return null;
    const seguintes = new Set(visitados);
    seguintes.add(grupo.idGrupo);
    const gestores = organizacao.tagsVinculo.filter((tag) => tag.idGrupo === grupo.idGrupo && tag.codigo === 'gestor' && tag.ativo)
      .map((tag) => organizacao.usuarios.find((usuario) => usuario.idUsuario === tag.idUsuario)?.nome).filter(Boolean);
    const lotados = organizacao.tagsVinculo.filter((tag) => tag.idGrupo === grupo.idGrupo && tag.codigo === 'lotacao' && tag.ativo).length;
    return <Box key={grupo.idGrupo} sx={{ ml: profundidade ? 4 : 0, borderLeft: profundidade ? '2px solid' : 0, borderColor: 'divider', pl: profundidade ? 2 : 0, mt: 2 }}>
      <Paper component="button" type="button" aria-label={`Abrir ${grupo.nome}`}
        draggable onDragStart={(evento) => evento.dataTransfer.setData('text/plain', String(grupo.idGrupo))}
        onDragOver={(evento) => evento.preventDefault()} onDrop={(evento) => {
          evento.preventDefault();
          const origem = organizacao.grupos.find((item) => item.idGrupo === Number(evento.dataTransfer.getData('text/plain')));
          if (origem) mudarSuperior(origem, grupo);
        }}
        onClick={() => editarGrupo(grupo)}
        sx={{ p: 2, cursor: 'pointer', border: '1px solid', borderColor: gestores.length ? 'divider' : 'error.main', borderStyle: gestores.length ? 'solid' : 'dashed', maxWidth: 420, '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.main' } }}>
        <Typography fontWeight={700}>{grupo.nome}</Typography>
        <Typography variant="body2" color={gestores.length ? 'text.secondary' : 'error.main'}>{gestores.length ? `${nomeTag(organizacao.tags, 'gestor')}: ${gestores.join(', ')}` : 'Sem gestor'}</Typography>
        <Typography variant="caption">{lotados} lotado{lotados === 1 ? '' : 's'}</Typography>
      </Paper>
      {departamentos.filter((item) => item.idGrupoSuperior === grupo.idGrupo).map((filho) => grupoCaixa(filho, profundidade + 1, seguintes))}
    </Box>;
  }

  return <Box sx={{ display: 'grid', gap: 2 }}>
    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={2}>
      <Box><Typography variant="overline">ADMINISTRAÇÃO DA INSTITUIÇÃO</Typography><Typography variant="h4" component="h1">Organização e acessos</Typography>
        <Typography color="text.secondary">Equipes, pessoas e permissões em um só lugar.</Typography></Box>
      <Stack direction="row" gap={1} flexWrap="wrap">
        {podeOrganizar && <Button color={pendencias.length ? 'error' : 'inherit'} variant="outlined" onClick={() => setPendenciasAbertas(true)}>{pendencias.length} pendência{pendencias.length === 1 ? '' : 's'} de cadastro</Button>}
        {abrirConfiguracoes && <Button variant="text" onClick={abrirConfiguracoes}>Papéis e instituição <ArrowRight size={16} /></Button>}
      </Stack>
    </Stack>
    {erro && <Alert severity="error" onClose={() => setErro('')}>{erro}</Alert>}
    {aviso && <Alert severity="success" onClose={() => setAviso('')}>{aviso}</Alert>}
    {carregando && <Typography>Carregando organização…</Typography>}
    <Tabs value={aba} onChange={(_, valor) => { setAba(valor); setBusca(''); }} variant="scrollable" scrollButtons="auto" aria-label="Organização e acessos">
      {podeOrganizar && <Tab value="organograma" label="Organograma" />}
      {podeAdministrar && <Tab value="usuarios" label="Usuários" />}
      {podeAdministrar && <Tab value="pessoas" label="Pessoas" />}
      {podeOrganizar && <Tab value="tags" label="Tags" />}
    </Tabs>
    {aba === 'organograma' && podeOrganizar && <>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems="center">
        <TextField size="small" label="Buscar grupo ou pessoa" value={busca} onChange={(evento) => setBusca(evento.target.value)} InputProps={{ startAdornment: <Search size={17} /> }} />
        <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => editarGrupo(null)}>Novo grupo</Button>
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Reduzir"><IconButton aria-label="Reduzir" onClick={() => setZoom(Math.max(70, zoom - 10))}><ZoomOut /></IconButton></Tooltip>
        <Typography variant="body2">{zoom}%</Typography>
        <Tooltip title="Ampliar"><IconButton aria-label="Ampliar" onClick={() => setZoom(Math.min(130, zoom + 10))}><ZoomIn /></IconButton></Tooltip>
        <Button onClick={() => setZoom(100)}>Centralizar</Button>
      </Stack>
      <Paper variant="outlined" sx={{ p: 3, overflow: 'auto', minHeight: 320 }}><Box sx={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}>
        {raizes.filter((grupo) => gruposFiltrados.includes(grupo) || !busca).map((grupo) => grupoCaixa(grupo))}
        {!raizes.length && <Alert severity="info">Ainda não há departamentos ativos.</Alert>}
      </Box></Paper>
      <Typography variant="h6">Grupos fora da hierarquia</Typography>
      <Stack direction="row" flexWrap="wrap" gap={1}>{outrosGrupos.filter((grupo) => gruposFiltrados.includes(grupo) || !busca).map((grupo) => <Button key={grupo.idGrupo} variant="outlined" onClick={() => editarGrupo(grupo)}>{grupo.nome}</Button>)}</Stack>
    </>}
    {aba === 'usuarios' && podeAdministrar && <>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
        <TextField size="small" label="Buscar nome ou e-mail" value={busca} onChange={(evento) => setBusca(evento.target.value)} />
        <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setCadastroEditado({ modo: 'usuario' })}>Convidar colaborador</Button>
      </Stack>
      <Stack direction="row" gap={1} flexWrap="wrap">{situacoes.map((status) => <Chip key={status} clickable color={situacao === status ? 'primary' : 'default'} label={`${status === 'todos' ? 'Todos' : status[0].toUpperCase() + status.slice(1)} ${contagens[status]}`} onClick={() => setSituacao(status)} />)}</Stack>
      <Stack gap={1}>{cadastro.usuarios.filter((item) => (situacao === 'todos' || item.situacao === situacao) && `${item.nome} ${item.email}`.toLocaleLowerCase('pt-BR').includes(busca.toLocaleLowerCase('pt-BR'))).map((item) => <Paper key={item.idUsuario} variant="outlined" sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Avatar>{item.nome?.slice(0, 1)}</Avatar><Box sx={{ flex: 1, minWidth: 180 }}><Typography fontWeight={700}>{item.nome}</Typography><Typography variant="body2" color="text.secondary">{item.emailInstitucional && <LockKeyhole size={13} aria-label="E-mail institucional" />} {item.email}</Typography></Box>
        <Chip size="small" label={item.situacao} color={item.situacao === 'ativo' ? 'success' : 'default'} />
        {organizacao.tagsVinculo.filter((tag) => tag.idUsuario === item.idUsuario && tag.codigo === 'lotacao' && tag.ativo).map((tag) => <Chip key={tag.idGrupo} size="small" variant="outlined" label={organizacao.grupos.find((grupo) => grupo.idGrupo === tag.idGrupo)?.nome || 'Lotação'} />)}
        <Typography variant="body2">{item.perfis?.join(', ') || 'Sem perfil'}</Typography>
        {item.situacao === 'convidado' && <Button onClick={() => executarAcao('REENVIAR_CONVITE_USUARIO', { idUsuario: item.idUsuario }, 'Convite reenviado.')}>Reenviar convite</Button>}
        {item.situacao === 'convidado' && <Button color="error" onClick={() => { if (window.confirm(`Cancelar o convite de ${item.nome}?`)) executarAcao('REMOVER_USUARIO', { idUsuario: item.idUsuario }, 'Convite cancelado.'); }}>Cancelar convite</Button>}
        <Button onClick={() => setCadastroEditado({ modo: 'usuario', idUsuario: item.idUsuario })}>{item.situacao === 'inativo' ? 'Reativar' : 'Abrir'}</Button>
      </Paper>)}</Stack>
    </>}
    {aba === 'pessoas' && podeAdministrar && <>
      <Alert severity="info">Pessoas não entram no sistema. Para permitir acesso, convide-as em Usuários.</Alert>
      <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap"><TextField size="small" label="Buscar pessoa" value={busca} onChange={(evento) => setBusca(evento.target.value)} />
        <FormControlLabel control={<Switch checked={mostrarUsuarios} onChange={(evento) => setMostrarUsuarios(evento.target.checked)} />} label="Mostrar fichas dos usuários" />
        <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setCadastroEditado({ modo: 'pessoa' })}>Nova pessoa</Button></Stack>
      <Stack gap={1}>{[...cadastro.pessoas, ...(mostrarUsuarios ? cadastro.usuarios : [])].filter((item) => `${nomeExibido(item)} ${item.email || ''}`.toLocaleLowerCase('pt-BR').includes(busca.toLocaleLowerCase('pt-BR'))).map((item) => <Paper key={item.idPessoa} variant="outlined" sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center' }}><Users size={20} /><Box sx={{ flex: 1 }}><Typography fontWeight={700}>{nomeExibido(item)}</Typography><Typography variant="body2">{item.cpfMascarado ? `${item.cpfMascarado} · ` : ''}{item.email || 'Sem e-mail'} · {item.telefone || 'Sem telefone'}</Typography></Box><Button onClick={() => setCadastroEditado({ modo: 'pessoa', idPessoa: item.idPessoa })}>Abrir</Button></Paper>)}</Stack>
    </>}
    {aba === 'tags' && podeOrganizar && <>
      <Alert severity="warning">Evite criar tags que revelem dados pessoais sensíveis.</Alert>
      <Stack direction="row" gap={1}><TextField size="small" label="Buscar tag" value={busca} onChange={(evento) => setBusca(evento.target.value)} /><Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setTagEditada({ nova: true, codigo: '', nomeExibicao: '', descricao: '', grupo: false, usuario: true, vinculo: false, restrita: false, ativo: true })}>Nova tag</Button></Stack>
      {['sistema', 'empresa'].map((tipo) => <Box key={tipo}><Typography variant="h6" sx={{ mb: 1 }}>Tags {tipo === 'sistema' ? 'do sistema' : 'da empresa'}</Typography><Stack gap={1}>
        {organizacao.tags.filter((tag) => Boolean(tag.sistema) === (tipo === 'sistema') && `${tag.codigo} ${tag.nomeExibicao}`.toLocaleLowerCase('pt-BR').includes(busca.toLocaleLowerCase('pt-BR'))).map((tag) => <Paper key={tag.codigo} variant="outlined" sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ flex: 1 }}><Typography fontWeight={700}>{tag.sistema && <LockKeyhole size={15} aria-label="Tag do sistema" />} {tag.nomeExibicao}</Typography><Typography variant="caption" color="text.secondary">{tag.codigo} · {[tag.grupo && 'Grupo', tag.usuario && 'Usuário', tag.vinculo && 'Vínculo'].filter(Boolean).join(', ')}</Typography></Box>
          {!tag.sistema && <Chip size="small" variant="outlined" label={`${tag.uso || 0} em uso`} />}{tag.restrita && <Chip size="small" color="warning" label="Sensível" />}{!tag.ativo && <Chip size="small" label="Inativa" />}
          <Button onClick={() => setTagEditada({ ...tag, nova: false })}>Editar</Button>
        </Paper>)}</Stack></Box>)}
    </>}

    <Drawer anchor="right" open={Boolean(grupoEditado)} onClose={() => setGrupoEditado(null)}><Box sx={{ width: { xs: '100vw', sm: 430 }, p: 3, display: 'grid', gap: 2 }}>
      <Typography variant="h5">{grupoEditado?.idGrupo ? 'Grupo' : 'Novo grupo'}</Typography>
      <TextField label="Nome" value={grupoEditado?.nome || ''} onChange={(evento) => setGrupoEditado({ ...grupoEditado, nome: evento.target.value })} />
      <FormControlLabel control={<Switch checked={Boolean(grupoEditado?.tags?.includes('departamento'))} onChange={(evento) => setGrupoEditado({ ...grupoEditado, tags: evento.target.checked ? [...grupoEditado.tags, 'departamento'] : grupoEditado.tags.filter((tag) => tag !== 'departamento'), idGrupoSuperior: evento.target.checked ? grupoEditado.idGrupoSuperior : null })} />} label="É departamento" />
      {grupoEditado?.tags?.includes('departamento') && <TextField select label="Superior" value={grupoEditado.idGrupoSuperior || ''} onChange={(evento) => setGrupoEditado({ ...grupoEditado, idGrupoSuperior: evento.target.value ? Number(evento.target.value) : null })}><MenuItem value="">Nenhum (topo)</MenuItem>{departamentos.filter((item) => item.idGrupo !== grupoEditado.idGrupo).map((item) => <MenuItem key={item.idGrupo} value={item.idGrupo}>{item.nome}</MenuItem>)}</TextField>}
      {grupoEditado?.idGrupo && <><Divider /><Typography fontWeight={700}>Gestão e participantes</Typography>
        <Stack direction="row" gap={1}><TextField select size="small" label="Pessoa" value={novoVinculoUsuario} onChange={(evento) => setNovoVinculoUsuario(evento.target.value)} sx={{ flex: 1 }}><MenuItem value="">Selecione</MenuItem>{organizacao.usuarios.map((item) => <MenuItem key={item.idUsuario} value={item.idUsuario}>{item.nome}</MenuItem>)}</TextField>
          <TextField select size="small" label="Papel" value={novaTagVinculo} onChange={(evento) => setNovaTagVinculo(evento.target.value)} sx={{ minWidth: 120 }}>{organizacao.tags.filter((tag) => tag.vinculo && tag.ativo).map((tag) => <MenuItem key={tag.codigo} value={tag.codigo}>{tag.nomeExibicao}</MenuItem>)}</TextField></Stack>
        <Button disabled={!novoVinculoUsuario || salvando} onClick={async () => { const ok = await executarAcao('ATRIBUIR_TAG_NO_GRUPO', { idUsuario: novoVinculoUsuario, idGrupo: grupoEditado.idGrupo, codigo: novaTagVinculo }, 'Vínculo atualizado.'); if (ok) setNovoVinculoUsuario(''); }}>Adicionar pessoa</Button>
        {['gestor', 'substituto', 'supervisor', 'lotacao'].map((codigo) => <Box key={codigo}><Typography variant="subtitle2">{nomeTag(organizacao.tags, codigo)}</Typography>{organizacao.tagsVinculo.filter((tag) => tag.idGrupo === grupoEditado.idGrupo && tag.codigo === codigo && tag.ativo).map((tag) => <Chip key={tag.idUsuario} sx={{ m: 0.3 }} label={organizacao.usuarios.find((item) => item.idUsuario === tag.idUsuario)?.nome || tag.idUsuario} onDelete={() => executarAcao('SALVAR_TAG_VINCULO', { idUsuario: tag.idUsuario, idGrupo: grupoEditado.idGrupo, codigo, ativo: false }, 'Vínculo atualizado.')} />)}</Box>)}
        <Typography variant="subtitle2">Também participam</Typography>{organizacao.vinculos.filter((item) => item.idGrupo === grupoEditado.idGrupo && item.ativo && !organizacao.tagsVinculo.some((tag) => tag.idGrupo === item.idGrupo && tag.idUsuario === item.idUsuario && tag.codigo === 'lotacao' && tag.ativo)).map((item) => <Typography key={item.idUsuario} variant="body2">{organizacao.usuarios.find((usuario) => usuario.idUsuario === item.idUsuario)?.nome}</Typography>)}
      </>}
      <Typography variant="subtitle2">Tags do grupo</Typography><Stack direction="row" gap={1} flexWrap="wrap">{organizacao.tags.filter((tag) => tag.grupo && tag.ativo).map((tag) => <FormControlLabel key={tag.codigo} control={<Switch size="small" checked={Boolean(grupoEditado?.tags?.includes(tag.codigo))} onChange={(evento) => setGrupoEditado({ ...grupoEditado, tags: evento.target.checked ? [...grupoEditado.tags, tag.codigo] : grupoEditado.tags.filter((codigo) => codigo !== tag.codigo) })} />} label={tag.nomeExibicao} />)}</Stack>
      {grupoEditado?.idGrupo && <Box><Typography variant="subtitle2">Usado em protocolos</Typography><Typography variant="body2" color="text.secondary">{grupoEditado.protocolos?.join(', ') || 'Nenhum protocolo publicado vigente.'}</Typography></Box>}
      {grupoEditado?.idGrupo && <FormControlLabel control={<Switch checked={Boolean(grupoEditado.ativo)} onChange={(evento) => setGrupoEditado({ ...grupoEditado, ativo: evento.target.checked })} />} label="Grupo ativo" />}
      <Stack direction="row" gap={1}><Button variant="contained" disabled={salvando} onClick={salvarGrupo}>Salvar</Button><Button onClick={() => setGrupoEditado(null)}>Fechar</Button></Stack>
    </Box></Drawer>
    <Drawer anchor="right" open={Boolean(cadastroEditado)} onClose={() => setCadastroEditado(null)}><Box sx={{ width: { xs: '100vw', sm: 600 }, p: 3 }}><Typography variant="h5">{cadastroEditado?.modo === 'pessoa' ? 'Pessoa' : 'Colaborador'}</Typography>
      {cadastroEditado && <CadastroPessoaForm {...cadastroEditado} onSaved={() => { carregar(); setCadastroEditado(null); }} onCancel={() => setCadastroEditado(null)} />}</Box></Drawer>
    <Dialog open={Boolean(tagEditada)} onClose={() => setTagEditada(null)} fullWidth><DialogTitle>{tagEditada?.nova ? 'Nova tag' : 'Editar tag'}</DialogTitle><DialogContent sx={{ display: 'grid', gap: 2, pt: '16px !important' }}>
      <TextField label="Código técnico" value={tagEditada?.codigo || ''} disabled={!tagEditada?.nova} onChange={(evento) => setTagEditada({ ...tagEditada, codigo: evento.target.value })} />
      <TextField label="Nome exibido" value={tagEditada?.nomeExibicao || ''} onChange={(evento) => setTagEditada({ ...tagEditada, nomeExibicao: evento.target.value })} />
      {!tagEditada?.sistema && <><TextField label="Descrição" value={tagEditada?.descricao || ''} onChange={(evento) => setTagEditada({ ...tagEditada, descricao: evento.target.value })} />
        <Stack direction="row" flexWrap="wrap">{[['grupo', 'Grupo'], ['usuario', 'Usuário'], ['vinculo', 'Vínculo'], ['restrita', 'Sensível'], ['ativo', 'Ativa']].map(([chave, label]) => <FormControlLabel key={chave} control={<Switch checked={Boolean(tagEditada?.[chave])} onChange={(evento) => setTagEditada({ ...tagEditada, [chave]: evento.target.checked })} />} label={label} />)}</Stack></>}
    </DialogContent><DialogActions><Button onClick={() => setTagEditada(null)}>Cancelar</Button><Button variant="contained" disabled={salvando} onClick={salvarTag}>Salvar</Button></DialogActions></Dialog>
    <Drawer anchor="right" open={pendenciasAbertas} onClose={() => setPendenciasAbertas(false)}><Box sx={{ p: 3, width: { xs: '100vw', sm: 430 }, display: 'grid', gap: 2 }}><Typography variant="h5">Pendências de cadastro</Typography>
      {!pendencias.length && <Alert severity="success">Nenhuma pendência encontrada.</Alert>}
      {pendencias.map((pendencia, indice) => <Paper key={`${pendencia.tipo}-${pendencia.idGrupo || indice}`} variant="outlined" sx={{ p: 2 }}><Typography fontWeight={700}>{pendencia.titulo}</Typography><Typography variant="body2">{pendencia.etapa && `${pendencia.etapa} · `}{pendencia.descricao}</Typography>{pendencia.tipo === 'departamento' && <Button onClick={() => { setPendenciasAbertas(false); editarGrupo(organizacao.grupos.find((grupo) => grupo.idGrupo === pendencia.idGrupo)); }}>Abrir grupo <ChevronRight size={16} /></Button>}</Paper>)}
    </Box></Drawer>
  </Box>;
}
