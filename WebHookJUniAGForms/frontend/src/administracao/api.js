export async function consultarAdministracao(operacao, filtros = {}, campos, signal) {
  const query = new URLSearchParams();
  for (const [nome, valor] of Object.entries(filtros)) if (valor !== '' && valor != null) query.set(nome, String(valor));
  let resposta;
  try {
    resposta = await fetch(`${import.meta.env.BASE_URL}api/administracao/${operacao}${query.size ? `?${query}` : ''}`, {
      method: campos ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
      headers: { 'X-Webhook-Admin': '1', ...(campos ? { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' } : {}) },
      body: campos ? new URLSearchParams(campos) : undefined,
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(65000)]) : AbortSignal.timeout(65000),
    });
  } catch (erro) {
    if (signal?.aborted) throw erro;
    throw new Error('Não foi possível conectar ao servidor. Tente novamente.');
  }
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    const erro = new Error(dados.mensagem || 'Não foi possível concluir a consulta.');
    erro.codigo = dados.codigo;
    erro.status = resposta.status;
    throw erro;
  }
  return dados;
}
