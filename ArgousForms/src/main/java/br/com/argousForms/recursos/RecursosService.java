package br.com.argousForms.recursos;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.Instant;
import java.util.UUID;

import org.json.JSONArray;
import org.json.JSONObject;

import br.com.argousForms.api.ArgousFormsApiException;
import br.com.argousForms.auth.AutenticacaoLocalService;
import br.com.argousForms.documentos.DocumentosService;
import br.com.argousForms.model.negocio.cadastro.InstituicaoNegocio;
import br.com.argousForms.model.negocio.cadastro.RecursoInstituicaoNegocio;
import br.com.argousForms.model.negocio.docs.PastaNegocio;
import br.com.argousForms.model.negocio.processos.ProtocoloRecursoNegocio;
import br.com.argousForms.model.persistencia.cadastro.Instituicao;
import br.com.argousForms.model.persistencia.cadastro.InstituicaoLocalizador;
import br.com.argousForms.model.persistencia.cadastro.RecursoInstituicao;
import br.com.argousForms.model.persistencia.cadastro.RecursoInstituicaoLocalizador;
import br.com.argousForms.model.persistencia.docs.Pasta;
import br.com.argousForms.model.persistencia.processos.ProtocoloRecurso;
import br.com.argousForms.model.persistencia.processos.ProtocoloRecursoLocalizador;
import quatro.sql.Conexao;
import quatro.sql.PoolDeConexoes;
import quatro.util.QtData;

public final class RecursosService {

	private final DocumentosService documentos = new DocumentosService();

