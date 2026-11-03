const POSICOES = 'aAdD09#*';
const EXIGIDAS = 'AD9*';
const REGEX_LITERAL = /[A-Za-z0-9@._%+\-[\]{},?*^$]/;

export const REGEX_PRONTAS = [
  { nome: 'E-mail (formato básico)', valor: '[A-Za-z0-9._%+\\-]+@[A-Za-z0-9.\\-]+\\.[A-Za-z]{2,}' },
  { nome: 'Somente dígitos', valor: '[0-9]+' },
  { nome: 'Letras ASCII e dígitos', valor: '[A-Za-z0-9]+' },
];

export function validarRegexTexto(regex) {
  if (!regex) return '';
  if (regex.length > 200 || /[()|/\n\r]/.test(regex)) return 'A expressão regular usa recursos fora da sintaxe portátil permitida.';
  for (let i = 0; i < regex.length; i++) {
    if (regex[i] === '\\') {
      if (!'.+*?[]{}\\^$-'.includes(regex[++i] || '')) return 'A expressão regular contém uma sequência de escape não permitida.';
    } else if (!REGEX_LITERAL.test(regex[i])) return 'A expressão regular usa caracteres fora da sintaxe portátil permitida.';
  }
  try { new RegExp(regex, 'u'); }
  catch { return 'A expressão regular não é válida.'; }
  return '';
}

export function validarDefinicaoTexto(texto = {}) {
  const minimo = texto.tamanhoMinimo || 0;
  const maximo = texto.tamanhoMaximo || 0;
  if (![minimo, maximo].every((valor) => Number.isInteger(valor) && valor >= 0 && valor <= 10000))
    return 'Os limites de tamanho devem ser inteiros entre 0 e 10000.';
  if (maximo && minimo > maximo) return 'O tamanho mínimo não pode superar o máximo.';
  const mascara = texto.mascara || '';
  if (typeof mascara !== 'string' || mascara.length > 500) return 'A máscara pode ter até 500 caracteres.';
  const zeros = texto.preencherZerosEsquerda === true;
  let capacidade = 0;
  let obrigatorias = 0;
  let opcional = false;
  for (let i = 0; i < mascara.length; i++) {
    const atual = mascara[i];
    if (atual === '\\') {
      if (++i === mascara.length) return 'A máscara termina com uma barra de escape incompleta.';
      continue;
    }
    if (/[\p{Cc}\p{Cf}]/u.test(atual)) return 'A máscara não pode conter caracteres de controle.';
    if (!POSICOES.includes(atual)) continue;
    capacidade++;
    const exigida = EXIGIDAS.includes(atual);
    if (exigida) obrigatorias++;
    else opcional = true;
    if (opcional && exigida && !zeros) return 'Posições opcionais devem ficar após as obrigatórias.';
    if (zeros && !'09'.includes(atual)) return 'Preenchimento com zeros exige máscara somente com posições numéricas.';
    if (zeros && !exigida && obrigatorias > 0) return 'Na máscara com zeros à esquerda, posições opcionais devem vir antes das obrigatórias.';
  }
  if (zeros && (!capacidade || !obrigatorias)) return 'Preenchimento com zeros exige máscara numérica com ao menos uma posição obrigatória.';
  if (capacidade && (minimo > capacidade || maximo && maximo < obrigatorias))
    return 'Os limites de tamanho são incompatíveis com a máscara.';
  if (zeros && (minimo > capacidade || maximo && maximo < capacidade))
    return 'O tamanho preenchido com zeros deve caber nos limites informados.';
  return validarRegexTexto(texto.regex || '');
}

function posicoesDaMascara(mascara) {
  const partes = [];
  for (const caractere of mascara) {
    if (partes.at(-1)?.escape) {
      partes[partes.length - 1] = { literal: caractere };
    } else if (caractere === '\\') {
      partes.push({ escape: true });
    } else if (POSICOES.includes(caractere)) {
      partes.push({ tipo: caractere });
    } else {
      partes.push({ literal: caractere });
    }
  }
  return partes;
}

function aceita(tipo, caractere) {
  if ('aA'.includes(tipo)) return /^\p{L}$/u.test(caractere);
  if ('dD'.includes(tipo)) return /^(?:\p{L}|[0-9])$/u.test(caractere);
  if ('09'.includes(tipo)) return /^[0-9]$/.test(caractere);
  return !/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(caractere);
}

export function normalizarValorExemplo(valor, definicao = {}, tipo = 'S') {
  if (typeof valor !== 'string') return { erro: 'O valor exemplo deve ser um texto.' };
  const original = valor.normalize('NFC');
  if (original.length > 500 || /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(original))
    return { erro: 'O valor exemplo deve ter até 500 caracteres e não pode conter quebras de linha ou caracteres de controle.' };
  if (!original || tipo !== 'S') return { valor: original };
  const texto = definicao.texto || {};
  const mascara = texto.mascara || '';
  const partes = posicoesDaMascara(mascara);
  let resultado = original;

  if (mascara && texto.preencherZerosEsquerda) {
    const literais = new Set(partes.filter((parte) => parte.literal).map((parte) => parte.literal));
    const digitos = [...original].filter((caractere) => !literais.has(caractere)).join('');
    const capacidade = partes.filter((parte) => parte.tipo).length;
    if (!/^[0-9]+$/.test(digitos) || digitos.length > capacidade)
      return { erro: 'O valor exemplo não corresponde à máscara.' };
    resultado = digitos.padStart(capacidade, '0');
  } else if (mascara) {
    const entrada = [...original];
    const dados = [];
    let indice = 0;
    for (const parte of partes) {
      if (parte.literal) {
        if (entrada[indice] === parte.literal) indice++;
      } else if (entrada[indice] && aceita(parte.tipo, entrada[indice])) {
        dados.push(entrada[indice++]);
      } else if (EXIGIDAS.includes(parte.tipo)) {
        return { erro: 'O valor exemplo não corresponde à máscara.' };
      }
    }
    if (indice !== entrada.length) return { erro: 'O valor exemplo não corresponde à máscara.' };
    resultado = dados.join('');
  }

  const tamanho = [...resultado].length;
  if (texto.tamanhoMinimo && tamanho < texto.tamanhoMinimo || texto.tamanhoMaximo && tamanho > texto.tamanhoMaximo)
    return { erro: 'O valor exemplo não atende aos limites de tamanho da variável.' };
  if (texto.regex && !new RegExp(`^(?:${texto.regex})$`, 'u').test(resultado))
    return { erro: 'O valor exemplo não corresponde à expressão regular da variável.' };
  return { valor: resultado };
}

export function formatarValorExemplo(valor, mascara = '') {
  if (!valor || !mascara) return valor || '';
  const dados = [...valor];
  let indice = 0;
  let resultado = '';
  for (const parte of posicoesDaMascara(mascara)) {
    if (parte.literal) {
      if (indice < dados.length) resultado += parte.literal;
    } else if (indice < dados.length) {
      resultado += dados[indice++];
    }
  }
  return resultado;
}
