'use client';

import { useEffect, useState } from 'react';
import { Alert, Button } from '@mui/material';
import AccessLayout from '../../components/acesso/layout.js';
import { sair, sessaoAtual } from '../../programas/login/autenticacao.js';
import { SESSION_KEY } from '../../programas/plataforma/access.js';

export default function Inicio() {
  const [usuario, setUsuario] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    sessaoAtual().then(setUsuario, (falha) => setErro(falha.message));
  }, []);

  return (
    <AccessLayout backHref="/login" backLabel="Voltar ao login">
      <span className="eyebrow">ARGOUSFORMS</span>
      <h2>{usuario ? `Olá, ${usuario.nome}` : 'Verificando sessão…'}</h2>
      {usuario && <p>Você entrou com {usuario.email}.</p>}
      {usuario && <p>Seu acesso foi confirmado. Os módulos de trabalho ainda serão ligados a esta autenticação.</p>}
      {usuario && (
        <Button
          variant="contained"
          onClick={() => {
            sessionStorage.setItem(SESSION_KEY, `user:${usuario.idUsuario}`);
            window.location.href = '/app';
          }}
        >
          Abrir espaço de trabalho
        </Button>
      )}
      {erro && <Alert severity="error">{erro}</Alert>}
      <Button
        variant="outlined"
        onClick={async () => {
          try {
            await sair();
            sessionStorage.removeItem(SESSION_KEY);
            window.location.href = '/login';
          } catch (falha) {
            setErro(falha.message);
          }
        }}
      >
        Sair
      </Button>
    </AccessLayout>
  );
}
