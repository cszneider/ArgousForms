import React, { useEffect } from 'react';
import { Alert, Box, Button, TextField } from '@mui/material';
import { usePainel } from './contexto.js';
import { Card } from './componentes.js';
import { dataHora } from './dados.js';

export function Configuracoes() {
  const { value, dispatch } = usePainel();
  const dados = value.dados;
  useEffect(() => {
    dispatch({ field: 'configRascunho', value: { ...dados } });
    dispatch({ field: 'configAlterada', value: false });
  }, [dados, dispatch]);
  const form = value.configRascunho;
  if (!form || form.revisao !== dados.revisao) return null;
  const alterar = (campo, valor) => { dispatch({ field: 'configRascunho', value: (antes) => ({ ...antes, [campo]: valor }) }); dispatch({ field: 'configAlterada', value: true }); };
  const campos = [
    ['validadeSessaoMinutos', 'Validade da sessão (minutos)', 11, 'Aplica-se aos novos logins. As sessões já criadas mantêm seu vencimento.'],
    ['retencaoTransacoesDias', 'Retenção de transações (dias)', 1, 'Prazo de conservação do histórico de chamadas.'],
    ['retencaoAcoesDias', 'Retenção de ações administrativas (dias)', 1, 'Prazo de conservação das ações dos administradores.'],
    ['retencaoSessoesDias', 'Retenção de sessões encerradas (dias)', 1, 'Sessões referenciadas por ações precisam ser preservadas enquanto houver esse vínculo.'],
  ];
  return <Box component="form" onSubmit={(e) => { e.preventDefault(); dispatch({ field: 'confirmacao', value: { tipo: 'config', titulo: 'Salvar configurações?', texto: 'Os novos parâmetros serão registrados junto com o autor e os valores anteriores. A validade das sessões existentes não será alterada.' } }); }}><div className="admin-config-colunas"><Card titulo="Regionalização" apoio="Datas e estatísticas da instituição"><div className="admin-formulario admin-card-conteudo"><TextField label="Fuso horário" value={form.fusoHorario} required disabled={value.salvando} onChange={(e) => alterar('fusoHorario', e.target.value)} helperText="Identificador IANA, como America/Sao_Paulo ou UTC." slotProps={{ htmlInput: { maxLength: 100 } }} /></div></Card><Card titulo="Sessões e histórico" apoio="Parâmetros operacionais da instalação"><div className="admin-formulario admin-card-conteudo">{campos.map(([campo, label, min, ajuda]) => <TextField key={campo} label={label} type="number" required value={form[campo]} disabled={value.salvando} onChange={(e) => alterar(campo, e.target.value)} helperText={ajuda} slotProps={{ htmlInput: { min, max: 2147483647, step: 1 } }} />)}<Alert severity="info">Os prazos podem ser configurados. A limpeza automática do histórico ainda não está ativa.</Alert></div></Card></div>{value.erroEdicao && <Alert severity="error" sx={{ my: 2 }}>{value.erroEdicao}</Alert>}<div className="admin-config-rodape"><span>Última alteração: {dataHora(dados.alteradoEm, dados.fusoHorario)} · {dados.alteradoPor}</span><Button type="submit" variant="contained" disabled={!value.configAlterada || value.salvando}>Salvar configurações</Button></div></Box>;
}
