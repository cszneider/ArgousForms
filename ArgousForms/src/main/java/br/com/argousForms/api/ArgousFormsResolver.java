package br.com.argousForms.api;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.json.JSONException;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;

import br.com.argousForms.cadastro.CadastroService;
import br.com.argousForms.cadastro.LimiteCadastro;
import br.com.argousForms.auth.AutenticacaoLocalService;
import br.com.argousForms.acessos.AcessosService;
import br.com.argousForms.organizacao.OrganizacaoService;
import quatro.sql.Conexao;
import quatro.sql.PoolDeConexoes;
import quatro.sql.Query;

@WebServlet( name = "ArgousFormsResolver", urlPatterns = "/argousforms.iarslvr" )
public final class ArgousFormsResolver extends HttpServlet {

	private static final long serialVersionUID = 1L;
	private static final int TAMANHO_MAXIMO_REQUEST = 64 * 1024;
	private final LimiteCadastro limiteCadastro = new LimiteCadastro();
	private final LimiteCadastro limiteLogin = new LimiteCadastro();
	private final AutenticacaoLocalService autenticacao = new AutenticacaoLocalService();
	private final AcessosService acessos = new AcessosService();
	private final OrganizacaoService organizacao = new OrganizacaoService();

	@Override
	protected void service( HttpServletRequest request, HttpServletResponse response ) throws ServletException, IOException {

		if( !"POST".equals( request.getMethod() ) ) {
			response.setHeader( "Allow", "POST" );
			ArgousFormsJson.enviarErro( response, 405, "METODO_NAO_PERMITIDO", "Utilize POST para acessar o resolver." );
			return;
		}

		super.service( request, response );
	}

