import { createId } from '../../utils/uid.js';

export const TIPOS_DADO = [
  ['S', 'Texto'],
  ['I', 'Inteiro'],
  ['R', 'Decimal'],
  ['M', 'Moeda'],
  ['V', 'Valor monetário'],
  ['B', 'Booleano'],
  ['O', 'Opção'],
  ['D', 'Data'],
  ['H', 'Hora'],
  ['T', 'Data e hora'],
];

const prefixo = 'argousforms:protocolos:rascunhos-locais:v1:';

export function chaveProtocolos(usuario) {
  return prefixo + usuario;
}

export function lerProtocolos(chave) {
  try {
    const registros = JSON.parse(localStorage.getItem(chave) || '[]');
    return Array.isArray(registros) ? registros : [];
  } catch {
    return [];
  }
}

export function novoProtocolo(
  titulo,
  descricao,
  idUsuarioCriador,
  agora = new Date().toISOString(),
  id = createId(),
) {
  return {
    id,
    idUsuarioCriador,
    titulo: titulo.trim(),
    descricao: descricao.trim(),
    criadoEm: agora,
    atualizadoEm: agora,
    ativo: false,
    versaoPublicada: 0,
    rascunho: {
      id: createId(),
      idUsuarioResponsavel: idUsuarioCriador,
      numero: -1,
      variaveis: [],
      formularios: [],
      etapas: [],
      documentos: [],
      pasta: null,
    },
  };
}

export function nomeTipo(codigo) {
  return TIPOS_DADO.find(([tipo]) => tipo === codigo)?.[1] || codigo;
}
