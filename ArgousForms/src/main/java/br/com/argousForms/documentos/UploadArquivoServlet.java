package br.com.argousForms.documentos;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.UUID;
import java.util.logging.Level;
import java.util.logging.Logger;

import javax.servlet.annotation.MultipartConfig;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.Part;

import com.mongodb.MongoException;

import br.com.argousForms.api.ArgousFormsApiException;
import br.com.argousForms.api.ArgousFormsJson;
import br.com.argousForms.auth.AutenticacaoLocalService;

@WebServlet( name = "UploadArquivoServlet", urlPatterns = "/upload-arquivo" )
@MultipartConfig( fileSizeThreshold = 0, maxFileSize = 2147483647L, maxRequestSize = 2147549183L )
public final class UploadArquivoServlet extends HttpServlet {

	private static final long serialVersionUID = 1L;
	private static final Logger LOG = Logger.getLogger( UploadArquivoServlet.class.getName() );
	private final AutenticacaoLocalService autenticacao = new AutenticacaoLocalService();
	private final UploadArquivoService upload = new UploadArquivoService();

	@Override
	protected void doPost( HttpServletRequest request, HttpServletResponse response ) throws IOException {

		Path temporario = null;
		Part parte = null;
		try {
			request.setCharacterEncoding( "UTF-8" );
			AutenticacaoLocalService.Usuario usuario = autenticacao.consultar( tokenSessao( request ) );
			if( !usuario.papeis().contains( "EDITOR_DE_DOCUMENTOS" ) ) {
				throw new ArgousFormsApiException( 403, "ACESSO_NEGADO", "Seu usuário não pode enviar arquivos." );
			}
			int limite = upload.limiteBytes();
			parte = request.getPart( "arquivo" );
			if( parte == null || parte.getSubmittedFileName() == null || parte.getSize() == 0 ) {
				throw new ArgousFormsApiException( 400, "ARQUIVO_OBRIGATORIO", "Escolha um arquivo não vazio." );
			}
			if( parte.getSize() > limite ) throw limiteExcedido( limite );

			String nome = nomeSeguro( parte.getSubmittedFileName() );
			UUID idPasta = uuid( request.getParameter( "idPasta" ) );
			String classificacao = request.getParameter( "classificacao" );
			String titulo = request.getParameter( "titulo" );
			String descricao = request.getParameter( "descricao" );
			Integer dias = dias( request.getParameter( "diasValidade" ) );
			boolean novaVersao = "NOVA_VERSAO".equals( request.getParameter( "modoConflito" ) );

			temporario = Files.createTempFile( "agforms-upload-", ".bin" );
			MessageDigest digest = MessageDigest.getInstance( "SHA-256" );
			int tamanho = copiarLimitado( parte, temporario, digest, limite );
			String hash = HexFormat.of().formatHex( digest.digest() );
			ArgousFormsJson.enviarSucesso( response, 201, upload.enviar( usuario, getServletContext(), idPasta, temporario,
				nome, titulo, descricao, parte.getContentType(), classificacao, dias, novaVersao, tamanho, hash ) );
		} catch ( ArgousFormsApiException e ) {
			ArgousFormsJson.enviarErro( response, e.getStatusHttp(), e.getCodigoErro(), e.getMessage() );
		} catch ( MongoException e ) {
			LOG.log( Level.WARNING, "Armazenamento MongoDB indisponível", e );
			ArgousFormsJson.enviarErro( response, 503, "MONGODB_INDISPONIVEL", "O armazenamento de arquivos não está respondendo." );
		} catch ( IllegalStateException e ) {
			ArgousFormsJson.enviarErro( response, 413, "ARQUIVO_GRANDE_DEMAIS", "O arquivo excede o limite permitido." );
		} catch ( Exception e ) {
			LOG.log( Level.SEVERE, "Falha no envio de arquivo", e );
			ArgousFormsJson.enviarErro( response, 500, "ERRO_INTERNO", "Não foi possível enviar o arquivo." );
		} finally {
			if( temporario != null ) {
				try { Files.deleteIfExists( temporario ); }
				catch ( IOException e ) { LOG.log( Level.WARNING, "Falha ao limpar arquivo temporário", e ); }
			}
			if( parte != null ) {
				try { parte.delete(); } catch ( IOException e ) { LOG.log( Level.WARNING, "Falha ao limpar arquivo temporário do multipart", e ); }
			}
		}
	}

	private int copiarLimitado( Part parte, Path destino, MessageDigest digest, int limite ) throws Exception {

		int total = 0;
		byte[] bloco = new byte[ 65536 ];
		try ( InputStream origem = parte.getInputStream(); OutputStream saida = Files.newOutputStream( destino ) ) {
			int lidos;
			while( ( lidos = origem.read( bloco ) ) != -1 ) {
				if( lidos > limite - total ) throw limiteExcedido( limite );
				saida.write( bloco, 0, lidos );
				digest.update( bloco, 0, lidos );
				total += lidos;
			}
		}
		return total;
	}

	private String nomeSeguro( String informado ) throws ArgousFormsApiException {

		String nome = informado.replace( '\\', '/' );
		nome = nome.substring( nome.lastIndexOf( '/' ) + 1 ).strip();
		if( nome.isEmpty() || nome.length() > 255 || nome.chars().anyMatch( valor -> valor < 32 || valor == 127 ) ) {
			throw new ArgousFormsApiException( 400, "NOME_ARQUIVO_INVALIDO", "O nome do arquivo é inválido." );
		}
		return nome;
	}

	private UUID uuid( String valor ) throws ArgousFormsApiException {

		try { return UUID.fromString( valor ); }
		catch ( Exception e ) { throw new ArgousFormsApiException( 400, "PASTA_INVALIDA", "Escolha uma pasta válida." ); }
	}

	private Integer dias( String valor ) throws ArgousFormsApiException {

		if( valor == null || valor.isBlank() ) return null;
		try { return Integer.valueOf( valor ); }
		catch ( NumberFormatException e ) { throw new ArgousFormsApiException( 400, "VALIDADE_INVALIDA", "Informe um prazo válido em dias." ); }
	}

	private String tokenSessao( HttpServletRequest request ) {

		Cookie[] cookies = request.getCookies();
		if( cookies == null ) return null;
		for( Cookie cookie : cookies ) {
			if( "AF_SESSAO".equals( cookie.getName() ) ) return cookie.getValue();
		}
		return null;
	}

	private ArgousFormsApiException limiteExcedido( int limite ) {

		return new ArgousFormsApiException( 413, "ARQUIVO_GRANDE_DEMAIS", "O arquivo excede o limite de " + limite + " bytes da instituição." );
	}
}
