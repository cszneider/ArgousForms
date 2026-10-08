const ENDPOINT = '/ArgousForms/argousforms.iarslvr';

export const verificacoes = [
  { operacao: 'PING', rotulo: 'Servidor', sucesso: 'Servidor ativo.' },
  {
    operacao: 'VERIFICAR_BANCO',
    rotulo: 'Banco de dados',
    sucesso: 'Conexão com o banco disponível.',
  },
  {
    operacao: 'VERIFICAR_ORIGEM_LOCAL',
    rotulo: 'Origem de login local',
    sucesso: 'Origem local cadastrada.',
  },
];

const erros = {
  BANCO_INDISPONIVEL: 'Não foi possível conectar ao banco de dados.',
  ORIGEM_LOCAL_AUSENTE: 'A origem local (CD_ORIGEM = 1) não foi cadastrada.',
  ORIGEM_LOCAL_CONSULTA_FALHOU: 'Não foi possível consultar a origem local.',
  OPERACAO_NAO_ENCONTRADA: 'Operação de diagnóstico não encontrada no servidor.',
};

export async function consultarDiagnostico(
  operacao,
  { fetchImpl = globalThis.fetch, signal } = {},
) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 10000);

  try {
    const response = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      credentials: 'same-origin',
      redirect: 'error',
      cache: 'no-store',
      signal: controller.signal,
      body: JSON.stringify({ operacao, dados: {} }),
    });

    let body;
    try {
      body = await response.json();
    } catch {
      throw new Error('O serviço não retornou uma resposta JSON.');
    }

    if (!response.ok || body?.status !== 'ok') {
      throw new Error(
        erros[body?.codigoErro] || 'O serviço não respondeu como esperado.',
      );
    }

    const dados = body.dados;
    const valido =
      operacao === 'PING'
        ? typeof dados?.dataHoraSistema === 'string' &&
          dados.dataHoraSistema.length > 0
        : operacao === 'VERIFICAR_BANCO'
          ? dados?.bancoDisponivel === true
          : operacao === 'VERIFICAR_ORIGEM_LOCAL' &&
            dados?.origemLocalPresente === true;
    if (!valido) throw new Error('O serviço não respondeu como esperado.');

    return dados;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (controller.signal.aborted)
      throw new Error('Tempo esgotado ao consultar o serviço.');
    if (error instanceof TypeError)
      throw new Error('Não foi possível comunicar com o servidor.');
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
