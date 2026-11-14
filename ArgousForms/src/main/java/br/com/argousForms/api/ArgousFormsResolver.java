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
import java.util.logging.Level;
import java.util.logging.Logger;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.json.JSONException;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;

import br.com.argousForms.cadastro.CadastroService;
import br.com.argousForms.cadastro.InstituicaoService;
import br.com.argousForms.cadastro.LimiteCadastro;
import br.com.argousForms.auth.AutenticacaoLocalService;
import br.com.argousForms.acessos.AcessosService;
import br.com.argousForms.organizacao.OrganizacaoService;
import br.com.argousForms.organizacao.VinculosOrganizacaoService;
import br.com.argousForms.documentos.DocumentosService;
import br.com.argousForms.documentos.MongoArmazenamento;
import br.com.argousForms.documentos.UploadArquivoService;
import br.com.argousForms.pessoas.PessoasUsuariosService;
import br.com.argousForms.pessoas.ManutencaoUsuarioService;
import br.com.argousForms.protocolos.ProtocolosService;
import br.com.argousForms.protocolos.NovaVersaoProtocoloService;
import br.com.argousForms.protocolos.GestoresProtocoloService;
import br.com.argousForms.processos.ForumProcessoService;
import br.com.argousForms.processos.ProcessosService;
import br.com.argousForms.processos.PreenchimentoEtapaService;
import br.com.argousForms.processos.NotificacoesService;
import br.com.argousForms.protocolos.FluxoProtocolosService;
import br.com.argousForms.protocolos.VariaveisSistema;
import br.com.argousForms.protocolos.VariaveisInstituicaoService;
import br.com.argousForms.recursos.RecursosService;
import br.com.argousForms.integracao.IntegracaoService;
import br.com.argousForms.integracao.HistoricoIntegracaoService;
import br.com.argousForms.integracao.ChavesWebhookService;
import quatro.sql.Conexao;
import quatro.sql.PoolDeConexoes;
import quatro.sql.Query;

@WebServlet( name = "ArgousFormsResolver", urlPatterns = "/argousforms.iarslvr" )
public final class ArgousFormsResolver extends HttpServlet {

	private static final long serialVersionUID = 1L;
	private static final int TAMANHO_MAXIMO_REQUEST = 64 * 1024;
	private static final Logger LOG = Logger.getLogger( ArgousFormsResolver.class.getName() );
	private final LimiteCadastro limiteCadastro = new LimiteCadastro();
	private final LimiteCadastro limiteLogin = new LimiteCadastro();
	private final AutenticacaoLocalService autenticacao = new AutenticacaoLocalService();
	private final AcessosService acessos = new AcessosService();
	private final OrganizacaoService organizacao = new OrganizacaoService();
	private final VinculosOrganizacaoService vinculosOrganizacao = new VinculosOrganizacaoService();
	private final DocumentosService documentos = new DocumentosService();
	private final UploadArquivoService uploadArquivo = new UploadArquivoService();
	private final PessoasUsuariosService pessoasUsuarios = new PessoasUsuariosService();
	private final ManutencaoUsuarioService manutencaoUsuarios = new ManutencaoUsuarioService();
	private final ProtocolosService protocolos = new ProtocolosService();
	private final NovaVersaoProtocoloService novaVersaoProtocolo = new NovaVersaoProtocoloService();
	private final GestoresProtocoloService gestoresProtocolo = new GestoresProtocoloService();
	private final ProcessosService processos = new ProcessosService();
	private final NotificacoesService notificacoes = new NotificacoesService();
	private final FluxoProtocolosService fluxoProtocolos = new FluxoProtocolosService();
	private final VariaveisInstituicaoService variaveisInstituicao = new VariaveisInstituicaoService();
	private final RecursosService recursos = new RecursosService();
	private final InstituicaoService instituicao = new InstituicaoService();
	private final IntegracaoService integracao = new IntegracaoService();
	private final HistoricoIntegracaoService historicoIntegracao = new HistoricoIntegracaoService();
	private final ChavesWebhookService chavesWebhook = new ChavesWebhookService();

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
		String operacao = "REQUISICAO";

