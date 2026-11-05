'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, MenuItem, TextField } from '@mui/material';
import { ArrowLeft, ChevronDown, ChevronRight, Plus, Settings2 } from 'lucide-react';
import { useI18n } from '../../components/i18n/i18n.js';
import { executar } from '../login/autenticacao.js';

const novo = (tipo = 'V', idAtributoPai = null) => ({ idAtributo: null, idAtributoPai, codigo: '', tipo, valor: '' });

function organizarVariaveis(variaveis, recolhidos) {
  const porId = new Map(variaveis.map((item) => [item.idAtributo, item]));
  const filhos = new Map();
  const raizes = [];

  for (const item of variaveis) {
    const pai = porId.get(item.idAtributoPai);
    if (pai?.tipo === 'G' && pai.idAtributo !== item.idAtributo) {
      if (!filhos.has(pai.idAtributo)) filhos.set(pai.idAtributo, []);
      filhos.get(pai.idAtributo).push(item);
    } else {
      raizes.push(item);
    }
  }

  const linhas = [];
  const visitados = new Set();
  function adicionar(item, nivel) {
    if (visitados.has(item.idAtributo)) return;
    visitados.add(item.idAtributo);
    linhas.push({ item, nivel, temFilhos: (filhos.get(item.idAtributo)?.length || 0) > 0 });
    if (!recolhidos.has(item.idAtributo)) {
      for (const filho of filhos.get(item.idAtributo) || []) adicionar(filho, nivel + 1);
    }
  }

  for (const item of raizes) adicionar(item, 0);
  return linhas;
}

