package br.com.argousForms.documentos;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import java.util.logging.Level;
import java.util.logging.Logger;

import javax.servlet.ServletContext;

import org.json.JSONObject;

import br.com.argousForms.api.ArgousFormsApiException;
import br.com.argousForms.auth.AutenticacaoLocalService;
import br.com.argousForms.model.negocio.docs.ArquivoNegocio;
import br.com.argousForms.model.negocio.docs.ArquivoVersaoNegocio;
import br.com.argousForms.model.persistencia.docs.Arquivo;
import br.com.argousForms.model.persistencia.docs.ArquivoVersao;
import quatro.sql.Conexao;
import quatro.sql.PoolDeConexoes;
import quatro.util.QtData;

public final class UploadArquivoService {

	private static final Logger LOG = Logger.getLogger( UploadArquivoService.class.getName() );
	private final DocumentosService documentos = new DocumentosService();

	public int limiteBytes() throws Exception {

		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			String sql = "select NR_TAMANHO_MAXIMO_ARQUIVO_BYTES from Cadastro.INSTITUICAO where ID_INSTITUICAO = 1";
			try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ); ResultSet resultado = consulta.executeQuery() ) {
				if( !resultado.next() ) throw new ArgousFormsApiException( 503, "INSTITUICAO_NAO_CONFIGURADA", "A instituição ainda não está configurada." );
				long valor = resultado.getLong( 1 );
				if( valor <= 0 ) throw new ArgousFormsApiException( 503, "LIMITE_NAO_CONFIGURADO", "O limite de arquivos ainda não está configurado." );
				return ( int ) Math.min( valor, Integer.MAX_VALUE );
			}
		}
	}

	public JSONObject enviar( AutenticacaoLocalService.Usuario usuario, ServletContext contexto, UUID idPasta, Path temporario,
		String nomeInformado, String tituloInformado, String descricaoInformada, String contentTypeInformado,
		String classificacao, Integer diasValidade, boolean novaVersao, int tamanho, String hash ) throws Exception {

		if( idPasta == null ) throw new ArgousFormsApiException( 400, "PASTA_OBRIGATORIA", "Escolha a pasta de destino." );
		String nome = nomeInformado == null ? "" : nomeInformado.strip();
		String titulo = tituloInformado == null || tituloInformado.isBlank() ? nome : tituloInformado.strip();
		String descricao = descricaoInformada == null || descricaoInformada.isBlank() ? null : descricaoInformada.strip();
		String contentType = contentTypeInformado == null || contentTypeInformado.isBlank() ? "application/octet-stream" : contentTypeInformado.strip();
		if( nome.isEmpty() || nome.length() > 255 || titulo.length() > 255 || contentType.length() > 255 ) {
			throw new ArgousFormsApiException( 400, "DADOS_ARQUIVO_INVALIDOS", "Nome, título ou tipo do arquivo inválido." );
		}
		if( !( "L".equals( classificacao ) || "S".equals( classificacao ) || "A".equals( classificacao ) ) ) {
			throw new ArgousFormsApiException( 400, "CLASSIFICACAO_INVALIDA", "Escolha a classificação do arquivo." );
		}
		if( diasValidade != null && ( diasValidade < 1 || diasValidade > 36500 ) ) {
			throw new ArgousFormsApiException( 400, "VALIDADE_INVALIDA", "Informe um prazo de 1 a 36500 dias." );
		}

		try ( MongoArmazenamento mongo = new MongoArmazenamento( contexto ); Conexao conexao = PoolDeConexoes.getConexao() ) {
			mongo.verificar();
			conexao.beginTransaction();
			UUID idVersao = null;
			boolean enviado = false;
			boolean commitTentado = false;
			try {
				documentos.exigirInclusao( conexao, usuario, idPasta );
				bloquearPasta( conexao, idPasta );
				Arquivo existente = localizarArquivo( conexao, idPasta, nome );
				Arquivo arquivo;
				int numeroVersao;
				if( novaVersao && existente != null ) {
					documentos.exigirEdicaoArquivo( conexao, usuario, idPasta, existente.getIdArquivo() );
					if( !contentType.equalsIgnoreCase( existente.getCdContentType() ) ) {
						throw new ArgousFormsApiException( 409, "TIPO_DIFERENTE", "Uma nova versão deve manter o tipo de conteúdo do arquivo." );
					}
					arquivo = existente;
					numeroVersao = proximaVersao( conexao, arquivo.getIdArquivo() );
				} else {
					if( existente != null ) nome = proximoNome( conexao, idPasta, nome );
					arquivo = new Arquivo();
					QtData agora = new QtData( Instant.now().toEpochMilli() );
					arquivo.setIdPasta( idPasta );
					arquivo.setDsNomeArquivo( nome );
					arquivo.setDsTitulo( titulo );
					arquivo.setDsDescricao( descricao );
					arquivo.setTpClassificacao( classificacao );
					arquivo.setCdContentType( contentType );
					arquivo.setDtInclusao( agora );
					if( diasValidade != null ) arquivo.setDtVencimento( new QtData( Instant.now().plus( diasValidade, ChronoUnit.DAYS ).toEpochMilli() ) );
					new ArquivoNegocio( conexao, arquivo ).insere();
					numeroVersao = 1;
				}

				ArquivoVersao versao = new ArquivoVersao();
				versao.setIdArquivo( arquivo.getIdArquivo() );
				versao.setIdUsuarioIncluiu( usuario.idUsuario() );
				versao.setNrVersao( numeroVersao );
				versao.setNrTamanhoBytes( tamanho );
				versao.setCdHashSha256( hash );
				versao.setTpOrigem( "U" );
				versao.setDtInclusao( new QtData( Instant.now().toEpochMilli() ) );
				new ArquivoVersaoNegocio( conexao, versao ).insere();
				idVersao = versao.getIdArquivoVersao();

				try ( InputStream conteudo = Files.newInputStream( temporario ) ) {
					mongo.enviar( arquivo.getIdArquivo(), idVersao, nome, arquivo.getDsTitulo(), arquivo.getCdContentType(), conteudo );
				}
				enviado = true;
				commitTentado = true;
				conexao.commit();
				return new JSONObject().put( "idArquivo", arquivo.getIdArquivo().toString() )
					.put( "idArquivoVersao", idVersao.toString() ).put( "nome", nome ).put( "versao", numeroVersao );
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) {
					try { conexao.rollback(); }
					catch ( Exception falhaRollback ) { e.addSuppressed( falhaRollback ); }
				}
				if( enviado && idVersao != null ) {
					Boolean persistido = commitTentado ? metadadoPersistido( idVersao ) : false;
					if( Boolean.FALSE.equals( persistido ) ) {
						try { mongo.excluir( idVersao ); }
						catch ( Exception limpeza ) { LOG.log( Level.SEVERE, "Falha ao compensar arquivo GridFS idArquivoVersao=" + idVersao, limpeza ); }
					} else if( persistido == null ) {
						LOG.severe( "Resultado da transação desconhecido; reconciliar idArquivoVersao=" + idVersao );
					}
				}
				throw e;
			}
		}
	}

	private Boolean metadadoPersistido( UUID idVersao ) {

		try ( Conexao verificacao = PoolDeConexoes.getConexao() ) {
			try ( PreparedStatement consulta = verificacao.getConnection().prepareStatement(
				"select 1 from Docs.ARQUIVO_VERSOES where ID_ARQUIVO_VERSAO = ?" ) ) {
				consulta.setObject( 1, idVersao );
				try ( ResultSet resultado = consulta.executeQuery() ) { return resultado.next(); }
			}
		} catch ( Exception e ) {
			LOG.log( Level.SEVERE, "Falha ao conferir metadado idArquivoVersao=" + idVersao, e );
			return null;
		}
	}

	private void bloquearPasta( Conexao conexao, UUID idPasta ) throws Exception {

		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select ID_PASTA from Docs.PASTAS where ID_PASTA = ? for update" ) ) {
			consulta.setObject( 1, idPasta );
			try ( ResultSet resultado = consulta.executeQuery() ) {
				if( !resultado.next() ) throw new ArgousFormsApiException( 404, "PASTA_NAO_ENCONTRADA", "Pasta não encontrada." );
			}
		}
	}

	private Arquivo localizarArquivo( Conexao conexao, UUID pasta, String nome ) throws Exception {

		String sql = "select ID_ARQUIVO, DS_TITULO, CD_CONTENT_TYPE from Docs.ARQUIVOS where ID_PASTA = ? "
			+ "and DS_NOME_ARQUIVO = ? and DT_LIXEIRA is null and DT_EXCLUSAO is null";
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
			consulta.setObject( 1, pasta );
			consulta.setString( 2, nome );
			try ( ResultSet resultado = consulta.executeQuery() ) {
				if( !resultado.next() ) return null;
				Arquivo arquivo = new Arquivo();
				arquivo.setIdArquivo( resultado.getObject( 1, UUID.class ) );
				arquivo.setDsTitulo( resultado.getString( 2 ) );
				arquivo.setCdContentType( resultado.getString( 3 ) );
				return arquivo;
			}
		}
	}

	private int proximaVersao( Conexao conexao, UUID idArquivo ) throws Exception {

		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select coalesce(max(NR_VERSAO), 0) + 1 from Docs.ARQUIVO_VERSOES where ID_ARQUIVO = ?" ) ) {
			consulta.setObject( 1, idArquivo );
			try ( ResultSet resultado = consulta.executeQuery() ) { resultado.next(); return resultado.getInt( 1 ); }
		}
	}

	private String proximoNome( Conexao conexao, UUID pasta, String original ) throws Exception {

		int ponto = original.lastIndexOf( '.' );
		String base = ponto > 0 ? original.substring( 0, ponto ) : original;
		String extensao = ponto > 0 ? original.substring( ponto ) : "";
		for( int sequencia = 1; sequencia < 100000; sequencia++ ) {
			String sufixo = " (" + sequencia + ")" + extensao;
			String candidato = base.substring( 0, Math.min( base.length(), 255 - sufixo.length() ) ) + sufixo;
			if( localizarArquivo( conexao, pasta, candidato ) == null ) return candidato;
		}
		throw new ArgousFormsApiException( 409, "NOME_INDISPONIVEL", "Não foi possível gerar um nome livre nesta pasta." );
	}
}
