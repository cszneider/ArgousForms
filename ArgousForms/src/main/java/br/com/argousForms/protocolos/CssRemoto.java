package br.com.argousForms.protocolos;

import java.io.InputStream;
import java.net.IDN;
import java.net.InetAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

import br.com.argousForms.api.ArgousFormsApiException;

final class CssRemoto {

	private static final int TAMANHO_MAXIMO = 100000;

	private CssRemoto() {}

	static String buscar( String endereco, String dominiosPermitidos ) throws Exception {

		URI uri;
		try { uri = URI.create( endereco ); }
		catch ( IllegalArgumentException e ) { throw invalido( "Informe uma URL HTTPS válida para o CSS." ); }
		if( !"https".equalsIgnoreCase( uri.getScheme() ) || uri.getHost() == null || uri.getUserInfo() != null || uri.getFragment() != null || uri.getPort() != -1 && uri.getPort() != 443 ) {
			throw invalido( "O CSS remoto deve usar HTTPS na porta 443, sem credenciais ou fragmento." );
		}

		String host;
		try { host = IDN.toASCII( uri.getHost() ).toLowerCase( Locale.ROOT ); }
		catch ( IllegalArgumentException e ) { throw invalido( "O domínio do CSS é inválido." ); }
		Set<String> permitidos = ( dominiosPermitidos == null ? "" : dominiosPermitidos ).lines().map( String::strip )
			.filter( linha -> !linha.isEmpty() ).map( linha -> linha.toLowerCase( Locale.ROOT ) ).collect( Collectors.toSet() );
		if( !permitidos.contains( host ) ) throw new ArgousFormsApiException( 403, "DOMINIO_CSS_NAO_AUTORIZADO", "O domínio " + host + " não foi autorizado pela instituição." );

		for( InetAddress enderecoResolvido : InetAddress.getAllByName( host ) ) {
			if( !publico( enderecoResolvido ) ) throw invalido( "O domínio do CSS aponta para uma rede não pública." );
		}

		HttpClient cliente = HttpClient.newBuilder().connectTimeout( Duration.ofSeconds( 5 ) ).followRedirects( HttpClient.Redirect.NEVER ).build();
		HttpRequest requisicao = HttpRequest.newBuilder( uri ).timeout( Duration.ofSeconds( 10 ) ).header( "Accept", "text/css" ).GET().build();
		HttpResponse<InputStream> resposta = cliente.send( requisicao, HttpResponse.BodyHandlers.ofInputStream() );
		try ( InputStream corpo = resposta.body() ) {
			if( resposta.statusCode() != 200 ) throw invalido( "O servidor do CSS respondeu com HTTP " + resposta.statusCode() + "." );
			String tipo = resposta.headers().firstValue( "Content-Type" ).orElse( "" ).toLowerCase( Locale.ROOT );
			if( !tipo.startsWith( "text/css" ) ) throw invalido( "O endereço não devolveu um arquivo CSS." );
			byte[] bytes = corpo.readNBytes( TAMANHO_MAXIMO + 1 );
			if( bytes.length > TAMANHO_MAXIMO ) throw invalido( "O CSS remoto excede 100 KB." );
			String css;
			try { css = StandardCharsets.UTF_8.newDecoder().onMalformedInput( CodingErrorAction.REPORT ).decode( ByteBuffer.wrap( bytes ) ).toString(); }
			catch ( CharacterCodingException e ) { throw invalido( "O CSS remoto deve estar codificado em UTF-8." ); }
			ValidacaoModeloHtml.validarCss( css );
			return css;
		}
	}

	private static boolean publico( InetAddress endereco ) {

		if( endereco.isAnyLocalAddress() || endereco.isLoopbackAddress() || endereco.isLinkLocalAddress() || endereco.isSiteLocalAddress() || endereco.isMulticastAddress() ) return false;
		byte[] bytes = endereco.getAddress();
		if( bytes.length == 4 ) {
			int primeiro = bytes[ 0 ] & 255;
			int segundo = bytes[ 1 ] & 255;
			return primeiro > 0 && primeiro < 224 && !( primeiro == 100 && segundo >= 64 && segundo <= 127 )
				&& !( primeiro == 198 && segundo == 18 || primeiro == 198 && segundo == 19 );
		}
		return bytes.length == 16 && ( bytes[ 0 ] & 254 ) != 252;
	}

	private static ArgousFormsApiException invalido( String mensagem ) {

		return new ArgousFormsApiException( 400, "CSS_REMOTO_INVALIDO", mensagem );
	}
}
