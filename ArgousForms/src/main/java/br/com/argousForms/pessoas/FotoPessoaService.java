package br.com.argousForms.pessoas;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.OutputStream;
import java.util.Iterator;
import java.util.UUID;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;

import jakarta.servlet.ServletContext;

import br.com.argousForms.api.ArgousFormsApiException;
import br.com.argousForms.documentos.MongoArmazenamento;
import br.com.argousForms.model.negocio.cadastro.PessoaNegocio;
import br.com.argousForms.model.persistencia.cadastro.Pessoa;
import br.com.argousForms.model.persistencia.cadastro.PessoaLocalizador;
import quatro.sql.Conexao;
import quatro.sql.PoolDeConexoes;
import quatro.sql.Query;

public final class FotoPessoaService {

	public static final int TAMANHO_MAXIMO = 5 * 1024 * 1024;

	public UUID salvar( UUID idUsuario, byte[] origem, ServletContext contexto ) throws Exception {

		if( origem == null || origem.length == 0 || origem.length > TAMANHO_MAXIMO ) {
			throw new ArgousFormsApiException( 413, "FOTO_GRANDE_DEMAIS", "A foto deve ter até 5 MB." );
		}
		byte[] jpeg = converter( origem );
		UUID idNovo = UUID.randomUUID();
		UUID idAnterior = null;
		try ( MongoArmazenamento mongo = new MongoArmazenamento( contexto ); Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				Pessoa pessoa = pessoa( conexao, idUsuario );
				idAnterior = pessoa.getIdFoto();
				mongo.enviarFotoPessoa( idNovo, pessoa.getIdPessoa(), new ByteArrayInputStream( jpeg ) );
				pessoa.setIdFoto( idNovo );
				new PessoaNegocio( conexao, pessoa ).altera();
				conexao.commit();
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				try { mongo.excluir( idNovo ); } catch ( Exception limpeza ) { e.addSuppressed( limpeza ); }
				throw e;
			}
			if( idAnterior != null ) mongo.excluir( idAnterior );
		}
		return idNovo;
	}

	public void remover( UUID idUsuario, ServletContext contexto ) throws Exception {

		try ( MongoArmazenamento mongo = new MongoArmazenamento( contexto ); Conexao conexao = PoolDeConexoes.getConexao() ) {
			UUID idAnterior;
			conexao.beginTransaction();
			try {
				Pessoa pessoa = pessoa( conexao, idUsuario );
				idAnterior = pessoa.getIdFoto();
				if( idAnterior != null ) {
					pessoa.setIdFoto( null );
					new PessoaNegocio( conexao, pessoa ).altera();
				}
				conexao.commit();
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
			if( idAnterior != null ) mongo.excluir( idAnterior );
		}
	}

	public boolean baixar( UUID idUsuario, OutputStream destino, ServletContext contexto ) throws Exception {

		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			UUID idFoto = pessoa( conexao, idUsuario ).getIdFoto();
			if( idFoto == null ) return false;
			try ( MongoArmazenamento mongo = new MongoArmazenamento( contexto ) ) {
				if( !mongo.fotoPessoaExiste( idFoto ) ) return false;
				mongo.baixar( idFoto, destino );
				return true;
			}
		}
	}

	private Pessoa pessoa( Conexao conexao, UUID idUsuario ) throws Exception {

		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select p.* from Cadastro.PESSOAS p join Cadastro.USUARIOS_SISTEMA u on u.ID_PESSOA = p.ID_PESSOA where u.ID_USUARIO_SISTEMA = :id and u.DT_EXCLUSAO is null and p.DT_EXCLUSAO is null" );
			query.setParameter( "id", idUsuario.toString() );
			query.executeQuery();
			if( query.isEmpty() ) throw new ArgousFormsApiException( 404, "PESSOA_NAO_ENCONTRADA", "Pessoa não encontrada." );
			Pessoa pessoa = new Pessoa();
			PessoaLocalizador.buscaCampos( pessoa, query );
			return pessoa;
		}
	}

	private byte[] converter( byte[] origem ) throws Exception {

		try ( ImageInputStream entrada = ImageIO.createImageInputStream( new ByteArrayInputStream( origem ) ) ) {
			Iterator<ImageReader> leitores = ImageIO.getImageReaders( entrada );
			if( !leitores.hasNext() ) throw formatoInvalido();
			ImageReader leitor = leitores.next();
			try {
				leitor.setInput( entrada, true, true );
				String formato = leitor.getFormatName();
				if( !"JPEG".equalsIgnoreCase( formato ) && !"JPG".equalsIgnoreCase( formato ) && !"PNG".equalsIgnoreCase( formato ) ) throw formatoInvalido();
				int largura = leitor.getWidth( 0 );
				int altura = leitor.getHeight( 0 );
				if( largura <= 0 || altura <= 0 || (long) largura * altura > 40_000_000 ) throw formatoInvalido();
				BufferedImage original = leitor.read( 0 );
				int novaLargura = Math.max( 1, (int) Math.round( largura * Math.min( 1d, Math.min( 512d / largura, 512d / altura ) ) ) );
				int novaAltura = Math.max( 1, (int) Math.round( altura * Math.min( 1d, Math.min( 512d / largura, 512d / altura ) ) ) );
				BufferedImage reduzida = new BufferedImage( novaLargura, novaAltura, BufferedImage.TYPE_INT_RGB );
				Graphics2D desenho = reduzida.createGraphics();
				try {
					desenho.setColor( Color.WHITE );
					desenho.fillRect( 0, 0, novaLargura, novaAltura );
					desenho.setRenderingHint( RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC );
					desenho.drawImage( original, 0, 0, novaLargura, novaAltura, null );
				} finally { desenho.dispose(); }
				ByteArrayOutputStream destino = new ByteArrayOutputStream();
				if( !ImageIO.write( reduzida, "jpg", destino ) ) throw formatoInvalido();
				return destino.toByteArray();
			} finally { leitor.dispose(); }
		}
	}

	private ArgousFormsApiException formatoInvalido() {

		return new ArgousFormsApiException( 400, "FOTO_INVALIDA", "Escolha uma foto JPEG ou PNG válida." );
	}
}
