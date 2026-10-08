package br.com.argousForms.api;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.time.ZonedDateTime;
import java.util.Map;
import java.util.UUID;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.json.JSONException;
import org.json.JSONObject;
import org.json.JSONTokener;

import br.com.argousForms.cadastro.CadastroService;
import br.com.argousForms.cadastro.LimiteCadastro;
import quatro.sql.Conexao;
import quatro.sql.PoolDeConexoes;
import quatro.sql.Query;

@WebServlet( name = "ArgousFormsResolver", urlPatterns = "/argousforms.iarslvr" )
public final class ArgousFormsResolver extends HttpServlet {

	private static final long serialVersionUID = 1L;
	private static final int TAMANHO_MAXIMO_REQUEST = 64 * 1024;
	private final LimiteCadastro limiteCadastro = new LimiteCadastro();

	@Override
	protected void service( HttpServletRequest request, HttpServletResponse response ) throws ServletException, IOException {

		System.out.println( "Cheguei no service" );
		if( !"POST".equals( request.getMethod() ) ) {
			response.setHeader( "Allow", "POST" );
			ArgousFormsJson.enviarErro( response, 405, "METODO_NAO_PERMITIDO", "Utilize POST para acessar o resolver." );
			return;
		}

		super.service( request, response );
	}

	@Override
	protected void doPost( HttpServletRequest request, HttpServletResponse response ) throws IOException {

		System.out.println( "Cheguei no doPost" );
		request.setCharacterEncoding( "UTF-8" );

		try {
			JSONObject requisicao = lerRequisicao( request );
			String operacao = ArgousFormsJson.getStringObrigatoria( requisicao, "operacao", true );
			if( !( requisicao.opt( "dados" ) instanceof JSONObject dados ) ) {
				throw new ArgousFormsApiException( 400, "REQUISICAO_INVALIDA", "O campo dados deve ser um objeto JSON." );
			}

			System.out.println( "executa operacao" );
			executarOperacao( operacao, dados, request, response );
			System.out.println( "executei" );
		} catch ( ArgousFormsApiException e ) {
			System.out.println( "ArgousFormsApiException" );
			e.printStackTrace();
			
			registrarErroDesenvolvimento( "Erro da API: HTTP " + e.getStatusHttp() + ", código " + e.getCodigoErro(), e );
			ArgousFormsJson.enviarErro( response, e.getStatusHttp(), e.getCodigoErro(), e.getMessage() );
		} catch ( Exception e ) {
			System.out.println( "Exception" );
			e.printStackTrace();

			String referencia = UUID.randomUUID().toString();
			registrarErroDesenvolvimento( "Falha inesperada [" + referencia + "]", e );
			ArgousFormsJson.enviarErro( response, 500, "ERRO_INTERNO", "Não foi possível processar a requisição. Referência: " + referencia );
		}
	}

	private void registrarErroDesenvolvimento( String descricao, Throwable erro ) {

		if( !"true".equalsIgnoreCase( getServletContext().getInitParameter( "argousforms.logs.desenvolvimento" ) ) ) return;

		// Na execução padrão do Tomcat, stderr é direcionado ao catalina.out.
		synchronized( System.err ) {
			System.err.println( "[ArgousFormsResolver] " + descricao );
			erro.printStackTrace( System.err );
		}
	}

