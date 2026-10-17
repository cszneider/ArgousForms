const ENDPOINT = '/ArgousForms/upload-arquivo';

export function enviarArquivo(dados, progresso) {
  return new Promise((resolve, reject) => {
    const requisicao = new XMLHttpRequest();
    requisicao.open('POST', ENDPOINT);
    requisicao.responseType = 'json';
    requisicao.setRequestHeader('Accept', 'application/json');
    requisicao.upload.onprogress = (evento) => {
      if (evento.lengthComputable) progresso(Math.round(evento.loaded * 100 / evento.total));
    };
    requisicao.onerror = () => reject(new Error('Não foi possível conectar ao serviço de envio.'));
    requisicao.onload = () => {
      const resposta = requisicao.response;
      if (requisicao.status >= 200 && requisicao.status < 300 && resposta?.status === 'ok') {
        resolve(resposta.dados);
      } else {
        reject(new Error(resposta?.mensagem || 'O serviço de envio não respondeu como esperado.'));
      }
    };
    requisicao.send(dados);
  });
}