		try {
			JSONObject requisicao = lerRequisicao( request );
			operacao = ArgousFormsJson.getStringObrigatoria( requisicao, "operacao", true );
			if( !( requisicao.opt( "dados" ) instanceof JSONObject dados ) ) {
				throw new ArgousFormsApiException( 400, "REQUISICAO_INVALIDA", "O campo dados deve ser um objeto JSON." );
			}

			executarOperacao( operacao, dados, request, response );
		} catch ( ArgousFormsApiException e ) {
			ArgousFormsJson.enviarErro( response, e.getStatusHttp(), e.getCodigoErro(), e.getMessage() );
		} catch ( Exception e ) {
			LOG.log( Level.SEVERE, "Falha inesperada na operação " + operacao, e );
			ArgousFormsJson.enviarErro( response, 500, "ERRO_INTERNO", "Não foi possível processar a requisição." );
		}
	}

	private void executarOperacao( String operacao, JSONObject dados, HttpServletRequest request, HttpServletResponse response ) throws Exception {

		if( "DOCUMENTACAO_INTEGRACAO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, integracao.documentacao( usuario ) );
			return;
		}

		if( "LISTAR_PROTOCOLOS_INTEGRACAO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, integracao.listarProtocolos( usuario ) );
			return;
		}

		if( "TESTAR_GET_DATA".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			UUID idProtocolo = dados.has( "idProtocolo" ) && !dados.isNull( "idProtocolo" ) && !dados.optString( "idProtocolo", "" ).isBlank()
				? uuidObrigatorio( dados, "idProtocolo" ) : null;
			ArgousFormsJson.enviarSucesso( response, 200, integracao.testar( usuario, getServletContext(), idProtocolo, dados.optString( "codigo", "" ), dados.optJSONObject( "parametros" ) ) );
			return;
		}

		if( "LISTAR_CACHE_INTEGRACAO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, integracao.listarCache( usuario, getServletContext(), uuidObrigatorio( dados, "idProtocolo" ) ) );
			return;
		}

		if( "INVALIDAR_CACHE_INTEGRACAO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, integracao.invalidarCache( usuario, getServletContext(), uuidObrigatorio( dados, "idProtocolo" ), dados.optString( "idCache", "" ) ) );
			return;
		}

		if( "LISTAR_CONSULTAS_INTEGRACAO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			UUID idRequisicao = dados.optString( "idRequisicao", "" ).isBlank() ? null : uuidObrigatorio( dados, "idRequisicao" );
			ArgousFormsJson.enviarSucesso( response, 200, historicoIntegracao.listar( usuario, dados.optString( "codigo", "" ), idRequisicao, dados.optInt( "pagina", 0 ) ) );
			return;
		}

		if( "LISTAR_TENTATIVAS_INTEGRACAO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, historicoIntegracao.tentativas( usuario, uuidObrigatorio( dados, "idRequisicao" ) ) );
			return;
		}

		if( "LISTAR_CHAVES_WEBHOOK".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, chavesWebhook.listar( usuario ) );
			return;
		}

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
			definirCookieSessao( request, response, sessao.token(), sessao.segundosCookie() );
			ArgousFormsJson.enviarSucesso( response, 200, new JSONObject( Map.of( "idUsuario", sessao.idUsuario().toString(), "nome", sessao.nome(), "email", sessao.email(), "papeis", sessao.papeis(), "perfis", sessao.perfis() ) ) );
			return;
		}

		if( "SESSAO_ATUAL".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, new JSONObject( Map.of( "idUsuario", usuario.idUsuario().toString(), "nome", usuario.nome(), "email", usuario.email(), "papeis", usuario.papeis(), "perfis", usuario.perfis() ) ) );
			return;
		}

		if( "LISTAR_PROTOCOLOS".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, protocolos.listar( usuario ) );
			return;
		}

		if( "CRIAR_NOVA_VERSAO_PROTOCOLO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 201, novaVersaoProtocolo.criar( usuario, uuidObrigatorio( dados, "idProtocolo" ) ) );
			return;
		}

		if( "LISTAR_PROTOCOLOS_INICIAVEIS".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, processos.disponiveisParaIniciar( usuario ) );
			return;
		}

		if( "LISTAR_GESTORES_ELEGIVEIS".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, processos.gestoresElegiveis( usuario, uuidObrigatorio( dados, "idVersao" ) ) );
			return;
		}

		if( "INICIAR_PROCESSO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			UUID idGestor = dados.isNull( "idGestor" ) || !dados.has( "idGestor" ) ? null : uuidObrigatorio( dados, "idGestor" );
			ArgousFormsJson.enviarSucesso( response, 201, processos.iniciar( usuario, uuidObrigatorio( dados, "idVersao" ), idGestor ) );
			return;
		}

		if( "LISTAR_MEUS_PROCESSOS".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, processos.meusProcessos( usuario ) );
			return;
		}

		if( "CONSULTAR_PROCESSO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, processos.consultar( usuario, uuidObrigatorio( dados, "idProcesso" ) ) );
			return;
		}

		if( "COMENTAR_PROCESSO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 201, new ForumProcessoService().comentar( usuario, uuidObrigatorio( dados, "idProcesso" ), dados.optString( "conteudo", "" ) ) );
			return;
		}

		if( "CONCLUIR_PROCESSO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, processos.concluir( usuario, uuidObrigatorio( dados, "idProcesso" ) ) );
			return;
		}

		if( "LISTAR_MINHAS_TAREFAS".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, processos.minhasTarefas( usuario ) );
			return;
		}

		if( "LISTAR_NOTIFICACOES".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, notificacoes.listar( usuario, dados.optInt( "limite", 100 ) ) );
			return;
		}

		if( "MARCAR_NOTIFICACAO_LIDA".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, notificacoes.marcarLida( usuario, uuidObrigatorio( dados, "idNotificacao" ) ) );
			return;
		}

		if( "DECIDIR_RESPONSAVEL_NOTIFICACAO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, notificacoes.decidirResponsavel( usuario,
				uuidObrigatorio( dados, "idNotificacao" ), dados.optBoolean( "manter", false ) ) );
			return;
		}

		if( "CONSULTAR_ETAPA_PROCESSO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, new PreenchimentoEtapaService().consultar( usuario, uuidObrigatorio( dados, "idEtapa" ) ) );
			return;
		}

		if( "ASSUMIR_ETAPA_PROCESSO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, new PreenchimentoEtapaService().assumir( usuario, uuidObrigatorio( dados, "idEtapa" ) ) );
			return;
		}

		if( "SALVAR_ETAPA_PARCIAL".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, new PreenchimentoEtapaService().salvarParcial( usuario, uuidObrigatorio( dados, "idEtapa" ), dados.optJSONObject( "valores" ) ) );
			return;
		}

		if( "SALVAR_ETAPA_COMPLETA".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, new PreenchimentoEtapaService().salvarCompleto( usuario, uuidObrigatorio( dados, "idEtapa" ), dados.optJSONObject( "valores" ) ) );
			return;
		}

		if( "FINALIZAR_ETAPA_PROCESSO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, new PreenchimentoEtapaService().finalizar( usuario, getServletContext(), uuidObrigatorio( dados, "idEtapa" ) ) );
			return;
		}

		if( "CONSULTAR_PROTOCOLO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, protocolos.consultar( usuario, uuidObrigatorio( dados, "idProtocolo" ) ) );
			return;
		}

		if( "CONSULTAR_PROTOCOLO_PUBLICADO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			int numeroVersao = dados.getInt( "numeroVersao" );
			UUID idProtocolo = uuidObrigatorio( dados, "idProtocolo" );
			JSONObject publicado = protocolos.consultarPublicado( usuario, idProtocolo, numeroVersao );
			publicado.put( "fluxo", fluxoProtocolos.consultarPublicado( usuario, idProtocolo, numeroVersao ) );
			ArgousFormsJson.enviarSucesso( response, 200, publicado );
			return;
		}

		if( "CRIAR_PROTOCOLO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 201, protocolos.criar( usuario, dados.optString( "titulo", "" ), dados.optString( "descricao", "" ) ) );
			return;
		}

		if( "EXCLUIR_PROTOCOLO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, protocolos.excluir( usuario, uuidObrigatorio( dados, "idProtocolo" ) ) );
			return;
		}

		if( "DESCARTAR_RASCUNHO_PROTOCOLO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, protocolos.descartarRascunho( usuario, uuidObrigatorio( dados, "idProtocolo" ) ) );
			return;
		}

		if( "SALVAR_DADOS_PROTOCOLO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, protocolos.salvarDados( usuario, uuidObrigatorio( dados, "idProtocolo" ),
				dados.optString( "titulo", "" ), dados.optString( "descricao", "" ), dados.optBoolean( "gestorFinaliza", true ) ) );
			return;
		}

		if( "ASSOCIAR_PASTA_PROTOCOLO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, protocolos.associarPasta( usuario, uuidObrigatorio( dados, "idProtocolo" ), uuidOpcional( dados, "idPasta" ) ) );
			return;
		}

		if( "SALVAR_FORMULARIO_PROTOCOLO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			if( !( dados.opt( "campos" ) instanceof JSONArray campos ) ) {
				throw new ArgousFormsApiException( 400, "CAMPOS_INVALIDOS", "Informe a lista de campos do formulário." );
			}
			ArgousFormsJson.enviarSucesso( response, 200, protocolos.salvarFormulario( usuario, uuidObrigatorio( dados, "idProtocolo" ),
				uuidOpcional( dados, "idFormulario" ), dados.optString( "titulo", "" ), dados.optString( "descricao", "" ), campos ) );
			return;
		}

		if( "CATALOGO_DESTINATARIOS_PROTOCOLO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, fluxoProtocolos.catalogo( usuario ) );
			return;
		}

		if( "SALVAR_GESTORES_ELEGIVEIS_PROTOCOLO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			if( !( dados.opt( "regras" ) instanceof JSONArray regras ) ) throw new ArgousFormsApiException( 400, "REGRAS_INVALIDAS", "Informe a lista de gestores elegíveis." );
			ArgousFormsJson.enviarSucesso( response, 200, gestoresProtocolo.salvar( usuario, uuidObrigatorio( dados, "idProtocolo" ), regras ) );
			return;
		}

		if( "CATALOGO_VARIAVEIS_SISTEMA".equals( operacao ) ) {
			consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, new JSONObject().put( "variaveis", VariaveisSistema.catalogo() ) );
			return;
		}

		if( "LISTAR_RECURSOS_INSTITUICAO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, recursos.listarInstituicao( usuario ) );
			return;
		}

		if( "CONSULTAR_INSTITUICAO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, instituicao.consultar( usuario ) );
			return;
		}

		if( "SALVAR_INSTITUICAO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, instituicao.salvar( usuario, dados ) );
			return;
		}

		if( "ASSOCIAR_PASTA_RECURSOS_INSTITUICAO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, recursos.associarPastaInstituicao( usuario, uuidObrigatorio( dados, "idPasta" ) ) );
			return;
		}

		if( "REMOVER_RECURSO_INSTITUICAO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, recursos.removerInstituicao( usuario, uuidObrigatorio( dados, "idArquivoVersao" ) ) );
			return;
		}

		if( "ALTERAR_CODIGO_RECURSO_INSTITUICAO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, recursos.alterarCodigoInstituicao( usuario,
				uuidObrigatorio( dados, "idArquivoVersao" ), dados.optString( "codigo", "" ) ) );
			return;
		}

		if( "LISTAR_RECURSOS_PROTOCOLO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, recursos.listarProtocolo( usuario, uuidObrigatorio( dados, "idProtocolo" ) ) );
			return;
		}

		if( "REMOVER_RECURSO_PROTOCOLO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, recursos.removerProtocolo( usuario, uuidObrigatorio( dados, "idProtocolo" ), uuidObrigatorio( dados, "idProtocoloRecurso" ) ) );
			return;
		}

		if( "ALTERAR_CODIGO_RECURSO_PROTOCOLO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, recursos.alterarCodigoProtocolo( usuario,
				uuidObrigatorio( dados, "idProtocolo" ), uuidObrigatorio( dados, "idProtocoloRecurso" ), dados.optString( "codigo", "" ) ) );
			return;
		}

		if( "LISTAR_VARIAVEIS_INSTITUICAO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, variaveisInstituicao.listar( usuario ) );
			return;
		}

		if( "SALVAR_VARIAVEL_INSTITUICAO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			Integer id = idAtributo( dados, "idAtributo", false );
			Integer idPai = idAtributo( dados, "idAtributoPai", false );
			ArgousFormsJson.enviarSucesso( response, 200, variaveisInstituicao.salvar( usuario, id, idPai,
				dados.optString( "codigo", "" ), dados.optString( "tipo", "" ), dados.optString( "valor", "" ) ) );
			return;
		}

		if( "DEFINIR_VARIAVEL_INSTITUICAO_ATIVA".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			if( !( dados.opt( "ativa" ) instanceof Boolean ) ) {
				throw new ArgousFormsApiException( 400, "SITUACAO_INVALIDA", "Informe se a variável deve ficar ativa." );
			}
			ArgousFormsJson.enviarSucesso( response, 200, variaveisInstituicao.definirAtiva( usuario,
				idAtributo( dados, "idAtributo", true ), dados.optBoolean( "ativa" ) ) );
			return;
		}

		if( "CONSULTAR_FLUXO_PROTOCOLO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, fluxoProtocolos.consultar( usuario, uuidObrigatorio( dados, "idProtocolo" ) ) );
			return;
		}

		if( "PUBLICAR_PROTOCOLO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, protocolos.publicar( usuario, uuidObrigatorio( dados, "idProtocolo" ) ) );
			return;
		}

		if( "SALVAR_FLUXO_PROTOCOLO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, fluxoProtocolos.salvar( usuario, uuidObrigatorio( dados, "idProtocolo" ),
				dados.optJSONArray( "etapas" ), dados.optJSONArray( "ligacoes" ), dados.optString( "inicio", null ) ) );
			return;
		}

		if( "SALVAR_VARIAVEL_PROTOCOLO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, protocolos.salvarVariavel( usuario, uuidObrigatorio( dados, "idProtocolo" ),
				uuidOpcional( dados, "idVariavel" ), dados.optString( "codigo", "" ), dados.optString( "nome", "" ),
				dados.optString( "tipo", "" ), dados.optString( "descricao", "" ), dados.optJSONObject( "definicao" ) ) );
			return;
		}

		if( "ALTERAR_MODELO_PDF".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, protocolos.alterarModeloPdf( usuario,
				uuidObrigatorio( dados, "idProtocolo" ), uuidObrigatorio( dados, "idModelo" ),
				dados.optString( "titulo", "" ), dados.optString( "observacoes", "" ), diasVencimento( dados ) ) );
			return;
		}

		if( "SALVAR_MODELO_HTML".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, protocolos.salvarModeloHtml( usuario,
				uuidObrigatorio( dados, "idProtocolo" ), uuidOpcional( dados, "idModelo" ),
				dados.optString( "codigo", "" ), dados.optString( "titulo", "" ), dados.optString( "observacoes", "" ),
				dados.optString( "css", "" ), dados.optJSONArray( "partes" ), diasVencimento( dados ) ) );
			return;
		}

		if( "SALVAR_CAMPOS_MODELO_PDF".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, protocolos.salvarCamposPdf( usuario,
				uuidObrigatorio( dados, "idProtocolo" ), uuidObrigatorio( dados, "idModelo" ), dados.optJSONArray( "campos" ) ) );
			return;
		}

		if( "EXCLUIR_MODELO_PDF".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, protocolos.excluirModeloPdf( usuario,
				uuidObrigatorio( dados, "idProtocolo" ), uuidObrigatorio( dados, "idModelo" ) ) );
			return;
		}

		if( "EXCLUIR_MODELO_HTML".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, protocolos.excluirModeloHtml( usuario,
				uuidObrigatorio( dados, "idProtocolo" ), uuidObrigatorio( dados, "idModelo" ) ) );
			return;
		}

		if( "LISTAR_PASTA".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, documentos.listarPasta( usuario, uuidOpcional( dados, "idPasta" ) ) );
			return;
		}

		if( "CONSULTAR_ARQUIVO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, documentos.consultarArquivo( usuario, uuidObrigatorio( dados, "idArquivo" ) ) );
			return;
		}

		if( "SALVAR_ARQUIVO".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			String vencimento = dados.has( "vencimento" ) ? dados.optString( "vencimento", "" ) : null;
			ArgousFormsJson.enviarSucesso( response, 200, documentos.salvarArquivo( usuario, uuidObrigatorio( dados, "idArquivo" ),
				dados.optString( "titulo", "" ), dados.optString( "descricao", "" ), dados.optString( "classificacao", "" ), vencimento ) );
			return;
		}

		if( "CRIAR_PASTA".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			UUID idPai = uuidObrigatorio( dados, "idPastaPai" );
			String nome = ArgousFormsJson.getStringObrigatoria( dados, "nome", true );
			String descricao = dados.optString( "descricao", "" );
			ArgousFormsJson.enviarSucesso( response, 201, documentos.criarPasta( usuario, idPai, nome, descricao ) );
			return;
		}

		if( "ENVIAR_ARQUIVO_LIXEIRA".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, documentos.enviarArquivoLixeira( usuario, uuidObrigatorio( dados, "idArquivo" ) ) );
			return;
		}

		if( "CONTAR_PASTA_LIXEIRA".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, documentos.contarPastaLixeira( usuario, uuidObrigatorio( dados, "idPasta" ) ) );
			return;
		}

		if( "ENVIAR_PASTA_LIXEIRA".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			ArgousFormsJson.enviarSucesso( response, 200, documentos.enviarPastaLixeira( usuario, uuidObrigatorio( dados, "idPasta" ), dados.optInt( "quantidade", -1 ) ) );
			return;
		}

		if( "VERIFICAR_MONGODB".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			if( !usuario.papeis().contains( "CONSULTA_DOCUMENTOS" ) ) {
				throw new ArgousFormsApiException( 403, "ACESSO_NEGADO", "Seu usuário não pode consultar documentos." );
			}
			JSONObject estado = new JSONObject().put( "limiteBytes", uploadArquivo.limiteBytes() );
			try ( MongoArmazenamento mongo = new MongoArmazenamento( getServletContext() ) ) {
				mongo.verificar();
				estado.put( "disponivel", true );
			} catch ( Exception e ) {
				estado.put( "disponivel", false );
				estado.put( "mensagem", e instanceof ArgousFormsApiException ? e.getMessage() : "O armazenamento de arquivos não está respondendo." );
			}
			ArgousFormsJson.enviarSucesso( response, 200, estado );
			return;
		}

		if( "LISTAR_CONEXOES_ATIVAS".equals( operacao ) ) {
			JSONArray conexoes = new JSONArray();
			for( AutenticacaoLocalService.ConexaoAtiva conexao : autenticacao.listarConexoes( tokenSessao( request ) ) ) {
				JSONObject item = new JSONObject();
				item.put( "idLogin", conexao.idLogin().toString() );
				item.put( "inicio", conexao.inicio().toString() );
				item.put( "ultimoAcesso", conexao.ultimoAcesso() == null ? JSONObject.NULL : conexao.ultimoAcesso().toString() );
				item.put( "validade", conexao.validade().toString() );
				item.put( "enderecoIp", conexao.enderecoIp() );
				item.put( "agente", conexao.agente() );
				item.put( "atual", conexao.atual() );
				conexoes.put( item );
			}
			ArgousFormsJson.enviarSucesso( response, 200, new JSONObject().put( "conexoes", conexoes ) );
			return;
		}

		if( "ENCERRAR_CONEXAO".equals( operacao ) ) {
			UUID idLogin = uuidObrigatorio( dados, "idLogin" );
			boolean atual = autenticacao.encerrarConexao( tokenSessao( request ), idLogin );
			if( atual ) definirCookieSessao( request, response, "", 0 );
			ArgousFormsJson.enviarSucesso( response, 200, new JSONObject( Map.of( "conexaoEncerrada", true, "atual", atual ) ) );
			return;
		}

		if( "SAIR".equals( operacao ) ) {
			autenticacao.sair( tokenSessao( request ) );
			definirCookieSessao( request, response, "", 0 );
			ArgousFormsJson.enviarSucesso( response, 200, new JSONObject( Map.of( "sessaoEncerrada", true ) ) );
			return;
		}

		if( "ALTERAR_SENHA".equals( operacao ) ) {
			limiteLogin.verificar( request.getRemoteAddr() );
			String senhaAtual = ArgousFormsJson.getStringObrigatoria( dados, "senhaAtual", false );
			String senhaNova = ArgousFormsJson.getStringObrigatoria( dados, "senhaNova", false );
			autenticacao.alterarSenha( tokenSessao( request ), senhaAtual, senhaNova );
			ArgousFormsJson.enviarSucesso( response, 200, new JSONObject( Map.of( "senhaAlterada", true ) ) );
			return;
		}

		if( "LISTAR_PESSOAS_USUARIOS".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario usuario = consultarUsuario( request, response );
			if( !usuario.papeis().contains( "ADMINISTRADOR_USUARIOS" ) ) {
				throw new ArgousFormsApiException( 403, "ACESSO_NEGADO", "Seu usuário não pode consultar pessoas e usuários." );
			}
			ArgousFormsJson.enviarSucesso( response, 200, pessoasUsuarios.listar() );
			return;
		}

		if( "ACEITAR_CONVITE".equals( operacao ) ) {
			limiteCadastro.verificar( request.getRemoteAddr() );
			manutencaoUsuarios.confirmarConvite( ArgousFormsJson.getStringObrigatoria( dados, "email", true ),
				ArgousFormsJson.getStringObrigatoria( dados, "codigo", true ), ArgousFormsJson.getStringObrigatoria( dados, "senha", false ), getServletContext() );
			ArgousFormsJson.enviarSucesso( response, 200, new JSONObject().put( "conviteAceito", true ) );
			return;
		}

		if( "CATALOGO_CADASTRAL".equals( operacao ) || "CONSULTAR_CADASTRO".equals( operacao )
			|| "LOCALIZAR_PESSOA".equals( operacao ) || "SALVAR_PESSOA".equals( operacao ) || "SALVAR_USUARIO".equals( operacao )
			|| "SALVAR_MEUS_DADOS".equals( operacao ) || "CONFIRMAR_TROCA_EMAIL".equals( operacao )
			|| "REMOVER_USUARIO".equals( operacao ) || "REMOVER_PESSOA".equals( operacao ) ) {
			AutenticacaoLocalService.Usuario autenticado = consultarUsuario( request, response );
			boolean administrador = autenticado.papeis().contains( "ADMINISTRADOR_USUARIOS" );
			boolean autogestao = autenticado.papeis().contains( "AUTOGESTAO" );
			if( !administrador && !( autogestao && ( "CATALOGO_CADASTRAL".equals( operacao ) || "CONSULTAR_CADASTRO".equals( operacao )
				|| "SALVAR_MEUS_DADOS".equals( operacao ) || "CONFIRMAR_TROCA_EMAIL".equals( operacao ) ) ) ) {
				throw new ArgousFormsApiException( 403, "ACESSO_NEGADO", "Você não pode executar esta operação." );
			}
			if( "CATALOGO_CADASTRAL".equals( operacao ) ) {
				ArgousFormsJson.enviarSucesso( response, 200, pessoasUsuarios.catalogo() );
				return;
			}
			if( "CONSULTAR_CADASTRO".equals( operacao ) ) {
				UUID idUsuario = administrador ? uuidOpcional( dados, "idUsuario" ) : autenticado.idUsuario();
				UUID idPessoa = administrador && idUsuario == null ? uuidOpcional( dados, "idPessoa" ) : null;
				if( idUsuario == null && idPessoa == null ) idUsuario = autenticado.idUsuario();
				JSONObject cadastro = pessoasUsuarios.consultar( idPessoa, idUsuario );
				if( cadastro == null ) throw new ArgousFormsApiException( 404, "CADASTRO_NAO_ENCONTRADO", "Cadastro não encontrado." );
				ArgousFormsJson.enviarSucesso( response, 200, cadastro );
				return;
			}
			if( "LOCALIZAR_PESSOA".equals( operacao ) ) {
				ArgousFormsJson.enviarSucesso( response, 200, manutencaoUsuarios.localizar( dados.optInt( "idPais", -1 ), dados.optString( "numero", "" ) ) );
				return;
			}
			if( "SALVAR_PESSOA".equals( operacao ) ) {
				ArgousFormsJson.enviarSucesso( response, 200, new JSONObject().put( "idPessoa", manutencaoUsuarios.salvarPessoa( dados ).toString() ) );
				return;
			}
			if( "REMOVER_USUARIO".equals( operacao ) ) {
				manutencaoUsuarios.excluirUsuario( uuidObrigatorio( dados, "idUsuario" ), autenticado.idUsuario() );
				ArgousFormsJson.enviarSucesso( response, 200, new JSONObject().put( "removido", true ) );
				return;
			}
			if( "REMOVER_PESSOA".equals( operacao ) ) {
				manutencaoUsuarios.excluirPessoa( uuidObrigatorio( dados, "idPessoa" ) );
				ArgousFormsJson.enviarSucesso( response, 200, new JSONObject().put( "removido", true ) );
				return;
			}
			if( "SALVAR_USUARIO".equals( operacao ) || "SALVAR_MEUS_DADOS".equals( operacao ) ) {
				ManutencaoUsuarioService.Resultado resultado = manutencaoUsuarios.salvar( dados, autenticado.idUsuario(), "SALVAR_MEUS_DADOS".equals( operacao ), getServletContext() );
				JSONObject resposta = new JSONObject().put( "idUsuario", resultado.idUsuario().toString() )
					.put( "emailEnviado", resultado.emailEnviado() ).put( "confirmacaoPendente", resultado.confirmacaoPendente() );
				if( resultado.idConfirmacao() != null ) resposta.put( "idConfirmacao", resultado.idConfirmacao().toString() );
				ArgousFormsJson.enviarSucesso( response, 200, resposta );
				return;
			}
			manutencaoUsuarios.confirmarTrocaEmail( ArgousFormsJson.getStringObrigatoria( dados, "email", true ),
				ArgousFormsJson.getStringObrigatoria( dados, "codigo", true ), autenticado.idUsuario(), getServletContext() );
			ArgousFormsJson.enviarSucesso( response, 200, new JSONObject().put( "emailConfirmado", true ) );
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

		if( "LISTAR_ORGANIZACAO".equals( operacao ) || "SALVAR_GRUPO".equals( operacao ) || "CRIAR_TAG".equals( operacao ) || "ALTERAR_TAG".equals( operacao )
			|| "REMOVER_GRUPO".equals( operacao ) || "REMOVER_TAG".equals( operacao )
			|| "LISTAR_VINCULOS_ORGANIZACAO".equals( operacao ) || "SALVAR_VINCULO_GRUPO".equals( operacao )
			|| "SALVAR_TAG_USUARIO".equals( operacao ) || "SALVAR_TAG_VINCULO".equals( operacao ) ) {
			exigirGestorGruposTags( request );
			if( "LISTAR_VINCULOS_ORGANIZACAO".equals( operacao ) ) {
				ArgousFormsJson.enviarSucesso( response, 200, vinculosOrganizacao.listar() );
				return;
			}
			if( "REMOVER_GRUPO".equals( operacao ) ) {
				int idGrupo = dados.optInt( "idGrupo", -1 );
				if( idGrupo <= 0 ) throw new ArgousFormsApiException( 400, "GRUPO_INVALIDO", "Informe um grupo válido." );
				ArgousFormsJson.enviarSucesso( response, 200, new JSONObject().put( "acao", organizacao.removerGrupo( idGrupo ) ) );
				return;
			}
			if( "REMOVER_TAG".equals( operacao ) ) {
				ArgousFormsJson.enviarSucesso( response, 200, new JSONObject().put( "acao", organizacao.removerTag( ArgousFormsJson.getStringObrigatoria( dados, "codigo", true ) ) ) );
				return;
			}
			if( "SALVAR_VINCULO_GRUPO".equals( operacao ) || "SALVAR_TAG_USUARIO".equals( operacao ) || "SALVAR_TAG_VINCULO".equals( operacao ) ) {
				UUID idUsuario = uuidObrigatorio( dados, "idUsuario" );
				Object valorAtivo = dados.opt( "ativo" );
				if( !( valorAtivo instanceof Boolean ativo ) ) throw new ArgousFormsApiException( 400, "ESTADO_INVALIDO", "Informe se o vínculo está ativo." );
				if( "SALVAR_TAG_USUARIO".equals( operacao ) ) vinculosOrganizacao.salvarTagUsuario( idUsuario, ArgousFormsJson.getStringObrigatoria( dados, "codigo", true ), ativo );
				else {
					int idGrupo = dados.optInt( "idGrupo", -1 );
					if( idGrupo <= 0 ) throw new ArgousFormsApiException( 400, "GRUPO_INVALIDO", "Informe um grupo válido." );
					if( "SALVAR_TAG_VINCULO".equals( operacao ) ) vinculosOrganizacao.salvarTagVinculo( idUsuario, idGrupo, ArgousFormsJson.getStringObrigatoria( dados, "codigo", true ), ativo );
					else vinculosOrganizacao.salvarVinculo( idUsuario, idGrupo, ativo );
				}
				ArgousFormsJson.enviarSucesso( response, 200, new JSONObject().put( "salvo", true ) );
				return;
			}
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

	private Integer idAtributo( JSONObject dados, String campo, boolean obrigatorio ) throws ArgousFormsApiException {

		Object valor = dados.opt( campo );
		if( ( valor == null || JSONObject.NULL.equals( valor ) ) && !obrigatorio ) return null;
		if( !( valor instanceof Integer numero ) || numero <= 0 ) {
			throw new ArgousFormsApiException( 400, "IDENTIFICADOR_INVALIDO", "Informe um identificador de atributo válido." );
		}
		return numero;
	}

	private Integer diasVencimento( JSONObject dados ) throws ArgousFormsApiException {

		Object valor = dados.opt( "diasVencimento" );
		if( valor == null || JSONObject.NULL.equals( valor ) ) return null;
		if( !( valor instanceof Integer dias ) || dias < 1 || dias > Short.MAX_VALUE ) {
			throw new ArgousFormsApiException( 400, "VENCIMENTO_INVALIDO", "Informe um prazo de 1 a 32767 dias ou deixe sem vencimento." );
		}
		return dias;
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

	private AutenticacaoLocalService.Usuario consultarUsuario( HttpServletRequest request, HttpServletResponse response ) throws Exception {

		String token = tokenSessao( request );
		AutenticacaoLocalService.Usuario usuario = autenticacao.consultar( token );
		definirCookieSessao( request, response, token, usuario.segundosCookie() );
		return usuario;
	}

	private void definirCookieSessao( HttpServletRequest request, HttpServletResponse response, String token, long validade ) {

		String seguro = request.isSecure() ? "; Secure" : "";
		response.addHeader( "Set-Cookie", "AF_SESSAO=" + token + "; Path=" + request.getContextPath() + "; Max-Age=" + validade + "; HttpOnly; SameSite=Strict" + seguro );
	}
}
