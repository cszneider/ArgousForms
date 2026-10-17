package br.com.argousForms.documentos;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Properties;

import javax.servlet.ServletContext;

import br.com.argousForms.api.ArgousFormsApiException;
import quatro.util.BDUtil;

/** Parâmetros de conexão ao MongoDB, lidos apenas quando o armazenamento for utilizado. */
public final class MongoConfiguracao {

	private final String uri;
	private final String banco;
	private final String bancoAutenticacao;
	private final String usuario;
	private final String senha;
	private final String bucket;

	private MongoConfiguracao( String uri, String banco, String bancoAutenticacao, String usuario, String senha, String bucket ) {

		this.uri = uri;
		this.banco = banco;
		this.bancoAutenticacao = bancoAutenticacao;
		this.usuario = usuario;
		this.senha = senha;
		this.bucket = bucket;
	}

	public static MongoConfiguracao carregar( ServletContext contexto ) throws ArgousFormsApiException {

		try ( InputStream arquivo = contexto.getResourceAsStream( "/WEB-INF/agforms.xml" ) ) {
			if( arquivo == null ) throw indisponivel();

			Properties parametros = new Properties();
			parametros.loadFromXML( arquivo );
			String uri = obrigatorio( parametros, "mongodb-uri" );
			URI endereco = new URI( uri );
			if( !( "mongodb".equals( endereco.getScheme() ) || "mongodb+srv".equals( endereco.getScheme() ) )
				|| endereco.getRawAuthority() == null || endereco.getRawAuthority().contains( "@" ) ) {
				throw indisponivel();
			}

			String usuario = BDUtil.decodifica( obrigatorio( parametros, "mongodb-usuario" ) );
			String senha = BDUtil.decodifica( obrigatorio( parametros, "mongodb-senha" ) );
			if( usuario == null || usuario.isBlank() || senha == null || senha.isBlank() ) throw indisponivel();

			return new MongoConfiguracao( uri, obrigatorio( parametros, "mongodb-banco" ),
				obrigatorio( parametros, "mongodb-banco-autenticacao" ), usuario,
				senha, obrigatorio( parametros, "mongodb-bucket" ) );
		} catch ( IOException | URISyntaxException | IllegalArgumentException e ) {
			throw indisponivel();
		}
	}

	String uri() {
		return uri;
	}

	String banco() {
		return banco;
	}

	String bancoAutenticacao() {
		return bancoAutenticacao;
	}

	String usuario() {
		return usuario;
	}

	char[] senha() {
		return senha.toCharArray();
	}

	String bucket() {
		return bucket;
	}

	private static String obrigatorio( Properties parametros, String chave ) throws ArgousFormsApiException {

		String valor = parametros.getProperty( chave );
		if( valor == null || valor.isBlank() ) throw indisponivel();
		return valor.strip();
	}

	private static ArgousFormsApiException indisponivel() {
		return new ArgousFormsApiException( 503, "MONGODB_NAO_CONFIGURADO", "O armazenamento de arquivos ainda não está configurado nesta instalação." );
	}
}
