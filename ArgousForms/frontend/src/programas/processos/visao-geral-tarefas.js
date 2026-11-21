'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, CircularProgress } from '@mui/material';
import { ArrowRight, ArrowUpRight, CheckCircle2, Clock, Inbox, RefreshCw } from 'lucide-react';
import { executar } from '../login/autenticacao.js';
import { useI18n } from '../../components/i18n/i18n.js';

const indicadores = [
  ['paraFazer', 'Para fazer', 'Processos que precisam de você', Inbox, 'tasks'],
  ['paraAssumir', 'Para assumir', 'Etapas que você pode assumir', Clock, 'reviews'],
  ['acompanhando', 'Acompanhando', 'Processos sem ação sua agora', RefreshCw, 'active'],
  ['concluidos', 'Concluídos', 'Processos concluídos ou cancelados', CheckCircle2, 'done'],
];

export default function VisaoGeralTarefas({ aoAbrirTarefas, aoIniciarProcesso }) {
  const { t } = useI18n();
  const [tarefas, setTarefas] = useState(null);
  const [erro, setErro] = useState('');
  const [atualizacao, setAtualizacao] = useState(0);

  useEffect(() => {
    let ativa = true;
    executar('LISTAR_MINHAS_TAREFAS').then((dados) => {
      if (!ativa) return;
      setTarefas(dados.tarefas || []);
      setErro('');
    }).catch((falha) => {
      if (!ativa) return;
      setErro(falha.message);
    });
    return () => { ativa = false; };
  }, [atualizacao]);

  const pendentes = tarefas?.filter((item) => item.coluna === 'paraFazer' || item.coluna === 'paraAssumir') || [];

  return <>
    {erro && <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => { setTarefas(null); setErro(''); setAtualizacao((valor) => valor + 1); }}>{t('Tentar novamente')}</Button>}>{erro}</Alert>}
    {tarefas === null && !erro ? <CircularProgress aria-label={t('Carregando tarefas')} /> : tarefas && <>
      <div className="stats-grid">
        {indicadores.map(([categoria, titulo, descricao, Icon, classe]) => <button
          className={`stat-card ${classe}`} key={categoria} onClick={aoAbrirTarefas}>
          <div className="stat-top"><span>{t(titulo)}</span><Icon size={19} /></div>
          <strong>{String(tarefas.filter((item) => item.coluna === categoria).length).padStart(2, '0')}</strong>
          <small>{t(descricao)}</small>
        </button>)}
      </div>
      <div className="home-columns">
        <section className="panel attention-panel">
          <div className="panel-heading">
            <div><h2>{t('Seu próximo passo')}</h2><p>{t('Processos que precisam de você.')}</p></div>
            <Button onClick={aoAbrirTarefas} endIcon={<ArrowUpRight size={16} />}>{t('Ver tarefas')}</Button>
          </div>
          {pendentes.length ? pendentes.slice(0, 2).map((item) => <button
            className="task-preview" key={`${item.idProcesso}-${item.idEtapa || item.coluna}`} onClick={aoAbrirTarefas}>
            <span className="task-preview-icon"><Inbox size={22} /></span>
            <span className="task-preview-copy"><strong>{item.titulo}</strong>
              <small>{t(item.coluna === 'paraFazer' ? 'Para fazer' : 'Para assumir')}{item.etapa ? ` · ${item.etapa}` : ''}{item.numero ? ` · ${item.numero}` : ''}</small>
            </span>
            <ArrowRight size={18} />
          </button>) : <div className="empty-state compact">
            <CheckCircle2 size={25} /><h3>{t('Tudo em dia')}</h3><p>{t('Nenhuma ação sua pendente agora.')}</p>
          </div>}
        </section>
        {aoIniciarProcesso && <section className="quick-start">
          <div className="quick-start-top"><Inbox size={25} /><span>{t('INICIAR UM PROCESSO')}</span></div>
          <h2>{t('Novo processo')}</h2>
          <p>{t('Escolha um Protocolo que você pode iniciar.')}</p>
          <Button variant="contained" color="inherit" endIcon={<ArrowUpRight size={17} />} onClick={aoIniciarProcesso}>{t('Ver Protocolos disponíveis')}</Button>
        </section>}
      </div>
    </>}
  </>;
}
