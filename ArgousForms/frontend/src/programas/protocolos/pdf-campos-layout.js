export const APRESENTACAO_PADRAO = Object.freeze({
  fonte: 'HELVETICA',
  cor: '#000000',
  tamanho: 12,
  negrito: false,
  italico: false,
  sublinhado: false,
});

export function apresentacaoCampo(campo) {
  return { ...APRESENTACAO_PADRAO, ...campo.apresentacao };
}

export function alinharCampos(campos, selecionados, direcao) {
  const ids = new Set(selecionados);
  const grupo = campos.filter((campo) => ids.has(campo.id));
  if (grupo.length < 2 || grupo.some((campo) => campo.pagina !== grupo[0].pagina)) return campos;

  const esquerda = Math.min(...grupo.map((campo) => campo.x));
  const direita = Math.max(...grupo.map((campo) => campo.x + campo.largura));
  const topo = Math.min(...grupo.map((campo) => campo.y));
  const baixo = Math.max(...grupo.map((campo) => campo.y + campo.altura));
  const centro = (esquerda + direita) / 2;

  return campos.map((campo) => {
    if (!ids.has(campo.id)) return campo;
    if (direcao === 'topo') return { ...campo, y: Math.round(topo * 100) / 100 };
    if (direcao === 'baixo') return { ...campo, y: Math.round((baixo - campo.altura) * 100) / 100 };
    if (direcao === 'esquerda') return { ...campo, x: Math.round(esquerda * 100) / 100 };
    if (direcao === 'centro') return { ...campo, x: Math.round((centro - campo.largura / 2) * 100) / 100 };
    if (direcao === 'direita') return { ...campo, x: Math.round((direita - campo.largura) * 100) / 100 };
    return campo;
  });
}
