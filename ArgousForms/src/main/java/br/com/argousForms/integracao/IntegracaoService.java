package br.com.argousForms.integracao;

import java.net.URI;
import java.io.InputStream;
import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.Iterator;
import java.util.List;
import java.util.UUID;

import jakarta.servlet.ServletContext;

import org.bson.Document;
import org.json.JSONArray;
import org.json.JSONObject;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.IndexOptions;
import com.mongodb.client.model.ReplaceOptions;
import static com.mongodb.client.model.Filters.eq;
import static com.mongodb.client.model.Filters.and;
import static com.mongodb.client.model.Filters.gt;
import static com.mongodb.client.model.Indexes.ascending;

import br.com.argousForms.api.ArgousFormsApiException;
import br.com.argousForms.auth.AutenticacaoLocalService;
import br.com.argousForms.documentos.MongoArmazenamento;
import quatro.sql.Conexao;
import quatro.sql.PoolDeConexoes;

/** GET_DATA: consulta assinada e cache por Protocolo, sem executar scripts de formulário. */
public final class IntegracaoService {

	private static volatile boolean indiceCachePreparado;
	private final HttpClient cliente = HttpClient.newBuilder().connectTimeout( Duration.ofSeconds( 3 ) )
		.followRedirects( HttpClient.Redirect.NEVER ).build();

	public JSONObject listarProtocolos( AutenticacaoLocalService.Usuario usuario ) throws Exception {

		exigirDesenvolvedor( usuario );
		JSONArray itens = new JSONArray();
		try ( Conexao conexao = PoolDeConexoes.getConexao(); PreparedStatement consulta = conexao.getConnection().prepareStatement( "select distinct p.ID_PROTOCOLO, p.DS_TITULO from Processos.PROTOCOLOS p join Processos.PROTOCOLO_VERSOES v on v.ID_PROTOCOLO = p.ID_PROTOCOLO where v.NR_VERSAO > 0 order by p.DS_TITULO" ); ResultSet linhas = consulta.executeQuery() ) {
			while( linhas.next() ) itens.put( new JSONObject().put( "id", linhas.getString( 1 ) ).put( "titulo", linhas.getString( 2 ) ) );
		}
		return new JSONObject().put( "protocolos", itens );
	}

	public JSONObject documentacao( AutenticacaoLocalService.Usuario usuario ) throws Exception {

		exigirDesenvolvedor( usuario );
		try ( InputStream arquivo = IntegracaoService.class.getResourceAsStream( "/integracao/WEBHOOK.md" ) ) {
			if( arquivo == null ) throw new IllegalStateException( "Documentação de integração não encontrada." );
			return new JSONObject().put( "markdown", new String( arquivo.readAllBytes(), StandardCharsets.UTF_8 ) );
		}
	}