	public JSONObject listarInstituicao( AutenticacaoLocalService.Usuario usuario ) throws Exception {

		exigirAdministrador( usuario );
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			Instituicao instituicao = InstituicaoLocalizador.buscaInstituicao( conexao, 1 );
			if( instituicao == null ) throw new ArgousFormsApiException( 503, "INSTITUICAO_NAO_CONFIGURADA", "A instituição ainda não está configurada." );
			if( instituicao.getIdPasta() != null ) documentos.exigirPastaParaProtocolo( conexao, usuario, instituicao.getIdPasta() );
			return new JSONObject().put( "idPasta", instituicao.getIdPasta() == null ? JSONObject.NULL : instituicao.getIdPasta().toString() )
				.put( "recursos", listar( conexao, "select r.ID_ARQUIVO_VERSAO, r.CD_RECURSO, a.ID_ARQUIVO, a.DS_NOME_ARQUIVO, a.CD_CONTENT_TYPE from Cadastro.RECURSOS_INSTITUICAO r join Docs.ARQUIVO_VERSOES v on v.ID_ARQUIVO_VERSAO = r.ID_ARQUIVO_VERSAO join Docs.ARQUIVOS a on a.ID_ARQUIVO = v.ID_ARQUIVO where r.ID_INSTITUICAO = 1 order by r.CD_RECURSO", null ) );
		}
	}

	public JSONObject listarProtocolo( AutenticacaoLocalService.Usuario usuario, UUID idProtocolo ) throws Exception {

		exigirCriador( usuario );
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			UUID idPasta = pastaProtocolo( conexao, usuario, idProtocolo );
			if( idPasta != null ) documentos.exigirPastaParaProtocolo( conexao, usuario, idPasta );
			return new JSONObject().put( "idPasta", idPasta == null ? JSONObject.NULL : idPasta.toString() )
				.put( "recursos", listar( conexao, "select r.ID_ARQUIVO_VERSAO, r.CD_RECURSO, a.ID_ARQUIVO, a.DS_NOME_ARQUIVO, a.CD_CONTENT_TYPE, r.ID_PROTOCOLO_RECURSO from Processos.PROTOCOLO_RECURSOS r join Docs.ARQUIVO_VERSOES v on v.ID_ARQUIVO_VERSAO = r.ID_ARQUIVO_VERSAO join Docs.ARQUIVOS a on a.ID_ARQUIVO = v.ID_ARQUIVO where r.ID_PROTOCOLO = ? order by r.CD_RECURSO", idProtocolo ) );
		}
	}

	private JSONArray listar( Conexao conexao, String sql, UUID id ) throws Exception {

		JSONArray recursos = new JSONArray();
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
			if( id != null ) consulta.setObject( 1, id );
			try ( ResultSet linhas = consulta.executeQuery() ) {
				while( linhas.next() ) {
					JSONObject recurso = new JSONObject().put( "idArquivoVersao", linhas.getString( "ID_ARQUIVO_VERSAO" ) )
						.put( "idArquivo", linhas.getString( "ID_ARQUIVO" ) ).put( "codigo", linhas.getString( "CD_RECURSO" ) )
						.put( "nome", linhas.getString( "DS_NOME_ARQUIVO" ) ).put( "contentType", linhas.getString( "CD_CONTENT_TYPE" ) );
					if( id != null ) recurso.put( "idProtocoloRecurso", linhas.getString( "ID_PROTOCOLO_RECURSO" ) );
					recursos.put( recurso );
				}
			}
		}
		return recursos;
	}

	public JSONObject associarPastaInstituicao( AutenticacaoLocalService.Usuario usuario, UUID idPasta ) throws Exception {

		exigirAdministrador( usuario );
		if( idPasta == null ) throw new ArgousFormsApiException( 400, "PASTA_OBRIGATORIA", "Escolha a pasta dos recursos da instituição." );
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				documentos.exigirPastaParaProtocolo( conexao, usuario, idPasta );
				Instituicao instituicao = InstituicaoLocalizador.buscaInstituicao( conexao, 1 );
				if( instituicao == null ) throw new ArgousFormsApiException( 503, "INSTITUICAO_NAO_CONFIGURADA", "A instituição ainda não está configurada." );
				if( instituicao.getIdPasta() != null && !instituicao.getIdPasta().equals( idPasta ) && existe( conexao, "select 1 from Cadastro.RECURSOS_INSTITUICAO where ID_INSTITUICAO = 1" ) ) {
					throw new ArgousFormsApiException( 409, "PASTA_COM_RECURSOS", "Remova os recursos cadastrados antes de trocar a pasta." );
				}
				instituicao.setIdPasta( idPasta );
				instituicao.setDtAlteracao( new QtData( Instant.now().toEpochMilli() ) );
				new InstituicaoNegocio( conexao, instituicao ).altera();
				conexao.commit();
				return new JSONObject().put( "idPasta", idPasta.toString() );
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	public UUID pastaInstituicaoParaUpload( Conexao conexao, AutenticacaoLocalService.Usuario usuario ) throws Exception {

		exigirAdministrador( usuario );
		Instituicao instituicao = InstituicaoLocalizador.buscaInstituicao( conexao, 1 );
		if( instituicao == null || instituicao.getIdPasta() == null ) throw new ArgousFormsApiException( 409, "PASTA_OBRIGATORIA", "Configure a pasta de recursos da instituição." );
		documentos.exigirPastaParaProtocolo( conexao, usuario, instituicao.getIdPasta() );
		return instituicao.getIdPasta();
	}

	public UUID pastaProtocoloParaUpload( Conexao conexao, AutenticacaoLocalService.Usuario usuario, UUID idProtocolo ) throws Exception {

		exigirCriador( usuario );
		UUID idPai = pastaProtocolo( conexao, usuario, idProtocolo );
		exigirRascunho( conexao, usuario, idProtocolo );
		if( idPai == null ) throw new ArgousFormsApiException( 409, "PASTA_OBRIGATORIA", "Associe uma pasta ao Protocolo antes de enviar recursos." );
		documentos.exigirPastaParaProtocolo( conexao, usuario, idPai );
		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select ID_PASTA from Docs.PASTAS where ID_PASTA_PAI = ? and upper(DS_NOME) = 'RECURSOS' and DT_LIXEIRA is null and DT_EXCLUSAO is null" ) ) {
			consulta.setObject( 1, idPai );
			try ( ResultSet linhas = consulta.executeQuery() ) {
				if( linhas.next() ) return linhas.getObject( 1, UUID.class );
			}
		}
		Pasta pasta = new Pasta();
		pasta.setIdPastaPai( idPai );
		pasta.setDsNome( "RECURSOS" );
		pasta.setIdUsuarioCriou( usuario.idUsuario() );
		QtData agora = new QtData( Instant.now().toEpochMilli() );
		pasta.setDtInclusao( agora );
		pasta.setDtAlteracao( agora );
		new PastaNegocio( conexao, pasta ).insere();
		return pasta.getIdPasta();
	}

	public void registrarInstituicao( Conexao conexao, AutenticacaoLocalService.Usuario usuario, UUID idArquivoVersao, String codigo ) throws Exception {

		exigirAdministrador( usuario );
		String codigoValidado = codigo( codigo );
		if( RecursoInstituicaoLocalizador.buscaPorCodigoDoRecurso( conexao, codigoValidado ) != null ) {
			throw new ArgousFormsApiException( 409, "CODIGO_EM_USO", "Já existe um recurso da instituição com este código." );
		}
		RecursoInstituicao recurso = new RecursoInstituicao();
		recurso.setIdInstituicao( 1 );
		recurso.setIdArquivoVersao( idArquivoVersao );
		recurso.setCdRecurso( codigoValidado );
		new RecursoInstituicaoNegocio( conexao, recurso ).insere();
	}

	public void registrarProtocolo( Conexao conexao, AutenticacaoLocalService.Usuario usuario, UUID idProtocolo, UUID idArquivoVersao, String codigo ) throws Exception {

		exigirCriador( usuario );
		pastaProtocolo( conexao, usuario, idProtocolo );
		exigirRascunho( conexao, usuario, idProtocolo );
		String codigoValidado = codigo( codigo );
		if( ProtocoloRecursoLocalizador.buscaPorCodigoDoRecursoNoProtocolo( conexao, idProtocolo, codigoValidado ) != null ) {
			throw new ArgousFormsApiException( 409, "CODIGO_EM_USO", "Já existe um recurso neste Protocolo com este código." );
		}
		ProtocoloRecurso recurso = new ProtocoloRecurso();
		recurso.setIdProtocolo( idProtocolo );
		recurso.setIdArquivoVersao( idArquivoVersao );
		recurso.setCdRecurso( codigoValidado );
		new ProtocoloRecursoNegocio( conexao, recurso ).insere();
	}

	public JSONObject removerInstituicao( AutenticacaoLocalService.Usuario usuario, UUID idArquivoVersao ) throws Exception {

		exigirAdministrador( usuario );
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				RecursoInstituicao recurso = RecursoInstituicaoLocalizador.buscaRecursoInstituicao( conexao, 1, idArquivoVersao );
				if( recurso == null ) throw new ArgousFormsApiException( 404, "RECURSO_NAO_ENCONTRADO", "Recurso não encontrado." );
				if( existe( conexao, "select 1 from Processos.PROTOCOLO_RECURSOS where ID_ARQUIVO_VERSAO = ?", idArquivoVersao ) ) {
					throw new ArgousFormsApiException( 409, "RECURSO_EM_USO", "Este arquivo também está vinculado a um Protocolo." );
				}
				if( usadoEmHtmlPublicado( conexao, recurso.getCdRecurso(), null ) ) {
					throw new ArgousFormsApiException( 409, "RECURSO_EM_USO", "Este recurso aparece em documento publicado." );
				}
				new RecursoInstituicaoNegocio( conexao, recurso ).exclui();
				conexao.commit();
				return new JSONObject().put( "removido", true );
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	public JSONObject alterarCodigoInstituicao( AutenticacaoLocalService.Usuario usuario, UUID idArquivoVersao, String novoCodigo ) throws Exception {

		exigirAdministrador( usuario );
		String codigoValidado = codigo( novoCodigo );
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				RecursoInstituicao recurso = RecursoInstituicaoLocalizador.buscaRecursoInstituicao( conexao, 1, idArquivoVersao );
				if( recurso == null ) throw new ArgousFormsApiException( 404, "RECURSO_NAO_ENCONTRADO", "Recurso não encontrado." );
				if( !recurso.getCdRecurso().equals( codigoValidado ) ) {
					if( usadoEmHtmlPublicado( conexao, recurso.getCdRecurso(), null ) ) throw new ArgousFormsApiException( 409, "RECURSO_EM_USO", "O código aparece em documento publicado." );
					if( RecursoInstituicaoLocalizador.buscaPorCodigoDoRecurso( conexao, codigoValidado ) != null ) throw new ArgousFormsApiException( 409, "CODIGO_EM_USO", "Já existe um recurso da instituição com este código." );
					recurso.setCdRecurso( codigoValidado );
					new RecursoInstituicaoNegocio( conexao, recurso ).altera();
				}
				conexao.commit();
				return new JSONObject().put( "codigo", codigoValidado );
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	public JSONObject removerProtocolo( AutenticacaoLocalService.Usuario usuario, UUID idProtocolo, UUID idRecurso ) throws Exception {

		exigirCriador( usuario );
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				pastaProtocolo( conexao, usuario, idProtocolo );
				exigirRascunho( conexao, usuario, idProtocolo );
				ProtocoloRecurso recurso = ProtocoloRecursoLocalizador.buscaProtocoloRecurso( conexao, idRecurso );
				if( recurso == null || !idProtocolo.equals( recurso.getIdProtocolo() ) ) throw new ArgousFormsApiException( 404, "RECURSO_NAO_ENCONTRADO", "Recurso não encontrado." );
				if( usadoEmHtmlPublicado( conexao, recurso.getCdRecurso(), idProtocolo ) ) {
					throw new ArgousFormsApiException( 409, "RECURSO_EM_USO", "Este recurso aparece em documento publicado." );
				}
				new ProtocoloRecursoNegocio( conexao, recurso ).exclui();
				conexao.commit();
				return new JSONObject().put( "removido", true );
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	public JSONObject alterarCodigoProtocolo( AutenticacaoLocalService.Usuario usuario, UUID idProtocolo, UUID idRecurso, String novoCodigo ) throws Exception {

		exigirCriador( usuario );
		String codigoValidado = codigo( novoCodigo );
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				pastaProtocolo( conexao, usuario, idProtocolo );
				exigirRascunho( conexao, usuario, idProtocolo );
				ProtocoloRecurso recurso = ProtocoloRecursoLocalizador.buscaProtocoloRecurso( conexao, idRecurso );
				if( recurso == null || !idProtocolo.equals( recurso.getIdProtocolo() ) ) throw new ArgousFormsApiException( 404, "RECURSO_NAO_ENCONTRADO", "Recurso não encontrado." );
				if( !recurso.getCdRecurso().equals( codigoValidado ) ) {
					if( usadoEmHtmlPublicado( conexao, recurso.getCdRecurso(), idProtocolo ) ) throw new ArgousFormsApiException( 409, "RECURSO_EM_USO", "O código aparece em documento publicado." );
					if( ProtocoloRecursoLocalizador.buscaPorCodigoDoRecursoNoProtocolo( conexao, idProtocolo, codigoValidado ) != null ) throw new ArgousFormsApiException( 409, "CODIGO_EM_USO", "Já existe um recurso neste Protocolo com este código." );
					recurso.setCdRecurso( codigoValidado );
					new ProtocoloRecursoNegocio( conexao, recurso ).altera();
				}
				conexao.commit();
				return new JSONObject().put( "codigo", codigoValidado );
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	private boolean usadoEmHtmlPublicado( Conexao conexao, String codigo, UUID idProtocolo ) throws Exception {

		String sql = "select 1 from Processos.PROTOCOLO_DOCUMENTO_HTML_PARTES h join Processos.PROTOCOLO_DOCUMENTO_VERSOES v on v.ID_PROTOCOLO_DOCUMENTO_VERSAO = h.ID_PROTOCOLO_DOCUMENTO_VERSAO join Processos.PROTOCOLO_DOCUMENTOS p on p.ID_PROTOCOLO_DOCUMENTO = v.ID_PROTOCOLO_DOCUMENTO where v.DT_PUBLICACAO is not null and position(? in h.TX_HTML) > 0";
		if( idProtocolo != null ) sql += " and p.ID_PROTOCOLO = ?";
		return idProtocolo == null ? existe( conexao, sql, codigo ) : existe( conexao, sql, codigo, idProtocolo );
	}

	private UUID pastaProtocolo( Conexao conexao, AutenticacaoLocalService.Usuario usuario, UUID idProtocolo ) throws Exception {

		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( "select ID_PASTA from Processos.PROTOCOLOS where ID_PROTOCOLO = ? and ID_USUARIO_CRIADOR = ?" ) ) {
			consulta.setObject( 1, idProtocolo );
			consulta.setObject( 2, usuario.idUsuario() );
			try ( ResultSet linha = consulta.executeQuery() ) {
				if( !linha.next() ) throw new ArgousFormsApiException( 404, "PROTOCOLO_NAO_ENCONTRADO", "Protocolo não encontrado." );
				return linha.getObject( 1, UUID.class );
			}
		}
	}

	private void exigirRascunho( Conexao conexao, AutenticacaoLocalService.Usuario usuario, UUID idProtocolo ) throws Exception {

		if( !existe( conexao, "select 1 from Processos.PROTOCOLO_VERSOES where ID_PROTOCOLO = ? and NR_VERSAO = -1 and ID_USUARIO_RESPONSAVEL = ?", idProtocolo, usuario.idUsuario() ) ) {
			throw new ArgousFormsApiException( 409, "RASCUNHO_NAO_ENCONTRADO", "O Protocolo não possui rascunho editável por você." );
		}
	}

	private boolean existe( Conexao conexao, String sql, Object... valores ) throws Exception {

		try ( PreparedStatement consulta = conexao.getConnection().prepareStatement( sql ) ) {
			for( int i = 0; i < valores.length; i++ ) consulta.setObject( i + 1, valores[ i ] );
			try ( ResultSet linha = consulta.executeQuery() ) { return linha.next(); }
		}
	}

	private String codigo( String informado ) throws ArgousFormsApiException {

		String codigo = informado == null ? "" : informado.strip();
		if( codigo.isEmpty() || codigo.length() > 40 ) throw new ArgousFormsApiException( 400, "CODIGO_INVALIDO", "Informe um código de recurso com até 40 caracteres." );
		return codigo;
	}

	private void exigirAdministrador( AutenticacaoLocalService.Usuario usuario ) throws ArgousFormsApiException {

		if( !usuario.papeis().contains( "ADMINISTRADOR_INSTITUICAO" ) ) throw new ArgousFormsApiException( 403, "ACESSO_NEGADO", "Seu usuário não administra os recursos da instituição." );
	}

	private void exigirCriador( AutenticacaoLocalService.Usuario usuario ) throws ArgousFormsApiException {

		if( !( usuario.papeis().contains( "CRIADOR_DE_PROTOCOLOS" ) || usuario.papeis().contains( "MODELADOR" ) ) ) {
			throw new ArgousFormsApiException( 403, "ACESSO_NEGADO", "Seu usuário não pode editar Protocolos." );
		}
	}
}
