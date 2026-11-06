'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Chip, CircularProgress, Dialog, DialogContent, DialogTitle } from '@mui/material';
import { ArrowRight, GitBranch, RefreshCw } from 'lucide-react';
import { executar } from '../login/autenticacao.js';
import { useI18n } from '../../components/i18n/i18n.js';
import './processos.css';

const situacoes = { I: 'Iniciado', E: 'Em execução', A: 'Aguardando conclusão', F: 'Finalizado', C: 'Cancelado' };
const situacoesEtapa = { D: 'Disponível', I: 'Iniciada', P: 'Parcialmente salva', S: 'Salva', F: 'Finalizada' };

export default function Processos() {
  const { t, locale } = useI18n();
  const [processos, setProcessos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [recarregar, setRecarregar] = useState(0);
  const [detalhe, setDetalhe] = useState(null);
  const [erroDetalhe, setErroDetalhe] = useState('');
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);

  async function abrir(idProcesso) {
    setErroDetalhe('');
    setCarregandoDetalhe(true);
    try { setDetalhe(await executar('CONSULTAR_PROCESSO', { idProcesso })); }
    catch (falha) { setErroDetalhe(falha.message); }
    finally { setCarregandoDetalhe(false); }
  }

  useEffect(() => {
    let cancelado = false;
    executar('LISTAR_MEUS_PROCESSOS').then((dados) => {
      if (!cancelado) { setProcessos(dados.processos || []); setErro(''); }
    }).catch((falha) => { if (!cancelado) setErro(falha.message); })
      .finally(() => { if (!cancelado) setCarregando(false); });
    return () => { cancelado = true; };
  }, [recarregar]);

  return <div className="processos-pagina">
    <header className="page-heading"><div><span className="eyebrow">{t('SEU HISTÓRICO')}</span>
      <h1>{t('Processos')}</h1><p>{t('Processos nos quais você já teve participação.')}</p></div>
      <Button variant="outlined" startIcon={<RefreshCw size={16} />} onClick={() => { setCarregando(true); setRecarregar((valor) => valor + 1); }}>{t('Atualizar')}</Button>
    </header>
    {erro && <Alert severity="error" sx={{ mb: 2 }}>{erro}</Alert>}
    {carregando ? <CircularProgress /> : processos.length ? <div className="processos-lista">
      {processos.map((item) => <article className="processos-cartao" key={item.id}>
        <span className="processos-icone"><GitBranch size={20} /></span>
        <div className="processos-cartao-corpo"><h2>{item.titulo}</h2>
          <p>{t('Versão')} {item.versao} · {t('Iniciado em')} {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(String(item.inicio).replace(' ', 'T')))}</p></div>
        <Chip size="small" label={t(situacoes[item.situacao] || item.situacao)} color={item.situacao === 'F' ? 'success' : 'default'} />
        <Button endIcon={<ArrowRight size={16} />} onClick={() => abrir(item.id)}>{t('Abrir')}</Button>
      </article>)}
    </div> : <div className="processos-vazio"><GitBranch size={28} /><h2>{t('Nenhum processo ainda')}</h2>
      <p>{t('Um processo aparecerá aqui depois que você iniciar ou participar dele.')}</p></div>}
    {erroDetalhe && <Alert severity="error" sx={{ mt: 2 }}>{erroDetalhe}</Alert>}
    <Dialog open={Boolean(detalhe) || carregandoDetalhe} onClose={() => setDetalhe(null)} fullWidth maxWidth="md">
      <DialogTitle>{detalhe?.titulo || t('Carregando Processo...')}</DialogTitle>
      <DialogContent>
        {carregandoDetalhe && <CircularProgress />}
        {detalhe && <>
          <p>{t('Versão')} {detalhe.versao} · {t(situacoes[detalhe.situacao] || detalhe.situacao)}</p>
          <h3>{t('Etapas')}</h3>
          <div className="processos-lista">{detalhe.etapas?.map((etapa) => <article className="processos-cartao" key={etapa.id}>
            <span className="processos-icone"><GitBranch size={18} /></span>
            <div className="processos-cartao-corpo"><h2>{etapa.titulo}</h2><p>{t('Passagem')} {etapa.passagem}</p></div>
            <Chip size="small" label={t(situacoesEtapa[etapa.situacao] || etapa.situacao)} />
          </article>)}</div>
        </>}
      </DialogContent>
    </Dialog>
  </div>;
}
