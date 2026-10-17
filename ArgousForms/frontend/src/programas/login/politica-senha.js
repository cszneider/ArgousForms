export function avaliarSenha(senha) {
  const tamanho = senha.length >= 8 && senha.length <= 1024;
  const maiuscula = /\p{Lu}/u.test(senha);
  const minuscula = /\p{Ll}/u.test(senha);
  const numeral = /\p{Nd}/u.test(senha);
  const simbolo = /[\p{P}\p{S}]/u.test(senha);
  const categorias = [maiuscula, minuscula, numeral, simbolo].filter(Boolean).length;
  const valida = tamanho && categorias >= 3;
  const pontos = (tamanho ? 20 : Math.min(senha.length * 2, 14)) + categorias * 15 + (senha.length >= 12 ? 10 : 0) + (senha.length >= 16 ? 10 : 0);
  const forca = !senha ? 0 : valida ? Math.min(pontos, 100) : Math.min(pontos, 55);
  const rotulo = !senha ? 'Ainda não avaliada' : !valida ? 'Fraca' : senha.length >= 12 && categorias === 4 ? 'Forte' : 'Boa';
  return { tamanho, maiuscula, minuscula, numeral, simbolo, categorias, valida, forca, rotulo };
}
