package br.com.argousForms.organizacao;

import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.json.JSONArray;
import org.json.JSONObject;

import br.com.argousForms.api.ArgousFormsApiException;
import br.com.argousForms.model.negocio.cadastro.GrupoNegocio;
import br.com.argousForms.model.negocio.cadastro.GrupoTagNegocio;
import br.com.argousForms.model.negocio.cadastro.TagNegocio;
import br.com.argousForms.model.persistencia.cadastro.Grupo;
import br.com.argousForms.model.persistencia.cadastro.GrupoLocalizador;
import br.com.argousForms.model.persistencia.cadastro.GrupoTag;
import br.com.argousForms.model.persistencia.cadastro.GrupoTagLocalizador;
import br.com.argousForms.model.persistencia.cadastro.Tag;
import br.com.argousForms.model.persistencia.cadastro.TagLocalizador;
import quatro.sql.Conexao;
import quatro.sql.PoolDeConexoes;
import quatro.sql.Query;
import quatro.util.QtData;

public final class OrganizacaoService {

	public JSONObject listar() throws Exception {

		JSONArray grupos = new JSONArray();
		JSONArray tags = new JSONArray();
		Map<Integer, JSONObject> gruposPorId = new HashMap<>();
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			try ( Query query = new Query( conexao ) ) {
				query.setSQL( "select ID_GRUPO, DS_NOME_GRUPO, SN_ATIVO from Cadastro.GRUPOS order by DS_NOME_GRUPO, ID_GRUPO" );
				query.executeQuery();
				if( !query.isEmpty() ) {
					do {
						JSONObject grupo = new JSONObject();
						grupo.put( "idGrupo", query.getInt( "ID_GRUPO" ) );
						grupo.put( "nome", query.getString( "DS_NOME_GRUPO" ) );
						grupo.put( "ativo", query.getBoolean( "SN_ATIVO" ) );
						grupo.put( "tags", new JSONArray() );
						grupos.put( grupo );
						gruposPorId.put( query.getInt( "ID_GRUPO" ), grupo );
					} while ( query.next() );
				}
			}
			try ( Query query = new Query( conexao ) ) {
				query.setSQL( "select ID_GRUPO, CD_TAG from Cadastro.GRUPO_TAGS where SN_ATIVA = true order by ID_GRUPO, CD_TAG" );
				query.executeQuery();
				if( !query.isEmpty() ) {
					do {
						JSONObject grupo = gruposPorId.get( query.getInt( "ID_GRUPO" ) );
						if( grupo != null ) grupo.getJSONArray( "tags" ).put( query.getString( "CD_TAG" ) );
					} while ( query.next() );
				}
			}
			try ( Query query = new Query( conexao ) ) {
				query.setSQL( "select CD_TAG, DS_TAG, SN_GRUPO, SN_USUARIO, SN_VINCULO, SN_ATIVA from Cadastro.TAGS order by CD_TAG" );
				query.executeQuery();
				if( !query.isEmpty() ) {
					do {
						JSONObject tag = new JSONObject();
						tag.put( "codigo", query.getString( "CD_TAG" ) );
						tag.put( "descricao", query.getString( "DS_TAG" ) );
						tag.put( "ativo", query.getBoolean( "SN_ATIVA" ) );
						tag.put( "grupo", query.getBoolean( "SN_GRUPO" ) );
						tag.put( "usuario", query.getBoolean( "SN_USUARIO" ) );
						tag.put( "vinculo", query.getBoolean( "SN_VINCULO" ) );
						tags.put( tag );
					} while ( query.next() );
				}
			}
		}
		return new JSONObject().put( "grupos", grupos ).put( "tags", tags );
	}

	public int salvarGrupo( Integer idGrupo, String nomeInformado, boolean ativo, List<String> codigosTags ) throws Exception {

		String nome = nomeInformado == null ? "" : nomeInformado.strip();
		if( nome.isEmpty() || nome.length() > 50 ) throw new ArgousFormsApiException( 400, "GRUPO_INVALIDO", "Informe um nome de grupo com até 50 caracteres." );
		Set<String> tagsDesejadas = new LinkedHashSet<>();
		for( String codigoInformado : codigosTags ) {
			String codigo = codigoInformado.strip().toUpperCase( Locale.ROOT );
			if( codigo.isEmpty() || codigo.length() > 30 || !tagsDesejadas.add( codigo ) ) {
				throw new ArgousFormsApiException( 400, "TAGS_GRUPO_INVALIDAS", "Informe tags de grupo válidas, sem repetições." );
			}
		}

		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				QtData agora = new QtData( Instant.now().toEpochMilli() );
				Grupo grupo;
				if( idGrupo == null ) {
					grupo = new Grupo();
					grupo.setDtInclusao( agora );
				} else {
					try ( Query query = new Query( conexao ) ) {
						query.setSQL( "select * from Cadastro.GRUPOS where ID_GRUPO = :id" );
						query.setParameter( "id", idGrupo );
						query.executeQuery();
						if( query.isEmpty() ) throw new ArgousFormsApiException( 404, "GRUPO_NAO_ENCONTRADO", "Grupo não encontrado." );
						grupo = new Grupo();
						GrupoLocalizador.buscaCampos( grupo, query );
					}
				}
				grupo.setDsNomeGrupo( nome );
				grupo.setSnAtivo( ativo );
				grupo.setDtAlteracao( agora );
				if( idGrupo == null ) new GrupoNegocio( conexao, grupo ).insere();
				else new GrupoNegocio( conexao, grupo ).altera();
				sincronizarTagsGrupo( conexao, grupo.getIdGrupo(), tagsDesejadas, agora );
				conexao.commit();
				return grupo.getIdGrupo();
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	private void sincronizarTagsGrupo( Conexao conexao, int idGrupo, Set<String> tagsDesejadas, QtData agora ) throws Exception {

		Map<String, GrupoTag> existentes = new HashMap<>();
		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select * from Cadastro.GRUPO_TAGS where ID_GRUPO = :idGrupo" );
			query.setParameter( "idGrupo", idGrupo );
			query.executeQuery();
			if( !query.isEmpty() ) {
				do {
					GrupoTag vinculo = new GrupoTag();
					GrupoTagLocalizador.buscaCampos( vinculo, query );
					existentes.put( vinculo.getCdTag(), vinculo );
				} while ( query.next() );
			}
		}

		Set<String> elegiveis = new LinkedHashSet<>();
		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select CD_TAG from Cadastro.TAGS where SN_GRUPO = true and SN_ATIVA = true" );
			query.executeQuery();
			if( !query.isEmpty() ) {
				do {
					elegiveis.add( query.getString( "CD_TAG" ) );
				} while ( query.next() );
			}
		}

		for( String codigo : tagsDesejadas ) {
			GrupoTag existente = existentes.get( codigo );
			if( ( existente == null || !existente.isSnAtiva() ) && !elegiveis.contains( codigo ) ) {
				throw new ArgousFormsApiException( 400, "TAG_GRUPO_INDISPONIVEL", "A tag " + codigo + " não está ativa ou não pode ser aplicada a grupos." );
			}
		}

		for( GrupoTag vinculo : existentes.values() ) {
			boolean desejada = tagsDesejadas.contains( vinculo.getCdTag() );
			if( vinculo.isSnAtiva() == desejada ) continue;
			vinculo.setSnAtiva( desejada );
			vinculo.setDtAlteracao( agora );
			new GrupoTagNegocioSeguro( conexao, vinculo ).altera();
		}

		for( String codigo : tagsDesejadas ) {
			if( existentes.containsKey( codigo ) ) continue;
			GrupoTag vinculo = new GrupoTag();
			vinculo.setIdGrupo( idGrupo );
			vinculo.setCdTag( codigo );
			vinculo.setSnAtiva( true );
			vinculo.setDtInclusao( agora );
			vinculo.setDtAlteracao( agora );
			new GrupoTagNegocio( conexao, vinculo ).insere();
		}
	}

	public String criarTag( String codigoInformado, String descricaoInformada, boolean grupo, boolean usuario, boolean vinculo ) throws Exception {

		String codigo = codigoInformado == null ? "" : codigoInformado.strip().toUpperCase( Locale.ROOT );
		String descricao = descricaoInformada == null ? "" : descricaoInformada.strip();
		validarTag( codigo, descricao, grupo, usuario, vinculo );

		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				try ( Query query = new Query( conexao ) ) {
					query.setSQL( "select CD_TAG from Cadastro.TAGS where CD_TAG = :codigo" );
					query.setParameter( "codigo", codigo );
					query.executeQuery();
					if( !query.isEmpty() ) throw new ArgousFormsApiException( 409, "TAG_JA_EXISTE", "Já existe uma tag com esse código." );
				}
				QtData agora = new QtData( Instant.now().toEpochMilli() );
				Tag tag = new Tag();
				tag.setCdTag( codigo );
				tag.setDsTag( descricao.isEmpty() ? null : descricao );
				tag.setSnGrupo( grupo );
				tag.setSnUsuario( usuario );
				tag.setSnVinculo( vinculo );
				tag.setSnAtiva( true );
				tag.setDtInclusao( agora );
				tag.setDtAlteracao( agora );
				new TagNegocio( conexao, tag ).insere();
				conexao.commit();
				return codigo;
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	public String alterarTag( String codigoInformado, String descricaoInformada, boolean grupo, boolean usuario, boolean vinculo, boolean ativa ) throws Exception {

		String codigo = codigoInformado == null ? "" : codigoInformado.strip().toUpperCase( Locale.ROOT );
		String descricao = descricaoInformada == null ? "" : descricaoInformada.strip();
		validarTag( codigo, descricao, grupo, usuario, vinculo );

		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				Tag tag = new Tag();
				try ( Query query = new Query( conexao ) ) {
					query.setSQL( "select * from Cadastro.TAGS where CD_TAG = :codigo" );
					query.setParameter( "codigo", codigo );
					query.executeQuery();
					if( query.isEmpty() ) throw new ArgousFormsApiException( 404, "TAG_NAO_ENCONTRADA", "Tag não encontrada." );
					TagLocalizador.buscaCampos( tag, query );
				}

				if( tag.isSnGrupo() && !grupo ) exigirSemVinculos( conexao, "Cadastro.GRUPO_TAGS", "SN_ATIVA", codigo, "grupo" );
				if( tag.isSnUsuario() && !usuario ) exigirSemVinculos( conexao, "Cadastro.USUARIO_TAGS", "SN_ATIVA", codigo, "usuário" );
				if( tag.isSnVinculo() && !vinculo ) exigirSemVinculos( conexao, "Cadastro.VINCULO_TAGS", "SN_ATIVO", codigo, "vínculo" );

				tag.setDsTag( descricao.isEmpty() ? null : descricao );
				tag.setSnGrupo( grupo );
				tag.setSnUsuario( usuario );
				tag.setSnVinculo( vinculo );
				tag.setSnAtiva( ativa );
				tag.setDtAlteracao( new QtData( Instant.now().toEpochMilli() ) );
				new TagNegocio( conexao, tag ).altera();
				conexao.commit();
				return codigo;
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	private void validarTag( String codigo, String descricao, boolean grupo, boolean usuario, boolean vinculo ) throws ArgousFormsApiException {

		if( codigo.isEmpty() || codigo.length() > 30 || descricao.length() > 255 ) throw new ArgousFormsApiException( 400, "TAG_INVALIDA", "Informe um código de até 30 caracteres e uma descrição de até 255 caracteres." );
		if( !grupo && !usuario && !vinculo ) throw new ArgousFormsApiException( 400, "TIPO_TAG_INVALIDO", "Selecione ao menos uma aplicação para a tag." );
	}

	private void exigirSemVinculos( Conexao conexao, String tabela, String colunaAtiva, String codigo, String aplicacao ) throws Exception {

		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select count(*) from " + tabela + " where CD_TAG = :codigo and " + colunaAtiva + " = true" );
			query.setParameter( "codigo", codigo );
			query.executeQuery();
			if( query.getInt( 1 ) > 0 ) {
				throw new ArgousFormsApiException( 409, "TAG_EM_USO", "A tag já está vinculada a um " + aplicacao + ". Remova os vínculos antes de desmarcar esta aplicação." );
			}
		}
	}
}
