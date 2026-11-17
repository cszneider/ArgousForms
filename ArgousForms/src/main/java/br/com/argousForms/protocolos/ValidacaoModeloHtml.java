package br.com.argousForms.protocolos;

import java.util.Set;
import java.util.regex.Pattern;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Attribute;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;

import br.com.argousForms.api.ArgousFormsApiException;

final class ValidacaoModeloHtml {

	private static final Set<String> TAGS = Set.of( "a", "b", "blockquote", "br", "code", "div", "em", "footer", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "i", "li", "main", "ol", "p", "pre", "s", "section", "small", "span", "strong", "sub", "sup", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul" );
	private static final Set<String> ATRIBUTOS = Set.of( "class", "id", "title", "style", "width", "height", "colspan", "rowspan", "align", "valign", "href" );
	private static final Pattern CODIGO_SERVIDOR = Pattern.compile( "(?is)<\\s*(?:\\?|%|/?[a-z][\\w-]*:|/?(?:html|head|body)\\b)|<!doctype\\b|[#$]\\{[^}]*}" );
	private static final Pattern CSS_INSEGURO = Pattern.compile( "(?is)@import\\b|url\\s*\\(|expression\\s*\\(|javascript\\s*:|data\\s*:|\\bbehavior\\s*:|\\bbinding\\s*:|@(?:font-face|namespace|document)\\b" );

	private ValidacaoModeloHtml() {}

	static void validarHtml( String html ) throws ArgousFormsApiException {

		if( CODIGO_SERVIDOR.matcher( html ).find() ) {
			throw invalido( "O HTML contém uma tag de servidor ou uma expressão executável, como JSF." );
		}

		Document documento = Jsoup.parseBodyFragment( html );
		for( Element elemento : documento.getAllElements() ) {
			if( elemento == documento || "html".equals( elemento.normalName() ) || "head".equals( elemento.normalName() ) || "body".equals( elemento.normalName() ) ) continue;
			String tag = elemento.normalName();
			if( !TAGS.contains( tag ) ) throw invalido( "A tag <" + tag + "> não é permitida no modelo HTML." );

			for( Attribute atributo : elemento.attributes() ) {
				String nome = atributo.getKey().toLowerCase( java.util.Locale.ROOT );
				if( !ATRIBUTOS.contains( nome ) ) throw invalido( "O atributo " + nome + " não é permitido na tag <" + tag + ">." );
				if( "style".equals( nome ) ) validarCss( atributo.getValue() );
				if( "href".equals( nome ) && !( atributo.getValue().startsWith( "#" ) || atributo.getValue().matches( "(?i)^(https://|mailto:).+" ) ) ) {
					throw invalido( "Links do documento devem usar HTTPS, mailto ou uma âncora local." );
				}
			}
		}
	}

	static void validarCss( String css ) throws ArgousFormsApiException {

		String semComentarios = css.replaceAll( "(?s)/\\*.*?\\*/", "" );
		if( semComentarios.indexOf( '\\' ) >= 0 || CSS_INSEGURO.matcher( semComentarios ).find() ) {
			throw invalido( "O CSS contém uma referência externa ou uma construção não permitida." );
		}
	}

	private static ArgousFormsApiException invalido( String mensagem ) {

		return new ArgousFormsApiException( 400, "MODELO_HTML_INVALIDO", mensagem );
	}
}
