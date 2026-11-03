package br.com.argousForms.organizacao;

import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

import org.json.JSONArray;
import org.json.JSONObject;

import br.com.argousForms.api.ArgousFormsApiException;
import br.com.argousForms.model.negocio.cadastro.UsuarioGrupoNegocio;
import br.com.argousForms.model.negocio.cadastro.UsuarioTagNegocio;
import br.com.argousForms.model.negocio.cadastro.VinculoTagNegocio;
import br.com.argousForms.model.persistencia.cadastro.UsuarioGrupo;
import br.com.argousForms.model.persistencia.cadastro.UsuarioGrupoLocalizador;
import br.com.argousForms.model.persistencia.cadastro.UsuarioTag;
import br.com.argousForms.model.persistencia.cadastro.UsuarioTagLocalizador;
import br.com.argousForms.model.persistencia.cadastro.VinculoTag;
import br.com.argousForms.model.persistencia.cadastro.VinculoTagLocalizador;
import quatro.sql.Conexao;
import quatro.sql.PoolDeConexoes;
import quatro.sql.Query;
import quatro.util.QtData;

public final class VinculosOrganizacaoService {

	public JSONObject listar() throws Exception {

		JSONArray usuarios = new JSONArray();
		JSONArray grupos = new JSONArray();
		JSONArray tagsUsuario = new JSONArray();
		JSONArray tagsVinculo = new JSONArray();
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			try ( Query query = new Query( conexao ) ) {
				query.setSQL( "select ID_USUARIO_SISTEMA, DS_NOME, DS_EMAIL from Cadastro.USUARIOS_SISTEMA where DT_EXCLUSAO is null order by DS_NOME, ID_USUARIO_SISTEMA" );
				query.executeQuery();
				if( !query.isEmpty() ) do {
					usuarios.put( new JSONObject().put( "idUsuario", query.getString( "ID_USUARIO_SISTEMA" ) ).put( "nome", query.getString( "DS_NOME" ) ).put( "email", query.getString( "DS_EMAIL" ) ) );
				} while ( query.next() );
			}
			try ( Query query = new Query( conexao ) ) {
				query.setSQL( "select ID_USUARIO_SISTEMA, ID_GRUPO, SN_ATIVO from Cadastro.USUARIO_GRUPOS order by ID_GRUPO, ID_USUARIO_SISTEMA" );
				query.executeQuery();
				if( !query.isEmpty() ) do {
					grupos.put( new JSONObject().put( "idUsuario", query.getString( "ID_USUARIO_SISTEMA" ) ).put( "idGrupo", query.getInt( "ID_GRUPO" ) ).put( "ativo", query.getBoolean( "SN_ATIVO" ) ) );
				} while ( query.next() );
			}
			try ( Query query = new Query( conexao ) ) {
				query.setSQL( "select ID_USUARIO_SISTEMA, CD_TAG, SN_ATIVA from Cadastro.USUARIO_TAGS order by ID_USUARIO_SISTEMA, CD_TAG" );
				query.executeQuery();
				if( !query.isEmpty() ) do {
					tagsUsuario.put( new JSONObject().put( "idUsuario", query.getString( "ID_USUARIO_SISTEMA" ) ).put( "codigo", query.getString( "CD_TAG" ) ).put( "ativo", query.getBoolean( "SN_ATIVA" ) ) );
				} while ( query.next() );
			}
			try ( Query query = new Query( conexao ) ) {
				query.setSQL( "select ID_USUARIO_SISTEMA, ID_GRUPO, CD_TAG, SN_ATIVO from Cadastro.VINCULO_TAGS order by ID_GRUPO, ID_USUARIO_SISTEMA, CD_TAG" );
				query.executeQuery();
				if( !query.isEmpty() ) do {
					tagsVinculo.put( new JSONObject().put( "idUsuario", query.getString( "ID_USUARIO_SISTEMA" ) ).put( "idGrupo", query.getInt( "ID_GRUPO" ) ).put( "codigo", query.getString( "CD_TAG" ) ).put( "ativo", query.getBoolean( "SN_ATIVO" ) ) );
				} while ( query.next() );
			}
		}
		return new JSONObject().put( "usuarios", usuarios ).put( "vinculos", grupos ).put( "tagsUsuario", tagsUsuario ).put( "tagsVinculo", tagsVinculo );
	}

	public void salvarVinculo( UUID idUsuario, int idGrupo, boolean ativo ) throws Exception {

		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				exigirUsuario( conexao, idUsuario );
				exigirGrupo( conexao, idGrupo, ativo );
				QtData agora = new QtData( Instant.now().toEpochMilli() );
				UsuarioGrupo vinculo = localizarVinculo( conexao, idUsuario, idGrupo );
				if( vinculo == null && !ativo ) throw new ArgousFormsApiException( 404, "VINCULO_NAO_ENCONTRADO", "Vínculo não encontrado." );
				if( vinculo == null ) {
					vinculo = new UsuarioGrupo();
					vinculo.setIdUsuarioSistema( idUsuario );
					vinculo.setIdGrupo( idGrupo );
					vinculo.setSnAtivo( true );
					vinculo.setDtInclusao( agora );
					vinculo.setDtAlteracao( agora );
					new UsuarioGrupoNegocio( conexao, vinculo ).insere();
				} else if( vinculo.isSnAtivo() != ativo ) {
					vinculo.setSnAtivo( ativo );
					vinculo.setDtAlteracao( agora );
					new UsuarioGrupoNegocio( conexao, vinculo ).altera();
				}
				if( !ativo ) desativarTagsVinculo( conexao, idUsuario, idGrupo, agora );
				conexao.commit();
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	public void salvarTagUsuario( UUID idUsuario, String codigoInformado, boolean ativo ) throws Exception {

		String codigo = codigo( codigoInformado );
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				exigirUsuario( conexao, idUsuario );
				if( ativo ) exigirTag( conexao, codigo, "SN_USUARIO" );
				QtData agora = new QtData( Instant.now().toEpochMilli() );
				UsuarioTag vinculo = new UsuarioTag();
				try ( Query query = new Query( conexao ) ) {
					query.setSQL( "select * from Cadastro.USUARIO_TAGS where ID_USUARIO_SISTEMA = :usuario and CD_TAG = :codigo" );
					query.setParameter( "usuario", idUsuario.toString() );
					query.setParameter( "codigo", codigo );
					query.executeQuery();
					if( !query.isEmpty() ) UsuarioTagLocalizador.buscaCampos( vinculo, query );
				}
				if( vinculo.getCdTag() == null && !ativo ) throw new ArgousFormsApiException( 404, "VINCULO_NAO_ENCONTRADO", "Tag do usuário não encontrada." );
				if( vinculo.getCdTag() == null ) {
					vinculo.setIdUsuarioSistema( idUsuario );
					vinculo.setCdTag( codigo );
					vinculo.setSnAtiva( true );
					vinculo.setDtInclusao( agora );
					vinculo.setDtAlteracao( agora );
					new UsuarioTagNegocio( conexao, vinculo ).insere();
				} else if( vinculo.isSnAtiva() != ativo ) {
					vinculo.setSnAtiva( ativo );
					vinculo.setDtAlteracao( agora );
					new UsuarioTagNegocioSeguro( conexao, vinculo ).altera();
				}
				conexao.commit();
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	public void salvarTagVinculo( UUID idUsuario, int idGrupo, String codigoInformado, boolean ativo ) throws Exception {

		String codigo = codigo( codigoInformado );
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				exigirUsuario( conexao, idUsuario );
				exigirGrupo( conexao, idGrupo, ativo );
				UsuarioGrupo grupo = localizarVinculo( conexao, idUsuario, idGrupo );
				if( grupo == null || !grupo.isSnAtivo() ) throw new ArgousFormsApiException( 409, "VINCULO_INATIVO", "O usuário precisa estar ativo no grupo." );
				if( ativo ) exigirTag( conexao, codigo, "SN_VINCULO" );
				QtData agora = new QtData( Instant.now().toEpochMilli() );
				VinculoTag vinculo = new VinculoTag();
				try ( Query query = new Query( conexao ) ) {
					query.setSQL( "select * from Cadastro.VINCULO_TAGS where ID_USUARIO_SISTEMA = :usuario and ID_GRUPO = :grupo and CD_TAG = :codigo" );
					query.setParameter( "usuario", idUsuario.toString() );
					query.setParameter( "grupo", idGrupo );
					query.setParameter( "codigo", codigo );
					query.executeQuery();
					if( !query.isEmpty() ) VinculoTagLocalizador.buscaCampos( vinculo, query );
				}
				if( vinculo.getCdTag() == null && !ativo ) throw new ArgousFormsApiException( 404, "VINCULO_NAO_ENCONTRADO", "Tag do vínculo não encontrada." );
				if( vinculo.getCdTag() == null ) {
					vinculo.setIdUsuarioSistema( idUsuario );
					vinculo.setIdGrupo( idGrupo );
					vinculo.setCdTag( codigo );
					vinculo.setSnAtivo( true );
					vinculo.setDtInclusao( agora );
					vinculo.setDtAlteracao( agora );
					new VinculoTagNegocio( conexao, vinculo ).insere();
				} else if( vinculo.isSnAtivo() != ativo ) {
					vinculo.setSnAtivo( ativo );
					vinculo.setDtAlteracao( agora );
					new VinculoTagNegocioSeguro( conexao, vinculo ).altera();
				}
				conexao.commit();
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	public void desativarUsuario( Conexao conexao, UUID idUsuario ) throws Exception {

		QtData agora = new QtData( Instant.now().toEpochMilli() );
		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select * from Cadastro.VINCULO_TAGS where ID_USUARIO_SISTEMA = :id and SN_ATIVO = true" );
			query.setParameter( "id", idUsuario.toString() );
			query.executeQuery();
			if( !query.isEmpty() ) do {
				VinculoTag tag = new VinculoTag();
				VinculoTagLocalizador.buscaCampos( tag, query );
				tag.setSnAtivo( false );
				tag.setDtAlteracao( agora );
				new VinculoTagNegocioSeguro( conexao, tag ).altera();
			} while ( query.next() );
		}
		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select * from Cadastro.USUARIO_TAGS where ID_USUARIO_SISTEMA = :id and SN_ATIVA = true" );
			query.setParameter( "id", idUsuario.toString() );
			query.executeQuery();
			if( !query.isEmpty() ) do {
				UsuarioTag tag = new UsuarioTag();
				UsuarioTagLocalizador.buscaCampos( tag, query );
				tag.setSnAtiva( false );
				tag.setDtAlteracao( agora );
				new UsuarioTagNegocioSeguro( conexao, tag ).altera();
			} while ( query.next() );
		}
		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select * from Cadastro.USUARIO_GRUPOS where ID_USUARIO_SISTEMA = :id and SN_ATIVO = true" );
			query.setParameter( "id", idUsuario.toString() );
			query.executeQuery();
			if( !query.isEmpty() ) do {
				UsuarioGrupo grupo = new UsuarioGrupo();
				UsuarioGrupoLocalizador.buscaCampos( grupo, query );
				grupo.setSnAtivo( false );
				grupo.setDtAlteracao( agora );
				new UsuarioGrupoNegocio( conexao, grupo ).altera();
			} while ( query.next() );
		}
	}

	private void exigirUsuario( Conexao conexao, UUID idUsuario ) throws Exception {

		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select 1 from Cadastro.USUARIOS_SISTEMA where ID_USUARIO_SISTEMA = :id and DT_EXCLUSAO is null" );
			query.setParameter( "id", idUsuario.toString() );
			query.executeQuery();
			if( query.isEmpty() ) throw new ArgousFormsApiException( 404, "USUARIO_NAO_ENCONTRADO", "Usuário não encontrado." );
		}
	}

	private void exigirGrupo( Conexao conexao, int idGrupo, boolean ativo ) throws Exception {

		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select SN_ATIVO from Cadastro.GRUPOS where ID_GRUPO = :id" );
			query.setParameter( "id", idGrupo );
			query.executeQuery();
			if( query.isEmpty() ) throw new ArgousFormsApiException( 404, "GRUPO_NAO_ENCONTRADO", "Grupo não encontrado." );
			if( ativo && !query.getBoolean( "SN_ATIVO" ) ) throw new ArgousFormsApiException( 409, "GRUPO_INATIVO", "Não é possível adicionar usuários a um grupo inativo." );
		}
	}

	private void exigirTag( Conexao conexao, String codigo, String coluna ) throws Exception {

		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select 1 from Cadastro.TAGS where CD_TAG = :codigo and SN_ATIVA = true and " + coluna + " = true" );
			query.setParameter( "codigo", codigo );
			query.executeQuery();
			if( query.isEmpty() ) throw new ArgousFormsApiException( 409, "TAG_INDISPONIVEL", "A tag não está ativa ou não permite esta aplicação." );
		}
	}

	private UsuarioGrupo localizarVinculo( Conexao conexao, UUID idUsuario, int idGrupo ) throws Exception {

		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select * from Cadastro.USUARIO_GRUPOS where ID_USUARIO_SISTEMA = :usuario and ID_GRUPO = :grupo" );
			query.setParameter( "usuario", idUsuario.toString() );
			query.setParameter( "grupo", idGrupo );
			query.executeQuery();
			if( query.isEmpty() ) return null;
			UsuarioGrupo vinculo = new UsuarioGrupo();
			UsuarioGrupoLocalizador.buscaCampos( vinculo, query );
			return vinculo;
		}
	}

	private void desativarTagsVinculo( Conexao conexao, UUID idUsuario, int idGrupo, QtData agora ) throws Exception {

		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select * from Cadastro.VINCULO_TAGS where ID_USUARIO_SISTEMA = :usuario and ID_GRUPO = :grupo and SN_ATIVO = true" );
			query.setParameter( "usuario", idUsuario.toString() );
			query.setParameter( "grupo", idGrupo );
			query.executeQuery();
			if( !query.isEmpty() ) do {
				VinculoTag tag = new VinculoTag();
				VinculoTagLocalizador.buscaCampos( tag, query );
				tag.setSnAtivo( false );
				tag.setDtAlteracao( agora );
				new VinculoTagNegocioSeguro( conexao, tag ).altera();
			} while ( query.next() );
		}
	}

	private String codigo( String informado ) throws ArgousFormsApiException {

		String codigo = informado == null ? "" : informado.strip().toUpperCase( Locale.ROOT );
		if( codigo.isEmpty() || codigo.length() > 30 ) throw new ArgousFormsApiException( 400, "TAG_INVALIDA", "Informe um código de tag válido." );
		return codigo;
	}
}
