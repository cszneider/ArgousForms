package br.com.argousForms.cadastro;

import java.net.URI;
import java.time.Instant;
import java.time.ZoneId;
import java.time.zone.ZoneRulesException;

import org.json.JSONException;
import org.json.JSONObject;

import br.com.argousForms.api.ArgousFormsApiException;
import br.com.argousForms.auth.AutenticacaoLocalService;
import br.com.argousForms.model.negocio.cadastro.InstituicaoNegocio;
import br.com.argousForms.model.persistencia.cadastro.Instituicao;
import br.com.argousForms.model.persistencia.cadastro.InstituicaoLocalizador;
import quatro.sql.Conexao;
import quatro.sql.PoolDeConexoes;
import quatro.util.QtData;

public final class InstituicaoService {

	public JSONObject consultar( AutenticacaoLocalService.Usuario usuario ) throws Exception {

		exigirAdministrador( usuario );
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			Instituicao instituicao = InstituicaoLocalizador.buscaInstituicao( conexao, 1 );
			if( instituicao == null ) throw new ArgousFormsApiException( 503, "INSTITUICAO_NAO_CONFIGURADA", "A instituição ainda não está configurada." );
			return representar( instituicao );
		}
	}

	public JSONObject salvar( AutenticacaoLocalService.Usuario usuario, JSONObject dados ) throws Exception {

		exigirAdministrador( usuario );
		String nome = textoObrigatorio( dados, "nome", 200 );
		int diasLixeira = inteiroPositivo( dados, "diasLixeira" );
		int diasRetencaoLogIntegracao = inteiroPositivo( dados, "diasRetencaoLogIntegracao" );
		int diasSessaoMovel = inteiroPositivo( dados, "diasSessaoMovel" );
		int diasSessaoAbsoluta = inteiroPositivo( dados, "diasSessaoAbsoluta" );
		long tamanhoMaximo = longoPositivo( dados, "tamanhoMaximoArquivoBytes" );
		if( tamanhoMaximo > Integer.MAX_VALUE ) {
			throw new ArgousFormsApiException( 400, "LIMITE_INVALIDO", "O envio de arquivos aceita no máximo 2147483647 bytes." );
		}
		if( !( dados.opt( "permitirDestinatariosUnicos" ) instanceof Boolean permitirDestinatarios ) ) {
			throw new ArgousFormsApiException( 400, "POLITICA_INVALIDA", "Informe a política de destinatários únicos." );
		}
		String fuso = textoObrigatorio( dados, "fusoHorario", 64 );
		try { ZoneId.of( fuso ); }
		catch ( ZoneRulesException | IllegalArgumentException e ) {
			throw new ArgousFormsApiException( 400, "FUSO_INVALIDO", "Informe um fuso horário válido, como America/Sao_Paulo." );
		}
		String urlPrincipal = url( dados.optString( "urlWebhook", "" ) );
		String urlAlternativa = url( dados.optString( "urlWebhookAlternativo", "" ) );
		if( urlAlternativa != null && urlPrincipal == null ) {
			throw new ArgousFormsApiException( 400, "WEBHOOK_INVALIDO", "Configure o webhook principal antes do alternativo." );
		}

		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				Instituicao instituicao = InstituicaoLocalizador.buscaInstituicao( conexao, 1 );
				if( instituicao == null ) throw new ArgousFormsApiException( 503, "INSTITUICAO_NAO_CONFIGURADA", "A instituição ainda não está configurada." );
				instituicao.setDsNome( nome );
				instituicao.setNrDiasPermanenciaLixeira( diasLixeira );
				instituicao.setNrDiasRetencaoLogIntegracao( diasRetencaoLogIntegracao );
				instituicao.setNrDiasSessaoMovel( diasSessaoMovel );
				instituicao.setNrDiasSessaoAbsoluta( diasSessaoAbsoluta );
				instituicao.setNrTamanhoMaximoArquivoBytes( tamanhoMaximo );
				instituicao.setSnPermitirDestinatariosUnicos( permitirDestinatarios );
				instituicao.setCdFusoHorario( fuso );
				instituicao.setDsUrlWebhook( urlPrincipal );
				instituicao.setDsUrlWebhookAlternativo( urlAlternativa );
				instituicao.setDtAlteracao( new QtData( Instant.now().toEpochMilli() ) );
				new InstituicaoNegocio( conexao, instituicao ).altera();
				conexao.commit();
				return representar( instituicao );
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	private JSONObject representar( Instituicao instituicao ) throws JSONException {

		return new JSONObject().put( "nome", instituicao.getDsNome() )
			.put( "diasLixeira", instituicao.getNrDiasPermanenciaLixeira() )
			.put( "diasRetencaoLogIntegracao", instituicao.getNrDiasRetencaoLogIntegracao() )
			.put( "diasSessaoMovel", instituicao.getNrDiasSessaoMovel() )
			.put( "diasSessaoAbsoluta", instituicao.getNrDiasSessaoAbsoluta() )
			.put( "tamanhoMaximoArquivoBytes", instituicao.getNrTamanhoMaximoArquivoBytes() )
			.put( "permitirDestinatariosUnicos", instituicao.isSnPermitirDestinatariosUnicos() )
			.put( "fusoHorario", instituicao.getCdFusoHorario() )
			.put( "urlWebhook", instituicao.getDsUrlWebhook() == null ? "" : instituicao.getDsUrlWebhook() )
			.put( "urlWebhookAlternativo", instituicao.getDsUrlWebhookAlternativo() == null ? "" : instituicao.getDsUrlWebhookAlternativo() );
	}

	private String textoObrigatorio( JSONObject dados, String campo, int tamanhoMaximo ) throws ArgousFormsApiException {

		Object valor = dados.opt( campo );
		if( !( valor instanceof String texto ) || texto.isBlank() || texto.strip().length() > tamanhoMaximo ) {
			throw new ArgousFormsApiException( 400, "CAMPO_INVALIDO", "Informe um valor válido para " + campo + "." );
		}
		return texto.strip();
	}

	private int inteiroPositivo( JSONObject dados, String campo ) throws ArgousFormsApiException {

		try {
			int valor = Integer.parseInt( String.valueOf( dados.opt( campo ) ) );
			if( valor > 0 ) return valor;
		} catch ( NumberFormatException e ) { /* A mensagem abaixo identifica o campo. */ }
		throw new ArgousFormsApiException( 400, "NUMERO_INVALIDO", "Informe um inteiro positivo para " + campo + "." );
	}

	private long longoPositivo( JSONObject dados, String campo ) throws ArgousFormsApiException {

		try {
			long valor = Long.parseLong( String.valueOf( dados.opt( campo ) ) );
			if( valor > 0 ) return valor;
		} catch ( NumberFormatException e ) { /* A mensagem abaixo identifica o campo. */ }
		throw new ArgousFormsApiException( 400, "NUMERO_INVALIDO", "Informe um inteiro positivo para " + campo + "." );
	}

	private String url( String informada ) throws ArgousFormsApiException {

		String valor = informada == null ? "" : informada.strip();
		if( valor.isEmpty() ) return null;
		try {
			URI uri = URI.create( valor );
			boolean httpDesenvolvimento = "true".equalsIgnoreCase( System.getenv( "ARGOUSFORMS_WEBHOOK_HTTP_DESENVOLVIMENTO" ) );
			if( ( "https".equalsIgnoreCase( uri.getScheme() ) || ( httpDesenvolvimento && "http".equalsIgnoreCase( uri.getScheme() ) ) )
				&& uri.getHost() != null && uri.getUserInfo() == null && uri.getFragment() == null ) return valor;
		} catch ( IllegalArgumentException e ) { /* A mensagem abaixo informa o formato aceito. */ }
		throw new ArgousFormsApiException( 400, "WEBHOOK_INVALIDO", "Informe uma URL HTTPS válida, sem credenciais nem fragmento. HTTP é permitido somente no desenvolvimento configurado." );
	}

	private void exigirAdministrador( AutenticacaoLocalService.Usuario usuario ) throws ArgousFormsApiException {

		if( !usuario.papeis().contains( "ADMINISTRADOR_INSTITUICAO" ) ) {
			throw new ArgousFormsApiException( 403, "ACESSO_NEGADO", "Seu usuário não administra os parâmetros da instituição." );
		}
	}
}
