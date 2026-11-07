package br.com.argousForms.processos;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;
import java.util.Locale;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.json.JSONObject;

import br.com.argousForms.api.ArgousFormsApiException;

/** Sobrepõe os valores do Processo aos campos de um modelo PDF publicado. */
public final class PdfProcessoRenderer {

	public record Campo( int pagina, float x, float y, float largura, float altura, String valor, JSONObject apresentacao ) {}

	public byte[] gerar( byte[] origem, List<Campo> campos ) throws Exception {

		try ( PDDocument documento = Loader.loadPDF( origem ) ) {
			for( Campo campo : campos ) desenhar( documento, campo );
			ByteArrayOutputStream destino = new ByteArrayOutputStream();
			documento.save( destino );
			return destino.toByteArray();
		}
	}

	private void desenhar( PDDocument documento, Campo campo ) throws Exception {

		if( campo.pagina() < 1 || campo.pagina() > documento.getNumberOfPages() ) {
			throw new ArgousFormsApiException( 409, "PAGINA_MODELO_INVALIDA", "Um campo do modelo aponta para uma página inexistente." );
		}
		PDPage pagina = documento.getPage( campo.pagina() - 1 );
		if( pagina.getRotation() != 0 ) {
			throw new ArgousFormsApiException( 409, "PAGINA_ROTACIONADA", "A geração ainda não aceita páginas PDF rotacionadas." );
		}
		PDRectangle area = pagina.getCropBox();
		JSONObject estilo = campo.apresentacao() == null ? new JSONObject() : campo.apresentacao();
		float tamanho = (float) estilo.optDouble( "tamanho", 12 );
		if( tamanho <= 0 || tamanho > campo.altura() || campo.x() < 0 || campo.y() < 0
			|| campo.x() + campo.largura() > area.getWidth() + 0.01f || campo.y() + campo.altura() > area.getHeight() + 0.01f ) {
			throw new ArgousFormsApiException( 409, "CAMPO_MODELO_INVALIDO", "Um campo do modelo não cabe na página PDF." );
		}
		String valor = campo.valor() == null ? "" : campo.valor();
		if( valor.isEmpty() ) return;
		if( valor.indexOf( '\n' ) >= 0 || valor.indexOf( '\r' ) >= 0 ) {
			throw new ArgousFormsApiException( 409, "VALOR_PDF_INVALIDO", "Um valor do documento contém quebra de linha." );
		}
		PDType1Font fonte = fonte( estilo );
		float largura;
		try { largura = fonte.getStringWidth( valor ) * tamanho / 1000f; }
		catch ( IllegalArgumentException | IOException e ) {
			throw new ArgousFormsApiException( 409, "CARACTERE_PDF_INVALIDO", "Um valor contém caracteres não suportados pela fonte do modelo." );
		}
		if( largura > campo.largura() ) throw new ArgousFormsApiException( 409, "VALOR_PDF_EXTENSO", "Um valor não cabe no campo do documento PDF." );

		int[] cor = cor( estilo.optString( "cor", "#000000" ) );
		float x = area.getLowerLeftX() + campo.x();
		float y = area.getUpperRightY() - campo.y() - tamanho;
		try ( PDPageContentStream conteudo = new PDPageContentStream( documento, pagina, PDPageContentStream.AppendMode.APPEND, true, true ) ) {
			conteudo.setNonStrokingColor( cor[ 0 ] / 255f, cor[ 1 ] / 255f, cor[ 2 ] / 255f );
			conteudo.beginText();
			conteudo.setFont( fonte, tamanho );
			conteudo.newLineAtOffset( x, y );
			conteudo.showText( valor );
			conteudo.endText();
			if( estilo.optBoolean( "sublinhado" ) ) {
				conteudo.setStrokingColor( cor[ 0 ] / 255f, cor[ 1 ] / 255f, cor[ 2 ] / 255f );
				conteudo.setLineWidth( Math.max( 0.5f, tamanho / 18f ) );
				conteudo.moveTo( x, y - 1.5f );
				conteudo.lineTo( x + largura, y - 1.5f );
				conteudo.stroke();
			}
		}
	}

	private PDType1Font fonte( JSONObject estilo ) throws ArgousFormsApiException {

		String nome = estilo.optString( "fonte", "HELVETICA" ).toUpperCase( Locale.ROOT );
		boolean negrito = estilo.optBoolean( "negrito" );
		boolean italico = estilo.optBoolean( "italico" );
		Standard14Fonts.FontName tipo = switch( nome ) {
			case "HELVETICA" -> negrito ? italico ? Standard14Fonts.FontName.HELVETICA_BOLD_OBLIQUE : Standard14Fonts.FontName.HELVETICA_BOLD
				: italico ? Standard14Fonts.FontName.HELVETICA_OBLIQUE : Standard14Fonts.FontName.HELVETICA;
			case "TIMES" -> negrito ? italico ? Standard14Fonts.FontName.TIMES_BOLD_ITALIC : Standard14Fonts.FontName.TIMES_BOLD
				: italico ? Standard14Fonts.FontName.TIMES_ITALIC : Standard14Fonts.FontName.TIMES_ROMAN;
			case "COURIER" -> negrito ? italico ? Standard14Fonts.FontName.COURIER_BOLD_OBLIQUE : Standard14Fonts.FontName.COURIER_BOLD
				: italico ? Standard14Fonts.FontName.COURIER_OBLIQUE : Standard14Fonts.FontName.COURIER;
			default -> throw new ArgousFormsApiException( 409, "FONTE_PDF_INVALIDA", "A fonte do modelo não é suportada." );
		};
		return new PDType1Font( tipo );
	}

	private int[] cor( String codigo ) throws ArgousFormsApiException {

		if( !codigo.matches( "#[0-9A-Fa-f]{6}" ) ) throw new ArgousFormsApiException( 409, "COR_PDF_INVALIDA", "A cor de um campo do modelo é inválida." );
		return new int[] { Integer.parseInt( codigo.substring( 1, 3 ), 16 ), Integer.parseInt( codigo.substring( 3, 5 ), 16 ), Integer.parseInt( codigo.substring( 5, 7 ), 16 ) };
	}
}
