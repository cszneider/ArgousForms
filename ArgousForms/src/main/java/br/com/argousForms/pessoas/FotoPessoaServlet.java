package br.com.argousForms.pessoas;

import java.io.IOException;
import java.util.UUID;
import java.util.logging.Level;
import java.util.logging.Logger;

import jakarta.servlet.annotation.MultipartConfig;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.Part;

import br.com.argousForms.api.ArgousFormsApiException;
import br.com.argousForms.api.ArgousFormsJson;
import br.com.argousForms.auth.AutenticacaoLocalService;

@WebServlet( name = "FotoPessoaServlet", urlPatterns = "/foto-pessoa" )
@MultipartConfig( fileSizeThreshold = 0, maxFileSize = 5 * 1024 * 1024, maxRequestSize = 5 * 1024 * 1024 + 65536 )
public final class FotoPessoaServlet extends HttpServlet {

	private static final long serialVersionUID = 1L;
	private static final Logger LOG = Logger.getLogger( FotoPessoaServlet.class.getName() );
	private final AutenticacaoLocalService autenticacao = new AutenticacaoLocalService();
	private final FotoPessoaService fotos = new FotoPessoaService();

	@Override
	protected void doGet( HttpServletRequest request, HttpServletResponse response ) throws IOException {

		try {
			UUID idUsuario = autenticar( request );
			response.setHeader( "Cache-Control", "private, no-store" );
			response.setContentType( "image/jpeg" );
			if( !fotos.baixar( idUsuario, response.getOutputStream(), getServletContext() ) ) response.sendError( 404 );
		} catch ( ArgousFormsApiException e ) {
			response.sendError( e.getStatusHttp(), e.getMessage() );
		} catch ( Exception e ) {
			LOG.log( Level.WARNING, "Falha ao consultar foto da Pessoa", e );
			response.sendError( 503, "Foto indisponível." );
		}
	}

	@Override
	protected void doPost( HttpServletRequest request, HttpServletResponse response ) throws IOException {

		Part parte = null;
		try {
			UUID idUsuario = autenticar( request );
			parte = request.getPart( "foto" );
			if( parte == null || parte.getSize() == 0 ) throw new ArgousFormsApiException( 400, "FOTO_OBRIGATORIA", "Escolha uma foto." );
			if( parte.getSize() > FotoPessoaService.TAMANHO_MAXIMO ) throw new ArgousFormsApiException( 413, "FOTO_GRANDE_DEMAIS", "A foto deve ter até 5 MB." );
			byte[] bytes = parte.getInputStream().readNBytes( FotoPessoaService.TAMANHO_MAXIMO + 1 );
			UUID idFoto = fotos.salvar( idUsuario, bytes, getServletContext() );
			ArgousFormsJson.enviarSucesso( response, 200, new org.json.JSONObject().put( "idFoto", idFoto.toString() ) );
		} catch ( ArgousFormsApiException e ) {
			ArgousFormsJson.enviarErro( response, e.getStatusHttp(), e.getCodigoErro(), e.getMessage() );
		} catch ( IllegalStateException e ) {
			ArgousFormsJson.enviarErro( response, 413, "FOTO_GRANDE_DEMAIS", "A foto deve ter até 5 MB." );
		} catch ( Exception e ) {
			LOG.log( Level.WARNING, "Falha ao atualizar foto da Pessoa", e );
			ArgousFormsJson.enviarErro( response, 503, "FOTO_INDISPONIVEL", "Não foi possível atualizar a foto." );
		} finally {
			if( parte != null ) try { parte.delete(); } catch ( IOException e ) { LOG.log( Level.FINE, "Falha ao limpar upload temporário", e ); }
		}
	}

	@Override
	protected void doDelete( HttpServletRequest request, HttpServletResponse response ) throws IOException {

		try {
			fotos.remover( autenticar( request ), getServletContext() );
			ArgousFormsJson.enviarSucesso( response, 200, new org.json.JSONObject().put( "removida", true ) );
		} catch ( ArgousFormsApiException e ) {
			ArgousFormsJson.enviarErro( response, e.getStatusHttp(), e.getCodigoErro(), e.getMessage() );
		} catch ( Exception e ) {
			LOG.log( Level.WARNING, "Falha ao remover foto da Pessoa", e );
			ArgousFormsJson.enviarErro( response, 503, "FOTO_INDISPONIVEL", "Não foi possível remover a foto." );
		}
	}

	private UUID autenticar( HttpServletRequest request ) throws Exception {

		Cookie[] cookies = request.getCookies();
		if( cookies != null ) for( Cookie cookie : cookies ) {
			if( "AF_SESSAO".equals( cookie.getName() ) ) return autenticacao.consultar( cookie.getValue() ).idUsuario();
		}
		throw new ArgousFormsApiException( 401, "SESSAO_INVALIDA", "Entre novamente para acessar sua foto." );
	}
}
