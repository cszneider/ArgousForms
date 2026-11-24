package br.com.argousForms.organizacao;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.json.JSONArray;
import org.json.JSONObject;

import br.com.argousForms.api.ArgousFormsApiException;
import br.com.argousForms.processos.ProcessosService;
import br.com.argousForms.model.negocio.cadastro.GrupoNegocio;
import br.com.argousForms.model.negocio.cadastro.GrupoTagNegocio;
import br.com.argousForms.model.negocio.cadastro.TagNegocio;
import br.com.argousForms.model.negocio.cadastro.UsuarioGrupoNegocio;
import br.com.argousForms.model.persistencia.cadastro.Grupo;
import br.com.argousForms.model.persistencia.cadastro.GrupoLocalizador;
import br.com.argousForms.model.persistencia.cadastro.GrupoTag;
import br.com.argousForms.model.persistencia.cadastro.GrupoTagLocalizador;
import br.com.argousForms.model.persistencia.cadastro.Tag;
import br.com.argousForms.model.persistencia.cadastro.TagLocalizador;
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

public final class OrganizacaoService {

	public JSONObject pendencias() throws Exception {

		JSONArray pendencias = new JSONArray();
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			try ( Query query = new Query( conexao ) ) {
				query.setSQL( "select g.ID_GRUPO, g.DS_NOME_GRUPO from Cadastro.GRUPOS g join Cadastro.GRUPO_TAGS gt on gt.ID_GRUPO = g.ID_GRUPO and gt.CD_TAG = 'departamento' and gt.SN_ATIVA = true where g.SN_ATIVO = true and not exists (select 1 from Cadastro.VINCULO_TAGS vt join Cadastro.USUARIO_GRUPOS ug on ug.ID_USUARIO_SISTEMA = vt.ID_USUARIO_SISTEMA and ug.ID_GRUPO = vt.ID_GRUPO and ug.SN_ATIVO = true join Cadastro.USUARIOS_SISTEMA u on u.ID_USUARIO_SISTEMA = vt.ID_USUARIO_SISTEMA and u.DT_EXCLUSAO is null where vt.ID_GRUPO = g.ID_GRUPO and vt.CD_TAG = 'gestor' and vt.SN_ATIVO = true) order by g.DS_NOME_GRUPO" );
				query.executeQuery();
				if( !query.isEmpty() ) do {
					pendencias.put( new JSONObject().put( "tipo", "departamento" ).put( "idGrupo", query.getInt( "ID_GRUPO" ) ).put( "titulo", query.getString( "DS_NOME_GRUPO" ) ).put( "descricao", "Departamento sem gestor" ) );
				} while ( query.next() );
			}
			ProcessosService processos = new ProcessosService();
			try ( Query query = new Query( conexao ) ) {
				query.setSQL( "select d.ID_ETAPA_DESTINATARIO as ID_REGRA, p.DS_TITULO as DS_PROTOCOLO, e.DS_TITULO as DS_ETAPA, d.ID_USUARIO_SISTEMA, d.ID_GRUPO, d.CD_TAG_GRUPO, d.CD_TAG_USUARIO, d.CD_TAG_VINCULO from Processos.PROTOCOLO_ETAPA_DESTINATARIOS d join Processos.PROTOCOLOS_ETAPAS e on e.ID_PROTOCOLO_ETAPA = d.ID_PROTOCOLO_ETAPA join Processos.PROTOCOLO_VERSOES v on v.ID_PROTOCOLO_VERSAO = e.ID_PROTOCOLO_VERSAO join Processos.PROTOCOLOS p on p.ID_PROTOCOLO = v.ID_PROTOCOLO where p.SN_ATIVO = true and v.TP_SITUACAO = 'P' and v.NR_VERSAO = (select max(v2.NR_VERSAO) from Processos.PROTOCOLO_VERSOES v2 where v2.ID_PROTOCOLO = p.ID_PROTOCOLO and v2.TP_SITUACAO = 'P')" );
				query.executeQuery();
				if( !query.isEmpty() ) do {
					UUID id = UUID.fromString( query.getString( "ID_REGRA" ) );
					if( !processos.regraTemElegivel( conexao, id, false ) ) pendencias.put( regraPendente( query, "destinatario" ) );
				} while ( query.next() );
			}
			try ( Query query = new Query( conexao ) ) {
				query.setSQL( "select d.ID_GESTOR_ELEGIVEL as ID_REGRA, p.DS_TITULO as DS_PROTOCOLO, null::text as DS_ETAPA, d.ID_USUARIO_SISTEMA, d.ID_GRUPO, d.CD_TAG_GRUPO, d.CD_TAG_USUARIO, d.CD_TAG_VINCULO from Processos.PROTOCOLO_GESTORES_ELEGIVEIS d join Processos.PROTOCOLO_VERSOES v on v.ID_PROTOCOLO_VERSAO = d.ID_PROTOCOLO_VERSAO join Processos.PROTOCOLOS p on p.ID_PROTOCOLO = v.ID_PROTOCOLO where p.SN_ATIVO = true and v.TP_SITUACAO = 'P' and v.NR_VERSAO = (select max(v2.NR_VERSAO) from Processos.PROTOCOLO_VERSOES v2 where v2.ID_PROTOCOLO = p.ID_PROTOCOLO and v2.TP_SITUACAO = 'P')" );
				query.executeQuery();
				if( !query.isEmpty() ) do {
					UUID id = UUID.fromString( query.getString( "ID_REGRA" ) );
					if( !processos.regraTemElegivel( conexao, id, true ) ) pendencias.put( regraPendente( query, "gestor" ) );
				} while ( query.next() );
			}
		}
		return new JSONObject().put( "pendencias", pendencias );
	}

	private JSONObject regraPendente( Query query, String tipo ) throws Exception {

		List<String> partes = new ArrayList<>();
		if( query.getString( "ID_USUARIO_SISTEMA" ) != null ) partes.add( "usuário específico" );
		if( query.getString( "ID_GRUPO" ) != null ) partes.add( "grupo " + query.getString( "ID_GRUPO" ) );
		if( query.getString( "CD_TAG_GRUPO" ) != null ) partes.add( "tag de grupo " + query.getString( "CD_TAG_GRUPO" ) );
		if( query.getString( "CD_TAG_USUARIO" ) != null ) partes.add( "tag de usuário " + query.getString( "CD_TAG_USUARIO" ) );
		if( query.getString( "CD_TAG_VINCULO" ) != null ) partes.add( "tag de vínculo " + query.getString( "CD_TAG_VINCULO" ) );
		return new JSONObject().put( "tipo", tipo ).put( "titulo", query.getString( "DS_PROTOCOLO" ) ).put( "etapa", query.getString( "DS_ETAPA" ) )
			.put( "descricao", ( "gestor".equals( tipo ) ? "Gestor elegível" : "Destinatário" ) + " sem pessoa disponível: " + String.join( " e ", partes ) );
	}

	public JSONObject listar() throws Exception {

		JSONArray grupos = new JSONArray();
		JSONArray tags = new JSONArray();
		Map<Integer, JSONObject> gruposPorId = new HashMap<>();
		Map<String, JSONObject> tagsPorCodigo = new HashMap<>();
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			try ( Query query = new Query( conexao ) ) {
				query.setSQL( "select ID_GRUPO, ID_GRUPO_SUPERIOR, DS_NOME_GRUPO, SN_ATIVO from Cadastro.GRUPOS order by DS_NOME_GRUPO, ID_GRUPO" );
				query.executeQuery();
				if( !query.isEmpty() ) {
					do {
						JSONObject grupo = new JSONObject();
						grupo.put( "idGrupo", query.getInt( "ID_GRUPO" ) );
						grupo.put( "idGrupoSuperior", query.getString( "ID_GRUPO_SUPERIOR" ) == null ? JSONObject.NULL : query.getInt( "ID_GRUPO_SUPERIOR" ) );
						grupo.put( "nome", query.getString( "DS_NOME_GRUPO" ) );
						grupo.put( "ativo", query.getBoolean( "SN_ATIVO" ) );
						grupo.put( "tags", new JSONArray() );
						grupo.put( "protocolos", new JSONArray() );
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
				query.setSQL( "select CD_TAG, DS_TAG, SN_GRUPO, SN_USUARIO, SN_VINCULO, SN_ATIVA, SN_SISTEMA, DS_NOME_EXIBICAO, SN_RESTRITA from Cadastro.TAGS order by CD_TAG" );
				query.executeQuery();
				if( !query.isEmpty() ) {
					do {
						JSONObject tag = new JSONObject();
						tag.put( "codigo", query.getString( "CD_TAG" ) );
						tag.put( "descricao", query.getString( "DS_TAG" ) );
						tag.put( "nomeExibicao", query.getString( "DS_NOME_EXIBICAO" ) == null ? query.getString( "CD_TAG" ) : query.getString( "DS_NOME_EXIBICAO" ) );
						tag.put( "sistema", query.getBoolean( "SN_SISTEMA" ) );
						tag.put( "restrita", query.getBoolean( "SN_RESTRITA" ) );
						tag.put( "uso", 0 );
						tag.put( "ativo", query.getBoolean( "SN_ATIVA" ) );
						tag.put( "grupo", query.getBoolean( "SN_GRUPO" ) );
						tag.put( "usuario", query.getBoolean( "SN_USUARIO" ) );
						tag.put( "vinculo", query.getBoolean( "SN_VINCULO" ) );
						tags.put( tag );
						tagsPorCodigo.put( query.getString( "CD_TAG" ), tag );
					} while ( query.next() );
				}
			}
			try ( Query query = new Query( conexao ) ) {
				query.setSQL( "select CD_TAG, count(*) as NR_USO from (select CD_TAG from Cadastro.GRUPO_TAGS where SN_ATIVA = true union all select CD_TAG from Cadastro.USUARIO_TAGS where SN_ATIVA = true union all select CD_TAG from Cadastro.VINCULO_TAGS where SN_ATIVO = true) uso group by CD_TAG" );
				query.executeQuery();
				if( !query.isEmpty() ) do {
					JSONObject tag = tagsPorCodigo.get( query.getString( "CD_TAG" ) );
					if( tag != null ) tag.put( "uso", query.getInt( "NR_USO" ) );
				} while ( query.next() );
			}
			try ( Query query = new Query( conexao ) ) {
				query.setSQL( "select distinct z.ID_GRUPO, p.DS_TITULO from (select d.ID_GRUPO, e.ID_PROTOCOLO_VERSAO from Processos.PROTOCOLO_ETAPA_DESTINATARIOS d join Processos.PROTOCOLOS_ETAPAS e on e.ID_PROTOCOLO_ETAPA = d.ID_PROTOCOLO_ETAPA where d.ID_GRUPO is not null union select g.ID_GRUPO, g.ID_PROTOCOLO_VERSAO from Processos.PROTOCOLO_GESTORES_ELEGIVEIS g where g.ID_GRUPO is not null) z join Processos.PROTOCOLO_VERSOES v on v.ID_PROTOCOLO_VERSAO = z.ID_PROTOCOLO_VERSAO join Processos.PROTOCOLOS p on p.ID_PROTOCOLO = v.ID_PROTOCOLO where p.SN_ATIVO = true and v.TP_SITUACAO = 'P' and v.NR_VERSAO = (select max(v2.NR_VERSAO) from Processos.PROTOCOLO_VERSOES v2 where v2.ID_PROTOCOLO = p.ID_PROTOCOLO and v2.TP_SITUACAO = 'P') order by z.ID_GRUPO, p.DS_TITULO" );
				query.executeQuery();
				if( !query.isEmpty() ) do {
					JSONObject grupo = gruposPorId.get( query.getInt( "ID_GRUPO" ) );
					if( grupo != null ) grupo.getJSONArray( "protocolos" ).put( query.getString( "DS_TITULO" ) );
				} while ( query.next() );
			}
		}
		return new JSONObject().put( "grupos", grupos ).put( "tags", tags );
	}

	public int salvarGrupo( Integer idGrupo, String nomeInformado, boolean ativo, List<String> codigosTags, Integer idGrupoSuperior ) throws Exception {

		String nome = nomeInformado == null ? "" : nomeInformado.strip();
		if( nome.isEmpty() || nome.length() > 50 ) throw new ArgousFormsApiException( 400, "GRUPO_INVALIDO", "Informe um nome de grupo com até 50 caracteres." );
		Set<String> tagsDesejadas = new LinkedHashSet<>();
		for( String codigoInformado : codigosTags ) {
			String codigo = codigoInformado.strip();
			if( codigo.isEmpty() || codigo.length() > 30 || !tagsDesejadas.add( codigo ) ) {
				throw new ArgousFormsApiException( 400, "TAGS_GRUPO_INVALIDAS", "Informe tags de grupo válidas, sem repetições." );
			}
		}
		if( idGrupoSuperior != null && ( idGrupoSuperior <= 0 || idGrupoSuperior.equals( idGrupo ) || !tagsDesejadas.contains( "departamento" ) ) ) {
			throw new ArgousFormsApiException( 400, "GRUPO_SUPERIOR_INVALIDO", "O superior deve ser outro departamento ativo." );
		}

		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				if( idGrupoSuperior != null ) {
					try ( Query query = new Query( conexao ) ) {
						query.setSQL( "select 1 from Cadastro.GRUPOS g join Cadastro.GRUPO_TAGS gt on gt.ID_GRUPO = g.ID_GRUPO and gt.CD_TAG = 'departamento' and gt.SN_ATIVA = true where g.ID_GRUPO = :id and g.SN_ATIVO = true" );
						query.setParameter( "id", idGrupoSuperior );
						query.executeQuery();
						if( query.isEmpty() ) throw new ArgousFormsApiException( 400, "GRUPO_SUPERIOR_INVALIDO", "O superior deve ser um departamento ativo." );
					}
				}
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
				grupo.setIdGrupoSuperior( idGrupoSuperior );
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

	public String criarTag( String codigoInformado, String descricaoInformada, boolean grupo, boolean usuario, boolean vinculo, String nomeExibicaoInformado, boolean restrita ) throws Exception {

		String codigo = codigoInformado == null ? "" : codigoInformado.strip().toUpperCase( Locale.ROOT );
		String descricao = descricaoInformada == null ? "" : descricaoInformada.strip();
		String nomeExibicao = nomeExibicaoInformado == null ? "" : nomeExibicaoInformado.strip();
		validarTag( codigo, descricao, grupo, usuario, vinculo );
		if( nomeExibicao.length() > 60 ) throw new ArgousFormsApiException( 400, "TAG_INVALIDA", "O nome exibido deve ter até 60 caracteres." );

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
				tag.setDsNomeExibicao( nomeExibicao.isEmpty() ? null : nomeExibicao );
				tag.setSnSistema( false );
				tag.setSnRestrita( restrita );
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

	public String alterarTag( String codigoInformado, String descricaoInformada, boolean grupo, boolean usuario, boolean vinculo, boolean ativa, String nomeExibicaoInformado, boolean restrita ) throws Exception {

		String codigo = codigoInformado == null ? "" : codigoInformado.strip();
		String descricao = descricaoInformada == null ? "" : descricaoInformada.strip();
		String nomeExibicao = nomeExibicaoInformado == null ? "" : nomeExibicaoInformado.strip();
		if( nomeExibicao.length() > 60 ) throw new ArgousFormsApiException( 400, "TAG_INVALIDA", "O nome exibido deve ter até 60 caracteres." );

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
				if( Boolean.TRUE.equals( tag.isSnSistema() ) ) {
					if( tag.isSnGrupo() != grupo || tag.isSnUsuario() != usuario || tag.isSnVinculo() != vinculo || !ativa || !descricao.equals( tag.getDsTag() == null ? "" : tag.getDsTag() ) || restrita != Boolean.TRUE.equals( tag.isSnRestrita() ) ) {
						throw new ArgousFormsApiException( 400, "TAG_SISTEMA_IMUTAVEL", "Na tag do sistema, somente o nome exibido pode mudar." );
					}
				} else validarTag( codigo, descricao, grupo, usuario, vinculo );

				if( tag.isSnGrupo() && !grupo ) exigirSemVinculos( conexao, "Cadastro.GRUPO_TAGS", "SN_ATIVA", codigo, "grupo" );
				if( tag.isSnUsuario() && !usuario ) exigirSemVinculos( conexao, "Cadastro.USUARIO_TAGS", "SN_ATIVA", codigo, "usuário" );
				if( tag.isSnVinculo() && !vinculo ) exigirSemVinculos( conexao, "Cadastro.VINCULO_TAGS", "SN_ATIVO", codigo, "vínculo" );

				tag.setDsTag( descricao.isEmpty() ? null : descricao );
				tag.setDsNomeExibicao( nomeExibicao.isEmpty() ? null : nomeExibicao );
				tag.setSnRestrita( restrita );
				tag.setSnGrupo( grupo );
				tag.setSnUsuario( usuario );
				tag.setSnVinculo( vinculo );
				tag.setSnAtiva( ativa );
				tag.setDtAlteracao( new QtData( Instant.now().toEpochMilli() ) );
				new TagNegocioSeguro( conexao, tag ).altera();
				conexao.commit();
				return codigo;
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	public String removerGrupo( int idGrupo ) throws Exception {

		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				Grupo grupo = new Grupo();
				try ( Query query = new Query( conexao ) ) {
					query.setSQL( "select * from Cadastro.GRUPOS where ID_GRUPO = :id" );
					query.setParameter( "id", idGrupo );
					query.executeQuery();
					if( query.isEmpty() ) throw new ArgousFormsApiException( 404, "GRUPO_NAO_ENCONTRADO", "Grupo não encontrado." );
					GrupoLocalizador.buscaCampos( grupo, query );
				}
				boolean utilizado = existe( conexao, "select 1 from Processos.PROTOCOLO_ETAPA_DESTINATARIOS where ID_GRUPO = :id", idGrupo )
					|| existe( conexao, "select 1 from Processos.PROTOCOLO_GESTORES_ELEGIVEIS where ID_GRUPO = :id", idGrupo )
					|| existe( conexao, "select 1 from Docs.PASTA_PERMISSOES where ID_GRUPO = :id", idGrupo )
					|| existe( conexao, "select 1 from Docs.ARQUIVO_PERMISSOES where ID_GRUPO = :id", idGrupo );
				if( utilizado ) {
					if( grupo.isSnAtivo() ) {
						grupo.setSnAtivo( false );
						grupo.setDtAlteracao( new QtData( Instant.now().toEpochMilli() ) );
						new GrupoNegocio( conexao, grupo ).altera();
					}
					conexao.commit();
					return "inativado";
				}

				List<VinculoTag> tagsVinculo = new ArrayList<>();
				try ( Query query = new Query( conexao ) ) {
					query.setSQL( "select * from Cadastro.VINCULO_TAGS where ID_GRUPO = :id" );
					query.setParameter( "id", idGrupo );
					query.executeQuery();
					if( !query.isEmpty() ) do {
						VinculoTag tag = new VinculoTag();
						VinculoTagLocalizador.buscaCampos( tag, query );
						tagsVinculo.add( tag );
					} while ( query.next() );
				}
				for( VinculoTag tag : tagsVinculo ) new VinculoTagNegocioSeguro( conexao, tag ).exclui();
				List<GrupoTag> tagsGrupo = new ArrayList<>();
				try ( Query query = new Query( conexao ) ) {
					query.setSQL( "select * from Cadastro.GRUPO_TAGS where ID_GRUPO = :id" );
					query.setParameter( "id", idGrupo );
					query.executeQuery();
					if( !query.isEmpty() ) do {
						GrupoTag tag = new GrupoTag();
						GrupoTagLocalizador.buscaCampos( tag, query );
						tagsGrupo.add( tag );
					} while ( query.next() );
				}
				for( GrupoTag tag : tagsGrupo ) new GrupoTagNegocioSeguro( conexao, tag ).exclui();
				List<UsuarioGrupo> integrantes = new ArrayList<>();
				try ( Query query = new Query( conexao ) ) {
					query.setSQL( "select * from Cadastro.USUARIO_GRUPOS where ID_GRUPO = :id" );
					query.setParameter( "id", idGrupo );
					query.executeQuery();
					if( !query.isEmpty() ) do {
						UsuarioGrupo integrante = new UsuarioGrupo();
						UsuarioGrupoLocalizador.buscaCampos( integrante, query );
						integrantes.add( integrante );
					} while ( query.next() );
				}
				for( UsuarioGrupo integrante : integrantes ) new UsuarioGrupoNegocio( conexao, integrante ).exclui();
				new GrupoNegocio( conexao, grupo ).exclui();
				conexao.commit();
				return "excluido";
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	public String removerTag( String codigoInformado ) throws Exception {

		String codigo = codigoInformado == null ? "" : codigoInformado.strip();
		if( codigo.isEmpty() ) throw new ArgousFormsApiException( 400, "TAG_INVALIDA", "Informe a tag." );
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
				boolean utilizada = existe( conexao, "select 1 from Processos.PROTOCOLO_ETAPA_DESTINATARIOS where :id in (CD_TAG_GRUPO, CD_TAG_USUARIO, CD_TAG_VINCULO)", codigo )
					|| existe( conexao, "select 1 from Processos.PROTOCOLO_GESTORES_ELEGIVEIS where :id in (CD_TAG_GRUPO, CD_TAG_USUARIO, CD_TAG_VINCULO)", codigo )
					|| existe( conexao, "select 1 from Docs.PASTA_PERMISSOES where CD_TAG = :id", codigo )
					|| existe( conexao, "select 1 from Docs.ARQUIVO_PERMISSOES where CD_TAG = :id", codigo );
				if( utilizada ) {
					if( tag.isSnAtiva() ) {
						tag.setSnAtiva( false );
						tag.setDtAlteracao( new QtData( Instant.now().toEpochMilli() ) );
						new TagNegocioSeguro( conexao, tag ).altera();
					}
					conexao.commit();
					return "inativada";
				}

				List<VinculoTag> tagsVinculo = new ArrayList<>();
				try ( Query query = new Query( conexao ) ) {
					query.setSQL( "select * from Cadastro.VINCULO_TAGS where CD_TAG = :codigo" );
					query.setParameter( "codigo", codigo );
					query.executeQuery();
					if( !query.isEmpty() ) do {
						VinculoTag vinculo = new VinculoTag();
						VinculoTagLocalizador.buscaCampos( vinculo, query );
						tagsVinculo.add( vinculo );
					} while ( query.next() );
				}
				for( VinculoTag vinculo : tagsVinculo ) new VinculoTagNegocioSeguro( conexao, vinculo ).exclui();
				List<UsuarioTag> tagsUsuario = new ArrayList<>();
				try ( Query query = new Query( conexao ) ) {
					query.setSQL( "select * from Cadastro.USUARIO_TAGS where CD_TAG = :codigo" );
					query.setParameter( "codigo", codigo );
					query.executeQuery();
					if( !query.isEmpty() ) do {
						UsuarioTag vinculo = new UsuarioTag();
						UsuarioTagLocalizador.buscaCampos( vinculo, query );
						tagsUsuario.add( vinculo );
					} while ( query.next() );
				}
				for( UsuarioTag vinculo : tagsUsuario ) new UsuarioTagNegocioSeguro( conexao, vinculo ).exclui();
				List<GrupoTag> tagsGrupo = new ArrayList<>();
				try ( Query query = new Query( conexao ) ) {
					query.setSQL( "select * from Cadastro.GRUPO_TAGS where CD_TAG = :codigo" );
					query.setParameter( "codigo", codigo );
					query.executeQuery();
					if( !query.isEmpty() ) do {
						GrupoTag vinculo = new GrupoTag();
						GrupoTagLocalizador.buscaCampos( vinculo, query );
						tagsGrupo.add( vinculo );
					} while ( query.next() );
				}
				for( GrupoTag vinculo : tagsGrupo ) new GrupoTagNegocioSeguro( conexao, vinculo ).exclui();
				new TagNegocioSeguro( conexao, tag ).exclui();
				conexao.commit();
				return "excluida";
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	private boolean existe( Conexao conexao, String sql, Object id ) throws Exception {

		try ( Query query = new Query( conexao ) ) {
			query.setSQL( sql );
			query.setParameter( "id", id );
			query.executeQuery();
			return !query.isEmpty();
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
