const ENDPOINT = '/ArgousForms/argousforms.iarslvr';

export async function executar(operacao, dados = {}) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'same-origin',
    cache: 'no-store',
    body: JSON.stringify({ operacao, dados }),
  });

  let resultado;
  try {
    resultado = await response.json();
  } catch {
    throw new Error('O serviço não retornou uma resposta JSON.');
  }

  if (!response.ok || resultado?.status !== 'ok') {
    const erro = new Error(resultado?.mensagem || 'O serviço não respondeu como esperado.');
    erro.codigo = resultado?.codigoErro;
    erro.statusCode = response.status;
    throw erro;
  }
  return resultado.dados;
}

export const entrarLocal = (email, senha) => executar('ENTRAR_LOCAL', { email, senha });
export const sessaoAtual = () => executar('SESSAO_ATUAL');
export const sair = () => executar('SAIR');