export default function VariaveisInstituicao({ aoVoltar }) {
  const { t } = useI18n();
  const [variaveis, setVariaveis] = useState([]);
  const [edicao, setEdicao] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [recolhidos, setRecolhidos] = useState(() => new Set());

  async function carregar() {
    setErro('');
    try {
      const dados = await executar('LISTAR_VARIAVEIS_INSTITUICAO');
      setVariaveis(dados.variaveis || []);
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    let cancelado = false;
    executar('LISTAR_VARIAVEIS_INSTITUICAO')
      .then((dados) => { if (!cancelado) setVariaveis(dados.variaveis || []); })
      .catch((falha) => { if (!cancelado) setErro(falha.message); })
      .finally(() => { if (!cancelado) setCarregando(false); });
    return () => { cancelado = true; };
  }, []);

  async function salvar() {
    if (salvando || !edicao) return;
    setSalvando(true);
    setErro('');
    try {
      await executar('SALVAR_VARIAVEL_INSTITUICAO', edicao);
      setEdicao(null);
      await carregar();
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setSalvando(false);
    }
  }

  async function definirAtiva(item) {
    setSalvando(true);
    setErro('');
    try {
      await executar('DEFINIR_VARIAVEL_INSTITUICAO_ATIVA', { idAtributo: item.idAtributo, ativa: !item.ativo });
      await carregar();
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setSalvando(false);
    }
  }

  const grupos = variaveis.filter((item) => item.tipo === 'G' && item.ativo);
  const linhas = organizarVariaveis(variaveis, recolhidos);

  function alternarGrupo(idAtributo) {
    setRecolhidos((anteriores) => {
      const proximos = new Set(anteriores);
      if (proximos.has(idAtributo)) proximos.delete(idAtributo);
      else proximos.add(idAtributo);
      return proximos;
    });
  }

  return <div className="protocolos-shell">
    <button type="button" className="protocolos-voltar" onClick={aoVoltar}><ArrowLeft size={16} />{t('Todos os Protocolos')}</button>
    <header className="protocolos-heading">
      <div>
        <span className="eyebrow">{t('VARIÁVEIS DA INSTITUIÇÃO')}</span>
        <h1>{t('Variáveis da instituição')}</h1>
        <p>{t('Organize valores que poderão ser usados nos modelos de documentos.')}</p>
      </div>
      <div className="protocolos-central-acoes">
        <Button variant="outlined" startIcon={<Plus size={17} />} onClick={() => setEdicao(novo('G'))}>{t('Novo grupo')}</Button>
        <Button variant="contained" startIcon={<Plus size={17} />} onClick={() => setEdicao(novo())}>{t('Nova variável')}</Button>
      </div>
    </header>
    {erro && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro('')}>{erro}</Alert>}
    {carregando ? <LinearProgress /> : variaveis.length === 0 ?
      <Alert severity="info">{t('Nenhuma variável da instituição cadastrada.')}</Alert> :
      <div className="protocolos-lista">{linhas.map(({ item, nivel, temFilhos }) => <article className="protocolos-item variaveis-instituicao-item"
        key={item.idAtributo} style={{ marginLeft: `${nivel * 28}px` }}>
        <div className="protocolos-item-corpo">
          <div className="protocolos-item-titulo"><h2>{item.codigo}</h2><Chip size="small" label={t(item.tipo === 'G' ? 'Grupo' : 'Valor')} />
            {!item.ativo && <Chip size="small" color="default" label={t('Inativo')} />}</div>
          <p>{item.tipo === 'G' ? t('Grupo de variáveis') : item.valor}</p>
        </div>
        <div className="protocolos-central-acoes">
          {item.tipo === 'G' && item.ativo && <Button size="small" startIcon={<Plus size={16} />}
            onClick={() => setEdicao(novo('V', item.idAtributo))}>{t('Nova variável')}</Button>}
          {temFilhos && <Button size="small" startIcon={recolhidos.has(item.idAtributo) ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
            aria-expanded={!recolhidos.has(item.idAtributo)} onClick={() => alternarGrupo(item.idAtributo)}>
            {t(recolhidos.has(item.idAtributo) ? 'Expandir' : 'Recolher')}
          </Button>}
          {item.ativo && <Button size="small" startIcon={<Settings2 size={16} />} onClick={() => setEdicao({ ...item })}>{t('Editar')}</Button>}
          <Button size="small" disabled={salvando} onClick={() => definirAtiva(item)}>{t(item.ativo ? 'Inativar' : 'Reativar')}</Button>
        </div>
      </article>)}</div>}
    <Dialog open={!!edicao} onClose={() => !salvando && setEdicao(null)} fullWidth maxWidth="sm">
      <DialogTitle>{t(edicao?.idAtributo ? 'Editar variável da instituição' : edicao?.tipo === 'G' ? 'Novo grupo de variáveis' : 'Nova variável da instituição')}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: '12px !important' }}>
        {erro && <Alert severity="error">{erro}</Alert>}
        <TextField required label={t('Nome técnico')} value={edicao?.codigo || ''} inputProps={{ maxLength: 21 }} disabled={salvando}
          onChange={(evento) => setEdicao({ ...edicao, codigo: evento.target.value })} />
        <TextField select label={t('Grupo pai')} value={edicao?.idAtributoPai ?? ''} disabled={salvando || !!edicao?.idAtributo}
          onChange={(evento) => setEdicao({ ...edicao, idAtributoPai: evento.target.value === '' ? null : Number(evento.target.value) })}>
          <MenuItem value="">{t('Sem grupo')}</MenuItem>
          {grupos.filter((grupo) => grupo.idAtributo !== edicao?.idAtributo).map((grupo) =>
            <MenuItem key={grupo.idAtributo} value={grupo.idAtributo}>{grupo.codigo}</MenuItem>)}
        </TextField>
        {edicao?.tipo === 'V' && <TextField required multiline minRows={2} label={t('Valor')} value={edicao.valor || ''}
          inputProps={{ maxLength: 255 }} disabled={salvando}
          onChange={(evento) => setEdicao({ ...edicao, valor: evento.target.value })} />}
      </DialogContent>
      <DialogActions>
        <Button disabled={salvando} onClick={() => setEdicao(null)}>{t('Cancelar')}</Button>
        <Button variant="contained" disabled={salvando || !edicao?.codigo.trim() || (edicao.tipo === 'V' && !edicao.valor.trim())} onClick={salvar}>{t('Salvar')}</Button>
      </DialogActions>
    </Dialog>
  </div>;
}
