package br.com.argousForms.cadastro;

import java.io.IOException;
import java.io.InputStream;
import java.util.Base64;
import java.util.Properties;
import java.util.UUID;

import javax.servlet.ServletContext;

import br.com.argousForms.api.ArgousFormsApiException;
import br.com.argousForms.security.CodigoConfirmacao;
import quatro.sql.Conexao;
import quatro.sql.PoolDeConexoes;
import quatro.sql.Query;
import quatro.util.BDUtil;

final class CadastroConfiguracao {

	private CadastroConfiguracao() {
	}

	static UUID origemLocal() throws ArgousFormsApiException {

		try ( Conexao conexao = PoolDeConexoes.getConexao(); Query query = new Query( conexao ) ) {
			query.setSQL( "select ID_ORIGEM_LOGIN from Cadastro.ORIGENS_LOGIN where CD_ORIGEM = :codigo" );
			query.setParameter( "codigo", 1 );
			query.executeQuery();
			if( query.isEmpty() ) {
				throw indisponivel();
			}

			UUID id = UUID.fromString( query.getString( "ID_ORIGEM_LOGIN" ) );
			if( query.next() ) {
				throw indisponivel();
			}

			return id;
		} catch ( Exception e ) {
			throw indisponivel();
		}
	}

	static CodigoConfirmacao codigos( ServletContext contexto ) throws ArgousFormsApiException {

		try ( InputStream arquivo = contexto.getResourceAsStream( "/WEB-INF/agforms.xml" ) ) {
			if( arquivo == null ) {
				throw indisponivel();
			}

			Properties parametros = new Properties();
			parametros.loadFromXML( arquivo );
			return decodificarChave( parametros.getProperty( "chave-confirmacao" ) );
		} catch ( IOException | IllegalArgumentException e ) {
			throw indisponivel();
		}
	}

	static CodigoConfirmacao decodificarChave( String valor ) throws ArgousFormsApiException {

		if( valor == null || valor.isBlank() ) {
			throw indisponivel();
		}

		try {
			String base64 = BDUtil.decodifica( valor.strip() );
			if( base64 == null || base64.isBlank() ) {
				throw indisponivel();
			}

			return new CodigoConfirmacao( Base64.getDecoder().decode( base64.strip() ) );
		} catch ( IllegalArgumentException e ) {
			throw indisponivel();
		}
	}

	private static ArgousFormsApiException indisponivel() {
		return new ArgousFormsApiException( 503, "CADASTRO_NAO_CONFIGURADO", "O cadastro ainda não está configurado nesta instalação." );
	}
}