	public JSONObject testar( AutenticacaoLocalService.Usuario usuario, ServletContext contexto, UUID idProtocolo, String codigo, JSONObject parametros ) throws Exception {

		exigirDesenvolvedor( usuario );
		if( codigo == null || !codigo.matches( "[A-Za-z][A-Za-z0-9_.-]{0,99}" ) || parametros == null ) {
			throw new ArgousFormsApiException( 400, "INTEGRACAO_INVALIDA", "Informe o código e os parâmetros JSON da consulta." );
		}

		String principal;
		String alternativo;
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			if( idProtocolo != null ) verificarProtocolo( conexao, idProtocolo );
			try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select DS_URL_WEBHOOK, DS_URL_WEBHOOK_ALTERNATIVO from Cadastro.INSTITUICAO where ID_INSTITUICAO = 1" ); ResultSet linha = consulta.executeQuery() ) {
				if( !linha.next() ) throw new ArgousFormsApiException( 503, "INSTITUICAO_NAO_CONFIGURADA", "A instituição ainda não está configurada." );
				principal = linha.getString( 1 );
				alternativo = linha.getString( 2 );
			}
		}
		if( principal == null || principal.isBlank() ) throw new ArgousFormsApiException( 503, "WEBHOOK_NAO_CONFIGURADO", "Configure o webhook da instituição." );
		if( idProtocolo == null ) return consultarWebhook( principal, alternativo, null, codigo, parametros );

		String chaveCache = WebhookHmac.sha256( ( idProtocolo + "\n" + codigo + "\n" + canonico( parametros ) ).getBytes( StandardCharsets.UTF_8 ) );
		try ( MongoArmazenamento mongo = new MongoArmazenamento( contexto ) ) {
			MongoCollection<Document> colecao = mongo.colecaoCacheIntegracao();
			prepararIndiceCache( colecao );
			Document existente = colecao.find( eq( "_id", chaveCache ) ).first();
			if( existente != null && existente.getDate( "expiresAt" ) != null && existente.getDate( "expiresAt" ).toInstant().isAfter( Instant.now() ) ) {
				return new JSONObject( existente.getString( "resposta" ) ).put( "origem", "cache" );
			}

			JSONObject resposta = consultarWebhook( principal, alternativo, idProtocolo, codigo, parametros );
			Instant validade = validade( resposta );
			if( resposta.optBoolean( "status" ) && validade != null && validade.isAfter( Instant.now() ) ) {
				Document registro = new Document( "_id", chaveCache ).append( "idProtocolo", idProtocolo.toString() )
					.append( "codigo", codigo ).append( "resposta", resposta.toString() ).append( "expiresAt", Date.from( validade ) );
				colecao.replaceOne( eq( "_id", chaveCache ), registro, new ReplaceOptions().upsert( true ) );
			}
			return resposta;
		}
	}

	public JSONObject listarCache( AutenticacaoLocalService.Usuario usuario, ServletContext contexto, UUID idProtocolo ) throws Exception {

		exigirDesenvolvedor( usuario );
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) { verificarProtocolo( conexao, idProtocolo ); }
		JSONArray itens = new JSONArray();
		try ( MongoArmazenamento mongo = new MongoArmazenamento( contexto ) ) {
			MongoCollection<Document> colecao = mongo.colecaoCacheIntegracao();
			prepararIndiceCache( colecao );
			for( Document entrada : colecao.find( and( eq( "idProtocolo", idProtocolo.toString() ), gt( "expiresAt", new Date() ) ) ).sort( ascending( "expiresAt" ) ).limit( 100 ) ) {
				itens.put( new JSONObject().put( "idCache", entrada.getString( "_id" ) ).put( "codigo", entrada.getString( "codigo" ) )
					.put( "validadeCacheEm", entrada.getDate( "expiresAt" ).toInstant().toString() )
					.put( "resposta", new JSONObject( entrada.getString( "resposta" ) ) ) );
			}
		}
		return new JSONObject().put( "itens", itens ).put( "limite", 100 );
	}

	public JSONObject invalidarCache( AutenticacaoLocalService.Usuario usuario, ServletContext contexto, UUID idProtocolo, String idCache ) throws Exception {

		exigirDesenvolvedor( usuario );
		if( idCache == null || !idCache.matches( "[0-9a-f]{64}" ) ) throw new ArgousFormsApiException( 400, "CACHE_INVALIDO", "Informe uma entrada de cache válida." );
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) { verificarProtocolo( conexao, idProtocolo ); }
		try ( MongoArmazenamento mongo = new MongoArmazenamento( contexto ) ) {
			long excluidos = mongo.colecaoCacheIntegracao().deleteOne( and( eq( "_id", idCache ), eq( "idProtocolo", idProtocolo.toString() ) ) ).getDeletedCount();
			return new JSONObject().put( "invalidado", excluidos == 1 );
		}
	}

	private void verificarProtocolo( Conexao conexao, UUID idProtocolo ) throws Exception {

		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select 1 from Processos.PROTOCOLOS where ID_PROTOCOLO = ?" ) ) {
			consulta.setObject( 1, idProtocolo );
			try ( ResultSet linha = consulta.executeQuery() ) {
				if( !linha.next() ) throw new ArgousFormsApiException( 404, "PROTOCOLO_NAO_ENCONTRADO", "Protocolo não encontrado." );
			}
		}
	}

	private JSONObject consultarWebhook( String principal, String alternativo, UUID idProtocolo, String codigo, JSONObject parametros ) throws Exception {

		String id = UUID.randomUUID().toString();
		try {
			try { return chamar( principal, id, idProtocolo, codigo, parametros ).put( "origem", "webhook" ); }
			catch ( IOException e ) {
				if( alternativo == null || alternativo.isBlank() ) throw e;
				return chamar( alternativo, id, idProtocolo, codigo, parametros ).put( "origem", "webhook" );
			}
		} catch ( IOException e ) {
			throw new ArgousFormsApiException( 502, "WEBHOOK_INDISPONIVEL", "O webhook não respondeu. Referência: " + id );
		} catch ( SecurityException e ) {
			throw new ArgousFormsApiException( 502, "WEBHOOK_ASSINATURA_INVALIDA", "A assinatura da resposta do webhook é inválida. Referência: " + id );
		}
	}

	private void prepararIndiceCache( MongoCollection<Document> colecao ) {

		if( indiceCachePreparado ) return;
		synchronized ( IntegracaoService.class ) {
			if( indiceCachePreparado ) return;
			colecao.createIndex( ascending( "expiresAt" ), new IndexOptions().expireAfter( 0L, java.util.concurrent.TimeUnit.SECONDS ) );
			colecao.createIndex( ascending( "idProtocolo", "expiresAt" ) );
			indiceCachePreparado = true;
		}
	}

	private JSONObject chamar( String endereco, String id, UUID idProtocolo, String codigo, JSONObject parametros ) throws Exception {

		URI url = URI.create( endereco );
		boolean httpDesenvolvimento = "true".equalsIgnoreCase( System.getenv( "ARGOUSFORMS_WEBHOOK_HTTP_DESENVOLVIMENTO" ) );
		if( url.getHost() == null || url.getUserInfo() != null || url.getFragment() != null || !( "https".equalsIgnoreCase( url.getScheme() ) || ( httpDesenvolvimento && "http".equalsIgnoreCase( url.getScheme() ) ) ) ) {
			throw new ArgousFormsApiException( 400, "WEBHOOK_INSEGURO", "O webhook deve usar HTTPS. HTTP é permitido somente no desenvolvimento configurado." );
		}
		WebhookHmac hmac = new WebhookHmac();
		String instante = Instant.now().toString();
		JSONObject conteudo = new JSONObject().put( "acao", "GET_DATA" ).put( "idRequisicao", id )
			.put( "codigo", codigo ).put( "parametros", parametros );
		if( idProtocolo != null ) conteudo.put( "idProtocolo", idProtocolo.toString() );
		byte[] corpo = conteudo.toString().getBytes( StandardCharsets.UTF_8 );
		HttpRequest requisicao = HttpRequest.newBuilder( url ).timeout( Duration.ofSeconds( 10 ) )
			.header( "Content-Type", "application/json; charset=utf-8" ).header( "X-Argous-Request-Id", id )
			.header( "X-Argous-Timestamp", instante ).header( "X-Argous-Signature", hmac.assinar( "REQUISICAO", id, instante, corpo ) )
			.POST( HttpRequest.BodyPublishers.ofByteArray( corpo ) ).build();
		HttpResponse<InputStream> resposta = cliente.send( requisicao, HttpResponse.BodyHandlers.ofInputStream() );
		byte[] corpoResposta;
		try ( InputStream fluxo = resposta.body() ) { corpoResposta = fluxo.readNBytes( 1024 * 1024 + 1 ); }
		if( corpoResposta.length > 1024 * 1024 ) throw new ArgousFormsApiException( 502, "WEBHOOK_RESPOSTA_GRANDE", "A resposta do webhook excedeu 1 MB." );
		if( resposta.statusCode() >= 500 ) throw new IOException( "Webhook indisponível." );
		if( resposta.statusCode() != 200 ) throw new ArgousFormsApiException( 502, "WEBHOOK_FALHOU", "O webhook respondeu com HTTP " + resposta.statusCode() + "." );
		hmac.verificarResposta( id, resposta.headers().firstValue( "X-Argous-Request-Id" ).orElse( null ),
			resposta.headers().firstValue( "X-Argous-Timestamp" ).orElse( null ),
			resposta.headers().firstValue( "X-Argous-Signature" ).orElse( null ), corpoResposta );
		JSONObject dados = new JSONObject( new String( corpoResposta, StandardCharsets.UTF_8 ) );
		if( !id.equals( dados.optString( "idRequisicao" ) ) || !codigo.equals( dados.optString( "codigo" ) ) || !( dados.opt( "status" ) instanceof Boolean ) ) {
			throw new ArgousFormsApiException( 502, "WEBHOOK_RESPOSTA_INVALIDA", "O webhook devolveu uma resposta incompatível com a requisição." );
		}
		if( dados.optBoolean( "status" ) && !( dados.opt( "dados" ) instanceof JSONObject ) ) {
			throw new ArgousFormsApiException( 502, "WEBHOOK_RESPOSTA_INVALIDA", "A resposta de sucesso precisa conter dados JSON." );
		}
		return dados;
	}

	private Instant validade( JSONObject resposta ) throws ArgousFormsApiException {

		String informada = resposta.optString( "validadeCacheEm", "" );
		if( informada.isBlank() ) return null;
		try { return Instant.parse( informada ); }
		catch ( Exception e ) { throw new ArgousFormsApiException( 502, "WEBHOOK_VALIDADE_INVALIDA", "A validade do cache deve ser um instante ISO-8601." ); }
	}

	private String canonico( Object valor ) throws Exception {

		if( valor instanceof JSONObject objeto ) {
			List<String> chaves = new ArrayList<>();
			Iterator<?> iterador = objeto.keys();
			while( iterador.hasNext() ) chaves.add( String.valueOf( iterador.next() ) );
			chaves.sort( String::compareTo );
			List<String> partes = new ArrayList<>();
			for( String chave : chaves ) partes.add( JSONObject.quote( chave ) + ":" + canonico( objeto.opt( chave ) ) );
			return "{" + String.join( ",", partes ) + "}";
		}
		if( valor instanceof JSONArray lista ) {
			List<String> partes = new ArrayList<>();
			for( int i = 0; i < lista.length(); i++ ) partes.add( canonico( lista.opt( i ) ) );
			return "[" + String.join( ",", partes ) + "]";
		}
		return JSONObject.valueToString( valor );
	}

	private void exigirDesenvolvedor( AutenticacaoLocalService.Usuario usuario ) throws ArgousFormsApiException {

		if( !usuario.papeis().contains( "DESENVOLVEDOR" ) ) throw new ArgousFormsApiException( 403, "ACESSO_NEGADO", "O papel DESENVOLVEDOR é necessário." );
	}
}
