package br.com.argousForms.acessos;

import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.json.JSONArray;
import org.json.JSONObject;

import br.com.argousForms.api.ArgousFormsApiException;
import br.com.argousForms.model.negocio.cadastro.PapelNegocio;
import br.com.argousForms.model.negocio.cadastro.PapelPermissaoNegocio;
import br.com.argousForms.model.negocio.cadastro.PerfilNegocio;
import br.com.argousForms.model.negocio.cadastro.PerfilPapelNegocio;
import br.com.argousForms.model.negocio.cadastro.PerfilPermissaoNegocio;
import br.com.argousForms.model.persistencia.cadastro.Papel;
import br.com.argousForms.model.persistencia.cadastro.PapelLocalizador;
import br.com.argousForms.model.persistencia.cadastro.PapelPermissao;
import br.com.argousForms.model.persistencia.cadastro.PapelPermissaoLocalizador;
import br.com.argousForms.model.persistencia.cadastro.Perfil;
import br.com.argousForms.model.persistencia.cadastro.PerfilLocalizador;
import br.com.argousForms.model.persistencia.cadastro.PerfilPapel;
import br.com.argousForms.model.persistencia.cadastro.PerfilPapelLocalizador;
import br.com.argousForms.model.persistencia.cadastro.PerfilPermissao;
import br.com.argousForms.model.persistencia.cadastro.PerfilPermissaoLocalizador;
import quatro.sql.Conexao;
import quatro.sql.PoolDeConexoes;
import quatro.sql.Query;
import quatro.util.QtData;

public final class AcessosService {

