'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, CircularProgress } from '@mui/material';
import { ArrowRight, Columns3, RefreshCw } from 'lucide-react';
import { executar } from '../login/autenticacao.js';
import { useI18n } from '../../components/i18n/i18n.js';
import './processos.css';

const colunas = [
  ['aguardando', 'Aguardando minha ação'],
  ['disponiveis', 'Disponíveis'],
  ['emAndamento', 'Em andamento'],
  ['encerrados', 'Encerrados'],
];

export default function Tarefas({ aoAbrir }) {
  const { t } = useI18n();
  const [tarefas, setTarefas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [recarregar, setRecarregar] = useState(0);

  useEffect(() => {
    let cancelado = false;
    executar('LISTAR_MINHAS_TAREFAS').then((dados) => {
      if (!cancelado) { setTarefas(dados.tarefas || []); setErro(''); }
    }).catch((falha) => { if (!cancelado) setErro(falha.message); })
      .finally(() => { if (!cancelado) setCarregando(false); });
    return () => { cancelado = true; };
  }, [recarregar]);

  return <div className="processos-pagina">
    <header className="page-heading"><div><span className="eyebrow">{t('QUADRO DE TRABALHO')}</span>
      <h1>{t('Tarefas')}</h1><p>{t('Processos organizados pela ação que cabe a você.')}</p></div>
      <Button variant="outlined" startIcon={<RefreshCw size={16} />} onClick={() => { setCarregando(true); setRecarregar((valor) => valor + 1); }}>{t('Atualizar')}</Button>
    </header>
    {erro && <Alert severity="error" sx={{ mb: 2 }}>{erro}</Alert>}
    {carregando ? <CircularProgress /> : <div className="tarefas-quadro">
      {colunas.map(([codigo, titulo]) => <section key={codigo} className="tarefas-coluna">
        <header><h2>{t(titulo)}</h2><span>{tarefas.filter((item) => item.categoria === codigo).length}</span></header>
        {tarefas.filter((item) => item.categoria === codigo).map((item) => <article key={item.idProcesso} className="tarefas-cartao">
          <div className="tarefas-cartao-icone"><Columns3 size={17} /></div><h3>{item.titulo}</h3>
          {(item.etapas || []).map((etapa) => <p key={etapa.id}>{etapa.titulo}</p>)}
          {aoAbrir && <Button size="small" endIcon={<ArrowRight size={14} />} onClick={() => aoAbrir(item.idProcesso)}>{t('Abrir processo')}</Button>}
        </article>)}
        {!tarefas.some((item) => item.categoria === codigo) && <p className="tarefas-vazio">{t('Nenhum processo nesta coluna.')}</p>}
      </section>)}
    </div>}
  </div>;
}
