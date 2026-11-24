'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert, Avatar, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import { Laptop, Smartphone } from 'lucide-react';
import ForcaSenha from '../../components/acesso/forca-senha.js';
import { avaliarSenha } from '../../programas/login/politica-senha.js';
import { executar } from '../../programas/login/autenticacao.js';
import { useI18n } from '../../components/i18n/i18n.js';
import './seguranca-conta.css';

export function nomeDispositivo(agente = '') {
  const texto = String(agente);
  const navegador = /Edg\/|EdgiOS\/|EdgA\//i.test(texto) ? 'Edge'
    : /FxiOS\/|Firefox\//i.test(texto) ? 'Firefox'
      : /CriOS\/|Chrome\//i.test(texto) ? 'Chrome'
        : /Safari\//i.test(texto) ? 'Safari' : 'Navegador desconhecido';
  const sistema = /iPhone/i.test(texto) ? 'iPhone' : /iPad/i.test(texto) ? 'iPad'
    : /Android/i.test(texto) ? 'Android' : /Windows/i.test(texto) ? 'Windows'
      : /Macintosh|Mac OS X/i.test(texto) ? 'macOS' : /iPod|iOS/i.test(texto) ? 'iOS'
        : /Linux/i.test(texto) ? 'Linux' : 'Sistema desconhecido';
  return `${navegador} · ${sistema}`;
}

function tempoRelativo(valor, t) {
  if (!valor) return t('Acesso recente');
  const instante = new Date(valor).getTime();
  if (!Number.isFinite(instante)) return t('Acesso recente');
  const minutos = Math.max(0, Math.floor((Date.now() - instante) / 60000));
  if (minutos < 1) return t('ativo agora');
  if (minutos < 60) return `${t('há')} ${minutos} ${t(minutos === 1 ? 'minuto' : 'minutos')}`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `${t('há')} ${horas} ${t(horas === 1 ? 'hora' : 'horas')}`;
  const dias = Math.floor(horas / 24);
  return `${t('há')} ${dias} ${t(dias === 1 ? 'dia' : 'dias')}`;
}

