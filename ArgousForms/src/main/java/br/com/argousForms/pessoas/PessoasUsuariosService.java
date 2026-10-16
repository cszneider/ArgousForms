package br.com.argousForms.pessoas;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import org.json.JSONArray;
import org.json.JSONObject;

import quatro.sql.Conexao;
import quatro.sql.PoolDeConexoes;
import quatro.sql.Query;

public final class PessoasUsuariosService {

	public JSONObject catalogo() throws Exception {

		JSONArray paises = new JSONArray();
		JSONArray tipos = new JSONArray();
		JSONArray perfis = new JSONArray();
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			try ( Query query = new Query( conexao ) ) {
				query.setSQL( "select ID_PAIS, CD_ISO_2, DS_NOME from Cadastro.PAISES where SN_ATIVO = true order by DS_NOME" );
				query.executeQuery();
				if( !query.isEmpty() ) do {
					paises.put( new JSONObject().put( "idPais", query.getInt( "ID_PAIS" ) ).put( "codigo", query.getString( "CD_ISO_2" ) ).put( "nome", query.getString( "DS_NOME" ) ) );
				} while ( query.next() );
			}
			try ( Query query = new Query( conexao ) ) {
				query.setSQL( "select ID_TIPO_IDENTIFICACAO, ID_PAIS, CD_TIPO, DS_NOME, CD_REGEX, DS_MASCARA from Cadastro.TIPOS_IDENTIFICACAO where SN_ATIVO = true order by ID_PAIS, DS_NOME" );
				query.executeQuery();
				if( !query.isEmpty() ) do {
					tipos.put( new JSONObject().put( "idTipo", query.getInt( "ID_TIPO_IDENTIFICACAO" ) ).put( "idPais", query.getInt( "ID_PAIS" ) ).put( "codigo", query.getString( "CD_TIPO" ) ).put( "nome", query.getString( "DS_NOME" ) ).put( "regex", query.getString( "CD_REGEX" ) ).put( "mascara", query.getString( "DS_MASCARA" ) ) );
				} while ( query.next() );
			}
			try ( Query query = new Query( conexao ) ) {
				query.setSQL( "select ID_PERFIL, CD_PERFIL, DS_NOME from Cadastro.PERFIS where SN_ATIVO = true and DT_EXCLUSAO is null order by DS_NOME" );
				query.executeQuery();
				if( !query.isEmpty() ) do {
					perfis.put( new JSONObject().put( "idPerfil", query.getString( "ID_PERFIL" ) ).put( "codigo", query.getString( "CD_PERFIL" ) ).put( "nome", query.getString( "DS_NOME" ) ) );
				} while ( query.next() );
			}
		}
		return new JSONObject().put( "paises", paises ).put( "tipos", tipos ).put( "perfis", perfis );
	}

	public JSONObject consultar( UUID idPessoa, UUID idUsuario ) throws Exception {

		if( idPessoa == null && idUsuario == null ) throw new IllegalArgumentException( "Informe a Pessoa ou o Usuário." );
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			JSONObject dados;
			try ( Query query = new Query( conexao ) ) {
				query.setSQL( idUsuario == null
					? "select p.*, u.ID_USUARIO_SISTEMA, u.DS_EMAIL, u.DT_EXCLUSAO as DT_EXCLUSAO_USUARIO from Cadastro.PESSOAS p left join Cadastro.USUARIOS_SISTEMA u on u.ID_PESSOA = p.ID_PESSOA where p.ID_PESSOA = :id and p.DT_EXCLUSAO is null"
					: "select p.*, u.ID_USUARIO_SISTEMA, u.DS_EMAIL, u.DT_EXCLUSAO as DT_EXCLUSAO_USUARIO from Cadastro.PESSOAS p join Cadastro.USUARIOS_SISTEMA u on u.ID_PESSOA = p.ID_PESSOA where u.ID_USUARIO_SISTEMA = :id and u.DT_EXCLUSAO is null" );
				query.setParameter( "id", ( idUsuario == null ? idPessoa : idUsuario ).toString() );
				query.executeQuery();
				if( query.isEmpty() ) return null;
				dados = new JSONObject();
				dados.put( "idPessoa", query.getString( "ID_PESSOA" ) );
				dados.put( "idUsuario", query.getString( "ID_USUARIO_SISTEMA" ) );
				dados.put( "contaExcluida", query.getString( "ID_USUARIO_SISTEMA" ) != null && query.getDate( "DT_EXCLUSAO_USUARIO" ) != null );
				dados.put( "nome", query.getString( "DS_NOME_PESSOA" ) );
				dados.put( "nomeSocial", query.getString( "DS_NOME_SOCIAL" ) );
				dados.put( "sexo", query.getString( "TP_SEXO" ) );
				String emailPessoa = query.getString( "DS_END_EMAIL" );
				String emailUsuario = query.getString( "DS_EMAIL" );
				boolean contaExcluida = dados.getBoolean( "contaExcluida" );
				dados.put( "email", contaExcluida && emailPessoa != null ? emailPessoa : emailUsuario == null ? emailPessoa : emailUsuario );
				dados.put( "telefone", query.getString( "DS_TELEFONE" ) );
				dados.put( "nascimento", query.getDate( "DT_NASCIMENTO" ) == null ? JSONObject.NULL : query.getDate( "DT_NASCIMENTO" ).toString() );
			}

			UUID id = UUID.fromString( dados.getString( "idPessoa" ) );
			JSONArray nacionalidades = new JSONArray();
			try ( Query query = new Query( conexao ) ) {
				query.setSQL( "select ID_PAIS from Cadastro.PESSOA_NACIONALIDADES where ID_PESSOA = :id order by ID_PAIS" );
				query.setParameter( "id", id.toString() );
				query.executeQuery();
				if( !query.isEmpty() ) do { nacionalidades.put( query.getInt( "ID_PAIS" ) ); } while ( query.next() );
			}
			dados.put( "nacionalidades", nacionalidades );

			JSONArray identificacoes = new JSONArray();
			try ( Query query = new Query( conexao ) ) {
				query.setSQL( "select ID_PAIS, ID_TIPO_IDENTIFICACAO, CD_IDENTIFICACAO from Cadastro.PESSOA_IDENTIFICACOES where ID_PESSOA = :id order by ID_PAIS" );
				query.setParameter( "id", id.toString() );
				query.executeQuery();
				if( !query.isEmpty() ) do {
					identificacoes.put( new JSONObject().put( "idPais", query.getInt( "ID_PAIS" ) ).put( "idTipo", query.getInt( "ID_TIPO_IDENTIFICACAO" ) ).put( "numero", query.getString( "CD_IDENTIFICACAO" ) ) );
				} while ( query.next() );
			}
			dados.put( "identificacoes", identificacoes );

			JSONArray perfis = new JSONArray();
			if( idUsuario != null ) try ( Query query = new Query( conexao ) ) {
				query.setSQL( "select ID_PERFIL from Cadastro.USUARIO_PERFIS where ID_USUARIO_SISTEMA = :id and DT_REVOGACAO is null and (DT_FIM_VIGENCIA is null or DT_FIM_VIGENCIA > CURRENT_TIMESTAMP)" );
				query.setParameter( "id", idUsuario.toString() );
				query.executeQuery();
				if( !query.isEmpty() ) do { perfis.put( query.getString( "ID_PERFIL" ) ); } while ( query.next() );
			}
			dados.put( "perfis", perfis );
			return dados;
		}
	}

	public JSONObject listar() throws Exception {

		JSONArray pessoas = new JSONArray();
		JSONArray usuarios = new JSONArray();
		Map<String, JSONObject> usuariosPorId = new HashMap<>();
		try ( Conexao conexao = PoolDeConexoes.getConexao() ) {
			try ( Query query = new Query( conexao ) ) {
				query.setSQL( "select p.ID_PESSOA, p.DS_NOME_PESSOA, p.DS_NOME_SOCIAL, p.DS_END_EMAIL, p.DS_TELEFONE "
					+ "from Cadastro.PESSOAS p where p.DT_EXCLUSAO is null "
					+ "and not exists (select 1 from Cadastro.USUARIOS_SISTEMA u where u.ID_PESSOA = p.ID_PESSOA and u.DT_EXCLUSAO is null) "
					+ "order by p.DS_NOME_PESSOA, p.ID_PESSOA" );
				query.executeQuery();
				if( !query.isEmpty() ) {
					do {
						JSONObject pessoa = new JSONObject();
						pessoa.put( "idPessoa", query.getString( "ID_PESSOA" ) );
						pessoa.put( "nome", query.getString( "DS_NOME_PESSOA" ) );
						pessoa.put( "nomeSocial", query.getString( "DS_NOME_SOCIAL" ) );
						pessoa.put( "email", query.getString( "DS_END_EMAIL" ) );
						pessoa.put( "telefone", query.getString( "DS_TELEFONE" ) );
						pessoas.put( pessoa );
					} while ( query.next() );
				}
			}
			try ( Query query = new Query( conexao ) ) {
				query.setSQL( "select ID_USUARIO_SISTEMA, ID_PESSOA, DS_NOME, DS_EMAIL from Cadastro.USUARIOS_SISTEMA "
					+ "where DT_EXCLUSAO is null order by DS_NOME, ID_USUARIO_SISTEMA" );
				query.executeQuery();
				if( !query.isEmpty() ) {
					do {
						JSONObject usuario = new JSONObject();
						String id = query.getString( "ID_USUARIO_SISTEMA" );
						usuario.put( "idUsuario", id );
						usuario.put( "idPessoa", query.getString( "ID_PESSOA" ) );
						usuario.put( "nome", query.getString( "DS_NOME" ) );
						usuario.put( "email", query.getString( "DS_EMAIL" ) );
						usuario.put( "perfis", new JSONArray() );
						usuarios.put( usuario );
						usuariosPorId.put( id, usuario );
					} while ( query.next() );
				}
			}
			try ( Query query = new Query( conexao ) ) {
				query.setSQL( "select up.ID_USUARIO_SISTEMA, p.CD_PERFIL from Cadastro.USUARIO_PERFIS up "
					+ "join Cadastro.PERFIS p on p.ID_PERFIL = up.ID_PERFIL "
					+ "where up.DT_REVOGACAO is null and (up.DT_INICIO_VIGENCIA is null or up.DT_INICIO_VIGENCIA <= CURRENT_TIMESTAMP) "
					+ "and (up.DT_FIM_VIGENCIA is null or up.DT_FIM_VIGENCIA > CURRENT_TIMESTAMP) "
					+ "and p.SN_ATIVO = true and p.DT_EXCLUSAO is null order by up.ID_USUARIO_SISTEMA, p.CD_PERFIL" );
				query.executeQuery();
				if( !query.isEmpty() ) {
					do {
						JSONObject usuario = usuariosPorId.get( query.getString( "ID_USUARIO_SISTEMA" ) );
						if( usuario != null ) usuario.getJSONArray( "perfis" ).put( query.getString( "CD_PERFIL" ) );
					} while ( query.next() );
				}
			}
		}
		return new JSONObject().put( "pessoas", pessoas ).put( "usuarios", usuarios );
	}
}