	public JSONObject listar() throws Exception {

		JSONArray papeis = new JSONArray();
		JSONArray perfis = new JSONArray();
		Map<String, JSONObject> perfisPorId = new HashMap<>();
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			try ( Query query = new Query( conexao ) ) {
				query.setSQL( "select ID_PAPEL, CD_PAPEL, DS_NOME, DS_DESCRICAO, SN_SISTEMA, SN_ATIVO from Cadastro.PAPEIS where DT_EXCLUSAO is null order by DS_NOME" );
				query.executeQuery();
				if( !query.isEmpty() ) {
					do {
						JSONObject papel = new JSONObject();
						papel.put( "idPapel", query.getString( "ID_PAPEL" ) );
						papel.put( "codigo", query.getString( "CD_PAPEL" ) );
						papel.put( "nome", query.getString( "DS_NOME" ) );
						papel.put( "descricao", query.getString( "DS_DESCRICAO" ) );
						papel.put( "sistema", query.getBoolean( "SN_SISTEMA" ) );
						papel.put( "ativo", query.getBoolean( "SN_ATIVO" ) );
						papeis.put( papel );
					} while ( query.next() );
				}
			}
			try ( Query query = new Query( conexao ) ) {
				query.setSQL( "select ID_PERFIL, CD_PERFIL, DS_NOME, DS_DESCRICAO, SN_SISTEMA, SN_ATIVO from Cadastro.PERFIS where DT_EXCLUSAO is null order by DS_NOME" );
				query.executeQuery();
				if( !query.isEmpty() ) {
					do {
						JSONObject perfil = new JSONObject();
						String id = query.getString( "ID_PERFIL" );
						perfil.put( "idPerfil", id );
						perfil.put( "codigo", query.getString( "CD_PERFIL" ) );
						perfil.put( "nome", query.getString( "DS_NOME" ) );
						perfil.put( "descricao", query.getString( "DS_DESCRICAO" ) );
						perfil.put( "sistema", query.getBoolean( "SN_SISTEMA" ) );
						perfil.put( "ativo", query.getBoolean( "SN_ATIVO" ) );
						perfil.put( "papeis", new JSONArray() );
						perfis.put( perfil );
						perfisPorId.put( id, perfil );
					} while ( query.next() );
				}
			}
			try ( Query query = new Query( conexao ) ) {
				query.setSQL( "select ID_PERFIL, ID_PAPEL from Cadastro.PERFIL_PAPEIS where DT_EXCLUSAO is null order by ID_PERFIL, ID_PAPEL" );
				query.executeQuery();
				if( !query.isEmpty() ) {
					do {
						JSONObject perfil = perfisPorId.get( query.getString( "ID_PERFIL" ) );
						if( perfil != null ) perfil.getJSONArray( "papeis" ).put( query.getString( "ID_PAPEL" ) );
					} while ( query.next() );
				}
			}
		}
		return new JSONObject().put( "papeis", papeis ).put( "perfis", perfis );
	}

	public UUID salvarPapel( UUID id, String codigoInformado, String nomeInformado, String descricaoInformada, boolean ativo ) throws Exception {

		String codigo = codigo( codigoInformado );
		String nome = nome( nomeInformado );
		String descricao = descricao( descricaoInformada );
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				QtData agora = agora();
				Papel papel;
				if( id == null ) {
					if( existeCodigo( conexao, "Cadastro.PAPEIS", "CD_PAPEL", codigo ) ) throw new ArgousFormsApiException( 409, "PAPEL_JA_EXISTE", "Já existe um papel com esse código." );
					papel = new Papel();
					papel.setCdPapel( codigo );
					papel.setSnSistema( false );
					papel.setDtInclusao( agora );
				} else {
					papel = carregarPapel( conexao, id );
					if( !papel.getCdPapel().equals( codigo ) ) throw new ArgousFormsApiException( 400, "CODIGO_IMUTAVEL", "O código do papel não pode ser alterado." );
					if( papel.isSnSistema() && papel.isSnAtivo() != ativo ) throw new ArgousFormsApiException( 403, "PAPEL_SISTEMA", "O estado de um papel do sistema não pode ser alterado." );
				}
				papel.setDsNome( nome );
				papel.setDsDescricao( descricao );
				papel.setSnAtivo( ativo );
				papel.setDtAlteracao( agora );
				if( id == null ) new PapelNegocio( conexao, papel ).insere();
				else new PapelNegocio( conexao, papel ).altera();
				conexao.commit();
				return papel.getIdPapel();
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	public UUID salvarPerfil( UUID id, String codigoInformado, String nomeInformado, String descricaoInformada, boolean ativo, List<UUID> papeisInformados ) throws Exception {

		String codigo = codigo( codigoInformado );
		String nome = nome( nomeInformado );
		String descricao = descricao( descricaoInformada );
		Set<UUID> papeis = new HashSet<>( papeisInformados );
		if( papeis.size() != papeisInformados.size() ) throw new ArgousFormsApiException( 400, "PAPEIS_INVALIDOS", "Não repita papéis no perfil." );

		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				QtData agora = agora();
				Perfil perfil;
				if( id == null ) {
					if( existeCodigo( conexao, "Cadastro.PERFIS", "CD_PERFIL", codigo ) ) throw new ArgousFormsApiException( 409, "PERFIL_JA_EXISTE", "Já existe um perfil com esse código." );
					perfil = new Perfil();
					perfil.setCdPerfil( codigo );
					perfil.setSnSistema( false );
					perfil.setDtInclusao( agora );
				} else {
					perfil = carregarPerfil( conexao, id );
					if( !perfil.getCdPerfil().equals( codigo ) ) throw new ArgousFormsApiException( 400, "CODIGO_IMUTAVEL", "O código do perfil não pode ser alterado." );
					if( perfil.isSnSistema() && perfil.isSnAtivo() != ativo ) throw new ArgousFormsApiException( 403, "PERFIL_SISTEMA", "O estado de um perfil do sistema não pode ser alterado." );
				}

				Map<UUID, PerfilPapel> vinculos = papeisDoPerfil( conexao, perfil.getIdPerfil() );
				if( perfil.isSnSistema() && !papeis.equals( papeisAtivos( vinculos ) ) ) throw new ArgousFormsApiException( 403, "PERFIL_SISTEMA", "Os papéis de um perfil do sistema não podem ser alterados." );
				for( UUID papelId : papeis ) {
					PerfilPapel vinculo = vinculos.get( papelId );
					if( vinculo == null || vinculo.getDtExclusao() != null ) {
						Papel papel = carregarPapel( conexao, papelId );
						if( !papel.isSnAtivo() ) throw new ArgousFormsApiException( 400, "PAPEL_INATIVO", "Não é possível atribuir um papel inativo ao perfil." );
					}
				}

				perfil.setDsNome( nome );
				perfil.setDsDescricao( descricao );
				perfil.setSnAtivo( ativo );
				perfil.setDtAlteracao( agora );
				if( id == null ) new PerfilNegocio( conexao, perfil ).insere();
				else new PerfilNegocio( conexao, perfil ).altera();
				if( !perfil.isSnSistema() ) sincronizarPapeis( conexao, perfil.getIdPerfil(), papeis, vinculos, agora );
				conexao.commit();
				return perfil.getIdPerfil();
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	public String removerPapel( UUID id ) throws Exception {

		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				Papel papel = carregarPapel( conexao, id );
				if( papel.isSnSistema() ) throw new ArgousFormsApiException( 403, "PAPEL_SISTEMA", "Um papel do sistema não pode ser removido." );
				if( integraPerfilSistema( conexao, id ) ) throw new ArgousFormsApiException( 403, "PERFIL_SISTEMA", "Um papel que integra perfil do sistema não pode ser removido." );
				String resultado;
				if( papelUtilizado( conexao, id ) ) {
					papel.setSnAtivo( false );
					papel.setDtAlteracao( agora() );
					new PapelNegocio( conexao, papel ).altera();
					resultado = "inativado";
				} else {
					for( PerfilPapel vinculo : vinculosPapel( conexao, id ) ) new PerfilPapelNegocio( conexao, vinculo ).exclui();
					for( PapelPermissao vinculo : permissoesPapel( conexao, id ) ) new PapelPermissaoNegocio( conexao, vinculo ).exclui();
					new PapelNegocio( conexao, papel ).exclui();
					resultado = "excluido";
				}
				conexao.commit();
				return resultado;
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	public String removerPerfil( UUID id ) throws Exception {

		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			conexao.beginTransaction();
			try {
				Perfil perfil = carregarPerfil( conexao, id );
				if( perfil.isSnSistema() ) throw new ArgousFormsApiException( 403, "PERFIL_SISTEMA", "Um perfil do sistema não pode ser removido." );
				String resultado;
				if( perfilUtilizado( conexao, id ) ) {
					perfil.setSnAtivo( false );
					perfil.setDtAlteracao( agora() );
					new PerfilNegocio( conexao, perfil ).altera();
					resultado = "inativado";
				} else {
					for( PerfilPapel vinculo : papeisDoPerfil( conexao, id ).values() ) new PerfilPapelNegocio( conexao, vinculo ).exclui();
					for( PerfilPermissao vinculo : permissoesPerfil( conexao, id ) ) new PerfilPermissaoNegocio( conexao, vinculo ).exclui();
					new PerfilNegocio( conexao, perfil ).exclui();
					resultado = "excluido";
				}
				conexao.commit();
				return resultado;
			} catch ( Exception e ) {
				if( conexao.inTransaction() ) conexao.rollback();
				throw e;
			}
		}
	}

	private Papel carregarPapel( Conexao conexao, UUID id ) throws Exception {

		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select * from Cadastro.PAPEIS where ID_PAPEL = :id and DT_EXCLUSAO is null" );
			query.setParameter( "id", id.toString() );
			query.executeQuery();
			if( query.isEmpty() ) throw new ArgousFormsApiException( 404, "PAPEL_NAO_ENCONTRADO", "Papel não encontrado." );
			Papel papel = new Papel();
			PapelLocalizador.buscaCampos( papel, query );
			return papel;
		}
	}

	private Perfil carregarPerfil( Conexao conexao, UUID id ) throws Exception {

		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select * from Cadastro.PERFIS where ID_PERFIL = :id and DT_EXCLUSAO is null" );
			query.setParameter( "id", id.toString() );
			query.executeQuery();
			if( query.isEmpty() ) throw new ArgousFormsApiException( 404, "PERFIL_NAO_ENCONTRADO", "Perfil não encontrado." );
			Perfil perfil = new Perfil();
			PerfilLocalizador.buscaCampos( perfil, query );
			return perfil;
		}
	}

	private Map<UUID, PerfilPapel> papeisDoPerfil( Conexao conexao, UUID id ) throws Exception {

		Map<UUID, PerfilPapel> vinculos = new HashMap<>();
		if( id == null ) return vinculos;
		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select * from Cadastro.PERFIL_PAPEIS where ID_PERFIL = :id" );
			query.setParameter( "id", id.toString() );
			query.executeQuery();
			if( !query.isEmpty() ) {
				do {
					PerfilPapel vinculo = new PerfilPapel();
					PerfilPapelLocalizador.buscaCampos( vinculo, query );
					vinculos.put( vinculo.getIdPapel(), vinculo );
				} while ( query.next() );
			}
		}
		return vinculos;
	}

	private Set<UUID> papeisAtivos( Map<UUID, PerfilPapel> vinculos ) {

		Set<UUID> ativos = new HashSet<>();
		for( PerfilPapel vinculo : vinculos.values() ) {
			if( vinculo.getDtExclusao() == null ) ativos.add( vinculo.getIdPapel() );
		}
		return ativos;
	}

	private void sincronizarPapeis( Conexao conexao, UUID perfilId, Set<UUID> desejados, Map<UUID, PerfilPapel> existentes, QtData agora ) throws Exception {

		for( PerfilPapel vinculo : existentes.values() ) {
			boolean desejado = desejados.contains( vinculo.getIdPapel() );
			if( desejado == ( vinculo.getDtExclusao() == null ) ) continue;
			vinculo.setDtExclusao( desejado ? null : agora );
			new PerfilPapelNegocio( conexao, vinculo ).altera();
		}
		for( UUID papelId : desejados ) {
			if( existentes.containsKey( papelId ) ) continue;
			PerfilPapel vinculo = new PerfilPapel();
			vinculo.setIdPerfil( perfilId );
			vinculo.setIdPapel( papelId );
			vinculo.setDtInclusao( agora );
			new PerfilPapelNegocio( conexao, vinculo ).insere();
		}
	}

	private List<PerfilPapel> vinculosPapel( Conexao conexao, UUID id ) throws Exception {

		List<PerfilPapel> vinculos = new java.util.ArrayList<>();
		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select * from Cadastro.PERFIL_PAPEIS where ID_PAPEL = :id" );
			query.setParameter( "id", id.toString() );
			query.executeQuery();
			if( !query.isEmpty() ) {
				do {
					PerfilPapel vinculo = new PerfilPapel();
					PerfilPapelLocalizador.buscaCampos( vinculo, query );
					vinculos.add( vinculo );
				} while ( query.next() );
			}
		}
		return vinculos;
	}

	private List<PapelPermissao> permissoesPapel( Conexao conexao, UUID id ) throws Exception {

		List<PapelPermissao> vinculos = new java.util.ArrayList<>();
		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select * from Cadastro.PAPEL_PERMISSOES where ID_PAPEL = :id" );
			query.setParameter( "id", id.toString() );
			query.executeQuery();
			if( !query.isEmpty() ) {
				do {
					PapelPermissao vinculo = new PapelPermissao();
					PapelPermissaoLocalizador.buscaCampos( vinculo, query );
					vinculos.add( vinculo );
				} while ( query.next() );
			}
		}
		return vinculos;
	}

	private List<PerfilPermissao> permissoesPerfil( Conexao conexao, UUID id ) throws Exception {

		List<PerfilPermissao> vinculos = new java.util.ArrayList<>();
		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select * from Cadastro.PERFIL_PERMISSOES where ID_PERFIL = :id" );
			query.setParameter( "id", id.toString() );
			query.executeQuery();
			if( !query.isEmpty() ) {
				do {
					PerfilPermissao vinculo = new PerfilPermissao();
					PerfilPermissaoLocalizador.buscaCampos( vinculo, query );
					vinculos.add( vinculo );
				} while ( query.next() );
			}
		}
		return vinculos;
	}

	private boolean existeCodigo( Conexao conexao, String tabela, String coluna, String codigo ) throws Exception {

		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select 1 from " + tabela + " where " + coluna + " = :codigo" );
			query.setParameter( "codigo", codigo );
			query.executeQuery();
			return !query.isEmpty();
		}
	}

	private boolean papelUtilizado( Conexao conexao, UUID id ) throws Exception {

		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select 1 from Cadastro.PERFIL_PAPEIS pp join Cadastro.USUARIO_PERFIS up on up.ID_PERFIL = pp.ID_PERFIL where pp.ID_PAPEL = :id" );
			query.setParameter( "id", id.toString() );
			query.executeQuery();
			return !query.isEmpty();
		}
	}

	private boolean integraPerfilSistema( Conexao conexao, UUID id ) throws Exception {

		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select 1 from Cadastro.PERFIL_PAPEIS pp join Cadastro.PERFIS p on p.ID_PERFIL = pp.ID_PERFIL where pp.ID_PAPEL = :id and p.SN_SISTEMA = true" );
			query.setParameter( "id", id.toString() );
			query.executeQuery();
			return !query.isEmpty();
		}
	}

	private boolean perfilUtilizado( Conexao conexao, UUID id ) throws Exception {

		try ( Query query = new Query( conexao ) ) {
			query.setSQL( "select 1 from Cadastro.USUARIO_PERFIS where ID_PERFIL = :id" );
			query.setParameter( "id", id.toString() );
			query.executeQuery();
			return !query.isEmpty();
		}
	}

	private String codigo( String informado ) throws ArgousFormsApiException {

		String valor = informado == null ? "" : informado.strip().toUpperCase( Locale.ROOT );
		if( valor.isEmpty() || valor.length() > 70 ) throw new ArgousFormsApiException( 400, "CODIGO_INVALIDO", "Informe um código de até 70 caracteres." );
		return valor;
	}

	private String nome( String informado ) throws ArgousFormsApiException {

		String valor = informado == null ? "" : informado.strip();
		if( valor.isEmpty() || valor.length() > 120 ) throw new ArgousFormsApiException( 400, "NOME_INVALIDO", "Informe um nome de até 120 caracteres." );
		return valor;
	}

	private String descricao( String informado ) throws ArgousFormsApiException {

		String valor = informado == null ? "" : informado.strip();
		if( valor.isEmpty() ) throw new ArgousFormsApiException( 400, "DESCRICAO_INVALIDA", "Informe a descrição." );
		return valor;
	}

	private QtData agora() {
		return new QtData( Instant.now().toEpochMilli() );
	}
}