export default function SegurancaConta({ usuario, foco, aoPerfil }) {
  const { t, system } = useI18n();
  const secaoSenha = useRef(null);
  const secaoConexoes = useRef(null);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erroSenha, setErroSenha] = useState('');
  const [sucessoSenha, setSucessoSenha] = useState('');
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [conexoes, setConexoes] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erroConexoes, setErroConexoes] = useState('');
  const [acao, setAcao] = useState(null);
  const [executando, setExecutando] = useState(false);

  async function carregarConexoes() {
    setCarregando(true);
    setErroConexoes('');
    try {
      const dados = await executar('LISTAR_CONEXOES_ATIVAS');
      setConexoes((dados.conexoes || []).sort((a, b) => Number(b.atual) - Number(a.atual)));
    } catch (falha) { setErroConexoes(falha.message); }
    finally { setCarregando(false); }
  }

  useEffect(() => {
    const agendamento = window.setTimeout(() => { carregarConexoes(); }, 0);
    return () => window.clearTimeout(agendamento);
  }, []);
  useEffect(() => {
    const secao = foco === 'conexoes' ? secaoConexoes : secaoSenha;
    if (foco) requestAnimationFrame(() => secao.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [foco]);

  async function trocarSenha(evento) {
    evento.preventDefault();
    if (salvandoSenha) return;
    setErroSenha('');
    setSucessoSenha('');
    if (!avaliarSenha(senhaNova).valida) { setErroSenha(t('A senha não atende à política de segurança.')); return; }
    if (senhaNova !== confirmacao) { setErroSenha(t('A confirmação não corresponde à nova senha.')); return; }
    setSalvandoSenha(true);
    try {
      await executar('ALTERAR_SENHA', { senhaAtual, senhaNova });
      setSenhaAtual('');
      setSenhaNova('');
      setConfirmacao('');
      setSucessoSenha(t('Senha alterada. As outras conexões foram encerradas.'));
      await carregarConexoes();
    } catch (falha) { setErroSenha(falha.message); }
    finally { setSalvandoSenha(false); }
  }

  async function confirmarEncerramento() {
    if (!acao || executando) return;
    setExecutando(true);
    setErroConexoes('');
    try {
      if (acao.tipo === 'todas') await executar('ENCERRAR_OUTRAS_CONEXOES');
      else await executar('ENCERRAR_CONEXAO', { idLogin: acao.idLogin });
      setAcao(null);
      await carregarConexoes();
    } catch (falha) { setErroConexoes(falha.message); }
    finally { setExecutando(false); }
  }

  const iniciais = (usuario?.nome || '').trim().split(/\s+/).slice(0, 2).map((parte) => parte[0] || '').join('').toUpperCase();
  const outras = conexoes.filter((conexao) => !conexao.atual);

  return <div className="seguranca-conta">
    <header className="seguranca-conta-cabecalho">
      <div className="seguranca-conta-capa" />
      <div className="seguranca-conta-identidade">
        <Avatar className="seguranca-conta-avatar">{iniciais}</Avatar>
        <div><h1>{usuario?.nome}</h1><p>{[usuario?.lotacao, usuario?.email].filter(Boolean).join(' · ')}</p></div>
      </div>
      <nav className="seguranca-conta-abas" aria-label={t('Seções da conta')}>
        <button type="button" onClick={aoPerfil}>{t('Perfil')}</button>
        <button type="button" aria-current="page">{t('Segurança')}</button>
      </nav>
    </header>

    <div className="seguranca-conta-cartoes">
      <section className="seguranca-conta-cartao" id="seguranca-senha" ref={secaoSenha} aria-labelledby="seguranca-senha-titulo">
        <h2 id="seguranca-senha-titulo">{t('Senha')}</h2>
        <p>{t('Altere sua senha para proteger o acesso à conta.')}</p>
        <form onSubmit={trocarSenha} className="seguranca-conta-formulario">
          <TextField label={t('Senha atual')} type="password" autoComplete="current-password" required fullWidth value={senhaAtual}
            disabled={salvandoSenha} onChange={(evento) => setSenhaAtual(evento.target.value)} />
          <TextField label={t('Nova senha')} type="password" autoComplete="new-password" required fullWidth value={senhaNova}
            disabled={salvandoSenha} onChange={(evento) => setSenhaNova(evento.target.value)} slotProps={{ htmlInput: { minLength: 8, maxLength: 1024 } }} />
          <ForcaSenha senha={senhaNova} />
          <TextField label={t('Confirmar nova senha')} type="password" autoComplete="new-password" required fullWidth value={confirmacao}
            disabled={salvandoSenha} onChange={(evento) => setConfirmacao(evento.target.value)} />
          {erroSenha && <Alert severity="error">{system(erroSenha)}</Alert>}
          {sucessoSenha && <Alert severity="success">{sucessoSenha}</Alert>}
          <div className="seguranca-conta-rodape-cartao">
            <Button type="submit" variant="contained" disabled={salvandoSenha || !senhaAtual || !senhaNova || !confirmacao}>{t('Alterar senha')}</Button>
            <small>{t('As outras conexões serão encerradas.')}</small>
          </div>
        </form>
      </section>

      <section className="seguranca-conta-cartao" id="seguranca-conexoes" ref={secaoConexoes} aria-labelledby="seguranca-conexoes-titulo">
        <h2 id="seguranca-conexoes-titulo">{t('Conexões ativas')}</h2>
        <p>{t('Onde sua conta está aberta.')}</p>
        {carregando && <CircularProgress size={24} />}
        {erroConexoes && <Alert severity="error">{system(erroConexoes)}</Alert>}
        {!carregando && !conexoes.length && !erroConexoes && <Alert severity="info">{t('Nenhuma conexão ativa encontrada.')}</Alert>}
        <ul className="seguranca-conta-lista">
          {conexoes.map((conexao) => {
            const celular = /iPhone|iPad|iPod|Android|Mobile/i.test(conexao.agente || '');
            return <li key={conexao.idLogin}>
              <span className="seguranca-conta-dispositivo" aria-hidden="true">{celular ? <Smartphone size={22} /> : <Laptop size={22} />}</span>
              <div className="seguranca-conta-conexao" title={conexao.agente || ''}>
                <strong>{nomeDispositivo(conexao.agente)}</strong>
                {conexao.atual && <Chip size="small" label={t('Este dispositivo')} color="success" />}
                <small>{conexao.enderecoIp || '—'} · {conexao.atual ? t('ativo agora') : tempoRelativo(conexao.ultimoAcesso || conexao.inicio, t)}</small>
              </div>
              {!conexao.atual && <Button size="small" variant="outlined" onClick={() => setAcao({ tipo: 'uma', idLogin: conexao.idLogin })}>{t('Encerrar')}</Button>}
            </li>;
          })}
        </ul>
        <div className="seguranca-conta-rodape-cartao">
          <Button color="error" variant="outlined" disabled={!outras.length || executando} onClick={() => setAcao({ tipo: 'todas' })}>{t('Encerrar todas as outras')}</Button>
          <small>{t('Não reconhece uma conexão? Encerre e troque a senha.')}</small>
        </div>
        <Button size="small" onClick={carregarConexoes} disabled={carregando || executando}>{t('Atualizar')}</Button>
      </section>
    </div>

    <Dialog open={Boolean(acao)} onClose={() => { if (!executando) setAcao(null); }} fullWidth maxWidth="xs">
      <DialogTitle>{t(acao?.tipo === 'todas' ? 'Encerrar todas as outras conexões?' : 'Encerrar esta conexão?')}</DialogTitle>
      <DialogContent>{t('Sua conexão atual continuará aberta.')}</DialogContent>
      <DialogActions>
        <Button onClick={() => setAcao(null)} disabled={executando}>{t('Cancelar')}</Button>
        <Button color="error" variant="contained" onClick={confirmarEncerramento} disabled={executando}>{t('Confirmar')}</Button>
      </DialogActions>
    </Dialog>
  </div>;
}
