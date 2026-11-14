package br.com.argousForms.processos;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.security.MessageDigest;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.json.JSONArray;
import org.json.JSONObject;

import br.com.argousForms.api.ArgousFormsApiException;
import br.com.argousForms.documentos.MongoArmazenamento;
import br.com.argousForms.model.negocio.docs.ArquivoNegocio;
import br.com.argousForms.model.negocio.docs.ArquivoVersaoNegocio;
import br.com.argousForms.model.negocio.docs.PastaNegocio;
import br.com.argousForms.model.negocio.processos.ProcessoDocumentoNegocio;
import br.com.argousForms.model.persistencia.docs.Arquivo;
import br.com.argousForms.model.persistencia.docs.ArquivoVersao;
import br.com.argousForms.model.persistencia.docs.Pasta;
import br.com.argousForms.model.persistencia.processos.ProcessoDocumento;
import quatro.sql.Conexao;
import quatro.util.QtData;

/** Gera e registra os PDFs da etapa dentro da transação da finalização. */
public final class DocumentoPdfProcessoService {

	private record Modelo( UUID idVersao, UUID idArquivoModelo, String codigo, String titulo, String classificacao,
		long tamanhoOrigem, Integer diasVencimento ) {}

	public void gerar( Conexao conexao, MongoArmazenamento mongo, UUID idUsuario, UUID idProcesso, UUID idEtapa,
		UUID idVersaoProtocolo, JSONArray documentos, List<UUID> enviados ) throws Exception {

		if( documentos.length() == 0 ) return;
		UUID pasta = pastaProcesso( conexao, idProcesso, idVersaoProtocolo, idUsuario );
		int limite = limiteBytes( conexao );
		PdfProcessoRenderer renderer = new PdfProcessoRenderer();
		for( int i = 0; i < documentos.length(); i++ ) {
			UUID idModelo = UUID.fromString( documentos.getString( i ) );
			Modelo modelo = modelo( conexao, idVersaoProtocolo, idModelo );
			if( modelo.tamanhoOrigem() > limite ) throw new ArgousFormsApiException( 409, "MODELO_PDF_EXTENSO", "O PDF de origem excede o limite de arquivos da instituição." );
			ByteArrayOutputStream origem = new ByteArrayOutputStream();
			mongo.baixar( modelo.idArquivoModelo(), origem );
			if( origem.size() > limite ) throw new ArgousFormsApiException( 409, "MODELO_PDF_EXTENSO", "O PDF de origem excede o limite de arquivos da instituição." );
			byte[] conteudo = renderer.gerar( origem.toByteArray(), campos( conexao, idProcesso, idVersaoProtocolo, idModelo ) );
			if( conteudo.length > limite ) throw new ArgousFormsApiException( 409, "PDF_EXTENSO", "O PDF gerado excede o limite de arquivos da instituição." );
			registrar( conexao, mongo, idUsuario, idProcesso, idEtapa, pasta, modelo, conteudo, enviados );
		}
	}

