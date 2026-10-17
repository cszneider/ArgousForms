package br.com.argousForms.documentos;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.UUID;
import java.util.logging.Level;
import java.util.logging.Logger;

import javax.servlet.annotation.WebServlet;
import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.mongodb.MongoException;

import br.com.argousForms.api.ArgousFormsApiException;
import br.com.argousForms.api.ArgousFormsJson;
import br.com.argousForms.auth.AutenticacaoLocalService;

@WebServlet( name = "ArquivoConteudoServlet", urlPatterns = "/arquivo-conteudo" )
public final class ArquivoConteudoServlet extends HttpServlet {

	private static final long serialVersionUID = 1L;
	private static final Logger LOG = Logger.getLogger( ArquivoConteudoServlet.class.getName() );
	private final AutenticacaoLocalService autenticacao = new AutenticacaoLocalService();
	private final DocumentosService documentos = new DocumentosService();

	@Override
	protected void doGet( HttpServletRequest request, HttpServletResponse response ) throws IOException {

		response.setHeader( "Cache-Control", "no-store" );
		response.setHeader( "X-Content-Type-Options", "nosniff" );
		response.setHeader( "Cross-Origin-Resource-Policy", "same-origin" );
		response.setHeader( "X-Frame-Options", "SAMEORIGIN" );
		response.setHeader( "Content-Security-Policy", "default-src 'none'; sandbox" );
		try {
			UUID idArquivo;
			try { idArquivo = UUID.fromString( request.getParameter( "idArquivo" ) ); }
			catch ( Exception e ) { throw new ArgousFormsApiException( 400, "ARQUIVO_INVALIDO", "Informe um arquivo válido." ); }
			String modo = request.getParameter( "modo" );
			if( !( "visualizar".equals( modo ) || "baixar".equals( modo ) ) ) {
				throw new ArgousFormsApiException( 400, "MODO_INVALIDO", "Informe visualizar ou baixar." );
			}
			AutenticacaoLocalService.Usuario usuario = autenticacao.consultar( tokenSessao( request ) );
			boolean baixar = "baixar".equals( modo );
			DocumentosService.Conteudo conteudo = documentos.conteudo( usuario, idArquivo, baixar );
			String mime = conteudo.contentType() == null ? "application/octet-stream" : conteudo.contentType().toLowerCase( Locale.ROOT );
			if( !mime.matches( "[a-z0-9!#$&^_.+-]+/[a-z0-9!#$&^_.+-]+" ) ) mime = "application/octet-stream";
			if( !baixar && !visualizavel( mime ) ) {
				throw new ArgousFormsApiException( 415, "VISUALIZACAO_INDISPONIVEL", "Este tipo de arquivo não possui visualização direta." );
			}
			String nome = conteudo.nome().replaceAll( "[\\r\\n\\u0000-\\u001f\\u007f]", "_" );
			String codificado = URLEncoder.encode( nome, StandardCharsets.UTF_8 ).replace( "+", "%20" );
			response.setContentType( mime );
			response.setHeader( "Content-Disposition", ( baixar ? "attachment" : "inline" ) + "; filename*=UTF-8''" + codificado );
			try ( MongoArmazenamento mongo = new MongoArmazenamento( getServletContext() ) ) {
				mongo.baixar( conteudo.idVersao(), response.getOutputStream() );
			}
		} catch ( ArgousFormsApiException e ) {
			enviarErro( response, e.getStatusHttp(), e.getCodigoErro(), e.getMessage() );
		} catch ( MongoException e ) {
			LOG.log( Level.WARNING, "Falha ao ler versão no GridFS", e );
			enviarErro( response, 503, "MONGODB_INDISPONIVEL", "O armazenamento de arquivos não está respondendo." );
		} catch ( Exception e ) {
			LOG.log( Level.SEVERE, "Falha ao entregar arquivo", e );
			enviarErro( response, 500, "ERRO_INTERNO", "Não foi possível abrir o arquivo." );
		}
	}

	private void enviarErro( HttpServletResponse response, int status, String codigo, String mensagem ) throws IOException {

		if( response.isCommitted() ) return;
		response.reset();
		response.setHeader( "Cache-Control", "no-store" );
		response.setHeader( "X-Content-Type-Options", "nosniff" );
		ArgousFormsJson.enviarErro( response, status, codigo, mensagem );
	}

	private boolean visualizavel( String mime ) {

		return "application/pdf".equals( mime ) || "image/png".equals( mime ) || "image/jpeg".equals( mime )
			|| "image/gif".equals( mime ) || "image/webp".equals( mime );
	}

	private String tokenSessao( HttpServletRequest request ) {

		Cookie[] cookies = request.getCookies();
		if( cookies == null ) return null;
		for( Cookie cookie : cookies ) {
			if( "AF_SESSAO".equals( cookie.getName() ) ) return cookie.getValue();
		}
		return null;
	}
}