	private void executarOperacao( String operacao, JSONObject dados, HttpServletRequest request, HttpServletResponse response ) throws Exception {

		if( "PING".equals( operacao ) ) {
			ArgousFormsJson.enviarSucesso( response, 200, new JSONObject( Map.of( "dataHoraSistema", ZonedDateTime.now().toString() ) ) );
			return;
		}

		if( "VERIFICAR_BANCO".equals( operacao ) ) {
			verificarBanco();
			ArgousFormsJson.enviarSucesso( response, 200, new JSONObject( Map.of( "bancoDisponivel", true ) ) );
			return;
		}

		if( "VERIFICAR_ORIGEM_LOCAL".equals( operacao ) ) {
			verificarOrigemLocal();
			ArgousFormsJson.enviarSucesso( response, 200, new JSONObject( Map.of( "origemLocalPresente", true ) ) );
			return;
		}

		if( !"CADASTRAR_USUARIO".equals( operacao ) && !"CONFIRMAR_EMAIL".equals( operacao ) && !"REENVIAR_CONFIRMACAO".equals( operacao ) ) {
			throw new ArgousFormsApiException( 404, "OPERACAO_NAO_ENCONTRADA", "Operação não encontrada." );
		}

		// Não confiar em X-Forwarded-For fornecido diretamente pelo cliente.
		limiteCadastro.verificar( request.getRemoteAddr() );
		String email = ArgousFormsJson.getStringObrigatoria( dados, "email", true );
		if( "CONFIRMAR_EMAIL".equals( operacao ) ) {
			String codigo = ArgousFormsJson.getStringObrigatoria( dados, "codigo", false );
			String identificador = ArgousFormsJson.getStringObrigatoria( dados, "idConfirmacao", true );
			UUID id;
			try {
				id = UUID.fromString( identificador );
			} catch ( IllegalArgumentException e ) {
				throw new ArgousFormsApiException( 400, "CONFIRMACAO_INVALIDA", "Identificador de confirmação inválido." );
			}

			CadastroService.daInstalacao( getServletContext() ).confirmar( email, id, codigo );
			ArgousFormsJson.enviarSucesso( response, 200, new JSONObject( Map.of( "emailConfirmado", true, "autenticada", false ) ) );
			return;
		}

		String senha = ArgousFormsJson.getStringObrigatoria( dados, "senha", false );
		CadastroService.Resultado resultado;
		if( "CADASTRAR_USUARIO".equals( operacao ) ) {
			String nome = ArgousFormsJson.getStringObrigatoria( dados, "nome", true );
			resultado = CadastroService.daInstalacao( getServletContext() ).cadastrar( nome, email, senha );
		} else {
			resultado = CadastroService.daInstalacao( getServletContext() ).reenviar( email, senha );
		}

		ArgousFormsJson.enviarSucesso( response, 202, new JSONObject( Map.of(
			"idConfirmacao", resultado.idConfirmacao().toString(), "confirmacaoPendente", true,
			"emailEnviado", resultado.emailEnviado(), "mensagem", resultado.emailEnviado()
				? "Digite o código enviado ao seu e-mail."
				: "O cadastro permanece pendente, mas o envio não foi confirmado. Aguarde um minuto e solicite outro código." ) ) );
	}

	private void verificarBanco() throws ArgousFormsApiException {

		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			if( conexao == null ) throw new IllegalStateException( "O pool não retornou uma conexão." );
		} catch ( Exception e ) {
			registrarErroDesenvolvimento( "Falha na verificação da conexão com o banco", e );
			throw new ArgousFormsApiException( 503, "BANCO_INDISPONIVEL", "Não foi possível conectar ao banco de dados." );
		}
	}

	private void verificarOrigemLocal() throws ArgousFormsApiException {

		boolean encontrada;
		
		try ( Conexao conexao = PoolDeConexoes.getConexao(); Query query = new Query( conexao ) ) {
			query.setSQL( "select ID_ORIGEM_LOGIN from Cadastro.ORIGENS_LOGIN where CD_ORIGEM = :codigo" );
			query.setParameter( "codigo", 1 );
			query.executeQuery();
			encontrada = !query.isEmpty();
		} catch ( Exception e ) {
			registrarErroDesenvolvimento( "Falha na consulta da origem de login local", e );
			throw new ArgousFormsApiException( 503, "ORIGEM_LOCAL_CONSULTA_FALHOU", "Não foi possível consultar a origem de login local." );
		}

		if( !encontrada ) {
			throw new ArgousFormsApiException( 503, "ORIGEM_LOCAL_AUSENTE", "A origem de login local (CD_ORIGEM = 1) não foi cadastrada." );
		}
	}

	private JSONObject lerRequisicao( HttpServletRequest request ) throws IOException, ArgousFormsApiException {

		String contentType = request.getContentType();
		if( contentType == null || !"application/json".equalsIgnoreCase( contentType.split( ";", 2 )[ 0 ].strip() ) ) {
			throw new ArgousFormsApiException( 415, "CONTENT_TYPE_INVALIDO", "Utilize Content-Type application/json." );
		}

		if( request.getContentLengthLong() > TAMANHO_MAXIMO_REQUEST ) {
			throw payloadMuitoGrande();
		}

		byte[] corpo = request.getInputStream().readNBytes( TAMANHO_MAXIMO_REQUEST + 1 );
		if( corpo.length > TAMANHO_MAXIMO_REQUEST ) {
			throw payloadMuitoGrande();
		}

		try {
			String texto = StandardCharsets.UTF_8.newDecoder().onMalformedInput( CodingErrorAction.REPORT ).decode( ByteBuffer.wrap( corpo ) ).toString();
			JSONTokener tokener = new JSONTokener( texto );
			Object valor = tokener.nextValue();
			if( !( valor instanceof JSONObject json ) || tokener.nextClean() != 0 ) {
				throw new JSONException( "Objeto JSON esperado." );
			}

			return json;
		} catch ( JSONException | CharacterCodingException e ) {
			throw new ArgousFormsApiException( 400, "JSON_INVALIDO", "Informe um objeto JSON válido em UTF-8." );
		}
	}

	private ArgousFormsApiException payloadMuitoGrande() {
		return new ArgousFormsApiException( 413, "PAYLOAD_MUITO_GRANDE", "A requisição excede o limite de 64 KiB." );
	}
}
