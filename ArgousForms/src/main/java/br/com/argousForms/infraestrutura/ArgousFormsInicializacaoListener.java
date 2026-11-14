package br.com.argousForms.infraestrutura;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Properties;

import jakarta.servlet.ServletContextEvent;
import jakarta.servlet.ServletContextListener;

import quatro.sql.PoolDeConexoes;
import quatro.sql.QtSQLException;
import quatro.util.ParametrosSistema;

public final class ArgousFormsInicializacaoListener implements ServletContextListener {

	@Override
	public void contextInitialized( ServletContextEvent evento ) {

		try {
			Path configuracao = localizarConfiguracao();
			Properties propriedades = new Properties();

			try ( InputStream entrada = Files.newInputStream( configuracao ) ) {
				propriedades.loadFromXML( entrada );
			}

			String diretorio = propriedades.getProperty( "diretorioInstalacao" );
			if( diretorio == null || diretorio.isBlank() ) {
				throw new IllegalStateException( "Informe diretorioInstalacao em argousforms.xml." );
			}

			Path instalacao = Path.of( diretorio.strip() );
			if( !instalacao.isAbsolute() ) {
				throw new IllegalStateException( "diretorioInstalacao precisa ser um caminho absoluto." );
			}

			Path parametros = instalacao.resolve( "conf" ).resolve( "parametros-agforms.xml" );
			if( !Files.isRegularFile( parametros ) || !Files.isReadable( parametros ) ) {
				throw new IllegalStateException( "Arquivo de parâmetros do ArgousForms não encontrado ou ilegível: " + parametros );
			}

			ParametrosSistema.setNmArquivoParametros( parametros.toString() );
			if( !ParametrosSistema.isParametrosInicializados() ) {
				throw new IllegalStateException( "O Quatro não conseguiu carregar os parâmetros do ArgousForms." );
			}
		} catch ( IOException | RuntimeException e ) {
			throw new IllegalStateException( "Falha na inicialização do ArgousForms: " + e.getMessage(), e );
		}
	}

	@Override
	public void contextDestroyed( ServletContextEvent evento ) {

		try {
			PoolDeConexoes.destroy();
		} catch ( QtSQLException e ) {
			evento.getServletContext().log( "Falha ao encerrar o pool de conexões do Quatro.", e );
		} finally {
			ParametrosSistema.destroy();
		}
	}

	private Path localizarConfiguracao() {

		String catalinaBase = System.getProperty( "catalina.base" );
		if( catalinaBase == null || catalinaBase.isBlank() ) {
			throw new IllegalStateException( "A propriedade catalina.base não está configurada." );
		}

		Path configuracao = Path.of( catalinaBase ).resolve( "conf" ).resolve( "argousforms.xml" );
		if( !Files.isRegularFile( configuracao ) || !Files.isReadable( configuracao ) ) {
			throw new IllegalStateException( "Configuração do ArgousForms não encontrada ou ilegível: " + configuracao );
		}

		return configuracao;
	}
}
