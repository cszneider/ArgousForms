export const RESULTADOS = {
  P: ['Em processamento', 'info'], O: ['Sucesso', 'success'], N: ['Não encontrado', 'default'],
  R: ['Recusada', 'warning'], S: ['Serviço suspenso', 'warning'], F: ['Falha técnica', 'error'], I: ['Interrompida', 'error'],
};
export const ACOES = {
  0: 'Login realizado', 1: 'Logout realizado', 2: 'Senha alterada', 3: 'Administrador criado',
  4: 'Administrador alterado', 5: 'Administrador ativado', 6: 'Administrador desativado',
  7: 'Recebimento suspenso', 8: 'Recebimento retomado', 9: 'Configuração alterada',
};
export const PAGINAS = [
  ['resumo', 'Visão geral', 'grid', 'Acompanhe a atividade da integração em um só lugar.'],
  ['transacoes', 'Transações', 'arrows', 'Consulte as chamadas recebidas e seus resultados.'],
  ['estatisticas', 'Estatísticas', 'chart', 'Entenda o volume, o desempenho e os horários de maior atividade.'],
  ['administradores', 'Administradores', 'users', 'Gerencie quem pode administrar esta instalação.'],
  ['atividade', 'Atividade administrativa', 'clock', 'Acompanhe as ações realizadas pelos administradores.'],
  ['configuracao', 'Configurações', 'settings', 'Defina os parâmetros de funcionamento da instalação.'],
];
export function numero(valor) { return Number(valor || 0).toLocaleString('pt-BR'); }
export function duracao(valor) { return valor == null ? '—' : `${Number(valor).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ms`; }
export function dataHora(valor, fuso = 'UTC') {
  if (!valor) return '—';
  try { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: fuso }).format(new Date(valor)); }
  catch { return '—'; }
}
export function diaCurto(dia) { return dia ? `${dia.slice(8, 10)}/${dia.slice(5, 7)}` : ''; }
export function diasCompletos(dados, inicio, fim) {
  if (!inicio || !fim) return [];
  const mapa = new Map(dados.map((item) => [item.dia, item]));
  const lista = [];
  const atual = new Date(`${inicio}T12:00:00Z`);
  const limite = new Date(`${fim}T12:00:00Z`);
  while (atual <= limite && lista.length < 366) {
    const dia = atual.toISOString().slice(0, 10);
    lista.push({ dia, total: 0, falhas: 0, ...mapa.get(dia) });
    atual.setUTCDate(atual.getUTCDate() + 1);
  }
  return lista;
}
export function horasCompletas(dados) {
  const mapa = new Map(dados.map((item) => [Number(item.hora), Number(item.total)]));
  return Array.from({ length: 24 }, (_, hora) => ({ hora, total: mapa.get(hora) || 0 }));
}
