import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import { formatarValorExemplo } from './variavel-texto.js';
import { apresentacaoCampo } from './pdf-campos-layout.js';

const FONTES = {
  HELVETICA: [StandardFonts.Helvetica, StandardFonts.HelveticaOblique,
    StandardFonts.HelveticaBold, StandardFonts.HelveticaBoldOblique],
  TIMES: [StandardFonts.TimesRoman, StandardFonts.TimesRomanItalic,
    StandardFonts.TimesRomanBold, StandardFonts.TimesRomanBoldItalic],
  COURIER: [StandardFonts.Courier, StandardFonts.CourierOblique,
    StandardFonts.CourierBold, StandardFonts.CourierBoldOblique],
};

function corPdf(hexadecimal) {
  return rgb(...[1, 3, 5].map((indice) => parseInt(hexadecimal.slice(indice, indice + 2), 16) / 255));
}

function erroCampo(mensagem, nome) {
  const erro = new Error(mensagem);
  erro.nome = nome;
  return erro;
}

export async function gerarPreviaPdf(bytes, documentoLido, campos, variaveis) {
  const documento = await PDFDocument.load(bytes.slice(0));
  const fontes = new Map();
  const porId = new Map(variaveis.map((variavel) => [variavel.id, variavel]));

  for (const campo of campos) {
    const variavel = porId.get(campo.idAtributo != null ? `instituicao:${campo.idAtributo}` : campo.idVariavel);
    if (!variavel) continue;
    if (campo.pagina < 1 || campo.pagina > documento.getPageCount())
      throw new Error('Um campo está associado a uma página inexistente.');

    const exemplo = variavel.valorInstituicao ?? variavel.definicao?.valorExemplo;
    const valor = exemplo
      ? variavel.tipo === 'S' ? formatarValorExemplo(exemplo, variavel.definicao?.texto?.mascara) : exemplo
      : `{{${variavel.codigo}}}`;
    const paginaLida = await documentoLido.getPage(campo.pagina);
    const viewport = paginaLida.getViewport({ scale: 1 });
    const pagina = documento.getPage(campo.pagina - 1);
    const estilo = apresentacaoCampo(campo);
    const variante = FONTES[estilo.fonte]?.[Number(estilo.negrito) * 2 + Number(estilo.italico)];
    if (!variante) throw erroCampo('A fonte selecionada para {nome} não está disponível.', variavel.nome);
    if (!fontes.has(variante)) fontes.set(variante, await documento.embedFont(variante));
    const fonte = fontes.get(variante);
    const tamanhoFonte = estilo.tamanho;
    let larguraTexto;

    try {
      larguraTexto = fonte.widthOfTextAtSize(valor, tamanhoFonte);
    } catch {
      throw erroCampo('O valor de exemplo de {nome} contém caracteres não suportados pela fonte da prévia.', variavel.nome);
    }
    if (larguraTexto > campo.largura || tamanhoFonte > campo.altura)
      throw erroCampo('O valor de exemplo de {nome} não cabe no campo. Amplie o campo ou reduza o texto.', variavel.nome);

    const [x, y] = viewport.convertToPdfPoint(campo.x, campo.y + tamanhoFonte);
    const cor = exemplo ? corPdf(estilo.cor) : rgb(0.4, 0.46, 0.5);
    pagina.drawText(valor, {
      x, y, size: tamanhoFonte, font: fonte,
      color: cor,
      rotate: degrees(viewport.rotation),
    });
    if (estilo.sublinhado) {
      const [inicioX, inicioY] = viewport.convertToPdfPoint(campo.x, campo.y + tamanhoFonte + 1.5);
      const [fimX, fimY] = viewport.convertToPdfPoint(campo.x + larguraTexto, campo.y + tamanhoFonte + 1.5);
      pagina.drawLine({ start: { x: inicioX, y: inicioY }, end: { x: fimX, y: fimY },
        thickness: Math.max(0.5, tamanhoFonte / 18), color: cor });
    }
  }
  return new Blob([await documento.save()], { type: 'application/pdf' });
}
