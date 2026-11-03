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

const arredondar = (valor) => Math.round(valor * 100) / 100;

export function alinharCampos(campos, selecionados, direcao, limites) {
  const ids = new Set(selecionados);
  const grupo = campos.filter((campo) => ids.has(campo.id));
  if (grupo.length < 2 || grupo.some((campo) => campo.pagina !== grupo[0].pagina)) return campos;
  const referencia = grupo.find((campo) => campo.id === selecionados[0]);
  if (!referencia) return campos;

  const alterados = campos.map((campo) => {
    if (!ids.has(campo.id)) return campo;
    if (direcao === 'topo') return { ...campo, y: referencia.y };
    if (direcao === 'baixo') return { ...campo, y: arredondar(referencia.y + referencia.altura - campo.altura) };
    if (direcao === 'esquerda') return { ...campo, x: referencia.x };
    if (direcao === 'centro') return { ...campo, x: arredondar(referencia.x + (referencia.largura - campo.largura) / 2) };
    if (direcao === 'direita') return { ...campo, x: arredondar(referencia.x + referencia.largura - campo.largura) };
    return campo;
  });
  if (!limites) return alterados;
  return alterados.some((campo) => ids.has(campo.id) &&
    (campo.x < 0 || campo.y < 0 || campo.x + campo.largura > limites.largura + 0.01 ||
      campo.y + campo.altura > limites.altura + 0.01)) ? campos : alterados;
}

export function moverCamposComSetas(campos, selecionados, direcao, limites) {
  const ids = new Set(selecionados);
  const grupo = campos.filter((campo) => ids.has(campo.id));
  if (!grupo.length || !limites || grupo.some((campo) => campo.pagina !== grupo[0].pagina)) return campos;
  let dx = 0;
  let dy = 0;
  if (direcao === 'ArrowLeft') dx = -Math.max(0, Math.min(1, ...grupo.map((campo) => campo.x)));
  if (direcao === 'ArrowRight') dx = Math.max(0, Math.min(1, ...grupo.map((campo) => limites.largura - campo.x - campo.largura)));
  if (direcao === 'ArrowUp') dy = -Math.max(0, Math.min(1, ...grupo.map((campo) => campo.y)));
  if (direcao === 'ArrowDown') dy = Math.max(0, Math.min(1, ...grupo.map((campo) => limites.altura - campo.y - campo.altura)));
  if (!dx && !dy) return campos;
  return campos.map((campo) => ids.has(campo.id)
    ? { ...campo, x: arredondar(campo.x + dx), y: arredondar(campo.y + dy) } : campo);
}
