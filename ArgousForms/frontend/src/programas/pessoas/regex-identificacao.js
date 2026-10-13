const TAMANHO_MAXIMO = 50;
const REPETICOES_MAXIMAS = 70;
const PROFUNDIDADE_MAXIMA = 8;

function asciiAlfanumerico(valor) {
  return /^[0-9A-Za-z]$/.test(valor);
}

function mesmaFaixa(inicio, fim) {
  return /^[0-9]$/.test(inicio) && /^[0-9]$/.test(fim)
    || /^[A-Z]$/.test(inicio) && /^[A-Z]$/.test(fim)
    || /^[a-z]$/.test(inicio) && /^[a-z]$/.test(fim);
}

function analisar(corpo) {
  let posicao = 0;
  const atual = () => corpo[posicao] ?? '';
  const rejeitar = () => { throw new Error('Expressão fora da sintaxe permitida.'); };

  function numero() {
    const inicio = posicao;
    let valor = 0;
    while (/^[0-9]$/.test(atual())) {
      valor = valor * 10 + Number(atual());
      if (valor > REPETICOES_MAXIMAS) rejeitar();
      posicao++;
    }
    if (inicio === posicao) rejeitar();
    return valor;
  }

  function quantificador() {
    if (atual() === '?') {
      posicao++;
      return;
    }
    if (atual() !== '{') return;
    posicao++;
    const minimo = numero();
    let maximo = minimo;
    if (atual() === ',') {
      posicao++;
      maximo = numero();
    }
    if (atual() !== '}' || minimo > maximo || maximo > REPETICOES_MAXIMAS) rejeitar();
    posicao++;
  }

  function classe() {
    posicao++;
    let elementos = 0;
    while (atual() !== ']') {
      const inicio = atual();
      if (!asciiAlfanumerico(inicio)) rejeitar();
      posicao++;
      if (atual() === '-') {
        posicao++;
        const fim = atual();
        if (!mesmaFaixa(inicio, fim) || fim < inicio) rejeitar();
        posicao++;
      }
      elementos++;
    }
    if (elementos === 0) rejeitar();
    posicao++;
  }

  function atomo(profundidade) {
    if (asciiAlfanumerico(atual())) {
      posicao++;
      return false;
    }
    if (atual() === '[') {
      classe();
      return false;
    }
    if (atual() !== '(' || profundidade >= PROFUNDIDADE_MAXIMA) rejeitar();
    posicao++;
    if (atual() === '?') {
      posicao++;
      if (atual() !== ':') rejeitar();
      posicao++;
    }
    alternativas(profundidade + 1);
    if (atual() !== ')') rejeitar();
    posicao++;
    return true;
  }

  function sequencia(profundidade) {
    const inicio = posicao;
    while (posicao < corpo.length && atual() !== ')' && atual() !== '|') {
      const grupo = atomo(profundidade);
      if (grupo && (atual() === '?' || atual() === '{')) rejeitar();
      if (!grupo) quantificador();
    }
    if (posicao === inicio) rejeitar();
  }

  function alternativas(profundidade) {
    sequencia(profundidade);
    while (atual() === '|') {
      posicao++;
      sequencia(profundidade);
    }
  }

  alternativas(0);
  if (posicao !== corpo.length) rejeitar();
}

function corpoDaExpressao(expressao) {
  if (typeof expressao !== 'string' || !expressao.length || expressao.length > TAMANHO_MAXIMO) return null;
  if (expressao.startsWith('^') || expressao.endsWith('$')) {
    if (!expressao.startsWith('^') || !expressao.endsWith('$')) return null;
    return expressao.slice(1, -1);
  }
  return expressao;
}

export function regexIdentificacaoCompativel(expressao) {
  const corpo = corpoDaExpressao(expressao);
  if (!corpo) return false;
  try {
    analisar(corpo);
    return !new RegExp(`^(?:${corpo})$`).test('');
  } catch {
    return false;
  }
}

export function identificacaoCorresponde(expressao, identificacao) {
  if (typeof identificacao !== 'string' || !identificacao.length || !regexIdentificacaoCompativel(expressao)) return false;
  const corpo = corpoDaExpressao(expressao);
  const resultado = new RegExp(`^(?:${corpo})$`).exec(identificacao);
  return resultado !== null && resultado[0].length === identificacao.length;
}