	@Override
	protected void doPost( HttpServletRequest request, HttpServletResponse response ) throws IOException {

		request.setCharacterEncoding( "UTF-8" );

		try {
			JSONObject requisicao = lerRequisicao( request );
			String operacao = ArgousFormsJson.getStringObrigatoria( requisicao, "operacao", true );
			if( !( requisicao.opt( "dados" ) instanceof JSONObject dados ) ) {
				throw new ArgousFormsApiException( 400, "REQUISICAO_INVALIDA", "O campo dados deve ser um objeto JSON." );
			}

			executarOperacao( operacao, dados, request, response );
		} catch ( ArgousFormsApiException e ) {
			ArgousFormsJson.enviarErro( response, e.getStatusHttp(), e.getCodigoErro(), e.getMessage() );
		} catch ( Exception e ) {
			ArgousFormsJson.enviarErro( response, 500, "ERRO_INTERNO", "Não foi possível processar a requisição." );
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

		if( "ENTRAR_LOCAL".equals( operacao ) ) {
			limiteLogin.verificar( request.getRemoteAddr() );
			String emailLogin = ArgousFormsJson.getStringObrigatoria( dados, "email", true );
			String senhaLogin = ArgousFormsJson.getStringObrigatoria( dados, "senha", false );
			AutenticacaoLocalService.Sessao sessao = autenticacao.entrar( emailLogin, senhaLogin, request.getRemoteAddr(), request.getHeader( "User-Agent" ) );
			definirCookieSessao( request, response, sessao.token(), 604800 );
			ArgousFormsJson.enviarSucesso( response, 200, new JSONObject( Map.of( "idUsuario", sessao.idUsuario().toString(), "nome", sessao.nome(), "email", sessao.email(), "papeis", sessao.papeis(), "perfis", sessao.perfis() ) ) );
			return;
		}

		if( "SESSAO_ATUAL".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = autenticacao.consultar( tokenSessao( request ) );
			ArgousFormsJson.enviarSucesso( response, 200, new JSONObject( Map.of( "idUsuario", usuario.idUsuario().toString(), "nome", usuario.nome(), "email", usuario.email(), "papeis", usuario.papeis(), "perfis", usuario.perfis() ) ) );
			return;
		}

		if( "SAIR".equals( operacao ) ) {
			autenticacao.sair( tokenSessao( request ) );
			definirCookieSessao( request, response, "", 0 );
			ArgousFormsJson.enviarSucesso( response, 200, new JSONObject( Map.of( "sessaoEncerrada", true ) ) );
			return;
		}

		if( "LISTAR_ACESSOS".equals( operacao ) || "SALVAR_PAPEL".equals( operacao ) || "SALVAR_PERFIL".equals( operacao ) || "REMOVER_PAPEL".equals( operacao ) || "REMOVER_PERFIL".equals( operacao ) ) {
			exigirGestorAcessos( request );
			if( "LISTAR_ACESSOS".equals( operacao ) ) {
				ArgousFormsJson.enviarSucesso( response, 200, acessos.listar() );
				return;
			}
			if( "REMOVER_PAPEL".equals( operacao ) || "REMOVER_PERFIL".equals( operacao ) ) {
				UUID id = uuidObrigatorio( dados, "id" );
				String acao = "REMOVER_PAPEL".equals( operacao ) ? acessos.removerPapel( id ) : acessos.removerPerfil( id );
				ArgousFormsJson.enviarSucesso( response, 200, new JSONObject( Map.of( "acao", acao ) ) );
				return;
			}
			UUID id = uuidOpcional( dados, "id" );
			String codigo = ArgousFormsJson.getStringObrigatoria( dados, "codigo", true );
			String nome = ArgousFormsJson.getStringObrigatoria( dados, "nome", true );
			String descricao = ArgousFormsJson.getStringObrigatoria( dados, "descricao", true );
			Object ativo = dados.opt( "ativo" );
			if( !( ativo instanceof Boolean ) ) throw new ArgousFormsApiException( 400, "ESTADO_INVALIDO", "Informe se o registro está ativo." );
			if( "SALVAR_PAPEL".equals( operacao ) ) {
				ArgousFormsJson.enviarSucesso( response, 200, new JSONObject( Map.of( "idPapel", acessos.salvarPapel( id, codigo, nome, descricao, (Boolean) ativo ).toString() ) ) );
				return;
			}
			if( !( dados.opt( "papeis" ) instanceof JSONArray papeis ) ) throw new ArgousFormsApiException( 400, "PAPEIS_INVALIDOS", "Informe a lista de papéis do perfil." );
			List<UUID> idsPapeis = new ArrayList<>();
			for( int indice = 0; indice < papeis.length(); indice++ ) {
				if( !( papeis.get( indice ) instanceof String texto ) ) throw new ArgousFormsApiException( 400, "PAPEIS_INVALIDOS", "Informe identificadores válidos para os papéis." );
				try {
					idsPapeis.add( UUID.fromString( texto ) );
				} catch ( IllegalArgumentException e ) {
					throw new ArgousFormsApiException( 400, "PAPEIS_INVALIDOS", "Informe identificadores válidos para os papéis." );
				}
			}
			ArgousFormsJson.enviarSucesso( response, 200, new JSONObject( Map.of( "idPerfil", acessos.salvarPerfil( id, codigo, nome, descricao, (Boolean) ativo, idsPapeis ).toString() ) ) );
			return;
		}

		if( "LISTAR_ORGANIZACAO".equals( operacao ) || "SALVAR_GRUPO".equals( operacao ) || "CRIAR_TAG".equals( operacao ) || "ALTERAR_TAG".equals( operacao ) ) {
			exigirGestorGruposTags( request );
			if( "LISTAR_ORGANIZACAO".equals( operacao ) ) {
				ArgousFormsJson.enviarSucesso( response, 200, organizacao.listar() );
				return;
			}
			if( "SALVAR_GRUPO".equals( operacao ) ) {
				Integer idGrupo = null;
				if( dados.has( "idGrupo" ) && !dados.isNull( "idGrupo" ) ) {
					Object valor = dados.get( "idGrupo" );
					if( !( valor instanceof Integer id ) || id <= 0 ) throw new ArgousFormsApiException( 400, "GRUPO_INVALIDO", "Identificador do grupo inválido." );
					idGrupo = id;
				}
				String nome = ArgousFormsJson.getStringObrigatoria( dados, "nome", true );
				Object ativo = dados.opt( "ativo" );
				if( !( ativo instanceof Boolean ) ) throw new ArgousFormsApiException( 400, "GRUPO_INVALIDO", "Informe se o grupo está ativo." );
				if( !( dados.opt( "tags" ) instanceof JSONArray tags ) ) throw new ArgousFormsApiException( 400, "TAGS_GRUPO_INVALIDAS", "Informe a lista de tags do grupo." );
				List<String> codigosTags = new ArrayList<>();
				for( int indice = 0; indice < tags.length(); indice++ ) {
					if( !( tags.get( indice ) instanceof String codigoTag ) ) throw new ArgousFormsApiException( 400, "TAGS_GRUPO_INVALIDAS", "Informe códigos válidos para as tags do grupo." );
					codigosTags.add( codigoTag );
				}
				ArgousFormsJson.enviarSucesso( response, 200, new JSONObject( Map.of( "idGrupo", organizacao.salvarGrupo( idGrupo, nome, (Boolean) ativo, codigosTags ) ) ) );
				return;
			}
			String codigo = ArgousFormsJson.getStringObrigatoria( dados, "codigo", true );
			Object grupo = dados.opt( "grupo" );
			Object usuario = dados.opt( "usuario" );
			Object vinculo = dados.opt( "vinculo" );
			if( !( grupo instanceof Boolean ) || !( usuario instanceof Boolean ) || !( vinculo instanceof Boolean ) ) {
				throw new ArgousFormsApiException( 400, "TIPO_TAG_INVALIDO", "Informe as três aplicações da tag como verdadeiro ou falso." );
			}
			String descricao = dados.optString( "descricao", "" );
			String codigoSalvo;
			if( "ALTERAR_TAG".equals( operacao ) ) {
				Object ativa = dados.opt( "ativa" );
				if( !( ativa instanceof Boolean ) ) throw new ArgousFormsApiException( 400, "TAG_INVALIDA", "Informe se a tag está ativa." );
				codigoSalvo = organizacao.alterarTag( codigo, descricao, (Boolean) grupo, (Boolean) usuario, (Boolean) vinculo, (Boolean) ativa );
			} else {
				codigoSalvo = organizacao.criarTag( codigo, descricao, (Boolean) grupo, (Boolean) usuario, (Boolean) vinculo );
			}
			ArgousFormsJson.enviarSucesso( response, 200, new JSONObject( Map.of( "codigo", codigoSalvo ) ) );
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
			throw new ArgousFormsApiException( 503, "BANCO_INDISPONIVEL", "Não foi possível conectar ao banco de dados." );
		}
	}

	private void exigirGestorGruposTags( HttpServletRequest request ) throws Exception {

		AutenticacaoLocalService.Usuario usuario = autenticacao.consultar( tokenSessao( request ) );
		if( !usuario.papeis().contains( "GESTOR_GRUPOS_TAGS" ) ) {
			throw new ArgousFormsApiException( 403, "ACESSO_NEGADO", "Seu usuário não pode administrar grupos e tags." );
		}
	}

	private void exigirGestorAcessos( HttpServletRequest request ) throws Exception {

		AutenticacaoLocalService.Usuario usuario = autenticacao.consultar( tokenSessao( request ) );
		if( !usuario.papeis().contains( "GESTOR_ACESSOS" ) ) {
			throw new ArgousFormsApiException( 403, "ACESSO_NEGADO", "Seu usuário não pode administrar papéis e perfis." );
		}
	}

	private UUID uuidObrigatorio( JSONObject dados, String campo ) throws ArgousFormsApiException {

		UUID id = uuidOpcional( dados, campo );
		if( id == null ) throw new ArgousFormsApiException( 400, "IDENTIFICADOR_INVALIDO", "Informe um identificador válido." );
		return id;
	}

	private UUID uuidOpcional( JSONObject dados, String campo ) throws ArgousFormsApiException {

		Object valor = dados.opt( campo );
		if( valor == null || JSONObject.NULL.equals( valor ) ) return null;
		if( !( valor instanceof String texto ) ) throw new ArgousFormsApiException( 400, "IDENTIFICADOR_INVALIDO", "Informe um identificador válido." );
		try {
			return UUID.fromString( texto );
		} catch ( IllegalArgumentException e ) {
			throw new ArgousFormsApiException( 400, "IDENTIFICADOR_INVALIDO", "Informe um identificador válido." );
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

	private String tokenSessao( HttpServletRequest request ) {

		Cookie[] cookies = request.getCookies();
		if( cookies == null ) return null;
		for( Cookie cookie : cookies ) {
			if( "AF_SESSAO".equals( cookie.getName() ) ) return cookie.getValue();
		}
		return null;
	}

	private void definirCookieSessao( HttpServletRequest request, HttpServletResponse response, String token, int validade ) {

		String seguro = request.isSecure() ? "; Secure" : "";
		response.addHeader( "Set-Cookie", "AF_SESSAO=" + token + "; Path=" + request.getContextPath() + "; Max-Age=" + validade + "; HttpOnly; SameSite=Strict" + seguro );
	}
}
