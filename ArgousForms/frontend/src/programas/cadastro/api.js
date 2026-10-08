const ENDPOINT = '/ArgousForms/argousforms.iarslvr';

const mensagens = {
  CADASTRO_INDISPONIVEL:
    'Já iniciou seu cadastro? Use “Retomar cadastro” para solicitar outro código.',
  CADASTRO_NAO_DISPONIVEL:
    'Confira seu e-mail e senha. O cadastro pode já estar confirmado.',
  CADASTRO_NAO_CONFIGURADO:
    'O cadastro está indisponível no momento. Tente novamente mais tarde.',
  AUTOCADASTRO_INDISPONIVEL:
    'O cadastro está indisponível no momento. Tente novamente mais tarde.',
  CODIGO_INVALIDO:
    'Código inválido, expirado ou já utilizado. Confira o código ou solicite outro.',
  CONFIRMACAO_INVALIDA: 'Retome seu cadastro para solicitar um novo código.',
  REENVIO_LIMITADO:
    'Aguarde antes de solicitar outro código. São permitidos até cinco envios por hora.',
  LIMITE_CADASTRO: 'Muitas solicitações. Aguarde antes de tentar novamente.',
};

export async function chamarCadastro(
  operacao,
  dados,
  { fetchImpl = globalThis.fetch, signal } = {},
) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 45000);
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
      body: JSON.stringify({ operacao, dados }),
    });
    let body;
    try {
      body = await response.json();
    } catch {
      throw new Error(
        'O servidor não respondeu como esperado. Tente novamente mais tarde.',
      );
    }
    if (!response.ok || body?.status !== 'ok') {
      const error = new Error(
        mensagens[body?.codigoErro] ||
          (response.status === 429
            ? mensagens.LIMITE_CADASTRO
            : 'Não foi possível concluir a solicitação. Confira os dados e tente novamente.'),
      );
      error.codigo = body?.codigoErro;
      throw error;
    }
    const result = body.dados;
    const valid =
      operacao === 'CONFIRMAR_EMAIL'
        ? result?.emailConfirmado === true
        : typeof result?.idConfirmacao === 'string' &&
          /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(
            result.idConfirmacao,
          ) &&
          typeof result.emailEnviado === 'boolean' &&
          result.confirmacaoPendente === true;
    if (!valid)
      throw new Error(
        'O servidor não respondeu como esperado. Tente novamente mais tarde.',
      );
    return result;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (controller.signal.aborted || error instanceof TypeError) {
      throw new Error(
        'Não foi possível confirmar a resposta do servidor. Se já enviou seus dados, use “Retomar cadastro”.',
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