	private Modelo modelo( Conexao conexao, UUID idVersaoProtocolo, UUID idModelo ) throws Exception {

		String sql = "select pdf.ID_ARQUIVO_MODELO_PDF, d.CD_DOCUMENTO, d.DS_TITULO, a.TP_CLASSIFICACAO, av.NR_TAMANHO_BYTES, v.NR_DIAS_VENCIMENTO "
			+ "from Processos.PROTOCOLO_VERSAO_DOCUMENTOS vd "
			+ "join Processos.PROTOCOLO_DOCUMENTO_VERSOES v on v.ID_PROTOCOLO_DOCUMENTO_VERSAO = vd.ID_PROTOCOLO_DOCUMENTO_VERSAO "
			+ "join Processos.PROTOCOLO_DOCUMENTOS d on d.ID_PROTOCOLO_DOCUMENTO = vd.ID_PROTOCOLO_DOCUMENTO "
			+ "join Processos.PROTOCOLO_DOCUMENTO_PDF pdf on pdf.ID_PROTOCOLO_DOCUMENTO_VERSAO = v.ID_PROTOCOLO_DOCUMENTO_VERSAO "
			+ "join Docs.ARQUIVO_VERSOES av on av.ID_ARQUIVO_VERSAO = pdf.ID_ARQUIVO_MODELO_PDF "
			+ "join Docs.ARQUIVOS a on a.ID_ARQUIVO = av.ID_ARQUIVO "
			+ "where vd.ID_PROTOCOLO_VERSAO = ? and vd.ID_PROTOCOLO_DOCUMENTO_VERSAO = ? and v.TP_MODELO = 'P'";
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
			consulta.setObject( 1, idVersaoProtocolo );
			consulta.setObject( 2, idModelo );
			try ( ResultSet linha = consulta.executeQuery() ) {
				if( !linha.next() ) throw new ArgousFormsApiException( 409, "MODELO_PDF_INVALIDO", "O documento configurado não é um PDF desta versão do Protocolo." );
				return new Modelo( idModelo, linha.getObject( 1, UUID.class ), linha.getString( 2 ), linha.getString( 3 ), linha.getString( 4 ),
					linha.getLong( 5 ), linha.getObject( 6 ) == null ? null : linha.getInt( 6 ) );
			}
		}
	}

	private List<PdfProcessoRenderer.Campo> campos( Conexao conexao, UUID idProcesso, UUID idVersao, UUID idModelo ) throws Exception {

		List<PdfProcessoRenderer.Campo> campos = new ArrayList<>();
		String sql = "select ID_VARIAVEL, ID_ATRIBUTO, NR_PAGINA, VL_POS_X, VL_POS_Y, VL_LARGURA, VL_ALTURA, JS_APRESENTACAO "
			+ "from Processos.PROTOCOLO_DOCUMENTO_PDF_CAMPOS where ID_PROTOCOLO_DOCUMENTO_VERSAO = ? order by NR_PAGINA, ID_PDF_CAMPO";
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
			consulta.setObject( 1, idModelo );
			try ( ResultSet linha = consulta.executeQuery() ) {
				while( linha.next() ) {
					UUID idVariavel = linha.getObject( "ID_VARIAVEL", UUID.class );
					String valor = idVariavel == null ? valorInstituicao( conexao, linha.getInt( "ID_ATRIBUTO" ) )
						: valorVariavel( conexao, idProcesso, idVersao, idVariavel );
					campos.add( new PdfProcessoRenderer.Campo( linha.getInt( "NR_PAGINA" ), linha.getFloat( "VL_POS_X" ),
						linha.getFloat( "VL_POS_Y" ), linha.getFloat( "VL_LARGURA" ), linha.getFloat( "VL_ALTURA" ),
						valor, new JSONObject( linha.getString( "JS_APRESENTACAO" ) ) ) );
				}
			}
		}
		return campos;
	}

	private String valorInstituicao( Conexao conexao, int idAtributo ) throws Exception {

		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement(
			"select VL_ATRIBUTO from Cadastro.VARIAVEIS_INSTITUICAO where ID_ATRIBUTO = ? and TP_ATRIBUTO = 'V' and DT_INVALIDACAO is null" ) ) {
			consulta.setInt( 1, idAtributo );
			try ( ResultSet linha = consulta.executeQuery() ) {
				if( !linha.next() ) throw new ArgousFormsApiException( 409, "VARIAVEL_INSTITUICAO_AUSENTE", "Uma variável da instituição usada pelo PDF não está disponível." );
				return linha.getString( 1 );
			}
		}
	}

	private String valorVariavel( Conexao conexao, UUID idProcesso, UUID idVersao, UUID idVariavel ) throws Exception {

		String sql = "select x.TP_DADO, vv.JS_DEFINICAO, valor.VL_TEXTO, valor.VL_INTEIRO, valor.VL_DECIMAL, "
			+ "valor.CD_MOEDA, valor.CD_VALOR_MONETARIO, valor.VL_BOOLEANO, valor.VL_OPCAO, valor.VL_DATA, valor.VL_HORA, valor.VL_DATA_HORA "
			+ "from Processos.PROTOCOLO_VARIAVEIS x join Processos.PROTOCOLO_VERSAO_VARIAVEIS pv "
			+ "on pv.ID_VARIAVEL = x.ID_VARIAVEL and pv.ID_PROTOCOLO_VERSAO = ? "
			+ "join Processos.PROTOCOLO_VARIAVEL_VERSOES vv on vv.ID_VARIAVEL = x.ID_VARIAVEL and vv.NR_VERSAO = pv.NR_VERSAO "
			+ "left join Processos.PROCESSO_VARIAVEIS_ATUAIS atual on atual.ID_PROCESSO = ? and atual.ID_VARIAVEL = x.ID_VARIAVEL "
			+ "left join Processos.PROCESSO_VARIAVEL_VALORES valor on valor.ID_PROCESSO_ETAPA = atual.ID_PROCESSO_ETAPA "
			+ "and valor.ID_VARIAVEL = x.ID_VARIAVEL where x.ID_VARIAVEL = ?";
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
			consulta.setObject( 1, idVersao );
			consulta.setObject( 2, idProcesso );
			consulta.setObject( 3, idVariavel );
			try ( ResultSet linha = consulta.executeQuery() ) {
				if( !linha.next() ) throw new ArgousFormsApiException( 409, "VARIAVEL_MODELO_INVALIDA", "Uma variável do PDF não pertence à versão do Protocolo." );
				String tipo = linha.getString( "TP_DADO" );
				String valor = switch( tipo ) {
					case "S" -> linha.getString( "VL_TEXTO" );
					case "I" -> linha.getString( "VL_INTEIRO" );
					case "R" -> linha.getString( "VL_DECIMAL" );
					case "M" -> linha.getString( "CD_MOEDA" );
					case "V" -> linha.getString( "CD_MOEDA" ) == null ? null : linha.getString( "CD_MOEDA" ) + " " + linha.getString( "CD_VALOR_MONETARIO" );
					case "B" -> linha.getObject( "VL_BOOLEANO" ) == null ? null : linha.getBoolean( "VL_BOOLEANO" ) ? "Sim" : "Não";
					case "O" -> linha.getString( "VL_OPCAO" );
					case "D" -> linha.getString( "VL_DATA" );
					case "H" -> linha.getString( "VL_HORA" );
					case "T" -> linha.getString( "VL_DATA_HORA" );
					default -> null;
				};
				if( valor == null ) return "";
				if( "S".equals( tipo ) ) {
					JSONObject definicao = new JSONObject( linha.getString( "JS_DEFINICAO" ) );
					valor = formatarMascara( valor, definicao.optJSONObject( "texto" ) );
				}
				return valor;
			}
		}
	}

	private String formatarMascara( String valor, JSONObject texto ) {

		String mascara = texto == null ? "" : texto.optString( "mascara", "" );
		if( mascara.isEmpty() ) return valor;
		StringBuilder resultado = new StringBuilder();
		int indice = 0;
		boolean escape = false;
		for( int i = 0; i < mascara.length() && indice < valor.length(); i++ ) {
			char atual = mascara.charAt( i );
			if( escape ) { resultado.append( atual ); escape = false; }
			else if( atual == '\\' ) escape = true;
			else if( "aAdD09#*".indexOf( atual ) >= 0 ) resultado.append( valor.charAt( indice++ ) );
			else resultado.append( atual );
		}
		return resultado.toString();
	}

	private UUID pastaProcesso( Conexao conexao, UUID idProcesso, UUID idVersao, UUID idUsuario ) throws Exception {

		UUID pastaProtocolo;
		String sql = "select p.ID_PASTA from Processos.PROTOCOLOS p join Processos.PROTOCOLO_VERSOES v "
			+ "on v.ID_PROTOCOLO = p.ID_PROTOCOLO where v.ID_PROTOCOLO_VERSAO = ? for update of p";
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
			consulta.setObject( 1, idVersao );
			try ( ResultSet linha = consulta.executeQuery() ) {
				if( !linha.next() || (pastaProtocolo = linha.getObject( 1, UUID.class )) == null ) {
					throw new ArgousFormsApiException( 409, "PASTA_PROTOCOLO_AUSENTE", "O Protocolo não possui pasta de documentos." );
				}
			}
		}
		UUID pastaProcessos = subpasta( conexao, pastaProtocolo, "Processos", idUsuario );
		return subpasta( conexao, pastaProcessos, idProcesso.toString(), idUsuario );
	}

	private UUID subpasta( Conexao conexao, UUID pai, String nome, UUID idUsuario ) throws Exception {

		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement(
			"select ID_PASTA from Docs.PASTAS where ID_PASTA_PAI = ? and DS_NOME = ? and DT_LIXEIRA is null and DT_EXCLUSAO is null" ) ) {
			consulta.setObject( 1, pai );
			consulta.setString( 2, nome );
			try ( ResultSet linha = consulta.executeQuery() ) { if( linha.next() ) return linha.getObject( 1, UUID.class ); }
		}
		Pasta pasta = new Pasta();
		pasta.setIdPastaPai( pai );
		pasta.setDsNome( nome );
		pasta.setIdUsuarioCriou( idUsuario );
		QtData agora = new QtData( Instant.now().toEpochMilli() );
		pasta.setDtInclusao( agora );
		pasta.setDtAlteracao( agora );
		new PastaNegocio( conexao, pasta ).insere();
		return pasta.getIdPasta();
	}

	private int limiteBytes( Conexao conexao ) throws Exception {

		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement(
			"select NR_TAMANHO_MAXIMO_ARQUIVO_BYTES from Cadastro.INSTITUICAO where ID_INSTITUICAO = 1" );
			ResultSet linha = consulta.executeQuery() ) {
			if( !linha.next() ) throw new ArgousFormsApiException( 503, "INSTITUICAO_AUSENTE", "A instituição não está configurada." );
			return ( int ) Math.min( linha.getLong( 1 ), Integer.MAX_VALUE );
		}
	}

	private void registrar( Conexao conexao, MongoArmazenamento mongo, UUID idUsuario, UUID idProcesso, UUID idEtapa,
		UUID idPasta, Modelo modelo, byte[] conteudo, List<UUID> enviados ) throws Exception {

		int numero = proximaGeracao( conexao, idProcesso, modelo.idVersao() );
		String nome = modelo.codigo() + "-" + numero + ".pdf";
		Arquivo arquivo = new Arquivo();
		arquivo.setIdPasta( idPasta );
		arquivo.setDsNomeArquivo( nome );
		arquivo.setDsTitulo( modelo.titulo() );
		arquivo.setTpClassificacao( modelo.classificacao() );
		arquivo.setCdContentType( "application/pdf" );
		Instant instanteCriacao = Instant.now();
		QtData agora = new QtData( instanteCriacao.toEpochMilli() );
		arquivo.setDtInclusao( agora );
		arquivo.setDtAlteracao( agora );
		if( modelo.diasVencimento() != null ) {
			arquivo.setDtVencimento( new QtData( instanteCriacao.plus( modelo.diasVencimento(), ChronoUnit.DAYS ).toEpochMilli() ) );
		}
		new ArquivoNegocio( conexao, arquivo ).insere();

		ArquivoVersao versao = new ArquivoVersao();
		versao.setIdArquivo( arquivo.getIdArquivo() );
		versao.setIdUsuarioIncluiu( idUsuario );
		versao.setNrVersao( 1 );
		versao.setNrTamanhoBytes( (long) conteudo.length );
		versao.setCdHashSha256( sha256( conteudo ) );
		versao.setTpOrigem( "P" );
		versao.setDtInclusao( agora );
		new ArquivoVersaoNegocio( conexao, versao ).insere();

		ProcessoDocumento documento = new ProcessoDocumento();
		documento.setIdProcesso( idProcesso );
		documento.setIdProtocoloDocumentoVersao( modelo.idVersao() );
		documento.setIdProcessoEtapa( idEtapa );
		documento.setIdArquivoVersao( versao.getIdArquivoVersao() );
		documento.setNrGeracao( numero );
		documento.setTpSituacao( "P" );
		documento.setDtGeracao( agora );
		documento.setDtPublicacao( agora );
		new ProcessoDocumentoNegocio( conexao, documento ).insere();

		mongo.enviar( arquivo.getIdArquivo(), versao.getIdArquivoVersao(), nome, modelo.titulo(), "application/pdf", new ByteArrayInputStream( conteudo ) );
		enviados.add( versao.getIdArquivoVersao() );
	}

	private int proximaGeracao( Conexao conexao, UUID idProcesso, UUID idModelo ) throws Exception {

		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement(
			"select coalesce(max(NR_GERACAO), 0) + 1 from Processos.PROCESSO_DOCUMENTO where ID_PROCESSO = ? and ID_PROTOCOLO_DOCUMENTO_VERSAO = ?" ) ) {
			consulta.setObject( 1, idProcesso );
			consulta.setObject( 2, idModelo );
			try ( ResultSet linha = consulta.executeQuery() ) { linha.next(); return linha.getInt( 1 ); }
		}
	}

	private String sha256( byte[] conteudo ) throws Exception {

		byte[] hash = MessageDigest.getInstance( "SHA-256" ).digest( conteudo );
		StringBuilder resultado = new StringBuilder( hash.length * 2 );
		for( byte valor : hash ) resultado.append( String.format( "%02x", valor & 0xff ) );
		return resultado.toString();
	}
}
